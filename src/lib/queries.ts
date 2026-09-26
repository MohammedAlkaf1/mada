import {db} from './db';
import {courseScope,type Actor} from './access';
import {DomainError,isOverdue,publishBlockers,versionLocked} from './domain';
import {billingStateFor} from './billing';
import {closeExpiredAttempts} from './learning-commands';
import type {AttemptState,AuditRow,CertificateRow,CourseRow,EnrollmentRow,ExportRow,GroupRow,LearnerCourse,MemberRow,ReviewDetail,ReviewRow,ShellState,StaffDashboard,VersionState} from './types';

/* Read models, one per screen. Each is scoped by the actor before it touches
   a table, and serialised through JSON so it can cross to the client. The
   correct answers of a quiz are only ever read by the staff queries. */

const plain=<T>(x:unknown)=>JSON.parse(JSON.stringify(x)) as T;

export async function shellFor(a:Actor):Promise<ShellState>{
 const [tenant,memberships,notifications,learning,billing]=await Promise.all([
  db.tenant.findUniqueOrThrow({where:{id:a.tenantId},select:{id:true,nameAr:true,nameEn:true,brandColor:true,logoMime:true,kind:true,timezone:true}}),
  db.membership.findMany({where:{userId:a.userId,active:true},include:{tenant:{select:{nameAr:true,nameEn:true}}},orderBy:{createdAt:'asc'}}),
  db.notification.findMany({where:{tenantId:a.tenantId,userId:a.userId},orderBy:{createdAt:'desc'},take:30}),
  db.enrollment.count({where:{tenantId:a.tenantId,membershipId:a.membershipId,status:{notIn:['Withdrawn','Cancelled']}}}),
  a.role==='Admin'?billingStateFor(a.tenantId):Promise.resolve(null),
 ]);
 return plain({actor:{userId:a.userId,membershipId:a.membershipId,tenantId:a.tenantId,role:a.role,name:a.name,email:a.email,tenantStatus:a.tenantStatus,platformOperator:a.platformOperator},tenant:{...tenant,hasLogo:!!tenant.logoMime,logoMime:undefined},memberships:memberships.map(m=>({id:m.id,tenantId:m.tenantId,role:m.role,tenant:m.tenant})),notifications,learning,billing:billing?{status:billing.status,daysLeft:billing.daysLeft}:null});
}

const enrollmentInclude={membership:{include:{user:{select:{name:true,email:true}}}},courseVersion:{select:{title:true,number:true,quizEnabled:true,courseId:true}},certificate:{select:{id:true,serial:true,status:true}},_count:{select:{attempts:true}}} as const;
function enrollmentRow(e:any):EnrollmentRow{
 return {id:e.id,membershipId:e.membershipId,name:e.membership.user.name,email:e.membership.user.email,courseId:e.courseId,courseTitle:e.courseVersion.title,versionId:e.versionId,versionNumber:e.courseVersion.number,groupId:e.groupId,status:e.status,startsAt:e.startsAt,dueAt:e.dueAt,createdAt:e.createdAt,startedAt:e.startedAt,completedAt:e.completedAt,requiredDone:e.requiredDone,requiredTotal:e.requiredTotal,quizEnabled:e.courseVersion.quizEnabled,quizPassed:e.quizPassed,bestScore:e.bestScore,attempts:e._count.attempts,certificate:e.certificate};
}

/** Staff scope over enrollments: all for an admin, the courses they teach for an instructor. */
function enrollmentScope(a:Actor){
 return {tenantId:a.tenantId,...(a.role==='Instructor'?{courseVersion:{course:{instructorIds:{has:a.userId}}}}:{})};
}

