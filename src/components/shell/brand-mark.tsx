import { getDictionary, type Locale } from '@/i18n/dictionary';

import { MARK_PATHS } from '@/lib/brand';

/**
 * The Mada mark: two arcs rising from one point, a horizon widening outwards.
 * The geometry lives in src/lib/brand.ts and is shared with the documents
 * and src/app/icon.svg; change them together.
 */
export function BrandIcon({
  size = 36,
  variant = 'navy',
  className,
}: {
  size?: number;
  /** navy: teal arcs on the ink tile. copper: sand arcs on a teal tile. mono: current text colour, no tile. */
  variant?: 'navy' | 'copper' | 'mono';
  className?: string;
}) {
  const palette =
    variant === 'navy'
      ? { tile: MARK_PATHS.tile, outer: MARK_PATHS.outer, inner: MARK_PATHS.inner }
      : variant === 'copper'
        ? { tile: '#0E7C74', outer: '#ECE8DC', inner: '#16323B' }
        : { tile: null, outer: 'currentColor', inner: 'currentColor' };
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden focusable="false" className={className}>
      {palette.tile ? <rect width="64" height="64" rx="16" fill={palette.tile} /> : null}
      <path d={MARK_PATHS.outerArc} fill="none" stroke={palette.outer} strokeWidth="5.5" strokeLinecap="round" />
      <path d={MARK_PATHS.innerArc} fill="none" stroke={palette.inner} strokeWidth="5" strokeLinecap="round" />
      <circle cx="32" cy="43.5" r="3.4" fill={palette.outer} />
    </svg>
  );
}

export function BrandMark({
  locale,
  tone = 'dark',
  compact = false,
}: {
  locale: Locale;
  tone?: 'light' | 'dark';
  compact?: boolean;
}) {
  const t = getDictionary(locale);
  return (
    <div className="flex items-center gap-3">
      <BrandIcon size={36} variant={tone === 'light' ? 'copper' : 'navy'} className="shrink-0 rounded-[10px]" />
      {!compact ? (
        <span className="min-w-0">
          <span
            className={`block truncate text-[15px] font-semibold tracking-tight ${
              tone === 'light' ? 'text-ivory-500' : 'text-[var(--text-strong)]'
            }`}
          >
            {t.brand}
          </span>
          <span
            className={`block truncate text-[11.5px] ${
              tone === 'light' ? 'text-navy-300' : 'text-[var(--text-faint)]'
            }`}
          >
            {t.brandTag}
          </span>
        </span>
      ) : null}
    </div>
  );
}
