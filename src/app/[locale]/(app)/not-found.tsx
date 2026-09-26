import Link from 'next/link';
import { SearchX } from 'lucide-react';

/**
 * Shown for any record the signed in person cannot see, whether it does not
 * exist or belongs to another organization: the two cases look identical on
 * purpose, so an id reveals nothing (FR-04).
 */
export default function NotFound() {
  return (
    <div className="surface flex flex-col items-center justify-center gap-4 px-6 py-20 text-center" data-not-found>
      <span className="flex size-12 items-center justify-center rounded-full bg-[var(--surface-sunken)] text-[var(--text-faint)]">
        <SearchX size={21} />
      </span>
      <div>
        <p className="text-[15px] font-semibold">العنصر غير موجود</p>
        <p className="mt-1.5 text-[13px] text-[var(--text-muted)]">Not found</p>
      </div>
      <Link href="/" className="inline-flex h-10 items-center rounded-[10px] bg-navy-900 px-4 text-sm font-medium text-white transition-colors hover:bg-navy-800">
        الرئيسية · Home
      </Link>
    </div>
  );
}
