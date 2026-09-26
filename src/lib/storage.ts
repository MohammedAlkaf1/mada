import {createReadStream,createWriteStream,existsSync,mkdirSync,statSync,unlinkSync,openSync,readSync,closeSync,writeFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import path from 'node:path';
import {Readable} from 'node:stream';
import {pipeline} from 'node:stream/promises';

/**
 * Private file storage on a local volume. Keys are random and carry no tenant
 * data, so a leaked key reveals nothing and every read still goes through the
 * access check in /api/files. In Docker the directory is a named volume that
 * the backup job copies alongside the database.
 */
// The ignore hints keep Next from tracing the whole project (and every stored video) into the build.
export function filesDirectory(){return path.resolve(/*turbopackIgnore: true*/ process.env.FILES_DIR??'data/files');}

function resolveKey(key:string){
 if(!/^[a-f0-9-]{36}$/.test(key))throw new Error('bad key');
 return path.join(/*turbopackIgnore: true*/ filesDirectory(),key.slice(0,2),key);
}

export const LIMITS={file:100*1024*1024,video:1024*1024*1024,image:5*1024*1024};

export class TooLarge extends Error {}

/** Streams a request body to disk, refusing to write past the limit. */
export async function writeStream(body:ReadableStream<Uint8Array>,limit:number){
 const key=randomUUID(),file=resolveKey(key);
 mkdirSync(path.dirname(file),{recursive:true});
 let size=0;
 const source=Readable.fromWeb(body as never);
 source.on('data',(chunk:Buffer)=>{size+=chunk.length;if(size>limit)source.destroy(new TooLarge());});
 try{await pipeline(source,createWriteStream(file));}
 catch(e){try{unlinkSync(file);}catch{}throw e;}
 return {key,size};
}

export function head(key:string,bytes=64){
 const fd=openSync(resolveKey(key),'r');
 try{const buf=Buffer.alloc(bytes);const n=readSync(fd,buf,0,bytes,0);return buf.subarray(0,n);}finally{closeSync(fd);}
}

export function sizeOf(key:string){return statSync(resolveKey(key)).size;}
export function exists(key:string){try{return existsSync(resolveKey(key));}catch{return false;}}
export function remove(key:string){try{unlinkSync(resolveKey(key));}catch{}}

export function readStream(key:string,range?:{start:number;end:number}){
 return createReadStream(resolveKey(key),range);
}

/** Parses a single byte range header against a known size. Multi range requests are served whole. */
export function parseRange(header:string|null,size:number){
 const m=header?.match(/^bytes=(\d*)-(\d*)$/);
 if(!m||(!m[1]&&!m[2]))return null;
 let start=m[1]?Number(m[1]):size-Number(m[2]);let end=m[1]&&m[2]?Number(m[2]):size-1;
 if(!m[1]){start=Math.max(0,start);end=size-1;}
 if(start>end||start>=size)return 'invalid' as const;
 return {start,end:Math.min(end,size-1)};
}

/** Stores bytes already in memory, for seeds and generated files. */
export function writeBuffer(bytes: Buffer) {
  const key = randomUUID(), file = resolveKey(key);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, bytes);
  return { key, size: bytes.length };
}
