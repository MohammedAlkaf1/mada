'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Award, CalendarClock, CheckCircle2, ChevronLeft, ChevronRight, Circle, ExternalLink, FileText, Film, Link2, ListChecks, Lock, PlayCircle, Type } from 'lucide-react';
import { useApp } from '@/components/app-provider';
import { Badge, Button, Card, Progress, StatusBadge, cx } from '@/components/ui';
import { formatDate, formatDateTime, formatNumber } from '@/lib/format';
import { isOverdue, progressPercent, VIDEO_THRESHOLD } from '@/lib/domain';
import type { LearnerCourse, LessonState } from '@/lib/types';

const kindIcon = { Text: Type, Pdf: FileText, Video: Film, Link: Link2 } as const;

/**
 * Reports what was actually played, in spans. A span starts when playback
 * starts and ends on pause, seek, end, or every fifteen seconds of play. The
 * server merges the spans, so seeking to the end adds nothing (FR-10).
 */
function VideoLesson({ enrollmentId, lesson, startAt, done, onProgress }: { enrollmentId: string; lesson: LessonState; startAt: number; done: boolean; onProgress: (watched: number, completed: boolean) => void }) {
  const { t, run } = useApp();
  const ref = useRef<HTMLVideoElement>(null);
  const span = useRef<{ from: number; wall: number } | null>(null);
  // The last position reached by playing, not by seeking. At the 'seeking' event currentTime is already the target.
  const last = useRef(0);
  const [failed, setFailed] = useState(false);

  const send = useCallback(async (from: number, to: number, wall: number) => {
    if (to - from < 0.5) return;
    const r = (await run('video.progress', { enrollmentId, lessonId: lesson.id, from, to, position: to, elapsed: (Date.now() - wall) / 1000 }, { silent: true, quietErrors: true })) as { watchedSeconds: number; completed: boolean } | null;
    if (r) onProgress(r.watchedSeconds, r.completed);
  }, [enrollmentId, lesson.id, onProgress, run]);

  /** Closes the open span at the last played position and, if still playing, opens the next one there. */
  const flush = useCallback(() => {
    const video = ref.current;
    const s = span.current;
    if (!video || !s) return;
    const to = last.current;
    span.current = video.paused || video.ended || video.seeking ? null : { from: to, wall: Date.now() };
    void send(s.from, to, s.wall);
  }, [send]);

  useEffect(() => {
    const timer = setInterval(() => {
      if (span.current && ref.current && !ref.current.paused && Date.now() - span.current.wall > 15000) flush();
    }, 3000);
    const onHide = () => flush();
    document.addEventListener('visibilitychange', onHide);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onHide);
      flush();
    };
  }, [flush]);

  if (failed) return <p className="rounded-xl bg-caution-soft px-4 py-3 text-[13px] text-caution">{t.learn.fileUnavailable}</p>;
  return (
    <div>
      <video
        ref={ref}
        className="aspect-video w-full rounded-xl bg-black"
        src={`/api/files?id=${lesson.assetId}`}
        controls
        controlsList="nodownload"
        preload="metadata"
        playsInline
        onError={() => setFailed(true)}
        onLoadedMetadata={(e) => { if (startAt > 1 && startAt < e.currentTarget.duration - 2) e.currentTarget.currentTime = startAt; }}
        onTimeUpdate={(e) => { if (!e.currentTarget.seeking) last.current = e.currentTarget.currentTime; }}
        onPlay={(e) => { last.current = e.currentTarget.currentTime; span.current = { from: last.current, wall: Date.now() }; }}
        onPause={() => flush()}
        onEnded={(e) => { last.current = e.currentTarget.currentTime; flush(); }}
        onSeeking={() => flush()}
        onSeeked={(e) => { last.current = e.currentTarget.currentTime; if (!e.currentTarget.paused) span.current = { from: last.current, wall: Date.now() }; }}
      />
      {!done ? <p className="mt-2.5 text-[12.5px] text-[var(--text-muted)]">{t.learn.watchHint}</p> : null}
    </div>
  );
}

