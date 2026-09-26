import { notFound } from 'next/navigation';
import { loadActor, requireShell } from './session-state';
import { isLocale, getDictionary, type Locale } from '@/i18n/dictionary';
import { DomainError, type Role } from './domain';
import type { Actor } from './access';
import type { ShellState } from './types';

/**
 * Resolves the locale and the actor, reporting whether the signed-in role may
 * see this page. The API enforces the same rules; this only keeps navigation
 * honest.
 *
 * It reports rather than redirects on purpose: these pages stream, and a
 * streaming `redirect()` degrades to a one-second `<meta http-equiv="refresh">`
 * on the client. Rendering a denial is instant and tells the user why.
 */
export async function pageState(
  params: Promise<{ locale: string }>,
  allowed?: Role[],
): Promise<{ locale: Locale; shell: ShellState; actor: Actor; permitted: boolean }> {
  const { locale: raw } = await params;
  const locale: Locale = isLocale(raw) ? raw : 'ar';
  const shell = await requireShell(locale);
  const actor = await loadActor();
  const permitted = !allowed || allowed.includes(actor.role);
  return { locale, shell, actor, permitted };
}

/** Runs a scoped read and turns "not yours" into a plain 404. */
export async function orNotFound<T>(read: Promise<T>): Promise<T> {
  try {
    return await read;
  } catch (error) {
    if (error instanceof DomainError && error.status === 404) notFound();
    throw error;
  }
}

export async function pageTitle(
  params: Promise<{ locale: string }>,
  key: keyof ReturnType<typeof getDictionary>['nav'],
) {
  const { locale } = await params;
  const t = getDictionary(isLocale(locale) ? locale : 'ar');
  return { title: t.nav[key] as string };
}
