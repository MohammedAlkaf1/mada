import 'dotenv/config';
import { Client } from 'pg';
import { createHash, createDecipheriv } from 'node:crypto';

function unsealSafe(value, authSecret) {
  try {
    const k = createHash('sha256').update(authSecret).digest();
    const b = Buffer.from(value, 'base64');
    const d = createDecipheriv('aes-256-gcm', k, b.subarray(0, 12));
    d.setAuthTag(b.subarray(12, 28));
    Buffer.concat([d.update(b.subarray(28)), d.final()]);
    return true;
  } catch {
    return false;
  }
}

const email = process.argv[2];
if (!email) {
  console.log('Usage: node scripts/diagnose-2fa-raw.mjs <email>');
  process.exit(1);
}

console.log('NODE_ENV =', process.env.NODE_ENV ?? 'MISSING');
console.log('AUTH_SECRET =', process.env.AUTH_SECRET ? 'PRESENT' : 'MISSING');
console.log(
  'AUTH_SECRET trailing whitespace =',
  process.env.AUTH_SECRET !== process.env.AUTH_SECRET?.trim() ? 'YES (BUG)' : 'no',
);
console.log('DATABASE_URL =', process.env.DATABASE_URL ? 'PRESENT' : 'MISSING');
console.log('Server time (UTC) =', new Date().toISOString());
console.log('Server time (epoch ms) =', Date.now());

const client = new Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
const r = await client.query(
  'select active, verified, "mfaEnabled", "mfaSecret" from "User" where email = $1',
  [email],
);
const user = r.rows[0];
console.log('user exists =', !!user);
if (user) {
  console.log('user.active =', user.active);
  console.log('user.verified =', user.verified);
  console.log('mfaEnabled =', user.mfaEnabled);
  console.log('mfaSecret exists =', !!user.mfaSecret);
  if (user.mfaSecret && process.env.AUTH_SECRET) {
    console.log(
      'TOTP_DECRYPTION =',
      unsealSafe(user.mfaSecret, process.env.AUTH_SECRET) ? 'SUCCESS' : 'FAILED (key mismatch)',
    );
  }
}
await client.end();