export function CoursePlayer({ data, lessonId }: { data: LearnerCourse; lessonId?: string }) {
  const { t, locale, run, busy } = useApp();
  const router = useRouter();
  const e = data.enrollment;
  const v = data.version;
  const lessons = useMemo(() => data.modules.flatMap((m) => m.lessons), [data.modules]);
  const [progress, setProgress] = useState(data.progress);
  const firstOpen = lessons.find((l) => !progress[l.id]?.completedAt) ?? lessons[0];
  const current = lessons.find((l) => l.id === lessonId) ?? (lessonId === 'quiz' ? null : firstOpen);
  const index = current ? lessons.indexOf(current) : lessons.length;
  const base = `/${locale}/learn/${e.id}`;
  const readOnly = ['Withdrawn', 'Cancelled'].includes(e.status);
  const pct = progressPercent(e.requiredDone, e.requiredTotal);
  const used = data.attempts.filter((a) => a.submittedAt).length;
  const open = data.attempts.find((a) => !a.submittedAt);
  const quizUnlocked = e.requiredDone >= e.requiredTotal;

  useEffect(() => setProgress(data.progress), [data.progress]);
  useEffect(() => {
    if (current && !readOnly) void run('lesson.open', { enrollmentId: e.id, lessonId: current.id }, { silent: true, quietErrors: true });
  }, [current, e.id, readOnly, run]);

  const onVideo = useCallback((watched: number, completed: boolean) => {
    if (!current) return;
    setProgress((p) => ({ ...p, [current.id]: { position: p[current.id]?.position ?? 0, watchedSeconds: watched, completedAt: completed ? (p[current.id]?.completedAt ?? new Date().toISOString()) : null } }));
    if (completed && !progress[current.id]?.completedAt) router.refresh();
  }, [current, progress, router]);

  async function startQuiz() {
    const r = (await run('quiz.start', { enrollmentId: e.id }, { silent: true })) as { id: string } | null;
    if (r) router.push(`${base}/quiz/${r.id}`);
  }

  const assetOk = (l: LessonState) => !!l.assetId && data.assets[l.assetId]?.status === 'Clean';
  const done = current ? !!progress[current.id]?.completedAt : false;

  return (
    <div className="grid gap-5 lg:grid-cols-[18.5rem_1fr]">
      {/* Outline */}
      <aside className="order-2 lg:order-1">
        <Card padded={false} className="lg:sticky lg:top-20">
          <div className="border-b border-[var(--line-soft)] p-4">
            <Link href={`/${locale}`} className="text-[12px] text-[var(--text-muted)] hover:underline">{t.nav.learning}</Link>
            <h1 className="mt-1 text-[15px] font-semibold leading-snug">{v.title}</h1>
            <div className="mt-3 flex items-center gap-2.5"><Progress value={pct} tone={e.status === 'Completed' ? 'positive' : 'accent'} /><span className="text-[12px] tabular-nums text-[var(--text-muted)]">{pct}%</span></div>
            <p className="mt-2 flex items-center gap-1.5 text-[12px] text-[var(--text-faint)]"><ListChecks size={13} />{formatNumber(e.requiredDone, locale)} {t.learn.lessonsDone} {formatNumber(e.requiredTotal, locale)}</p>
            {e.dueAt ? <p className={cx('mt-1 flex items-center gap-1.5 text-[12px]', isOverdue(e) ? 'text-caution' : 'text-[var(--text-faint)]')}><CalendarClock size={13} />{t.learn.due} {formatDate(e.dueAt, locale)}</p> : null}
          </div>
          <nav className="max-h-[60vh] overflow-y-auto p-2" aria-label={t.learn.outline}>
            {data.modules.map((m) => (
              <div key={m.id} className="mb-2">
                <p className="px-2.5 pb-1 pt-2 text-[11.5px] font-semibold text-[var(--text-faint)]">{m.title}</p>
                <ul>
                  {m.lessons.map((l) => {
                    const Icon = kindIcon[l.kind];
                    const finished = !!progress[l.id]?.completedAt;
                    const active = current?.id === l.id;
                    return (
                      <li key={l.id}>
                        <Link href={`${base}?l=${l.id}`} aria-current={active ? 'page' : undefined} className={cx('flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] transition-colors', active ? 'bg-copper-100 font-medium text-copper-700' : 'hover:bg-[var(--surface-sunken)]')}>
                          {finished ? <CheckCircle2 size={15} className="shrink-0 text-positive" /> : <Circle size={15} className="shrink-0 text-[var(--text-faint)]" />}
                          <span className="min-w-0 flex-1 truncate">{l.title}</span>
                          <Icon size={13} className="shrink-0 text-[var(--text-faint)]" />
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
            {v.quizEnabled ? (
              <Link href={`${base}?l=quiz`} aria-current={!current ? 'page' : undefined} className={cx('mt-1 flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium', !current ? 'bg-copper-100 text-copper-700' : 'hover:bg-[var(--surface-sunken)]')}>
                {e.quizPassed ? <CheckCircle2 size={15} className="text-positive" /> : quizUnlocked ? <PlayCircle size={15} /> : <Lock size={15} className="text-[var(--text-faint)]" />}
                {t.learn.quiz}
              </Link>
            ) : null}
          </nav>
        </Card>
      </aside>

      {/* Lesson */}
      <section className="order-1 min-w-0 lg:order-2">
        {e.status === 'Completed' ? (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-positive/25 bg-positive-soft px-4 py-3">
            <div className="flex items-start gap-3 text-positive"><Award size={20} className="mt-0.5 shrink-0" /><div><p className="text-[14px] font-semibold">{t.learn.completedTitle}</p><p className="text-[12.5px]">{t.learn.completedBody}</p></div></div>
            {data.certificate ? <Link href={`/${locale}/my-certificates`}><Button size="sm" variant="secondary">{t.learn.viewCertificate}</Button></Link> : null}
          </div>
        ) : null}
        {readOnly ? <p className="mb-4 rounded-xl bg-caution-soft px-4 py-3 text-[13px] text-caution">{t.learn.withdrawn}</p> : null}

        {current ? (
          <Card>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[12px] text-[var(--text-faint)]">{t.course.lesson} {index + 1} {t.common.of} {lessons.length} · {t.course.kinds[current.kind]}</p>
                <h2 className="mt-1 text-xl font-semibold tracking-tight">{current.title}</h2>
              </div>
              <div className="flex items-center gap-2">
                {done ? <Badge tone="positive"><CheckCircle2 size={12} />{t.learn.done}</Badge> : <Badge tone={current.required ? 'accent' : 'neutral'}>{current.required ? t.learn.required : t.learn.optionalLesson}</Badge>}
              </div>
            </div>

            <div className="mt-5">
              {current.kind === 'Text' ? <div className="lesson-prose" dir="auto">{current.body}</div> : null}
              {current.kind === 'Pdf' ? (
                assetOk(current) ? (
                  <div>
                    <iframe title={current.title} src={`/api/files?id=${current.assetId}`} className="h-[70vh] w-full rounded-xl border border-[var(--line-soft)] bg-white" />
                    <a href={`/api/files?id=${current.assetId}`} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1.5 text-[13px] font-medium text-copper-700 hover:underline"><ExternalLink size={14} />{t.learn.pdfOpen}</a>
                  </div>
                ) : <p className="rounded-xl bg-caution-soft px-4 py-3 text-[13px] text-caution">{t.learn.fileUnavailable}</p>
              ) : null}
              {current.kind === 'Video' ? (
                assetOk(current) ? (
                  <>
                    <VideoLesson key={current.id} enrollmentId={e.id} lesson={current} startAt={progress[current.id]?.position ?? 0} done={done} onProgress={onVideo} />
                    {current.durationSeconds ? (
                      <div className="mt-3 flex items-center gap-2.5 text-[12px] text-[var(--text-muted)]">
                        <span className="shrink-0">{t.learn.watched}</span>
                        <Progress value={Math.min(100, ((progress[current.id]?.watchedSeconds ?? 0) / current.durationSeconds) * 100)} tone={done ? 'positive' : 'accent'} />
                        <span className="w-10 shrink-0 tabular-nums">{Math.min(100, Math.floor(((progress[current.id]?.watchedSeconds ?? 0) / current.durationSeconds) * 100))}%</span>
                        <span className="shrink-0 text-[var(--text-faint)]">/ {Math.round(VIDEO_THRESHOLD * 100)}%</span>
                      </div>
                    ) : null}
                  </>
                ) : <p className="rounded-xl bg-caution-soft px-4 py-3 text-[13px] text-caution">{t.learn.fileUnavailable}</p>
              ) : null}
              {current.kind === 'Link' && current.url ? (
                <div className="rounded-xl border border-dashed border-[var(--line-strong)] p-5">
                  {current.body ? <p className="lesson-prose mb-4" dir="auto">{current.body}</p> : null}
                  <a href={current.url} target="_blank" rel="noreferrer noopener"><Button variant="secondary" icon={<ExternalLink size={15} />}>{t.learn.openLink}</Button></a>
                  <p className="mt-2 text-[12px] text-[var(--text-faint)]">{t.learn.linkHint}</p>
                </div>
              ) : null}
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--line-soft)] pt-4">
              <div className="flex gap-2">
                {index > 0 ? <Link href={`${base}?l=${lessons[index - 1].id}`}><Button variant="ghost" size="sm" icon={locale === 'ar' ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}>{t.learn.previous}</Button></Link> : null}
                {index < lessons.length - 1 ? <Link href={`${base}?l=${lessons[index + 1].id}`}><Button variant="ghost" size="sm">{t.learn.next}{locale === 'ar' ? <ChevronLeft size={15} /> : <ChevronRight size={15} />}</Button></Link> : v.quizEnabled ? <Link href={`${base}?l=quiz`}><Button variant="ghost" size="sm">{t.learn.quiz}</Button></Link> : null}
              </div>
              {!readOnly && !done && current.kind !== 'Video' ? (
                <Button loading={busy} icon={<CheckCircle2 size={15} />} disabled={current.kind !== 'Text' && current.kind !== 'Link' && !assetOk(current)} onClick={async () => {
                  const r = await run('lesson.complete', { enrollmentId: e.id, lessonId: current.id }, { silent: true, refresh: true });
                  if (r) { setProgress((p) => ({ ...p, [current.id]: { ...(p[current.id] ?? { position: 0, watchedSeconds: 0 }), completedAt: new Date().toISOString() } })); if (index < lessons.length - 1) router.push(`${base}?l=${lessons[index + 1].id}`); }
                }}>{t.learn.markDone}</Button>
              ) : null}
            </div>
            <p className="mt-4 text-[11.5px] text-[var(--text-faint)]">{t.learn.semanticNote}</p>
          </Card>
        ) : (
          <Card>
            <h2 className="text-xl font-semibold tracking-tight">{t.learn.quiz}</h2>
            <p className="mt-2 text-[13.5px] text-[var(--text-muted)]">{t.learn.quizInfo.replace('{pass}', String(v.passPercent)).replace('{attempts}', String(v.maxAttempts))}</p>
            {v.timeLimitMinutes ? <p className="mt-1 text-[13.5px] text-[var(--text-muted)]">{t.learn.quizTimed.replace('{minutes}', String(v.timeLimitMinutes))}</p> : null}
            <div className="mt-4 flex flex-wrap gap-3 text-[13px]">
              <Badge>{t.learn.attemptsLeft}: {formatNumber(Math.max(0, v.maxAttempts - data.attempts.length + (open ? 1 : 0)), locale)}</Badge>
              {e.bestScore !== null ? <Badge tone={e.quizPassed ? 'positive' : 'caution'}>{t.learn.bestScore}: {formatNumber(e.bestScore, locale, 1)}%</Badge> : null}
            </div>
            {data.attempts.length ? (
              <ul className="mt-4 divide-y divide-[var(--line-soft)] rounded-xl border border-[var(--line-soft)]">
                {data.attempts.map((a) => (
                  <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-[13px]">
                    <span>{t.learn.attempt} {a.number} · <span className="text-[var(--text-faint)]">{formatDateTime(a.startedAt, locale)}</span></span>
                    {a.submittedAt ? (
                      <span className="flex items-center gap-2"><span className="tabular-nums">{formatNumber(a.score, locale, 1)}%</span><StatusBadge status={a.passed ? 'Completed' : 'Rejected'} label={a.passed ? t.learn.passed : t.learn.failed} /><Link href={`${base}/quiz/${a.id}`} className="text-copper-700 hover:underline">{t.common.details}</Link></span>
                    ) : <Link href={`${base}/quiz/${a.id}`} className="font-medium text-copper-700 hover:underline">{t.learn.resumeQuiz}</Link>}
                  </li>
                ))}
              </ul>
            ) : null}
            <div className="mt-5">
              {!quizUnlocked ? (
                <p className="flex items-center gap-2 text-[13px] text-[var(--text-muted)]"><Lock size={15} />{t.learn.quizLocked}</p>
              ) : e.quizPassed || readOnly ? null : open ? (
                <Link href={`${base}/quiz/${open.id}`}><Button variant="secondary">{t.learn.resumeQuiz}</Button></Link>
              ) : used < v.maxAttempts ? (
                <Button variant="secondary" loading={busy} icon={<PlayCircle size={16} />} onClick={startQuiz}>{t.learn.startQuiz}</Button>
              ) : <p className="text-[13px] text-caution">{t.errors.noAttempts}</p>}
            </div>
          </Card>
        )}
      </section>
    </div>
  );
}
