/**
 * The example course: every kind of content the platform supports, in one
 * realistic course a retailer would give its new team leaders.
 *
 *   Module 1  video · text · practice quiz (auto graded)
 *   Module 2  video · PDF · link · graded quiz (auto graded)
 *   Module 3  video · text · graded quiz with a written answer (instructor graded)
 *   Final exam  single, multiple, true or false and a written answer, timed
 *
 * Used by scripts/seed.ts. The videos are recorded once by demo-videos.ts.
 */
import { readFileSync } from 'node:fs';
import { settle } from '../src/lib/command-kit';
import { gradeAttempt, multipleKey, trueFalseChoices } from '../src/lib/domain';
import { writeBuffer } from '../src/lib/storage';
import { recordVideos, type DemoVideo } from './demo-videos';
import type { db as Db } from '../src/lib/db';

type Q = { kind: 'Single' | 'Multiple' | 'TrueFalse' | 'Text'; prompt: string; choices?: string[]; correct?: number | number[] | boolean; guide?: string; points?: number };

export const SHOWCASE_TITLE = 'مهارات الإشراف للقادة الجدد';

const VIDEOS: DemoVideo[] = [
  { key: 'lead-1', title: SHOWCASE_TITLE, slides: [
    { kicker: 'الوحدة الأولى', title: 'دورك الجديد كمشرف', seconds: 6 },
    { title: 'ما الذي يتغير حين تصبح مشرفًا؟', points: ['نجاحك يُقاس بنجاح فريقك', 'وقتك يذهب للناس قبل المهام', 'قراراتك تصل إلى العميل عبر غيرك'], seconds: 9 },
    { title: 'ثلاثة أخطاء شائعة في الشهر الأول', points: ['أن تستمر في أداء عملك القديم بنفسك', 'أن تتجنب الحديث الصعب مع زميل سابق', 'أن تغيّر كل شيء في الأسبوع الأول'], seconds: 10 },
    { title: 'ابدأ بالإصغاء', points: ['قابل كل فرد في فريقك على انفراد', 'اسأل: ما الذي يعيق عملك؟', 'دوّن ما تسمعه قبل أن تقترح حلولًا'], seconds: 10 },
    { kicker: 'خلاصة', title: 'المشرف الجيد يجعل عمل فريقه أسهل كل يوم', seconds: 6 },
  ] },
  { key: 'lead-2', title: SHOWCASE_TITLE, slides: [
    { kicker: 'الوحدة الثانية', title: 'الاجتماع اليومي في عشر دقائق', seconds: 6 },
    { title: 'لماذا عشر دقائق فقط؟', points: ['الفريق واقف ومستعد للعمل', 'التفاصيل تُناقش بعد الاجتماع', 'الانتظام أهم من الطول'], seconds: 9 },
    { title: 'جدول الاجتماع', points: ['نتيجة الأمس في رقم واحد', 'أولوية اليوم', 'عائق يحتاج مساعدة', 'تقدير لجهد أحد الزملاء'], seconds: 11 },
    { title: 'بعد الاجتماع', points: ['تابع العائق بنفسك قبل الظهر', 'سجّل ما اتُّفق عليه في لوحة الفرع'], seconds: 8 },
    { kicker: 'خلاصة', title: 'اجتماع قصير ومنتظم يوفر ساعات من الرسائل المتفرقة', seconds: 6 },
  ] },
  { key: 'lead-3', title: SHOWCASE_TITLE, slides: [
    { kicker: 'الوحدة الثالثة', title: 'التغذية الراجعة: الموقف، السلوك، الأثر', seconds: 6 },
    { title: 'الموقف', points: ['حدد متى وأين حدث الأمر', 'مثال: في وردية الخميس المسائية'], seconds: 8 },
    { title: 'السلوك', points: ['صف ما رأيته فعلًا دون حكم على الشخص', 'مثال: تُرك صندوق الدفع دون تغطية عشرين دقيقة'], seconds: 9 },
    { title: 'الأثر', points: ['اشرح النتيجة على العميل أو الفريق', 'مثال: تكوّن طابور وغادر عميلان دون شراء'], seconds: 9 },
    { title: 'ثم استمع واتفق', points: ['اسأل عن السبب قبل أن تحكم', 'اتفقا على خطوة واحدة واضحة وموعد متابعة'], seconds: 9 },
    { kicker: 'خلاصة', title: 'تحدّث عن السلوك لا عن الشخص، وفي اليوم نفسه', seconds: 6 },
  ] },
];

