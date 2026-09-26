/**
 * Seeds a demo workspace: one company with the three demo accounts, a few
 * dozen learners in groups, four courses with real lesson text and quizzes,
 * and progress spread over the last two months, so every screen and every
 * chart has something true to show. Learner progress is recorded as rows
 * and then settled through the same code the app uses, so statuses and
 * certificates come out exactly as they would in production.
 *
 *   npm run db:seed          refuses to touch a database that already has tenants
 *   npm run db:seed -- --reset   wipes this local database first
 */
import 'dotenv/config';
import { appendFileSync, existsSync, readFileSync } from 'node:fs';

import { hash } from 'bcryptjs';
import { db } from '../src/lib/db';
import { PLANS } from './plans';
import { DEMO_ACCOUNTS, DEMO_PASSWORD } from '../src/lib/demo';
import { settle } from '../src/lib/command-kit';
import { gradeAttempt, trueFalseChoices } from '../src/lib/domain';
import { newSecret, seal, otp } from '../src/lib/totp';
import { writeBuffer } from '../src/lib/storage';

if (process.env.NODE_ENV === 'production') throw new Error('The demo seed never runs in production');

const DAY = 86_400_000;
const ago = (days: number, hour = 10) => { const d = new Date(Date.now() - days * DAY); d.setHours(hour, 0, 0, 0); return d; };
let state = 20260926;
const random = () => { state = (state * 1103515245 + 12345) % 2147483648; return state / 2147483648; };
const pick = <T,>(list: readonly T[]) => list[Math.floor(random() * list.length)];

const FIRST = ['سارة', 'محمد', 'لمى', 'فهد', 'جواهر', 'تركي', 'رهف', 'عبدالعزيز', 'شهد', 'بندر', 'دانة', 'ياسر', 'منيرة', 'راكان', 'وجدان', 'مشعل', 'العنود', 'سعود', 'غادة', 'نايف', 'هيا', 'عبدالله', 'ريم', 'ماجد'];
const LAST = ['العنزي', 'الشهري', 'المطيري', 'الحارثي', 'البقمي', 'السبيعي', 'الرشيدي', 'العمري', 'الجهني', 'الثبيتي', 'الدوسري', 'القرني'];
const TITLES = ['أخصائي مبيعات', 'موظف خدمة عملاء', 'مشرف فرع', 'محاسب', 'منسق مشتريات', 'أخصائي موارد بشرية'];

type LessonSeed = { title: string; kind: 'Text' | 'Link' | 'Pdf'; body?: string; url?: string; required?: boolean };
type QuestionSeed = { prompt: string; choices?: string[]; correct: number | boolean; points?: number };
type CourseSeed = { title: string; category: string; description: string; minutes: number; modules: { title: string; lessons: LessonSeed[] }[]; quiz?: { pass: number; attempts: number; minutes?: number; questions: QuestionSeed[] } };

