/**
 * Platform operator console (FR-001, FR-005, FR-049). These are operator
 * actions, not customer actions, so they live on the command line beside the
 * billing console and never in the tenant UI. The same actions are available
 * in the operator panel at /ar/operator for users flagged with `grant`.
 *
 *   npm run operator -- list
 *   npm run operator -- create <slug> "<nameAr>" "<nameEn>" <adminEmail> "<adminName>" [planCode]
 *   npm run operator -- suspend <slug> "<reason>"
 *   npm run operator -- resume <slug> "<reason>"
 *   npm run operator -- close <slug> <daysUntilDeletion> "<reason>"
 *   npm run operator -- export <slug> <outputDir>
 *   npm run operator -- purge <slug>          (only after close and once deleteAt has passed)
 *   npm run operator -- grant <email>         let this user open the operator panel
 *   npm run operator -- revoke <email>
 *   npm run operator -- operators             list who can open the panel
 */
import 'dotenv/config';
import {mkdirSync,writeFileSync} from 'node:fs';
import path from 'node:path';
import {randomBytes} from 'node:crypto';
import {db} from '../src/lib/db';
import {buildExport} from '../src/lib/exports';
import {closeTenant,createTenant,grantOperator,purgeTenant,revokeOperator,setTenantStatus} from '../src/lib/platform';
import type {Actor} from '../src/lib/access';
const [cmd,...args]=process.argv.slice(2);
const OPERATOR={userId:'operator'};
async function tenant(slug:string){const t=await db.tenant.findUnique({where:{slug}});if(!t)throw new Error(`No tenant with slug ${slug}`);return t;}
try{
 if(cmd==='list'){
  for(const t of await db.tenant.findMany({orderBy:{createdAt:'asc'},include:{_count:{select:{memberships:true}}}}))console.log(`${t.slug.padEnd(24)} ${t.status.padEnd(10)} members=${t._count.memberships} retention=${t.retentionDays}d${t.deleteAt?` deleteAt=${t.deleteAt.toISOString()}`:''}  ${t.nameAr} | ${t.nameEn}`);
 }
 else if(cmd==='create'){
  const [slug,nameAr,nameEn,email,name='مسؤول الجهة',planCode]=args;if(!slug||!nameAr||!nameEn||!email)throw new Error('usage: create <slug> <nameAr> <nameEn> <adminEmail> [adminName] [planCode]');
  const r=await createTenant(OPERATOR,{slug,nameAr,nameEn,adminEmail:email,adminName:name,planCode});
  console.log(`Created ${slug} (${r.tenant.id}). Invitation queued to ${r.invitationEmail}; run npm run mail:send to deliver it.`);
 }
 else if(cmd==='suspend'||cmd==='resume'){
  const [slug,reason='operator console']=args;const t=await tenant(slug);
  const r=await setTenantStatus(OPERATOR,t.id,cmd==='suspend'?'Suspended':'Active',reason);console.log(`${slug} is now ${r.status}`);
 }
 else if(cmd==='close'){
  const [slug,days='30',reason='operator console']=args;const t=await tenant(slug);
  const r=await closeTenant(OPERATOR,t.id,Number(days),reason);
  console.log(`${slug} is Closing. Data stays readable and exportable until ${r.deleteAt.toISOString()}; run export before purge.`);
 }
 else if(cmd==='export'){
  const [slug,dir='exports']=args;const t=await tenant(slug);const out=path.resolve(dir,`${slug}-${new Date().toISOString().slice(0,10)}`);mkdirSync(out,{recursive:true});
  // The same package the organization's admin downloads from Reports (FR-19).
  const a:Actor={userId:OPERATOR.userId,membershipId:'',tenantId:t.id,role:'Admin',name:OPERATOR.userId,email:'',tenantStatus:t.status,correlationId:randomBytes(8).toString('hex'),platformOperator:true};
  const pack=await buildExport(a,'package',{});writeFileSync(path.join(out,'package.zip'),pack.bytes);console.log(`package.zip  ${pack.rows} rows`);
  writeFileSync(path.join(out,'audit.json'),JSON.stringify(await db.audit.findMany({where:{tenantId:t.id},orderBy:{createdAt:'asc'}}),null,1),'utf8');
  await db.audit.create({data:{tenantId:t.id,actorId:OPERATOR.userId,action:'platform.tenant.exportAll',entityId:t.id,detail:{dir:out}}});console.log(`Written to ${out}`);
 }
 else if(cmd==='purge'){
  const [slug]=args;const t=await tenant(slug);
  await purgeTenant(OPERATOR,t.id);
  console.log(`${slug} purged. The activity log was kept.`);
 }
 else if(cmd==='grant'){
  const [email]=args;if(!email)throw new Error('usage: grant <email>');
  await grantOperator(OPERATOR,email);console.log(`${email} can now open the operator panel (two step verification required).`);
 }
 else if(cmd==='revoke'){
  const [email]=args;if(!email)throw new Error('usage: revoke <email>');
  const u=await db.user.findUnique({where:{email:email.toLowerCase()}});if(!u)throw new Error(`No user ${email}`);
  await revokeOperator(OPERATOR,u.id);console.log(`${email} no longer opens the operator panel.`);
 }
 else if(cmd==='operators'){
  for(const u of await db.user.findMany({where:{platformOperator:true}}))console.log(`${u.email.padEnd(40)} ${u.name} ${u.active?'':'(inactive)'} ${u.mfaEnabled?'':'(no 2FA yet)'}`);
 }
 else{console.log('commands: list | create | suspend | resume | close | export | purge | grant | revoke | operators');process.exitCode=1;}
}finally{await db.$disconnect();}
