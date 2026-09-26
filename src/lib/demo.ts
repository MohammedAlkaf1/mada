/** Shared between the seed script and the sign-in screen so they never drift. */
export const DEMO_PASSWORD = 'Demo@12345';
/** A reserved test domain, so no demo mail can ever reach a real inbox. */
export const DEMO_DOMAIN = '@mada.test';

export const DEMO_ACCOUNTS = [
  { email: 'admin@mada.test', role: 'Admin', name: 'ريم العتيبي' },
  { email: 'trainer@mada.test', role: 'Instructor', name: 'خالد الزهراني' },
  { email: 'learner@mada.test', role: 'Learner', name: 'نورة القحطاني' },
] as const;

/** The sign-in screen only offers these when the workspace was seeded for a demo. */
export function demoLoginEnabled() {
  return process.env.DEMO_LOGIN === '1';
}
