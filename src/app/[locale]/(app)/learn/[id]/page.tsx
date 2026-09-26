import { notFound } from 'next/navigation';
import { CoursePlayer } from '@/components/views/course-player';
import { orNotFound, pageState, pageTitle } from '@/lib/guard';
import { learnerCourse } from '@/lib/queries';

type Props = { params: Promise<{ locale: string; id: string }>; searchParams: Promise<{ l?: string }> };

export const generateMetadata = ({ params }: Props) => pageTitle(params, 'learning');

export default async function LearnCoursePage({ params, searchParams }: Props) {
  const { actor } = await pageState(params);
  const [{ id }, { l }] = await Promise.all([params, searchParams]);
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const data = await orNotFound(learnerCourse(actor, id));
  return <CoursePlayer data={data} lessonId={l} />;
}
