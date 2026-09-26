import {z} from 'zod';
import {db} from './db';
import {manageableCourse,manageableVersion,requireRole,type Actor} from './access';
import {DomainError,lessonKinds,publishBlockers,trueFalseChoices,versionLocked} from './domain';
import {assertWithinPlan} from './billing';
import {auditor,notify,type Tx} from './command-kit';

const id=z.string().uuid();
const title=z.string().trim().min(1).max(200);
const longText=z.string().max(100000);
const choice=z.object({id:z.string().trim().min(1).max(40),text:z.string().trim().min(1).max(500)});

/** Loads a version for editing and refuses content changes once anyone is enrolled (FR-08). */
async function editableVersion(a:Actor,versionId:string){
 const v=await manageableVersion(a,versionId);
 if(v.status==='Archived')throw new DomainError('conflict',409);
 const enrolled=await db.enrollment.count({where:{tenantId:a.tenantId,versionId:v.id}});
 if(versionLocked(enrolled))throw new DomainError('versionLocked',409);
 return v;
}

async function copyVersion(tx:Tx,a:Actor,fromId:string,number:number){
 const src=await tx.courseVersion.findUniqueOrThrow({where:{id:fromId},include:{modules:{orderBy:{position:'asc'},include:{lessons:{orderBy:{position:'asc'}}}},questions:{orderBy:{position:'asc'}}}});
 const v=await tx.courseVersion.create({data:{tenantId:a.tenantId,courseId:src.courseId,number,status:'Draft',title:src.title,description:src.description,coverAssetId:src.coverAssetId,estimatedMinutes:src.estimatedMinutes,quizEnabled:src.quizEnabled,passPercent:src.passPercent,maxAttempts:src.maxAttempts,timeLimitMinutes:src.timeLimitMinutes}});
 for(const m of src.modules){
  const nm=await tx.module.create({data:{tenantId:a.tenantId,versionId:v.id,title:m.title,position:m.position}});
  for(const l of m.lessons)await tx.lesson.create({data:{tenantId:a.tenantId,versionId:v.id,moduleId:nm.id,title:l.title,kind:l.kind,body:l.body,url:l.url,assetId:l.assetId,durationSeconds:l.durationSeconds,required:l.required,position:l.position}});
 }
 for(const q of src.questions)await tx.question.create({data:{tenantId:a.tenantId,versionId:v.id,kind:q.kind,prompt:q.prompt,choices:q.choices,correct:q.correct,points:q.points,position:q.position}});
 return v;
}

async function assertAssets(a:Actor,ids:(string|null|undefined)[]){
 const list=[...new Set(ids.filter((x):x is string=>!!x))];
 if(list.length&&await db.asset.count({where:{id:{in:list},tenantId:a.tenantId,status:{not:'Rejected'}}})!==list.length)throw new DomainError('notFound',404);
}

