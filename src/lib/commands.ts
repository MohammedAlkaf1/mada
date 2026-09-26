import {z} from 'zod';
import {randomBytes,createHash} from 'node:crypto';
import {db} from './db';
import {requireRole,type Actor} from './access';
import {DomainError,roles,planImport,type ImportRow} from './domain';
import {assertWithinPlan,assertFeature,nextInvoiceNumber,paymentProvider,moyasar,settleExternalPayment,DUE_DAYS,usageFor} from './billing';
import {invoiceAmounts} from './plan-math';
import {auditor,mail,notify,type Tx} from './command-kit';
import {courseCommand} from './course-commands';
import {learningCommand} from './learning-commands';
import {buildExport,exportTypes,EXPORT_TTL_MS} from './exports';
import {PRODUCT,appUrl} from './brand';

const id=z.string().uuid(),reason=z.string().trim().min(3).max(1000);
const INVITE_TTL_MS=72*3600000;
const digest=(v:string)=>createHash('sha256').update(v).digest('hex');

/** Actions an expired or suspended workspace still allows: reading, exporting and paying (FR-05). */
const ALLOWED_WHEN_INACTIVE=['notification.read','session.revoke','preferences.save','export.request','profile.update','billing.changePlan','billing.checkout','billing.confirmPayment','billing.cancel'];

/**
 * Creates the account on the spot when the address is new, so a learner can
 * be grouped and assigned before they ever sign in. The account stays
 * unverified and cannot sign in until its owner sets a password from the
 * invitation link, which is valid 72 hours and works once (FR-02).
 */
async function invite(tx:Tx,a:Actor,email:string,name:string,role:string,groupName?:string){
 let user=await tx.user.findUnique({where:{email}});
 if(!user)user=await tx.user.create({data:{email,name,password:'',verified:false}});
 const existing=await tx.membership.findUnique({where:{tenantId_userId:{tenantId:a.tenantId,userId:user.id}}});
 const m=existing?await tx.membership.update({where:{id:existing.id},data:{active:true}}):await tx.membership.create({data:{tenantId:a.tenantId,userId:user.id,role}});
 if(groupName){const g=await tx.group.upsert({where:{tenantId_name:{tenantId:a.tenantId,name:groupName}},create:{tenantId:a.tenantId,name:groupName},update:{}});await tx.groupMember.upsert({where:{groupId_membershipId:{groupId:g.id,membershipId:m.id}},create:{tenantId:a.tenantId,groupId:g.id,membershipId:m.id},update:{}});}
 const tenant=await tx.tenant.findUniqueOrThrow({where:{id:a.tenantId}});
 if(user.verified){
  await mail(tx,a.tenantId,email,`أُضفت إلى ${tenant.nameAr}`,`أضافك ${a.name} إلى ${tenant.nameAr}. ادخل بحسابك الحالي:\n${appUrl()}/ar/login`);
 }else{
  const token=randomBytes(32).toString('hex');
  await tx.invitation.create({data:{tenantId:a.tenantId,email,role,tokenHash:digest(token),expiresAt:new Date(Date.now()+INVITE_TTL_MS)}});
  await mail(tx,a.tenantId,email,`دعوة للانضمام إلى ${tenant.nameAr}`,`دعاك ${a.name} للانضمام إلى ${tenant.nameAr} على منصة ${PRODUCT.ar}.\nأنشئ كلمة المرور من الرابط التالي، وهو صالح 72 ساعة ويستخدم مرة واحدة:\n${appUrl()}/ar/register?invitation=${token}`);
 }
 return m;
}