const FINAL: Q[] = [
  { kind: 'Single', prompt: 'ما أول ما يُنصح به المشرف الجديد في أسبوعه الأول؟', choices: ['تغيير جدول الورديات', 'مقابلة كل فرد في الفريق على انفراد', 'مراجعة أخطاء الشهر الماضي'], correct: 1 },
  { kind: 'Multiple', prompt: 'أي مما يلي من بنود الاجتماع اليومي؟ اختر كل ما ينطبق.', choices: ['نتيجة الأمس', 'مناقشة تفصيلية لكل مشكلة', 'أولوية اليوم', 'تقدير لجهد زميل'], correct: [0, 2, 3], points: 2 },
  { kind: 'TrueFalse', prompt: 'في التغذية الراجعة يُفضل وصف شخصية الموظف بدل سلوكه.', correct: false },
  { kind: 'Single', prompt: 'ما مدة الاجتماع اليومي المقترحة في الدورة؟', choices: ['خمس دقائق', 'عشر دقائق', 'نصف ساعة'], correct: 1 },
  { kind: 'Multiple', prompt: 'أي الأخطاء التالية شائعة في الشهر الأول للمشرف؟', choices: ['الاستمرار في أداء العمل القديم بنفسه', 'الإصغاء لفريقه', 'تجنب الحديث الصعب مع زميل سابق'], correct: [0, 2], points: 2 },
  { kind: 'Text', prompt: 'اكتب مثالًا لتغذية راجعة توجهها لموظف تأخر عن ورديته، مستخدمًا نموذج الموقف والسلوك والأثر.', guide: 'تُمنح الدرجة كاملة إذا ذكر: الموقف بوقت محدد، السلوك دون حكم على الشخص، الأثر على الفريق أو العملاء، واتفاقًا على خطوة ومتابعة.', points: 4 },
];

type Lesson = { title: string; kind: 'Text' | 'Video' | 'Pdf' | 'Link' | 'Quiz'; body?: string; url?: string; video?: string; required?: boolean; quiz?: { graded: boolean; pass?: number; attempts?: number; minutes?: number; questions: Q[] } };