export async function staffDashboard(a:Actor){
 const scope=enrollmentScope(a);
 const [enrollments,courses,members,groups,recent]=await Promise.all([
  db.enrollment.findMany({where:{...scope,status:{not:'Cancelled'}},select:{id:true,courseId:true,status:true,dueAt:true,completedAt:true,createdAt:true,startedAt:true}}),
  db.course.findMany({where:{...courseScope(a),archivedAt:null},select:{id:true,title:true,versions:{select:{status:true},orderBy:{number:'desc'},take:1}}}),
  a.role==='Admin'?db.membership.groupBy({by:['role'],where:{tenantId:a.tenantId,active:true,supportGrant:false},_count:{_all:true}}):Promise.resolve([]),
  a.role==='Admin'?db.group.count({where:{tenantId:a.tenantId,archivedAt:null}}):Promise.resolve(0),
  db.enrollment.findMany({where:{...scope,status:'Completed'},orderBy:{completedAt:'desc'},take:8,include:enrollmentInclude}),
 ]);
 const now=new Date();
 const byCourse=courses.map(c=>{const list=enrollments.filter(e=>e.courseId===c.id&&e.status!=='Withdrawn');return {id:c.id,title:c.title,status:c.versions[0]?.status??'Draft',enrolled:list.length,started:list.filter(e=>e.status!=='NotStarted').length,completed:list.filter(e=>e.status==='Completed').length,overdue:list.filter(e=>isOverdue(e,now)).length};}).sort((x,y)=>y.enrolled-x.enrolled);
 const active=enrollments.filter(e=>e.status!=='Withdrawn');
 // Completions per week for the last eight weeks, counted from the completion date itself.
 const weeks=Array.from({length:8},(_,i)=>{const end=new Date(now.getTime()-(7-i)*7*86400000);const start=new Date(end.getTime()-7*86400000);return {start:start.toISOString(),end:end.toISOString(),completed:enrollments.filter(e=>e.completedAt&&e.completedAt>start&&e.completedAt<=end).length,assigned:enrollments.filter(e=>e.createdAt>start&&e.createdAt<=end).length};});
 return plain<StaffDashboard>({
  totals:{enrolled:active.length,notStarted:active.filter(e=>e.status==='NotStarted').length,inProgress:active.filter(e=>e.status==='InProgress').length,completed:active.filter(e=>e.status==='Completed').length,overdue:active.filter(e=>isOverdue(e,now)).length,withdrawn:enrollments.filter(e=>e.status==='Withdrawn').length,courses:courses.length,published:courses.filter(c=>c.versions[0]?.status==='Published').length,groups},
  members:Object.fromEntries((members as {role:string;_count:{_all:number}}[]).map(m=>[m.role,m._count._all])),
  byCourse,weeks,recent:recent.map(enrollmentRow),
 });
}

export async function learnerHome(a:Actor){
 const list=await db.enrollment.findMany({where:{tenantId:a.tenantId,membershipId:a.membershipId,status:{notIn:['Cancelled']}},include:{courseVersion:{select:{title:true,description:true,coverAssetId:true,estimatedMinutes:true,quizEnabled:true,number:true}},certificate:{select:{id:true,serial:true,status:true}}},orderBy:[{dueAt:{sort:'asc',nulls:'last'}},{createdAt:'desc'}]});
 return plain(list.map(e=>({id:e.id,status:e.status,startsAt:e.startsAt,dueAt:e.dueAt,requiredDone:e.requiredDone,requiredTotal:e.requiredTotal,quizEnabled:e.courseVersion.quizEnabled,quizPassed:e.quizPassed,completedAt:e.completedAt,title:e.courseVersion.title,description:e.courseVersion.description,coverAssetId:e.courseVersion.coverAssetId,estimatedMinutes:e.courseVersion.estimatedMinutes,certificate:e.certificate}))) as {id:string;status:string;startsAt:string;dueAt:string|null;requiredDone:number;requiredTotal:number;quizEnabled:boolean;quizPassed:boolean;completedAt:string|null;title:string;description:string;coverAssetId:string|null;estimatedMinutes:number;certificate:{id:string;serial:string;status:string}|null}[];
}

