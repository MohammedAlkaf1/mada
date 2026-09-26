'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ImageUp, KeyRound, LogOut, RotateCcw, ShieldCheck, Trash2 } from 'lucide-react';
import { signOut } from 'next-auth/react';
import { useApp } from '@/components/app-provider';
import { Badge, Button, Card, Checkbox, EmptyState, Field, Input, Modal, PageHeader, SectionHeader, Select, StatusBadge, Table, Td, Textarea, Th, Tr, cx } from '@/components/ui';
import { brandStyle } from '@/lib/cx';
import { formatDateTime } from '@/lib/format';
import type { Dictionary } from '@/i18n/dictionary';
import type { AssetState } from '@/lib/types';
import { UploadButton, formatBytes } from './upload';

type Settings = {
  tenant: { nameAr: string; nameEn: string; brandColor: string; timezone: string; kind: string; hasLogo: boolean; slug: string };
  support: { id: string; email: string; name: string; active: boolean; expiresAt: string | null }[];
  failedMail: { id: string; recipient: string; subject: string; attempts: number; failure: string | null; createdAt: string }[];
  features: string[];
};

const ZONES = ['Asia/Riyadh', 'Asia/Dubai', 'Asia/Kuwait', 'Asia/Qatar', 'Asia/Bahrain', 'Asia/Muscat', 'Africa/Cairo', 'Asia/Amman', 'Europe/London'];
const SWATCHES = ['#0E6E6B', '#1F5FA8', '#6B3FA0', '#B4541F', '#2F7D32', '#9C2C4B', '#16323B'];

