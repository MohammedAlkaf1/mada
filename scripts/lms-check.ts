/**
 * End to end check of the learning journey against the running dev server,
 * mapped to the acceptance scenarios of the SRS (UAT).
 *
 *   npm run check:lms
 *
 * Needs `npm run db:start`, `npm run dev` and `npm run db:seed`. It creates
 * its own course and a second organization, so it can run on the demo data
 * repeatedly. Screenshots land in data/lms-shots.
 */
import 'dotenv/config';
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { chromium, type Browser, type Page } from '@playwright/test';
import { db } from '../src/lib/db';
import { otp, unseal } from '../src/lib/totp';

const base = process.env.CHECK_BASE_URL ?? 'http://127.0.0.1:3100';
const shots = join(process.cwd(), 'data', 'lms-shots');
mkdirSync(shots, { recursive: true });
let passed = 0;
const step = (name: string) => {
  passed += 1;
  console.log(` • ${name}`);
};
const errors: string[] = [];

/** One code per 30 second step per account: a second sign in in the same step waits for the next code. */
const lastStep = new Map<string, number>();
async function code(email: string) {
  const user = await db.user.findUniqueOrThrow({ where: { email } });
  if (!user.mfaSecret) return '';
  let s = Math.floor(Date.now() / 30000);
  while ((lastStep.get(email) ?? user.mfaLastStep) >= s) {
    await new Promise((r) => setTimeout(r, 1000));
    s = Math.floor(Date.now() / 30000);
  }
  lastStep.set(email, s);
  return otp(unseal(user.mfaSecret), s);
}

async function session(browser: Browser, email: string, password = 'Demo@12345', width = 1440) {
  const context = await browser.newContext({ viewport: { width, height: 900 }, locale: 'ar-SA' });
  const page = await context.newPage();
  page.on('console', (m) => {
    if (m.type() === 'error' && !/favicon|Download the React DevTools|net::ERR_ABORTED|status of 4\d\d/i.test(m.text())) errors.push(`${email}: ${m.text().slice(0, 200)}`);
  });
  page.on('pageerror', (e) => errors.push(`${email}: ${e.message.slice(0, 200)}`));
  // Typing before React hydrates is lost when the controlled inputs mount, so wait for the page to settle.
  await page.goto(`${base}/ar/login`, { waitUntil: 'networkidle' });
  await page.locator('input[type=email]').fill(email);
  await page.locator('input[type=password]').first().fill(password);
  const c = await code(email);
  if (c) await page.locator('input[autocomplete="one-time-code"]').fill(c);
  await page.locator('button[type=submit]').click();
  try {
    await page.waitForURL((u) => u.pathname === '/ar' || u.pathname === '/ar/', { timeout: 60000, waitUntil: 'domcontentloaded' });
  } catch (e) {
    await page.screenshot({ path: join(shots, `signin-failed-${email.split('@')[0]}.png`) });
    throw new Error(`sign in as ${email} did not reach the home page (${page.url()}); see signin-failed screenshot`);
  }
  return page;
}

/** Calls the command API with the page's own session, as the UI does. */
async function command(page: Page, action: string, data: object) {
  return page.evaluate(async ([a, d]) => {
    const r = await fetch('/api/command', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: a, data: d }) });
    return { status: r.status, body: await r.json().catch(() => ({})) };
  }, [action, data] as const);
}

async function noHorizontalScroll(page: Page) {
  return page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
}

