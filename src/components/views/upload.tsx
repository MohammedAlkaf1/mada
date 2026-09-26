'use client';

import { useRef, useState } from 'react';
import { FileText, Film, ImageIcon, Upload, X } from 'lucide-react';
import { useApp } from '@/components/app-provider';
import { Button, StatusBadge, cx } from '@/components/ui';
import type { Dictionary } from '@/i18n/dictionary';
import type { AssetState } from '@/lib/types';

/** Reads the length of a local video before upload, so the lesson knows what 90 percent means. */
export function videoDuration(file: File): Promise<number> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      resolve(Number.isFinite(video.duration) ? Math.round(video.duration) : 0);
    };
    video.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(0);
    };
    video.src = url;
  });
}

export function formatBytes(size: number, locale: 'ar' | 'en') {
  const mb = size / 1048576;
  const unit = locale === 'ar' ? (mb >= 1024 ? 'جيجابايت' : 'ميجابايت') : mb >= 1024 ? 'GB' : 'MB';
  return `${new Intl.NumberFormat(locale === 'ar' ? 'ar-SA-u-nu-latn' : 'en-GB', { maximumFractionDigits: 1 }).format(mb >= 1024 ? mb / 1024 : Math.max(mb, 0.1))} ${unit}`;
}

/**
 * Upload through XMLHttpRequest rather than fetch, because only XHR reports
 * upload progress, and a one gigabyte video without a progress bar looks
 * frozen (FR-07).
 */
export function useUpload() {
  const { t, toast } = useApp();
  const [progress, setProgress] = useState<number | null>(null);
  const xhrRef = useRef<XMLHttpRequest | null>(null);

  function upload(file: File): Promise<AssetState | null> {
    return new Promise((resolve) => {
      const xhr = new XMLHttpRequest();
      xhrRef.current = xhr;
      xhr.open('PUT', `/api/files?name=${encodeURIComponent(file.name)}`);
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) setProgress(Math.round((event.loaded / event.total) * 100));
      };
      xhr.onload = () => {
        setProgress(null);
        xhrRef.current = null;
        let body: { error?: string } & Partial<AssetState> = {};
        try {
          body = JSON.parse(xhr.responseText);
        } catch {}
        if (xhr.status >= 200 && xhr.status < 300 && body.id) {
          if (body.status === 'Rejected') toast('error', t.course.scanRejected);
          resolve(body as AssetState);
          return;
        }
        const code = (body.error ?? 'server') as keyof Dictionary['errors'];
        toast('error', t.errors[code] ?? t.errors.server);
        resolve(null);
      };
      xhr.onerror = () => {
        setProgress(null);
        xhrRef.current = null;
        toast('error', t.errors.network);
        resolve(null);
      };
      xhr.onabort = () => {
        setProgress(null);
        xhrRef.current = null;
        resolve(null);
      };
      setProgress(0);
      xhr.send(file);
    });
  }

  return { upload, progress, cancel: () => xhrRef.current?.abort() };
}

const icons = { 'application/pdf': FileText, 'video/mp4': Film } as Record<string, typeof FileText>;

export function AssetChip({ asset, onClear }: { asset: AssetState; onClear?: () => void }) {
  const { t, locale } = useApp();
  const Icon = icons[asset.mime] ?? ImageIcon;
  return (
    <div className="flex min-w-0 items-center gap-2.5 rounded-xl border border-[var(--line-soft)] bg-[var(--surface-sunken)] px-3 py-2">
      <Icon size={16} className="shrink-0 text-copper-700" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-medium" dir="auto">{asset.name}</span>
        <span className="block text-[11.5px] text-[var(--text-faint)]">{formatBytes(asset.size, locale)}</span>
      </span>
      {asset.status !== 'Clean' ? <StatusBadge status={asset.status} label={t.statuses[asset.status as keyof typeof t.statuses] ?? asset.status} /> : null}
      {onClear ? (
        <button type="button" onClick={onClear} className="rounded p-1 text-[var(--text-faint)] hover:text-critical" aria-label={t.common.remove}>
          <X size={14} />
        </button>
      ) : null}
    </div>
  );
}

/** A picker that uploads on selection and hands back the stored asset. */
export function UploadButton({
  accept,
  onUploaded,
  label,
  variant = 'ghost',
  className,
}: {
  accept: string;
  onUploaded: (asset: AssetState, file: File) => void;
  label?: string;
  variant?: 'ghost' | 'secondary' | 'primary';
  className?: string;
}) {
  const { t } = useApp();
  const input = useRef<HTMLInputElement>(null);
  const { upload, progress, cancel } = useUpload();
  return (
    <div className={cx('flex items-center gap-2', className)}>
      <input
        ref={input}
        type="file"
        accept={accept}
        className="hidden"
        onChange={async (event) => {
          const file = event.target.files?.[0];
          event.target.value = '';
          if (!file) return;
          const asset = await upload(file);
          if (asset) onUploaded(asset, file);
        }}
      />
      {progress === null ? (
        <Button type="button" variant={variant} size="sm" icon={<Upload size={14} />} onClick={() => input.current?.click()}>
          {label ?? t.common.upload}
        </Button>
      ) : (
        <div className="flex min-w-48 items-center gap-2.5" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--surface-sunken)]">
            <div className="h-full bg-copper-600 transition-[width]" style={{ width: `${progress}%` }} />
          </div>
          <span className="w-16 text-[12px] tabular-nums text-[var(--text-muted)]">{t.common.uploading} {progress}%</span>
          <button type="button" onClick={cancel} className="rounded p-1 text-[var(--text-faint)] hover:text-critical" aria-label={t.common.cancel}>
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
