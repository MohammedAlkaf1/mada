import {existsSync,mkdirSync,writeFileSync} from 'node:fs';
import {randomBytes} from 'node:crypto';
mkdirSync('data',{recursive:true});
if(!existsSync('.env')) {
const secret=randomBytes(32).toString('hex'), password=randomBytes(24).toString('hex');
writeFileSync('.env',`DATABASE_URL=postgresql://postgres:${password}@127.0.0.1:55433/mada\nAUTH_SECRET=${secret}\nAUTH_URL=http://localhost:3100\nAPP_URL=http://localhost:3100\nLOCAL_DATABASE_PASSWORD=${password}\n`);
}
console.log('Local configuration ready.');