const COURSES: CourseSeed[] = [
  {
    title: 'التهيئة للموظفين الجدد',
    category: 'الموارد البشرية',
    description: 'ما يحتاجه الموظف في أسبوعه الأول: قيم الشركة، طريقة العمل، وأنظمة الحضور والإجازات.',
    minutes: 45,
    modules: [
      { title: 'مرحبًا بك في نخلة', lessons: [
        { title: 'من نحن وماذا نقدم', kind: 'Text', body: 'نخلة للتجزئة شركة سعودية تدير أربعة وعشرين فرعًا في الرياض والقصيم والمنطقة الشرقية.\n\nنبيع المواد الغذائية والمنزلية، ونعتمد على فرق الفروع في كل ما يصل إلى العميل: ترتيب الأرفف، دقة الأسعار، وحسن الاستقبال.\n\nستجد في هذه الدورة ما تحتاجه لتبدأ عملك بثقة. خذ وقتك في كل درس، وارجع إليه متى احتجت.' },
        { title: 'قيمنا في العمل اليومي', kind: 'Text', body: 'الأمانة: السعر المعروض هو السعر المحصّل، ولا نقبل أي خطأ في الفاتورة لصالحنا.\n\nالاحترام: نخاطب العميل والزميل بأدب مهما كان الموقف.\n\nالمبادرة: إذا رأيت خللًا على الرف أو في المستودع فأبلغ عنه فورًا ولا تنتظر من يطلب منك ذلك.\n\nالسلامة أولًا: لا ترفع حملًا ثقيلًا وحدك، ولا تترك ممرًا مسدودًا.' },
      ] },
      { title: 'أنظمة العمل', lessons: [
        { title: 'الحضور والانصراف', kind: 'Text', body: 'يبدأ الدوام حسب جدول الفرع المعتمد من المشرف. سجّل حضورك من جهاز البصمة عند الدخول والخروج.\n\nالتأخير أكثر من خمس عشرة دقيقة يُسجل تأخيرًا ويُبلّغ به المشرف. إن طرأ لك ظرف فأبلغ مشرفك قبل بداية الدوام.' },
        { title: 'الإجازات والاستئذان', kind: 'Text', body: 'تُقدَّم طلبات الإجازة من خلال نظام الموارد البشرية قبل أسبوعين على الأقل، عدا الإجازات الاضطرارية.\n\nالاستئذان خلال الدوام يكون بموافقة المشرف المباشر، ولا يتجاوز ساعتين في اليوم.' },
        { title: 'نظام العمل في المملكة', kind: 'Link', url: 'https://www.hrsd.gov.sa/', body: 'للاطلاع على حقوقك وواجباتك كموظف، راجع صفحة وزارة الموارد البشرية والتنمية الاجتماعية.', required: false },
      ] },
    ],
    quiz: { pass: 70, attempts: 3, questions: [
      { prompt: 'كم دقيقة تأخير تُسجل تأخيرًا ويُبلّغ بها المشرف؟', choices: ['خمس دقائق', 'أكثر من خمس عشرة دقيقة', 'ساعة كاملة'], correct: 1 },
      { prompt: 'تُقدَّم طلبات الإجازة العادية قبل أسبوعين على الأقل.', correct: true },
      { prompt: 'رأيت خطأ في سعر معروض على الرف. ما التصرف الصحيح؟', choices: ['أتركه للمشرف حين يلاحظه', 'أبلغ عنه فورًا', 'أغيّر السعر بنفسي'], correct: 1, points: 2 },
      { prompt: 'يجوز الاستئذان خلال الدوام دون موافقة المشرف إذا كان أقل من ساعة.', correct: false },
      { prompt: 'أي مما يلي من قيم الشركة؟', choices: ['السرعة على حساب الدقة', 'الأمانة في الأسعار', 'تجنب المبادرة'], correct: 1 },
    ] },
  },
  {
    title: 'أساسيات خدمة العملاء',
    category: 'خدمة العملاء',
    description: 'استقبال العميل، التعامل مع الشكوى، ومتى تحوّل الحالة إلى المشرف.',
    minutes: 30,
    modules: [
      { title: 'الاستقبال', lessons: [
        { title: 'الدقيقة الأولى مع العميل', kind: 'Text', body: 'ابتسم وحيّ العميل خلال ثوانٍ من وصوله إلى منطقتك. إن كنت مشغولًا مع عميل آخر فأشر إليه بأنك ستخدمه بعد لحظة.\n\nاسأل سؤالًا مفتوحًا: كيف أقدر أخدمك؟ ثم استمع حتى النهاية قبل أن تقترح شيئًا.' },
      ] },
      { title: 'الشكاوى', lessons: [
        { title: 'خطوات التعامل مع الشكوى', kind: 'Text', body: 'استمع دون مقاطعة.\n\nأعد صياغة المشكلة لتتأكد أنك فهمتها.\n\nاعتذر عن التجربة حتى لو لم يكن الخطأ منك.\n\nقدّم الحل المتاح لك، وإن تجاوز صلاحيتك فاطلب المشرف بنفسك ولا تطلب من العميل البحث عنه.\n\nسجّل الشكوى في نظام الفرع قبل نهاية الوردية.' },
        { title: 'متى أحوّل إلى المشرف', kind: 'Text', body: 'حوّل الحالة إلى المشرف إذا طلب العميل استردادًا يتجاوز مئتي ريال، أو إذا تعلقت الشكوى بسلامة منتج غذائي، أو إذا ارتفع صوت العميل وتعذّر تهدئته.' },
      ] },
    ],
    quiz: { pass: 80, attempts: 2, minutes: 10, questions: [
      { prompt: 'ما أول ما تفعله حين يبدأ العميل بشرح شكواه؟', choices: ['أقترح الحل مباشرة', 'أستمع دون مقاطعة', 'أطلب منه التوجه للمشرف'], correct: 1 },
      { prompt: 'تُحوّل الحالة للمشرف إذا تجاوز طلب الاسترداد مئتي ريال.', correct: true },
      { prompt: 'متى تُسجّل الشكوى في نظام الفرع؟', choices: ['قبل نهاية الوردية', 'في نهاية الشهر', 'إذا طلب العميل ذلك فقط'], correct: 0 },
      { prompt: 'إذا لم يكن الخطأ منك فلا داعي للاعتذار.', correct: false },
    ] },
  },
  {
    title: 'السلامة في المستودعات',
    category: 'السلامة',
    description: 'رفع الأحمال، ترتيب الممرات، والتعامل مع الانسكاب.',
    minutes: 20,
    modules: [
      { title: 'قواعد السلامة', lessons: [
        { title: 'رفع الأحمال بطريقة صحيحة', kind: 'Text', body: 'قف قريبًا من الحمل، اثنِ ركبتيك لا ظهرك، وارفع بقوة الساقين.\n\nكل ما يتجاوز خمسة وعشرين كيلوجرامًا يُرفع بشخصين أو بالعربة.' },
        { title: 'دليل السلامة المختصر', kind: 'Pdf' },
        { title: 'التعامل مع الانسكاب', kind: 'Text', body: 'ضع علامة التحذير الصفراء فورًا، ثم نظّف الانسكاب بالمادة المخصصة من خزانة السلامة، وأبلغ المشرف إن كانت المادة كيميائية.' },
      ] },
    ],
  },
  {
    title: 'مهارات التفاوض مع الموردين',
    category: 'المشتريات',
    description: 'دورة قيد الإعداد لفريق المشتريات.',
    minutes: 60,
    modules: [
      { title: 'التحضير للتفاوض', lessons: [
        { title: 'حدد الحد الأدنى قبل الجلسة', kind: 'Text', body: 'قبل أي جلسة مع مورد، اكتب ثلاثة أرقام: السعر الذي تطمح إليه، والسعر المقبول، والحد الذي تنسحب عنده.' },
      ] },
    ],
  },
];

