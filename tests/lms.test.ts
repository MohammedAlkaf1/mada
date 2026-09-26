import { describe, expect, it } from 'vitest';
import {
  attemptDeadline, certificateSerial, csvCell, enrollmentStatus, gradeAttempt, isComplete, isOverdue, mergeIntervals,
  parseRole, planImport, plausibleSpan, progressPercent, publishBlockers, shortName, videoComplete, watchedSeconds,
} from '../src/lib/domain';
import { zip } from '../src/lib/zip';
import { parseRange } from '../src/lib/storage';
import { inflateRawSync } from 'node:zlib';

describe('video watching (FR-10)', () => {
  it('merges overlapping and touching spans', () => {
    expect(mergeIntervals([[10, 20], [0, 5], [18, 30], [30.2, 40]])).toEqual([[0, 5], [10, 40]]);
  });
  it('counts a replayed minute once', () => {
    expect(watchedSeconds([[0, 60], [0, 60], [30, 60]])).toBe(60);
  });
  it('does not count seeking to the end as watching', () => {
    // Watched the first ten seconds, then jumped to the last five.
    expect(videoComplete([[0, 10], [95, 100]], 100)).toBe(false);
  });
  it('completes at 90 percent of unique time', () => {
    expect(videoComplete([[0, 45], [45, 90]], 100)).toBe(true);
    expect(videoComplete([[0, 89]], 100)).toBe(false);
  });
  it('refuses a span longer than the time that passed', () => {
    expect(plausibleSpan([0, 15], 15)).toBe(true);
    expect(plausibleSpan([0, 600], 10)).toBe(false);
    expect(plausibleSpan([20, 10], 30)).toBe(false);
  });
  it('clips watched time to the video length', () => {
    expect(watchedSeconds([[0, 130]], 120)).toBe(120);
  });
});

describe('progress and completion (BR-03, FR-13)', () => {
  it('computes progress from required lessons only', () => {
    expect(progressPercent(2, 3)).toBe(66);
    expect(progressPercent(0, 0)).toBe(0);
    expect(progressPercent(5, 3)).toBe(100);
  });
  it('needs every required lesson and a passed quiz', () => {
    expect(isComplete({ requiredDone: 3, requiredTotal: 3, quizEnabled: true, quizPassed: false })).toBe(false);
    expect(isComplete({ requiredDone: 3, requiredTotal: 3, quizEnabled: true, quizPassed: true })).toBe(true);
    expect(isComplete({ requiredDone: 2, requiredTotal: 3, quizEnabled: false, quizPassed: false })).toBe(false);
    expect(isComplete({ requiredDone: 0, requiredTotal: 0, quizEnabled: false, quizPassed: false })).toBe(false);
  });
  it('derives the three learner states', () => {
    const base = { requiredDone: 0, requiredTotal: 2, quizEnabled: false, quizPassed: false };
    expect(enrollmentStatus({ ...base, started: false })).toBe('NotStarted');
    expect(enrollmentStatus({ ...base, started: true })).toBe('InProgress');
    expect(enrollmentStatus({ ...base, requiredDone: 2, started: true })).toBe('Completed');
    expect(enrollmentStatus({ ...base, requiredDone: 2, started: true, withdrawn: true })).toBe('Withdrawn');
  });
  it('flags lateness without closing the course (FR-09)', () => {
    const now = new Date('2026-09-26T12:00:00Z');
    expect(isOverdue({ dueAt: '2026-09-25T12:00:00Z', status: 'InProgress' }, now)).toBe(true);
    expect(isOverdue({ dueAt: '2026-09-25T12:00:00Z', status: 'Completed' }, now)).toBe(false);
    expect(isOverdue({ dueAt: null, status: 'InProgress' }, now)).toBe(false);
  });
});

describe('quiz grading (FR-11, FR-12, FR-13)', () => {
  const qs = [
    { id: 'q1', points: 2, correct: 'a', choices: [{ id: 'a', text: 'A' }, { id: 'b', text: 'B' }] },
    { id: 'q2', points: 1, correct: 'true', choices: [{ id: 'true', text: 'T' }, { id: 'false', text: 'F' }] },
    { id: 'q3', points: 1, correct: 'b', choices: [{ id: 'a', text: 'A' }, { id: 'b', text: 'B' }] },
  ];
  it('weighs questions by their points', () => {
    expect(gradeAttempt(qs, { q1: 'a', q2: 'false', q3: 'a' }, 50)).toMatchObject({ earned: 2, total: 4, score: 50, passed: true });
  });
  it('treats unanswered questions as wrong', () => {
    expect(gradeAttempt(qs, {}, 50)).toMatchObject({ earned: 0, passed: false });
  });
  it('passes exactly at the mark, with no rounding deciding the verdict', () => {
    const three = [1, 2, 3].map((n) => ({ id: `q${n}`, points: 1, correct: 'a', choices: [{ id: 'a', text: 'A' }] }));
    // 2 of 3 is 66.66 percent: fails a 67 mark and passes a 66 mark.
    expect(gradeAttempt(three, { q1: 'a', q2: 'a' }, 67).passed).toBe(false);
    expect(gradeAttempt(three, { q1: 'a', q2: 'a' }, 66).passed).toBe(true);
    expect(gradeAttempt(qs, { q1: 'a', q2: 'true', q3: 'a' }, 75).passed).toBe(true);
  });
  it('sets the deadline from the server start time', () => {
    const start = new Date('2026-01-01T10:00:00Z');
    expect(attemptDeadline(start, 15)?.toISOString()).toBe('2026-01-01T10:15:00.000Z');
    expect(attemptDeadline(start, null)).toBeNull();
  });
});

