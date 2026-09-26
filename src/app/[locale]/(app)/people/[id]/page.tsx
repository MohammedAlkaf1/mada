import { notFound } from 'next/navigation';
import { MemberReport } from '@/components/views/member-report';
import { AccessDenied } from '@/components/shell/access-denied';
import { orNotFound, pageState, pageTitle } from '@/lib/guard';
import { memberDetail } from '@/lib/queries';

type Props = { params: Promise<{ locale: string; id: string }> };

export const generateMetadata = ({ params }: Props) => pageTitle(params, 'people');

export default async function MemberPage({ params }: Props) {
  const { locale, actor, permitted } = await pageState(params, ['Admin']);
  if (!permitted) return <AccessDenied locale={locale} role={actor.role} />;
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  return <MemberReport {...await orNotFound(memberDetail(actor, id))} />;
}
