import {randomBytes} from 'node:crypto';
import type {Actor} from './access';
import {certificateSerial,isComplete,enrollmentStatus} from './domain';
import {PRODUCT,appUrl} from './brand';

/* Helpers shared by every command module. They take the transaction client so
   an audit row, an inbox entry and a queued mail commit or roll back together
   with the change they describe. */

export type Tx=any;

export function auditor(a:Actor,action:string){
 return (tx:Tx,entityId:string,detail:object={})=>tx.audit.create({data:{tenantId:a.tenantId,actorId:a.userId,action,entityId,detail,correlationId:a.correlationId}});
}

/**
 * One inbox entry and at most one email per recipient per event. The dedupe
 * key makes a replayed command or a rerun job a no op (FR-17), and the mail
 * carries only a link, never the record itself.
 */
export async function notify(tx:Tx,tenantId:string,userId:string,msg:{ar:string;en:string;href:string},dedupeKey?:string,mail=true){
 if(dedupeKey){const seen=await tx.notification.findUnique({where:{dedupeKey}});if(seen)return;}
 await tx.notification.create({data:{tenantId,userId,titleAr:msg.ar,titleEn:msg.en,href:msg.href,dedupeKey}});
 if(!mail)return;
 const u=await tx.user.findUnique({where:{id:userId},select:{email:true,reminders:true,active:true}});
 if(!u?.active)return;
 const data={tenantId,recipient:u.email,subject:`${msg.ar} · ${PRODUCT.ar}`,body:`${msg.ar}\n${msg.en}\n\n${appUrl()}/ar${msg.href}`,dedupeKey:dedupeKey?`mail:${dedupeKey}`:undefined};
 if(data.dedupeKey)await tx.outbox.upsert({where:{dedupeKey:data.dedupeKey},create:data,update:{}});else await tx.outbox.create({data});
}

export async function mail(tx:Tx,tenantId:string,recipient:string,subject:string,body:string,dedupeKey?:string){
 const data={tenantId,recipient,subject:`${subject} · ${PRODUCT.ar}`,body,dedupeKey};
 if(dedupeKey)await tx.outbox.upsert({where:{dedupeKey},create:data,update:{}});else await tx.outbox.create({data});
}

/**
 * Recomputes an enrollment from its records and issues the certificate the
 * first time it completes (FR-13, FR-14). Idempotent: running it twice on the
 * same state changes nothing, and a revoked certificate is never replaced by
 * a fresh valid one (FR-15).
 */
export async function settle(tx:Tx,tenantId:string,enrollmentId:string){
 const e=await tx.enrollment.findFirst({where:{id:enrollmentId,tenantId},include:{courseVersion:{include:{lessons:{select:{id:true,required:true}}}},progress:{where:{completedAt:{not:null}},select:{lessonId:true}},attempts:{where:{submittedAt:{not:null}},select:{score:true,passed:true,scope:true}},certificate:true,membership:{include:{user:true,tenant:true}}}});
 if(!e)return null;
 if(['Withdrawn','Cancelled'].includes(e.status))return e;
 const required=e.courseVersion.lessons.filter((l:{required:boolean})=>l.required).map((l:{id:string})=>l.id);
 const done=new Set(e.progress.map((p:{lessonId:string})=>p.lessonId));
 const requiredDone=required.filter((id:string)=>done.has(id)).length;
 // Only the final exam decides quizPassed and the best score; quiz lessons count as lessons.
 const finals=e.attempts.filter((x:{scope:string})=>x.scope==='final');
 const scores=finals.map((x:{score:number|null})=>x.score).filter((x:number|null):x is number=>x!==null);
 const bestScore=scores.length?Math.max(...scores):null;
 const quizPassed=finals.some((x:{passed:boolean|null})=>x.passed===true);
 const input={requiredDone,requiredTotal:required.length,quizEnabled:e.courseVersion.quizEnabled,quizPassed};
 const started=!!e.startedAt||done.size>0||e.attempts.length>0;
 const status=enrollmentStatus({...input,started});
 const completedNow=status==='Completed'&&e.status!=='Completed';
 const r=await tx.enrollment.update({where:{id:e.id},data:{requiredDone,requiredTotal:required.length,quizPassed,bestScore,status,startedAt:e.startedAt??(started?new Date():null),completedAt:status==='Completed'?(e.completedAt??new Date()):null}});
 if(isComplete(input)&&!e.certificate){
  const serial=certificateSerial(new Date().getFullYear(),randomBytes(8));
  await tx.certificate.create({data:{tenantId,enrollmentId:e.id,serial,verifyToken:randomBytes(18).toString('base64url'),learnerName:e.membership.user.name,courseTitle:e.courseVersion.title,tenantName:e.membership.tenant.nameAr,score:bestScore}});
  await tx.audit.create({data:{tenantId,actorId:'system',action:'certificate.issue',entityId:e.id,detail:{serial}}});
 }
 if(completedNow){
  await notify(tx,tenantId,e.membership.userId,{ar:`أكملت دورة ${e.courseVersion.title}`,en:`You completed ${e.courseVersion.title}`,href:'/certificates'},`completed:${e.id}`);
 }
 return r;
}
