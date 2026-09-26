'use client';

import { useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Archive, CheckCircle2, Download, FileSpreadsheet, MailPlus, Pencil, Plus, RotateCcw, Send, Upload, Users, XCircle } from 'lucide-react';
import { useApp } from '@/components/app-provider';
import { Avatar, Badge, Button, Card, Checkbox, EmptyState, Field, Input, Modal, PageHeader, SearchInput, SectionHeader, Select, StatusBadge, Table, Tabs, Td, Textarea, Th, Tr } from '@/components/ui';
import { Pager } from '@/components/ui/pagination';
import { formatDate, formatDateTime, formatNumber } from '@/lib/format';
import { parseCsv } from '@/lib/csv';
import { roles, type ImportVerdict, type Role } from '@/lib/domain';
import type { GroupRow, MemberRow } from '@/lib/types';

type Imports = { id: string; filename: string; status: string; totalRows: number; createdRows: number; skippedRows: number; errorRows: number; createdAt: string; appliedAt: string | null }[];
type Tab = 'members' | 'groups' | 'import';
const PAGE = 30;

/* ───────────── Members ───────────── */

function InviteModal({ open, onClose, groups }: { open: boolean; onClose: () => void; groups: GroupRow[] }) {
  const { t, run, busy } = useApp();
  const [form, setForm] = useState({ name: '', email: '', role: 'Learner' as Role, group: '' });
  const valid = form.name.trim().length >= 2 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(form.email.trim());
  return (
    <Modal open={open} onClose={onClose} title={t.people.inviteTitle} description={t.people.inviteHint}
      footer={<><Button variant="ghost" onClick={onClose}>{t.common.cancel}</Button><Button loading={busy} disabled={!valid} icon={<Send size={15} />} onClick={async () => { if (await run('member.invite', { ...form, group: form.group || undefined })) { setForm({ name: '', email: '', role: 'Learner', group: '' }); onClose(); } }}>{t.common.submit}</Button></>}>
      <div className="space-y-4">
        <Field label={t.common.name} required><Input value={form.name} maxLength={120} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
        <Field label={t.common.email} required><Input dir="ltr" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t.common.role}><Select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as Role })}>{roles.map((r) => <option key={r} value={r}>{t.roles[r]}</option>)}</Select></Field>
          <Field label={t.people.groups} hint={t.common.optional}>
            <Input list="group-names" value={form.group} maxLength={80} onChange={(e) => setForm({ ...form, group: e.target.value })} />
            <datalist id="group-names">{groups.filter((g) => !g.archivedAt).map((g) => <option key={g.id} value={g.name} />)}</datalist>
          </Field>
        </div>
      </div>
    </Modal>
  );
}

function MemberModal({ member, onClose, self }: { member: MemberRow; onClose: () => void; self: boolean }) {
  const { t, run, busy } = useApp();
  const [form, setForm] = useState({ role: member.role, active: member.active, title: member.title });
  return (
    <Modal open onClose={onClose} title={member.name} description={member.email}
      footer={<><Button variant="ghost" onClick={onClose}>{t.common.cancel}</Button><Button loading={busy} onClick={async () => { if (await run('member.update', { id: member.id, ...form })) onClose(); }}>{t.common.save}</Button></>}>
      <div className="space-y-4">
        {self ? <p className="rounded-lg bg-info-soft px-3 py-2 text-[12.5px] text-info">{t.people.selfEdit}</p> : null}
        <Field label={t.common.role}><Select value={form.role} disabled={self} onChange={(e) => setForm({ ...form, role: e.target.value as Role })}>{roles.map((r) => <option key={r} value={r}>{t.roles[r]}</option>)}</Select></Field>
        <Field label={t.people.jobTitle}><Input value={form.title} maxLength={120} onChange={(e) => setForm({ ...form, title: e.target.value })} /></Field>
        <Checkbox disabled={self} checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} label={<><span className="font-medium">{t.common.active}</span><span className="block text-[12px] text-[var(--text-faint)]">{t.people.deactivateHint}</span></>} />
      </div>
    </Modal>
  );
}