const MODULES: { title: string; lessons: Lesson[] }[] = [
  { title: 'من زميل إلى مشرف', lessons: [
    { title: 'دورك الجديد كمشرف', kind: 'Video', video: 'lead-1' },
    { title: 'ما الذي يتغير في يومك', kind: 'Text', body: 'كنت تُقاس بعدد ما تنجزه بيدك. الآن تُقاس بما ينجزه فريقك.\n\nخصص في يومك وقتًا ثابتًا للمرور على الفريق قبل الذروة، ووقتًا لحل العوائق، ووقتًا لمتابعة المؤشرات.\n\nلا تحاول أن تكون الأفضل في كل مهمة. كن الأوضح في الأولويات والأسرع في إزالة ما يعطل الفريق.' },
    { title: 'راجع فهمك', kind: 'Quiz', body: 'ثلاثة أسئلة سريعة لتتأكد من الفكرة الأساسية. لا تُحتسب في النتيجة.', quiz: { graded: false, attempts: 5, questions: [
      { kind: 'TrueFalse', prompt: 'يُقاس نجاح المشرف بما ينجزه فريقه.', correct: true },
      { kind: 'Single', prompt: 'ما الذي يُنصح بفعله قبل اقتراح الحلول للفريق؟', choices: ['الإصغاء وتدوين ما تسمعه', 'إصدار تعليمات جديدة', 'مقارنة الفريق بفرع آخر'], correct: 0 },
      { kind: 'Multiple', prompt: 'أين يذهب وقت المشرف في يومه؟', choices: ['المرور على الفريق', 'حل العوائق', 'أداء كل المهام بنفسه'], correct: [0, 1] },
    ] } },
  ] },
  { title: 'التواصل مع الفريق', lessons: [
    { title: 'الاجتماع اليومي في عشر دقائق', kind: 'Video', video: 'lead-2' },
    { title: 'نموذج الاجتماع اليومي', kind: 'Pdf' },
    { title: 'قراءة إضافية: إدارة الاجتماعات القصيرة', kind: 'Link', url: 'https://www.hrsd.gov.sa/', body: 'مرجع خارجي اختياري.', required: false },
    { title: 'اختبار الوحدة الثانية', kind: 'Quiz', quiz: { graded: true, pass: 75, attempts: 2, questions: [
      { kind: 'Single', prompt: 'أين تُناقش تفاصيل المشكلات؟', choices: ['داخل الاجتماع اليومي', 'بعد الاجتماع مع المعنيين', 'في الاجتماع الشهري فقط'], correct: 1 },
      { kind: 'TrueFalse', prompt: 'الانتظام في الاجتماع اليومي أهم من طوله.', correct: true },
      { kind: 'Multiple', prompt: 'ما الذي يفعله المشرف بعد الاجتماع؟', choices: ['يتابع العائق بنفسه', 'يسجل الاتفاق في لوحة الفرع', 'ينتظر أسبوعًا قبل المتابعة'], correct: [0, 1], points: 2 },
    ] } },
  ] },
  { title: 'التغذية الراجعة والمتابعة', lessons: [
    { title: 'نموذج الموقف والسلوك والأثر', kind: 'Video', video: 'lead-3' },
    { title: 'أمثلة جاهزة للاستخدام', kind: 'Text', body: 'مثال للتقدير: في ذروة يوم الجمعة، رتّبت رف العروض قبل وصول الشحنة، فلم ينتظر العملاء وارتفعت مبيعات العرض. شكرًا لك.\n\nمثال للتصحيح: في وردية الخميس، تُرك صندوق الدفع دون تغطية عشرين دقيقة، فتكوّن طابور وغادر عميلان. ما الذي حدث؟ وكيف نضمن ألا يتكرر؟\n\nلاحظ أن كلا المثالين يبدأ بموقف محدد، ويصف سلوكًا يمكن رؤيته، ثم يذكر أثرًا واضحًا.' },
    { title: 'تطبيق عملي', kind: 'Quiz', body: 'سؤالان آليان وسؤال مكتوب يصححه المدرب.', quiz: { graded: true, pass: 60, attempts: 2, questions: [
      { kind: 'TrueFalse', prompt: 'يبدأ نموذج التغذية الراجعة بوصف شخصية الموظف.', correct: false },
      { kind: 'Single', prompt: 'أي مما يلي وصف لسلوك وليس حكمًا؟', choices: ['أنت مهمل', 'تُرك الصندوق دون تغطية عشرين دقيقة', 'أنت لا تهتم بالعملاء'], correct: 1 },
      { kind: 'Text', prompt: 'صف موقفًا حقيقيًا من عملك تحتاج فيه تقديم تغذية راجعة، واكتب ما ستقوله.', guide: 'مقبول إذا احتوى موقفًا محددًا وسلوكًا ملاحظًا وأثرًا. لا يُشترط أسلوب معين.', points: 3 },
    ] } },
  ] },
];

function choicesOf(q: Q) {
  if (q.kind === 'TrueFalse') return trueFalseChoices();
  if (q.kind === 'Text') return [];
  return (q.choices ?? []).map((text, i) => ({ id: 'abcdefgh'[i], text }));
}
function keyOf(q: Q) {
  if (q.kind === 'TrueFalse') return String(q.correct);
  if (q.kind === 'Text') return '';
  if (q.kind === 'Multiple') return multipleKey((q.correct as number[]).map((i) => 'abcdefgh'[i]));
  return 'abcdefgh'[q.correct as number];
}

type Ctx = { db: typeof Db; tenantId: string; adminId: string; instructorId: string; learnerMembershipId: string; groupId: string; groupMembers: string[]; pdf: Buffer | null; ago: (d: number, h?: number) => Date };

