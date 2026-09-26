import { ReviewQueue } from '@/components/views/review-view';
import { AccessDenied } from '@/components/shell/access-denied';
import { pageState, pageTitle } from '@/lib/guard';
import { reviewQueue } from '@/lib/queries';

type Props = { params: Promise<{ locale: string }> };

export const generateMetadata = ({ params }: Props) => pageTitle(params, 'review');

export default async function ReviewPage({ params }: Props) {
  const { locale, actor, permitted } = await pageState(params, ['Admin', 'Instructor']);
  if (!permitted) return <AccessDenied locale={locale} role={actor.role} />;
  return <ReviewQueue rows={await reviewQueue(actor)} />;
}
