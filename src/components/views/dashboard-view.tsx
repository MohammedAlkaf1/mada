'use client';

import Link from 'next/link';
import { AlertTriangle, BookOpen, CheckCircle2, Circle, GraduationCap, Hourglass, Plus, Users } from 'lucide-react';
import { useApp } from '@/components/app-provider';
import { Badge, Button, Card, EmptyState, PageHeader, Progress, SectionHeader, StatusBadge, Table, Td, Th, Tr, cx } from '@/components/ui';
import { formatDate, formatNumber, formatPercent } from '@/lib/format';
import { ratio } from '@/lib/domain';
import type { ShellState, StaffDashboard } from '@/lib/types';

type Dashboard = StaffDashboard;

function Stat({ label, value, sub, icon, tone }: { label: string; value: string; sub?: string; icon: React.ReactNode; tone?: 'caution' | 'positive' }) {
  return (
    <Card className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2 text-[12.5px] font-medium text-[var(--text-muted)]">
        {label}
        <span className={cx('flex size-7 items-center justify-center rounded-lg', tone === 'caution' ? 'bg-caution-soft text-caution' : tone === 'positive' ? 'bg-positive-soft text-positive' : 'bg-copper-100 text-copper-700')}>{icon}</span>
      </div>
      <p className="text-[26px] font-semibold leading-none tabular-nums tracking-tight">{value}</p>
      {sub ? <p className="text-[12px] text-[var(--text-faint)]">{sub}</p> : null}
    </Card>
  );
}

