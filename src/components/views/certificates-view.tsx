'use client';

import { useMemo, useState } from 'react';
import { Award, Copy, Download, ExternalLink } from 'lucide-react';
import { useApp } from '@/components/app-provider';
import { Button, Card, EmptyState, Field, Modal, PageHeader, SearchInput, Select, StatusBadge, Table, Td, Textarea, Th, Tr } from '@/components/ui';
import { Pager } from '@/components/ui/pagination';
import { formatDate, formatNumber } from '@/lib/format';
import type { CertificateRow } from '@/lib/types';
import type { Role } from '@/lib/domain';

const PAGE = 25;

function useCopy() {
  const { t, toast } = useApp();
  return (token: string) => {
    const url = `${window.location.origin}/c/${token}`;
    void navigator.clipboard?.writeText(url).then(() => toast('success', t.common.copied));
  };
}

export function MyCertificates({ items }: { items: CertificateRow[] }) {
  const { t, locale } = useApp();
  const copy = useCopy();
  return (
    <>
      <PageHeader title={t.certificate.mineTitle} subtitle={t.certificate.mineSubtitle} />
      {items.length === 0 ? (
        <Card><EmptyState title={t.certificate.none} hint={t.certificate.noneMine} icon={<Award size={19} />} /></Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((c) => (
            <Card key={c.id} className="flex flex-col">
              <div className="flex items-start justify-between gap-3">
                <span className="flex size-10 items-center justify-center rounded-xl bg-copper-100 text-copper-700"><Award size={20} /></span>
                <StatusBadge status={c.status} label={c.status === 'Valid' ? t.certificate.valid : t.certificate.revoked} />
              </div>
              <h3 className="mt-3 text-[15px] font-semibold leading-snug">{c.courseTitle}</h3>
              <p className="mt-1 text-[12.5px] text-[var(--text-muted)]">{c.tenantName} · {formatDate(c.issuedAt, locale)}</p>
              <p className="mt-1 text-[12px] tabular-nums text-[var(--text-faint)]" dir="ltr">{c.serial}</p>
              {c.status === 'Valid' ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  <a href={`/api/certificates/${c.id}/pdf`} target="_blank" rel="noreferrer"><Button size="sm" variant="secondary" icon={<Download size={14} />}>{t.certificate.download}</Button></a>
                  <Button size="sm" variant="ghost" icon={<Copy size={14} />} onClick={() => copy(c.verifyToken)}>{t.certificate.copyLink}</Button>
                </div>
              ) : null}
            </Card>
          ))}
        </div>
      )}
    </>
  );
}

export function CertificatesView({ items, role }: { items: CertificateRow[]; role: Role }) {
  const { t, locale, run, busy } = useApp();
  const copy = useCopy();
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(0);
  const [revoking, setRevoking] = useState<CertificateRow | null>(null);
  const [reason, setReason] = useState('');
  const list = useMemo(() => items.filter((c) => (!status || c.status === status) && (!query || `${c.learnerName} ${c.email ?? ''} ${c.courseTitle} ${c.serial}`.toLowerCase().includes(query.toLowerCase()))), [items, query, status]);

  return (
    <>
      <PageHeader title={t.certificate.title} subtitle={t.certificate.subtitle} />
      <Card padded={false}>
        <div className="flex flex-wrap items-center gap-3 p-4">
          <SearchInput value={query} onChange={(v) => { setQuery(v); setPage(0); }} placeholder={t.common.searchPlaceholder} className="w-full max-w-xs" />
          <Select value={status} onChange={(e) => { setStatus(e.target.value); setPage(0); }} className="w-40">
            <option value="">{t.report.allStatuses}</option>
            <option value="Valid">{t.certificate.valid}</option>
            <option value="Revoked">{t.certificate.revoked}</option>
          </Select>
          <span className="ms-auto text-[12.5px] text-[var(--text-muted)]">{formatNumber(list.length, locale)} {t.report.rows}</span>
        </div>
        {list.length === 0 ? (
          <EmptyState title={t.certificate.none} icon={<Award size={19} />} />
        ) : (
          <>
            <Table>
              <thead><tr><Th>{t.certificate.serial}</Th><Th>{t.certificate.learner}</Th><Th>{t.certificate.course}</Th><Th>{t.certificate.issued}</Th><Th>{t.certificate.score}</Th><Th>{t.common.status}</Th><Th /></tr></thead>
              <tbody>
                {list.slice(page * PAGE, page * PAGE + PAGE).map((c) => (
                  <Tr key={c.id}>
                    <Td className="tabular-nums text-[12.5px]"><span dir="ltr">{c.serial}</span></Td>
                    <Td><span className="block font-medium">{c.learnerName}</span><span className="block text-[11.5px] text-[var(--text-faint)]" dir="ltr">{c.email}</span></Td>
                    <Td className="max-w-56 truncate">{c.courseTitle}</Td>
                    <Td className="text-[12.5px] tabular-nums">{formatDate(c.issuedAt, locale)}</Td>
                    <Td className="tabular-nums">{c.score === null ? '…' : `${formatNumber(c.score, locale, 1)}%`}</Td>
                    <Td><StatusBadge status={c.status} label={c.status === 'Valid' ? t.certificate.valid : t.certificate.revoked} />{c.revokeReason ? <span className="mt-1 block max-w-40 truncate text-[11px] text-[var(--text-faint)]" title={c.revokeReason}>{c.revokeReason}</span> : null}</Td>
                    <Td className="text-end">
                      <span className="flex justify-end gap-1">
                        <a href={`/api/certificates/${c.id}/pdf`} target="_blank" rel="noreferrer" aria-label={t.certificate.download} className="rounded-lg p-2 text-[var(--text-muted)] hover:bg-[var(--surface-sunken)]"><Download size={15} /></a>
                        <a href={`/c/${c.verifyToken}`} target="_blank" rel="noreferrer" aria-label={t.certificate.verifyLink} className="rounded-lg p-2 text-[var(--text-muted)] hover:bg-[var(--surface-sunken)]"><ExternalLink size={15} /></a>
                        <button type="button" onClick={() => copy(c.verifyToken)} aria-label={t.certificate.copyLink} className="rounded-lg p-2 text-[var(--text-muted)] hover:bg-[var(--surface-sunken)]"><Copy size={15} /></button>
                        {role === 'Admin' && c.status === 'Valid' ? <Button size="sm" variant="subtle" className="text-critical" onClick={() => { setRevoking(c); setReason(''); }}>{t.certificate.revoke}</Button> : null}
                      </span>
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
            <Pager page={page} pageSize={PAGE} total={list.length} onChange={setPage} />
          </>
        )}
      </Card>
      <Modal open={!!revoking} onClose={() => setRevoking(null)} title={t.certificate.revoke} description={revoking ? `${revoking.learnerName} · ${revoking.serial}` : undefined}
        footer={<Button variant="danger" loading={busy} disabled={reason.trim().length < 3} onClick={async () => { if (await run('certificate.revoke', { id: revoking!.id, reason })) setRevoking(null); }}>{t.certificate.revoke}</Button>}>
        <p className="mb-3 text-[13px] leading-relaxed text-[var(--text-muted)]">{t.certificate.revokeHint}</p>
        <Field label={t.common.reason} required><Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
      </Modal>
    </>
  );
}