export async function courseList(a:Actor):Promise<CourseRow[]>{
 const courses=await db.course.findMany({where:courseScope(a),include:{versions:{orderBy:{number:'desc'},select:{id:true,number:true,status:true,title:true,coverAssetId:true,_count:{select:{lessons:true}}}}},orderBy:{createdAt:'desc'}});
 const stats=await db.enrollment.findMany({where:{tenantId:a.tenantId,courseId:{in:courses.map(c=>c.id)},status:{notIn:['Cancelled','Withdrawn']}},select:{courseId:true,status:true,dueAt:true}});
 return plain(courses.map(c=>{const latest=c.versions[0];const published=c.versions.find(v=>v.status==='Published');const s=stats.filter(e=>e.courseId===c.id);return {id:c.id,title:c.title,category:c.category,archivedAt:c.archivedAt,createdAt:c.createdAt,instructorIds:c.instructorIds,latest:{id:latest.id,number:latest.number,status:latest.status,title:latest.title,coverAssetId:latest.coverAssetId},published:published?{id:published.id,number:published.number}:null,lessons:latest._count.lessons,enrolled:s.length,completed:s.filter(e=>e.status==='Completed').length,overdue:s.filter(e=>isOverdue(e)).length};}));
}

export async function courseEditor(a:Actor,courseId:string,versionId?:string){
 const course=await db.course.findFirst({where:{...courseScope(a),id:courseId},include:{versions:{orderBy:{number:'desc'},include:{_count:{select:{enrollments:true}}}}}});
 if(!course)throw new DomainError('notFound',404);
 const pick=course.versions.find(v=>v.id===versionId)??course.versions.find(v=>v.status==='Draft')??course.versions[0];
 const v=await db.courseVersion.findUniqueOrThrow({where:{id:pick.id},include:{modules:{orderBy:{position:'asc'},include:{lessons:{orderBy:{position:'asc'}}}},questions:{orderBy:{position:'asc'}}}});
 const assetIds=[...new Set([v.coverAssetId,...v.modules.flatMap(m=>m.lessons.map(l=>l.assetId))].filter((x):x is string=>!!x))];
 const [assets,staff,library]=await Promise.all([
  db.asset.findMany({where:{id:{in:assetIds},tenantId:a.tenantId},select:{id:true,name:true,mime:true,size:true,status:true}}),
  db.membership.findMany({where:{tenantId:a.tenantId,active:true,role:{in:['Admin','Instructor']},supportGrant:false},include:{user:{select:{id:true,name:true}}}}),
  db.asset.findMany({where:{tenantId:a.tenantId,status:{not:'Rejected'}},orderBy:{createdAt:'desc'},take:60,select:{id:true,name:true,mime:true,size:true,status:true}}),
 ]);
 const clean=new Set(assets.filter(x=>x.status==='Clean').map(x=>x.id));
 const lessons=v.modules.flatMap(m=>m.lessons);
 const blockers=publishBlockers({title:v.title,lessons:lessons.map(l=>({...l,assetClean:l.assetId?clean.has(l.assetId):undefined})),quizEnabled:v.quizEnabled,passPercent:v.passPercent,maxAttempts:v.maxAttempts,questions:v.questions.map(q=>({...q,choices:q.choices as {id:string;text:string}[]}))});
 const enrollments=course.versions.find(x=>x.id===v.id)!._count.enrollments;
 const version:VersionState=plain({...v,enrollments,locked:versionLocked(enrollments),modules:v.modules,questions:v.questions});
 return {
  course:plain<{id:string;title:string;category:string;archivedAt:string|null;instructorIds:string[]}>({id:course.id,title:course.title,category:course.category,archivedAt:course.archivedAt,instructorIds:course.instructorIds}),
  versions:plain<VersionState[]>(course.versions.map(x=>({id:x.id,number:x.number,status:x.status,title:x.title,publishedAt:x.publishedAt,createdAt:x.createdAt,enrollments:x._count.enrollments}))),
  version,blockers,
  assets:plain<Record<string,{id:string;name:string;mime:string;size:number;status:string}>>(Object.fromEntries(assets.map(x=>[x.id,x]))),
  library:plain<{id:string;name:string;mime:string;size:number;status:string}[]>(library),
  staff:staff.map(m=>({userId:m.user.id,name:m.user.name,role:m.role})),
 };
}

