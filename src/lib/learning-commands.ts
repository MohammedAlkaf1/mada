import {z} from 'zod';
import {db} from './db';
import {ownEnrollment,requireRole,type Actor} from './access';
import {DomainError,attemptDeadline,gradeAttempt,mergeIntervals,plausibleSpan,videoComplete,watchedSeconds,type Interval} from './domain';
import {auditor,notify,settle,type Tx} from './command-kit';

const id=z.string().uuid();
/** Seconds of slack for the network between the timer hitting zero and the request landing. */
const SUBMIT_GRACE_MS=5000;

function assertLearnable(e:{status:string;startsAt:Date}){
 if(['Withdrawn','Cancelled'].includes(e.status))throw new DomainError('forbidden',403);
 if(e.startsAt>new Date())throw new DomainError('notStarted',409);
}

async function lessonOf(a:Actor,enrollmentId:string,lessonId:string){
 const e=await ownEnrollment(a,enrollmentId);assertLearnable(e);
 const lesson=await db.lesson.findFirst({where:{id:lessonId,versionId:e.versionId,tenantId:a.tenantId}});
 if(!lesson)throw new DomainError('notFound',404);
 return {e,lesson};
}

/**
 * Makes sure the progress row exists. Prisma's upsert reads then inserts, so
 * two requests for the same lesson at once (a double click, a second tab)
 * could both insert; ON CONFLICT DO NOTHING makes the insert itself atomic.
 */
async function ensureProgress(tx:Tx,tenantId:string,enrollmentId:string,lessonId:string){
 await tx.lessonProgress.createMany({data:[{tenantId,enrollmentId,lessonId}],skipDuplicates:true});
 return tx.lessonProgress.findUniqueOrThrow({where:{enrollmentId_lessonId:{enrollmentId,lessonId}}});
}

type QuizRules={scope:string;lesson:{id:string;title:string;graded:boolean}|null;passPercent:number;maxAttempts:number;timeLimitMinutes:number|null};

/** The rules of one quiz: a quiz lesson carries its own, the final exam uses the version's. */
function rulesFor(v:{passPercent:number;maxAttempts:number;timeLimitMinutes:number|null},lesson:{id:string;title:string;graded:boolean;passPercent:number;maxAttempts:number;timeLimitMinutes:number|null}|null):QuizRules{
 return lesson?{scope:lesson.id,lesson:{id:lesson.id,title:lesson.title,graded:lesson.graded},passPercent:lesson.passPercent,maxAttempts:lesson.maxAttempts,timeLimitMinutes:lesson.timeLimitMinutes}:{scope:'final',lesson:null,passPercent:v.passPercent,maxAttempts:v.maxAttempts,timeLimitMinutes:v.timeLimitMinutes};
}

const toGradable=(q:any)=>({id:q.id,kind:q.kind,points:q.points,correct:q.correct,choices:q.choices});

async function loadAttempt(tx:Tx,tenantId:string,attemptId:string){
 const at=await tx.quizAttempt.findFirst({where:{id:attemptId,tenantId},include:{enrollment:{include:{courseVersion:{include:{questions:true,course:{select:{instructorIds:true}}}},membership:{select:{userId:true}}}}}});
 if(!at)throw new DomainError('notFound',404);
 const lesson=at.lessonId?await tx.lesson.findFirst({where:{id:at.lessonId,tenantId}}):null;
 const v=at.enrollment.courseVersion;
 const questions=v.questions.filter((q:any)=>(q.lessonId??null)===(at.lessonId??null));
 return {at,v,lesson,questions,rules:rulesFor(v,lesson)};
}

/**
 * What a result means for the course. A graded quiz lesson completes once
 * passed; a practice quiz completes on submission, even while a written answer
 * waits, because it never blocks the learner. The final exam feeds settle().
 */
async function applyResult(tx:Tx,tenantId:string,enrollmentId:string,rules:QuizRules,passed:boolean|null){
 if(rules.lesson&&(rules.lesson.graded?passed===true:true)){
  await ensureProgress(tx,tenantId,enrollmentId,rules.lesson.id);
  await tx.lessonProgress.updateMany({where:{enrollmentId,lessonId:rules.lesson.id,completedAt:null},data:{completedAt:new Date()}});
 }
 await settle(tx,tenantId,enrollmentId);
}