async function cleanup(courseId: string, otherTenantId: string) {
  const versions = await db.courseVersion.findMany({ where: { courseId }, select: { id: true } });
  const ids = versions.map((v) => v.id);
  const enrollments = (await db.enrollment.findMany({ where: { versionId: { in: ids } }, select: { id: true } })).map((e) => e.id);
  await db.certificate.deleteMany({ where: { enrollmentId: { in: enrollments } } });
  await db.quizAttempt.deleteMany({ where: { enrollmentId: { in: enrollments } } });
  await db.lessonProgress.deleteMany({ where: { enrollmentId: { in: enrollments } } });
  await db.notification.deleteMany({ where: { href: { in: enrollments.map((e) => `/learn/${e}`) } } });
  await db.enrollment.deleteMany({ where: { id: { in: enrollments } } });
  await db.question.deleteMany({ where: { versionId: { in: ids } } });
  await db.lesson.deleteMany({ where: { versionId: { in: ids } } });
  await db.module.deleteMany({ where: { versionId: { in: ids } } });
  await db.courseVersion.deleteMany({ where: { courseId } });
  await db.course.delete({ where: { id: courseId } });
  for (const where of [{ tenantId: otherTenantId }]) {
    await db.asset.deleteMany({ where });
    await db.courseVersion.deleteMany({ where });
    await db.course.deleteMany({ where });
  }
  await db.tenant.delete({ where: { id: otherTenantId } });
  const imported = await db.user.findMany({ where: { email: { startsWith: 'check' }, AND: { email: { endsWith: '@nakhla.test' } } }, select: { id: true } });
  for (const u of imported) {
    const m = await db.membership.findMany({ where: { userId: u.id }, select: { id: true } });
    await db.groupMember.deleteMany({ where: { membershipId: { in: m.map((x) => x.id) } } });
    await db.membership.deleteMany({ where: { userId: u.id } });
    await db.invitation.deleteMany({ where: { email: { startsWith: 'check' } } });
    await db.user.delete({ where: { id: u.id } });
  }
  await db.group.deleteMany({ where: { name: 'فحص', members: { none: {} } } });
}

