/**
 * Pure rules of the learning domain. No database and no server imports, so
 * the same functions decide on the server and explain the decision in the UI.
 * Every numbered rule refers to the SRS (FR, BR).
 */

export const roles=['Admin','Instructor','Learner'] as const;
export type Role=typeof roles[number];
export const staffRoles:Role[]=['Admin','Instructor'];

export const lessonKinds=['Text','Pdf','Video','Link'] as const;
export type LessonKind=typeof lessonKinds[number];
export const questionKinds=['Single','TrueFalse'] as const;

export class DomainError extends Error {constructor(public code:string,public status=400){super(code);}}

/** CSV cell that a spreadsheet will never evaluate as a formula (FR-16). */
export function csvCell(value:unknown){let s=String(value??'');if(/^[\s]*[=+\-@\t\r]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"';}

export function ratio(numerator:number,denominator:number){return denominator>0?numerator/denominator*100:null;}

/* ───────────── Video watching (FR-10) ─────────────
   Progress is the union of the seconds actually played. Seeking to the end
   adds nothing, and replaying the same minute twice counts it once. */

export type Interval=[number,number];

export function mergeIntervals(list:Interval[]):Interval[]{
 const clean=list.filter(([a,b])=>Number.isFinite(a)&&Number.isFinite(b)&&b>a).map(([a,b])=>[Math.max(0,a),b] as Interval).sort((x,y)=>x[0]-y[0]);
 const out:Interval[]=[];
 for(const [a,b] of clean){const last=out[out.length-1];if(last&&a<=last[1]+0.5)last[1]=Math.max(last[1],b);else out.push([a,b]);}
 return out;
}

export function watchedSeconds(list:Interval[],duration?:number){
 return mergeIntervals(list).reduce((s,[a,b])=>s+(duration?Math.min(b,duration)-Math.min(a,duration):b-a),0);
}

/** A client reports a played span; anything longer than wall clock allows is refused. */
export function plausibleSpan([a,b]:Interval,elapsedSeconds:number){
 return Number.isFinite(a)&&Number.isFinite(b)&&a>=0&&b>a&&b-a<=elapsedSeconds*2.5+5&&b-a<=900;
}

export const VIDEO_THRESHOLD=0.9;
export function videoComplete(list:Interval[],duration:number){
 return duration>0&&watchedSeconds(list,duration)>=duration*VIDEO_THRESHOLD;
}

/* ───────────── Progress and completion (BR-03, FR-13) ───────────── */

/** Required lessons done over required lessons. The quiz is a separate gate, not part of the ratio. */
export function progressPercent(done:number,total:number){
 if(total<=0)return 0;
 return Math.floor(Math.min(done,total)/total*100);
}

export type CompletionInput={requiredDone:number;requiredTotal:number;quizEnabled:boolean;quizPassed:boolean};
export function isComplete(x:CompletionInput){
 return x.requiredTotal>0&&x.requiredDone>=x.requiredTotal&&(!x.quizEnabled||x.quizPassed);
}

export function enrollmentStatus(x:CompletionInput&{started:boolean;withdrawn?:boolean}){
 if(x.withdrawn)return 'Withdrawn';
 if(isComplete(x))return 'Completed';
 return x.started?'InProgress':'NotStarted';
}

/** Overdue is a flag in the report, never a state that closes the course (FR-09, BR-04). */
export function isOverdue(e:{dueAt:string|Date|null;status:string},now=new Date()){
 return !!e.dueAt&&new Date(e.dueAt).getTime()<now.getTime()&&!['Completed','Withdrawn','Cancelled'].includes(e.status);
}

/* ───────────── Quiz (FR-11, FR-12, FR-13) ───────────── */

export type Choice={id:string;text:string};
export type GradableQuestion={id:string;points:number;correct:string;choices:Choice[]};

/**
 * Earned points over total points. Unanswered or unknown answers score zero.
 * Reaching the pass mark exactly is a pass; the percentage is compared
 * before any rounding so display rounding can never flip the verdict.
 */
export function gradeAttempt(questions:GradableQuestion[],answers:Record<string,unknown>,passPercent:number){
 const total=questions.reduce((s,q)=>s+q.points,0);
 const earned=questions.reduce((s,q)=>s+(answers[q.id]===q.correct?q.points:0),0);
 const score=total>0?earned/total*100:0;
 return {earned,total,score,passed:total>0&&earned*100>=passPercent*total};
}

export function trueFalseChoices(ar=true):Choice[]{return [{id:'true',text:ar?'صح':'True'},{id:'false',text:ar?'خطأ':'False'}];}

/** Deadline of an attempt from its start. The server clock decides, never the browser (FR-12). */
export function attemptDeadline(startedAt:Date,timeLimitMinutes:number|null|undefined){
 return timeLimitMinutes&&timeLimitMinutes>0?new Date(startedAt.getTime()+timeLimitMinutes*60000):null;
}

/* ───────────── Publishing (FR-06, FR-11) ─────────────
   The editor shows this list as a checklist and course.publish enforces the
   same list, so the screen never promises what the server will refuse. */

export type PublishBlocker='title'|'requiredLesson'|'lessonContent'|'quizEmpty'|'quizInvalid'|'quizRules';
export type PublishInput={
 title:string;
 lessons:{kind:string;required:boolean;body:string;url:string|null;assetId:string|null;assetClean?:boolean}[];
 quizEnabled:boolean;passPercent:number;maxAttempts:number;
 questions:{prompt:string;points:number;correct:string;choices:Choice[]}[];
};

export function lessonReady(l:PublishInput['lessons'][number]){
 if(l.kind==='Text')return l.body.trim().length>0;
 if(l.kind==='Link')return !!l.url&&/^https:\/\//.test(l.url);
 return !!l.assetId&&l.assetClean!==false;
}

export function publishBlockers(x:PublishInput):PublishBlocker[]{
 const out:PublishBlocker[]=[];
 if(!x.title.trim())out.push('title');
 if(!x.lessons.some(l=>l.required&&lessonReady(l)))out.push('requiredLesson');
 if(x.lessons.some(l=>!lessonReady(l)))out.push('lessonContent');
 if(x.quizEnabled){
  if(!x.questions.length)out.push('quizEmpty');
  else if(x.questions.some(q=>!q.prompt.trim()||q.points<=0||q.choices.length<2||!q.choices.some(c=>c.id===q.correct)||q.choices.some(c=>!c.text.trim())))out.push('quizInvalid');
  if(x.passPercent<1||x.passPercent>100||x.maxAttempts<1)out.push('quizRules');
 }
 return out;
}

/** A version that anyone is enrolled in keeps its lessons and rules (FR-08). */
export function versionLocked(enrollments:number){return enrollments>0;}

/* ───────────── Certificates (FR-14) ───────────── */

const SERIAL_ALPHABET='23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
export function certificateSerial(year:number,random:Uint8Array){
 let s='';for(let i=0;i<8;i++)s+=SERIAL_ALPHABET[random[i]%SERIAL_ALPHABET.length];
 return `${year}-${s.slice(0,4)}-${s.slice(4)}`;
}

/** The verification page shows a short form of the name only: first name and the initial of the last. */
export function shortName(full:string){
 const parts=full.trim().split(/\s+/).filter(Boolean);
 if(parts.length<=1)return parts[0]??'';
 return `${parts[0]} ${parts[parts.length-1][0]}.`;
}

/* ───────────── People import (FR-03) ───────────── */

export type ImportRow={row:number;name:string;email:string;group:string;role:string};
export type ImportVerdict={row:number;name:string;email:string;group:string;role:Role|'';status:'create'|'update'|'skip'|'error';reason?:string};

const ROLE_ALIASES:Record<string,Role>={admin:'Admin',مسؤول:'Admin','مسؤول الجهة':'Admin',instructor:'Instructor',trainer:'Instructor',مدرب:'Instructor',learner:'Learner',trainee:'Learner',student:'Learner',متدرب:'Learner',طالب:'Learner'};
export function parseRole(raw:string):Role|null{const k=raw.trim().toLowerCase();if(!k)return 'Learner';return ROLE_ALIASES[k]??(roles as readonly string[]).find(r=>r.toLowerCase()===k) as Role??null;}

/**
 * Decides every row before anything is written, so the preview and the apply
 * step agree. A second import of the same file only yields skips.
 */
export function planImport(rows:ImportRow[],existing:Map<string,{role:string;groups:string[]}>):ImportVerdict[]{
 const seen=new Set<string>();
 return rows.map(r=>{
  const email=r.email.trim().toLowerCase(),name=r.name.trim(),group=r.group.trim();
  const base={row:r.row,name,email,group,role:'' as Role|''};
  if(!name||name.length>120)return {...base,status:'error',reason:'name'};
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)||email.length>254)return {...base,status:'error',reason:'email'};
  const role=parseRole(r.role);if(!role)return {...base,status:'error',reason:'role'};
  if(group.length>80)return {...base,role,status:'error',reason:'group'};
  if(seen.has(email))return {...base,role,status:'error',reason:'duplicate'};
  seen.add(email);
  const prior=existing.get(email);
  if(!prior)return {...base,role,status:'create'};
  if(group&&!prior.groups.includes(group))return {...base,role:prior.role as Role,status:'update'};
  return {...base,role:prior.role as Role,status:'skip'};
 });
}

/* ───────────── Retention (BR-07) ───────────── */
export const EXPORT_WINDOW_DAYS=30;
