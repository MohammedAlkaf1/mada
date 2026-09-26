/**
 * Scans files still waiting for a verdict, for example those uploaded while
 * the scanner was unreachable. A rejected file is deleted from storage and
 * stops counting towards the quota; lessons pointing at it stay unpublishable.
 *
 *   npm run scan:files
 */
import 'dotenv/config';
import {db} from '../src/lib/db';
import {scanStream} from '../src/lib/file-scanner';
import {exists,readStream,remove} from '../src/lib/storage';
try{
 const pending=await db.asset.findMany({where:{status:'Pending'},orderBy:{createdAt:'asc'},take:20});
 for(const f of pending){
  if(!exists(f.storageKey)){await db.asset.updateMany({where:{id:f.id,status:'Pending'},data:{status:'Rejected',failure:'missing',size:0}});continue;}
  const status=await scanStream(()=>readStream(f.storageKey));
  if(status==='Pending')continue;
  if(status==='Rejected')remove(f.storageKey);
  await db.asset.updateMany({where:{id:f.id,status:'Pending'},data:{status,...(status==='Rejected'?{failure:'malware',size:0}:{})}});
  await db.audit.create({data:{tenantId:f.tenantId,actorId:'system',action:'asset.scan',entityId:f.id,detail:{status}}});
 }
 console.log(`file scan: ${pending.length} checked`);
}finally{await db.$disconnect();}
