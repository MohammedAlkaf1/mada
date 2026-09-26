import {db} from './db';
import type {Actor} from './access';
import {csvCell,isOverdue,progressPercent} from './domain';
import {zip} from './zip';

export const exportTypes=['enrollments','members','certificates','package'] as const;
export type ExportType=typeof exportTypes[number];
/** CSV links live an hour; the full package lives the 24 hours FR-19 allows. */
export const EXPORT_TTL_MS:Record<ExportType,number>={enrollments:3600000,members:3600000,certificates:3600000,package:24*3600000};

const iso=(d:Date|null|undefined)=>d?d.toISOString().slice(0,16).replace('T',' '):'';
/** UTF-8 with a byte order mark, so Excel opens Arabic correctly (FR-16). */
export const csv=(rows:unknown[][])=>Buffer.from('﻿'+rows.map(r=>r.map(csvCell).join(',')).join('\r\n'),'utf8');

const STATUS_AR:Record<string,string>={NotStarted:'لم يبدأ',InProgress:'قيد التعلم',Completed:'مكتمل',Withdrawn:'منسحب',Cancelled:'ملغى'};

async function enrollmentRows(a:Actor,f:{courseId?:string;groupId?:string}){
 const list=await db.enrollment.findMany({where:{tenantId:a.tenantId,status:{not:'Cancelled'},...(f.courseId?{courseId:f.courseId}:{}),...(f.groupId?{membership:{groups:{some:{groupId:f.groupId}}}}:{}),...(a.role==='Instructor'?{courseVersion:{course:{instructorIds:{has:a.userId}}}}:{})},include:{membership:{include:{user:{select:{name:true,email:true}}}},courseVersion:{select:{title:true,number:true,quizEnabled:true}},certificate:{select:{serial:true,status:true}}},orderBy:{createdAt:'asc'}});
 return [
  ['الاسم','البريد','الدورة','النسخة','تاريخ الإسناد','موعد الاستحقاق','الحالة','متأخر','نسبة التقدم','أفضل نتيجة','تاريخ الإكمال','رقم الشهادة','حالة الشهادة'],
  ...list.map(e=>[e.membership.user.name,e.membership.user.email,e.courseVersion.title,e.courseVersion.number,iso(e.createdAt),iso(e.dueAt),STATUS_AR[e.status]??e.status,isOverdue(e)?'نعم':'لا',progressPercent(e.requiredDone,e.requiredTotal),e.bestScore===null?'':Math.round(e.bestScore*10)/10,iso(e.completedAt),e.certificate?.serial??'',e.certificate?(e.certificate.status==='Valid'?'سارية':'ملغاة'):'']),
 ];
}

async function memberRows(a:Actor){
 const list=await db.membership.findMany({where:{tenantId:a.tenantId,supportGrant:false},include:{user:{select:{name:true,email:true,verified:true}},groups:{include:{group:{select:{name:true}}}}},orderBy:{createdAt:'asc'}});
 const ROLE:Record<string,string>={Admin:'مسؤول',Instructor:'مدرب',Learner:'متدرب'};
 return [['الاسم','البريد','الدور','المسمى','المجموعات','الحالة','تفعيل الحساب','تاريخ الإضافة'],...list.map(m=>[m.user.name,m.user.email,ROLE[m.role]??m.role,m.title,m.groups.map(g=>g.group.name).join('، '),m.active?'فعال':'معطل',m.user.verified?'مفعل':'بانتظار التفعيل',iso(m.createdAt)])];
}

async function certificateRows(a:Actor,f:{courseId?:string}){
 const list=await db.certificate.findMany({where:{tenantId:a.tenantId,...(f.courseId?{enrollment:{courseId:f.courseId}}:{}),...(a.role==='Instructor'?{enrollment:{courseVersion:{course:{instructorIds:{has:a.userId}}}}}:{})},include:{enrollment:{include:{membership:{include:{user:{select:{email:true}}}}}}},orderBy:{issuedAt:'asc'}});
 return [['الرقم','المتدرب','البريد','الدورة','النتيجة','تاريخ الإصدار','الحالة','سبب الإلغاء'],...list.map(c=>[c.serial,c.learnerName,c.enrollment.membership.user.email,c.courseTitle,c.score===null?'':Math.round(c.score*10)/10,iso(c.issuedAt),c.status==='Valid'?'سارية':'ملغاة',c.revokeReason??''])];
}

