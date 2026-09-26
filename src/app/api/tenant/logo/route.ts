import { NextRequest, NextResponse } from 'next/server';
import { actor, requireRole } from '@/lib/access';
import { db } from '@/lib/db';
import { DomainError } from '@/lib/domain';
import { fileType } from '@/lib/file-scanner';
import { assertFeature } from '@/lib/billing';
import { trustedOrigin } from '@/lib/origin';

const MAX = 1024 * 1024;

function fail(e: unknown) {
  return NextResponse.json({ error: e instanceof DomainError ? e.code : 'server' }, { status: e instanceof DomainError ? e.status : 500 });
}

/** The organization's own logo, for its members. The verification page embeds it separately. */
export async function GET() {
  try {
    const a = await actor();
    const t = await db.tenant.findUnique({ where: { id: a.tenantId }, select: { logo: true, logoMime: true } });
    if (!t?.logo || !t.logoMime) return new NextResponse(null, { status: 404 });
    return new NextResponse(new Uint8Array(t.logo), { headers: { 'content-type': t.logoMime, 'cache-control': 'private, max-age=300', 'x-content-type-options': 'nosniff' } });
  } catch (e) {
    return fail(e);
  }
}

/** A small image kept on the tenant row, so it travels with the database backup. */
export async function PUT(req: NextRequest) {
  try {
    if (!trustedOrigin(req)) throw new DomainError('forbidden', 403);
    const a = await actor();
    requireRole(a, ['Admin']);
    await assertFeature(a.tenantId, 'branding');
    const name = req.nextUrl.searchParams.get('name') ?? '';
    const bytes = Buffer.from(await req.arrayBuffer());
    if (!bytes.length || bytes.length > MAX) throw new DomainError('tooLarge', 413);
    const mime = fileType(bytes, name);
    if (!mime || !mime.startsWith('image/')) throw new DomainError('fileType', 422);
    await db.$transaction([
      db.tenant.update({ where: { id: a.tenantId }, data: { logo: bytes, logoMime: mime } }),
      db.audit.create({ data: { tenantId: a.tenantId, actorId: a.userId, action: 'tenant.logo', entityId: a.tenantId, detail: { size: bytes.length, mime }, correlationId: a.correlationId } }),
    ]);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