/** Grades an attempt once. A second call finds it submitted and changes nothing (FR-12). */
export async function finalizeAttempt(tx:Tx,tenantId:string,attemptId:string){
 const {at,v,questions,rules}=await loadAttempt(tx,tenantId,attemptId);
 if(at.submittedAt)return at;
 const g=gradeAttempt(questions.map(toGradable),at.answers as Record<string,unknown>,rules.passPercent);
 // A written answer leaves the verdict open: the automatic part is kept, the score waits for the reviewer.
 const claimed=await tx.quizAttempt.updateMany({where:{id:at.id,submittedAt:null},data:{submittedAt:new Date(),status:g.pending?'Review':'Graded',earned:g.earned,total:g.total,score:g.pending?null:g.score,passed:g.passed}});
 if(!claimed.count)return tx.quizAttempt.findUnique({where:{id:at.id}});
 await tx.audit.create({data:{tenantId,actorId:at.enrollment.membership.userId,action:'quiz.submit',entityId:at.id,detail:{scope:rules.scope,number:at.number,score:g.pending?null:g.score,passed:g.passed,pending:g.pending}}});
 await applyResult(tx,tenantId,at.enrollmentId,rules,g.passed);
 if(g.pending){
  // Everyone who can grade it hears once: the organization's admins and the course's instructors.
  const staff=await tx.membership.findMany({where:{tenantId,active:true,supportGrant:false,OR:[{role:'Admin'},{role:'Instructor',userId:{in:v.course.instructorIds}}]},select:{userId:true}});
  for(const m of staff)await notify(tx,tenantId,m.userId,{ar:`إجابة مكتوبة تنتظر التصحيح في ${rules.lesson?.title??v.title}`,en:`A written answer awaits grading in ${rules.lesson?.title??v.title}`,href:`/review/${at.id}`},`review:${at.id}:${m.userId}`,false);
 }
 return tx.quizAttempt.findUnique({where:{id:at.id}});
}

/** Attempts whose timer ran out are graded from what was saved; unanswered questions score zero. */
export async function closeExpiredAttempts(tenantId?:string){
 const due=await db.quizAttempt.findMany({where:{submittedAt:null,deadlineAt:{lt:new Date(Date.now()-SUBMIT_GRACE_MS)},...(tenantId?{tenantId}:{})},select:{id:true,tenantId:true},take:500});
 for(const x of due)await db.$transaction(tx=>finalizeAttempt(tx,x.tenantId,x.id));
 return due.length;
}