export function SettingsView({ data }: { data: Settings }) {
  const { t, locale, run, busy, toast } = useApp();
  const router = useRouter();
  const [form, setForm] = useState({ nameAr: data.tenant.nameAr, nameEn: data.tenant.nameEn, brandColor: data.tenant.brandColor, timezone: data.tenant.timezone });
  const [logoBusy, setLogoBusy] = useState(false);
  const [logoVersion, setLogoVersion] = useState(0);
  const [granting, setGranting] = useState(false);
  const [grant, setGrant] = useState({ email: '', hours: 24, reason: '' });
  const input = useRef<HTMLInputElement>(null);
  const branding = data.features.includes('branding');

  async function uploadLogo(file: File) {
    setLogoBusy(true);
    try {
      const r = await fetch(`/api/tenant/logo?name=${encodeURIComponent(file.name)}`, { method: 'PUT', body: file });
      const body = (await r.json().catch(() => ({}))) as { error?: string };
      if (!r.ok) return toast('error', t.errors[(body.error ?? 'server') as keyof Dictionary['errors']] ?? t.errors.server);
      toast('success', t.common.saved);
      setLogoVersion((v) => v + 1);
      router.refresh();
    } finally {
      setLogoBusy(false);
    }
  }

  return (
    <>
      <PageHeader title={t.settings.title} subtitle={t.settings.subtitle} />
      <div className="grid gap-4 lg:grid-cols-[1fr_22rem]">
        <Card>
          <SectionHeader title={t.settings.identity} hint={t.settings.identityHint} />
          <div className="mt-5 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t.settings.nameAr} required><Input dir="rtl" value={form.nameAr} maxLength={120} onChange={(e) => setForm({ ...form, nameAr: e.target.value })} /></Field>
              <Field label={t.settings.nameEn} required><Input dir="ltr" value={form.nameEn} maxLength={120} onChange={(e) => setForm({ ...form, nameEn: e.target.value })} /></Field>
            </div>
            <Field label={t.settings.color} hint={t.settings.colorHint}>
              <div className="flex flex-wrap items-center gap-2">
                {SWATCHES.map((c) => (
                  <button key={c} type="button" onClick={() => setForm({ ...form, brandColor: c })} aria-label={c}
                    className={cx('size-8 rounded-full ring-offset-2 ring-offset-[var(--surface-card)] transition', form.brandColor.toLowerCase() === c.toLowerCase() ? 'ring-2 ring-[var(--text-strong)]' : 'hover:scale-105')} style={{ background: c }} />
                ))}
                <input type="color" value={form.brandColor} onChange={(e) => setForm({ ...form, brandColor: e.target.value })} className="h-8 w-12 cursor-pointer rounded border border-[var(--line-strong)] bg-transparent" aria-label={t.settings.color} />
                <code dir="ltr" className="text-[12px] text-[var(--text-muted)]">{form.brandColor}</code>
              </div>
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t.settings.timezone}><Select value={form.timezone} onChange={(e) => setForm({ ...form, timezone: e.target.value })}>{[...new Set([form.timezone, ...ZONES])].map((z) => <option key={z} value={z}>{z}</option>)}</Select></Field>
              <Field label={t.settings.kind}><Input disabled value={t.settings.kinds[data.tenant.kind as keyof typeof t.settings.kinds] ?? data.tenant.kind} /></Field>
            </div>
            {/* The preview uses the same accent rules as the app shell. */}
            <div className="brand-scope rounded-xl border border-[var(--line-soft)] p-4" style={brandStyle(form.brandColor)}>
              <div className="flex flex-wrap items-center gap-2">
                <Button size="sm" variant="secondary">{t.learn.continue}</Button>
                <Badge tone="accent">{t.learn.required}</Badge>
                <span className="h-1.5 w-32 overflow-hidden rounded-full bg-[var(--surface-sunken)]"><span className="block h-full w-2/3 bg-copper-600" /></span>
              </div>
            </div>
            <Button loading={busy} disabled={form.nameAr.trim().length < 2 || form.nameEn.trim().length < 2} onClick={() => run('tenant.update', form)}>{t.common.save}</Button>
          </div>
        </Card>

        <div className="space-y-4">
          <Card>
            <SectionHeader title={t.settings.logo} hint={t.settings.logoHint} />
            <div className="mt-4 flex items-center gap-4">
              <div className="flex size-20 items-center justify-center overflow-hidden rounded-2xl border border-[var(--line-soft)] bg-white">
                {data.tenant.hasLogo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={`/api/tenant/logo?v=${logoVersion}`} alt="" className="size-full object-contain p-1.5" />
                ) : <ImageUp size={22} className="text-navy-300" />}
              </div>
              <div className="flex flex-col gap-2">
                <input ref={input} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void uploadLogo(f); }} />
                <Button size="sm" variant="ghost" loading={logoBusy} disabled={!branding} icon={<ImageUp size={14} />} onClick={() => input.current?.click()}>{t.common.upload}</Button>
                {data.tenant.hasLogo ? <Button size="sm" variant="subtle" icon={<Trash2 size={14} />} onClick={() => run('tenant.logoRemove')}>{t.settings.removeLogo}</Button> : null}
              </div>
            </div>
            {!branding ? <p className="mt-3 text-[12px] text-caution">{t.billing.featureLocked}</p> : null}
          </Card>
          <Card>
            <SectionHeader title={t.settings.address} />
            <code dir="ltr" className="mt-3 block rounded-lg bg-[var(--surface-sunken)] px-3 py-2 text-[12.5px]">{data.tenant.slug}</code>
          </Card>
        </div>
      </div>

      <Card className="mt-4" padded={false}>
        <div className="flex flex-wrap items-start justify-between gap-3 px-5 pt-5">
          <SectionHeader title={t.settings.support} hint={t.settings.supportHint} />
          <Button size="sm" variant="ghost" icon={<ShieldCheck size={14} />} onClick={() => setGranting(true)}>{t.settings.grantSupport}</Button>
        </div>
        {data.support.length === 0 ? <p className="px-5 py-5 text-[13px] text-[var(--text-faint)]">{t.settings.none}</p> : (
          <Table className="mt-3">
            <thead><tr><Th>{t.common.email}</Th><Th>{t.common.status}</Th><Th>{t.common.expires}</Th><Th /></tr></thead>
            <tbody>
              {data.support.map((s) => {
                const live = s.active && (!s.expiresAt || new Date(s.expiresAt) > new Date());
                return (
                  <Tr key={s.id}>
                    <Td><span dir="ltr">{s.email}</span></Td>
                    <Td><StatusBadge status={live ? 'Active' : 'Expired'} label={live ? t.common.active : t.statuses.Expired} /></Td>
                    <Td className="text-[12.5px] tabular-nums">{s.expiresAt ? formatDateTime(s.expiresAt, locale) : '…'}</Td>
                    <Td className="text-end">{live ? <Button size="sm" variant="subtle" className="text-critical" onClick={() => { const reason = prompt(t.common.reason); if (reason && reason.trim().length >= 3) void run('support.revoke', { id: s.id, reason }); }}>{t.settings.revokeSupport}</Button> : null}</Td>
                  </Tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </Card>

      <Card className="mt-4" padded={false}>
        <div className="px-5 pt-5"><SectionHeader title={t.settings.failedMail} hint={t.settings.failedMailHint} /></div>
        {data.failedMail.length === 0 ? <p className="px-5 py-5 text-[13px] text-[var(--text-faint)]">{t.settings.none}</p> : (
          <Table className="mt-3">
            <thead><tr><Th>{t.settings.recipient}</Th><Th>{t.common.details}</Th><Th className="text-center">{t.settings.attempts}</Th><Th>{t.common.date}</Th><Th /></tr></thead>
            <tbody>
              {data.failedMail.map((m) => (
                <Tr key={m.id}>
                  <Td><span dir="ltr" className="text-[12.5px]">{m.recipient}</span></Td>
                  <Td className="max-w-72"><span className="block truncate text-[13px]">{m.subject}</span>{m.failure ? <span className="block truncate text-[11.5px] text-critical">{m.failure}</span> : null}</Td>
                  <Td className="text-center tabular-nums">{m.attempts}</Td>
                  <Td className="text-[12.5px] tabular-nums">{formatDateTime(m.createdAt, locale)}</Td>
                  <Td className="text-end"><Button size="sm" variant="subtle" icon={<RotateCcw size={13} />} onClick={() => run('outbox.retry', { id: m.id })}>{t.common.retry}</Button></Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      <Modal open={granting} onClose={() => setGranting(false)} title={t.settings.grantSupport} description={t.settings.supportHint}
        footer={<Button loading={busy} disabled={!grant.email.includes('@') || grant.reason.trim().length < 3} onClick={async () => { if (await run('support.grant', grant)) setGranting(false); }}>{t.common.confirm}</Button>}>
        <div className="space-y-4">
          <Field label={t.settings.operatorEmail} required><Input dir="ltr" type="email" value={grant.email} onChange={(e) => setGrant({ ...grant, email: e.target.value })} /></Field>
          <Field label={t.common.hours}><Input type="number" min={1} max={72} dir="ltr" className="max-w-32" value={grant.hours} onChange={(e) => setGrant({ ...grant, hours: Number(e.target.value) })} /></Field>
          <Field label={t.common.reason} required><Textarea rows={2} value={grant.reason} onChange={(e) => setGrant({ ...grant, reason: e.target.value })} /></Field>
        </div>
      </Modal>
    </>
  );
}

export function AccountView({ name, email, reminders, mfaEnabled }: { name: string; email: string; reminders: boolean; mfaEnabled: boolean }) {
  const { t, locale, run, busy } = useApp();
  const [value, setValue] = useState(name);
  return (
    <>
      <PageHeader title={t.account.title} subtitle={t.account.subtitle} />
      <div className="grid max-w-4xl gap-4 lg:grid-cols-2">
        <Card>
          <SectionHeader title={t.account.profile} />
          <div className="mt-4 space-y-4">
            <Field label={t.common.name}><Input value={value} maxLength={120} onChange={(e) => setValue(e.target.value)} /></Field>
            <Field label={t.common.email}><Input dir="ltr" disabled value={email} /></Field>
            <Button loading={busy} disabled={value.trim().length < 2 || value === name} onClick={() => run('profile.update', { name: value })}>{t.common.save}</Button>
          </div>
        </Card>
        <div className="space-y-4">
          <Card>
            <Checkbox defaultChecked={reminders} onChange={(e) => run('preferences.save', { reminders: e.target.checked })} label={<><span className="font-medium">{t.account.reminders}</span><span className="block text-[12px] text-[var(--text-faint)]">{t.account.remindersHint}</span></>} />
          </Card>
          <Card>
            <SectionHeader title={t.account.security} />
            <p className={cx('mt-3 flex items-center gap-2 text-[13px]', mfaEnabled ? 'text-positive' : 'text-caution')}><KeyRound size={15} />{mfaEnabled ? t.account.mfaOn : t.account.mfaOff}</p>
            {!mfaEnabled ? <a href={`/${locale}/security`} className="mt-3 inline-block"><Button size="sm" variant="secondary">{t.account.mfaSetup}</Button></a> : null}
            <div className="mt-4 border-t border-[var(--line-soft)] pt-4">
              <Button size="sm" variant="ghost" icon={<LogOut size={14} />} onClick={async () => { if (await run('session.revoke', {}, { silent: true })) await signOut({ callbackUrl: `/${locale}/login` }); }}>{t.account.signOutAll}</Button>
              <p className="mt-1.5 text-[12px] text-[var(--text-faint)]">{t.account.signOutAllHint}</p>
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}

export function FilesView({ files }: { files: (AssetState & { createdAt: string })[] }) {
  const { t, locale } = useApp();
  const router = useRouter();
  return (
    <>
      <PageHeader title={t.files.title} subtitle={t.files.subtitle} action={<UploadButton variant="primary" accept=".pdf,.mp4,.png,.jpg,.jpeg,.webp" onUploaded={() => router.refresh()} />} />
      <p className="-mt-3 mb-4 text-[12.5px] text-[var(--text-faint)]">{t.files.limits}</p>
      <Card padded={false}>
        {files.length === 0 ? <EmptyState title={t.files.none} icon={<ImageUp size={19} />} /> : (
          <Table>
            <thead><tr><Th>{t.files.name}</Th><Th>{t.files.type}</Th><Th>{t.files.size}</Th><Th>{t.common.status}</Th><Th>{t.files.uploaded}</Th><Th /></tr></thead>
            <tbody>
              {files.map((f) => (
                <Tr key={f.id}>
                  <Td className="max-w-72"><span className="block truncate font-medium" dir="auto">{f.name}</span></Td>
                  <Td className="text-[12.5px]" ><span dir="ltr">{f.mime}</span></Td>
                  <Td className="text-[12.5px] tabular-nums">{formatBytes(f.size, locale)}</Td>
                  <Td><StatusBadge status={f.status} label={t.statuses[f.status as keyof typeof t.statuses] ?? f.status} /></Td>
                  <Td className="text-[12.5px] tabular-nums">{formatDateTime(f.createdAt, locale)}</Td>
                  <Td className="text-end">{f.status === 'Clean' ? <a href={`/api/files?id=${f.id}`} target="_blank" rel="noreferrer" className="text-[13px] font-medium text-copper-700 hover:underline">{t.common.open}</a> : null}</Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </>
  );
}
