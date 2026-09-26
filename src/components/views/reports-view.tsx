'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Archive, Download, FileDown, Package } from 'lucide-react';
import { useApp } from '@/components/app-provider';
import { Badge, Button, Card, Checkbox, EmptyState, Input, PageHeader, Progress, SearchInput, SectionHeader, Select, StatusBadge, Table, Td, Th, Tr } from '@/components/ui';
import { Pager } from '@/components/ui/pagination';
import { formatDate, formatDateTime, formatNumber, formatPercent } from '@/lib/format';
import { isOverdue, progressPercent, ratio, type Role } from '@/lib/domain';
import type { EnrollmentRow, ExportRow } from '@/lib/types';

type Data = { enrollments: EnrollmentRow[]; courses: { id: string; title: string; versions: { id: string; number: number }[] }[]; groups: { id: string; name: string; memberIds: string[] }[]; exports: ExportRow[] };
const PAGE = 40;
const STATUSES = ['NotStarted', 'InProgress', 'Completed', 'Withdrawn'] as const;

export function ReportsView({ data, role }: { data: Data; role: Role }) {
  const { t, locale, run, busy } = useApp();
  const [f, setF] = useState({ course: '', version: '', group: '', status: '', from: '', to: '', overdue: false, query: '' });
  const [page, setPage] = useState(0);
  const set = (patch: Partial<typeof f>) => { setF({ ...f, ...patch }); setPage(0); };
  const versions = data.courses.find((c) => c.id === f.course)?.versions ?? [];
  const members = useMemo(() => new Set(data.groups.find((g) => g.id === f.group)?.memberIds ?? []), [data.groups, f.group]);

  // The same filters decide the table and the totals above it, so the numbers always match what is listed (FR-16).
  const list = useMemo(() => data.enrollments.filter((e) =>
    (!f.course || e.courseId === f.course) && (!f.version || e.versionId === f.version) && (!f.group || members.has(e.membershipId)) &&
    (!f.status || e.status === f.status) && (!f.from || e.createdAt >= new Date(f.from).toISOString()) && (!f.to || e.createdAt <= new Date(`${f.to}T23:59:59`).toISOString()) &&
    (!f.overdue || isOverdue(e)) && (!f.query || `${e.name} ${e.email}`.toLowerCase().includes(f.query.toLowerCase()))), [data.enrollments, f, members]);

  const counted = list.filter((e) => e.status !== 'Withdrawn');
  const totals = { enrolled: counted.length, started: counted.filter((e) => e.status !== 'NotStarted').length, completed: counted.filter((e) => e.status === 'Completed').length, overdue: counted.filter((e) => isOverdue(e)).length, withdrawn: list.length - counted.length };

  async function exportType(type: 'enrollments' | 'members' | 'certificates' | 'package') {
    const r = (await run('export.request', { type, ...(f.course && type !== 'members' && type !== 'package' ? { courseId: f.course } : {}), ...(f.group && type === 'enrollments' ? { groupId: f.group } : {}) }, { silent: true, refresh: true })) as { href: string } | null;
    if (r) window.location.href = r.href;
  }

  return (
    <>
      <PageHeader title={t.report.title} subtitle={t.report.subtitle} action={
        <>
          <Button variant="ghost" icon={<FileDown size={15} />} loading={busy} onClick={() => exportType('enrollments')}>{t.report.exportCsv}</Button>
          <Button variant="ghost" icon={<FileDown size={15} />} onClick={() => exportType('certificates')}>{t.report.exportCertificates}</Button>
          {role === 'Admin' ? <Button variant="ghost" icon={<FileDown size={15} />} onClick={() => exportType('members')}>{t.report.exportMembers}</Button> : null}
        </>
      } />

      <Card className="mb-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Select value={f.course} onChange={(e) => set({ course: e.target.value, version: '' })}><option value="">{t.report.allCourses}</option>{data.courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}</Select>
          <Select value={f.version} disabled={!f.course} onChange={(e) => set({ version: e.target.value })}><option value="">{t.report.allVersions}</option>{versions.map((v) => <option key={v.id} value={v.id}>{t.course.version} {v.number}</option>)}</Select>
          {data.groups.length ? <Select value={f.group} onChange={(e) => set({ group: e.target.value })}><option value="">{t.report.allGroups}</option>{data.groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}</Select> : null}
          <Select value={f.status} onChange={(e) => set({ status: e.target.value })}><option value="">{t.report.allStatuses}</option>{STATUSES.map((s) => <option key={s} value={s}>{t.statuses[s]}</option>)}</Select>
          <label className="flex items-center gap-2 text-[12.5px] text-[var(--text-muted)]"><span className="shrink-0">{t.common.dateFrom}</span><Input type="date" value={f.from} onChange={(e) => set({ from: e.target.value })} /></label>
          <label className="flex items-center gap-2 text-[12.5px] text-[var(--text-muted)]"><span className="shrink-0">{t.common.dateTo}</span><Input type="date" value={f.to} onChange={(e) => set({ to: e.target.value })} /></label>
          <SearchInput value={f.query} onChange={(v) => set({ query: v })} placeholder={t.common.searchPlaceholder} />
          <Checkbox className="self-center" label={t.report.onlyOverdue} checked={f.overdue} onChange={(e) => set({ overdue: e.target.checked })} />
        </div>
      </Card>

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {[
          { label: t.dash.enrolled, value: formatNumber(totals.enrolled, locale) },
          { label: t.dash.inProgress, value: formatNumber(totals.started, locale) },
          { label: t.dash.completionRate, value: formatPercent(ratio(totals.completed, totals.enrolled), locale), sub: `${formatNumber(totals.completed, locale)} ${t.dash.completed}` },
          { label: t.dash.overdue, value: formatNumber(totals.overdue, locale) },
          { label: t.statuses.Withdrawn, value: formatNumber(totals.withdrawn, locale), sub: t.report.withdrawnNote },
        ].map((x) => (
          <Card key={x.label} className="py-4">
            <p className="text-[12px] text-[var(--text-muted)]">{x.label}</p>
            <p className="mt-1 text-xl font-semibold tabular-nums">{x.value}</p>
            {x.sub ? <p className="mt-1 text-[11px] leading-snug text-[var(--text-faint)]">{x.sub}</p> : null}
          </Card>
        ))}
      </div>

      <Card padded={false}>
        {list.length === 0 ? (
          <EmptyState title={t.common.empty} icon={<Archive size={19} />} />
        ) : (
          <>
            <Table>
              <thead><tr><Th>{t.report.learner}</Th><Th>{t.report.course}</Th><Th>{t.report.assignedOn}</Th><Th>{t.report.due}</Th><Th>{t.common.status}</Th><Th>{t.report.progress}</Th><Th>{t.report.score}</Th><Th>{t.report.certificate}</Th></tr></thead>
              <tbody>
                {list.slice(page * PAGE, page * PAGE + PAGE).map((e) => {
                  const pct = progressPercent(e.requiredDone, e.requiredTotal);
                  return (
                    <Tr key={e.id}>
                      <Td>{role === 'Admin' ? <Link href={`/${locale}/people/${e.membershipId}`} className="block font-medium hover:underline">{e.name}</Link> : <span className="block font-medium">{e.name}</span>}<span className="block text-[11.5px] text-[var(--text-faint)]" dir="ltr">{e.email}</span></Td>
                      <Td className="max-w-52"><span className="block truncate">{e.courseTitle}</span><span className="text-[11px] text-[var(--text-faint)]">{t.course.version} {e.versionNumber}</span></Td>
                      <Td className="text-[12.5px] tabular-nums">{formatDate(e.createdAt, locale)}</Td>
                      <Td className="text-[12.5px] tabular-nums">{e.dueAt ? formatDate(e.dueAt, locale) : '…'}</Td>
                      <Td><div className="flex flex-wrap gap-1"><StatusBadge status={e.status} label={t.statuses[e.status as keyof typeof t.statuses] ?? e.status} />{isOverdue(e) ? <Badge tone="caution">{t.common.overdue}</Badge> : null}</div></Td>
                      <Td className="min-w-32"><div className="flex items-center gap-2"><Progress value={pct} tone={e.status === 'Completed' ? 'positive' : 'accent'} /><span className="w-9 text-end text-[12px] tabular-nums">{pct}%</span></div></Td>
                      <Td className="tabular-nums">{e.bestScore === null ? '…' : `${formatNumber(e.bestScore, locale, 1)}%`}</Td>
                      <Td className="text-[12px]">{e.certificate ? <StatusBadge status={e.certificate.status} label={e.certificate.status === 'Valid' ? t.certificate.valid : t.certificate.revoked} /> : '…'}</Td>
                    </Tr>
                  );
                })}
              </tbody>
            </Table>
            <Pager page={page} pageSize={PAGE} total={list.length} onChange={setPage} />
          </>
        )}
      </Card>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {role === 'Admin' ? (
          <Card>
            <SectionHeader title={t.report.package} hint={t.report.packageHint} />
            <Button className="mt-4" variant="secondary" icon={<Package size={15} />} loading={busy} onClick={() => exportType('package')}>{t.common.download}</Button>
          </Card>
        ) : null}
        <Card padded={false} className={role === 'Admin' ? '' : 'lg:col-span-2'}>
          <div className="px-5 pt-5"><SectionHeader title={t.report.exports} /></div>
          {data.exports.length === 0 ? <p className="px-5 py-5 text-[13px] text-[var(--text-faint)]">{t.common.empty}</p> : (
            <ul className="mt-2 divide-y divide-[var(--line-soft)]">
              {data.exports.map((x) => {
                const expired = new Date(x.expiresAt) < new Date();
                return (
                  <li key={x.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-2.5 text-[13px]">
                    <span><span className="font-medium">{t.report.exportTypes[x.type as keyof typeof t.report.exportTypes] ?? x.type}</span> <span className="text-[var(--text-faint)]">· {formatDateTime(x.createdAt, locale)} · {formatNumber(x.rows, locale)} {t.report.rows}</span></span>
                    {x.status !== 'Ready' ? <StatusBadge status={x.status} label={t.statuses[x.status as keyof typeof t.statuses] ?? x.status} /> : expired ? <span className="text-[12px] text-[var(--text-faint)]">{t.report.expired}</span> : <a href={`/api/export?job=${x.id}`} className="flex items-center gap-1.5 font-medium text-copper-700 hover:underline"><Download size={14} />{t.common.download}</a>}
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
