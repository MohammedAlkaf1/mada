import {NextRequest,NextResponse} from 'next/server';
import {Readable} from 'node:stream';
import {actor,requireRole} from '@/lib/access';
import {db} from '@/lib/db';
import {fileType,scanStream} from '@/lib/file-scanner';
import {DomainError} from '@/lib/domain';
import {LIMITS,TooLarge,head,parseRange,readStream,remove,sizeOf,writeStream} from '@/lib/storage';
import {assertStorage} from '@/lib/billing';

function fail(e:unknown){
 if(e instanceof TooLarge)return NextResponse.json({error:'tooLarge'},{status:413});
 return NextResponse.json({error:e instanceof DomainError?e.code:'server'},{status:e instanceof DomainError?e.status:500});
}

/**
 * Upload is a raw body PUT so a one gigabyte video streams to disk instead of
 * sitting in memory, and the browser can report progress (FR-07). The type
 * is read from the stored bytes, the file is scanned, and only then counted.
 */
export async function PUT(req:NextRequest){
 let key:string|null=null;
 try{
  if(req.headers.get('origin')!==req.nextUrl.origin&&req.headers.get('origin')!==process.env.APP_URL)throw new DomainError('forbidden',403);
  const a=await actor();requireRole(a,['Admin','Instructor']);if(a.tenantStatus!=='Active')throw new DomainError('suspended',403);
  const name=(req.nextUrl.searchParams.get('name')??'').trim().slice(0,160);
  if(!name||!req.body)throw new DomainError('invalid',422);
  const ext=name.split('.').pop()?.toLowerCase()??'';
  const limit=['mp4','webm'].includes(ext)?LIMITS.video:['png','jpg','jpeg','webp'].includes(ext)?LIMITS.image:LIMITS.file;
  const declared=Number(req.headers.get('content-length')??0);
  if(declared>limit)throw new TooLarge();
  await assertStorage(a.tenantId,declared);
  const stored=await writeStream(req.body,limit);key=stored.key;
  const mime=fileType(head(stored.key),name);
  if(!mime){remove(stored.key);key=null;throw new DomainError('fileType',422);}
  await assertStorage(a.tenantId,stored.size);
  const asset=await db.asset.create({data:{tenantId:a.tenantId,uploadedBy:a.userId,name,mime,size:stored.size,storageKey:stored.key,status:'Pending'}});
  key=null;
  const status=await scanStream(()=>readStream(stored.key));
  // A rejected file is deleted at once and never counts towards the quota.
  if(status==='Rejected')remove(stored.key);
  const r=await db.$transaction(async tx=>{const r=await tx.asset.update({where:{id:asset.id},data:{status,...(status==='Rejected'?{failure:'malware',size:0}:{})}});await tx.audit.create({data:{tenantId:a.tenantId,actorId:a.userId,action:'asset.upload',entityId:r.id,detail:{status,mime,size:stored.size},correlationId:a.correlationId}});return r;});
  return NextResponse.json({id:r.id,name:r.name,mime:r.mime,size:r.size,status:r.status});
 }catch(e){if(key)remove(key);return fail(e);}
}

/** Who may read an asset: staff of the workspace, or a learner enrolled in a version that uses it. */
async function readable(a:Awaited<ReturnType<typeof actor>>,assetId:string){
 const asset=await db.asset.findFirst({where:{id:assetId,tenantId:a.tenantId}});
 if(!asset)throw new DomainError('notFound',404);
 if(a.role==='Admin'||a.role==='Instructor')return asset;
 const used=await db.enrollment.findFirst({where:{tenantId:a.tenantId,membershipId:a.membershipId,status:{notIn:['Withdrawn','Cancelled']},courseVersion:{OR:[{coverAssetId:asset.id},{lessons:{some:{assetId:asset.id}}}]}},select:{id:true}});
 if(!used)throw new DomainError('notFound',404);
 return asset;
}

export async function GET(req:NextRequest){
 try{
  const a=await actor();const asset=await readable(a,req.nextUrl.searchParams.get('id')??'');
  if(asset.status!=='Clean')return NextResponse.json({status:asset.status},{status:423});
  const size=sizeOf(asset.storageKey);
  const range=parseRange(req.headers.get('range'),size);
  if(range==='invalid')return new NextResponse(null,{status:416,headers:{'content-range':`bytes */${size}`}});
  const download=req.nextUrl.searchParams.get('download')==='1';
  const headers:Record<string,string>={
   'content-type':asset.mime,
   'accept-ranges':'bytes',
   'cache-control':'private, no-store',
   'x-content-type-options':'nosniff',
   // Inline so a PDF or video plays in the lesson, sandboxed so a crafted file cannot script the app.
   'content-security-policy':"sandbox; default-src 'none'; media-src 'self'; img-src 'self'",
   'content-disposition':`${download?'attachment':'inline'}; filename*=UTF-8''${encodeURIComponent(asset.name)}`,
  };
  const body=(r?:{start:number;end:number})=>Readable.toWeb(readStream(asset.storageKey,r)) as ReadableStream;
  if(range)return new NextResponse(body(range),{status:206,headers:{...headers,'content-range':`bytes ${range.start}-${range.end}/${size}`,'content-length':String(range.end-range.start+1)}});
  return new NextResponse(body(),{headers:{...headers,'content-length':String(size)}});
 }catch(e){return fail(e);}
}