async function wipe() {
  const tables = ['Certificate', 'QuizAttempt', 'LessonProgress', 'Enrollment', 'Question', 'Lesson', 'Module', 'CourseVersion', 'Course', 'GroupMember', 'Group', 'Asset', 'ImportJob', 'Notification', 'Outbox', 'ExportJob', 'Invitation', 'Audit', 'Invoice', 'Subscription', 'Membership', 'Tenant', 'AuthToken', 'AuthAttempt', 'IdempotencyKey', 'User'];
  for (const t of tables) await db.$executeRawUnsafe(`DELETE FROM "${t}"`);
}

/** A short safety guide rendered by the local browser. Skipped quietly where no browser exists. */
async function safetyPdf() {
  try {
    const { renderPdf } = await import('../src/lib/pdf');
    const html = `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;600&display=swap" rel="stylesheet"><style>body{font-family:'IBM Plex Sans Arabic',Tahoma,sans-serif;color:#16323b;line-height:1.9}h1{color:#0e6e6b}li{margin-bottom:6pt}</style></head><body><h1>دليل السلامة المختصر</h1><p>نخلة للتجزئة · المستودعات والفروع</p><ol><li>ارتدِ حذاء السلامة داخل المستودع في كل وقت.</li><li>لا ترفع وحدك ما يزيد على خمسة وعشرين كيلوجرامًا.</li><li>أبقِ ممرات الطوارئ خالية ومضاءة.</li><li>ضع علامة التحذير عند أي انسكاب قبل تنظيفه.</li><li>أبلغ المشرف عن أي إصابة مهما كانت بسيطة.</li></ol></body></html>`;
    return await renderPdf(html);
  } catch {
    return null;
  }
}

