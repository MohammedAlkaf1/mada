'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { AlertTriangle, BookOpen, GraduationCap, Plus, Users } from 'lucide-react';
import { useApp } from '@/components/app-provider';
import { Badge, Button, Card, Checkbox, EmptyState, Field, Input, Modal, PageHeader, SearchInput, StatusBadge, Textarea } from '@/components/ui';
import { formatNumber } from '@/lib/format';
import type { CourseRow } from '@/lib/types';

export function CreateCourseModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t, locale, run, busy } = useApp();
  const router = useRouter();
  const [form, setForm] = useState({ title: '', category: '', description: '' });
  async function submit() {
    const r = (await run('course.create', form)) as { id: string } | null;
    if (r) {
      onClose();
      router.push(`/${locale}/courses/${r.id}`);
    }
  }
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t.course.createTitle}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>{t.common.cancel}</Button>
          <Button loading={busy} disabled={!form.title.trim()} onClick={submit}>{t.common.create}</Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label={t.course.name} required>
          <Input value={form.title} maxLength={200} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        </Field>
        <Field label={t.course.category} hint={t.course.categoryHint}>
          <Input value={form.category} maxLength={80} onChange={(e) => setForm({ ...form, category: e.target.value })} />
        </Field>
        <Field label={t.course.description}>
          <Textarea rows={3} value={form.description} maxLength={4000} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </Field>
      </div>
    </Modal>
  );
}

export function CoursesView({ courses }: { courses: CourseRow[] }) {
  const { t, locale } = useApp();
  const params = useSearchParams();
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [query, setQuery] = useState('');
  const [archived, setArchived] = useState(false);
  const base = `/${locale}`;

  // The dashboard links here with ?new=1 to open the form straight away.
  useEffect(() => {
    if (params.get('new') === '1') {
      setCreating(true);
      router.replace(`${base}/courses`);
    }
  }, [params, router, base]);

  const list = useMemo(
    () =>
      courses.filter(
        (c) => (archived ? true : !c.archivedAt) && (!query || `${c.title} ${c.category}`.toLowerCase().includes(query.toLowerCase())),
      ),
    [courses, query, archived],
  );

  return (
    <>
      <PageHeader
        title={t.course.title}
        subtitle={t.course.subtitle}
        action={<Button icon={<Plus size={16} />} onClick={() => setCreating(true)}>{t.course.create}</Button>}
      />
      <CreateCourseModal open={creating} onClose={() => setCreating(false)} />

      {courses.length === 0 ? (
        <Card>
          <EmptyState
            title={t.course.noCourses}
            hint={t.course.noCoursesHint}
            icon={<BookOpen size={19} />}
            action={<Button variant="secondary" icon={<Plus size={15} />} onClick={() => setCreating(true)}>{t.dash.createFirst}</Button>}
          />
        </Card>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <SearchInput value={query} onChange={setQuery} placeholder={t.common.search} className="w-full max-w-xs" />
            {courses.some((c) => c.archivedAt) ? <Checkbox label={t.course.showArchived} checked={archived} onChange={(e) => setArchived(e.target.checked)} /> : null}
          </div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {list.map((c) => (
              <Link key={c.id} href={`${base}/courses/${c.id}`} className="group">
                <Card padded={false} className="flex h-full flex-col overflow-hidden transition-shadow group-hover:shadow-[var(--shadow-raised)]">
                  <div className="relative h-24 shrink-0 bg-gradient-to-br from-copper-600 to-navy-900">
                    {c.latest.coverAssetId ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={`/api/files?id=${c.latest.coverAssetId}`} alt="" className="absolute inset-0 size-full object-cover" />
                    ) : (
                      <GraduationCap size={30} className="absolute bottom-3 text-white/35 start-4" />
                    )}
                  </div>
                  <div className="flex flex-1 flex-col p-4">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {c.archivedAt ? (
                        <Badge>{t.course.archived}</Badge>
                      ) : (
                        <StatusBadge status={c.latest.status} label={`${t.course.versionStatus[c.latest.status as keyof typeof t.course.versionStatus] ?? c.latest.status} · ${t.course.version} ${c.latest.number}`} />
                      )}
                      {c.category ? <Badge tone="accent">{c.category}</Badge> : null}
                    </div>
                    <h3 className="mt-2.5 text-[15px] font-semibold leading-snug">{c.title}</h3>
                    <div className="mt-auto flex flex-wrap gap-x-4 gap-y-1 pt-4 text-[12.5px] text-[var(--text-muted)]">
                      <span className="flex items-center gap-1"><BookOpen size={13} />{formatNumber(c.lessons, locale)} {t.course.lessons}</span>
                      <span className="flex items-center gap-1"><Users size={13} />{formatNumber(c.enrolled, locale)} {t.course.enrolled}</span>
                      <span>{formatNumber(c.completed, locale)} {t.course.completed}</span>
                      {c.overdue ? <span className="flex items-center gap-1 text-caution"><AlertTriangle size={12} />{formatNumber(c.overdue, locale)} {t.common.overdue}</span> : null}
                    </div>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        </>
      )}
    </>
  );
}
