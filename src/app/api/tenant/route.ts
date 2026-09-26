import {NextRequest,NextResponse} from 'next/server';
import {auth} from '@/auth';
import {db} from '@/lib/db';
import {TENANT_COOKIE} from '@/lib/access';
import {trustedOrigin} from '@/lib/origin';
export async function POST(req:NextRequest){
 if(!trustedOrigin(req))return NextResponse.json({error:'forbidden'},{status:403});
 const session=await auth();if(!session?.user?.id)return new NextResponse(null,{status:401});
 const {tenantId}=await req.json();const m=await db.membership.findFirst({where:{tenantId,userId:session.user.id,active:true}});if(!m)return new NextResponse(null,{status:403});
 const res=NextResponse.json({ok:true});res.cookies.set(TENANT_COOKIE,tenantId,{httpOnly:true,sameSite:'lax',secure:process.env.NODE_ENV==='production',path:'/'});return res;
}
