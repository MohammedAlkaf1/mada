import { notFound } from 'next/navigation';
import { QuizView } from '@/components/views/quiz-view';
import { orNotFound, pageState, pageTitle } from '@/lib/guard';
import { attemptView } from '@/lib/queries';

type Props = { params: Promise<{ locale: string; id: string; attemptId: string }> };

export const generateMetadata = ({ params }: Props) => pageTitle(params, 'learning');

export default async function QuizPage({ params }: Props) {
  const { actor } = await pageState(params);
  const { attemptId } = await params;
  if (!/^[0-9a-f-]{36}$/.test(attemptId)) notFound();
  const attempt = await orNotFound(attemptView(actor, attemptId));
  return <QuizView key={`${attempt.id}:${attempt.submittedAt ?? ''}`} attempt={attempt} />;
}