export async function assignOptions(a:Actor){
 const [members,groups]=await Promise.all([
  db.membership.findMany({where:{tenantId:a.tenantId,active:true,supportGrant:false},include:{user:{select:{name:true,email:true}}},orderBy:{user:{name:'asc'}}}),
  db.group.findMany({where:{tenantId:a.tenantId,archivedAt:null},include:{_count:{select:{members:true}}},orderBy:{name:'asc'}}),
 ]);
 return {members:members.map(m=>({id:m.id,name:m.user.name,email:m.user.email,role:m.role})),groups:groups.map(g=>({id:g.id,name:g.name,count:g._count.members}))};
}

export async function courseEnrollments(a:Actor,courseId:string){
 const list=await db.enrollment.findMany({where:{...enrollmentScope(a),courseId,status:{not:'Cancelled'}},include:enrollmentInclude,orderBy:{createdAt:'desc'}});
 return plain<EnrollmentRow[]>(list.map(enrollmentRow));
}

export async function people(a:Actor){
 const [members,groups,imports]=await Promise.all([
  db.membership.findMany({where:{tenantId:a.tenantId},include:{user:{select:{name:true,email:true,verified:true,lastSeenAt:true}},groups:{select:{groupId:true}}},orderBy:{createdAt:'desc'}}),
  db.group.findMany({where:{tenantId:a.tenantId},include:{members:{select:{membershipId:true}}},orderBy:{name:'asc'}}),
  db.importJob.findMany({where:{tenantId:a.tenantId},orderBy:{createdAt:'desc'},take:10,select:{id:true,filename:true,status:true,totalRows:true,createdRows:true,skippedRows:true,errorRows:true,createdAt:true,appliedAt:true}}),
 ]);
 return plain<{members:MemberRow[];groups:GroupRow[];imports:{id:string;filename:string;status:string;totalRows:number;createdRows:number;skippedRows:number;errorRows:number;createdAt:string;appliedAt:string|null}[]}>({
  members:members.map(m=>({id:m.id,userId:m.userId,name:m.user.name,email:m.user.email,role:m.role,title:m.title,active:m.active,verified:m.user.verified,supportGrant:m.supportGrant,expiresAt:m.expiresAt,createdAt:m.createdAt,lastSeenAt:m.user.lastSeenAt,groupIds:m.groups.map(g=>g.groupId)})),
  groups:groups.map(g=>({id:g.id,name:g.name,description:g.description,archivedAt:g.archivedAt,memberIds:g.members.map(m=>m.membershipId)})),
  imports,
 });
}

export async function memberDetail(a:Actor,membershipId:string){
 const m=await db.membership.findFirst({where:{id:membershipId,tenantId:a.tenantId},include:{user:{select:{name:true,email:true}}}});
 if(!m)throw new DomainError('notFound',404);
 const list=await db.enrollment.findMany({where:{tenantId:a.tenantId,membershipId:m.id},include:enrollmentInclude,orderBy:{createdAt:'desc'}});
 return plain<{member:{id:string;name:string;email:string;role:string};enrollments:EnrollmentRow[]}>({member:{id:m.id,name:m.user.name,email:m.user.email,role:m.role},enrollments:list.map(enrollmentRow)});
}

