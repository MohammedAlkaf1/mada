'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  AlertTriangle, ArrowDown, ArrowUp, BookOpen, CheckCircle2, Circle, CopyPlus, FileText, Film, Link2, ListChecks, Lock, Pencil, Plus, Send, Trash2, UserPlus, Type,
} from 'lucide-react';
import { useApp } from '@/components/app-provider';
import {
  Badge, Button, Card, Checkbox, DataList, EmptyState, Field, Input, Modal, PageHeader, Progress, SectionHeader, Select, StatusBadge, Table, Tabs, Td, Textarea, Th, Tr, cx,
} from '@/components/ui';
import { formatDate, formatDateTime, formatNumber, toLocalInput } from '@/lib/format';
import { isOverdue, progressPercent, type PublishBlocker } from '@/lib/domain';
import type { AssetState, EnrollmentRow, LessonState, ModuleState, QuestionState, VersionState } from '@/lib/types';
import type { Role } from '@/lib/domain';
import { AssetChip, UploadButton, videoDuration } from './upload';

export type EditorData = {
  course: { id: string; title: string; category: string; archivedAt: string | null; instructorIds: string[] };
  versions: VersionState[];
  version: VersionState;
  blockers: PublishBlocker[];
  assets: Record<string, AssetState>;
  library: AssetState[];
  staff: { userId: string; name: string; role: string }[];
};

export type AssignData = { members: { id: string; name: string; email: string; role: string }[]; groups: { id: string; name: string; count: number }[] };

type Tab = 'content' | 'quiz' | 'settings' | 'learners' | 'versions';
const kindIcon = { Text: Type, Pdf: FileText, Video: Film, Link: Link2, Quiz: ListChecks } as const;

/* ───────────────────────── Lesson editor ───────────────────────── */

function LessonModal({
  open, onClose, versionId, moduleId, lesson, assets, library,
}: {
  open: boolean; onClose: () => void; versionId: string; moduleId: string; lesson: LessonState | null; assets: Record<string, AssetState>; library: AssetState[];
}) {
  const { t, run, busy } = useApp();
  const [form, setForm] = useState(() => ({
    title: lesson?.title ?? '', kind: (lesson?.kind ?? 'Text') as LessonState['kind'], body: lesson?.body ?? '', url: lesson?.url ?? '',
    assetId: lesson?.assetId ?? null as string | null, durationSeconds: lesson?.durationSeconds ?? 0, required: lesson?.required ?? true,
    graded: lesson?.graded ?? true, passPercent: lesson?.passPercent ?? 70, maxAttempts: lesson?.maxAttempts ?? 3, timeLimitMinutes: lesson?.timeLimitMinutes ?? ('' as number | ''),
  }));
  const [picked, setPicked] = useState<AssetState | null>(lesson?.assetId ? assets[lesson.assetId] ?? null : null);
  const fileKind = form.kind === 'Pdf' ? 'pdf' : form.kind === 'Video' ? 'video' : null;
  const choices = library.filter((a) => (fileKind === 'pdf' ? a.mime === 'application/pdf' : fileKind === 'video' ? a.mime.startsWith('video/') : false));
  const valid = form.title.trim() && (form.kind === 'Text' ? form.body.trim() : form.kind === 'Link' ? /^https:\/\/\S+$/.test(form.url) : form.kind === 'Quiz' ? form.passPercent >= 1 && form.passPercent <= 100 && form.maxAttempts >= 1 : !!form.assetId);

  async function save() {
    const r = await run('lesson.save', {
      versionId, moduleId, ...(lesson ? { id: lesson.id } : {}), ...form,
      url: form.kind === 'Link' ? form.url : null, assetId: fileKind ? form.assetId : null, timeLimitMinutes: form.timeLimitMinutes || null,
    });
    if (r) onClose();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={lesson ? t.course.lesson : t.course.addLesson}
      footer={<><Button variant="ghost" onClick={onClose}>{t.common.cancel}</Button><Button loading={busy} disabled={!valid} onClick={save}>{t.common.save}</Button></>}
    >
      <div className="space-y-4">
        <Field label={t.course.lessonTitle} required>
          <Input value={form.title} maxLength={200} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        </Field>
        <div>
          <p className="mb-1.5 text-[13px] font-medium">{t.course.lessonKind}</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            {(['Video', 'Text', 'Pdf', 'Quiz', 'Link'] as const).map((k) => {
              const Icon = kindIcon[k];
              return (
                <button key={k} type="button" disabled={!!lesson && lesson.kind !== k && (lesson.kind === 'Quiz' || k === 'Quiz')} onClick={() => { setForm({ ...form, kind: k, assetId: null }); setPicked(null); }}
                  className={cx('flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-[13px] font-medium transition-colors disabled:opacity-40', form.kind === k ? 'border-copper-600 bg-copper-100 text-copper-700' : 'border-[var(--line-strong)] hover:bg-[var(--surface-sunken)]')}>
                  <Icon size={15} />{t.course.kinds[k]}
                </button>
              );
            })}
          </div>
        </div>

        {form.kind === 'Text' ? (
          <Field label={t.course.body} hint={t.course.bodyHint} required>
            <Textarea rows={12} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} className="leading-relaxed" />
          </Field>
        ) : null}

        {form.kind === 'Link' ? (
          <Field label={t.course.url} hint={t.course.urlHint} required>
            <Input dir="ltr" type="url" placeholder="https://" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value.trim() })} />
          </Field>
        ) : null}

        {form.kind === 'Quiz' ? (
          <div className="space-y-4 rounded-xl border border-[var(--line-soft)] p-4">
            <p className="text-[13px] font-semibold">{t.course.quizLesson}</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {([true, false] as const).map((g) => (
                <label key={String(g)} className={cx('cursor-pointer rounded-xl border px-3.5 py-3 text-[13px]', form.graded === g ? 'border-copper-600 bg-copper-100' : 'border-[var(--line-strong)]')}>
                  <span className="flex items-center gap-2 font-medium"><input type="radio" name="graded" checked={form.graded === g} onChange={() => setForm({ ...form, graded: g })} className="accent-[var(--color-copper-600)]" />{g ? t.course.graded : t.course.practice}</span>
                  <span className="mt-1 block text-[12px] leading-snug text-[var(--text-muted)]">{g ? t.course.gradedHint : t.course.practiceHint}</span>
                </label>
              ))}
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label={t.course.passPercent}><Input type="number" min={1} max={100} dir="ltr" disabled={!form.graded} value={form.passPercent} onChange={(e) => setForm({ ...form, passPercent: Number(e.target.value) })} /></Field>
              <Field label={t.course.maxAttempts}><Input type="number" min={1} max={20} dir="ltr" value={form.maxAttempts} onChange={(e) => setForm({ ...form, maxAttempts: Number(e.target.value) })} /></Field>
              <Field label={t.course.timeLimit} hint={t.course.timeLimitHint}><Input type="number" min={1} max={600} dir="ltr" value={form.timeLimitMinutes} onChange={(e) => setForm({ ...form, timeLimitMinutes: e.target.value ? Number(e.target.value) : '' })} /></Field>
            </div>
            <Field label={t.course.description} hint={t.common.optional}>
              <Textarea rows={2} value={form.body} maxLength={4000} onChange={(e) => setForm({ ...form, body: e.target.value })} />
            </Field>
            {!lesson ? <p className="text-[12px] text-[var(--text-faint)]">{t.course.noQuestionsYet}</p> : null}
          </div>
        ) : null}

        {fileKind ? (
          <div className="space-y-3">
            <p className="text-[13px] font-medium">{t.course.file} <span className="text-copper-600">*</span></p>
            {picked ? <AssetChip asset={picked} onClear={() => { setPicked(null); setForm({ ...form, assetId: null }); }} /> : null}
            <div className="flex flex-wrap items-center gap-3">
              <UploadButton
                accept={form.kind === 'Pdf' ? 'application/pdf,.pdf' : 'video/mp4,video/webm,.mp4,.webm'}
                label={t.course.pickFile}
                onUploaded={async (asset, file) => {
                  const duration = form.kind === 'Video' ? await videoDuration(file) : 0;
                  setPicked(asset);
                  setForm((f) => ({ ...f, assetId: asset.id, durationSeconds: duration || f.durationSeconds, title: f.title || file.name.replace(/\.[^.]+$/, '') }));
                }}
              />
              {choices.length ? (
                <Select className="max-w-64" value="" onChange={(e) => { const a = choices.find((c) => c.id === e.target.value); if (a) { setPicked(a); setForm({ ...form, assetId: a.id }); } }}>
                  <option value="">{t.course.fromLibrary}</option>
                  {choices.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </Select>
              ) : null}
            </div>
            <p className="text-[12px] text-[var(--text-faint)]">{form.kind === 'Video' ? t.course.videoHint : t.files.limits}</p>
            {form.kind === 'Video' ? (
              <Field label={t.course.duration} hint={t.course.durationHint} required>
                <Input type="number" min={1} dir="ltr" className="max-w-40" value={form.durationSeconds || ''} onChange={(e) => setForm({ ...form, durationSeconds: Number(e.target.value) })} />
              </Field>
            ) : null}
          </div>
        ) : null}

        {form.kind !== 'Quiz' || form.graded ? (
          <Checkbox label={<><span className="font-medium">{t.course.requiredLesson}</span><span className="block text-[12px] text-[var(--text-faint)]">{t.course.requiredHint}</span></>} checked={form.required} onChange={(e) => setForm({ ...form, required: e.target.checked })} />
        ) : null}
      </div>
    </Modal>
  );
}