export async function seedShowcase(c: Ctx) {
  const { db, tenantId } = c;
  const videos = await recordVideos(VIDEOS);
  const course = await db.course.create({ data: { tenantId, title: SHOWCASE_TITLE, category: 'القيادة والإشراف', createdBy: c.adminId, instructorIds: [c.instructorId], createdAt: c.ago(40) } });
  const v = await db.courseVersion.create({ data: { tenantId, courseId: course.id, number: 1, status: 'Published', title: SHOWCASE_TITLE, description: 'دورة من ثلاث وحدات للمشرفين الجدد في الفروع: الانتقال من زميل إلى مشرف، الاجتماع اليومي، والتغذية الراجعة. فيها فيديوهات ودليل مطبوع واختبارات قصيرة واختبار نهائي.', estimatedMinutes: 50, quizEnabled: true, passPercent: 75, maxAttempts: 3, timeLimitMinutes: 15, publishedAt: c.ago(35) } });

  const assetFor = async (name: string, mime: string, bytes: Buffer) => {
    const stored = writeBuffer(bytes);
    return (await db.asset.create({ data: { tenantId, uploadedBy: c.instructorId, name, mime, size: stored.size, storageKey: stored.key, status: 'Clean' } })).id;
  };

  const lessons: { id: string; kind: string; required: boolean; graded: boolean; pass: number; questions: { id: string; kind: string; points: number; correct: string; choices: { id: string; text: string }[] }[] }[] = [];
  for (const [mi, m] of MODULES.entries()) {
    const mod = await db.module.create({ data: { tenantId, versionId: v.id, title: m.title, position: mi } });
    for (const [li, l] of m.lessons.entries()) {
      let assetId: string | null = null, duration = 0, kind: string = l.kind;
      if (l.kind === 'Video' && l.video) {
        const rec = videos[l.video];
        assetId = await assetFor(`${l.title}.webm`, 'video/webm', readFileSync(rec.file));
        duration = rec.seconds;
      }
      if (l.kind === 'Pdf') {
        if (c.pdf) assetId = await assetFor('نموذج الاجتماع اليومي.pdf', 'application/pdf', c.pdf);
        else kind = 'Text';
      }
      const graded = l.quiz?.graded ?? true;
      const row = await db.lesson.create({ data: { tenantId, versionId: v.id, moduleId: mod.id, title: l.title, kind, body: l.body ?? (kind === 'Text' ? 'راجع نموذج الاجتماع اليومي المعتمد في فرعك.' : ''), url: l.url ?? null, assetId, durationSeconds: duration, position: li,
        required: l.kind === 'Quiz' ? graded : l.required ?? true, graded, passPercent: l.quiz?.pass ?? 70, maxAttempts: l.quiz?.attempts ?? 3, timeLimitMinutes: l.quiz?.minutes ?? null } });
      const questions: (typeof lessons)[number]['questions'] = [];
      for (const [qi, q] of (l.quiz?.questions ?? []).entries()) {
        const qr = await db.question.create({ data: { tenantId, versionId: v.id, lessonId: row.id, kind: q.kind, prompt: q.prompt, choices: choicesOf(q), correct: keyOf(q), guide: q.guide ?? '', points: q.points ?? 1, position: qi } });
        questions.push({ id: qr.id, kind: qr.kind, points: qr.points, correct: qr.correct, choices: qr.choices as { id: string; text: string }[] });
      }
      lessons.push({ id: row.id, kind, required: row.required, graded, pass: row.passPercent, questions });
    }
  }
  const finals: (typeof lessons)[number]['questions'] = [];
  for (const [qi, q] of FINAL.entries()) {
    const qr = await db.question.create({ data: { tenantId, versionId: v.id, lessonId: null, kind: q.kind, prompt: q.prompt, choices: choicesOf(q), correct: keyOf(q), guide: q.guide ?? '', points: q.points ?? 1, position: qi } });
    finals.push({ id: qr.id, kind: qr.kind, points: qr.points, correct: qr.correct, choices: qr.choices as { id: string; text: string }[] });
  }

  const good = (q: (typeof finals)[number]) => (q.kind === 'Multiple' ? q.correct.split(',') : q.kind === 'Text' ? 'في وردية الأحد الصباحية وصلت متأخرًا نصف ساعة، فبقي قسم الخضار دون ترتيب عند الافتتاح وتأخر تجهيز الطلبات. ما الذي حدث؟ لنتفق على الحضور قبل الموعد بعشر دقائق ونراجع ذلك الأسبوع القادم.' : q.correct);
  const answersFor = (qs: typeof finals, right: boolean) => Object.fromEntries(qs.map((q) => [q.id, right ? good(q) : q.kind === 'Text' ? 'سأكلمه.' : q.choices.find((x) => x.id !== q.correct.split(',')[0])?.id ?? q.correct]));

  // Stories: the demo learner has not started; the group shows every stage, including answers waiting for the instructor.
  const members = [c.learnerMembershipId, ...c.groupMembers.filter((m) => m !== c.learnerMembershipId)];
  const required = lessons.filter((l) => l.required).length;
  for (const [i, membershipId] of members.entries()) {
    const stage = i === 0 ? 'fresh' : (['done', 'review', 'lessonReview', 'halfway', 'done', 'fresh', 'review'] as const)[(i - 1) % 7];
    const createdAt = c.ago(30 - i);
    const e = await db.enrollment.create({ data: { tenantId, membershipId, courseId: course.id, versionId: v.id, groupId: c.groupId, assignedBy: c.adminId, startsAt: createdAt, dueAt: c.ago(-10, 17), requiredTotal: required, createdAt } });
    if (stage === 'fresh') { await db.$transaction((tx) => settle(tx, tenantId, e.id)); continue; }
    const upto = stage === 'halfway' ? 3 : stage === 'lessonReview' ? 6 : lessons.length;
    let day = 1;
    for (const l of lessons.slice(0, upto)) {
      const at = new Date(createdAt.getTime() + day++ * 86_400_000);
      if (l.kind === 'Quiz') {
        const pending = stage === 'lessonReview' && l.questions.some((q) => q.kind === 'Text');
        const answers = answersFor(l.questions, true);
        const g = gradeAttempt(l.questions, answers, l.pass, pending ? {} : Object.fromEntries(l.questions.filter((q) => q.kind === 'Text').map((q) => [q.id, q.points - 1])));
        await db.quizAttempt.create({ data: { tenantId, enrollmentId: e.id, scope: l.id, lessonId: l.id, number: 1, status: pending ? 'Review' : 'Graded', answers, startedAt: at, submittedAt: new Date(at.getTime() + 6 * 60_000), earned: g.earned, total: g.total, score: pending ? null : g.score, passed: g.passed, ...(pending ? {} : { review: { points: Object.fromEntries(l.questions.filter((q) => q.kind === 'Text').map((q) => [q.id, q.points - 1])), comment: 'مثال واضح، أضف موعد المتابعة في المرة القادمة.' }, reviewedBy: c.instructorId, reviewedAt: new Date(at.getTime() + 86_400_000) }) } });
        if (!pending || !l.graded) await db.lessonProgress.create({ data: { tenantId, enrollmentId: e.id, lessonId: l.id, completedAt: new Date(at.getTime() + 6 * 60_000) } });
      } else {
        await db.lessonProgress.create({ data: { tenantId, enrollmentId: e.id, lessonId: l.id, completedAt: at, ...(l.kind === 'Video' ? { watchedSeconds: 50, position: 50 } : {}) } });
      }
    }
    await db.enrollment.update({ where: { id: e.id }, data: { startedAt: new Date(createdAt.getTime() + 86_400_000) } });
    if (stage === 'done' || stage === 'review') {
      const at = new Date(createdAt.getTime() + (day + 1) * 86_400_000);
      const answers = answersFor(finals, true);
      const written = Object.fromEntries(finals.filter((q) => q.kind === 'Text').map((q) => [q.id, 3]));
      const g = gradeAttempt(finals, answers, 75, stage === 'review' ? {} : written);
      await db.quizAttempt.create({ data: { tenantId, enrollmentId: e.id, scope: 'final', number: 1, status: stage === 'review' ? 'Review' : 'Graded', answers, startedAt: at, submittedAt: new Date(at.getTime() + 11 * 60_000), earned: g.earned, total: g.total, score: stage === 'review' ? null : g.score, passed: g.passed, ...(stage === 'done' ? { review: { points: written, comment: 'تطبيق جيد للنموذج.' }, reviewedBy: c.instructorId, reviewedAt: new Date(at.getTime() + 86_400_000) } : {}) } });
    }
    await db.$transaction((tx) => settle(tx, tenantId, e.id));
  }
  return { courseId: course.id, videoSeconds: Object.values(videos).reduce((s, x) => s + x.seconds, 0) };
}