describe('publishing (FR-06, FR-11)', () => {
  const lesson = { kind: 'Text', required: true, body: 'x', url: null, assetId: null };
  const quiz = { quizEnabled: false, passPercent: 70, maxAttempts: 3, questions: [] };
  it('needs a title and a required lesson with content', () => {
    expect(publishBlockers({ title: '', lessons: [], ...quiz })).toEqual(['title', 'requiredLesson']);
    expect(publishBlockers({ title: 'A', lessons: [{ ...lesson, required: false }], ...quiz })).toEqual(['requiredLesson']);
    expect(publishBlockers({ title: 'A', lessons: [lesson], ...quiz })).toEqual([]);
  });
  it('rejects a link that is not https and a file still being scanned', () => {
    expect(publishBlockers({ title: 'A', lessons: [lesson, { ...lesson, kind: 'Link', url: 'http://x' }], ...quiz })).toContain('lessonContent');
    expect(publishBlockers({ title: 'A', lessons: [lesson, { ...lesson, kind: 'Pdf', assetId: 'f', assetClean: false }], ...quiz })).toContain('lessonContent');
  });
  it('rejects an empty quiz or a question without a valid key', () => {
    expect(publishBlockers({ title: 'A', lessons: [lesson], ...quiz, quizEnabled: true })).toContain('quizEmpty');
    const bad = { prompt: 'Q', points: 1, correct: 'z', choices: [{ id: 'a', text: 'A' }, { id: 'b', text: 'B' }] };
    expect(publishBlockers({ title: 'A', lessons: [lesson], ...quiz, quizEnabled: true, questions: [bad] })).toContain('quizInvalid');
    expect(publishBlockers({ title: 'A', lessons: [lesson], ...quiz, quizEnabled: true, questions: [{ ...bad, correct: 'a' }] })).toEqual([]);
  });
});

describe('people import (FR-03, BR-02)', () => {
  const rows = [
    { row: 2, name: 'سارة', email: 'Sara@Example.com ', group: 'المبيعات', role: 'متدرب' },
    { row: 3, name: 'فهد', email: 'sara@example.com', group: '', role: '' },
    { row: 4, name: 'لمى', email: 'not-an-email', group: '', role: '' },
    { row: 5, name: 'ريم', email: 'reem@example.com', group: '', role: 'مدير عام' },
    { row: 6, name: 'تركي', email: 'turki@example.com', group: 'المستودع', role: 'trainer' },
  ];
  it('decides every row before writing anything', () => {
    const plan = planImport(rows, new Map([['turki@example.com', { role: 'Learner', groups: [] }]]));
    expect(plan.map((p) => p.status)).toEqual(['create', 'error', 'error', 'error', 'update']);
    expect(plan[0]).toMatchObject({ email: 'sara@example.com', role: 'Learner' });
    expect(plan[1].reason).toBe('duplicate');
    expect(plan[3].reason).toBe('role');
  });
  it('turns a second import of the same file into skips', () => {
    const existing = new Map([['sara@example.com', { role: 'Learner', groups: ['المبيعات'] }]]);
    expect(planImport([rows[0]], existing)[0].status).toBe('skip');
  });
  it('reads roles in either language', () => {
    expect(parseRole('مدرب')).toBe('Instructor');
    expect(parseRole('Admin')).toBe('Admin');
    expect(parseRole('')).toBe('Learner');
    expect(parseRole('owner')).toBeNull();
  });
});

describe('certificates (FR-14)', () => {
  it('builds a readable serial without ambiguous characters', () => {
    const s = certificateSerial(2026, new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7]));
    expect(s).toMatch(/^2026-[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}$/);
  });
  it('shows a short form of the name on the public page', () => {
    expect(shortName('نورة عبدالله القحطاني')).toBe('نورة ا.');
    expect(shortName('Sara Alharbi')).toBe('Sara A.');
    expect(shortName('Sara')).toBe('Sara');
  });
});

describe('exports', () => {
  it('neutralises spreadsheet formulas (FR-16)', () => {
    expect(csvCell('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`);
    expect(csvCell('سارة')).toBe('"سارة"');
  });
  it('writes a zip whose entries inflate back to the input', () => {
    const data = Buffer.from('name,email\r\nسارة,s@x.com', 'utf8');
    const file = zip([{ name: 'members.csv', data }]);
    expect(file.readUInt32LE(0)).toBe(0x04034b50);
    const nameLength = file.readUInt16LE(26), packed = file.readUInt32LE(18);
    expect(file.subarray(30, 30 + nameLength).toString()).toBe('members.csv');
    expect(inflateRawSync(file.subarray(30 + nameLength, 30 + nameLength + packed)).equals(data)).toBe(true);
    expect(file.readUInt32LE(file.length - 22)).toBe(0x06054b50);
  });
});

describe('video byte ranges', () => {
  it('parses open, closed and suffix ranges', () => {
    expect(parseRange('bytes=0-99', 1000)).toEqual({ start: 0, end: 99 });
    expect(parseRange('bytes=900-', 1000)).toEqual({ start: 900, end: 999 });
    expect(parseRange('bytes=-100', 1000)).toEqual({ start: 900, end: 999 });
    expect(parseRange('bytes=2000-', 1000)).toBe('invalid');
    expect(parseRange(null, 1000)).toBeNull();
  });
});
