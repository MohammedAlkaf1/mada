'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CheckCircle2, Clock, CloudOff, Loader2, XCircle } from 'lucide-react';
import { useApp } from '@/components/app-provider';
import { Badge, Button, Card, PageHeader, cx } from '@/components/ui';
import { formatNumber } from '@/lib/format';
import type { AttemptState } from '@/lib/types';

function clock(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600), m = Math.floor((total % 3600) / 60), s = total % 60;
  return `${h ? `${h}:` : ''}${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function QuizView({ attempt }: { attempt: AttemptState }) {
  const { t, locale, run, busy } = useApp();
  const router = useRouter();
  const [answers, setAnswers] = useState<Record<string, string>>(attempt.answers);
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'offline'>('idle');
  const pending = useRef<Record<string, string>>({});
  const submitted = !!attempt.submittedAt;
  // The browser clock may be wrong; only the gap between server time and deadline matters.
  const skew = useRef(new Date(attempt.serverNow).getTime() - Date.now());
  const deadline = attempt.deadlineAt ? new Date(attempt.deadlineAt).getTime() : null;
  const [left, setLeft] = useState(() => (deadline ? deadline - (Date.now() + skew.current) : null));
  const finishing = useRef(false);
  const back = `/${locale}/learn/${attempt.enrollmentId}?l=quiz`;

  const save = useCallback(async () => {
    const batch = pending.current;
    if (!Object.keys(batch).length) return true;
    pending.current = {};
    setState('saving');
    const r = await run('quiz.save', { attemptId: attempt.id, answers: batch }, { silent: true, quietErrors: true });
    if (!r) {
      // Kept for the next try; the timer on the server keeps running regardless.
      pending.current = { ...batch, ...pending.current };
      setState(navigator.onLine ? 'idle' : 'offline');
      return false;
    }
    setState('saved');
    return true;
  }, [attempt.id, run]);

  const submit = useCallback(async () => {
    if (finishing.current) return;
    finishing.current = true;
    await save();
    await run('quiz.submit', { attemptId: attempt.id }, { silent: true, refresh: true });
    router.refresh();
  }, [attempt.id, router, run, save]);

  useEffect(() => {
    if (submitted || !deadline) return;
    const timer = setInterval(() => {
      const remaining = deadline - (Date.now() + skew.current);
      setLeft(remaining);
      if (remaining <= 0) {
        clearInterval(timer);
        void submit();
      }
    }, 500);
    return () => clearInterval(timer);
  }, [deadline, submit, submitted]);

  useEffect(() => {
    if (submitted) return;
    const retry = setInterval(() => { if (Object.keys(pending.current).length) void save(); }, 4000);
    const online = () => void save();
    window.addEventListener('online', online);
    const offline = () => setState('offline');
    window.addEventListener('offline', offline);
    return () => { clearInterval(retry); window.removeEventListener('online', online); window.removeEventListener('offline', offline); };
  }, [save, submitted]);

  function choose(questionId: string, choiceId: string) {
    if (submitted) return;
    setAnswers((a) => ({ ...a, [questionId]: choiceId }));
    pending.current = { ...pending.current, [questionId]: choiceId };
    void save();
  }

  const unanswered = attempt.questions.filter((q) => !answers[q.id]).length;
  const choicesOf = (q: AttemptState['questions'][number]) => (q.kind === 'TrueFalse' ? [{ id: 'true', text: t.quiz.true }, { id: 'false', text: t.quiz.false }] : q.choices);

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-2 text-[13px]"><Link href={back} className="text-[var(--text-muted)] hover:underline">{attempt.courseTitle}</Link></div>
      <PageHeader title={`${t.quiz.title} · ${t.learn.attempt} ${attempt.number}`} subtitle={`${t.quiz.passMark} ${attempt.passPercent}%`} />

      {submitted ? (
        <Card className={cx('mb-5 border', attempt.passed ? 'border-positive/30' : 'border-caution/30')}>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              {attempt.passed ? <CheckCircle2 size={28} className="text-positive" /> : <XCircle size={28} className="text-caution" />}
              <div>
                <p className="text-[16px] font-semibold">{attempt.passed ? t.quiz.youPassed : t.quiz.youFailed}</p>
                <p className="text-[13px] text-[var(--text-muted)]">{t.quiz.scoreOf.replace('{earned}', formatNumber(attempt.earned, locale)).replace('{total}', formatNumber(attempt.total, locale))}</p>
              </div>
            </div>
            <span className="text-3xl font-semibold tabular-nums">{formatNumber(attempt.score, locale, 1)}%</span>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link href={back}><Button variant="ghost">{t.quiz.backToCourse}</Button></Link>
          </div>
          {!attempt.questions.some((q) => q.correct) ? <p className="mt-3 text-[12.5px] text-[var(--text-faint)]">{t.quiz.keyHidden}</p> : null}
        </Card>
      ) : (
        <div className="sticky top-16 z-30 mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--line-soft)] bg-[var(--surface-card)]/95 px-4 py-2.5 shadow-[var(--shadow-subtle)] backdrop-blur">
          <span className="flex items-center gap-2 text-[13px] text-[var(--text-muted)]">
            {state === 'saving' ? <><Loader2 size={14} className="animate-spin" />{t.quiz.saving}</> : state === 'offline' ? <><CloudOff size={14} className="text-caution" /><span className="text-caution">{t.quiz.offline}</span></> : state === 'saved' ? <><CheckCircle2 size={14} className="text-positive" />{t.quiz.saved}</> : `${formatNumber(unanswered, locale)} ${t.quiz.unanswered}`}
          </span>
          {left !== null ? (
            <span className={cx('flex items-center gap-1.5 text-[15px] font-semibold tabular-nums', left < 60000 ? 'text-critical' : '')} role="timer" aria-live="off">
              <Clock size={16} />{t.quiz.timeLeft} {clock(left)}
            </span>
          ) : null}
        </div>
      )}

      <ol className="space-y-4">
        {attempt.questions.map((q, i) => (
          <li key={q.id}>
            <Card>
              <fieldset>
                <legend className="w-full">
                  <span className="flex items-start justify-between gap-3">
                    <span className="text-[14.5px] font-medium leading-relaxed"><span className="text-[var(--text-faint)]">{i + 1}. </span>{q.prompt}</span>
                    <Badge className="shrink-0">{formatNumber(q.points, locale)} {t.quiz.points}</Badge>
                  </span>
                </legend>
                <div className="mt-3 grid gap-2">
                  {choicesOf(q).map((c) => {
                    const selected = answers[q.id] === c.id;
                    const isKey = q.correct === c.id;
                    return (
                      <label key={c.id} className={cx('flex cursor-pointer items-center gap-3 rounded-xl border px-3.5 py-2.5 text-[13.5px] transition-colors',
                        submitted && q.correct ? (isKey ? 'border-positive bg-positive-soft' : selected ? 'border-critical bg-critical-soft' : 'border-[var(--line-soft)]') : selected ? 'border-copper-600 bg-copper-100' : 'border-[var(--line-strong)] hover:bg-[var(--surface-sunken)]',
                        submitted && 'cursor-default')}>
                        <input type="radio" name={q.id} checked={selected} disabled={submitted} onChange={() => choose(q.id, c.id)} className="size-4 accent-[var(--color-copper-600)]" />
                        <span className="flex-1">{c.text}</span>
                        {submitted && q.correct && isKey ? <span className="text-[11.5px] font-medium text-positive">{t.quiz.correct}</span> : null}
                        {submitted && q.correct && selected && !isKey ? <span className="text-[11.5px] font-medium text-critical">{t.quiz.yourAnswer}</span> : null}
                      </label>
                    );
                  })}
                </div>
              </fieldset>
            </Card>
          </li>
        ))}
      </ol>

      {!submitted ? (
        <div className="mt-6 flex justify-end">
          <Button size="md" loading={busy} onClick={() => { if (confirm(t.quiz.submitConfirm)) void submit(); }}>{t.quiz.submit}</Button>
        </div>
      ) : null}
    </div>
  );
}