/** Two bars per week. Heights share one scale so the weeks compare honestly. */
function WeeklyBars({ weeks }: { weeks: Dashboard['weeks'] }) {
  const { t, locale } = useApp();
  const max = Math.max(1, ...weeks.flatMap((w) => [w.assigned, w.completed]));
  return (
    <div>
      <div className="flex h-40 items-end gap-2 sm:gap-3" role="img" aria-label={t.dash.weeklyHint}>
        {weeks.map((w) => (
          <div key={w.end} className="flex h-full min-w-0 flex-1 flex-col justify-end">
            <div className="flex h-full items-end justify-center gap-1">
              <span className="w-full max-w-4 rounded-t bg-navy-300" style={{ height: `${(w.assigned / max) * 100}%`, minHeight: w.assigned ? 3 : 0 }} title={`${t.dash.assigned}: ${w.assigned}`} />
              <span className="w-full max-w-4 rounded-t bg-copper-600" style={{ height: `${(w.completed / max) * 100}%`, minHeight: w.completed ? 3 : 0 }} title={`${t.dash.completions}: ${w.completed}`} />
            </div>
            <span className="mt-2 truncate text-center text-[10.5px] tabular-nums text-[var(--text-faint)]">{new Intl.DateTimeFormat(locale === 'ar' ? 'ar-SA-u-nu-latn-ca-gregory' : 'en-GB', { day: 'numeric', month: 'numeric', timeZone: 'Asia/Riyadh' }).format(new Date(w.end))}</span>
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center gap-4 text-[12px] text-[var(--text-muted)]">
        <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-navy-300" />{t.dash.assigned}</span>
        <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-copper-600" />{t.dash.completions}</span>
      </div>
    </div>
  );
}

export function DashboardView({ shell, data }: { shell: ShellState; data: Dashboard }) {
  const { t, locale } = useApp();
  const base = `/${locale}`;
  const admin = shell.actor.role === 'Admin';
  const x = data.totals;
  const current = x.enrolled;
  const learners = data.members.Learner ?? 0;
  const staff = (data.members.Admin ?? 0) + (data.members.Instructor ?? 0);
  const first = shell.actor.name.split(' ')[0];

  const steps = admin
    ? [
        { done: shell.tenant.hasLogo, label: t.dash.setupSteps.brand, href: '/settings' },
        { done: learners > 0, label: t.dash.setupSteps.people, href: '/people' },
        { done: x.published > 0, label: t.dash.setupSteps.course, href: '/courses' },
        { done: current > 0, label: t.dash.setupSteps.assign, href: '/courses' },
      ]
    : [];
  const setupLeft = steps.filter((s) => !s.done).length;

  return (
    <>
      <PageHeader
        title={`${t.dash.greeting} ${first}`}
        subtitle={admin ? t.dash.adminSubtitle : t.dash.instructorSubtitle}
        action={
          <Link href={`${base}/courses?new=1`}>
            <Button icon={<Plus size={16} />}>{t.course.create}</Button>
          </Link>
        }
      />

      {admin && setupLeft > 0 ? (
        <Card className="mb-4">
          <SectionHeader title={t.dash.setupTitle} />
          <ol className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {steps.map((s, i) => (
              <li key={s.label}>
                <Link href={`${base}${s.href}`} className={cx('flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-[13px] transition-colors hover:bg-[var(--surface-sunken)]', s.done ? 'border-positive/25 text-[var(--text-muted)]' : 'border-[var(--line-strong)]')}>
                  {s.done ? <CheckCircle2 size={17} className="shrink-0 text-positive" /> : <span className="flex size-[17px] shrink-0 items-center justify-center rounded-full border border-copper-600 text-[10px] font-semibold text-copper-700">{i + 1}</span>}
                  <span className={s.done ? 'line-through decoration-[var(--line-strong)]' : ''}>{s.label}</span>
                </Link>
              </li>
            ))}
          </ol>
        </Card>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label={t.dash.enrolled} value={formatNumber(current, locale)} sub={`${formatNumber(x.notStarted, locale)} ${t.dash.notStarted} · ${formatNumber(x.inProgress, locale)} ${t.dash.inProgress}`} icon={<GraduationCap size={15} />} />
        <Stat label={t.dash.completionRate} value={formatPercent(ratio(x.completed, current), locale)} sub={t.dash.completionHint} icon={<CheckCircle2 size={15} />} tone="positive" />
        <Stat label={t.dash.overdue} value={formatNumber(x.overdue, locale)} sub={`${formatNumber(x.completed, locale)} ${t.dash.completed}`} icon={<Hourglass size={15} />} tone={x.overdue ? 'caution' : undefined} />
        {admin ? (
          <Stat label={t.dash.learners} value={formatNumber(learners, locale)} sub={`${formatNumber(staff, locale)} ${t.dash.staff} · ${formatNumber(x.groups, locale)} ${t.dash.groups}`} icon={<Users size={15} />} />
        ) : (
          <Stat label={t.dash.courses} value={formatNumber(x.courses, locale)} sub={`${formatNumber(x.published, locale)} ${t.dash.publishedOf} ${formatNumber(x.courses, locale)}`} icon={<BookOpen size={15} />} />
        )}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2" padded={false}>
          <div className="px-5 pt-5">
            <SectionHeader title={t.dash.byCourse} hint={t.dash.byCourseHint} />
          </div>
          {data.byCourse.length === 0 ? (
            <EmptyState
              title={t.dash.noCourses}
              hint={t.dash.noCoursesHint}
              icon={<BookOpen size={19} />}
              action={<Link href={`${base}/courses?new=1`}><Button variant="secondary" icon={<Plus size={15} />}>{t.dash.createFirst}</Button></Link>}
            />
          ) : (
            <Table className="mt-3">
              <thead>
                <tr>
                  <Th>{t.report.course}</Th>
                  <Th className="text-center">{t.course.enrolled}</Th>
                  <Th>{t.dash.completionRate}</Th>
                  <Th className="text-center">{t.dash.overdue}</Th>
                </tr>
              </thead>
              <tbody>
                {data.byCourse.slice(0, 8).map((c) => {
                  const rate = ratio(c.completed, c.enrolled);
                  return (
                    <Tr key={c.id}>
                      <Td>
                        <Link href={`${base}/courses/${c.id}`} className="font-medium hover:underline">{c.title}</Link>
                        <div className="mt-1"><StatusBadge status={c.status} label={t.statuses[c.status as keyof typeof t.statuses] ?? c.status} /></div>
                      </Td>
                      <Td className="text-center tabular-nums">{formatNumber(c.enrolled, locale)}</Td>
                      <Td className="min-w-40">
                        <div className="flex items-center gap-2.5">
                          <Progress value={rate ?? 0} tone="positive" />
                          <span className="w-11 shrink-0 text-end text-[12.5px] tabular-nums text-[var(--text-muted)]">{formatPercent(rate, locale)}</span>
                        </div>
                      </Td>
                      <Td className="text-center">
                        {c.overdue ? <Badge tone="caution"><AlertTriangle size={11} />{formatNumber(c.overdue, locale)}</Badge> : <span className="text-[var(--text-faint)]">0</span>}
                      </Td>
                    </Tr>
                  );
                })}
              </tbody>
            </Table>
          )}
        </Card>

        <Card>
          <SectionHeader title={t.dash.weekly} hint={t.dash.weeklyHint} />
          <div className="mt-5"><WeeklyBars weeks={data.weeks} /></div>
        </Card>
      </div>

      <Card className="mt-4">
        <SectionHeader title={t.dash.recent} action={<Link href={`${base}/reports`} className="text-[13px] font-medium text-copper-700 hover:underline">{t.common.viewAll}</Link>} />
        {data.recent.length === 0 ? (
          <p className="mt-4 flex items-center gap-2 text-[13px] text-[var(--text-faint)]"><Circle size={12} />{t.common.empty}</p>
        ) : (
          <ul className="mt-3 divide-y divide-[var(--line-soft)]">
            {data.recent.map((e) => (
              <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-[13px]">
                <span className="min-w-0"><span className="font-medium">{e.name}</span> <span className="text-[var(--text-muted)]">· {e.courseTitle}</span></span>
                <span className="text-[12px] tabular-nums text-[var(--text-faint)]">{formatDate(e.completedAt, locale)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
