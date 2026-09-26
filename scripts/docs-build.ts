/**
 * Builds the ISL branded marketing file and user manual as PDF.
 *
 *   npx tsx scripts/docs-shots.ts    first, to capture the screenshots
 *   npx tsx scripts/docs-build.ts    then this; writes docs/*.pdf and page previews
 *
 * The HTML sources live in docs/, styled by docs/isl.css from the ISL Brand
 * Guidelines. Icons are outline icons expanded from <i data-i="name">.
 */
import 'dotenv/config';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from '@playwright/test';
import { db } from '../src/lib/db';

const DOCS = resolve('docs');
const SHOTS = resolve('data/doc-shots');
const PREVIEW = resolve('data/doc-preview');
mkdirSync(PREVIEW, { recursive: true });

const ICONS: Record<string, string> = {
  video: '<path d="m16 13 5.2 3.1a.5.5 0 0 0 .8-.4V8.3a.5.5 0 0 0-.8-.4L16 11"/><rect x="2" y="6" width="14" height="12" rx="2"/>',
  file: '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M16 13H8"/><path d="M16 17H8"/>',
  text: '<path d="M4 7V4h16v3"/><path d="M9 20h6"/><path d="M12 4v16"/>',
  checks: '<path d="m3 17 2 2 4-4"/><path d="m3 7 2 2 4-4"/><path d="M13 6h8"/><path d="M13 12h8"/><path d="M13 18h8"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/>',
  lock: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  award: '<circle cx="12" cy="8" r="6"/><path d="M15.5 13.9 17 22l-5-3-5 3 1.5-8.1"/>',
  shield: '<path d="M20 13c0 5-3.5 7.5-7.7 9a1 1 0 0 1-.7 0C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.2-2.7a1.2 1.2 0 0 1 1.6 0C14.5 3.8 17 5 19 5a1 1 0 0 1 1 1Z"/>',
  chart: '<path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/>',
  upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.9"/><path d="M16 3.1a4 4 0 0 1 0 7.8"/>',
  clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
  list: '<path d="M8 6h13"/><path d="M8 12h13"/><path d="M8 18h13"/><path d="M3 6h.01"/><path d="M3 12h.01"/><path d="M3 18h.01"/>',
  building: '<rect x="4" y="2" width="16" height="20" rx="2"/><path d="M9 22v-4h6v4"/><path d="M8 6h.01M16 6h.01M12 6h.01M12 10h.01M12 14h.01M16 10h.01M16 14h.01M8 10h.01M8 14h.01"/>',
  school: '<path d="M22 10 12 5 2 10l10 5 10-5Z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/>',
  book: '<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2Z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7Z"/>',
  pen: '<path d="M12 20h9"/><path d="M16.4 3.6a2.1 2.1 0 1 1 3 3L7 19l-4 1 1-4Z"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M2 12h3M19 12h3M4.9 19.1 7 17M17 7l2.1-2.1"/>',
  phone: '<rect x="5" y="2" width="14" height="20" rx="2"/><path d="M12 18h.01"/>',
  info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>',
};

function expand(html: string) {
  return html.replace(/<i data-i="([a-z]+)"(?: style="([^"]*)")?><\/i>/g, (_, name: string, style?: string) => {
    if (!ICONS[name]) throw new Error(`unknown icon ${name}`);
    return `<svg viewBox="0 0 24 24"${style ? ` style="${style}"` : ''}>${ICONS[name]}</svg>`;
  });
}

/** The certificate as it would look on the production address, not localhost. */
async function certificateImage(browser: import('@playwright/test').Browser) {
  process.env.APP_URL = 'https://mada.isleaders.sa';
  const { certificateHtml } = await import('../src/lib/certificate-document');
  const cert = await db.certificate.findFirstOrThrow({ where: { status: 'Valid', courseTitle: 'مهارات الإشراف للقادة الجدد' }, orderBy: { issuedAt: 'desc' } });
  const html = await certificateHtml({ ...cert, brandColor: '#475A7D', logo: null });
  const page = await browser.newPage({ viewport: { width: 1123, height: 794 }, deviceScaleFactor: 1.6 });
  await page.setContent(html, { waitUntil: 'networkidle' });
  await page.evaluate('document.fonts.ready');
  await page.locator('.frame').screenshot({ path: join(SHOTS, 'certificate-doc.jpg'), type: 'jpeg', quality: 90 });
  await page.close();
}

async function build(browser: import('@playwright/test').Browser, source: string, output: string) {
  const html = expand(readFileSync(join(DOCS, source), 'utf8'));
  const built = join(DOCS, `.${source}`);
  writeFileSync(built, html);
  const page = await browser.newPage({ viewport: { width: 794, height: 1123 } });
  await page.goto(pathToFileURL(built).href, { waitUntil: 'networkidle' });
  await page.evaluate('document.fonts.ready');
  await page.waitForTimeout(500);
  // Any page whose content spills past its frame is a layout bug, reported before printing.
  const overflow = (await page.evaluate(`[...document.querySelectorAll('.page')].map((p, i) => ({ i: i + 1, over: p.scrollHeight - p.clientHeight })).filter((x) => x.over > 2)`)) as { i: number; over: number }[];
  if (overflow.length) console.log(`  ! ${source}: content overflows on pages ${overflow.map((x) => `${x.i} (+${x.over}px)`).join(', ')}`);
  await page.pdf({ path: join(DOCS, output), preferCSSPageSize: true, printBackground: true });
  const pages = await page.locator('.page').count();
  const name = source.replace('.ar.html', '');
  for (let i = 0; i < pages; i++) await page.locator('.page').nth(i).screenshot({ path: join(PREVIEW, `${name}-${String(i + 1).padStart(2, '0')}.png`) });
  await page.close();
  console.log(`  ${output}: ${pages} pages`);
}

const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  await certificateImage(browser);
  const only = process.argv[2];
  if (!only || only === 'brochure') await build(browser, 'brochure.ar.html', 'Mada_Marketing_ISL_AR.pdf');
  if (!only || only === 'manual') await build(browser, 'manual.ar.html', 'Mada_User_Manual_ISL_AR.pdf');
} finally {
  await browser.close();
  await db.$disconnect();
}
