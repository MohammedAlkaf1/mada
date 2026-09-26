import { notFound } from 'next/navigation';
import { ReviewForm } from '@/components/views/review-view';
import { AccessDenied } from '@/components/shell/access-denied';
import { orNotFound, pageState, pageTitle } from '@/lib/guard';
import { reviewDetail } from '@/lib/queries';

type Props = { params: Promise<{ locale: string; id: string }> };

export const generateMetadata = ({ params }: Props) => pageTitle(params, 'review');

export default async function ReviewAttemptPage({ params }: Props) {
  const { locale, actor, permitted } = await pageState(params, ['Admin', 'Instructor']);
  if (!permitted) return <AccessDenied locale={locale} role={actor.role} />;
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  return <ReviewForm detail={await orNotFound(reviewDetail(actor, id))} />;
}
