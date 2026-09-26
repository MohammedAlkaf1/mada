import {
 Building2,Lock,BadgeCheck,Languages,ShieldCheck,UserCog,PenTool,GraduationCap,
} from 'lucide-react';
import {Section,SectionHead,Eyebrow,CtaLink,Card,Faq,Point} from '@/components/site/sections';
import {HeroIllustration} from '@/components/site/hero-illustration';
import {Arrow as DirectionArrow} from '@/components/site/site-chrome';
import {getSiteCopy} from '@/i18n/site';
import {isLocale,type Locale} from '@/i18n/dictionary';

const TRUST_ICONS=[Building2,Lock,BadgeCheck,Languages];
const ROLE_ICONS=[UserCog,PenTool,GraduationCap];

export default async function WelcomePage({params}:{params:Promise<{locale:string}>}){
 const {locale:raw}=await params;
 const locale:Locale=isLocale(raw)?raw:'ar';
 const t=getSiteCopy(locale);

 return (
  <>
   {/* ── Hero: the message, then a drawing of the product beneath it ── */}
   <section className="site-hero relative overflow-hidden">
    <div
     aria-hidden
     className="absolute inset-x-0 top-0 h-[32rem]"
     style={{backgroundImage:'radial-gradient(ellipse 60% 70% at 50% -20%, rgba(25,160,149,0.22), transparent 65%)'}}
    />
    <div className="relative mx-auto max-w-3xl px-5 pt-16 text-center sm:px-8 sm:pt-20 lg:pt-24">
     <div className="animate-rise">
      <Eyebrow tone="light">{t.hero.eyebrow}</Eyebrow>
      <h1 className="mt-4 text-[2.1rem] leading-[1.2] tracking-tight text-ivory-500 sm:text-[3rem]">{t.hero.title}</h1>
      <p className="mx-auto mt-6 max-w-2xl text-[16px] leading-relaxed text-navy-300 sm:text-[16.5px]">{t.hero.body}</p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
       <CtaLink href={`/${locale}/register`}>
        {t.hero.primary}
        <DirectionArrow locale={locale}/>
       </CtaLink>
       <CtaLink href={`/${locale}/contact`} variant="ghost">{t.hero.secondary}</CtaLink>
      </div>
      <p className="mx-auto mt-4 max-w-xl text-[13px] leading-relaxed text-navy-400">{t.hero.note}</p>
     </div>
    </div>
    <div className="relative mt-12 pb-14 sm:mt-14 sm:pb-16">
     <HeroIllustration copy={t.hero.illustration}/>
    </div>
   </section>

   {/* ── Trust strip ────────────────────────────────────────── */}
   <div className="border-b border-[var(--line-soft)] bg-[var(--surface-sunken)]">
    <ul className="mx-auto grid max-w-6xl gap-6 px-5 py-10 sm:grid-cols-2 sm:px-8 lg:grid-cols-4">
     {t.trust.map((item,index)=>{
      const Icon=TRUST_ICONS[index]??ShieldCheck;
      return (
       <li key={item.title} className="flex gap-3">
        <Icon size={18} className="mt-0.5 shrink-0 text-copper-600" aria-hidden/>
        <span>
         <span className="block text-[14.5px] font-semibold">{item.title}</span>
         <span className="mt-1 block text-[13px] leading-relaxed text-[var(--text-muted)]">{item.body}</span>
        </span>
       </li>
      );
     })}
    </ul>
   </div>

   {/* ── How it works: the journey as a numbered timeline ──── */}
   <Section id="how">
    <SectionHead eyebrow={t.journey.eyebrow} title={t.journey.title} body={t.journey.body} align="center"/>
    <ol className="relative mt-14 grid gap-10 lg:grid-cols-5 lg:gap-6">
     <span aria-hidden className="absolute top-5 hidden h-px bg-[var(--line-strong)] lg:block lg:inset-x-[10%]"/>
     {t.journey.steps.map((step,index)=>(
      <li key={step.title} className="relative flex gap-4 lg:block lg:text-center">
       <span aria-hidden className="relative z-10 flex size-10 shrink-0 items-center justify-center rounded-full bg-copper-600 text-[14px] font-bold text-white shadow-[var(--shadow-subtle)] lg:mx-auto">
        {index+1}
       </span>
       <div className="lg:mt-5">
        <h3 className="text-[15.5px] font-semibold">{step.title}</h3>
        <p className="mt-2 text-[13.5px] leading-relaxed text-[var(--text-muted)]">{step.body}</p>
       </div>
      </li>
     ))}
    </ol>
   </Section>

   {/* ── Features, grouped by the role that uses them ───────── */}
   <Section id="product" tone="sunken">
    <SectionHead eyebrow={t.features.eyebrow} title={t.features.title} body={t.features.body} align="center"/>
    <div className="mt-12 grid gap-5 lg:grid-cols-3">
     {t.features.groups.map((group,index)=>{
      const Icon=ROLE_ICONS[index]??UserCog;
      return (
       <Card key={group.role}>
        <div className="flex items-center gap-3">
         <span className="flex size-10 shrink-0 items-center justify-center rounded-[11px] bg-copper-100 text-copper-700" aria-hidden>
          <Icon size={19}/>
         </span>
         <h3 className="text-[17px] font-semibold">{group.role}</h3>
        </div>
        <p className="mt-3 text-[13.5px] leading-relaxed text-[var(--text-muted)]">{group.summary}</p>
        <ul className="mt-5 space-y-4 border-t border-[var(--line-soft)] pt-5">
         {group.items.map(item=>(
          <Point key={item.title} title={item.title} body={item.body}/>
         ))}
        </ul>
       </Card>
      );
     })}
    </div>
   </Section>

   {/* ── Certificates ───────────────────────────────────────── */}
   <Section id="certificates" tone="inverse">
    <div className="grid gap-12 lg:grid-cols-[1fr_1fr] lg:gap-16">
     <div>
      <SectionHead eyebrow={t.certificates.eyebrow} title={t.certificates.title} body={t.certificates.body} tone="light"/>
      <p className="mt-6 max-w-xl border-s-2 border-copper-500 ps-4 text-[14.5px] leading-relaxed text-ivory-500/90">
       {t.certificates.note}
      </p>
     </div>
     <ul className="space-y-7">
      {t.certificates.points.map(point=>(
       <Point key={point.title} title={point.title} body={point.body} tone="light"/>
      ))}
     </ul>
    </div>
   </Section>

   {/* ── Security ───────────────────────────────────────────── */}
   <Section id="security">
    <SectionHead eyebrow={t.security.eyebrow} title={t.security.title} body={t.security.body}/>
    <div className="mt-12 grid gap-x-10 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
     {t.security.items.map(item=>(
      <div key={item.title}>
       <h3 className="flex items-center gap-2 text-[15.5px] font-semibold">
        <ShieldCheck size={17} className="shrink-0 text-copper-600" aria-hidden/>
        {item.title}
       </h3>
       <p className="mt-2 text-[13.5px] leading-relaxed text-[var(--text-muted)]">{item.body}</p>
      </div>
     ))}
    </div>
   </Section>

   {/* ── Who it is for ──────────────────────────────────────── */}
   <Section tone="sunken">
    <div className="surface grid gap-8 p-6 sm:p-10 lg:grid-cols-[0.85fr_1.15fr] lg:gap-12">
     <div>
      <h2 className="text-[1.5rem] leading-tight tracking-tight">{t.audience.title}</h2>
      <p className="mt-3 text-[14.5px] leading-relaxed text-[var(--text-muted)]">{t.audience.body}</p>
     </div>
     <ul className="grid gap-6 sm:grid-cols-3">
      {t.audience.items.map(item=>(
       <li key={item.title}>
        <h3 className="text-[14.5px] font-semibold">{item.title}</h3>
        <p className="mt-2 text-[13px] leading-relaxed text-[var(--text-muted)]">{item.body}</p>
       </li>
      ))}
     </ul>
    </div>
   </Section>

   {/* ── Pricing teaser ─────────────────────────────────────── */}
   <Section>
    <div className="surface flex flex-col items-start gap-6 p-6 sm:p-10 lg:flex-row lg:items-center lg:justify-between">
     <div className="max-w-xl">
      <Eyebrow>{t.pricing.eyebrow}</Eyebrow>
      <h2 className="mt-3 text-[1.7rem] leading-tight tracking-tight">{t.pricing.title}</h2>
      <p className="mt-3 text-[15px] leading-relaxed text-[var(--text-muted)]">{t.pricing.body}</p>
     </div>
     <div className="flex shrink-0 flex-wrap gap-3">
      <CtaLink href={`/${locale}/pricing`}>
       {t.nav.pricing}
       <DirectionArrow locale={locale}/>
      </CtaLink>
      <CtaLink href={`/${locale}/contact`} variant="secondary">{t.nav.contact}</CtaLink>
     </div>
    </div>
   </Section>

   {/* ── Questions ──────────────────────────────────────────── */}
   <Section tone="sunken">
    <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
     <SectionHead title={t.faq.title}/>
     <Faq items={t.faq.items}/>
    </div>
   </Section>

   {/* ── Closing call ───────────────────────────────────────── */}
   <Section>
    <div className="relative overflow-hidden rounded-[1.5rem] bg-navy-900 px-6 py-14 text-center sm:px-12 sm:py-16">
     <div
      aria-hidden
      className="absolute inset-0 opacity-[0.55]"
      style={{backgroundImage:'radial-gradient(circle at 80% 10%, rgba(25,160,149,0.32), transparent 48%), radial-gradient(circle at 10% 90%, rgba(42,77,88,0.9), transparent 52%)'}}
     />
     <div className="relative mx-auto max-w-2xl">
      <h2 className="text-[1.8rem] leading-tight tracking-tight text-ivory-500 sm:text-[2.3rem]">{t.cta.title}</h2>
      <p className="mt-4 text-[15.5px] leading-relaxed text-navy-300">{t.cta.body}</p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
       <CtaLink href={`/${locale}/register`}>
        {t.cta.primary}
        <DirectionArrow locale={locale}/>
       </CtaLink>
       <CtaLink href={`/${locale}/contact`} variant="ghost">{t.cta.secondary}</CtaLink>
      </div>
     </div>
    </div>
   </Section>
  </>
 );
}
