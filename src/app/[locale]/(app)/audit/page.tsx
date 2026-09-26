import { AuditView } from '@/components/views/audit-view';
import { AccessDenied } from '@/components/shell/access-denied';
import { pageState, pageTitle } from '@/lib/guard';
import { auditLog } from '@/lib/queries';

type Props = { params: Promise<{ locale: string }>; searchParams: Promise<{ page?: string }> };

export const generateMetadata = ({ params }: Props) => pageTitle(params, 'audit');

export default async function AuditPage({ params, searchParams }: Props) {
  const { locale, actor, permitted } = await pageState(params, ['Admin']);
  if (!permitted) return <AccessDenied locale={locale} role={actor.role} />;
  const page = Math.max(0, Math.min(10000, Number((await searchParams).page ?? 0) || 0));
  return <AuditView {...await auditLog(actor, page)} />;
}
