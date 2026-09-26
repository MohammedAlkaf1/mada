import { cache } from 'react';
import { redirect } from 'next/navigation';
import { actor } from './access';
import { isOperator } from './operator-access';
import { shellFor } from './queries';
import { DomainError } from './domain';
import type { ShellState } from './types';
import type { Locale } from '@/i18n/dictionary';

/**
 * Deduplicated per request: the layout and the page both call these, but the
 * database is only read once.
 */
export const loadActor = cache(actor);

export const loadShell = cache(async (): Promise<ShellState> => shellFor(await loadActor()));

/**
 * Whether the current session still resolves to a usable actor.
 *
 * The session is a self-contained JWT valid for hours, but the account behind
 * it can be deactivated, lose its last membership, or have its tenant removed
 * at any moment. Pages that redirect *away* from sign-in must apply this test
 * rather than trusting the cookie: otherwise sign-in bounces to the dashboard,
 * the dashboard bounces back, and the browser reports ERR_TOO_MANY_REDIRECTS.
 */
export async function sessionIsUsable() {
  try {
    await loadActor();
    return true;
  } catch {
    return false;
  }
}

/** Sends anyone without a valid session back to the sign-in page. */
export async function handleSessionError(error: unknown, locale: Locale): Promise<never> {
  if (error instanceof DomainError && error.code === 'mfaRequired') redirect(`/${locale}/security`);
  // A platform operator need not belong to any tenant; their home is the operator panel.
  if (error instanceof DomainError && error.status === 403 && (await isOperator())) redirect(`/${locale}/operator`);
  if (error instanceof DomainError && (error.status === 401 || error.status === 403)) redirect(`/${locale}/login`);
  throw error;
}

export async function requireShell(locale: Locale): Promise<ShellState> {
  try {
    return await loadShell();
  } catch (error) {
    return handleSessionError(error, locale);
  }
}
