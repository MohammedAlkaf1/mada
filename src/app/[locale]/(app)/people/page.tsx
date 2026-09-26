import { PeopleView } from '@/components/views/people-view';
import { AccessDenied } from '@/components/shell/access-denied';
import { pageState, pageTitle } from '@/lib/guard';
import { people } from '@/lib/queries';
import { billingStateFor } from '@/lib/billing';

type Props = { params: Promise<{ locale: string }> };

export const generateMetadata = ({ params }: Props) => pageTitle(params, 'people');

export default async function PeoplePage({ params }: Props) {
  const { locale, actor, permitted } = await pageState(params, ['Admin']);
  if (!permitted) return <AccessDenied locale={locale} role={actor.role} />;
  const [data, billing] = await Promise.all([people(actor), billingStateFor(actor.tenantId)]);
  return (
    <PeopleView
      {...data}
      selfId={actor.userId}
      seats={billing ? { used: billing.usage.members, limit: billing.limits.maxMembers } : null}
      canImport={!billing || billing.limits.features.includes('import')}
    />
  );
}