/* ───────────────────────── Question editor ───────────────────────── */

const LETTERS = 'abcdefgh'.split('');

function QuestionModal({ open, onClose, versionId, lessonId, question }: { open: boolean; onClose: () => void; versionId: string; lessonId: string | null; question: QuestionState | null }) {
  const { t, run, busy } = useApp();
  const [kind, setKind] = useState<QuestionState['kind']>(question?.kind ?? 'Single');
  const [prompt, setPrompt] = useState(question?.prompt ?? '');
  const [points, setPoints] = useState(question?.points ?? 1);
  const [guide, setGuide] = useState(question?.guide ?? '');
  const [choices, setChoices] = useState(() => (question && (question.kind === 'Single' || question.kind === 'Multiple') ? question.choices : [{ id: 'a', text: '' }, { id: 'b', text: '' }, { id: 'c', text: '' }]));
  // Single and TrueFalse keep one id; Multiple keeps several.
  const [correct, setCorrect] = useState<string[]>(() => (question?.correct ? question.correct.split(',') : [kind === 'TrueFalse' ? 'true' : 'a']));
  const nextId = () => LETTERS.find((c) => !choices.some((x) => x.id === c)) ?? String(Date.now());
  const filled = choices.filter((c) => c.text.trim());
  const valid = prompt.trim() && points >= 1 && (
    kind === 'Text' ? true
    : kind === 'TrueFalse' ? ['true', 'false'].includes(correct[0])
    : filled.length >= 2 && correct.length >= 1 && correct.every((id) => filled.some((c) => c.id === id)) && (kind === 'Multiple' || correct.length === 1)
  );

  function changeKind(k: QuestionState['kind']) {
    setKind(k);
    setCorrect(k === 'TrueFalse' ? ['true'] : k === 'Text' ? [] : [choices[0]?.id ?? 'a']);
  }

  async function save() {
    const r = await run('question.save', {
      versionId, lessonId, ...(question ? { id: question.id } : {}), kind, prompt, points, guide,
      choices: kind === 'Single' || kind === 'Multiple' ? filled : [],
      correct: kind === 'Multiple' ? correct : kind === 'Text' ? '' : correct[0],
    });
    if (r) onClose();
  }

  return (
    <Modal open={open} onClose={onClose} size="lg" title={question ? t.course.questions : t.course.addQuestion}
      footer={<><Button variant="ghost" onClick={onClose}>{t.common.cancel}</Button><Button loading={busy} disabled={!valid} onClick={save}>{t.common.save}</Button></>}>
      <div className="space-y-4">
        <div>
          <p className="mb-1.5 text-[13px] font-medium">{t.course.questionKind}</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {(['Single', 'Multiple', 'TrueFalse', 'Text'] as const).map((k) => (
              <button key={k} type="button" onClick={() => changeKind(k)}
                className={cx('rounded-xl border px-3 py-2.5 text-start text-[12.5px] font-medium transition-colors', kind === k ? 'border-copper-600 bg-copper-100 text-copper-700' : 'border-[var(--line-strong)] hover:bg-[var(--surface-sunken)]')}>
                {t.course.questionKinds[k]}
                <span className="mt-0.5 block text-[11px] font-normal text-[var(--text-faint)]">{k === 'Text' ? t.course.manualGraded : t.course.autoGraded}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-[1fr_8rem]">
          <Field label={t.course.prompt} required>
            <Textarea rows={3} value={prompt} maxLength={2000} onChange={(e) => setPrompt(e.target.value)} />
          </Field>
          <Field label={t.course.points}>
            <Input type="number" min={1} max={100} dir="ltr" value={points} onChange={(e) => setPoints(Number(e.target.value))} />
          </Field>
        </div>

        {kind === 'Text' ? (
          <>
            <p className="rounded-lg bg-info-soft px-3 py-2 text-[12.5px] text-info">{t.course.manualHint}</p>
            <Field label={t.course.guide} hint={t.course.guideHint}>
              <Textarea rows={3} value={guide} maxLength={4000} onChange={(e) => setGuide(e.target.value)} />
            </Field>
          </>
        ) : kind === 'TrueFalse' ? (
          <fieldset>
            <legend className="mb-2 text-[13px] font-medium">{t.course.markCorrect}</legend>
            <div className="flex gap-3">
              {(['true', 'false'] as const).map((v) => (
                <label key={v} className={cx('flex flex-1 cursor-pointer items-center gap-2.5 rounded-xl border px-3 py-2.5 text-[13.5px]', correct[0] === v ? 'border-positive bg-positive-soft' : 'border-[var(--line-strong)]')}>
                  <input type="radio" name="correct" checked={correct[0] === v} onChange={() => setCorrect([v])} className="accent-[var(--color-positive)]" />
                  {v === 'true' ? t.quiz.true : t.quiz.false}
                </label>
              ))}
            </div>
          </fieldset>
        ) : (
          <fieldset>
            <legend className="mb-2 text-[13px] font-medium">{t.course.choices} <span className="font-normal text-[var(--text-faint)]">· {t.course.markCorrect}</span></legend>
            {kind === 'Multiple' ? <p className="mb-2 text-[12px] text-[var(--text-faint)]">{t.course.multipleHint}</p> : null}
            <div className="space-y-2">
              {choices.map((c, i) => {
                const on = correct.includes(c.id);
                return (
                  <div key={c.id} className={cx('flex items-center gap-2.5 rounded-xl border px-3 py-1.5', on ? 'border-positive bg-positive-soft' : 'border-[var(--line-strong)]')}>
                    <input type={kind === 'Multiple' ? 'checkbox' : 'radio'} name="correct" aria-label={t.course.markCorrect} checked={on}
                      onChange={(e) => setCorrect(kind === 'Multiple' ? (e.target.checked ? [...correct, c.id] : correct.filter((x) => x !== c.id)) : [c.id])} className="size-4 accent-[var(--color-positive)]" />
                    <input className="min-w-0 flex-1 bg-transparent py-1 text-[13.5px] outline-none" value={c.text} maxLength={500} placeholder={`${t.course.choices} ${i + 1}`} onChange={(e) => setChoices(choices.map((x) => (x.id === c.id ? { ...x, text: e.target.value } : x)))} />
                    {choices.length > 2 ? (
                      <button type="button" onClick={() => { setChoices(choices.filter((x) => x.id !== c.id)); setCorrect(correct.filter((x) => x !== c.id)); }} className="rounded p-1 text-[var(--text-faint)] hover:text-critical" aria-label={t.common.remove}><Trash2 size={14} /></button>
                    ) : null}
                  </div>
                );
              })}
              {choices.length < 8 ? <Button type="button" size="sm" variant="subtle" icon={<Plus size={14} />} onClick={() => setChoices([...choices, { id: nextId(), text: '' }])}>{t.course.addChoice}</Button> : null}
            </div>
          </fieldset>
        )}
      </div>
    </Modal>
  );
}

/** The questions of one quiz, in order: a quiz lesson, or the final exam when lessonId is null. */
function QuestionList({ versionId, lessonId, questions, editable }: { versionId: string; lessonId: string | null; questions: QuestionState[]; editable: boolean }) {
  const { t, locale, run } = useApp();
  const [target, setTarget] = useState<{ question: QuestionState | null } | null>(null);
  const total = questions.reduce((s, q) => s + q.points, 0);
  function move(i: number, d: -1 | 1) {
    const ids = questions.map((q) => q.id); const j = i + d; if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]]; void run('question.reorder', { versionId, lessonId, ids });
  }
  const keyOf = (q: QuestionState) => q.correct.split(',');
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[12.5px] text-[var(--text-muted)]">{formatNumber(questions.length, locale)} {t.course.questionCount} · {t.course.totalPoints}: {formatNumber(total, locale)}</p>
        {editable ? <Button size="sm" icon={<Plus size={14} />} onClick={() => setTarget({ question: null })}>{t.course.addQuestion}</Button> : null}
      </div>
      {questions.length === 0 ? (
        <EmptyState title={t.course.noQuestions} hint={t.course.noQuestionsYet} icon={<CheckCircle2 size={19} />} />
      ) : (
        <ol className="mt-3 divide-y divide-[var(--line-soft)] rounded-xl border border-[var(--line-soft)]">
          {questions.map((q, i) => (
            <li key={q.id} className="flex gap-3 px-4 py-3.5">
              <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md bg-[var(--surface-sunken)] text-[12px] font-semibold tabular-nums">{i + 1}</span>
              <div className="min-w-0 flex-1">
                <p className="text-[13.5px] font-medium leading-relaxed">{q.prompt}</p>
                {q.kind === 'Text' ? (
                  q.guide ? <p className="mt-1.5 rounded-lg bg-[var(--surface-sunken)] px-2.5 py-1.5 text-[12px] text-[var(--text-muted)]"><span className="font-medium">{t.course.guide}: </span>{q.guide}</p> : null
                ) : (
                  <ul className="mt-1.5 flex flex-wrap gap-1.5">
                    {(q.kind === 'TrueFalse' ? [{ id: 'true', text: t.quiz.true }, { id: 'false', text: t.quiz.false }] : q.choices).map((c) => {
                      const on = keyOf(q).includes(c.id);
                      return <li key={c.id}><Badge tone={on ? 'positive' : 'neutral'}>{on ? <CheckCircle2 size={11} /> : null}{c.text}</Badge></li>;
                    })}
                  </ul>
                )}
                <p className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11.5px] text-[var(--text-faint)]">
                  {t.course.questionKinds[q.kind]} · {formatNumber(q.points, locale)} {t.quiz.points}
                  <Badge tone={q.kind === 'Text' ? 'caution' : 'info'}>{q.kind === 'Text' ? t.course.manualGraded : t.course.autoGraded}</Badge>
                </p>
              </div>
              {editable ? (
                <span className="flex shrink-0 items-start gap-1">
                  <Button size="sm" variant="subtle" aria-label={t.common.moveUp} disabled={i === 0} onClick={() => move(i, -1)}><ArrowUp size={14} /></Button>
                  <Button size="sm" variant="subtle" aria-label={t.common.moveDown} disabled={i === questions.length - 1} onClick={() => move(i, 1)}><ArrowDown size={14} /></Button>
                  <Button size="sm" variant="subtle" aria-label={t.common.edit} onClick={() => setTarget({ question: q })}><Pencil size={14} /></Button>
                  <Button size="sm" variant="subtle" aria-label={t.course.deleteQuestion} onClick={() => { if (confirm(t.course.deleteQuestion)) void run('question.delete', { versionId, id: q.id }); }}><Trash2 size={14} /></Button>
                </span>
              ) : null}
            </li>
          ))}
        </ol>
      )}
      {target ? <QuestionModal key={target.question?.id ?? 'new'} open onClose={() => setTarget(null)} versionId={versionId} lessonId={lessonId} question={target.question} /> : null}
    </>
  );
}

