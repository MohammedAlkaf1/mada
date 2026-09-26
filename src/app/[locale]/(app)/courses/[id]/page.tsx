import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { CourseEditor } from '@/components/views/course-editor';
import { AccessDenied } from '@/components/shell/access-denied';
import { orNotFound, pageState, pageTitle } from '@/lib/guard';
import { assignOptions, courseEditor, courseEnrollments } from '@/lib/queries';

type Props = { params: Promise<{ locale: string; id: string }>; searchParams: Promise<{ v?: string }> };

export const generateMetadata = ({ params }: Props) => pageTitle(params, 'courses');

export default async function CoursePage({ params, searchParams }: Props) {
  const { locale, actor, permitted } = await pageState(params, ['Admin', 'Instructor']);
  if (!permitted) return <AccessDenied locale={locale} role={actor.role} />;
  const [{ id }, { v }] = await Promise.all([params, searchParams]);
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const [data, enrollments, assign] = await Promise.all([
    orNotFound(courseEditor(actor, id, v && /^[0-9a-f-]{36}$/.test(v) ? v : undefined)),
    courseEnrollments(actor, id),
    actor.role === 'Admin' ? assignOptions(actor) : Promise.resolve(null),
  ]);
  return (
    <Suspense>
      <CourseEditor key={data.version.id} data={data} role={actor.role} enrollments={enrollments} assign={assign} />
    </Suspense>
  );
}
