import { LearnerHome } from '@/components/views/learner-home';
import { pageState, pageTitle } from '@/lib/guard';
import { learnerHome } from '@/lib/queries';

type Props = { params: Promise<{ locale: string }> };

export const generateMetadata = ({ params }: Props) => pageTitle(params, 'learning');

export default async function LearnPage({ params }: Props) {
  const { actor } = await pageState(params);
  return <LearnerHome items={await learnerHome(actor)} name={actor.name} />;
}
