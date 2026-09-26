/**
 * Training reminders (FR-17). Run hourly; the dedupe keys make repeated runs
 * harmless, so a missed hour is simply caught up by the next one.
 *
 *   · a reminder 48 hours before the due date, if the assignment left room for one
 *   · one overdue notice 24 hours after the due date
 *   · expired quiz attempts are graded from their saved answers
 *
 *   npm run reminders
 */
import 'dotenv/config';
import {db} from '../src/lib/db';
import {notify} from '../src/lib/command-kit';
import {closeExpiredAttempts} from '../src/lib/learning-commands';

const HOUR=3600000;
const now=new Date();
const open={status:{in:['NotStarted','InProgress']},membership:{active:true},courseVersion:{course:{archivedAt:null}}};

try{
 // Only assignments whose window was longer than two days get the early reminder.
 const soon=await db.enrollment.findMany({where:{...open,reminderSentAt:null,dueAt:{gt:now,lte:new Date(now.getTime()+48*HOUR)}},include:{courseVersion:{select:{title:true}},membership:{include:{user:{select:{id:true,reminders:true}},tenant:{select:{status:true}}}}}});
 let reminded=0,late=0;
 for(const e of soon){
  if(e.membership.tenant.status!=='Active')continue;
  if(e.dueAt!.getTime()-e.createdAt.getTime()<48*HOUR)continue;
  await db.$transaction(async tx=>{
   const claimed=await tx.enrollment.updateMany({where:{id:e.id,reminderSentAt:null},data:{reminderSentAt:new Date()}});if(!claimed.count)return;
   await notify(tx,e.tenantId,e.membership.userId,{ar:`موعد إنهاء دورة ${e.courseVersion.title} بعد يومين`,en:`${e.courseVersion.title} is due in two days`,href:`/learn/${e.id}`},`due:${e.id}:${e.dueAt!.toISOString()}`,e.membership.user.reminders);
  });
  reminded++;
 }
 const overdue=await db.enrollment.findMany({where:{...open,overdueSentAt:null,dueAt:{lte:new Date(now.getTime()-24*HOUR)}},include:{courseVersion:{select:{title:true}},membership:{include:{user:{select:{reminders:true}},tenant:{select:{status:true}}}}}});
 for(const e of overdue){
  if(e.membership.tenant.status!=='Active')continue;
  await db.$transaction(async tx=>{
   const claimed=await tx.enrollment.updateMany({where:{id:e.id,overdueSentAt:null},data:{overdueSentAt:new Date()}});if(!claimed.count)return;
   await notify(tx,e.tenantId,e.membership.userId,{ar:`تجاوزت دورة ${e.courseVersion.title} موعدها`,en:`${e.courseVersion.title} is past its due date`,href:`/learn/${e.id}`},`overdue:${e.id}:${e.dueAt!.toISOString()}`,e.membership.user.reminders);
  });
  late++;
 }
 const graded=await closeExpiredAttempts();
 console.log(`reminders: ${reminded} due soon, ${late} overdue, ${graded} expired attempts graded`);
}finally{await db.$disconnect();}