export async function learningCommand(a:Actor,action:string,data:Record<string,unknown>){
 const log=auditor(a,action);
 switch(action){
 case 'lesson.open':{
  const x=z.object({enrollmentId:id,lessonId:id}).parse(data);const {e,lesson}=await lessonOf(a,x.enrollmentId,x.lessonId);
  return db.$transaction(async tx=>{
   await ensureProgress(tx,a.tenantId,e.id,lesson.id);
   if(!e.startedAt)await tx.enrollment.updateMany({where:{id:e.id,startedAt:null},data:{startedAt:new Date(),...(e.status==='NotStarted'?{status:'InProgress'}:{})}});
   return {ok:true};
  });
 }
 case 'lesson.complete':{
  // Text, PDF and links complete on the learner's confirmation. A video completes only by being watched.
  const x=z.object({enrollmentId:id,lessonId:id}).parse(data);const {e,lesson}=await lessonOf(a,x.enrollmentId,x.lessonId);
  if(lesson.kind==='Video')throw new DomainError('watchRequired',409);
  return db.$transaction(async tx=>{
   await ensureProgress(tx,a.tenantId,e.id,lesson.id);
   // The first confirmation is the completion date; confirming again keeps it.
   await tx.lessonProgress.updateMany({where:{enrollmentId:e.id,lessonId:lesson.id,completedAt:null},data:{completedAt:new Date()}});
   const r=await settle(tx,a.tenantId,e.id);return {status:r?.status};
  });
 }
 case 'video.progress':{
  const x=z.object({enrollmentId:id,lessonId:id,from:z.number().min(0),to:z.number().min(0),position:z.number().min(0),elapsed:z.number().min(0).max(3600)}).parse(data);
  const {e,lesson}=await lessonOf(a,x.enrollmentId,x.lessonId);
  if(lesson.kind!=='Video')throw new DomainError('invalid');
  const span:Interval=[x.from,x.to];
  return db.$transaction(async tx=>{
   await tx.$queryRaw`SELECT id FROM "Enrollment" WHERE id=${e.id} FOR UPDATE`;
   const p=await ensureProgress(tx,a.tenantId,e.id,lesson.id);
   // A span longer than the time that passed is a seek, not viewing, and is ignored.
   const watched=plausibleSpan(span,x.elapsed)?mergeIntervals([...(p.watched as Interval[]),span]):(p.watched as Interval[]);
   const duration=lesson.durationSeconds;
   const done=!p.completedAt&&videoComplete(watched,duration);
   await tx.lessonProgress.update({where:{id:p.id},data:{watched,watchedSeconds:watchedSeconds(watched,duration||undefined),position:Math.min(x.position,duration||x.position),...(done?{completedAt:new Date()}:{})}});
   if(!e.startedAt)await tx.enrollment.updateMany({where:{id:e.id,startedAt:null,status:'NotStarted'},data:{startedAt:new Date(),status:'InProgress'}});
   if(done)await settle(tx,a.tenantId,e.id);
   return {watchedSeconds:watchedSeconds(watched,duration||undefined),completed:!!p.completedAt||done};
  });
 }
 case 'quiz.start':{
  const x=z.object({enrollmentId:id,lessonId:id.nullable().default(null)}).parse(data);const e=await ownEnrollment(a,x.enrollmentId);assertLearnable(e);
  const v=e.courseVersion;
  const lesson=x.lessonId?await db.lesson.findFirst({where:{id:x.lessonId,versionId:v.id,tenantId:a.tenantId,kind:'Quiz'}}):null;
  if(x.lessonId&&!lesson)throw new DomainError('notFound',404);
  const rules=rulesFor(v,lesson);
  if(!lesson){
   if(!v.quizEnabled)throw new DomainError('invalid');
   if(e.status==='Completed')throw new DomainError('alreadyComplete',409);
   if(e.requiredDone<e.requiredTotal)throw new DomainError('lessonsFirst',409);
  }
  await closeExpiredAttempts(a.tenantId);
  return db.$transaction(async tx=>{
   await tx.$queryRaw`SELECT id FROM "Enrollment" WHERE id=${e.id} FOR UPDATE`;
   const open=await tx.quizAttempt.findFirst({where:{enrollmentId:e.id,scope:rules.scope,submittedAt:null}});
   if(open)return {id:open.id,resumed:true};
   // A graded quiz is not retaken once passed, nor while an earlier attempt is still with the reviewer.
   if(await tx.quizAttempt.count({where:{enrollmentId:e.id,scope:rules.scope,status:'Review'}}))throw new DomainError('pendingReview',409);
   if(lesson?.graded&&await tx.quizAttempt.count({where:{enrollmentId:e.id,scope:rules.scope,passed:true}}))throw new DomainError('alreadyComplete',409);
   const used=await tx.quizAttempt.count({where:{enrollmentId:e.id,scope:rules.scope}});
   if(used>=rules.maxAttempts)throw new DomainError('noAttempts',409);
   const now=new Date();
   const at=await tx.quizAttempt.create({data:{tenantId:a.tenantId,enrollmentId:e.id,scope:rules.scope,lessonId:lesson?.id??null,number:used+1,startedAt:now,deadlineAt:attemptDeadline(now,rules.timeLimitMinutes)}});
   if(!e.startedAt)await tx.enrollment.updateMany({where:{id:e.id,startedAt:null},data:{startedAt:now,...(e.status==='NotStarted'?{status:'InProgress'}:{})}});
   await log(tx,at.id,{scope:rules.scope,number:at.number});return {id:at.id,resumed:false};
  });
 }
 case 'quiz.save':{
  const x=z.object({attemptId:id,answers:z.record(z.string().uuid(),z.union([z.string().max(5000),z.array(z.string().max(40)).max(8)])).refine(o=>Object.keys(o).length<=300)}).parse(data);
  const at=await db.quizAttempt.findFirst({where:{id:x.attemptId,tenantId:a.tenantId,enrollment:{membershipId:a.membershipId}},include:{enrollment:{include:{courseVersion:{include:{questions:{select:{id:true,kind:true,choices:true,lessonId:true}}}}}}}});
  if(!at)throw new DomainError('notFound',404);if(at.submittedAt)throw new DomainError('submitted',409);
  // Past the deadline the saved answers are final and nothing new is accepted (FR-12).
  if(at.deadlineAt&&at.deadlineAt.getTime()+SUBMIT_GRACE_MS<Date.now()){await db.$transaction(tx=>finalizeAttempt(tx,a.tenantId,at.id));throw new DomainError('timeUp',409);}
  // Each answer must fit its question: a known choice, a set of known choices, or text.
  const questions=new Map(at.enrollment.courseVersion.questions.filter(q=>(q.lessonId??null)===(at.lessonId??null)).map(q=>[q.id,q]));
  for(const [qid,answer] of Object.entries(x.answers)){
   const q=questions.get(qid);if(!q)throw new DomainError('invalid');
   const ids=new Set((q.choices as {id:string}[]).map(c=>c.id));
   const ok=q.kind==='Text'?typeof answer==='string':q.kind==='Multiple'?Array.isArray(answer)&&answer.every(c=>ids.has(c)):typeof answer==='string'&&answer.length<=40&&ids.has(answer);
   if(!ok)throw new DomainError('invalid');
  }
  await db.quizAttempt.update({where:{id:at.id},data:{answers:{...(at.answers as object),...x.answers}}});
  return {savedAt:new Date().toISOString()};
 }
 case 'quiz.submit':{
  const x=z.object({attemptId:id}).parse(data);
  const at=await db.quizAttempt.findFirst({where:{id:x.attemptId,tenantId:a.tenantId,enrollment:{membershipId:a.membershipId}}});
  if(!at)throw new DomainError('notFound',404);
  const r=await db.$transaction(tx=>finalizeAttempt(tx,a.tenantId,at.id));
  return {score:r?.score??null,passed:r?.passed??null,status:r?.status};
 }
 case 'attempt.review':{
  // The instructor grades the written answers; the automatic ones are never touched.
  requireRole(a,['Admin','Instructor']);
  const x=z.object({attemptId:id,points:z.record(z.string().uuid(),z.coerce.number().min(0).max(100)),comment:z.string().trim().max(2000).default('')}).parse(data);
  return db.$transaction(async tx=>{
   const {at,v,questions,rules}=await loadAttempt(tx,a.tenantId,x.attemptId);
   if(a.role==='Instructor'&&!v.course.instructorIds.includes(a.userId))throw new DomainError('notFound',404);
   if(at.status!=='Review')throw new DomainError('conflict',409);
   const written=questions.filter((q:any)=>q.kind==='Text');
   if(written.some((q:any)=>!(q.id in x.points))||Object.keys(x.points).some(k=>!written.some((q:any)=>q.id===k)))throw new DomainError('required');
   const points=Object.fromEntries(written.map((q:any)=>[q.id,Math.min(q.points,Math.max(0,Math.round(x.points[q.id]*10)/10))]));
   const g=gradeAttempt(questions.map(toGradable),at.answers as Record<string,unknown>,rules.passPercent,points);
   const claimed=await tx.quizAttempt.updateMany({where:{id:at.id,status:'Review'},data:{status:'Graded',earned:g.earned,total:g.total,score:g.score,passed:g.passed,review:{points,comment:x.comment},reviewedBy:a.userId,reviewedAt:new Date()}});
   if(!claimed.count)throw new DomainError('conflict',409);
   await applyResult(tx,a.tenantId,at.enrollmentId,rules,g.passed);
   const title=rules.lesson?.title??v.title;
   await notify(tx,a.tenantId,at.enrollment.membership.userId,{ar:`صُحح اختبار ${title}`,en:`${title} has been graded`,href:`/learn/${at.enrollmentId}/quiz/${at.id}`},`reviewed:${at.id}`);
   await log(tx,at.id,{score:g.score,passed:g.passed});
   return {score:g.score,passed:g.passed};
  });
 }
 case 'certificate.revoke':{
  requireRole(a,['Admin']);const x=z.object({id,reason:z.string().trim().min(3).max(500)}).parse(data);
  const c=await db.certificate.findFirst({where:{id:x.id,tenantId:a.tenantId}});if(!c||c.status!=='Valid')throw new DomainError('conflict',409);
  return db.$transaction(async tx=>{await tx.certificate.update({where:{id:c.id},data:{status:'Revoked',revokedAt:new Date(),revokedBy:a.userId,revokeReason:x.reason}});await log(tx,c.id,{serial:c.serial,reason:x.reason});return {ok:true};});
 }
 default:return undefined;
 }
}
