'use client';

import type { ReactNode } from 'react';
import { cx } from '@/components/ui';

/** A headline number with an optional hint and meter, used by the operator console. */
export function StatTile({ label, value, sub, icon, accent = false, progress }: { label: ReactNode; value: ReactNode; sub?: ReactNode; icon?: ReactNode; accent?: boolean; progress?: number }) {
  return (
    <div className="surface relative overflow-hidden p-4 transition-shadow duration-200 hover:shadow-[var(--shadow-raised)]">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[12.5px] font-medium text-[var(--text-muted)]">{label}</p>
        {icon ? <span className={cx('flex size-8 shrink-0 items-center justify-center rounded-[9px]', accent ? 'bg-copper-100 text-copper-700' : 'bg-[var(--surface-sunken)] text-[var(--text-muted)]')}>{icon}</span> : null}
      </div>
      <p className="mt-2.5 text-[1.75rem] font-semibold leading-none tracking-tight tabular-nums">{value}</p>
      {sub ? <p className="mt-1.5 text-[12px] text-[var(--text-faint)]">{sub}</p> : null}
      {progress !== undefined ? (
        <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full" style={{ background: 'var(--mark-track)' }}>
          <div className="h-full rounded-full bg-copper-600 transition-[width] duration-700 ease-out" style={{ width: `${Math.max(0, Math.min(100, progress))}%` }} />
        </div>
      ) : null}
    </div>
  );
}
