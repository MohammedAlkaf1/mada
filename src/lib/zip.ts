import {crc32,deflateRawSync} from 'node:zlib';

/**
 * A minimal ZIP writer for the data package: deflated entries, UTF-8 names,
 * no encryption and no ZIP64, which is plenty for CSV and JSON under 4 GB.
 */
export function zip(entries:{name:string;data:Buffer}[],now=new Date()){
 const time=((now.getHours()<<11)|(now.getMinutes()<<5)|Math.floor(now.getSeconds()/2))&0xffff;
 const date=(((now.getFullYear()-1980)<<9)|((now.getMonth()+1)<<5)|now.getDate())&0xffff;
 const locals:Buffer[]=[],centrals:Buffer[]=[];let offset=0;
 for(const e of entries){
  const name=Buffer.from(e.name,'utf8'),packed=deflateRawSync(e.data),crc=crc32(e.data)>>>0;
  const local=Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50,0);local.writeUInt16LE(20,4);local.writeUInt16LE(0x0800,6);local.writeUInt16LE(8,8);
  local.writeUInt16LE(time,10);local.writeUInt16LE(date,12);local.writeUInt32LE(crc,14);
  local.writeUInt32LE(packed.length,18);local.writeUInt32LE(e.data.length,22);local.writeUInt16LE(name.length,26);local.writeUInt16LE(0,28);
  locals.push(local,name,packed);
  const central=Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50,0);central.writeUInt16LE(20,4);central.writeUInt16LE(20,6);central.writeUInt16LE(0x0800,8);central.writeUInt16LE(8,10);
  central.writeUInt16LE(time,12);central.writeUInt16LE(date,14);central.writeUInt32LE(crc,16);
  central.writeUInt32LE(packed.length,20);central.writeUInt32LE(e.data.length,24);central.writeUInt16LE(name.length,28);
  central.writeUInt32LE(offset,42);
  centrals.push(central,name);
  offset+=local.length+name.length+packed.length;
 }
 const dir=Buffer.concat(centrals),end=Buffer.alloc(22);
 end.writeUInt32LE(0x06054b50,0);end.writeUInt16LE(entries.length,8);end.writeUInt16LE(entries.length,10);
 end.writeUInt32LE(dir.length,12);end.writeUInt32LE(offset,16);
 return Buffer.concat([...locals,dir,end]);
}