/** Every course version as the organization wrote it: outline, text lessons, questions with their keys, and file names. */
async function contentJson(a:Actor){
 const courses=await db.course.findMany({where:{tenantId:a.tenantId},include:{versions:{orderBy:{number:'asc'},include:{modules:{orderBy:{position:'asc'},include:{lessons:{orderBy:{position:'asc'}}}},questions:{orderBy:{position:'asc'}}}}}});
 const assets=await db.asset.findMany({where:{tenantId:a.tenantId},select:{id:true,name:true,mime:true,size:true,status:true}});
 return Buffer.from(JSON.stringify({exportedAt:new Date().toISOString(),courses:courses.map(c=>({title:c.title,category:c.category,archived:!!c.archivedAt,versions:c.versions.map(v=>({number:v.number,status:v.status,title:v.title,description:v.description,quiz:v.quizEnabled?{passPercent:v.passPercent,maxAttempts:v.maxAttempts,timeLimitMinutes:v.timeLimitMinutes,questions:v.questions.filter(q=>!q.lessonId).map(q=>({kind:q.kind,prompt:q.prompt,choices:q.choices,correct:q.correct,guide:q.guide,points:q.points}))}:null,modules:v.modules.map(m=>({title:m.title,lessons:m.lessons.map(l=>({title:l.title,kind:l.kind,required:l.required,body:l.body,url:l.url,file:l.assetId?assets.find(x=>x.id===l.assetId)?.name??null:null,...(l.kind==='Quiz'?{quiz:{graded:l.graded,passPercent:l.passPercent,maxAttempts:l.maxAttempts,timeLimitMinutes:l.timeLimitMinutes,questions:v.questions.filter(q=>q.lessonId===l.id).map(q=>({kind:q.kind,prompt:q.prompt,choices:q.choices,correct:q.correct,guide:q.guide,points:q.points}))}}:{})}))}))}))})),files:assets},null,2),'utf8');
}

export async function buildExport(a:Actor,type:ExportType,f:{courseId?:string;groupId?:string}){
 if(type==='enrollments'){const rows=await enrollmentRows(a,f);return {rows:rows.length-1,bytes:csv(rows),mime:'text/csv'};}
 if(type==='members'){const rows=await memberRows(a);return {rows:rows.length-1,bytes:csv(rows),mime:'text/csv'};}
 if(type==='certificates'){const rows=await certificateRows(a,f);return {rows:rows.length-1,bytes:csv(rows),mime:'text/csv'};}
 const [enr,mem,cer,content]=await Promise.all([enrollmentRows(a,{}),memberRows(a),certificateRows(a,{}),contentJson(a)]);
 const attempts=await db.quizAttempt.findMany({where:{tenantId:a.tenantId,submittedAt:{not:null}},include:{enrollment:{include:{membership:{include:{user:{select:{email:true}}}},courseVersion:{select:{title:true,number:true}}}}},orderBy:{submittedAt:'asc'}});
 const att=[['البريد','الدورة','النسخة','رقم المحاولة','البدء','التسليم','الدرجة','من','النسبة','ناجح'],...attempts.map(x=>[x.enrollment.membership.user.email,x.enrollment.courseVersion.title,x.enrollment.courseVersion.number,x.number,iso(x.startedAt),iso(x.submittedAt),x.earned,x.total,x.score===null?'':Math.round(x.score*10)/10,x.passed?'نعم':'لا'])];
 const bytes=zip([{name:'members.csv',data:csv(mem)},{name:'enrollments.csv',data:csv(enr)},{name:'quiz-attempts.csv',data:csv(att)},{name:'certificates.csv',data:csv(cer)},{name:'content.json',data:content}]);
 return {rows:enr.length+mem.length+cer.length+att.length-4,bytes,mime:'application/zip'};
}