/* ───────────────────────── Assign ───────────────────────── */

export function AssignModal({ open, onClose, versionId, versionNumber, options }: { open: boolean; onClose: () => void; versionId: string | null; versionNumber: number; options: AssignData }) {
  const { t, locale, run, busy, toast } = useApp();
  const [mode, setMode] = useState<'group' | 'people'>(options.groups.length ? 'group' : 'people');
  const [groupId, setGroupId] = useState(options.groups[0]?.id ?? '');
  const [picked, setPicked] = useState<string[]>([]);
  const [query, setQuery] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [dueAt, setDueAt] = useState('');
  const group = options.groups.find((g) => g.id === groupId);
  const people = options.members.filter((m) => !query || `${m.name} ${m.email}`.toLowerCase().includes(query.toLowerCase()));

  async function submit() {
    if (!versionId) return;
    const r = (await run('enrollment.assign', { versionId, ...(mode === 'group' ? { groupId } : { membershipIds: picked }), ...(startsAt ? { startsAt: new Date(startsAt).toISOString() } : {}), dueAt: dueAt ? new Date(dueAt).toISOString() : null })) as { created: number; skipped: number } | null;
    if (r) {
      toast('success', t.assign.result.replace('{created}', formatNumber(r.created, locale)).replace('{skipped}', formatNumber(r.skipped, locale)));
      setPicked([]);
      onClose();
    }
  }

  return (
    <Modal open={open} onClose={onClose} size="lg" title={t.assign.title} description={versionId ? t.assign.subtitle.replace('{n}', String(versionNumber)) : undefined}
      footer={versionId ? <><Button variant="ghost" onClick={onClose}>{t.common.cancel}</Button><Button loading={busy} icon={<UserPlus size={15} />} disabled={mode === 'group' ? !groupId : !picked.length} onClick={submit}>{t.assign.submit}</Button></> : undefined}>
      {!versionId ? (
        <p className="text-[13.5px] text-[var(--text-muted)]">{t.assign.noPublished}</p>
      ) : (
        <div className="space-y-4">
          <Tabs value={mode} onChange={(v) => setMode(v)} items={[{ value: 'group', label: t.assign.toGroup, count: options.groups.length }, { value: 'people', label: t.assign.toPeople }]} />
          {mode === 'group' ? (
            options.groups.length ? (
              <Field label={t.assign.group} hint={group ? t.assign.groupCount.replace('{n}', formatNumber(group.count, locale)) : undefined}>
                <Select value={groupId} onChange={(e) => setGroupId(e.target.value)}>
                  {options.groups.map((g) => <option key={g.id} value={g.id}>{g.name} ({formatNumber(g.count, locale)})</option>)}
                </Select>
              </Field>
            ) : <p className="text-[13px] text-[var(--text-muted)]">{t.people.noGroupsHint}</p>
          ) : (
            <div>
              <div className="mb-2 flex items-center justify-between gap-3">
                <Input placeholder={t.common.searchPlaceholder} value={query} onChange={(e) => setQuery(e.target.value)} className="max-w-xs" />
                <span className="text-[12.5px] text-[var(--text-muted)]">{formatNumber(picked.length, locale)} {t.assign.peopleSelected}</span>
              </div>
              <ul className="max-h-64 divide-y divide-[var(--line-soft)] overflow-y-auto rounded-xl border border-[var(--line-soft)]">
                {people.map((m) => (
                  <li key={m.id}>
                    <Checkbox className="px-3 py-2.5 hover:bg-[var(--surface-sunken)]" checked={picked.includes(m.id)} onChange={(e) => setPicked(e.target.checked ? [...picked, m.id] : picked.filter((x) => x !== m.id))}
                      label={<><span className="font-medium">{m.name}</span> <span className="text-[12px] text-[var(--text-faint)]" dir="ltr">{m.email}</span></>} />
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t.assign.startsAt} hint={t.common.optional}>
              <Input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
            </Field>
            <Field label={t.assign.dueAt} hint={t.assign.dueHint}>
              <Input type="datetime-local" value={dueAt} min={toLocalInput(new Date())} onChange={(e) => setDueAt(e.target.value)} />
            </Field>
          </div>
        </div>
      )}
    </Modal>
  );
}

/* ───────────────────────── Tabs ───────────────────────── */

function ContentTab({ data, editable }: { data: EditorData; editable: boolean }) {
  const { t, locale, run } = useApp();
  const v = data.version;
  const [lessonTarget, setLessonTarget] = useState<{ moduleId: string; lesson: LessonState | null } | null>(null);
  const [quizLesson, setQuizLesson] = useState<LessonState | null>(null);
  const questionsOf = (lessonId: string) => v.questions.filter((q) => q.lessonId === lessonId);
  const [renaming, setRenaming] = useState<ModuleState | null>(null);
  const [moduleName, setModuleName] = useState('');
  const [addingModule, setAddingModule] = useState(false);

  // Moves go through one reorder command with the full outline, so the server checks the whole shape at once.
  function outline(modules: ModuleState[]) {
    return run('outline.reorder', { versionId: v.id, modules: modules.map((m) => ({ id: m.id, lessonIds: m.lessons.map((l) => l.id) })) });
  }
  function moveModule(i: number, d: -1 | 1) {
    const list = [...v.modules]; const j = i + d; if (j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]]; void outline(list);
  }
  function moveLesson(mi: number, li: number, d: -1 | 1) {
    const list = v.modules.map((m) => ({ ...m, lessons: [...m.lessons] }));
    const lessons = list[mi].lessons; const j = li + d;
    if (j >= 0 && j < lessons.length) { [lessons[li], lessons[j]] = [lessons[j], lessons[li]]; }
    else { const target = list[mi + d]; if (!target) return; const [l] = lessons.splice(li, 1); if (d < 0) target.lessons.push(l); else target.lessons.unshift(l); }
    void outline(list);
  }

  return (
    <div className="space-y-4">
      {v.modules.map((m, mi) => (
        <Card key={m.id} padded={false}>
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--line-soft)] px-4 py-3">
            <h3 className="flex items-center gap-2 text-[14px] font-semibold"><span className="flex size-6 items-center justify-center rounded-md bg-copper-100 text-[12px] text-copper-700">{mi + 1}</span>{m.title}</h3>
            {editable ? (
              <div className="flex items-center gap-1">
                <Button size="sm" variant="subtle" aria-label={t.common.moveUp} disabled={mi === 0} onClick={() => moveModule(mi, -1)}><ArrowUp size={14} /></Button>
                <Button size="sm" variant="subtle" aria-label={t.common.moveDown} disabled={mi === v.modules.length - 1} onClick={() => moveModule(mi, 1)}><ArrowDown size={14} /></Button>
                <Button size="sm" variant="subtle" aria-label={t.common.edit} onClick={() => { setRenaming(m); setModuleName(m.title); }}><Pencil size={14} /></Button>
                <Button size="sm" variant="subtle" aria-label={t.course.deleteModule} onClick={() => { if (confirm(t.course.deleteModule)) void run('module.delete', { versionId: v.id, id: m.id }); }}><Trash2 size={14} /></Button>
              </div>
            ) : null}
          </div>
          {m.lessons.length === 0 ? (
            <p className="px-4 py-5 text-[13px] text-[var(--text-faint)]">{t.course.emptyModule}</p>
          ) : (
            <ul className="divide-y divide-[var(--line-soft)]">
              {m.lessons.map((l, li) => {
                const Icon = kindIcon[l.kind];
                const asset = l.assetId ? data.assets[l.assetId] : null;
                return (
                  <li key={l.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
                    <Icon size={16} className="shrink-0 text-[var(--text-faint)]" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13.5px] font-medium">{l.title}</span>
                      <span className="flex flex-wrap items-center gap-2 text-[11.5px] text-[var(--text-faint)]">
                        {t.course.kinds[l.kind]}
                        {l.kind === 'Video' && l.durationSeconds ? <span className="tabular-nums">{Math.floor(l.durationSeconds / 60)}:{String(l.durationSeconds % 60).padStart(2, '0')}</span> : null}
                        {asset && asset.status !== 'Clean' ? <Badge tone={asset.status === 'Rejected' ? 'critical' : 'caution'}>{asset.status === 'Rejected' ? t.course.scanRejected : t.course.scanPending}</Badge> : null}
                        {l.kind === 'Quiz' ? <span>{formatNumber(questionsOf(l.id).length, locale)} {t.course.questionCount}{l.graded ? ` · ${t.quiz.passMark} ${l.passPercent}%` : ''}</span> : null}
                        {l.kind === 'Quiz' && questionsOf(l.id).length === 0 ? <Badge tone="caution">{t.course.noQuestionsYet}</Badge> : null}
                      </span>
                    </span>
                    {l.kind === 'Quiz' ? <Badge tone={l.graded ? 'info' : 'neutral'}>{l.graded ? t.course.graded : t.course.practice}</Badge> : null}
                    {l.kind === 'Quiz' ? <Button size="sm" variant="ghost" icon={<ListChecks size={14} />} onClick={() => setQuizLesson(l)}>{t.course.manageQuestions}</Button> : null}
                    <Badge tone={l.required ? 'accent' : 'neutral'}>{l.required ? t.learn.required : t.learn.optionalLesson}</Badge>
                    {editable ? (
                      <span className="flex items-center gap-1">
                        <Button size="sm" variant="subtle" aria-label={t.common.moveUp} disabled={mi === 0 && li === 0} onClick={() => moveLesson(mi, li, -1)}><ArrowUp size={14} /></Button>
                        <Button size="sm" variant="subtle" aria-label={t.common.moveDown} disabled={mi === v.modules.length - 1 && li === m.lessons.length - 1} onClick={() => moveLesson(mi, li, 1)}><ArrowDown size={14} /></Button>
                        <Button size="sm" variant="subtle" aria-label={t.common.edit} onClick={() => setLessonTarget({ moduleId: m.id, lesson: l })}><Pencil size={14} /></Button>
                        <Button size="sm" variant="subtle" aria-label={t.course.deleteLesson} onClick={() => { if (confirm(t.course.deleteLesson)) void run('lesson.delete', { versionId: v.id, id: l.id }); }}><Trash2 size={14} /></Button>
                      </span>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
          {editable ? (
            <div className="border-t border-[var(--line-soft)] px-4 py-2.5">
              <Button size="sm" variant="subtle" icon={<Plus size={14} />} onClick={() => setLessonTarget({ moduleId: m.id, lesson: null })}>{t.course.addLesson}</Button>
            </div>
          ) : null}
        </Card>
      ))}
      {editable ? <Button variant="ghost" icon={<Plus size={15} />} onClick={() => { setAddingModule(true); setModuleName(''); }}>{t.course.addModule}</Button> : null}

      {quizLesson ? (
        <Modal open onClose={() => setQuizLesson(null)} size="xl" title={`${t.course.manageQuestions} · ${quizLesson.title}`} description={quizLesson.graded ? `${t.course.graded} · ${t.quiz.passMark} ${quizLesson.passPercent}% · ${t.course.maxAttempts} ${quizLesson.maxAttempts}` : t.course.practiceHint}>
          <QuestionList versionId={v.id} lessonId={quizLesson.id} questions={questionsOf(quizLesson.id)} editable={editable} />
        </Modal>
      ) : null}
      {lessonTarget ? (
        <LessonModal key={lessonTarget.lesson?.id ?? `new-${lessonTarget.moduleId}`} open onClose={() => setLessonTarget(null)} versionId={v.id} moduleId={lessonTarget.moduleId} lesson={lessonTarget.lesson} assets={data.assets} library={data.library} />
      ) : null}
      <Modal open={addingModule || !!renaming} onClose={() => { setAddingModule(false); setRenaming(null); }} title={renaming ? t.course.moduleName : t.course.addModule}
        footer={<Button disabled={!moduleName.trim()} onClick={async () => { const r = await run('module.save', { versionId: v.id, ...(renaming ? { id: renaming.id } : {}), title: moduleName }); if (r) { setAddingModule(false); setRenaming(null); } }}>{t.common.save}</Button>}>
        <Field label={t.course.moduleName} required><Input value={moduleName} maxLength={200} onChange={(e) => setModuleName(e.target.value)} /></Field>
      </Modal>
    </div>
  );
}

function QuizTab({ data, editable }: { data: EditorData; editable: boolean }) {
  const { t, run, busy } = useApp();
  const v = data.version;
  const finals = v.questions.filter((q) => !q.lessonId);
  const [rules, setRules] = useState({ quizEnabled: v.quizEnabled, passPercent: v.passPercent, maxAttempts: v.maxAttempts, timeLimitMinutes: v.timeLimitMinutes ?? ('' as number | '') });
  const dirty = rules.quizEnabled !== v.quizEnabled || rules.passPercent !== v.passPercent || rules.maxAttempts !== v.maxAttempts || (rules.timeLimitMinutes || null) !== v.timeLimitMinutes;

  return (
    <div className="grid gap-4 lg:grid-cols-[20rem_1fr]">
      <Card>
        <SectionHeader title={t.course.finalExam} />
        <div className="mt-4 space-y-4">
          <Checkbox disabled={!editable} checked={rules.quizEnabled} onChange={(e) => setRules({ ...rules, quizEnabled: e.target.checked })} label={<><span className="font-medium">{t.course.quizEnabled}</span><span className="block text-[12px] text-[var(--text-faint)]">{t.course.quizEnabledHint}</span></>} />
          <Field label={t.course.passPercent}><Input disabled={!editable || !rules.quizEnabled} type="number" min={1} max={100} dir="ltr" value={rules.passPercent} onChange={(e) => setRules({ ...rules, passPercent: Number(e.target.value) })} /></Field>
          <Field label={t.course.maxAttempts}><Input disabled={!editable || !rules.quizEnabled} type="number" min={1} max={20} dir="ltr" value={rules.maxAttempts} onChange={(e) => setRules({ ...rules, maxAttempts: Number(e.target.value) })} /></Field>
          <Field label={t.course.timeLimit} hint={t.course.timeLimitHint}><Input disabled={!editable || !rules.quizEnabled} type="number" min={1} max={600} dir="ltr" value={rules.timeLimitMinutes} onChange={(e) => setRules({ ...rules, timeLimitMinutes: e.target.value ? Number(e.target.value) : '' })} /></Field>
          {editable ? <Button loading={busy} disabled={!dirty} onClick={() => run('version.update', { id: v.id, version: v.version, title: v.title, description: v.description, estimatedMinutes: v.estimatedMinutes, quizEnabled: rules.quizEnabled, passPercent: rules.passPercent, maxAttempts: rules.maxAttempts, timeLimitMinutes: rules.timeLimitMinutes || null })}>{t.common.save}</Button> : null}
        </div>
      </Card>
      <Card>
        <SectionHeader title={t.course.questions} />
        <div className="mt-3"><QuestionList versionId={v.id} lessonId={null} questions={finals} editable={editable} /></div>
      </Card>
    </div>
  );
}

function SettingsTab({ data, role }: { data: EditorData; role: Role }) {
  const { t, run, busy } = useApp();
  const v = data.version;
  const [course, setCourse] = useState({ title: data.course.title, category: data.course.category });
  const [meta, setMeta] = useState({ description: v.description, estimatedMinutes: v.estimatedMinutes, coverAssetId: v.coverAssetId });
  const [instructors, setInstructors] = useState<string[]>(data.course.instructorIds);
  const cover = meta.coverAssetId ? data.assets[meta.coverAssetId] ?? data.library.find((a) => a.id === meta.coverAssetId) ?? null : null;
  const archived = !!data.course.archivedAt;

  async function save() {
    // The title lives on both the course and its latest version; both are saved together.
    const a = await run('version.update', { id: v.id, version: v.version, title: course.title, ...meta });
    if (a) await run('course.update', { id: data.course.id, ...course, ...(role === 'Admin' ? { instructorIds: instructors } : {}) });
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
      <Card>
        <div className="space-y-4">
          <Field label={t.course.name} required><Input value={course.title} maxLength={200} onChange={(e) => setCourse({ ...course, title: e.target.value })} /></Field>
          <Field label={t.course.category} hint={t.course.categoryHint}><Input value={course.category} maxLength={80} onChange={(e) => setCourse({ ...course, category: e.target.value })} /></Field>
          <Field label={t.course.description}><Textarea rows={4} value={meta.description} maxLength={4000} onChange={(e) => setMeta({ ...meta, description: e.target.value })} /></Field>
          <Field label={t.course.estimated}><Input type="number" min={0} dir="ltr" className="max-w-40" value={meta.estimatedMinutes} onChange={(e) => setMeta({ ...meta, estimatedMinutes: Number(e.target.value) })} /></Field>
          <div>
            <p className="mb-1.5 text-[13px] font-medium">{t.course.cover}</p>
            {cover ? <div className="mb-2 max-w-sm"><AssetChip asset={cover} onClear={() => setMeta({ ...meta, coverAssetId: null })} /></div> : null}
            <UploadButton accept="image/png,image/jpeg,image/webp" onUploaded={(asset) => setMeta({ ...meta, coverAssetId: asset.id })} />
            <p className="mt-1 text-[12px] text-[var(--text-faint)]">{t.course.coverHint}</p>
          </div>
          {role === 'Admin' ? (
            <fieldset>
              <legend className="mb-1.5 text-[13px] font-medium">{t.course.instructors}</legend>
              <p className="mb-2 text-[12px] text-[var(--text-faint)]">{t.course.instructorsHint}</p>
              <div className="grid gap-1.5 sm:grid-cols-2">
                {data.staff.filter((s) => s.role === 'Instructor').map((s) => (
                  <Checkbox key={s.userId} label={s.name} checked={instructors.includes(s.userId)} onChange={(e) => setInstructors(e.target.checked ? [...instructors, s.userId] : instructors.filter((x) => x !== s.userId))} />
                ))}
                {!data.staff.some((s) => s.role === 'Instructor') ? <p className="text-[12.5px] text-[var(--text-muted)]">{t.course.noInstructors}</p> : null}
              </div>
            </fieldset>
          ) : null}
          <Button loading={busy} disabled={!course.title.trim()} onClick={save}>{t.common.save}</Button>
        </div>
      </Card>
      {role === 'Admin' ? (
        <Card>
          <SectionHeader title={archived ? t.course.restore : t.course.archive} hint={t.course.archiveHint} />
          <Button className="mt-4" variant={archived ? 'ghost' : 'danger'} onClick={() => run(archived ? 'course.restore' : 'course.archive', { id: data.course.id })}>{archived ? t.course.restore : t.course.archive}</Button>
        </Card>
      ) : null}
    </div>
  );
}

function LearnersTab({ enrollments, role }: { enrollments: EnrollmentRow[]; role: Role }) {
  const { t, locale, run } = useApp();
  const [withdraw, setWithdraw] = useState<EnrollmentRow | null>(null);
  const [due, setDue] = useState<EnrollmentRow | null>(null);
  const [reason, setReason] = useState('');
  const [dueAt, setDueAt] = useState('');
  if (!enrollments.length) return <Card><EmptyState title={t.common.empty} hint={t.assign.dueHint} icon={<UserPlus size={19} />} /></Card>;
  return (
    <Card padded={false}>
      <Table>
        <thead><tr><Th>{t.report.learner}</Th><Th>{t.common.status}</Th><Th>{t.report.progress}</Th><Th>{t.report.due}</Th><Th>{t.report.score}</Th>{role === 'Admin' ? <Th /> : null}</tr></thead>
        <tbody>
          {enrollments.map((e) => {
            const pct = progressPercent(e.requiredDone, e.requiredTotal);
            return (
              <Tr key={e.id}>
                <Td><span className="block font-medium">{e.name}</span><span className="block text-[11.5px] text-[var(--text-faint)]" dir="ltr">{e.email}</span></Td>
                <Td><div className="flex flex-wrap gap-1"><StatusBadge status={e.status} label={t.statuses[e.status as keyof typeof t.statuses] ?? e.status} />{isOverdue(e) ? <Badge tone="caution">{t.common.overdue}</Badge> : null}</div><span className="mt-1 block text-[11px] text-[var(--text-faint)]">{t.course.version} {e.versionNumber}</span></Td>
                <Td className="min-w-36"><div className="flex items-center gap-2"><Progress value={pct} tone={e.status === 'Completed' ? 'positive' : 'accent'} /><span className="w-9 text-end text-[12px] tabular-nums">{pct}%</span></div></Td>
                <Td className="text-[12.5px] tabular-nums">{e.dueAt ? formatDate(e.dueAt, locale) : '…'}</Td>
                <Td className="tabular-nums">{e.bestScore === null ? '…' : `${formatNumber(e.bestScore, locale, 1)}%`}</Td>
                {role === 'Admin' ? (
                  <Td className="text-end">
                    {['NotStarted', 'InProgress'].includes(e.status) ? (
                      <span className="flex justify-end gap-1">
                        <Button size="sm" variant="subtle" onClick={() => { setDue(e); setDueAt(e.dueAt ? toLocalInput(e.dueAt) : ''); }}>{t.assign.changeDue}</Button>
                        <Button size="sm" variant="subtle" className="text-critical" onClick={() => { setWithdraw(e); setReason(''); }}>{t.assign.withdraw}</Button>
                      </span>
                    ) : null}
                  </Td>
                ) : null}
              </Tr>
            );
          })}
        </tbody>
      </Table>
      <Modal open={!!withdraw} onClose={() => setWithdraw(null)} title={t.assign.withdraw} description={withdraw?.name}
        footer={<Button variant="danger" disabled={reason.trim().length < 3} onClick={async () => { if (await run('enrollment.withdraw', { id: withdraw!.id, reason })) setWithdraw(null); }}>{t.common.confirm}</Button>}>
        <p className="mb-3 text-[13px] text-[var(--text-muted)]">{t.assign.withdrawHint}</p>
        <Field label={t.common.reason} required><Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
      </Modal>
      <Modal open={!!due} onClose={() => setDue(null)} title={t.assign.changeDue} description={due?.name}
        footer={<Button onClick={async () => { if (await run('enrollment.due', { id: due!.id, dueAt: dueAt ? new Date(dueAt).toISOString() : null })) setDue(null); }}>{t.common.save}</Button>}>
        <Field label={t.assign.dueAt} hint={t.assign.dueHint}><Input type="datetime-local" value={dueAt} min={toLocalInput(new Date())} onChange={(e) => setDueAt(e.target.value)} /></Field>
      </Modal>
    </Card>
  );
}

function VersionsTab({ data }: { data: EditorData }) {
  const { t, locale } = useApp();
  const pathname = usePathname();
  return (
    <Card padded={false}>
      <div className="px-5 pt-5"><SectionHeader title={t.course.versions} hint={t.course.versionsHint} /></div>
      <Table className="mt-3">
        <thead><tr><Th>{t.course.version}</Th><Th>{t.common.status}</Th><Th>{t.course.publishedOn}</Th><Th className="text-center">{t.course.enrollmentsIn}</Th><Th /></tr></thead>
        <tbody>
          {data.versions.map((x) => (
            <Tr key={x.id}>
              <Td className="font-medium tabular-nums">{x.number}{x.id === data.version.id ? <Badge tone="accent" className="ms-2">{t.common.selected}</Badge> : null}</Td>
              <Td><StatusBadge status={x.status} label={t.course.versionStatus[x.status as keyof typeof t.course.versionStatus] ?? x.status} /></Td>
              <Td className="text-[12.5px] tabular-nums">{x.publishedAt ? formatDateTime(x.publishedAt, locale) : '…'}</Td>
              <Td className="text-center tabular-nums">{formatNumber(x.enrollments, locale)}</Td>
              <Td className="text-end"><Link href={`${pathname}?v=${x.id}`} className="text-[13px] font-medium text-copper-700 hover:underline">{t.course.openVersion}</Link></Td>
            </Tr>
          ))}
        </tbody>
      </Table>
    </Card>
  );
}

/* ───────────────────────── Editor ───────────────────────── */

export function CourseEditor({ data, role, enrollments, assign }: { data: EditorData; role: Role; enrollments: EnrollmentRow[]; assign: AssignData | null }) {
  const { t, locale, run, busy } = useApp();
  const router = useRouter();
  const params = useSearchParams();
  const [tab, setTab] = useState<Tab>((params.get('tab') as Tab) ?? 'content');
  const [assigning, setAssigning] = useState(false);
  const v = data.version;
  const published = data.versions.find((x) => x.status === 'Published') ?? null;
  const draft = data.versions.find((x) => x.status === 'Draft') ?? null;
  const archived = !!data.course.archivedAt;
  const editable = !v.locked && v.status !== 'Archived' && !archived;
  const blockerKeys: PublishBlocker[] = ['title', 'requiredLesson', 'lessonContent', 'lessonQuiz', 'quizEmpty', 'quizInvalid', 'quizRules'];
  const hasQuizLessons = v.modules.some((m) => m.lessons.some((l) => l.kind === 'Quiz'));
  const relevant = blockerKeys.filter((b) => (b === 'lessonQuiz' ? hasQuizLessons : v.quizEnabled || !b.startsWith('quiz')));
  const lessons = useMemo(() => v.modules.reduce((s, m) => s + m.lessons.length, 0), [v.modules]);

  async function newVersion() {
    const r = (await run('version.next', { courseId: data.course.id })) as { id: string } | null;
    if (r) router.push(`/${locale}/courses/${data.course.id}?v=${r.id}`);
  }

  return (
    <>
      <div className="mb-2 text-[13px]"><Link href={`/${locale}/courses`} className="text-[var(--text-muted)] hover:underline">{t.course.title}</Link></div>
      <PageHeader
        title={data.course.title}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <StatusBadge status={v.status} label={`${t.course.version} ${v.number} · ${t.course.versionStatus[v.status as keyof typeof t.course.versionStatus] ?? v.status}`} />
            {archived ? <Badge>{t.course.archived}</Badge> : null}
            <span>{formatNumber(lessons, locale)} {t.course.lessons}</span>
            {v.enrollments ? <span>· {formatNumber(v.enrollments, locale)} {t.course.enrolled}</span> : null}
          </span>
        }
        action={
          <>
            {role === 'Admin' && assign && !archived ? <Button variant="ghost" icon={<UserPlus size={15} />} onClick={() => setAssigning(true)}>{t.course.assign}</Button> : null}
            {!draft && !archived ? <Button variant="ghost" icon={<CopyPlus size={15} />} loading={busy} onClick={() => { if (confirm(t.course.newVersionHint)) void newVersion(); }}>{t.course.newVersion}</Button> : null}
            {v.status === 'Draft' && v.number > 1 && !v.locked ? <Button variant="subtle" onClick={() => { if (confirm(t.course.discardDraft)) void run('version.discard', { id: v.id }).then((r) => r && router.push(`/${locale}/courses/${data.course.id}`)); }}>{t.course.discardDraft}</Button> : null}
            {v.status === 'Draft' && role === 'Admin' && !archived ? <Button icon={<Send size={15} />} disabled={data.blockers.length > 0} loading={busy} onClick={() => { if (confirm(t.course.publishHint)) void run('version.publish', { id: v.id }); }}>{t.course.publish}</Button> : null}
          </>
        }
      />

      {v.locked ? (
        <div className="mb-4 flex items-start gap-3 rounded-xl border border-info/25 bg-info-soft px-4 py-3 text-[13px] text-info">
          <Lock size={16} className="mt-0.5 shrink-0" />
          <div><p className="font-semibold">{t.course.lockedTitle}</p><p className="mt-0.5 leading-relaxed">{t.course.lockedBody}</p></div>
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[1fr_17rem]">
        <div className="min-w-0">
          <Tabs value={tab} onChange={(x) => setTab(x)} items={[
            { value: 'content', label: t.course.tabs.content },
            { value: 'quiz', label: t.course.finalExam, count: v.questions.filter((q) => !q.lessonId).length || undefined },
            { value: 'settings', label: t.course.tabs.settings },
            { value: 'learners', label: t.course.tabs.learners, count: enrollments.length || undefined },
            { value: 'versions', label: t.course.tabs.versions, count: data.versions.length },
          ]} />
          <div className="mt-4">
            {tab === 'content' ? <ContentTab data={data} editable={editable} /> : null}
            {tab === 'quiz' ? <QuizTab key={v.id} data={data} editable={editable} /> : null}
            {tab === 'settings' ? <SettingsTab key={v.id} data={data} role={role} /> : null}
            {tab === 'learners' ? <LearnersTab enrollments={enrollments} role={role} /> : null}
            {tab === 'versions' ? <VersionsTab data={data} /> : null}
          </div>
        </div>

        <aside className="space-y-4">
          {v.status === 'Draft' ? (
            <Card>
              <SectionHeader title={t.course.checklist} />
              <ul className="mt-3 space-y-2">
                {relevant.map((b) => {
                  const ok = !data.blockers.includes(b);
                  return (
                    <li key={b} className="flex items-start gap-2 text-[12.5px] leading-snug">
                      {ok ? <CheckCircle2 size={15} className="mt-px shrink-0 text-positive" /> : <Circle size={15} className="mt-px shrink-0 text-[var(--text-faint)]" />}
                      <span className={ok ? 'text-[var(--text-muted)]' : ''}>{t.course.blockers[b]}</span>
                    </li>
                  );
                })}
              </ul>
              {data.blockers.length === 0 ? <p className="mt-3 rounded-lg bg-positive-soft px-3 py-2 text-[12.5px] text-positive">{t.course.ready}</p> : null}
              {role !== 'Admin' ? <p className="mt-3 flex gap-2 text-[12px] text-[var(--text-muted)]"><AlertTriangle size={14} className="shrink-0" />{t.course.publishAdminOnly}</p> : null}
            </Card>
          ) : null}
          <Card>
            <DataList items={[
              { label: t.course.version, value: `${v.number} (${t.course.versionStatus[v.status as keyof typeof t.course.versionStatus] ?? v.status})` },
              { label: t.course.lessons, value: formatNumber(lessons, locale) },
              { label: t.course.finalExam, value: v.quizEnabled ? `${formatNumber(v.questions.filter((q) => !q.lessonId).length, locale)} · ${t.quiz.passMark} ${v.passPercent}%` : t.common.none },
              { label: t.course.publishedOn, value: v.publishedAt ? formatDate(v.publishedAt, locale) : '…' },
            ]} />
            {published && published.id !== v.id ? <Link href={`?v=${published.id}`} className="mt-3 flex items-center gap-1.5 text-[12.5px] font-medium text-copper-700 hover:underline"><BookOpen size={13} />{t.course.openVersion} {published.number}</Link> : null}
          </Card>
        </aside>
      </div>

      {assign ? <AssignModal open={assigning} onClose={() => setAssigning(false)} versionId={published?.id ?? null} versionNumber={published?.number ?? 0} options={assign} /> : null}
    </>
  );
}
