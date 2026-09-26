import {z} from 'zod';
import {db} from './db';
import {ownEnrollment,requireRole,type Actor} from './access';
import {DomainError,attemptDeadline,gradeAttempt,mergeIntervals,plausibleSpan,videoComplete,watchedSeconds,type Interval} from './domain';
import {auditor,settle,type Tx} from './command-kit';

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

/** Grades an attempt once. A second call finds it submitted and changes nothing (FR-12). */
export async function finalizeAttempt(tx:Tx,tenantId:string,attemptId:string){
 const at=await tx.quizAttempt.findFirst({where:{id:attemptId,tenantId},include:{enrollment:{include:{courseVersion:{include:{questions:true}},membership:{select:{userId:true}}}}}});
 if(!at)throw new DomainError('notFound',404);
 if(at.submittedAt)return at;
 const v=at.enrollment.courseVersion;
 const g=gradeAttempt(v.questions.map((q:any)=>({id:q.id,points:q.points,correct:q.correct,choices:q.choices})),at.answers as Record<string,unknown>,v.passPercent);
 const claimed=await tx.quizAttempt.updateMany({where:{id:at.id,submittedAt:null},data:{submittedAt:new Date(),earned:g.earned,total:g.total,score:g.score,passed:g.passed}});
 if(!claimed.count)return tx.quizAttempt.findUnique({where:{id:at.id}});
 await tx.audit.create({data:{tenantId,actorId:at.enrollment.membership.userId,action:'quiz.submit',entityId:at.id,detail:{number:at.number,score:g.score,passed:g.passed}}});
 await settle(tx,tenantId,at.enrollmentId);
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
  const x=z.object({enrollmentId:id}).parse(data);const e=await ownEnrollment(a,x.enrollmentId);assertLearnable(e);
  const v=e.courseVersion;if(!v.quizEnabled)throw new DomainError('invalid');
  if(e.status==='Completed')throw new DomainError('alreadyComplete',409);
  if(e.requiredDone<e.requiredTotal)throw new DomainError('lessonsFirst',409);
  await closeExpiredAttempts(a.tenantId);
  return db.$transaction(async tx=>{
   await tx.$queryRaw`SELECT id FROM "Enrollment" WHERE id=${e.id} FOR UPDATE`;
   const open=await tx.quizAttempt.findFirst({where:{enrollmentId:e.id,submittedAt:null}});
   if(open)return {id:open.id,resumed:true};
   const used=await tx.quizAttempt.count({where:{enrollmentId:e.id}});
   if(used>=v.maxAttempts)throw new DomainError('noAttempts',409);
   const now=new Date();
   const at=await tx.quizAttempt.create({data:{tenantId:a.tenantId,enrollmentId:e.id,number:used+1,startedAt:now,deadlineAt:attemptDeadline(now,v.timeLimitMinutes)}});
   await log(tx,at.id,{number:at.number});return {id:at.id,resumed:false};
  });
 }
 case 'quiz.save':{
  const x=z.object({attemptId:id,answers:z.record(z.string().uuid(),z.string().max(40)).refine(o=>Object.keys(o).length<=300)}).parse(data);
  const at=await db.quizAttempt.findFirst({where:{id:x.attemptId,tenantId:a.tenantId,enrollment:{membershipId:a.membershipId}},include:{enrollment:{include:{courseVersion:{include:{questions:{select:{id:true,choices:true}}}}}}}});
  if(!at)throw new DomainError('notFound',404);if(at.submittedAt)throw new DomainError('submitted',409);
  // Past the deadline the saved answers are final and nothing new is accepted (FR-12).
  if(at.deadlineAt&&at.deadlineAt.getTime()+SUBMIT_GRACE_MS<Date.now()){await db.$transaction(tx=>finalizeAttempt(tx,a.tenantId,at.id));throw new DomainError('timeUp',409);}
  const valid=new Map(at.enrollment.courseVersion.questions.map(q=>[q.id,new Set((q.choices as {id:string}[]).map(c=>c.id))]));
  if(Object.entries(x.answers).some(([q,c])=>!valid.get(q)?.has(c)))throw new DomainError('invalid');
  await db.quizAttempt.update({where:{id:at.id},data:{answers:{...(at.answers as object),...x.answers}}});
  return {savedAt:new Date().toISOString()};
 }
 case 'quiz.submit':{
  const x=z.object({attemptId:id}).parse(data);
  const at=await db.quizAttempt.findFirst({where:{id:x.attemptId,tenantId:a.tenantId,enrollment:{membershipId:a.membershipId}}});
  if(!at)throw new DomainError('notFound',404);
  const r=await db.$transaction(tx=>finalizeAttempt(tx,a.tenantId,at.id));
  return {score:r?.score??null,passed:r?.passed??null};
 }
 case 'certificate.revoke':{
  requireRole(a,['Admin']);const x=z.object({id,reason:z.string().trim().min(3).max(500)}).parse(data);
  const c=await db.certificate.findFirst({where:{id:x.id,tenantId:a.tenantId}});if(!c||c.status!=='Valid')throw new DomainError('conflict',409);
  return db.$transaction(async tx=>{await tx.certificate.update({where:{id:c.id},data:{status:'Revoked',revokedAt:new Date(),revokedBy:a.userId,revokeReason:x.reason}});await log(tx,c.id,{serial:c.serial,reason:x.reason});return {ok:true};});
 }
 default:return undefined;
 }
}
