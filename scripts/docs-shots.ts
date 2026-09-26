/**
 * Captures the screenshots used by the marketing file and the user manual.
 * Walks the running app as each demo role, on the seeded demo data, with the
 * demo organization temporarily wearing the ISL slate blue so the pictures
 * sit well on ISL branded pages. The colour is restored at the end.
 *
 *   npx tsx scripts/docs-shots.ts     (needs db:start, dev and db:seed)
 */
import 'dotenv/config';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { chromium, type Page } from '@playwright/test';
import { db } from '../src/lib/db';
import { otp, unseal } from '../src/lib/totp';

const base = process.env.CHECK_BASE_URL ?? 'http://127.0.0.1:3100';
const dir = join(process.cwd(), 'data', 'doc-shots');
mkdirSync(dir, { recursive: true });
const ISL_SLATE = '#475A7D';
let draftId = '';

const browser = await chromium.launch({ channel: 'msedge', headless: true });

async function login(email: string, width = 1440, height = 900) {
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1.5, locale: 'ar-SA' });
  const page = await context.newPage();
  await page.goto(`${base}/ar/login`, { waitUntil: 'networkidle' });
  const u = await db.user.findUniqueOrThrow({ where: { email } });
  let s = Math.floor(Date.now() / 30000);
  while (s <= u.mfaLastStep) { await new Promise((r) => setTimeout(r, 1000)); s = Math.floor(Date.now() / 30000); }
  await page.locator('input[type=email]').fill(email);
  await page.locator('input[type=password]').first().fill('Demo@12345');
  await page.locator('input[autocomplete="one-time-code"]').fill(otp(unseal(u.mfaSecret!), s));
  await page.locator('button[type=submit]').click();
  await page.waitForURL(`${base}/ar`, { waitUntil: 'domcontentloaded' });
  // The dev tools badge is not part of the product.
  await page.addStyleTag({ content: 'nextjs-portal{display:none!important}' }).catch(() => {});
  return page;
}

async function shot(page: Page, name: string, opts: { path?: string; full?: boolean; clip?: string; wait?: number } = {}) {
  if (opts.path) await page.goto(`${base}${opts.path}`, { waitUntil: 'networkidle' });
  await page.addStyleTag({ content: 'nextjs-portal{display:none!important}' }).catch(() => {});
  await page.waitForTimeout(opts.wait ?? 500);
  const file = join(dir, `${name}.jpg`);
  if (opts.clip) await page.locator(opts.clip).first().screenshot({ path: file, type: 'jpeg', quality: 86 });
  else await page.screenshot({ path: file, type: 'jpeg', quality: 86, fullPage: opts.full ?? false });
  console.log(' •', name);
}

