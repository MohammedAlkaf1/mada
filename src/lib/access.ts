import {auth} from '@/auth';
import {cookies,headers} from 'next/headers';
import {randomUUID} from 'node:crypto';
import {db} from './db';
import {DomainError,type Role} from './domain';
import {DEMO_DOMAIN} from './demo';

export const TENANT_COOKIE='mada.tenant';
export type Actor={userId:string;membershipId:string;tenantId:string;role:Role;name:string;email:string;tenantStatus:string;correlationId:string;platformOperator:boolean};
const IDLE_MS=30*60000;

/**
 * Resolves the signed in person to one active membership in the current
 * workspace (FR-04). Every command and every read starts here, so a request
 * that names another tenant's record simply finds nothing.
 */
export async function actor():Promise<Actor>{
 const session=await auth();if(!session?.user?.id)throw new DomainError('unauthorized',401);
 const user=await db.user.findUnique({where:{id:session.user.id}});if(!user?.active)throw new DomainError('unauthorized',401);
 const requested=(await cookies()).get(TENANT_COOKIE)?.value;
 const now=new Date();
 // Support grants and other time boxed memberships expire on their own clock, not when someone remembers to revoke them.
 await db.membership.updateMany({where:{userId:user.id,active:true,expiresAt:{lt:now}},data:{active:false}});
 let membership=await db.membership.findFirst({where:{userId:user.id,active:true,...(requested?{tenantId:requested}:{})},include:{tenant:true},orderBy:{createdAt:'asc'}});
 // The tenant cookie can outlive the membership it names. Fall back to any workspace they still belong to.
 if(!membership&&requested)membership=await db.membership.findFirst({where:{userId:user.id,active:true},include:{tenant:true},orderBy:{createdAt:'asc'}});
 if(!membership)throw new DomainError('forbidden',403);
 if(membership.role!=='Learner'){
  // NFR-02: a second factor is mandatory for anyone who manages a workspace.
  if(membership.role==='Admin'&&!user.mfaEnabled&&!user.email.endsWith(DEMO_DOMAIN))throw new DomainError('mfaRequired',403);
  // Staff sessions end after 30 idle minutes. The version bump invalidates the cookie on every device.
  if(user.lastSeenAt&&now.getTime()-user.lastSeenAt.getTime()>IDLE_MS){await db.user.update({where:{id:user.id},data:{sessionVersion:{increment:1},lastSeenAt:null}});throw new DomainError('unauthorized',401);}
 }
 if(!user.lastSeenAt||now.getTime()-user.lastSeenAt.getTime()>60000)await db.user.update({where:{id:user.id},data:{lastSeenAt:now}});
 let correlationId:string=randomUUID();try{const h=(await headers()).get('x-request-id');if(h&&/^[a-zA-Z0-9-]{8,64}$/.test(h))correlationId=h;}catch{}
 return {userId:user.id,membershipId:membership.id,tenantId:membership.tenantId,role:membership.role as Role,name:user.name,email:user.email,tenantStatus:membership.tenant.status,correlationId,platformOperator:user.platformOperator};
}

export function requireRole(a:Actor,allowed:Role[]){if(!allowed.includes(a.role))throw new DomainError('forbidden',403);}

/** Which courses this actor may manage. Admins manage all; instructors only those they are named on. */
export function courseScope(a:Actor){
 return {tenantId:a.tenantId,...(a.role==='Admin'?{}:{instructorIds:{has:a.userId}})};
}

export async function manageableCourse(a:Actor,courseId:string){
 requireRole(a,['Admin','Instructor']);
 const c=await db.course.findFirst({where:{...courseScope(a),id:courseId}});
 if(!c)throw new DomainError('notFound',404);
 return c;
}

export async function manageableVersion(a:Actor,versionId:string){
 requireRole(a,['Admin','Instructor']);
 const v=await db.courseVersion.findFirst({where:{id:versionId,tenantId:a.tenantId},include:{course:true}});
 if(!v||(a.role!=='Admin'&&!v.course.instructorIds.includes(a.userId)))throw new DomainError('notFound',404);
 return v;
}

/** The actor's own enrollment. A learner can never act on someone else's record. */
export async function ownEnrollment(a:Actor,enrollmentId:string){
 const e=await db.enrollment.findFirst({where:{id:enrollmentId,tenantId:a.tenantId,membershipId:a.membershipId},include:{courseVersion:true}});
 if(!e)throw new DomainError('notFound',404);
 return e;
}