async function main() {
  if (await db.tenant.count()) {
    if (!process.argv.includes('--reset')) throw new Error('This database already has data. Run with --reset to wipe it and seed again.');
    await wipe();
  }

  for (const plan of PLANS) {
    const data = { ...plan, features: [...plan.features], active: true };
    await db.plan.upsert({ where: { code: plan.code }, create: data, update: data });
  }
  const growth = await db.plan.findUniqueOrThrow({ where: { code: 'growth' } });

  const password = await hash(DEMO_PASSWORD, 10);
  const tenant = await db.tenant.create({ data: { slug: 'nakhla', nameAr: 'نخلة للتجزئة', nameEn: 'Nakhla Retail', kind: 'Company', brandColor: '#0E6E6B' } });
  await db.subscription.create({ data: { tenantId: tenant.id, planId: growth.id, status: 'Active', currentPeriodStart: ago(12), currentPeriodEnd: new Date(ago(12).getTime() + 30 * DAY) } });

  // The three demo accounts share one authenticator secret, printed at the end.
  const secret = newSecret();
  const demo: Record<string, { userId: string; membershipId: string }> = {};
  for (const account of DEMO_ACCOUNTS) {
    const user = await db.user.create({ data: { email: account.email, name: account.name, password, verified: true, mfaEnabled: true, mfaSecret: seal(secret), platformOperator: account.role === 'Admin' } });
    const m = await db.membership.create({ data: { tenantId: tenant.id, userId: user.id, role: account.role, title: account.role === 'Instructor' ? 'مدرب التطوير المهني' : account.role === 'Admin' ? 'مديرة التدريب' : 'أخصائية مبيعات', createdAt: ago(70) } });
    demo[account.role] = { userId: user.id, membershipId: m.id };
  }

  const groupNames = ['الموظفون الجدد', 'فريق خدمة العملاء', 'فرع الرياض الشمالي', 'المستودع المركزي'];
  const groups = await Promise.all(groupNames.map((name, i) => db.group.create({ data: { tenantId: tenant.id, name, description: i === 0 ? 'دفعة التعيين للربع الثالث' : '' } })));

  const learners: { membershipId: string; groups: number[] }[] = [{ membershipId: demo.Learner.membershipId, groups: [0, 1] }];
  await db.groupMember.createMany({ data: [0, 1].map((g) => ({ tenantId: tenant.id, groupId: groups[g].id, membershipId: demo.Learner.membershipId })) });
  const used = new Set<string>();
  for (let i = 0; i < 36; i++) {
    let name = `${pick(FIRST)} ${pick(LAST)}`;
    while (used.has(name)) name = `${pick(FIRST)} ${pick(LAST)}`;
    used.add(name);
    const verified = random() > 0.08;
    const user = await db.user.create({ data: { email: `learner${i + 1}@nakhla.test`, name, password: verified ? password : '', verified, lastSeenAt: verified ? ago(Math.floor(random() * 20)) : null } });
    const m = await db.membership.create({ data: { tenantId: tenant.id, userId: user.id, role: 'Learner', title: pick(TITLES), createdAt: ago(60 - i) } });
    const mine = [i < 14 ? 0 : -1, i % 3 === 0 ? 1 : -1, i % 4 === 1 ? 2 : -1, i % 5 === 2 ? 3 : -1].filter((g) => g >= 0);
    if (!mine.length) mine.push(2);
    await db.groupMember.createMany({ data: mine.map((g) => ({ tenantId: tenant.id, groupId: groups[g].id, membershipId: m.id })) });
    learners.push({ membershipId: m.id, groups: mine });
  }

  // Courses: every lesson and question written through the schema the editor uses.
  const pdf = await safetyPdf();
  const versions: { id: string; courseId: string; seed: CourseSeed; lessons: { id: string; required: boolean }[]; questions: { id: string; points: number; correct: string; choices: { id: string; text: string }[] }[] }[] = [];
  for (const [ci, c] of COURSES.entries()) {
    const published = ci < 3;
    const course = await db.course.create({ data: { tenantId: tenant.id, title: c.title, category: c.category, createdBy: ci === 3 ? demo.Instructor.userId : demo.Admin.userId, instructorIds: ci === 1 || ci === 3 ? [demo.Instructor.userId] : [], createdAt: ago(65 - ci * 5) } });
    const v = await db.courseVersion.create({ data: { tenantId: tenant.id, courseId: course.id, number: 1, status: published ? 'Published' : 'Draft', title: c.title, description: c.description, estimatedMinutes: c.minutes, quizEnabled: !!c.quiz, passPercent: c.quiz?.pass ?? 70, maxAttempts: c.quiz?.attempts ?? 3, timeLimitMinutes: c.quiz?.minutes ?? null, publishedAt: published ? ago(60 - ci * 5) : null } });
    const lessons: { id: string; required: boolean }[] = [];
    for (const [mi, mod] of c.modules.entries()) {
      const m = await db.module.create({ data: { tenantId: tenant.id, versionId: v.id, title: mod.title, position: mi } });
      for (const [li, l] of mod.lessons.entries()) {
        let assetId: string | null = null;
        let kind: string = l.kind;
        if (l.kind === 'Pdf') {
          if (pdf) {
            const stored = writeBuffer(pdf);
            assetId = (await db.asset.create({ data: { tenantId: tenant.id, uploadedBy: demo.Admin.userId, name: 'دليل السلامة المختصر.pdf', mime: 'application/pdf', size: stored.size, storageKey: stored.key, status: 'Clean' } })).id;
          } else kind = 'Text';
        }
        const lesson = await db.lesson.create({ data: { tenantId: tenant.id, versionId: v.id, moduleId: m.id, title: l.title, kind, body: l.body ?? (kind === 'Text' ? 'راجع دليل السلامة المعتمد في فرعك.' : ''), url: l.url ?? null, assetId, required: l.required ?? true, position: li } });
        lessons.push({ id: lesson.id, required: lesson.required });
      }
    }
    const questions: (typeof versions)[number]['questions'] = [];
    for (const [qi, q] of (c.quiz?.questions ?? []).entries()) {
      const tf = typeof q.correct === 'boolean';
      const choices = tf ? trueFalseChoices() : (q.choices ?? []).map((text, i) => ({ id: 'abcdefgh'[i], text }));
      const correct = tf ? String(q.correct) : 'abcdefgh'[q.correct as number];
      const row = await db.question.create({ data: { tenantId: tenant.id, versionId: v.id, kind: tf ? 'TrueFalse' : 'Single', prompt: q.prompt, choices, correct, points: q.points ?? 1, position: qi } });
      questions.push({ id: row.id, points: row.points, correct, choices });
    }
    versions.push({ id: v.id, courseId: course.id, seed: c, lessons, questions });
  }

  // Assignments and progress. Each learner gets a plausible story; settle() then decides the status and issues certificates.
  const plan: { v: number; group: number; dueIn: number | null; assigned: number }[] = [
    { v: 0, group: 0, dueIn: -3, assigned: 50 },
    { v: 1, group: 1, dueIn: 6, assigned: 30 },
    { v: 2, group: 3, dueIn: null, assigned: 40 },
    { v: 2, group: 2, dueIn: 12, assigned: 18 },
  ];
  let enrollments = 0, certificates = 0;
  for (const p of plan) {
    const version = versions[p.v];
    const targets = learners.filter((l) => l.groups.includes(p.group));
    for (const [i, l] of targets.entries()) {
      const existing = await db.enrollment.findUnique({ where: { membershipId_versionId: { membershipId: l.membershipId, versionId: version.id } } });
      if (existing) continue;
      const isDemo = l.membershipId === demo.Learner.membershipId;
      const createdAt = ago(p.assigned - (i % 5));
      const e = await db.enrollment.create({ data: { tenantId: tenant.id, membershipId: l.membershipId, courseId: version.courseId, versionId: version.id, groupId: groups[p.group].id, assignedBy: demo.Admin.userId, startsAt: createdAt, dueAt: p.dueIn === null ? null : ago(-p.dueIn, 17), requiredTotal: version.lessons.filter((x) => x.required).length, createdAt } });
      enrollments++;
      // The demo learner is part way through the onboarding course and has not opened customer service yet.
      const r = random();
      const share = isDemo ? (p.v === 0 ? 0.5 : p.v === 1 ? 0 : 1) : r < 0.2 ? 0 : r < 0.45 ? 0.5 : 1;
      const done = Math.round(version.lessons.length * share);
      const startedAt = new Date(createdAt.getTime() + DAY);
      for (const lesson of version.lessons.slice(0, done)) await db.lessonProgress.create({ data: { tenantId: tenant.id, enrollmentId: e.id, lessonId: lesson.id, completedAt: new Date(startedAt.getTime() + random() * 5 * DAY) } });
      if (share > 0) await db.enrollment.update({ where: { id: e.id }, data: { startedAt } });
      if (share === 1 && version.questions.length) {
        const tries = random() < 0.25 ? 2 : 1;
        for (let n = 1; n <= tries; n++) {
          const strong = n === tries && random() < 0.85;
          const answers = Object.fromEntries(version.questions.map((q) => [q.id, strong || random() < 0.5 ? q.correct : q.choices.find((c) => c.id !== q.correct)!.id]));
          const g = gradeAttempt(version.questions, answers, version.seed.quiz!.pass);
          const at = new Date(startedAt.getTime() + (5 + n) * DAY);
          await db.quizAttempt.create({ data: { tenantId: tenant.id, enrollmentId: e.id, number: n, answers, startedAt: at, submittedAt: new Date(at.getTime() + 8 * 60000), earned: g.earned, total: g.total, score: g.score, passed: g.passed } });
        }
      }
      await db.$transaction((tx) => settle(tx, tenant.id, e.id));
      // settle() stamps today's date; move completion and the certificate back to when the story says it happened.
      const after = await db.enrollment.findUniqueOrThrow({ where: { id: e.id }, include: { certificate: true } });
      if (after.status === 'Completed') {
        const completedAt = new Date(Math.min(Date.now() - DAY, startedAt.getTime() + 8 * DAY));
        await db.enrollment.update({ where: { id: e.id }, data: { completedAt } });
        if (after.certificate) { await db.certificate.update({ where: { id: after.certificate.id }, data: { issuedAt: completedAt } }); certificates++; }
      }
    }
  }
  // One revoked certificate, so the verification page has both states to show.
  const revoke = await db.certificate.findFirst({ where: { tenantId: tenant.id, enrollment: { membershipId: { not: demo.Learner.membershipId } } }, orderBy: { issuedAt: 'asc' } });
  if (revoke) await db.certificate.update({ where: { id: revoke.id }, data: { status: 'Revoked', revokedAt: ago(2), revokedBy: demo.Admin.userId, revokeReason: 'أُسندت الدورة بالخطأ لموظف منتقل' } });

  await db.notification.createMany({ data: [
    { tenantId: tenant.id, userId: demo.Learner.userId, titleAr: 'أُسندت إليك دورة أساسيات خدمة العملاء', titleEn: 'You were assigned Customer service basics', href: '/' },
    { tenantId: tenant.id, userId: demo.Admin.userId, titleAr: 'أكمل 3 متدربين دورة التهيئة هذا الأسبوع', titleEn: '3 learners completed onboarding this week', href: '/reports', read: true },
  ] });
  await db.audit.create({ data: { tenantId: tenant.id, actorId: demo.Admin.userId, action: 'tenant.signup', entityId: tenant.id, detail: { plan: 'growth', seed: true }, createdAt: ago(70) } });

  enableDemoLogin();
  console.log(`\nSeed complete: 1 organization, ${learners.length + 2} people, ${COURSES.length} courses, ${enrollments} enrollments, ${certificates} certificates${pdf ? '' : ' (no local browser, the PDF lesson became text)'}`);
  console.log(`\nSign in with password ${DEMO_PASSWORD}:`);
  for (const account of DEMO_ACCOUNTS) console.log(`  ${account.role.padEnd(11)} ${account.email}`);
  console.log(`\nTwo step verification secret for all three: ${secret}`);
  console.log(`Code right now: ${otp(secret, Math.floor(Date.now() / 30000))}. The demo sign in screen fills it for you.`);
}

/** Lets the sign-in screen offer the demo accounts on this machine only. */
function enableDemoLogin() {
  if (!existsSync('.env')) return;
  const contents = readFileSync('.env', 'utf8');
  if (!contents.includes('DEMO_LOGIN=')) appendFileSync('.env', 'DEMO_LOGIN=1\n');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
