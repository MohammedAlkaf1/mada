import QRCode from 'qrcode';
import { PRODUCT, appUrl, markSvg } from './brand';
import { formatDate } from './format';

/**
 * The certificate of completion as one A4 landscape page, Arabic first. It
 * states what it is, a record of completing internal training, and makes no
 * claim of accreditation (FR-14). The QR code and the printed address both
 * lead to the public verification page, which is the source of truth: a
 * printed copy of a revoked certificate still verifies as revoked.
 */

export type CertificateInput = {
  serial: string;
  verifyToken: string;
  learnerName: string;
  courseTitle: string;
  tenantName: string;
  issuedAt: Date;
  status: string;
  brandColor: string;
  logo: { mime: string; data: Buffer } | null;
};

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] ?? c);

export function verifyUrl(token: string) {
  return `${appUrl().replace(/\/$/, '')}/c/${token}`;
}

export async function certificateHtml(c: CertificateInput) {
  const url = verifyUrl(c.verifyToken);
  const qr = await QRCode.toDataURL(url, { margin: 0, width: 260, errorCorrectionLevel: 'M' });
  const color = /^#[0-9a-f]{6}$/i.test(c.brandColor) ? c.brandColor : '#0E6E6B';
  const logo = c.logo ? `<img class="logo" src="data:${c.logo.mime};base64,${c.logo.data.toString('base64')}" alt="">` : `<div class="initial">${esc(c.tenantName.trim().charAt(0))}</div>`;
  const revoked = c.status !== 'Valid';

  return `<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8">
<title>${esc(c.serial)}</title>
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
  @page { size: A4 landscape; margin: 0; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body { font-family: 'IBM Plex Sans Arabic', 'Noto Sans Arabic', Tahoma, sans-serif; color: #16323b; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .page { position: relative; width: 297mm; height: 210mm; padding: 14mm; background: #f9f8f4; overflow: hidden; }
  .frame { position: relative; height: 100%; border: 1.4pt solid ${color}; border-radius: 6mm; padding: 14mm 18mm; background: #fff; display: flex; flex-direction: column; }
  .band { position: absolute; inset-inline-start: 0; top: 0; bottom: 0; width: 7mm; background: ${color}; border-start-start-radius: 6mm; border-end-start-radius: 6mm; }
  header { display: flex; align-items: center; justify-content: space-between; }
  .issuer { display: flex; align-items: center; gap: 4mm; }
  .logo { width: 18mm; height: 18mm; object-fit: contain; }
  .initial { width: 16mm; height: 16mm; border-radius: 4mm; background: ${color}; color: #fff; font-size: 22pt; font-weight: 700; display: flex; align-items: center; justify-content: center; }
  .issuer-name { font-size: 15pt; font-weight: 600; }
  .kind { font-size: 10pt; color: #4d6770; letter-spacing: .02em; }
  main { flex: 1; display: flex; flex-direction: column; justify-content: center; text-align: center; }
  h1 { margin: 0; font-size: 30pt; font-weight: 700; color: ${color}; }
  .lead { margin: 6mm 0 2mm; font-size: 13pt; color: #4d6770; }
  .name { margin: 2mm 0; font-size: 28pt; font-weight: 700; }
  .course { margin: 3mm auto 0; max-width: 200mm; font-size: 17pt; font-weight: 600; line-height: 1.5; }
  .date { margin-top: 5mm; font-size: 12pt; color: #4d6770; }
  footer { display: flex; align-items: flex-end; justify-content: space-between; gap: 8mm; }
  .meta { font-size: 9.5pt; color: #4d6770; line-height: 1.7; }
  .meta strong { color: #16323b; font-weight: 600; }
  .qr { display: flex; align-items: center; gap: 4mm; }
  .qr img { width: 26mm; height: 26mm; }
  .qr p { margin: 0; font-size: 8.5pt; color: #4d6770; max-width: 55mm; direction: rtl; }
  .qr code { direction: ltr; unicode-bidi: embed; font-family: inherit; color: #16323b; word-break: break-all; }
  .product { display: flex; align-items: center; gap: 2mm; font-size: 8.5pt; color: #86979d; }
  .void { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; pointer-events: none; }
  .void span { transform: rotate(-18deg); border: 3pt solid #b3392f; color: #b3392f; font-size: 44pt; font-weight: 700; padding: 3mm 10mm; border-radius: 4mm; opacity: .85; background: rgba(255,255,255,.7); }
</style>
</head>
<body>
<div class="page">
  <div class="frame">
    <div class="band"></div>
    <header>
      <div class="issuer">${logo}<div><div class="issuer-name">${esc(c.tenantName)}</div><div class="kind">شهادة إتمام · Certificate of completion</div></div></div>
      <div class="product">${markSvg(18)} ${esc(PRODUCT.ar)}</div>
    </header>
    <main>
      <h1>شهادة إتمام</h1>
      <p class="lead">تشهد ${esc(c.tenantName)} بأن</p>
      <p class="name">${esc(c.learnerName)}</p>
      <p class="lead">أتم بنجاح متطلبات دورة</p>
      <p class="course">${esc(c.courseTitle)}</p>
      <p class="date">بتاريخ ${esc(formatDate(c.issuedAt, 'ar'))}</p>
    </main>
    <footer>
      <div class="meta">
        <div>رقم الشهادة <strong dir="ltr">${esc(c.serial)}</strong></div>
        <div>شهادة إتمام تدريب داخلي، ولا تمثل اعتمادًا أكاديميًا أو مهنيًا رسميًا.</div>
      </div>
      <div class="qr"><img src="${qr}" alt=""><p>للتحقق امسح الرمز أو زر<br><code>${esc(url)}</code></p></div>
    </footer>
    ${revoked ? '<div class="void"><span>ملغاة · REVOKED</span></div>' : ''}
  </div>
</div>
</body>
</html>`;
}
