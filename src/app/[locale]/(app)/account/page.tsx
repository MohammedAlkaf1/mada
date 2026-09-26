import { AccountView } from '@/components/views/settings-view';
import { pageState, pageTitle } from '@/lib/guard';
import { db } from '@/lib/db';

type Props = { params: Promise<{ locale: string }> };

export const generateMetadata = ({ params }: Props) => pageTitle(params, 'account');

export default async function AccountPage({ params }: Props) {
  const { actor } = await pageState(params);
  const user = await db.user.findUniqueOrThrow({ where: { id: actor.userId }, select: { name: true, email: true, reminders: true, mfaEnabled: true } });
  return <AccountView {...user} />;
}
