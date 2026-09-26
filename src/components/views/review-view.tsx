'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CheckCircle2, ClipboardCheck, XCircle } from 'lucide-react';
import { useApp } from '@/components/app-provider';
import { Badge, Button, Card, EmptyState, Field, Input, PageHeader, Table, Td, Textarea, Th, Tr } from '@/components/ui';
import { formatDateTime, formatNumber } from '@/lib/format';
import { answerCorrect } from '@/lib/domain';
import type { ReviewDetail, ReviewRow } from '@/lib/types';

export function ReviewQueue({ rows }: { rows: ReviewRow[] }) {
  const { t, locale } = useApp();
  return (
    <>
      <PageHeader title={t.review.title} subtitle={t.review.subtitle} />
      <Card padded={false}>
        {rows.length === 0 ? (
          <EmptyState title={t.review.empty} hint={t.review.emptyHint} icon={<ClipboardCheck size={19} />} />
        ) : (
          <Table>
            <thead><tr><Th>{t.report.learner}</Th><Th>{t.report.course}</Th><Th>{t.review.quiz}</Th><Th>{t.review.submitted}</Th><Th /></tr></thead>
            <tbody>
              {rows.map((r) => (
                <Tr key={r.id}>
                  <Td><span className="block font-medium">{r.learner}</span><span className="block text-[11.5px] text-[var(--text-faint)]" dir="ltr">{r.email}</span></Td>
                  <Td>{r.courseTitle}</Td>
                  <Td>{r.quizTitle || t.course.finalExam}<Badge tone="caution" className="ms-2">{formatNumber(r.written, locale)} {t.course.questionKinds.Text}</Badge></Td>
                  <Td className="text-[12.5px] tabular-nums">{formatDateTime(r.submittedAt, locale)}</Td>
                  <Td className="text-end"><Link href={`/${locale}/review/${r.id}`}><Button size="sm" variant="secondary">{t.review.grade}</Button></Link></Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </>
  );
}

export function ReviewForm({ detail }: { detail: ReviewDetail }) {
  const { t, locale, run, busy, toast } = useApp();
  const router = useRouter();
  const written = detail.questions.filter((q) => q.kind === 'Text');
  const [points, setPoints] = useState<Record<string, string>>(() => Object.fromEntries(written.map((q) => [q.id, ''])));
  const [comment, setComment] = useState('');
  const complete = written.every((q) => points[q.id] !== '' && Number(points[q.id]) >= 0 && Number(points[q.id]) <= q.points);
  const choiceText = (q: ReviewDetail['questions'][number], id: string) => (q.kind === 'TrueFalse' ? (id === 'true' ? t.quiz.true : t.quiz.false) : q.choices.find((c) => c.id === id)?.text ?? id);

  async function approve() {
    const r = await run('attempt.review', { attemptId: detail.id, points: Object.fromEntries(written.map((q) => [q.id, Number(points[q.id])])), comment }, { silent: true });
    if (r) {
      toast('success', t.review.done);
      router.push(`/${locale}/review`);
      router.refresh();
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-2 text-[13px]"><Link href={`/${locale}/review`} className="text-[var(--text-muted)] hover:underline">{t.review.title}</Link></div>
      <PageHeader title={detail.learner} subtitle={`${detail.courseTitle} · ${detail.quizTitle || t.course.finalExam} · ${t.review.submitted} ${formatDateTime(detail.submittedAt, locale)}`} />
      <Card className="mb-4 flex flex-wrap items-center gap-3 text-[13px]">
        <Badge tone="info">{t.review.autoPart}: {formatNumber(detail.earned, locale)} {t.review.outOf} {formatNumber(detail.total, locale)}</Badge>
        <Badge>{t.quiz.passMark} {detail.passPercent}%</Badge>
      </Card>
      <ol className="space-y-4">
        {detail.questions.map((q, i) => (
          <li key={q.id}>
            <Card>
              <div className="flex items-start justify-between gap-3">
                <p className="text-[14.5px] font-medium leading-relaxed"><span className="text-[var(--text-faint)]">{i + 1}. </span>{q.prompt}</p>
                <Badge className="shrink-0">{formatNumber(q.points, locale)} {t.quiz.points}</Badge>
              </div>
              {q.kind === 'Text' ? (
                <div className="mt-3 space-y-3">
                  <div className="rounded-xl border border-[var(--line-strong)] bg-[var(--surface-sunken)] px-3.5 py-3">
                    <p className="mb-1 text-[11.5px] font-medium text-[var(--text-faint)]">{t.review.answer}</p>
                    <p className="whitespace-pre-wrap text-[14px] leading-relaxed" dir="auto">{typeof q.answer === 'string' && q.answer.trim() ? q.answer : <span className="text-[var(--text-faint)]">{t.review.noAnswer}</span>}</p>
                  </div>
                  {q.guide ? <p className="rounded-lg bg-info-soft px-3 py-2 text-[12.5px] text-info"><span className="font-medium">{t.course.guide}: </span>{q.guide}</p> : null}
                  <Field label={`${t.quiz.pointsGiven} (${t.review.outOf} ${q.points})`} required>
                    <Input type="number" min={0} max={q.points} step={0.5} dir="ltr" className="max-w-32" value={points[q.id]} onChange={(e) => setPoints({ ...points, [q.id]: e.target.value })} />
                  </Field>
                </div>
              ) : (
                <p className="mt-2 flex items-center gap-2 text-[13px]">
                  {answerCorrect({ id: q.id, kind: q.kind, points: q.points, correct: q.correct, choices: q.choices }, q.answer) ? <CheckCircle2 size={15} className="text-positive" /> : <XCircle size={15} className="text-critical" />}
                  <span className="text-[var(--text-muted)]">{t.review.answer}:</span>
                  <span>{q.answer === null ? t.review.noAnswer : (Array.isArray(q.answer) ? q.answer : [q.answer]).map((id) => choiceText(q, id)).join('، ')}</span>
                  <Badge tone="info" className="ms-auto">{t.course.autoGraded}</Badge>
                </p>
              )}
            </Card>
          </li>
        ))}
      </ol>
      <Card className="mt-4">
        <Field label={t.review.comment} hint={t.common.optional}><Textarea rows={3} value={comment} maxLength={2000} onChange={(e) => setComment(e.target.value)} /></Field>
        <div className="mt-4 flex justify-end"><Button loading={busy} disabled={!complete} icon={<CheckCircle2 size={15} />} onClick={approve}>{t.review.approve}</Button></div>
      </Card>
    </div>
  );
}