export async function learnerCourse(a:Actor,enrollmentId:string):Promise<LearnerCourse>{
 const e=await db.enrollment.findFirst({where:{id:enrollmentId,tenantId:a.tenantId,membershipId:a.membershipId,status:{not:'Cancelled'}},include:{courseVersion:{include:{modules:{orderBy:{position:'asc'},include:{lessons:{orderBy:{position:'asc'}}}},_count:{select:{questions:true}}}},progress:true,attempts:{orderBy:{number:'asc'}},certificate:{select:{id:true,serial:true,status:true}}}});
 if(!e)throw new DomainError('notFound',404);
 const v=e.courseVersion;
 const ids=[...new Set([v.coverAssetId,...v.modules.flatMap(m=>m.lessons.map(l=>l.assetId))].filter((x):x is string=>!!x))];
 const [assets,counts]=await Promise.all([
  db.asset.findMany({where:{id:{in:ids},tenantId:a.tenantId},select:{id:true,name:true,mime:true,size:true,status:true}}),
  db.question.groupBy({by:['lessonId'],where:{versionId:v.id,tenantId:a.tenantId},_count:{_all:true}}),
 ]);
 return plain({
  enrollment:{id:e.id,status:e.status,startsAt:e.startsAt,dueAt:e.dueAt,requiredDone:e.requiredDone,requiredTotal:e.requiredTotal,quizPassed:e.quizPassed,bestScore:e.bestScore,completedAt:e.completedAt},
  version:{id:v.id,number:v.number,title:v.title,description:v.description,coverAssetId:v.coverAssetId,estimatedMinutes:v.estimatedMinutes,quizEnabled:v.quizEnabled,passPercent:v.passPercent,maxAttempts:v.maxAttempts,timeLimitMinutes:v.timeLimitMinutes,questionCount:counts.find(c=>c.lessonId===null)?._count._all??0},
  modules:v.modules,
  progress:Object.fromEntries(e.progress.map(p=>[p.lessonId,{completedAt:p.completedAt,position:p.position,watchedSeconds:p.watchedSeconds}])),
  attempts:e.attempts.map(x=>({id:x.id,scope:x.scope,number:x.number,status:x.status,startedAt:x.startedAt,deadlineAt:x.deadlineAt,submittedAt:x.submittedAt,score:x.score,passed:x.passed})),
  quizQuestions:Object.fromEntries(counts.map(c=>[c.lessonId??'final',c._count._all])),
  certificate:e.certificate,
  assets:Object.fromEntries(assets.map(x=>[x.id,x])),
 });
}

/**
 * The attempt screen. While the attempt is open the correct answers are
 * stripped. After grading they are shown for a practice quiz, or once the
 * learner passed or used every attempt, so a failed learner cannot harvest
 * the key of a graded quiz. The model answer for graders is never shown.
 */
export async function attemptView(a:Actor,attemptId:string):Promise<AttemptState>{
 await closeExpiredAttempts(a.tenantId);
 const at=await db.quizAttempt.findFirst({where:{id:attemptId,tenantId:a.tenantId,enrollment:{membershipId:a.membershipId}},include:{enrollment:{include:{courseVersion:{include:{questions:{orderBy:{position:'asc'}}}}}}}});
 if(!at)throw new DomainError('notFound',404);
 const v=at.enrollment.courseVersion;
 const lesson=at.lessonId?await db.lesson.findFirst({where:{id:at.lessonId,tenantId:a.tenantId},select:{id:true,title:true,graded:true,passPercent:true,maxAttempts:true}}):null;
 const used=await db.quizAttempt.count({where:{enrollmentId:at.enrollmentId,scope:at.scope}});
 const maxAttempts=lesson?.maxAttempts??v.maxAttempts;
 const reveal=at.status==='Graded'&&(lesson?.graded===false||at.passed===true||used>=maxAttempts);
 const questions=v.questions.filter(q=>(q.lessonId??null)===(at.lessonId??null));
 return plain({id:at.id,number:at.number,status:at.status,startedAt:at.startedAt,deadlineAt:at.deadlineAt,submittedAt:at.submittedAt,serverNow:new Date(),answers:at.answers,score:at.score,passed:at.passed,earned:at.earned,total:at.total,enrollmentId:at.enrollmentId,courseTitle:v.title,passPercent:lesson?.passPercent??v.passPercent,
  lesson:lesson?{id:lesson.id,title:lesson.title,graded:lesson.graded}:null,
  review:at.status==='Graded'?at.review:{},
  questions:questions.map(q=>({id:q.id,kind:q.kind,prompt:q.prompt,choices:q.choices,points:q.points,...(reveal&&q.kind!=='Text'?{correct:q.correct}:{})}))});
}