export async function courseCommand(a:Actor,action:string,data:Record<string,unknown>){
 const log=auditor(a,action);
 switch(action){
 case 'course.create':{
  requireRole(a,['Admin','Instructor']);await assertWithinPlan(a.tenantId,'courses');
  const x=z.object({title,category:z.string().trim().max(80).default(''),description:z.string().trim().max(4000).default('')}).parse(data);
  return db.$transaction(async tx=>{
   const c=await tx.course.create({data:{tenantId:a.tenantId,title:x.title,category:x.category,createdBy:a.userId,instructorIds:a.role==='Instructor'?[a.userId]:[]}});
   const v=await tx.courseVersion.create({data:{tenantId:a.tenantId,courseId:c.id,number:1,title:x.title,description:x.description}});
   await tx.module.create({data:{tenantId:a.tenantId,versionId:v.id,title:'الوحدة الأولى',position:0}});
   await log(tx,c.id,{title:x.title});
   return {id:c.id,versionId:v.id};
  });
 }
 case 'course.update':{
  const x=z.object({id,title,category:z.string().trim().max(80).default(''),instructorIds:z.array(id).max(20).optional()}).parse(data);
  const c=await manageableCourse(a,x.id);
  if(x.instructorIds){
   requireRole(a,['Admin']);
   if(x.instructorIds.length&&await db.membership.count({where:{tenantId:a.tenantId,userId:{in:x.instructorIds},active:true,role:{in:['Instructor','Admin']}}})!==x.instructorIds.length)throw new DomainError('invalid');
  }
  return db.$transaction(async tx=>{await tx.course.update({where:{id:c.id},data:{title:x.title,category:x.category,...(x.instructorIds?{instructorIds:x.instructorIds}:{})}});await log(tx,c.id,{title:x.title,instructors:x.instructorIds?.length});return {ok:true};});
 }
 case 'course.archive':case 'course.restore':{
  requireRole(a,['Admin']);const x=z.object({id}).parse(data);const c=await manageableCourse(a,x.id);
  if(action==='course.restore')await assertWithinPlan(a.tenantId,'courses');
  // Archiving hides the course from new assignments; learner records stay untouched (FR-19).
  return db.$transaction(async tx=>{await tx.course.update({where:{id:c.id},data:{archivedAt:action==='course.archive'?new Date():null}});await log(tx,c.id);return {ok:true};});
 }
 case 'version.update':{
  const x=z.object({id,title,description:z.string().trim().max(4000).default(''),coverAssetId:id.nullable().optional(),estimatedMinutes:z.coerce.number().int().min(0).max(100000).default(0),quizEnabled:z.boolean().optional(),passPercent:z.coerce.number().int().min(1).max(100).optional(),maxAttempts:z.coerce.number().int().min(1).max(20).optional(),timeLimitMinutes:z.coerce.number().int().min(1).max(600).nullable().optional(),version:z.number().int()}).parse(data);
  const v=await manageableVersion(a,x.id);if(v.status==='Archived')throw new DomainError('conflict',409);
  const enrolled=await db.enrollment.count({where:{tenantId:a.tenantId,versionId:v.id}});
  const rulesChange=(x.quizEnabled!==undefined&&x.quizEnabled!==v.quizEnabled)||(x.passPercent!==undefined&&x.passPercent!==v.passPercent)||(x.maxAttempts!==undefined&&x.maxAttempts!==v.maxAttempts)||(x.timeLimitMinutes!==undefined&&x.timeLimitMinutes!==v.timeLimitMinutes);
  // Once people are enrolled only the wording may be corrected; rules need a new version.
  if(versionLocked(enrolled)&&rulesChange)throw new DomainError('versionLocked',409);
  await assertAssets(a,[x.coverAssetId]);
  return db.$transaction(async tx=>{
   const r=await tx.courseVersion.updateMany({where:{id:v.id,version:x.version},data:{title:x.title,description:x.description,estimatedMinutes:x.estimatedMinutes,...(x.coverAssetId!==undefined?{coverAssetId:x.coverAssetId}:{}),...(x.quizEnabled!==undefined?{quizEnabled:x.quizEnabled}:{}),...(x.passPercent!==undefined?{passPercent:x.passPercent}:{}),...(x.maxAttempts!==undefined?{maxAttempts:x.maxAttempts}:{}),...(x.timeLimitMinutes!==undefined?{timeLimitMinutes:x.timeLimitMinutes}:{}),version:{increment:1}}});
   if(!r.count)throw new DomainError('conflict',409);
   if(v.number===(await tx.courseVersion.aggregate({where:{courseId:v.courseId},_max:{number:true}}))._max.number)await tx.course.update({where:{id:v.courseId},data:{title:x.title}});
   await log(tx,v.id,{locked:versionLocked(enrolled)});return {ok:true};
  });
 }
 case 'module.save':{
  const x=z.object({versionId:id,id:id.optional(),title}).parse(data);const v=await editableVersion(a,x.versionId);
  return db.$transaction(async tx=>{
   if(x.id){const r=await tx.module.updateMany({where:{id:x.id,versionId:v.id,tenantId:a.tenantId},data:{title:x.title}});if(!r.count)throw new DomainError('notFound',404);await log(tx,x.id);return {id:x.id};}
   const position=await tx.module.count({where:{versionId:v.id}});const m=await tx.module.create({data:{tenantId:a.tenantId,versionId:v.id,title:x.title,position}});await log(tx,m.id);return {id:m.id};
  });
 }
 case 'module.delete':{
  const x=z.object({versionId:id,id}).parse(data);const v=await editableVersion(a,x.versionId);
  return db.$transaction(async tx=>{const m=await tx.module.findFirst({where:{id:x.id,versionId:v.id,tenantId:a.tenantId}});if(!m)throw new DomainError('notFound',404);await tx.lesson.deleteMany({where:{moduleId:m.id,tenantId:a.tenantId}});await tx.module.delete({where:{id:m.id}});await log(tx,m.id);return {ok:true};});
 }
 case 'lesson.save':{
  const x=z.object({versionId:id,moduleId:id,id:id.optional(),title,kind:z.enum(lessonKinds),body:longText.default(''),url:z.string().trim().max(2000).nullable().optional(),assetId:id.nullable().optional(),durationSeconds:z.coerce.number().int().min(0).max(86400).default(0),required:z.boolean().default(true)}).parse(data);
  const v=await editableVersion(a,x.versionId);
  if(x.kind==='Link'&&x.url&&!/^https:\/\/[^\s]+$/.test(x.url))throw new DomainError('linkInvalid',422);
  if(!await db.module.findFirst({where:{id:x.moduleId,versionId:v.id,tenantId:a.tenantId}}))throw new DomainError('notFound',404);
  if(['Pdf','Video'].includes(x.kind)&&x.assetId){const asset=await db.asset.findFirst({where:{id:x.assetId,tenantId:a.tenantId}});if(!asset||asset.status==='Rejected'||(x.kind==='Pdf'&&asset.mime!=='application/pdf')||(x.kind==='Video'&&asset.mime!=='video/mp4'))throw new DomainError('fileType',422);}
  const values={title:x.title,kind:x.kind,body:x.kind==='Text'?x.body:x.body.slice(0,4000),url:x.kind==='Link'?x.url??null:null,assetId:['Pdf','Video'].includes(x.kind)?x.assetId??null:null,durationSeconds:x.kind==='Video'?x.durationSeconds:0,required:x.required,moduleId:x.moduleId};
  return db.$transaction(async tx=>{
   if(x.id){const r=await tx.lesson.updateMany({where:{id:x.id,versionId:v.id,tenantId:a.tenantId},data:values});if(!r.count)throw new DomainError('notFound',404);await log(tx,x.id,{kind:x.kind});return {id:x.id};}
   const position=await tx.lesson.count({where:{moduleId:x.moduleId}});const l=await tx.lesson.create({data:{...values,tenantId:a.tenantId,versionId:v.id,position}});await log(tx,l.id,{kind:x.kind});return {id:l.id};
  });
 }
 case 'lesson.delete':{
  const x=z.object({versionId:id,id}).parse(data);const v=await editableVersion(a,x.versionId);
  return db.$transaction(async tx=>{const r=await tx.lesson.deleteMany({where:{id:x.id,versionId:v.id,tenantId:a.tenantId}});if(!r.count)throw new DomainError('notFound',404);await log(tx,x.id);return {ok:true};});
 }
 case 'outline.reorder':{
  // The whole outline in one call: module order, and which lessons sit in which module in which order.
  const x=z.object({versionId:id,modules:z.array(z.object({id,lessonIds:z.array(id).max(300)})).max(100)}).parse(data);
  const v=await editableVersion(a,x.versionId);
  const [mods,lessons]=await Promise.all([db.module.findMany({where:{versionId:v.id,tenantId:a.tenantId},select:{id:true}}),db.lesson.findMany({where:{versionId:v.id,tenantId:a.tenantId},select:{id:true}})]);
  const mSet=new Set(mods.map(m=>m.id)),lSet=new Set(lessons.map(l=>l.id));const given=x.modules.flatMap(m=>m.lessonIds);
  if(x.modules.length!==mSet.size||x.modules.some(m=>!mSet.has(m.id))||given.length!==lSet.size||new Set(given).size!==given.length||given.some(g=>!lSet.has(g)))throw new DomainError('invalid');
  return db.$transaction(async tx=>{
   for(const [mi,m] of x.modules.entries()){await tx.module.update({where:{id:m.id},data:{position:mi}});for(const [li,lid] of m.lessonIds.entries())await tx.lesson.update({where:{id:lid},data:{position:li,moduleId:m.id}});}
   await log(tx,v.id);return {ok:true};
  });
 }
 case 'question.save':{
  const x=z.object({versionId:id,id:id.optional(),kind:z.enum(['Single','TrueFalse']),prompt:z.string().trim().min(1).max(2000),choices:z.array(choice).max(8).default([]),correct:z.string().trim().min(1).max(40),points:z.coerce.number().int().min(1).max(100).default(1)}).parse(data);
  const v=await editableVersion(a,x.versionId);
  const choices=x.kind==='TrueFalse'?trueFalseChoices():x.choices;
  if(choices.length<2||new Set(choices.map(c=>c.id)).size!==choices.length||!choices.some(c=>c.id===x.correct))throw new DomainError('quizInvalid',422);
  return db.$transaction(async tx=>{
   const values={kind:x.kind,prompt:x.prompt,choices,correct:x.correct,points:x.points};
   if(x.id){const r=await tx.question.updateMany({where:{id:x.id,versionId:v.id,tenantId:a.tenantId},data:values});if(!r.count)throw new DomainError('notFound',404);await log(tx,x.id);return {id:x.id};}
   const position=await tx.question.count({where:{versionId:v.id}});const q=await tx.question.create({data:{...values,tenantId:a.tenantId,versionId:v.id,position}});await log(tx,q.id);return {id:q.id};
  });
 }
 case 'question.delete':{
  const x=z.object({versionId:id,id}).parse(data);const v=await editableVersion(a,x.versionId);
  return db.$transaction(async tx=>{const r=await tx.question.deleteMany({where:{id:x.id,versionId:v.id,tenantId:a.tenantId}});if(!r.count)throw new DomainError('notFound',404);await log(tx,x.id);return {ok:true};});
 }
 case 'question.reorder':{
  const x=z.object({versionId:id,ids:z.array(id).max(300)}).parse(data);const v=await editableVersion(a,x.versionId);
  const existing=await db.question.findMany({where:{versionId:v.id,tenantId:a.tenantId},select:{id:true}});
  if(existing.length!==x.ids.length||existing.some(q=>!x.ids.includes(q.id)))throw new DomainError('invalid');
  return db.$transaction(async tx=>{for(const [i,q] of x.ids.entries())await tx.question.update({where:{id:q},data:{position:i}});await log(tx,v.id);return {ok:true};});
 }
 case 'version.publish':{
  // Publishing is the administrator's call; instructors prepare the content (SRS roles).
  requireRole(a,['Admin']);const x=z.object({id}).parse(data);
  const v=await db.courseVersion.findFirst({where:{id:x.id,tenantId:a.tenantId},include:{lessons:true,questions:true,course:true}});
  if(!v||v.status!=='Draft'||v.course.archivedAt)throw new DomainError('conflict',409);
  const assets=await db.asset.findMany({where:{id:{in:v.lessons.map(l=>l.assetId).filter((x):x is string=>!!x)},tenantId:a.tenantId},select:{id:true,status:true}});
  const clean=new Set(assets.filter(x=>x.status==='Clean').map(x=>x.id));
  const blockers=publishBlockers({title:v.title,lessons:v.lessons.map(l=>({...l,assetClean:l.assetId?clean.has(l.assetId):undefined})),quizEnabled:v.quizEnabled,passPercent:v.passPercent,maxAttempts:v.maxAttempts,questions:v.questions.map(q=>({...q,choices:q.choices as {id:string;text:string}[]}))});
  if(blockers.length)throw new DomainError('publishIncomplete',422);
  return db.$transaction(async tx=>{
   // The earlier published version keeps serving its learners but takes no new assignments.
   await tx.courseVersion.updateMany({where:{courseId:v.courseId,status:'Published',id:{not:v.id}},data:{status:'Superseded'}});
   await tx.courseVersion.update({where:{id:v.id},data:{status:'Published',publishedAt:new Date(),version:{increment:1}}});
   await tx.course.update({where:{id:v.courseId},data:{title:v.title}});
   await log(tx,v.id,{number:v.number});return {ok:true};
  });
 }
 case 'version.next':{
  const x=z.object({courseId:id}).parse(data);const c=await manageableCourse(a,x.courseId);
  const versions=await db.courseVersion.findMany({where:{courseId:c.id},orderBy:{number:'desc'}});
  if(versions.some(v=>v.status==='Draft'))throw new DomainError('draftExists',409);
  const base=versions.find(v=>['Published','Superseded'].includes(v.status))??versions[0];
  return db.$transaction(async tx=>{const v=await copyVersion(tx,a,base.id,versions[0].number+1);await log(tx,v.id,{from:base.number});return {id:v.id};});
 }
 case 'version.discard':{
  const x=z.object({id}).parse(data);const v=await editableVersion(a,x.id);
  if(v.status!=='Draft'||v.number===1)throw new DomainError('conflict',409);
  return db.$transaction(async tx=>{await tx.question.deleteMany({where:{versionId:v.id}});await tx.lesson.deleteMany({where:{versionId:v.id}});await tx.module.deleteMany({where:{versionId:v.id}});await tx.courseVersion.delete({where:{id:v.id}});await log(tx,v.id);return {ok:true};});
 }
 case 'enrollment.assign':{
  requireRole(a,['Admin']);
  const x=z.object({versionId:id,membershipIds:z.array(id).max(5000).default([]),groupId:id.optional(),startsAt:z.coerce.date().optional(),dueAt:z.coerce.date().nullable().optional()}).parse(data);
  const v=await db.courseVersion.findFirst({where:{id:x.versionId,tenantId:a.tenantId,status:'Published'},include:{course:true}});
  if(!v||v.course.archivedAt)throw new DomainError('notAssignable',409);
  if(x.dueAt&&x.dueAt<=new Date())throw new DomainError('dueInPast',422);
  if(x.dueAt&&x.startsAt&&x.dueAt<=x.startsAt)throw new DomainError('invalid');
  // A group assignment takes the members it has right now; later joiners need their own assignment (FR-09).
  let targets=x.membershipIds;
  if(x.groupId){const g=await db.group.findFirst({where:{id:x.groupId,tenantId:a.tenantId,archivedAt:null},include:{members:true}});if(!g)throw new DomainError('notFound',404);targets=[...new Set([...targets,...g.members.map(m=>m.membershipId)])];}
  if(!targets.length)throw new DomainError('required');
  const members=await db.membership.findMany({where:{id:{in:targets},tenantId:a.tenantId,active:true},include:{user:{select:{id:true}}}});
  if(members.length!==targets.length&&!x.groupId)throw new DomainError('notFound',404);
  const existing=new Set((await db.enrollment.findMany({where:{versionId:v.id,membershipId:{in:members.map(m=>m.id)}},select:{membershipId:true}})).map(e=>e.membershipId));
  const fresh=members.filter(m=>!existing.has(m.id));
  const lessons=await db.lesson.count({where:{versionId:v.id,required:true}});
  return db.$transaction(async tx=>{
   for(const m of fresh){
    const e=await tx.enrollment.create({data:{tenantId:a.tenantId,membershipId:m.id,courseId:v.courseId,versionId:v.id,groupId:x.groupId,assignedBy:a.userId,startsAt:x.startsAt??new Date(),dueAt:x.dueAt??null,requiredTotal:lessons}});
    await notify(tx,a.tenantId,m.userId,{ar:`أُسندت إليك دورة ${v.title}`,en:`You were assigned ${v.title}`,href:`/learn/${e.id}`},`assigned:${e.id}`);
   }
   await log(tx,v.id,{created:fresh.length,skipped:members.length-fresh.length,groupId:x.groupId??null,dueAt:x.dueAt??null});
   return {created:fresh.length,skipped:members.length-fresh.length};
  });
 }
 case 'enrollment.withdraw':{
  requireRole(a,['Admin']);const x=z.object({id,reason:z.string().trim().min(3).max(500)}).parse(data);
  const e=await db.enrollment.findFirst({where:{id:x.id,tenantId:a.tenantId}});if(!e||['Withdrawn','Cancelled','Completed'].includes(e.status))throw new DomainError('conflict',409);
  // Not started: the assignment is cancelled and disappears. Started: kept as withdrawn with its results (BR-08).
  const to=e.status==='NotStarted'?'Cancelled':'Withdrawn';
  return db.$transaction(async tx=>{await tx.enrollment.update({where:{id:e.id},data:{status:to,withdrawnAt:new Date()}});await log(tx,e.id,{to,reason:x.reason});return {status:to};});
 }
 case 'enrollment.due':{
  requireRole(a,['Admin']);const x=z.object({id,dueAt:z.coerce.date().nullable()}).parse(data);
  const e=await db.enrollment.findFirst({where:{id:x.id,tenantId:a.tenantId}});if(!e||['Withdrawn','Cancelled','Completed'].includes(e.status))throw new DomainError('conflict',409);
  if(x.dueAt&&x.dueAt<=new Date())throw new DomainError('dueInPast',422);
  // A new date earns a fresh reminder and a fresh overdue notice.
  return db.$transaction(async tx=>{await tx.enrollment.update({where:{id:e.id},data:{dueAt:x.dueAt,reminderSentAt:null,overdueSentAt:null}});await log(tx,e.id,{from:e.dueAt,to:x.dueAt});return {ok:true};});
 }
 default:return undefined;
 }
}