const tenant = await db.tenant.findUniqueOrThrow({ where: { slug: 'nakhla' } });
const original = tenant.brandColor;
await db.tenant.update({ where: { id: tenant.id }, data: { brandColor: ISL_SLATE } });
try {
  const course = await db.course.findFirstOrThrow({ where: { tenantId: tenant.id, title: 'مهارات الإشراف للقادة الجدد' } });
  const version = await db.courseVersion.findFirstOrThrow({ where: { courseId: course.id, status: 'Published' }, include: { lessons: { orderBy: { position: 'asc' } } } });

  /* Public */
  const visitor = await (await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1.5 })).newPage();
  await shot(visitor, 'login', { path: '/ar/login' });
  const cert = await db.certificate.findFirst({ where: { tenantId: tenant.id, status: 'Valid' }, orderBy: { issuedAt: 'desc' } });
  if (cert) {
    await visitor.setViewportSize({ width: 640, height: 900 });
    await shot(visitor, 'verify', { path: `/c/${cert.verifyToken}`, clip: '.surface' });
    await visitor.setViewportSize({ width: 1440, height: 900 });
  }

  /* Admin */
  const a = await login('admin@mada.test');
  await shot(a, 'admin-dashboard', { path: '/ar' });
  await shot(a, 'courses', { path: '/ar/courses' });
  await shot(a, 'editor', { path: `/ar/courses/${course.id}` });
  await shot(a, 'editor-full', { path: `/ar/courses/${course.id}`, full: true });
  await a.getByRole('button', { name: 'الأسئلة' }).nth(2).click();
  await shot(a, 'lesson-questions', { clip: '[role=dialog]' });
  await a.keyboard.press('Escape');
  // The published version is locked by its learners; editing screenshots use a new draft, deleted at the end.
  const draft = (await a.evaluate(`fetch('/api/command',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'version.next',data:{courseId:'${course.id}'}})}).then(r=>r.json())`)) as { result: { id: string } };
  draftId = draft.result.id;
  await a.goto(`${base}/ar/courses/${course.id}?v=${draftId}`, { waitUntil: 'networkidle' });
  await shot(a, 'editor-draft');
  await a.locator('li', { hasText: 'دورك الجديد كمشرف' }).getByRole('button', { name: 'تعديل' }).click();
  await shot(a, 'lesson-video', { clip: '[role=dialog]' });
  await a.keyboard.press('Escape');
  await a.locator('li', { hasText: 'تطبيق عملي' }).getByRole('button', { name: 'تعديل' }).click();
  await shot(a, 'lesson-quiz', { clip: '[role=dialog]' });
  await a.keyboard.press('Escape');
  await a.locator('li', { hasText: 'تطبيق عملي' }).getByRole('button', { name: 'الأسئلة' }).click();
  await a.getByRole('dialog').getByRole('button', { name: 'تعديل' }).last().click();
  await shot(a, 'question-text', { clip: '[role=dialog]' });
  await a.keyboard.press('Escape');
  await a.goto(`${base}/ar/courses/${course.id}?v=${draftId}&tab=quiz`, { waitUntil: 'networkidle' });
  await shot(a, 'final-exam');
  await a.getByRole('button', { name: 'إضافة سؤال' }).click();
  await a.getByRole('dialog').getByRole('button', { name: /اختيار أكثر من إجابة/ }).click();
  await a.getByRole('dialog').locator('textarea').first().fill('أي مما يلي من بنود الاجتماع اليومي؟');
  const inputs = a.getByRole('dialog').locator('input[placeholder]');
  await inputs.nth(0).fill('نتيجة الأمس');
  await inputs.nth(1).fill('مناقشة تفصيلية لكل مشكلة');
  await inputs.nth(2).fill('أولوية اليوم');
  await a.getByRole('dialog').locator('input[type=checkbox]').nth(0).check();
  await a.getByRole('dialog').locator('input[type=checkbox]').nth(2).check();
  await shot(a, 'question-multiple', { clip: '[role=dialog]' });
  await a.keyboard.press('Escape');
  await a.evaluate(`fetch('/api/command',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'version.discard',data:{id:'${draftId}'}})})`);
  draftId = '';
  await a.goto(`${base}/ar/courses/${course.id}`, { waitUntil: 'networkidle' });
  await a.getByRole('button', { name: 'إسناد' }).click();
  await shot(a, 'assign', { clip: '[role=dialog]' });
  await a.keyboard.press('Escape');
  await shot(a, 'learners', { path: `/ar/courses/${course.id}?tab=learners` });
  await a.getByRole('tab', { name: /المتدربون/ }).click().catch(() => {});
  await shot(a, 'learners');
  await shot(a, 'people', { path: '/ar/people' });
  await a.getByRole('button', { name: 'إضافة مستخدم' }).click();
  await shot(a, 'invite', { clip: '[role=dialog]' });
  await a.keyboard.press('Escape');
  await a.getByRole('tab', { name: /المجموعات/ }).click();
  await shot(a, 'groups');
  await a.getByRole('tab', { name: /الاستيراد/ }).click();
  await shot(a, 'import');
  await shot(a, 'reports', { path: '/ar/reports' });
  await shot(a, 'certificates', { path: '/ar/certificates' });
  await shot(a, 'settings', { path: '/ar/settings' });
  await shot(a, 'billing', { path: '/ar/billing' });
  await shot(a, 'audit', { path: '/ar/audit' });
  if (cert) {
    const doc = await a.context().newPage();
    await doc.setViewportSize({ width: 1123, height: 794 });
    await doc.goto(`${base}/api/certificates/${cert.id}/pdf?format=html`, { waitUntil: 'networkidle' });
    await doc.waitForTimeout(800);
    await doc.screenshot({ path: join(dir, 'certificate.jpg'), type: 'jpeg', quality: 90 });
    console.log(' • certificate');
  }

  /* Instructor */
  const tr = await login('trainer@mada.test');
  await shot(tr, 'review', { path: '/ar/review' });
  const pending = await db.quizAttempt.findFirst({ where: { tenantId: tenant.id, status: 'Review', scope: 'final' } });
  if (pending) await shot(tr, 'review-form', { path: `/ar/review/${pending.id}`, full: true });
  if (pending) await shot(tr, 'review-written', { clip: 'main ol > li:last-child' });

  /* Learner */
  const l = await login('learner@mada.test');
  await shot(l, 'learner-home', { path: '/ar' });
  const e = await db.enrollment.findFirstOrThrow({ where: { courseId: course.id, membership: { user: { email: 'learner@mada.test' } } } });
  await l.goto(`${base}/ar/learn/${e.id}`, { waitUntil: 'networkidle' });
  await l.waitForTimeout(2500);
  await l.evaluate(`(() => { const v = document.querySelector('video'); if (v) { v.muted = true; v.currentTime = 14; } })()`);
  await shot(l, 'player-video', { wait: 1800 });
  const text = version.lessons.find((x) => x.kind === 'Text')!;
  await shot(l, 'player-text', { path: `/ar/learn/${e.id}?l=${text.id}` });
  const pdf = version.lessons.find((x) => x.kind === 'Pdf');
  if (pdf) await shot(l, 'player-pdf', { path: `/ar/learn/${e.id}?l=${pdf.id}`, wait: 1500 });
  const practice = version.lessons.find((x) => x.kind === 'Quiz' && !x.graded)!;
  await shot(l, 'player-quiz', { path: `/ar/learn/${e.id}?l=${practice.id}` });
  await l.getByRole('button', { name: 'ابدأ الاختبار' }).click();
  await l.waitForURL(/quiz/);
  await l.getByText('صح', { exact: true }).first().click();
  await l.waitForTimeout(700);
  await shot(l, 'quiz', { full: true });
  l.once('dialog', (d) => void d.accept());
  await l.getByRole('button', { name: 'تسليم الاختبار' }).click();
  await l.waitForTimeout(2500);
  await shot(l, 'quiz-result');
  await shot(l, 'my-certificates', { path: '/ar/my-certificates' });

  const phone = await login('learner@mada.test', 390, 844);
  await shot(phone, 'phone-home', { path: '/ar' });
  await phone.goto(`${base}/ar/learn/${e.id}`, { waitUntil: 'networkidle' });
  await shot(phone, 'phone-player', { wait: 1500 });

  // Undo what the tour did to the demo learner, so the example course stays fresh.
  await db.quizAttempt.deleteMany({ where: { enrollmentId: e.id } });
  await db.lessonProgress.deleteMany({ where: { enrollmentId: e.id } });
  await db.enrollment.update({ where: { id: e.id }, data: { status: 'NotStarted', startedAt: null, requiredDone: 0 } });
} finally {
  if (draftId) {
    await db.question.deleteMany({ where: { versionId: draftId } });
    await db.lesson.deleteMany({ where: { versionId: draftId } });
    await db.module.deleteMany({ where: { versionId: draftId } });
    await db.courseVersion.delete({ where: { id: draftId } }).catch(() => {});
  }
  await db.tenant.update({ where: { id: tenant.id }, data: { brandColor: original } });
  await browser.close();
  await db.$disconnect();
}
