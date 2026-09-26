import { DashboardView } from '@/components/views/dashboard-view';
import { LearnerHome } from '@/components/views/learner-home';
import { pageState } from '@/lib/guard';
import { learnerHome, staffDashboard } from '@/lib/queries';
import { getDictionary, isLocale } from '@/i18n/dictionary';

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  return { title: getDictionary(isLocale(locale) ? locale : 'ar').nav.overview };
}

/** Staff land on the training dashboard; learners land on their own courses. */
export default async function HomePage({ params }: Props) {
  const { shell, actor } = await pageState(params);
  if (actor.role === 'Learner') return <LearnerHome items={await learnerHome(actor)} name={actor.name} />;
  return <DashboardView shell={shell} data={await staffDashboard(actor)} />;
}
