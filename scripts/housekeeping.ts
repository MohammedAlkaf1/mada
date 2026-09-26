/**
 * Daily housekeeping. Every step is idempotent, so running it twice in one
 * day changes nothing. Schedule once a day next to `reminders`.
 *
 *   npm run housekeeping
 *
 * 1. Deactivates time boxed memberships such as support grants.
 * 2. Drops the bytes of expired export files, stale import previews,
 *    idempotency keys and rate limit buckets.
 * 3. Retention (BR-07): once a subscription has ended, the organization keeps
 *    read and export access for its retention window (30 days by default).
 *    After that the workspace moves to Closing with a deletion date 30 days
 *    out, its admins are told, and an operator purges it once that date passes.
 */
import 'dotenv/config';
import {db} from '../src/lib/db';
import {closeTenant} from '../src/lib/platform';
import {mail} from '../src/lib/command-kit';
import {appUrl} from '../src/lib/brand';

const now=new Date(),day=86400000;
const SYSTEM={userId:'system'};
const summary:Record<string,number>={};
const count=(k:string,n:number)=>{summary[k]=(summary[k]??0)+n;};
try{
 const expired=await db.membership.updateMany({where:{active:true,expiresAt:{lt:now}},data:{active:false}});count('membershipsExpired',expired.count);

 const exports=await db.exportJob.updateMany({where:{expiresAt:{lt:now},bytes:{not:null}},data:{bytes:null,status:'Expired'}});count('exportsExpired',exports.count);
 const previews=await db.importJob.updateMany({where:{status:'Previewed',createdAt:{lt:new Date(now.getTime()-day)}},data:{status:'Expired',rows:[]}});count('importPreviewsExpired',previews.count);
 count('idempotencyKeysDropped',(await db.idempotencyKey.deleteMany({where:{createdAt:{lt:new Date(now.getTime()-day)}}})).count);
 count('authBucketsDropped',(await db.authAttempt.deleteMany({where:{resetAt:{lt:now}}})).count);

 const ended=await db.subscription.findMany({where:{status:'Cancelled',tenant:{status:{in:['Active','Suspended']}}},include:{tenant:true}});
 for(const s of ended){
  const exportUntil=new Date(s.currentPeriodEnd.getTime()+s.tenant.retentionDays*day);
  if(exportUntil>now)continue;
  await closeTenant(SYSTEM,s.tenantId,30,'retention window after the subscription ended');
  const admins=await db.membership.findMany({where:{tenantId:s.tenantId,role:'Admin',active:true,supportGrant:false},include:{user:{select:{email:true}}}});
  await db.$transaction(async tx=>{for(const m of admins)await mail(tx,s.tenantId,m.user.email,'سيُحذف محتوى جهتكم خلال 30 يومًا',`انتهت فترة الاحتفاظ بعد انتهاء اشتراك ${s.tenant.nameAr}. ستُحذف البيانات التشغيلية خلال 30 يومًا. يمكنكم تجديد الاشتراك أو تنزيل حزمة البيانات قبل ذلك من صفحة التقارير:\n${appUrl()}/ar/reports`,`retention:${s.tenantId}`);});
  count('tenantsClosing',1);
 }
 console.log('Housekeeping completed',JSON.stringify(summary));
}finally{await db.$disconnect();}
