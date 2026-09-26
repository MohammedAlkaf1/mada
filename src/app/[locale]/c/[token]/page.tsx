import { BadgeCheck, CircleSlash, SearchX } from 'lucide-react';
import { PublicShell } from '@/components/views/public-shell';
import { db } from '@/lib/db';
import { shortName } from '@/lib/domain';
import { formatDate } from '@/lib/format';
import { getDictionary, isLocale, type Locale } from '@/i18n/dictionary';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ locale: string; token: string }> };

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  return { title: getDictionary(isLocale(locale) ? locale : 'ar').certificate.verifyTitle, robots: { index: false } };
}

/**
 * The public verification page (FR-14). The token is random and unguessable;
 * the page shows the issuer, the course, the date, the status and a short
 * form of the holder's name, never an email or any identifier.
 */
export default async function VerifyCertificate({ params }: Props) {
  const { locale: raw, token } = await params;
  const locale: Locale = isLocale(raw) ? raw : 'ar';
  const t = getDictionary(locale);
  const c = /^[A-Za-z0-9_-]{16,40}$/.test(token)
    ? await db.certificate.findUnique({ where: { verifyToken: token }, select: { serial: true, learnerName: true, courseTitle: true, tenantName: true, issuedAt: true, status: true, revokedAt: true, tenantId: true } })
    : null;
  const tenant = c ? await db.tenant.findUnique({ where: { id: c.tenantId }, select: { logo: true, logoMime: true, brandColor: true, status: true } }) : null;

  if (!c || !tenant || tenant.status === 'Closed') {
    return (
      <PublicShell locale={locale} title={t.certificate.verifyTitle}>
        <div className="surface flex flex-col items-center gap-3 px-6 py-10 text-center">
          <SearchX size={30} className="text-[var(--text-faint)]" />
          <p className="text-[15px] font-semibold">{t.certificate.verifyUnknown}</p>
          <p className="text-[13px] text-[var(--text-muted)]">{t.certificate.verifyUnknownHint}</p>
        </div>
      </PublicShell>
    );
  }

  const valid = c.status === 'Valid';
  return (
    <PublicShell locale={locale} title={t.certificate.verifyTitle}>
      <div className="surface overflow-hidden">
        <div className={`flex items-center gap-3 px-5 py-4 ${valid ? 'bg-positive-soft text-positive' : 'bg-critical-soft text-critical'}`}>
          {valid ? <BadgeCheck size={24} /> : <CircleSlash size={24} />}
          <p className="text-[15px] font-semibold">{valid ? t.certificate.verifyValid : t.certificate.verifyRevoked}</p>
        </div>
        <dl className="divide-y divide-[var(--line-soft)] px-5">
          <div className="flex items-center justify-between gap-4 py-3.5">
            <dt className="text-[13px] text-[var(--text-muted)]">{t.certificate.issuer}</dt>
            <dd className="flex items-center gap-2 text-[14px] font-medium">
              {tenant.logo && tenant.logoMime ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={`data:${tenant.logoMime};base64,${Buffer.from(tenant.logo).toString('base64')}`} alt="" className="size-7 rounded object-contain" />
              ) : null}
              {c.tenantName}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-4 py-3.5"><dt className="text-[13px] text-[var(--text-muted)]">{t.certificate.holder}</dt><dd className="text-[14px] font-medium">{shortName(c.learnerName)}</dd></div>
          <div className="flex items-center justify-between gap-4 py-3.5"><dt className="text-[13px] text-[var(--text-muted)]">{t.certificate.course}</dt><dd className="text-end text-[14px] font-medium">{c.courseTitle}</dd></div>
          <div className="flex items-center justify-between gap-4 py-3.5"><dt className="text-[13px] text-[var(--text-muted)]">{t.certificate.issued}</dt><dd className="text-[14px] tabular-nums">{formatDate(c.issuedAt, locale)}</dd></div>
          <div className="flex items-center justify-between gap-4 py-3.5"><dt className="text-[13px] text-[var(--text-muted)]">{t.certificate.serial}</dt><dd className="text-[14px] tabular-nums" dir="ltr">{c.serial}</dd></div>
          {!valid && c.revokedAt ? <div className="flex items-center justify-between gap-4 py-3.5"><dt className="text-[13px] text-[var(--text-muted)]">{t.certificate.revokedOn}</dt><dd className="text-[14px] tabular-nums">{formatDate(c.revokedAt, locale)}</dd></div> : null}
        </dl>
        <p className="border-t border-[var(--line-soft)] px-5 py-3 text-[12px] text-[var(--text-faint)]">{t.certificate.verifyPrivacy}</p>
      </div>
    </PublicShell>
  );
}
