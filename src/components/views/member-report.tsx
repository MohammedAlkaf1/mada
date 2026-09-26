'use client';

import Link from 'next/link';
import { Award, GraduationCap } from 'lucide-react';
import { useApp } from '@/components/app-provider';
import { Badge, Card, EmptyState, PageHeader, Progress, StatusBadge, Table, Td, Th, Tr } from '@/components/ui';
import { formatDate, formatNumber } from '@/lib/format';
import { isOverdue, progressPercent } from '@/lib/domain';
import type { EnrollmentRow } from '@/lib/types';

/** The individual report of FR-16: every assignment of one person with its dates, progress, result and certificate. */
export function MemberReport({ member, enrollments }: { member: { id: string; name: string; email: string; role: string }; enrollments: EnrollmentRow[] }) {
  const { t, locale } = useApp();
  return (
    <>
      <div className="mb-2 text-[13px]"><Link href={`/${locale}/people`} className="text-[var(--text-muted)] hover:underline">{t.people.title}</Link></div>
      <PageHeader title={member.name} subtitle={<span dir="ltr">{member.email}</span>} action={<Badge tone="accent">{t.roles[member.role as keyof typeof t.roles] ?? member.role}</Badge>} />
      <Card padded={false}>
        <div className="px-5 pt-5"><h2 className="text-[15px] font-semibold">{t.report.individual}</h2></div>
        {enrollments.length === 0 ? (
          <EmptyState title={t.common.empty} icon={<GraduationCap size={19} />} />
        ) : (
          <Table className="mt-3">
            <thead><tr><Th>{t.report.course}</Th><Th>{t.report.assignedOn}</Th><Th>{t.report.due}</Th><Th>{t.common.status}</Th><Th>{t.report.progress}</Th><Th>{t.report.score}</Th><Th>{t.report.certificate}</Th></tr></thead>
            <tbody>
              {enrollments.map((e) => {
                const pct = progressPercent(e.requiredDone, e.requiredTotal);
                return (
                  <Tr key={e.id}>
                    <Td><Link href={`/${locale}/courses/${e.courseId}`} className="font-medium hover:underline">{e.courseTitle}</Link><span className="block text-[11px] text-[var(--text-faint)]">{t.course.version} {e.versionNumber}</span></Td>
                    <Td className="text-[12.5px] tabular-nums">{formatDate(e.createdAt, locale)}</Td>
                    <Td className="text-[12.5px] tabular-nums">{e.dueAt ? formatDate(e.dueAt, locale) : '…'}</Td>
                    <Td><div className="flex flex-wrap gap-1"><StatusBadge status={e.status} label={t.statuses[e.status as keyof typeof t.statuses] ?? e.status} />{isOverdue(e) ? <Badge tone="caution">{t.common.overdue}</Badge> : null}</div></Td>
                    <Td className="min-w-32"><div className="flex items-center gap-2"><Progress value={pct} tone={e.status === 'Completed' ? 'positive' : 'accent'} /><span className="w-9 text-end text-[12px] tabular-nums">{pct}%</span></div></Td>
                    <Td className="tabular-nums">{e.bestScore === null ? '…' : `${formatNumber(e.bestScore, locale, 1)}%`}{e.attempts ? <span className="block text-[11px] text-[var(--text-faint)]">{formatNumber(e.attempts, locale)} {t.learn.attempt}</span> : null}</Td>
                    <Td>{e.certificate ? <span className="flex items-center gap-1.5 text-[12.5px]"><Award size={14} className={e.certificate.status === 'Valid' ? 'text-positive' : 'text-critical'} /><span dir="ltr" className="tabular-nums">{e.certificate.serial}</span></span> : '…'}</Td>
                  </Tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </Card>
    </>
  );
}