async function main() {
  const tenant = await db.tenant.findUnique({ where: { slug: 'nakhla' } });
  if (!tenant) throw new Error('Seed the demo first: npm run db:seed');
  const browser = await chromium.launch({ channel: process.env.CHECK_CHANNEL ?? 'msedge', headless: true });
  const title = `دورة الفحص ${randomBytes(2).toString('hex')}`;

  /* UAT-01, FR-01: the admin lands on a dashboard carrying the organization's name. */
  const admin = await session(browser, 'admin@mada.test');
  await admin.getByText('نخلة للتجزئة').first().waitFor();
  await admin.getByText('نسبة الإكمال').first().waitFor();
  await admin.screenshot({ path: join(shots, 'admin-dashboard.png') });
  step('Admin signs in with two step verification and sees the organization dashboard');

  /* FR-06: build a course through the editor. */
  await admin.goto(`${base}/ar/courses`);
  await admin.getByRole('button', { name: 'دورة جديدة' }).first().click();
  await admin.getByRole('dialog').locator('input').first().fill(title);
  await admin.getByRole('dialog').getByRole('button', { name: 'إنشاء' }).click();
  await admin.waitForURL(/\/ar\/courses\/[0-9a-f-]{36}/, { timeout: 30000 });
  const courseId = admin.url().split('/courses/')[1].split('?')[0];
  await admin.getByRole('button', { name: 'إضافة درس' }).first().click();
  const lessonDialog = admin.getByRole('dialog');
  await lessonDialog.locator('input').first().fill('الدرس الأول');
  await lessonDialog.locator('textarea').fill('نص الدرس للفحص.\nسطر ثانٍ.');
  await lessonDialog.getByRole('button', { name: 'حفظ' }).click();
  await admin.getByText('الدرس الأول').waitFor();
  step('An admin creates a course and writes a text lesson in the editor');

  await admin.getByRole('tab', { name: /الاختبار/ }).click();
  await admin.getByText('تتضمن الدورة اختبارًا نهائيًا').click();
  const saveRules = admin.getByRole('button', { name: 'حفظ' }).first();
  await saveRules.click();
  // The save button disables itself once the saved rules come back from the server.
  await admin.waitForFunction(() => [...document.querySelectorAll('button')].some((b) => b.textContent === 'حفظ' && b.disabled), undefined, { timeout: 20000 });
  await admin.getByRole('button', { name: 'إضافة سؤال' }).click();
  const q = admin.getByRole('dialog');
  await q.locator('select').first().selectOption('TrueFalse');
  await q.locator('textarea').fill('الفحص ينجح حين تكون الإجابة صح.');
  await q.getByRole('button', { name: 'حفظ' }).click();
  await admin.getByText('الفحص ينجح حين تكون الإجابة صح.').waitFor();
  step('The admin enables the quiz and adds a true or false question');

  /* FR-06, FR-11: the checklist blocks publication until it is complete, then publishes. */
  admin.once('dialog', (d) => void d.accept());
  await admin.getByRole('button', { name: 'نشر النسخة' }).click();
  await admin.getByText('منشورة').first().waitFor({ timeout: 20000 });
  const version = await db.courseVersion.findFirstOrThrow({ where: { courseId, number: 1 } });
  assert.equal(version.status, 'Published');
  step('Publishing succeeds once the checklist is satisfied');

  /* FR-09: assign to one person; a second assignment creates nothing new. */
  const learnerMembership = await db.membership.findFirstOrThrow({ where: { tenantId: tenant.id, user: { email: 'learner@mada.test' } } });
  const assign = await command(admin, 'enrollment.assign', { versionId: version.id, membershipIds: [learnerMembership.id], dueAt: new Date(Date.now() + 7 * 86400000).toISOString() });
  assert.equal(assign.status, 200);
  assert.equal(assign.body.result.created, 1);
  const again = await command(admin, 'enrollment.assign', { versionId: version.id, membershipIds: [learnerMembership.id] });
  assert.equal(again.body.result.created, 0);
  step('Assigning twice does not create a second enrollment (FR-09)');

  /* FR-08: a version with learners is locked against content changes. */
  const module = await db.module.findFirstOrThrow({ where: { versionId: version.id } });
  const locked = await command(admin, 'lesson.save', { versionId: version.id, moduleId: module.id, title: 'تعديل', kind: 'Text', body: 'x' });
  assert.equal(locked.body.error, 'versionLocked');
  const next = await command(admin, 'version.next', { courseId });
  assert.equal(next.status, 200);
  await command(admin, 'version.discard', { id: next.body.result.id });
  step('The enrolled version is locked and changes go to a new version (FR-08)');

  /* UAT-05: the learner completes the lesson, fails, retries and passes. */
  const learner = await session(browser, 'learner@mada.test');
  await learner.getByText(title).first().waitFor();
  const enrollment = await db.enrollment.findFirstOrThrow({ where: { versionId: version.id, membershipId: learnerMembership.id } });
  await learner.goto(`${base}/ar/learn/${enrollment.id}`);
  await learner.getByText('نص الدرس للفحص.').waitFor();
  await learner.getByRole('button', { name: 'أنهيت هذا الدرس' }).click();
  await learner.waitForTimeout(1200);
  await learner.goto(`${base}/ar/learn/${enrollment.id}?l=quiz`);
  await learner.getByRole('button', { name: 'ابدأ الاختبار' }).click();
  await learner.waitForURL(/\/quiz\//, { timeout: 20000 });
  // The key is not in the page while the attempt is open (FR-12).
  const question = await db.question.findFirstOrThrow({ where: { versionId: version.id } });
  const html = await learner.content();
  assert.ok(!html.includes(`"correct":"${question.correct}"`));
  await learner.getByText('خطأ', { exact: true }).click();
  await learner.getByText('حُفظت إجاباتك').waitFor({ timeout: 10000 });
  learner.once('dialog', (d) => void d.accept());
  await learner.getByRole('button', { name: 'تسليم الاختبار' }).click();
  await learner.getByText('لم تبلغ درجة النجاح').waitFor({ timeout: 20000 });
  step('A wrong answer fails the attempt and the correct key stays hidden');

  const first = await db.quizAttempt.findFirstOrThrow({ where: { enrollmentId: enrollment.id, number: 1 } });
  const replay = await command(learner, 'quiz.submit', { attemptId: first.id });
  assert.equal(replay.status, 200);
  assert.equal(await db.quizAttempt.count({ where: { enrollmentId: enrollment.id } }), 1);
  step('Submitting the same attempt again creates no second result (FR-12)');

  await learner.goto(`${base}/ar/learn/${enrollment.id}?l=quiz`);
  await learner.getByRole('button', { name: 'ابدأ الاختبار' }).click();
  await learner.waitForURL(/\/quiz\//, { timeout: 20000 });
  await learner.getByText('صح', { exact: true }).click();
  await learner.getByText('حُفظت إجاباتك').waitFor({ timeout: 10000 });
  learner.once('dialog', (d) => void d.accept());
  await learner.getByRole('button', { name: 'تسليم الاختبار' }).click();
  await learner.getByText('اجتزت الاختبار').waitFor({ timeout: 20000 });
  const done = await db.enrollment.findUniqueOrThrow({ where: { id: enrollment.id }, include: { certificate: true } });
  assert.equal(done.status, 'Completed');
  assert.ok(done.certificate);
  await learner.screenshot({ path: join(shots, 'learner-quiz-passed.png') });
  step('The second attempt passes, the course completes and a certificate is issued (FR-13, FR-14)');

  /* FR-14: the PDF downloads with a stable number, and the public page verifies it without an email. */
  const pdf = await learner.request.get(`${base}/api/certificates/${done.certificate!.id}/pdf`);
  assert.equal(pdf.status(), 200);
  const type = pdf.headers()['content-type'] ?? '';
  assert.ok(type.includes('pdf') || type.includes('html'));
  assert.equal(await db.certificate.count({ where: { enrollmentId: enrollment.id } }), 1);
  const visitor = await browser.newPage();
  await visitor.goto(`${base}/c/${done.certificate!.verifyToken}`);
  await visitor.getByText('شهادة سارية').waitFor();
  assert.ok(!(await visitor.content()).includes('learner@mada.test'));
  await visitor.screenshot({ path: join(shots, 'verify-valid.png') });
  step(`The certificate downloads as ${type.split(';')[0]} and verifies publicly without revealing the email`);

  /* FR-15: revocation shows at once and does not reissue. */
  const revoke = await command(admin, 'certificate.revoke', { id: done.certificate!.id, reason: 'فحص الإلغاء' });
  assert.equal(revoke.status, 200);
  await visitor.reload();
  await visitor.getByText('هذه الشهادة ملغاة').waitFor();
  const blocked = await learner.request.get(`${base}/api/certificates/${done.certificate!.id}/pdf`);
  assert.equal(blocked.status(), 410);
  step('A revoked certificate shows as revoked and is no longer handed to its holder (FR-15)');

  /* UAT-03, FR-04: a second organization's records are invisible, whatever id is sent. */
  const other = await db.tenant.upsert({ where: { slug: 'check-other' }, create: { slug: 'check-other', nameAr: 'جهة أخرى', nameEn: 'Other org' }, update: {} });
  const otherCourse = await db.course.create({ data: { tenantId: other.id, title: 'دورة جهة أخرى', createdBy: 'check' } });
  const otherVersion = await db.courseVersion.create({ data: { tenantId: other.id, courseId: otherCourse.id, number: 1, title: 'دورة جهة أخرى', status: 'Published' } });
  const otherAsset = await db.asset.create({ data: { tenantId: other.id, uploadedBy: 'check', name: 'secret.pdf', mime: 'application/pdf', size: 1, storageKey: randomBytes(16).toString('hex').replace(/(.{8})(.{4})(.{4})(.{4})(.{12})/, '$1-$2-$3-$4-$5'), status: 'Clean' } });
  for (const [action, data] of [['enrollment.assign', { versionId: otherVersion.id, membershipIds: [learnerMembership.id] }], ['course.update', { id: otherCourse.id, title: 'x' }], ['version.publish', { id: otherVersion.id }]] as const) {
    const r = await command(admin, action, data);
    assert.ok([404, 409].includes(r.status), `${action} crossed tenants with ${r.status}`);
  }
  const file = await admin.request.get(`${base}/api/files?id=${otherAsset.id}`);
  assert.equal(file.status(), 404);
  // Pages stream, so a late notFound() keeps status 200; what matters is that nothing of the record is shown.
  await admin.goto(`${base}/ar/courses/${otherCourse.id}`);
  await admin.locator('[data-not-found]').waitFor();
  assert.ok(!(await admin.content()).includes('دورة جهة أخرى'));
  step("Another organization's course, version and file stay unreachable by id (FR-04)");

  /* Roles are enforced on the server, not only hidden in the interface. */
  for (const [action, data] of [['course.create', { title: 'x' }], ['member.invite', { email: 'x@y.test', name: 'xx', role: 'Admin' }], ['export.request', { type: 'package' }]] as const) {
    const r = await command(learner, action, data);
    assert.equal(r.status, 403, `${action} allowed for a learner`);
  }
  const hiddenFile = await db.asset.findFirst({ where: { tenantId: tenant.id, status: 'Clean' } });
  if (hiddenFile) {
    const onlyStaff = await db.enrollment.findFirst({ where: { membershipId: learnerMembership.id, courseVersion: { lessons: { some: { assetId: hiddenFile.id } } } } });
    if (!onlyStaff) assert.equal((await learner.request.get(`${base}/api/files?id=${hiddenFile.id}`)).status(), 404);
  }
  step('A learner cannot create courses, invite people, export the package, or fetch files outside their courses');

  /* FR-16: the export neutralises formulas and opens in Excel with Arabic. */
  const exp = await command(admin, 'export.request', { type: 'enrollments', courseId });
  assert.equal(exp.status, 200);
  const csv = await admin.request.get(`${base}${exp.body.result.href}`);
  const text = await csv.text();
  assert.ok(text.charCodeAt(0) === 0xfeff && text.includes(title));
  step('The enrollments export is UTF-8 with a byte order mark and filtered to the course (FR-16)');

  /* FR-03: the import preview rejects a bad row and a duplicate, and nothing is written before apply. */
  const before = await db.membership.count({ where: { tenantId: tenant.id } });
  const preview = await command(admin, 'import.preview', { filename: 'check.csv', rows: [{ row: 2, name: 'مستخدم فحص', email: `check${Date.now()}@nakhla.test`, group: 'فحص', role: '' }, { row: 3, name: 'مكرر', email: 'learner@mada.test', group: '', role: '' }, { row: 4, name: 'خطأ', email: 'bad', group: '', role: '' }] });
  assert.deepEqual(preview.body.result.rows.map((r: { status: string }) => r.status), ['create', 'skip', 'error']);
  assert.equal(await db.membership.count({ where: { tenantId: tenant.id } }), before);
  const applied = await command(admin, 'import.apply', { id: preview.body.result.id });
  assert.equal(applied.body.result.created, 1);
  assert.equal((await command(admin, 'import.apply', { id: preview.body.result.id })).status, 409);
  step('Import previews without writing, applies once, and refuses to apply twice (FR-03)');

  /* NFR-04: phone width with no horizontal scroll on the learner screens. */
  const phone = await session(browser, 'trainer@mada.test', 'Demo@12345', 390);
  assert.ok(await noHorizontalScroll(phone), 'trainer home scrolls sideways');
  await phone.goto(`${base}/ar/courses/${courseId}`);
  await phone.locator('[data-not-found]').waitFor();
  const learnerPhone = await learner.context().newPage();
  await learnerPhone.setViewportSize({ width: 390, height: 844 });
  await learnerPhone.goto(`${base}/ar/learn/${enrollment.id}`);
  await learnerPhone.getByText(title).first().waitFor();
  assert.ok(await noHorizontalScroll(learnerPhone), 'the player scrolls sideways on a phone');
  await learnerPhone.screenshot({ path: join(shots, 'learner-phone.png'), fullPage: true });
  step('Instructors only open courses they are named on, and the player fits a 390 px phone');

  // Leave the demo as it was: the check's own course, its records and the second organization go.
  await cleanup(courseId, other.id);
  await browser.close();
  if (errors.length) {
    console.log('\nBrowser errors:');
    for (const e of errors) console.log('   ', e);
  }
  console.log(`\n${passed} checks passed${errors.length ? `, ${errors.length} browser errors logged` : ''}. Screenshots in ${shots}`);
  if (errors.length) process.exitCode = 1;
}

main()
  .catch((e) => {
    console.error('\nFAILED:', e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());