/** Attempts with written answers waiting: the whole workspace for an admin, their own courses for an instructor. */
export async function reviewQueue(a:Actor):Promise<ReviewRow[]>{
 const list=await db.quizAttempt.findMany({where:{tenantId:a.tenantId,status:'Review',...(a.role==='Instructor'?{enrollment:{courseVersion:{course:{instructorIds:{has:a.userId}}}}}:{})},include:{enrollment:{include:{membership:{include:{user:{select:{name:true,email:true}}}},courseVersion:{include:{questions:{where:{kind:'Text'},select:{lessonId:true}}}}}}},orderBy:{submittedAt:'asc'},take:500});
 const lessons=new Map((await db.lesson.findMany({where:{id:{in:list.map(x=>x.lessonId).filter((x):x is string=>!!x)}},select:{id:true,title:true}})).map(l=>[l.id,l.title]));
 return plain(list.map(x=>({id:x.id,learner:x.enrollment.membership.user.name,email:x.enrollment.membership.user.email,courseTitle:x.enrollment.courseVersion.title,quizTitle:x.lessonId?lessons.get(x.lessonId)??'':'',submittedAt:x.submittedAt,written:x.enrollment.courseVersion.questions.filter(q=>(q.lessonId??null)===(x.lessonId??null)).length})));
}

export async function reviewDetail(a:Actor,attemptId:string):Promise<ReviewDetail>{
 const x=await db.quizAttempt.findFirst({where:{id:attemptId,tenantId:a.tenantId,...(a.role==='Instructor'?{enrollment:{courseVersion:{course:{instructorIds:{has:a.userId}}}}}:{})},include:{enrollment:{include:{membership:{include:{user:{select:{name:true,email:true}}}},courseVersion:{include:{questions:{orderBy:{position:'asc'}}}}}}}});
 if(!x||x.status!=='Review')throw new DomainError('notFound',404);
 const v=x.enrollment.courseVersion;
 const lesson=x.lessonId?await db.lesson.findFirst({where:{id:x.lessonId},select:{title:true,passPercent:true}}):null;
 const answers=x.answers as Record<string,string|string[]>;
 return plain({id:x.id,learner:x.enrollment.membership.user.name,email:x.enrollment.membership.user.email,courseTitle:v.title,quizTitle:lesson?.title??'',submittedAt:x.submittedAt,passPercent:lesson?.passPercent??v.passPercent,earned:x.earned,total:x.total,
  questions:v.questions.filter(q=>(q.lessonId??null)===(x.lessonId??null)).map(q=>({id:q.id,kind:q.kind,prompt:q.prompt,choices:q.choices,correct:q.correct,guide:q.guide,points:q.points,answer:answers[q.id]??null}))});
}

export async function certificates(a:Actor,own:boolean){
 const list=await db.certificate.findMany({where:{tenantId:a.tenantId,...(own?{enrollment:{membershipId:a.membershipId}}:a.role==='Instructor'?{enrollment:{courseVersion:{course:{instructorIds:{has:a.userId}}}}}:{})},include:{enrollment:{include:{membership:{include:{user:{select:{email:true}}}}}}},orderBy:{issuedAt:'desc'},take:1000});
 return plain<CertificateRow[]>(list.map(c=>({id:c.id,serial:c.serial,verifyToken:c.verifyToken,learnerName:c.learnerName,courseTitle:c.courseTitle,tenantName:c.tenantName,score:c.score,issuedAt:c.issuedAt,status:c.status,revokedAt:c.revokedAt,revokeReason:c.revokeReason,enrollmentId:c.enrollmentId,...(own?{}:{email:c.enrollment.membership.user.email})})));
}

