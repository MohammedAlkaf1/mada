/**
 * Records the lesson videos of the example course. Each video is a sequence
 * of animated Arabic slides rendered in a headless browser and captured by
 * Playwright's own recorder as WebM, so no video tool is needed on the host.
 * Files are cached in data/demo-videos and only recorded once.
 *
 *   npx tsx scripts/demo-videos.ts          record whatever is missing
 *   npx tsx scripts/demo-videos.ts --force  record everything again
 */
import { existsSync, mkdirSync, readdirSync, renameSync, rmSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from '@playwright/test';

export type Slide = { kicker?: string; title: string; points?: string[]; seconds: number };
export type DemoVideo = { key: string; title: string; slides: Slide[] };

const DIR = resolve('data/demo-videos');
const W = 1280, H = 720;

function html(v: DemoVideo) {
  const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] ?? c);
  const slides = v.slides.map((s, i) => `<section data-i="${i}" data-s="${s.seconds}"><div class="k">${esc(s.kicker ?? v.title)}</div><h1>${esc(s.title)}</h1>${s.points?.length ? `<ul>${s.points.map((p, j) => `<li style="animation-delay:${0.8 + j * 1.4}s">${esc(p)}</li>`).join('')}</ul>` : ''}</section>`).join('');
  const total = v.slides.reduce((n, s) => n + s.seconds, 0);
  return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8">
<style>
*{box-sizing:border-box}html,body{margin:0;width:${W}px;height:${H}px;overflow:hidden;background:#0f2229;font-family:'Segoe UI','Tahoma','Arial',sans-serif;color:#ece8dc}
section{position:absolute;inset:0;padding:90px 110px;display:none;flex-direction:column;justify-content:center}
section.on{display:flex;animation:in .7s ease both}
.k{color:#19a095;font-size:26px;font-weight:600;margin-bottom:18px;letter-spacing:.01em}
h1{margin:0;font-size:60px;line-height:1.35;font-weight:700;max-width:1000px}
ul{margin:36px 0 0;padding:0;list-style:none}
li{position:relative;padding-inline-start:44px;margin:0 0 20px;font-size:33px;line-height:1.5;opacity:0;animation:item .6s ease both}
li:before{content:'';position:absolute;inset-inline-start:0;top:18px;width:18px;height:18px;border-radius:50%;background:#19a095}
.bar{position:absolute;bottom:0;inset-inline-start:0;height:8px;background:#19a095;width:0;animation:bar ${total}s linear forwards}
.brand{position:absolute;top:44px;inset-inline-end:110px;display:flex;align-items:center;gap:14px;font-size:22px;color:#b5c1c5}
.brand svg{width:40px;height:40px}
.arc{position:absolute;inset-inline-start:-120px;bottom:-260px;width:620px;height:620px;border-radius:50%;border:34px solid rgba(25,160,149,.14)}
@keyframes in{from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:none}}
@keyframes item{from{opacity:0;transform:translateX(-20px)}to{opacity:1;transform:none}}
@keyframes bar{to{width:100%}}
</style></head><body>
<div class="arc"></div>
<div class="brand"><svg viewBox="0 0 64 64"><rect width="64" height="64" rx="16" fill="#16323B"/><path d="M13 43.5C13 33 21.5 24.5 32 24.5S51 33 51 43.5" fill="none" stroke="#19A095" stroke-width="5.5" stroke-linecap="round"/><path d="M22.5 43.5C22.5 38.3 26.8 34 32 34S41.5 38.3 41.5 43.5" fill="none" stroke="#ECE8DC" stroke-width="5" stroke-linecap="round"/><circle cx="32" cy="43.5" r="3.4" fill="#19A095"/></svg>${esc(v.title)}</div>
${slides}<div class="bar"></div>
<script>
const list=[...document.querySelectorAll('section')];let i=0;
function show(){list.forEach((s,j)=>s.classList.toggle('on',j===i));if(i<list.length){setTimeout(()=>{i++;if(i<list.length)show();else document.title='done';},Number(list[i].dataset.s)*1000);}}
show();
</script></body></html>`;
}

/** Reads the real length of a recorded file in the browser, since the recorder decides the final frame count. */
async function durationOf(file: string) {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    // Opening the file itself gives the browser's own player, whose length is then read.
    await page.goto(pathToFileURL(file).href);
    // A string, not a function: tsx rewrites named functions in a way the page cannot run.
    return (await page.evaluate(`new Promise((done) => {
      const v = document.querySelector('video');
      if (!v) return done(0);
      const read = () => {
        if (Number.isFinite(v.duration) && v.duration > 0) return done(v.duration);
        v.currentTime = 1e6;
        v.ontimeupdate = () => { v.ontimeupdate = null; done(v.duration); };
      };
      if (v.readyState >= 1) read(); else v.onloadedmetadata = read;
      setTimeout(() => done(0), 15000);
    })`)) as number;
  } finally {
    await browser.close();
  }
}

export async function recordVideos(videos: DemoVideo[], force = false) {
  mkdirSync(DIR, { recursive: true });
  const out: Record<string, { file: string; seconds: number; size: number }> = {};
  for (const v of videos) {
    const file = join(DIR, `${v.key}.webm`);
    if (force || !existsSync(file)) {
      const tmp = join(DIR, `tmp-${v.key}`);
      rmSync(tmp, { recursive: true, force: true });
      const browser = await chromium.launch({ headless: true });
      const context = await browser.newContext({ viewport: { width: W, height: H }, recordVideo: { dir: tmp, size: { width: W, height: H } } });
      const page = await context.newPage();
      await page.setContent(html(v));
      await page.waitForFunction(() => document.title === 'done', undefined, { timeout: 10 * 60_000, polling: 500 });
      await page.waitForTimeout(600);
      await context.close();
      await browser.close();
      const recorded = readdirSync(tmp).find((f) => f.endsWith('.webm'));
      if (!recorded) throw new Error(`no recording for ${v.key}`);
      renameSync(join(tmp, recorded), file);
      rmSync(tmp, { recursive: true, force: true });
      console.log(`recorded ${v.key}`);
    }
    out[v.key] = { file, seconds: Math.round(await durationOf(file)), size: statSync(file).size };
  }
  return out;
}

if (process.argv[1] && /demo-videos\.ts$/.test(process.argv[1])) {
  const sample: DemoVideo = { key: 'sample', title: 'تجربة', slides: [{ title: 'شريحة أولى', points: ['نقطة', 'نقطة ثانية'], seconds: 4 }, { title: 'شريحة ثانية', seconds: 3 }] };
  const r = await recordVideos([sample], process.argv.includes('--force'));
  console.log(r);
}