function MembersTab({ members, groups, selfId, seats }: { members: MemberRow[]; groups: GroupRow[]; selfId: string; seats: { used: number; limit: number } | null }) {
  const { t, locale, run } = useApp();
  const [query, setQuery] = useState('');
  const [role, setRole] = useState('');
  const [group, setGroup] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(0);
  const [inviting, setInviting] = useState(false);
  const [editing, setEditing] = useState<MemberRow | null>(null);
  const groupName = useMemo(() => new Map(groups.map((g) => [g.id, g.name])), [groups]);
  const list = members.filter((m) => !m.supportGrant || m.active).filter((m) =>
    (!query || `${m.name} ${m.email} ${m.title}`.toLowerCase().includes(query.toLowerCase())) && (!role || m.role === role) && (!group || m.groupIds.includes(group)) &&
    (!status || (status === 'active' ? m.active && m.verified : status === 'pending' ? m.active && !m.verified : !m.active)));

  return (
    <>
      <Card padded={false}>
        <div className="flex flex-wrap items-center gap-3 p-4">
          <SearchInput value={query} onChange={(v) => { setQuery(v); setPage(0); }} placeholder={t.common.searchPlaceholder} className="w-full max-w-xs" />
          <Select value={role} onChange={(e) => { setRole(e.target.value); setPage(0); }} className="w-40"><option value="">{t.people.filterRole}</option>{roles.map((r) => <option key={r} value={r}>{t.roles[r]}</option>)}</Select>
          <Select value={group} onChange={(e) => { setGroup(e.target.value); setPage(0); }} className="w-44"><option value="">{t.people.filterGroup}</option>{groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}</Select>
          <Select value={status} onChange={(e) => { setStatus(e.target.value); setPage(0); }} className="w-40"><option value="">{t.people.filterStatus}</option><option value="active">{t.common.active}</option><option value="pending">{t.people.pending}</option><option value="inactive">{t.common.inactive}</option></Select>
          <div className="ms-auto flex items-center gap-3">
            {seats ? <span className="text-[12.5px] tabular-nums text-[var(--text-muted)]">{t.people.seats}: {formatNumber(seats.used, locale)}{seats.limit >= 0 ? ` / ${formatNumber(seats.limit, locale)}` : ''}</span> : null}
            <Button icon={<MailPlus size={15} />} onClick={() => setInviting(true)}>{t.people.invite}</Button>
          </div>
        </div>
        {list.length === 0 ? (
          <EmptyState title={t.common.empty} icon={<Users size={19} />} />
        ) : (
          <>
            <Table>
              <thead><tr><Th>{t.people.member}</Th><Th>{t.common.role}</Th><Th>{t.people.groups}</Th><Th>{t.common.status}</Th><Th>{t.people.lastSeen}</Th><Th /></tr></thead>
              <tbody>
                {list.slice(page * PAGE, page * PAGE + PAGE).map((m) => (
                  <Tr key={m.id}>
                    <Td>
                      <div className="flex items-center gap-3">
                        <Avatar name={m.name} size={32} />
                        <div className="min-w-0">
                          <Link href={`/${locale}/people/${m.id}`} className="block truncate font-medium hover:underline">{m.name}</Link>
                          <span className="block truncate text-[11.5px] text-[var(--text-faint)]" dir="ltr">{m.email}</span>
                          {m.title ? <span className="block truncate text-[11.5px] text-[var(--text-muted)]">{m.title}</span> : null}
                        </div>
                      </div>
                    </Td>
                    <Td>{t.roles[m.role]}{m.supportGrant ? <Badge tone="caution" className="ms-1.5">{t.people.supportBadge}</Badge> : null}</Td>
                    <Td className="max-w-52"><div className="flex flex-wrap gap-1">{m.groupIds.slice(0, 3).map((g) => <Badge key={g}>{groupName.get(g)}</Badge>)}{m.groupIds.length > 3 ? <Badge>+{m.groupIds.length - 3}</Badge> : null}</div></Td>
                    <Td>{!m.active ? <StatusBadge status="Cancelled" label={t.common.inactive} /> : !m.verified ? <StatusBadge status="Pending" label={t.people.pending} /> : <StatusBadge status="Active" label={t.common.active} />}</Td>
                    <Td className="text-[12.5px] tabular-nums text-[var(--text-muted)]">{m.lastSeenAt ? formatDateTime(m.lastSeenAt, locale) : t.people.never}</Td>
                    <Td className="text-end">
                      <span className="flex justify-end gap-1">
                        {m.active && !m.verified ? <Button size="sm" variant="subtle" onClick={() => run('member.resend', { id: m.id })}>{t.people.resend}</Button> : null}
                        {!m.supportGrant ? <Button size="sm" variant="subtle" aria-label={t.common.edit} onClick={() => setEditing(m)}><Pencil size={14} /></Button> : null}
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
      <InviteModal open={inviting} onClose={() => setInviting(false)} groups={groups} />
      {editing ? <MemberModal key={editing.id} member={editing} onClose={() => setEditing(null)} self={editing.userId === selfId} /> : null}
    </>
  );
}

/* ───────────── Groups ───────────── */

function GroupMembersModal({ group, members, onClose }: { group: GroupRow; members: MemberRow[]; onClose: () => void }) {
  const { t, locale, run, busy } = useApp();
  const [picked, setPicked] = useState<string[]>(group.memberIds);
  const [query, setQuery] = useState('');
  const shown = members.filter((m) => m.active && !m.supportGrant && (!query || `${m.name} ${m.email}`.toLowerCase().includes(query.toLowerCase())));
  const add = picked.filter((id) => !group.memberIds.includes(id));
  const remove = group.memberIds.filter((id) => !picked.includes(id));
  return (
    <Modal open onClose={onClose} size="lg" title={`${t.people.manageMembers} · ${group.name}`}
      footer={<><span className="me-auto text-[12.5px] text-[var(--text-muted)]">{formatNumber(picked.length, locale)} {t.people.members}</span><Button variant="ghost" onClick={onClose}>{t.common.cancel}</Button><Button loading={busy} disabled={!add.length && !remove.length} onClick={async () => { if (await run('group.members', { id: group.id, add, remove })) onClose(); }}>{t.common.save}</Button></>}>
      <SearchInput value={query} onChange={setQuery} placeholder={t.common.searchPlaceholder} className="mb-3" />
      <ul className="max-h-[50vh] divide-y divide-[var(--line-soft)] overflow-y-auto rounded-xl border border-[var(--line-soft)]">
        {shown.map((m) => (
          <li key={m.id}>
            <Checkbox className="px-3 py-2.5 hover:bg-[var(--surface-sunken)]" checked={picked.includes(m.id)} onChange={(e) => setPicked(e.target.checked ? [...picked, m.id] : picked.filter((x) => x !== m.id))}
              label={<><span className="font-medium">{m.name}</span> <span className="text-[12px] text-[var(--text-faint)]">{t.roles[m.role]}</span></>} />
          </li>
        ))}
      </ul>
    </Modal>
  );
}

function GroupsTab({ groups, members }: { groups: GroupRow[]; members: MemberRow[] }) {
  const { t, locale, run, busy } = useApp();
  const [editing, setEditing] = useState<GroupRow | 'new' | null>(null);
  const [managing, setManaging] = useState<GroupRow | null>(null);
  const [form, setForm] = useState({ name: '', description: '' });
  const open = (g: GroupRow | 'new') => { setEditing(g); setForm(g === 'new' ? { name: '', description: '' } : { name: g.name, description: g.description }); };
  const active = groups.filter((g) => !g.archivedAt), archived = groups.filter((g) => g.archivedAt);
  return (
    <>
      <div className="mb-4 flex justify-end"><Button icon={<Plus size={15} />} onClick={() => open('new')}>{t.people.newGroup}</Button></div>
      {groups.length === 0 ? (
        <Card><EmptyState title={t.people.noGroups} hint={t.people.noGroupsHint} icon={<Users size={19} />} /></Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[...active, ...archived].map((g) => (
            <Card key={g.id} className={g.archivedAt ? 'opacity-70' : ''}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0"><h3 className="truncate text-[15px] font-semibold">{g.name}</h3>{g.description ? <p className="mt-0.5 line-clamp-2 text-[12.5px] text-[var(--text-muted)]">{g.description}</p> : null}</div>
                {g.archivedAt ? <Badge>{t.statuses.Archived}</Badge> : <Badge tone="accent">{formatNumber(g.memberIds.length, locale)} {t.people.members}</Badge>}
              </div>
              <div className="mt-4 flex flex-wrap gap-1.5">
                {!g.archivedAt ? <Button size="sm" variant="ghost" icon={<Users size={14} />} onClick={() => setManaging(g)}>{t.people.manageMembers}</Button> : null}
                <Button size="sm" variant="subtle" aria-label={t.common.edit} onClick={() => open(g)}><Pencil size={14} /></Button>
                <Button size="sm" variant="subtle" icon={g.archivedAt ? <RotateCcw size={14} /> : <Archive size={14} />} onClick={() => run('group.archive', { id: g.id, archived: !g.archivedAt })}>{g.archivedAt ? t.people.restoreGroup : t.people.archiveGroup}</Button>
              </div>
            </Card>
          ))}
        </div>
      )}
      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing === 'new' ? t.people.newGroup : t.people.groupName}
        footer={<Button loading={busy} disabled={!form.name.trim()} onClick={async () => { if (await run('group.save', { ...(editing && editing !== 'new' ? { id: editing.id } : {}), ...form })) setEditing(null); }}>{t.common.save}</Button>}>
        <div className="space-y-4">
          <Field label={t.people.groupName} required><Input value={form.name} maxLength={80} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
          <Field label={t.people.groupDescription}><Textarea rows={2} value={form.description} maxLength={500} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
        </div>
      </Modal>
      {managing ? <GroupMembersModal key={managing.id} group={managing} members={members} onClose={() => setManaging(null)} /> : null}
    </>
  );
}

/* ───────────── Import (FR-03) ───────────── */

const ALIASES: Record<'name' | 'email' | 'group' | 'role', string[]> = {
  name: ['name', 'full name', 'fullname', 'الاسم', 'الاسم الكامل', 'اسم'],
  email: ['email', 'e-mail', 'mail', 'البريد', 'البريد الإلكتروني', 'الايميل', 'الإيميل'],
  group: ['group', 'department', 'cohort', 'المجموعة', 'القسم', 'الدفعة'],
  role: ['role', 'الدور', 'الصلاحية'],
};
const normal = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');

function toRows(headers: string[], body: string[][]) {
  const index = Object.fromEntries(Object.entries(ALIASES).map(([k, names]) => [k, headers.findIndex((h) => names.includes(normal(h)))])) as Record<keyof typeof ALIASES, number>;
  if (index.name < 0 || index.email < 0) return null;
  const cell = (r: string[], i: number) => (i >= 0 ? String(r[i] ?? '').replace(/^'/, '').trim() : '');
  return body.map((r, i) => ({ row: i + 2, name: cell(r, index.name), email: cell(r, index.email), group: cell(r, index.group), role: cell(r, index.role) })).filter((r) => r.name || r.email);
}

function ImportTab({ imports }: { imports: Imports }) {
  const { t, locale, run, busy, toast } = useApp();
  const input = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<{ id: string; filename: string; rows: ImportVerdict[] } | null>(null);

  async function read(file: File) {
    let headers: string[] = [], body: string[][] = [];
    try {
      if (/\.xlsx$/i.test(file.name)) {
        const { default: readXlsxFile } = await import('read-excel-file');
        const sheet = (await readXlsxFile(file)).map((r) => r.map((c) => (c === null || c === undefined ? '' : String(c))));
        headers = sheet[0] ?? [];
        body = sheet.slice(1);
      } else {
        const parsed = parseCsv(await file.text(), 3000);
        headers = parsed.headers;
        body = parsed.rows;
      }
    } catch {
      toast('error', t.people.parseFailed);
      return;
    }
    const rows = toRows(headers, body);
    if (!rows) return toast('error', t.people.parseFailed);
    if (!rows.length) return toast('error', t.people.noRows);
    if (rows.length > 3000) return toast('error', t.people.tooMany);
    const r = (await run('import.preview', { filename: file.name, rows }, { silent: true })) as { id: string; rows: ImportVerdict[] } | null;
    if (r) setPreview({ id: r.id, filename: file.name, rows: r.rows });
  }

  function template() {
    const csv = '﻿' + [[t.people.columns.name, t.people.columns.email, t.people.columns.group, t.people.columns.role], locale === 'ar' ? ['سارة الحربي', 'sara@example.com', 'المبيعات', 'متدرب'] : ['Sara Alharbi', 'sara@example.com', 'Sales', 'learner']].map((r) => r.join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a'); a.href = url; a.download = 'people-template.csv'; a.click(); URL.revokeObjectURL(url);
  }

  const counts = preview ? { create: preview.rows.filter((r) => r.status === 'create').length, update: preview.rows.filter((r) => r.status === 'update').length, skip: preview.rows.filter((r) => r.status === 'skip').length, error: preview.rows.filter((r) => r.status === 'error').length } : null;

  return (
    <div className="space-y-4">
      <Card>
        <SectionHeader title={t.people.importTitle} hint={t.people.importHint} />
        <div className="mt-4 flex flex-wrap gap-2">
          <input ref={input} type="file" accept=".csv,.xlsx,text/csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void read(f); }} />
          <Button icon={<Upload size={15} />} loading={busy} onClick={() => input.current?.click()}>{t.people.chooseFile}</Button>
          <Button variant="ghost" icon={<Download size={15} />} onClick={template}>{t.people.template}</Button>
        </div>
      </Card>

      {preview && counts ? (
        <Card padded={false}>
          <div className="flex flex-wrap items-start justify-between gap-3 p-5">
            <SectionHeader title={`${t.people.previewTitle} · ${preview.filename}`} hint={t.people.previewHint} />
            <div className="flex flex-wrap gap-1.5">
              <Badge tone="positive">{t.people.verdict.create}: {formatNumber(counts.create, locale)}</Badge>
              <Badge tone="info">{t.people.verdict.update}: {formatNumber(counts.update, locale)}</Badge>
              <Badge>{t.people.verdict.skip}: {formatNumber(counts.skip, locale)}</Badge>
              <Badge tone="critical">{t.people.verdict.error}: {formatNumber(counts.error, locale)}</Badge>
            </div>
          </div>
          <div className="max-h-[50vh] overflow-y-auto">
            <Table>
              <thead><tr><Th>{t.people.row}</Th><Th>{t.common.name}</Th><Th>{t.common.email}</Th><Th>{t.people.groups}</Th><Th>{t.common.role}</Th><Th>{t.common.status}</Th></tr></thead>
              <tbody>
                {preview.rows.map((r) => (
                  <Tr key={r.row}>
                    <Td className="tabular-nums text-[var(--text-faint)]">{r.row}</Td>
                    <Td>{r.name}</Td>
                    <Td className="text-[12.5px]"><span dir="ltr">{r.email}</span></Td>
                    <Td>{r.group}</Td>
                    <Td>{r.role ? t.roles[r.role] : ''}</Td>
                    <Td>
                      {r.status === 'error' ? <span className="flex items-center gap-1.5 text-[12.5px] text-critical"><XCircle size={14} />{t.people.reasons[r.reason as keyof typeof t.people.reasons] ?? r.reason}</span>
                        : <span className={`flex items-center gap-1.5 text-[12.5px] ${r.status === 'create' ? 'text-positive' : 'text-[var(--text-muted)]'}`}><CheckCircle2 size={14} />{t.people.verdict[r.status]}</span>}
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </div>
          <div className="flex justify-end gap-2 border-t border-[var(--line-soft)] p-4">
            <Button variant="ghost" onClick={() => setPreview(null)}>{t.common.cancel}</Button>
            <Button loading={busy} disabled={!counts.create && !counts.update} onClick={async () => {
              const r = (await run('import.apply', { id: preview.id }, { silent: true, refresh: true })) as { created: number; updated: number; errors: number } | null;
              if (r) { toast('success', t.people.importDone.replace('{created}', formatNumber(r.created, locale)).replace('{updated}', formatNumber(r.updated, locale)).replace('{errors}', formatNumber(r.errors, locale))); setPreview(null); }
            }}>{t.people.applyImport}</Button>
          </div>
        </Card>
      ) : null}

      {imports.length ? (
        <Card padded={false}>
          <div className="px-5 pt-5"><SectionHeader title={t.people.history} /></div>
          <Table className="mt-3">
            <thead><tr><Th>{t.files.name}</Th><Th>{t.common.date}</Th><Th>{t.common.status}</Th><Th className="text-center">{t.people.verdict.create}</Th><Th className="text-center">{t.people.verdict.error}</Th></tr></thead>
            <tbody>
              {imports.map((j) => (
                <Tr key={j.id}>
                  <Td className="flex items-center gap-2"><FileSpreadsheet size={15} className="text-[var(--text-faint)]" /><span dir="auto">{j.filename}</span></Td>
                  <Td className="text-[12.5px] tabular-nums">{formatDate(j.appliedAt ?? j.createdAt, locale)}</Td>
                  <Td><StatusBadge status={j.status} label={t.statuses[j.status as keyof typeof t.statuses] ?? j.status} /></Td>
                  <Td className="text-center tabular-nums">{formatNumber(j.createdRows, locale)}</Td>
                  <Td className="text-center tabular-nums">{formatNumber(j.errorRows, locale)}</Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </Card>
      ) : null}
    </div>
  );
}

export function PeopleView({ members, groups, imports, selfId, seats, canImport }: { members: MemberRow[]; groups: GroupRow[]; imports: Imports; selfId: string; seats: { used: number; limit: number } | null; canImport: boolean }) {
  const { t } = useApp();
  const [tab, setTab] = useState<Tab>('members');
  return (
    <>
      <PageHeader title={t.people.title} subtitle={t.people.subtitle} />
      <Tabs value={tab} onChange={setTab} items={[
        { value: 'members', label: t.people.tabs.members, count: members.filter((m) => m.active && !m.supportGrant).length },
        { value: 'groups', label: t.people.tabs.groups, count: groups.filter((g) => !g.archivedAt).length },
        ...(canImport ? [{ value: 'import' as const, label: t.people.tabs.import }] : []),
      ]} />
      <div className="mt-4">
        {tab === 'members' ? <MembersTab members={members} groups={groups} selfId={selfId} seats={seats} /> : null}
        {tab === 'groups' ? <GroupsTab groups={groups} members={members} /> : null}
        {tab === 'import' ? <ImportTab imports={imports} /> : null}
      </div>
    </>
  );
}