export async function reports(a:Actor){
 const [list,courses,groups,exports]=await Promise.all([
  db.enrollment.findMany({where:{...enrollmentScope(a),status:{not:'Cancelled'}},include:enrollmentInclude,orderBy:{createdAt:'desc'},take:5000}),
  db.course.findMany({where:courseScope(a),select:{id:true,title:true,versions:{select:{id:true,number:true},orderBy:{number:'asc'}}},orderBy:{title:'asc'}}),
  db.group.findMany({where:{tenantId:a.tenantId},include:{members:{select:{membershipId:true}}},orderBy:{name:'asc'}}),
  db.exportJob.findMany({where:{tenantId:a.tenantId,userId:a.userId},orderBy:{createdAt:'desc'},take:15,select:{id:true,type:true,status:true,rows:true,expiresAt:true,createdAt:true,downloadedAt:true}}),
 ]);
 return plain<{enrollments:EnrollmentRow[];courses:{id:string;title:string;versions:{id:string;number:number}[]}[];groups:{id:string;name:string;memberIds:string[]}[];exports:ExportRow[]}>({enrollments:list.map(enrollmentRow),courses,groups:a.role==='Admin'?groups.map(g=>({id:g.id,name:g.name,memberIds:g.members.map(m=>m.membershipId)})):[],exports});
}

export async function auditLog(a:Actor,page=0,size=50){
 const [rows,total]=await Promise.all([db.audit.findMany({where:{tenantId:a.tenantId},orderBy:{createdAt:'desc'},skip:page*size,take:size}),db.audit.count({where:{tenantId:a.tenantId}})]);
 const names=new Map((await db.user.findMany({where:{id:{in:[...new Set(rows.map(r=>r.actorId))]}},select:{id:true,name:true}})).map(u=>[u.id,u.name]));
 return plain<{rows:AuditRow[];total:number;page:number;size:number}>({rows:rows.map(r=>({...r,actorName:names.get(r.actorId)??(r.actorId==='system'?'النظام':r.actorId==='provider'?'مزود الدفع':'')})),total,page,size});
}

export async function settings(a:Actor){
 const [tenant,support,failedMail,billing]=await Promise.all([
  db.tenant.findUniqueOrThrow({where:{id:a.tenantId},select:{nameAr:true,nameEn:true,brandColor:true,timezone:true,kind:true,logoMime:true,slug:true}}),
  db.membership.findMany({where:{tenantId:a.tenantId,supportGrant:true},include:{user:{select:{email:true,name:true}}},orderBy:{createdAt:'desc'}}),
  db.outbox.findMany({where:{tenantId:a.tenantId,status:'Failed'},orderBy:{createdAt:'desc'},take:30,select:{id:true,recipient:true,subject:true,attempts:true,failure:true,createdAt:true}}),
  billingStateFor(a.tenantId),
 ]);
 return plain<{tenant:{nameAr:string;nameEn:string;brandColor:string;timezone:string;kind:string;hasLogo:boolean;slug:string};support:{id:string;email:string;name:string;active:boolean;expiresAt:string|null}[];failedMail:{id:string;recipient:string;subject:string;attempts:number;failure:string|null;createdAt:string}[];features:string[]}>({
  tenant:{...tenant,hasLogo:!!tenant.logoMime,logoMime:undefined},
  support:support.map(s=>({id:s.id,email:s.user.email,name:s.user.name,active:s.active,expiresAt:s.expiresAt})),
  failedMail,features:billing?.limits.features??['reports','exports','import','branding','support'],
 });
}

export async function assetLibrary(a:Actor){
 return plain<{id:string;name:string;mime:string;size:number;status:string;createdAt:string}[]>(await db.asset.findMany({where:{tenantId:a.tenantId,status:{not:'Rejected'}},orderBy:{createdAt:'desc'},take:200,select:{id:true,name:true,mime:true,size:true,status:true,createdAt:true}}));
}
