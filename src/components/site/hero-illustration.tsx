import {Check,Clock,FileText,PlayCircle,Link2,AlignLeft,ListChecks,CircleDot} from 'lucide-react';
import {BrandIcon} from '@/components/shell/brand-mark';
import type {SiteCopy} from '@/i18n/site';

/**
 * The picture under the hero, drawn in plain markup rather than an image so it
 * follows the language, the direction and the copy file.
 *
 * It sits on the dark hero band in both appearances, so it uses the fixed
 * palette steps (ivory, navy 900/600/400, copper 600/500/200) and none of the
 * steps the dark theme redefines.
 */

const LESSON_ICONS=[AlignLeft,FileText,PlayCircle,Link2,ListChecks];

/** A fixed pattern that reads as a QR code without pretending to be one. */
const QR=[
 '1111111010111',
 '1000001001001',
 '1011101011101',
 '1011101000101',
 '1011101010111',
 '1000001011001',
 '1111111010101',
 '0000000011000',
 '1101011100111',
 '0110100101010',
 '1011011010011',
 '0100110001101',
 '1110101011011',
];

function Tag({children}:{children:React.ReactNode}){
 return <span className="inline-flex rounded-full bg-copper-600/10 px-2.5 py-1 text-[11px] font-semibold text-copper-600">{children}</span>;
}

export function HeroIllustration({copy}:{copy:SiteCopy['hero']['illustration']}){
 const {course,quiz,certificate}=copy;
 const done=3;
 return (
  <figure className="relative mx-auto max-w-6xl px-5 sm:px-8">
   <figcaption className="sr-only">{copy.label}</figcaption>
   <div aria-hidden className="grid gap-4 text-navy-900 md:grid-cols-2 lg:grid-cols-[1.05fr_1fr_0.95fr] lg:items-start">

    {/* The course as a learner sees it */}
    <div className="rounded-[18px] bg-ivory-100 p-5 shadow-[0_24px_60px_-28px_rgba(0,0,0,0.6)]">
     <div className="flex items-center justify-between gap-3">
      <Tag>{course.tag}</Tag>
      <span className="flex items-center gap-1.5 text-[11.5px] text-navy-600">
       <Clock size={13} className="shrink-0"/>
       {course.due}
      </span>
     </div>
     <p className="mt-3 text-[15.5px] font-semibold leading-snug">{course.title}</p>
     <div className="mt-4 flex items-center justify-between text-[12px]">
      <span className="text-navy-600">{course.progress}</span>
      <span className="font-semibold tabular-nums">{course.progressValue}</span>
     </div>
     <div className="mt-2 h-2 overflow-hidden rounded-full bg-ivory-500">
      <div className="h-full rounded-full bg-copper-600" style={{width:`${(done/course.lessons.length)*100}%`}}/>
     </div>
     <ul className="mt-4 space-y-1.5">
      {course.lessons.map((lesson,index)=>{
       const Icon=LESSON_ICONS[index]??AlignLeft;
       const state=index<done?'done':index===done?'current':'next';
       return (
        <li key={lesson.title}
         className={`flex items-center gap-3 rounded-[10px] px-2.5 py-2 text-[12.5px] ${state==='current'?'bg-white ring-1 ring-copper-200':''}`}>
         <span className={`flex size-6 shrink-0 items-center justify-center rounded-full ${state==='done'?'bg-copper-600 text-white':state==='current'?'bg-copper-200 text-navy-900':'bg-ivory-500 text-navy-400'}`}>
          {state==='done'?<Check size={13} strokeWidth={2.5}/>:<Icon size={13}/>}
         </span>
         <span className={`min-w-0 flex-1 truncate ${state==='next'?'text-navy-400':''}`}>{lesson.title}</span>
         <span className="shrink-0 text-[11px] text-navy-400">{lesson.kind}</span>
        </li>
       );
      })}
     </ul>
    </div>

    {/* A question from the final quiz */}
    <div className="rounded-[18px] bg-ivory-100 p-5 shadow-[0_24px_60px_-28px_rgba(0,0,0,0.6)] lg:mt-10">
     <div className="flex items-center justify-between gap-3">
      <Tag>{quiz.tag}</Tag>
      <span className="flex items-center gap-1.5 rounded-full bg-navy-900 px-2.5 py-1 text-[11px] font-semibold tabular-nums text-ivory-100">
       <Clock size={12} className="shrink-0"/>
       {quiz.timer}
      </span>
     </div>
     <p className="mt-3 text-[11.5px] text-navy-600">{quiz.counter}</p>
     <p className="mt-1.5 text-[14.5px] font-semibold leading-relaxed">{quiz.question}</p>
     <ul className="mt-4 space-y-2">
      {quiz.options.map((option,index)=>{
       const chosen=index===1;
       return (
        <li key={option}
         className={`flex items-center gap-3 rounded-[11px] border px-3 py-2.5 text-[12.5px] ${chosen?'border-copper-600 bg-white font-semibold':'border-ivory-500'}`}>
         <span className={`flex size-4 shrink-0 items-center justify-center rounded-full border ${chosen?'border-copper-600 text-copper-600':'border-navy-400'}`}>
          {chosen?<CircleDot size={14}/>:null}
         </span>
         {option}
        </li>
       );
      })}
     </ul>
     <p className="mt-3 flex items-center gap-1.5 text-[11.5px] text-copper-600">
      <Check size={13} className="shrink-0"/>
      {quiz.saved}
     </p>
    </div>

    {/* The certificate it leads to */}
    <div className="rounded-[18px] bg-ivory-100 p-2.5 shadow-[0_24px_60px_-28px_rgba(0,0,0,0.6)] md:col-span-2 lg:col-span-1 lg:mt-4">
     <div className="rounded-[13px] border border-copper-200 bg-white p-5">
      <div className="flex items-center justify-between gap-3">
       <span className="flex items-center gap-2 text-[11.5px] font-semibold text-navy-600">
        <BrandIcon size={26} variant="copper" className="shrink-0 rounded-[7px]"/>
        {certificate.org}
       </span>
       <Tag>{certificate.tag}</Tag>
      </div>
      <p className="mt-5 text-center text-[12px] text-navy-600">{certificate.title}</p>
      <p className="mt-1.5 text-center text-[18px] font-semibold">{certificate.name}</p>
      <p className="mt-1 text-center text-[12.5px] text-navy-600">{certificate.course}</p>
      <div className="mx-auto mt-4 h-px w-16 bg-copper-500"/>
      <div className="mt-5 flex items-end justify-between gap-4">
       <div className="min-w-0 text-[11px] leading-relaxed">
        <p className="text-navy-400">{certificate.number}</p>
        <p dir="ltr" className="font-semibold tabular-nums tracking-wider text-start">{certificate.numberValue}</p>
        <p className="mt-1.5 text-copper-600">{certificate.verify}</p>
       </div>
       <div className="grid shrink-0 grid-cols-[repeat(13,5px)] gap-0 rounded-[6px] bg-white p-1.5 ring-1 ring-ivory-500">
        {QR.join('').split('').map((cell,index)=>(
         <span key={index} className={`size-[5px] ${cell==='1'?'bg-navy-900':''}`}/>
        ))}
       </div>
      </div>
     </div>
    </div>
   </div>
  </figure>
 );
}
