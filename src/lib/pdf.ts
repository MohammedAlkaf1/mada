import { chromium } from 'playwright-core';

/**
 * HTML to PDF through a real browser, because Arabic shaping and bidi are
 * not something a PDF library does well. In the container the browser is the
 * Alpine chromium package (CHROMIUM_PATH); on a developer machine the
 * installed Edge or Chrome is used through its channel name.
 */
export async function renderPdf(html: string, options: { landscape?: boolean; bleed?: boolean } = {}) {
  const executablePath = process.env.CHROMIUM_PATH || undefined;
  const channel = executablePath ? undefined : (process.env.CHROMIUM_CHANNEL ?? 'msedge');
  const browser = await chromium.launch({ headless: true, executablePath, channel, args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'] });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle', timeout: 20_000 }).catch(() => page.setContent(html, { waitUntil: 'load' }));
    await page.evaluate(() => document.fonts.ready).catch(() => {});
    // A bleed document (the certificate) draws its own margins and page size in CSS.
    const margin = options.bleed ? { top: '0', bottom: '0', left: '0', right: '0' } : { top: '14mm', bottom: '14mm', left: '14mm', right: '14mm' };
    const pdf = await page.pdf({ format: 'A4', printBackground: true, landscape: options.landscape ?? false, margin, preferCSSPageSize: options.bleed ?? false });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}
