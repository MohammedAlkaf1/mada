import { SettingsView } from '@/components/views/settings-view';
import { AccessDenied } from '@/components/shell/access-denied';
import { pageState, pageTitle } from '@/lib/guard';
import { settings } from '@/lib/queries';

type Props = { params: Promise<{ locale: string }> };

export const generateMetadata = ({ params }: Props) => pageTitle(params, 'settings');

export default async function SettingsPage({ params }: Props) {
  const { locale, actor, permitted } = await pageState(params, ['Admin']);
  if (!permitted) return <AccessDenied locale={locale} role={actor.role} />;
  return <SettingsView data={await settings(actor)} />;
}
