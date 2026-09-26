import { ReportsView } from '@/components/views/reports-view';
import { AccessDenied } from '@/components/shell/access-denied';
import { pageState, pageTitle } from '@/lib/guard';
import { reports } from '@/lib/queries';

type Props = { params: Promise<{ locale: string }> };

export const generateMetadata = ({ params }: Props) => pageTitle(params, 'reports');

export default async function ReportsPage({ params }: Props) {
  const { locale, actor, permitted } = await pageState(params, ['Admin', 'Instructor']);
  if (!permitted) return <AccessDenied locale={locale} role={actor.role} />;
  return <ReportsView data={await reports(actor)} role={actor.role} />;
}
