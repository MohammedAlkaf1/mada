import { Suspense } from 'react';
import { CoursesView } from '@/components/views/courses-view';
import { AccessDenied } from '@/components/shell/access-denied';
import { pageState, pageTitle } from '@/lib/guard';
import { courseList } from '@/lib/queries';

type Props = { params: Promise<{ locale: string }> };

export const generateMetadata = ({ params }: Props) => pageTitle(params, 'courses');

export default async function CoursesPage({ params }: Props) {
  const { locale, actor, permitted } = await pageState(params, ['Admin', 'Instructor']);
  if (!permitted) return <AccessDenied locale={locale} role={actor.role} />;
  return (
    <Suspense>
      <CoursesView courses={await courseList(actor)} />
    </Suspense>
  );
}
