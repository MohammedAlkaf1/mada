import {createConnection} from 'node:net';
import type {Readable} from 'node:stream';

export const acceptedKinds={pdf:'application/pdf',mp4:'video/mp4',png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',webp:'image/webp'} as const;

/**
 * Decides the type from the bytes, not from what the browser claims (FR-07).
 * The extension must agree with the signature, so a renamed executable is
 * refused before it reaches the scanner.
 */
export function fileType(bytes:Buffer,name:string){
 const ext=name.split('.').pop()?.toLowerCase();
 if(ext==='pdf'&&bytes.subarray(0,5).toString()==='%PDF-')return 'application/pdf';
 if(ext==='png'&&bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))return 'image/png';
 if(['jpg','jpeg'].includes(ext??'')&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255)return 'image/jpeg';
 if(ext==='webp'&&bytes.subarray(0,4).toString()==='RIFF'&&bytes.subarray(8,12).toString()==='WEBP')return 'image/webp';
 if(ext==='mp4'&&bytes.subarray(4,8).toString()==='ftyp')return 'video/mp4';
 return null;
}

/**
 * Streams the file to ClamAV. Without a scanner, production keeps files
 * quarantined until scan:files runs against one; development accepts files
 * that passed the type check so the flow can be exercised locally.
 */
export async function scanStream(open:()=>Readable):Promise<'Clean'|'Rejected'|'Pending'>{
 if(!process.env.CLAMAV_HOST)return process.env.NODE_ENV==='production'&&process.env.FILE_SCAN_BYPASS!=='1'?'Pending':'Clean';
 return new Promise(resolve=>{
  const socket=createConnection({host:process.env.CLAMAV_HOST!,port:Number(process.env.CLAMAV_PORT??3310)});let result='';socket.setTimeout(120000);
  socket.on('connect',()=>{
   socket.write('zINSTREAM\0');const source=open();
   source.on('data',(chunk:Buffer|string)=>{const b=Buffer.isBuffer(chunk)?chunk:Buffer.from(chunk);const size=Buffer.alloc(4);size.writeUInt32BE(b.length);socket.write(size);socket.write(b);});
   source.on('end',()=>socket.write(Buffer.alloc(4)));
   source.on('error',()=>{socket.destroy();resolve('Pending');});
  });
  socket.on('data',chunk=>{result+=chunk.toString();if(result.includes('\0'))socket.end();});
  socket.on('end',()=>resolve(result.includes(' FOUND')?'Rejected':result.includes(': OK')?'Clean':'Pending'));
  socket.on('timeout',()=>{socket.destroy();resolve('Pending');});socket.on('error',()=>resolve('Pending'));
 });
}
