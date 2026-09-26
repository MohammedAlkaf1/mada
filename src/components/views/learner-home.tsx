'use client';

import Link from 'next/link';
import { Award, CalendarClock, Clock, GraduationCap, ListChecks } from 'lucide-react';
import { useApp } from '@/components/app-provider';
import { Badge, Button, Card, EmptyState, PageHeader, Progress, StatusBadge, cx } from '@/components/ui';
import { formatDate, formatNumber } from '@/lib/format';
import { isOverdue, progressPercent } from '@/lib/domain';

export type LearnerItem = {
  id: string;
  status: string;
  startsAt: string;
  dueAt: string | null;
  requiredDone: number;
  requiredTotal: number;
  quizEnabled: boolean;
  quizPassed: boolean;
  completedAt: string | null;
  title: string;
  description: string;
  coverAssetId: string | null;
  estimatedMinutes: number;
  certificate: { id: string; serial: string; status: string } | null;
};

function DueLabel({ item }: { item: LearnerItem }) {
  const { t, locale } = useApp();
  if (item.status === 'Completed') return <span className="text-positive">{t.statuses.Completed} · {formatDate(item.completedAt, locale)}</span>;
  if (new Date(item.startsAt) > new Date()) return <span>{t.learn.startsOn} {formatDate(item.startsAt, locale)}</span>;
  if (!item.dueAt) return <span>{t.learn.noDue}</span>;
  const days = Math.ceil((new Date(item.dueAt).getTime() - Date.now()) / 86_400_000);
  if (isOverdue(item)) return <span className="font-medium text-caution">{t.learn.overdueBy} {formatNumber(Math.abs(days), locale)} {t.learn.days}</span>;
  return <span className={days <= 2 ? 'font-medium text-caution' : ''}>{t.learn.due} {formatDate(item.dueAt, locale)} · {t.learn.dueIn} {formatNumber(days, locale)} {t.learn.days}</span>;
}

export function LearnerHome({ items, name }: { items: LearnerItem[]; name: string }) {
  const { t, locale } = useApp();
  const base = `/${locale}`;
  const active = items.filter((i) => ['NotStarted', 'InProgress'].includes(i.status));
  const done = items.filter((i) => i.status === 'Completed');
  const other = items.filter((i) => i.status === 'Withdrawn');

  const card = (item: LearnerItem) => {
    const pct = progressPercent(item.requiredDone, item.requiredTotal);
    const upcoming = new Date(item.startsAt) > new Date();
    const action = item.status === 'Completed' ? t.learn.review : item.status === 'NotStarted' ? t.learn.start : t.learn.continue;
    return (
      <Card key={item.id} padded={false} className="flex flex-col overflow-hidden">
        <div className="relative h-28 shrink-0 bg-gradient-to-br from-copper-600 to-navy-900">
          {item.coverAssetId ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={`/api/files?id=${item.coverAssetId}`} alt="" className="absolute inset-0 size-full object-cover" />
          ) : (
            <GraduationCap size={34} className="absolute bottom-4 text-white/35 start-5" />
          )}
          <div className="absolute top-3 end-3"><StatusBadge status={item.status} label={t.statuses[item.status as keyof typeof t.statuses] ?? item.status} /></div>
        </div>
        <div className="flex flex-1 flex-col p-4">
          <h3 className="text-[15px] font-semibold leading-snug">{item.title}</h3>
          {item.description ? <p className="mt-1 line-clamp-2 text-[12.5px] text-[var(--text-muted)]">{item.description}</p> : null}
          <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[12px] text-[var(--text-faint)]">
            <span className="flex items-center gap-1"><ListChecks size={13} />{formatNumber(item.requiredDone, locale)} {t.learn.lessonsDone} {formatNumber(item.requiredTotal, locale)}</span>
            {item.estimatedMinutes ? <span className="flex items-center gap-1"><Clock size={13} />{formatNumber(item.estimatedMinutes, locale)} {t.common.minutes}</span> : null}
            {item.quizEnabled ? <span>{t.learn.quizRequired}</span> : null}
          </div>
          <div className="mt-3 flex items-center gap-2.5">
            <Progress value={pct} tone={item.status === 'Completed' ? 'positive' : 'accent'} />
            <span className="w-10 shrink-0 text-end text-[12px] tabular-nums text-[var(--text-muted)]">{pct}%</span>
          </div>
          <p className="mt-3 flex items-center gap-1.5 text-[12.5px] text-[var(--text-muted)]"><CalendarClock size={13} /><DueLabel item={item} /></p>
          <div className="mt-4 flex flex-1 items-end gap-2">
            {upcoming ? (
              <Button variant="ghost" size="sm" disabled>{t.learn.notYet}</Button>
            ) : (
              <Link href={`${base}/learn/${item.id}`}><Button size="sm" variant={item.status === 'Completed' ? 'ghost' : 'secondary'}>{action}</Button></Link>
            )}
            {item.certificate ? (
              <Link href={`${base}/my-certificates`}><Button size="sm" variant="subtle" icon={<Award size={14} />}>{t.learn.viewCertificate}</Button></Link>
            ) : null}
          </div>
        </div>
      </Card>
    );
  };

  return (
    <>
      <PageHeader title={`${t.dash.greeting} ${name.split(' ')[0]}`} subtitle={t.learn.subtitle} />
      {items.length === 0 ? (
        <Card><EmptyState title={t.learn.empty} hint={t.learn.emptyHint} icon={<GraduationCap size={19} />} /></Card>
      ) : (
        <div className="space-y-8">
          {active.length ? <section><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{active.map(card)}</div></section> : null}
          {done.length ? (
            <section>
              <h2 className="mb-3 flex items-center gap-2 text-[14px] font-semibold">{t.statuses.Completed} <Badge tone="positive">{formatNumber(done.length, locale)}</Badge></h2>
              <div className={cx('grid gap-4 sm:grid-cols-2 xl:grid-cols-3')}>{done.map(card)}</div>
            </section>
          ) : null}
          {other.length ? (
            <section>
              <h2 className="mb-3 text-[14px] font-semibold text-[var(--text-muted)]">{t.statuses.Withdrawn}</h2>
              <div className="grid gap-4 opacity-80 sm:grid-cols-2 xl:grid-cols-3">{other.map(card)}</div>
            </section>
          ) : null}
        </div>
      )}
    </>
  );
}
