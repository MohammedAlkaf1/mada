import { NextRequest, NextResponse } from 'next/server';
import { actor } from '@/lib/access';
import { db } from '@/lib/db';
import { certificateHtml } from '@/lib/certificate-document';
import { renderPdf } from '@/lib/pdf';
import { captureError } from '@/lib/errors';

export const dynamic = 'force-dynamic';

/**
 * GET /api/certificates/:id/pdf
 *
 * The holder downloads their own certificate; an administrator any in the
 * workspace, an instructor those of the courses they teach. Downloading again
 * never issues a new number (FR-14). A revoked certificate is no longer
 * handed to its holder as a valid document, and staff receive it stamped
 * as revoked (FR-15).
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: 'notFound' }, { status: 404 });
  let a;
  try {
    a = await actor();
  } catch {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const c = await db.certificate.findFirst({ where: { id, tenantId: a.tenantId }, include: { enrollment: { include: { courseVersion: { include: { course: { select: { instructorIds: true } } } } } } } });
  if (!c) return NextResponse.json({ error: 'notFound' }, { status: 404 });
  const own = c.enrollment.membershipId === a.membershipId;
  const staff = a.role === 'Admin' || (a.role === 'Instructor' && c.enrollment.courseVersion.course.instructorIds.includes(a.userId));
  if (!own && !staff) return NextResponse.json({ error: 'notFound' }, { status: 404 });
  if (c.status !== 'Valid' && !staff) return NextResponse.json({ error: 'revoked' }, { status: 410 });

  const tenant = await db.tenant.findUniqueOrThrow({ where: { id: a.tenantId }, select: { brandColor: true, logo: true, logoMime: true } });
  const html = await certificateHtml({ ...c, brandColor: tenant.brandColor, logo: tenant.logo && tenant.logoMime ? { mime: tenant.logoMime, data: Buffer.from(tenant.logo) } : null });
  await db.audit.create({ data: { tenantId: a.tenantId, actorId: a.userId, action: 'certificate.download', entityId: c.id, detail: { serial: c.serial, own }, correlationId: a.correlationId } });

  if (request.nextUrl.searchParams.get('format') === 'html') {
    return new NextResponse(html, { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });
  }
  try {
    const pdf = await renderPdf(html, { landscape: true, bleed: true });
    return new NextResponse(new Uint8Array(pdf), {
      headers: { 'content-type': 'application/pdf', 'content-disposition': `inline; filename="certificate-${c.serial}.pdf"`, 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' },
    });
  } catch (error) {
    await captureError(error, { source: 'api', path: '/api/certificates/pdf', context: { serial: c.serial } });
    // No browser on this host: the printable page still lets the holder save it as PDF from their own browser.
    return new NextResponse(html, { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'x-pdf-fallback': 'html' } });
  }
}