export async function command(a:Actor,action:string,input:unknown){
 if(a.tenantStatus!=='Active'&&!ALLOWED_WHEN_INACTIVE.includes(action))throw new DomainError('suspended',403);
 const data=z.record(z.string(),z.unknown()).parse(input);
 const log=auditor(a,action);
 switch(action){
 /* ── People ── */
 case 'member.invite':{
  requireRole(a,['Admin']);const x=z.object({email:z.string().trim().toLowerCase().email().max(254),name:z.string().trim().min(2).max(120),role:z.enum(roles),group:z.string().trim().max(80).optional()}).parse(data);
  const prior=await db.user.findUnique({where:{email:x.email},include:{memberships:{where:{tenantId:a.tenantId}}}});
  if(prior?.memberships[0]?.active)throw new DomainError('duplicate',409);
  await assertWithinPlan(a.tenantId,'members');
  return db.$transaction(async tx=>{const m=await invite(tx,a,x.email,x.name,x.role,x.group||undefined);await log(tx,m.id,{role:x.role});return {id:m.id};});
 }
 case 'member.resend':{
  requireRole(a,['Admin']);const x=z.object({id}).parse(data);
  const m=await db.membership.findFirst({where:{id:x.id,tenantId:a.tenantId,active:true},include:{user:true}});if(!m||m.user.verified)throw new DomainError('conflict',409);
  return db.$transaction(async tx=>{
   // A fresh link voids the earlier ones for this workspace.
   await tx.invitation.updateMany({where:{tenantId:a.tenantId,email:m.user.email,usedAt:null},data:{usedAt:new Date()}});
   await invite(tx,a,m.user.email,m.user.name,m.role);await log(tx,m.id);return {ok:true};
  });
 }
 case 'member.update':{
  requireRole(a,['Admin']);const x=z.object({id,role:z.enum(roles),active:z.boolean(),title:z.string().trim().max(120).default('')}).parse(data);
  const m=await db.membership.findFirst({where:{id:x.id,tenantId:a.tenantId}});if(!m)throw new DomainError('notFound',404);
  if(m.userId===a.userId&&(x.role!=='Admin'||!x.active))throw new DomainError('selfLockout',409);
  if(x.active&&!m.active)await assertWithinPlan(a.tenantId,'members');
  return db.$transaction(async tx=>{
   await tx.membership.update({where:{id:m.id},data:{role:x.role,active:x.active,title:x.title}});
   // Deactivation takes effect at once: the next request of that person finds no membership (FR-02).
   if(!x.active&&m.active)await tx.user.update({where:{id:m.userId},data:{sessionVersion:{increment:1}}});
   if(x.role!=='Instructor'&&x.role!=='Admin'&&m.role!==x.role){const courses=await tx.course.findMany({where:{tenantId:a.tenantId,instructorIds:{has:m.userId}}});for(const c of courses)await tx.course.update({where:{id:c.id},data:{instructorIds:c.instructorIds.filter((u:string)=>u!==m.userId)}});}
   await log(tx,m.id,{from:{role:m.role,active:m.active},to:{role:x.role,active:x.active}});return {ok:true};
  });
 }
 /* ── Groups ── */
 case 'group.save':{
  requireRole(a,['Admin']);const x=z.object({id:id.optional(),name:z.string().trim().min(1).max(80),description:z.string().trim().max(500).default('')}).parse(data);
  if(await db.group.findFirst({where:{tenantId:a.tenantId,name:x.name,...(x.id?{id:{not:x.id}}:{})}}))throw new DomainError('duplicate',409);
  return db.$transaction(async tx=>{
   if(x.id){const r=await tx.group.updateMany({where:{id:x.id,tenantId:a.tenantId},data:{name:x.name,description:x.description}});if(!r.count)throw new DomainError('notFound',404);await log(tx,x.id);return {id:x.id};}
   const g=await tx.group.create({data:{tenantId:a.tenantId,name:x.name,description:x.description}});await log(tx,g.id);return {id:g.id};
  });
 }
 case 'group.archive':{
  requireRole(a,['Admin']);const x=z.object({id,archived:z.boolean()}).parse(data);
  return db.$transaction(async tx=>{const r=await tx.group.updateMany({where:{id:x.id,tenantId:a.tenantId},data:{archivedAt:x.archived?new Date():null}});if(!r.count)throw new DomainError('notFound',404);await log(tx,x.id,{archived:x.archived});return {ok:true};});
 }
 case 'group.members':{
  requireRole(a,['Admin']);const x=z.object({id,add:z.array(id).max(5000).default([]),remove:z.array(id).max(5000).default([])}).parse(data);
  const g=await db.group.findFirst({where:{id:x.id,tenantId:a.tenantId,archivedAt:null}});if(!g)throw new DomainError('notFound',404);
  // BR-01: a group only ever holds memberships of its own workspace.
  if(x.add.length&&await db.membership.count({where:{id:{in:x.add},tenantId:a.tenantId}})!==new Set(x.add).size)throw new DomainError('invalid');
  return db.$transaction(async tx=>{
   for(const m of new Set(x.add))await tx.groupMember.upsert({where:{groupId_membershipId:{groupId:g.id,membershipId:m}},create:{tenantId:a.tenantId,groupId:g.id,membershipId:m},update:{}});
   if(x.remove.length)await tx.groupMember.deleteMany({where:{groupId:g.id,tenantId:a.tenantId,membershipId:{in:x.remove}}});
   await log(tx,g.id,{added:x.add.length,removed:x.remove.length});return {ok:true};
  });
 }
 /* ── Import (FR-03) ── */
 case 'import.preview':{
  requireRole(a,['Admin']);await assertFeature(a.tenantId,'import');
  const x=z.object({filename:z.string().trim().min(1).max(160),rows:z.array(z.object({row:z.number().int(),name:z.string().max(400),email:z.string().max(400),group:z.string().max(400).default(''),role:z.string().max(60).default('')})).min(1).max(3000)}).parse(data);
  const emails=[...new Set(x.rows.map(r=>r.email.trim().toLowerCase()).filter(Boolean))];
  const members=await db.membership.findMany({where:{tenantId:a.tenantId,active:true,user:{email:{in:emails}}},include:{user:{select:{email:true}},groups:{include:{group:{select:{name:true}}}}}});
  const plan=planImport(x.rows as ImportRow[],new Map(members.map(m=>[m.user.email,{role:m.role,groups:m.groups.map(g=>g.group.name)}])));
  const job=await db.importJob.create({data:{tenantId:a.tenantId,userId:a.userId,filename:x.filename,rows:plan,totalRows:plan.length,createdRows:plan.filter(p=>p.status==='create').length,skippedRows:plan.filter(p=>p.status==='skip'||p.status==='update').length,errorRows:plan.filter(p=>p.status==='error').length}});
  return {id:job.id,rows:plan};
 }
 case 'import.apply':{
  requireRole(a,['Admin']);const x=z.object({id}).parse(data);
  const job=await db.importJob.findFirst({where:{id:x.id,tenantId:a.tenantId,userId:a.userId,status:'Previewed'}});if(!job)throw new DomainError('conflict',409);
  if(Date.now()-job.createdAt.getTime()>3600000)throw new DomainError('expired',410);
  const plan=job.rows as {row:number;name:string;email:string;group:string;role:string;status:string}[];
  const creates=plan.filter(p=>p.status==='create');
  if(creates.length)await assertWithinPlan(a.tenantId,'members',creates.length);
  return db.$transaction(async tx=>{
   const claimed=await tx.importJob.updateMany({where:{id:job.id,status:'Previewed'},data:{status:'Applied',appliedAt:new Date()}});if(!claimed.count)throw new DomainError('conflict',409);
   let created=0,updated=0;
   for(const p of plan){
    // Re-checked inside the transaction, so a person added between preview and apply is not added twice.
    if(p.status==='create'){const u=await tx.user.findUnique({where:{email:p.email},include:{memberships:{where:{tenantId:a.tenantId,active:true}}}});if(u?.memberships.length)continue;await invite(tx,a,p.email,p.name,p.role,p.group||undefined);created++;}
    else if(p.status==='update'&&p.group){const m=await tx.membership.findFirst({where:{tenantId:a.tenantId,user:{email:p.email}}});if(!m)continue;const g=await tx.group.upsert({where:{tenantId_name:{tenantId:a.tenantId,name:p.group}},create:{tenantId:a.tenantId,name:p.group},update:{}});await tx.groupMember.upsert({where:{groupId_membershipId:{groupId:g.id,membershipId:m.id}},create:{tenantId:a.tenantId,groupId:g.id,membershipId:m.id},update:{}});updated++;}
   }
   await log(tx,job.id,{created,updated,errors:job.errorRows});
   return {created,updated,errors:job.errorRows};
  });
 }
 /* ── Workspace identity (FR-01) ── */
 case 'tenant.update':{
  requireRole(a,['Admin']);const x=z.object({nameAr:z.string().trim().min(2).max(120),nameEn:z.string().trim().min(2).max(120),brandColor:z.string().regex(/^#[0-9a-fA-F]{6}$/),timezone:z.string().trim().max(60).default('Asia/Riyadh')}).parse(data);
  try{new Intl.DateTimeFormat('en',{timeZone:x.timezone});}catch{throw new DomainError('invalid');}
  return db.$transaction(async tx=>{await tx.tenant.update({where:{id:a.tenantId},data:x});await log(tx,a.tenantId,x);return {ok:true};});
 }
 case 'tenant.logoRemove':{
  requireRole(a,['Admin']);
  return db.$transaction(async tx=>{await tx.tenant.update({where:{id:a.tenantId},data:{logo:null,logoMime:null}});await log(tx,a.tenantId);return {ok:true};});
 }
 /* ── Exports (FR-16, FR-19) ── */
 case 'export.request':{
  const x=z.object({type:z.enum(exportTypes),courseId:id.optional(),groupId:id.optional()}).parse(data);
  if(x.type==='package'){requireRole(a,['Admin']);}else requireRole(a,['Admin','Instructor']);
  if(x.type!=='package')await assertFeature(a.tenantId,'exports');
  const job=await db.exportJob.create({data:{tenantId:a.tenantId,userId:a.userId,type:x.type,filters:{courseId:x.courseId??null,groupId:x.groupId??null},expiresAt:new Date(Date.now()+EXPORT_TTL_MS[x.type])}});
  try{
   const out=await buildExport(a,x.type,{courseId:x.courseId,groupId:x.groupId});
   await db.$transaction(async tx=>{await tx.exportJob.update({where:{id:job.id},data:{status:'Ready',rows:out.rows,bytes:out.bytes,mime:out.mime,completedAt:new Date()}});await log(tx,job.id,{rows:out.rows,...x});await notify(tx,a.tenantId,a.userId,{ar:'ملف التصدير جاهز',en:'Your export is ready',href:'/reports'},`export:${job.id}`,false);});
  }catch(e){await db.exportJob.update({where:{id:job.id},data:{status:'Failed',error:e instanceof Error?e.name:'unknown',completedAt:new Date()}});throw e;}
  return {id:job.id,href:`/api/export?job=${job.id}`};
 }
 /* ── The signed in person ── */
 case 'notification.read':return db.notification.updateMany({where:{tenantId:a.tenantId,userId:a.userId,...(data.id?{id:id.parse(data.id)}:{})},data:{read:true}});
 case 'session.revoke':{await db.user.update({where:{id:a.userId},data:{sessionVersion:{increment:1}}});return {ok:true};}
 case 'preferences.save':{await db.user.update({where:{id:a.userId},data:{reminders:z.boolean().parse(data.reminders)}});return {ok:true};}
 case 'profile.update':{
  const x=z.object({name:z.string().trim().min(2).max(120)}).parse(data);
  return db.$transaction(async tx=>{await tx.user.update({where:{id:a.userId},data:{name:x.name}});await log(tx,a.userId,{name:x.name});return {ok:true};});
 }
 /* ── Support access (break glass, audited) ── */
 case 'support.grant':{
  requireRole(a,['Admin']);const x=z.object({email:z.string().trim().toLowerCase().email(),hours:z.coerce.number().int().min(1).max(72),reason}).parse(data);
  const user=await db.user.findUnique({where:{email:x.email}});if(!user||!user.active||!user.verified||!user.platformOperator)throw new DomainError('notFound',404);
  if(user.id===a.userId)throw new DomainError('invalid');
  const expiresAt=new Date(Date.now()+x.hours*3600000);
  return db.$transaction(async tx=>{const m=await tx.membership.upsert({where:{tenantId_userId:{tenantId:a.tenantId,userId:user.id}},create:{tenantId:a.tenantId,userId:user.id,role:'Admin',active:true,expiresAt,supportGrant:true},update:{role:'Admin',active:true,expiresAt,supportGrant:true}});await log(tx,m.id,{email:x.email,hours:x.hours,expiresAt,reason:x.reason});
   await mail(tx,a.tenantId,user.email,'وصول دعم مؤقت',`مُنحت وصولًا مؤقتًا إلى مساحة عمل حتى ${expiresAt.toISOString()}.\n${appUrl()}/ar`);return {id:m.id,expiresAt};});
 }
 case 'support.revoke':{
  requireRole(a,['Admin']);const x=z.object({id,reason}).parse(data);
  return db.$transaction(async tx=>{const r=await tx.membership.updateMany({where:{id:x.id,tenantId:a.tenantId,supportGrant:true},data:{active:false,expiresAt:new Date()}});if(!r.count)throw new DomainError('notFound',404);await log(tx,x.id,{reason:x.reason});return {ok:true};});
 }
 case 'outbox.retry':{
  requireRole(a,['Admin']);const x=z.object({id}).parse(data);
  return db.$transaction(async tx=>{const r=await tx.outbox.updateMany({where:{id:x.id,tenantId:a.tenantId,status:'Failed'},data:{status:'Queued',attempts:0,nextAttemptAt:new Date()}});if(!r.count)throw new DomainError('notFound',404);await log(tx,x.id);return {ok:true};});
 }
 /* ── Billing ── */
 case 'billing.changePlan':{
  requireRole(a,['Admin']);
  const x=z.object({planCode:z.string().trim().max(40),version:z.number().int()}).parse(data);
  const plan=await db.plan.findFirst({where:{code:x.planCode,active:true}});if(!plan)throw new DomainError('notFound',404);
  const sub=await db.subscription.findUnique({where:{tenantId:a.tenantId},include:{plan:true}});if(!sub)throw new DomainError('notFound',404);
  if(sub.planId===plan.id)return {id:sub.id};
  // A downgrade must not strand data above the new ceiling.
  const usage=await usageFor(a.tenantId);
  const over=(plan.maxCourses>=0&&usage.courses>plan.maxCourses)||(plan.maxMembers>=0&&usage.members>plan.maxMembers)||(plan.storageMb>=0&&usage.storageMb>plan.storageMb);
  if(over)throw new DomainError('downgradeBlocked',409);
  return db.$transaction(async tx=>{
   const upgrade=plan.priceMonthly>sub.plan.priceMonthly;
   // Upgrades take effect at once and open an invoice; downgrades apply at renewal.
   const r=await tx.subscription.updateMany({where:{id:sub.id,version:x.version},data:{planId:plan.id,cancelAtPeriodEnd:false,...(upgrade?{status:sub.status==='Trialing'?'Trialing':'Active'}:{})}});
   if(!r.count)throw new DomainError('conflict',409);
   if(upgrade&&sub.status!=='Trialing'&&plan.priceMonthly>0){
    const number=await nextInvoiceNumber(tx as never);
    await tx.invoice.create({data:{tenantId:a.tenantId,subscriptionId:sub.id,number,...invoiceAmounts(plan.priceMonthly),currency:plan.currency,periodStart:sub.currentPeriodStart,periodEnd:sub.currentPeriodEnd,dueAt:new Date(Date.now()+DUE_DAYS*86400000),provider:process.env.BILLING_PROVIDER??'manual'}});
   }
   await tx.subscription.update({where:{id:sub.id},data:{version:{increment:1}}});
   await log(tx,sub.id,{from:sub.plan.code,to:plan.code});
   return {id:sub.id};
  });
 }
 case 'billing.cancel':{
  requireRole(a,['Admin']);const x=z.object({version:z.number().int(),cancel:z.boolean()}).parse(data);
  const sub=await db.subscription.findUnique({where:{tenantId:a.tenantId}});if(!sub)throw new DomainError('notFound',404);
  return db.$transaction(async tx=>{
   const r=await tx.subscription.updateMany({where:{id:sub.id,version:x.version},data:{cancelAtPeriodEnd:x.cancel,version:{increment:1}}});
   if(!r.count)throw new DomainError('conflict',409);
   await log(tx,sub.id,{cancelAtPeriodEnd:x.cancel});return {id:sub.id};
  });
 }
 case 'billing.checkout':{
  requireRole(a,['Admin']);const invoice=await db.invoice.findFirst({where:{id:id.parse(data.id),tenantId:a.tenantId}});
  if(!invoice)throw new DomainError('notFound',404);
  if(invoice.status!=='Open')throw new DomainError('conflict',409);
  const provider=paymentProvider(invoice.provider);
  const checkout=await provider.createCheckout({tenantId:a.tenantId,invoiceId:invoice.id,amount:invoice.amount,currency:invoice.currency,description:invoice.number,returnUrl:`${appUrl()}/ar/billing`});
  // The gateway's own reference lets the return flow look the payment up without trusting the query string.
  if(checkout.kind==='redirect'&&checkout.externalId)await db.invoice.update({where:{id:invoice.id},data:{providerRef:checkout.externalId}});
  await db.audit.create({data:{tenantId:a.tenantId,actorId:a.userId,action,entityId:invoice.id,detail:{provider:invoice.provider}}});
  return checkout;
 }
 case 'billing.confirmPayment':{
  // Called when the customer comes back from the gateway. The webhook may or may
  // not have landed yet, so the payment is looked up at the source and settled
  // through the same idempotent path; a webhook arriving later finds it done.
  requireRole(a,['Admin']);const invoice=await db.invoice.findFirst({where:{id:id.parse(data.id),tenantId:a.tenantId}});
  if(!invoice)throw new DomainError('notFound',404);
  if(invoice.status==='Paid')return {status:'paid'};
  if(invoice.provider!=='moyasar'||!invoice.providerRef)return {status:'pending'};
  const event=await moyasar.fetchInvoice(invoice.providerRef);
  if(!event||event.invoiceId!==invoice.id)return {status:'pending'};
  try{
   const outcome=await db.$transaction(tx=>settleExternalPayment(tx as never,'moyasar',event,event as object));
   return {status:outcome};
  }catch(e){
   if(e&&typeof e==='object'&&'code' in e&&(e as {code:string}).code==='P2002')return {status:(await db.invoice.findUnique({where:{id:invoice.id}}))?.status==='Paid'?'paid':'pending'};
   throw e;
  }
 }
 }
 const course=await courseCommand(a,action,data);if(course!==undefined)return course;
 const learning=await learningCommand(a,action,data);if(learning!==undefined)return learning;
 throw new DomainError('invalid');
}
