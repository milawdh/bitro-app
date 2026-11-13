import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { chromium } from '@playwright/test';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(appRoot, 'brand-assets');
await fs.mkdir(output, { recursive: true });
const logoSource = await fs.readFile(path.join(appRoot, 'src/components/logo.tsx'), 'utf8');
const favicon = await fs.readFile(path.join(appRoot, 'src/app/icon.svg'), 'utf8');
const globals = await fs.readFile(path.join(appRoot, 'src/app/globals.css'), 'utf8');
const font = await fs.readFile(path.join(appRoot, 'node_modules/@fontsource/jetbrains-mono/files/jetbrains-mono-latin-700-normal.woff2'));
const persianFont = await fs.readFile(path.join(appRoot, 'node_modules/@fontsource/vazirmatn/files/vazirmatn-arabic-400-normal.woff2'));
const svg = logoSource.match(/<svg[\s\S]*?<\/svg>/)?.[0]
  .replaceAll('strokeWidth=', 'stroke-width=')
  .replaceAll('strokeLinecap=', 'stroke-linecap=')
  .replaceAll('strokeLinejoin=', 'stroke-linejoin=');
if (!svg) throw new Error('The current SVG logo was not found.');
const selectors = ['.brand', '.brand-mark', '.brand-mark svg', '.brand-word', '.brand-word>span', '.brand-word>i'];
const brandCSS = selectors.map(selector => {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const result = globals.match(new RegExp(`${escaped}\\{[^}]+\\}`));
  if (!result) throw new Error(`Missing source selector: ${selector}`);
  return result[0];
}).join('\n');
const fonts = `@font-face{font-family:'JetBrains Mono';src:url(data:font/woff2;base64,${font.toString('base64')}) format('woff2');font-weight:700;font-display:block}@font-face{font-family:Vazirmatn;src:url(data:font/woff2;base64,${persianFont.toString('base64')}) format('woff2');font-display:block}`;
const brand = `<span class="brand"><span class="brand-mark">${svg}</span><span class="brand-word" dir="ltr">bitro<span>learn</span><i></i></span></span>`;
const base = `${fonts}*{box-sizing:border-box}html,body{margin:0;width:100%;height:100%;background:transparent}body{--primary:#9780ff;color:#f0f0f7}${brandCSS}.canvas{position:relative;width:100%;height:100%;overflow:hidden}.canvas>.brand{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%) scale(var(--scale));transform-origin:center}.brand-mark{box-shadow:none}.brand-word{white-space:nowrap}`;
const browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome' });
const page = await browser.newPage({ deviceScaleFactor: 1 });
const manifest = [];
async function render(name, width, height, content, css = '') {
  await page.setViewportSize({ width, height });
  await page.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>${base}${css}</style></head><body>${content}</body></html>`);
  await page.evaluate(() => document.fonts.ready);
  const buffer = await page.screenshot({ path: path.join(output, name), omitBackground: true });
  manifest.push({ file: name, width, height, bytes: buffer.length, sha256: createHash('sha256').update(buffer).digest('hex') });
}
try {
  for (const size of [256, 512, 1024, 2048]) {
    await render(`bitrolearn-mark-${size}.png`, size, size, `<div class="brand-mark">${svg}</div>`, `.brand-mark{width:${size}px;height:${size}px;border-radius:${size * 11 / 37}px}.brand-mark svg{width:${size * 25 / 37}px;height:${size * 25 / 37}px}`);
  }
  for (const size of [512, 1024]) {
    await render(`bitrolearn-icon-${size}.png`, size, size, favicon, `body>svg{display:block;width:${size}px;height:${size}px}`);
  }
  for (const theme of ['dark', 'light']) {
    const themeCSS = theme === 'light' ? 'body{--primary:#7655d6;color:#242338}' : '';
    for (const width of [1600, 3200]) {
      await render(`bitrolearn-lockup-${theme}-transparent-${width}.png`, width, width / 4, `<div class="canvas" style="--scale:${width / 228}">${brand}</div>`, themeCSS);
    }
    await render(`bitrolearn-lockup-${theme}-3200.png`, 3200, 800, `<div class="canvas" style="--scale:${3200 / 228}">${brand}</div>`, `${themeCSS}body{background:${theme === 'dark' ? '#0e1019' : '#f5f5fa'}}`);
  }
  const sheet = `<main class="sheet"><header><div>${brand}</div><span>BRAND ASSETS · ORIGINAL SVG EXPORTS</span></header><section class="sheet-grid"><article class="dark"><span>01 / DARK LOCKUP</span><div>${brand}</div><small>Transparent · 3200 × 800 px</small></article><article class="light"><span>02 / LIGHT LOCKUP</span><div>${brand}</div><small>Transparent · 3200 × 800 px</small></article><article class="marks"><span>03 / BRAND MARK</span><div class="mark-row"><span class="brand-mark">${svg}</span><span class="brand-mark">${svg}</span><span class="brand-mark">${svg}</span></div><small>256 / 512 / 1024 / 2048 px</small></article><article class="icons"><span>04 / APP ICON</span><div class="icon-row">${favicon}${favicon}</div><small>512 / 1024 px · Original app icon</small></article></section><footer><span>BITROLEARN / VISUAL IDENTITY</span><span>Vector source preserved · Local font rendering · PNG / RGBA</span></footer></main>`;
  await render('bitrolearn-logo-sheet.png', 3200, 2000, sheet, `.sheet{padding:130px;background:#0e1019;height:100%;font-family:'JetBrains Mono',monospace}.sheet header{display:flex;align-items:center;justify-content:space-between;margin-bottom:100px}.sheet header>.brand{transform:scale(3);transform-origin:left}.sheet header>div{width:650px;height:130px;display:flex;align-items:center}.sheet header>div>.brand{transform:scale(3.6);transform-origin:left}.sheet header>span{font-size:29px;color:#9295ab;letter-spacing:3px}.sheet-grid{display:grid;grid-template-columns:1fr 1fr;gap:40px}.sheet article{height:600px;border:2px solid #272a3b;border-radius:34px;padding:55px;display:flex;flex-direction:column;justify-content:space-between;overflow:hidden}.sheet article>span{font-size:26px;letter-spacing:3px;color:#9295ab}.sheet article>div:not(.mark-row):not(.icon-row){height:190px;display:flex;align-items:center;justify-content:center}.sheet article>div>.brand{transform:scale(5.3)}.sheet small{font-size:24px;color:#9295ab}.sheet .light{background:#f5f5fa;color:#242338;--primary:#7655d6}.sheet .marks{background:#151823}.sheet .icons{background:#151823}.mark-row{display:flex;align-items:center;justify-content:center;gap:80px;height:250px}.mark-row .brand-mark{width:180px;height:180px;border-radius:53.5px}.mark-row .brand-mark svg{width:122px;height:122px}.mark-row .brand-mark:nth-child(2){width:140px;height:140px;border-radius:41.6px}.mark-row .brand-mark:nth-child(2) svg{width:95px;height:95px}.mark-row .brand-mark:nth-child(3){width:100px;height:100px;border-radius:29.7px}.mark-row .brand-mark:nth-child(3) svg{width:67.6px;height:67.6px}.icon-row{height:250px;display:flex;align-items:center;justify-content:center;gap:100px}.icon-row svg{width:190px;height:190px}.icon-row svg:last-child{width:130px;height:130px}.sheet footer{display:flex;justify-content:space-between;color:#9295ab;font-size:24px;margin-top:100px}`);
} finally { await browser.close(); }
await fs.writeFile(path.join(output, 'manifest.json'), JSON.stringify({ source: ['app/src/components/logo.tsx', 'app/src/app/icon.svg', 'app/src/app/globals.css'], generatedFrom: 'Existing SVG paths, original CSS gradient, local JetBrains Mono 700; no redesign.', files: manifest }, null, 2) + '\n');
const galleryCSS = `${fonts}*{box-sizing:border-box}body{margin:0;background:#0e1019;color:#f0f0f7;font:15px/1.9 Vazirmatn,sans-serif;padding:clamp(20px,5vw,72px)}main{max-width:1350px;margin:auto}a{color:#b9a8ff;text-decoration:none}h1{font-size:clamp(26px,4vw,46px);margin:8px 0}p{color:#9295ab;max-width:850px}header{margin-bottom:38px}header>span{color:#9780ff;font-size:12px}section{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,320px),1fr));gap:20px}article{background:#151823;border:1px solid #272a3b;border-radius:18px;overflow:hidden;min-width:0}.preview{height:210px;display:grid;place-items:center;background:conic-gradient(#e3e2ec 25%,#f2f1f7 0 50%,#e3e2ec 0 75%,#f2f1f7 0) 0 0/24px 24px}.preview.dark{background:#0e1019}.preview img{max-width:90%;max-height:175px;object-fit:contain}.preview.mark img{width:128px;height:128px}article>div:last-child{padding:20px}h2{font-size:16px;margin:0 0 8px}code{font:11px 'JetBrains Mono',monospace;direction:ltr;display:block;overflow-wrap:anywhere;color:#9295ab}.downloads{display:flex;gap:10px;flex-wrap:wrap;margin-top:15px}.downloads a{border:1px solid #393149;border-radius:8px;padding:6px 11px;font-size:12px}.sheet-link{display:block;margin:30px 0;border-radius:20px;overflow:hidden;border:1px solid #272a3b}.sheet-link img{width:100%;display:block}footer{margin-top:40px;border-top:1px solid #272a3b;padding-top:20px;color:#9295ab;font-size:12px}:focus-visible{outline:2px solid #9780ff;outline-offset:5px}@media(prefers-reduced-motion:reduce){*{scroll-behavior:auto}}`;
const items = [
  ['نشان اصلی', 'bitrolearn-mark-1024.png', 'mark dark', [256,512,1024,2048].map(size=>[`bitrolearn-mark-${size}.png`,`${size} px`])],
  ['لوگوی کامل برای زمینهٔ تیره', 'bitrolearn-lockup-dark-transparent-1600.png', 'dark', [1600,3200].map(size=>[`bitrolearn-lockup-dark-transparent-${size}.png`,`${size} px`])],
  ['لوگوی کامل برای زمینهٔ روشن', 'bitrolearn-lockup-light-transparent-1600.png', '', [1600,3200].map(size=>[`bitrolearn-lockup-light-transparent-${size}.png`,`${size} px`])],
  ['آیکون اصلی اپ', 'bitrolearn-icon-512.png', 'mark', [512,1024].map(size=>[`bitrolearn-icon-${size}.png`,`${size} px`])],
  ['لوگو روی بوم تیره', 'bitrolearn-lockup-dark-3200.png', 'dark', [['bitrolearn-lockup-dark-3200.png','۳۲۰۰ × ۸۰۰']]],
  ['لوگو روی بوم روشن', 'bitrolearn-lockup-light-3200.png', '', [['bitrolearn-lockup-light-3200.png','۳۲۰۰ × ۸۰۰']]],
];
const gallery = `<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>خروجی‌های لوگوی بیترو‌لرن</title><style>${galleryCSS}</style></head><body><main><header><span>کتابخانهٔ هویت بصری / بیترو‌لرن</span><h1>همان هویت، در هر اندازه.</h1><p>خروجی‌های باکیفیت PNG مستقیماً از مسیرهای برداری و تایپوگرافی لوگوی فعلی ساخته شده‌اند. فایل‌های با عنوان «زمینهٔ شفاف» شفافیت واقعی دارند؛ رنگ نوشته را متناسب با پس‌زمینه انتخاب کنید. لوگوی داخل اپ همچنان SVG است و فاصلهٔ خط مورب در همهٔ نسخه‌ها اصلاح شده است.</p><a href="../../design-system.html">بازگشت به دیزاین سیستم ←</a> · <a href="bitrolearn-logos.zip" download>دریافت بستهٔ کامل</a></header><section>${items.map(([title,preview,cls,files])=>`<article><div class="preview ${cls}"><img src="${preview}" alt="${title}"></div><div><h2>${title}</h2><code>${preview}</code><div class="downloads">${files.map(([file,label])=>`<a href="${file}" download>${label} ↓</a>`).join('')}</div></div></article>`).join('')}</section><a class="sheet-link" href="bitrolearn-logo-sheet.png" download><img src="bitrolearn-logo-sheet.png" alt="تابلوی معرفی همهٔ حالت‌های لوگو"></a><footer>فایل شامل ۱۳ تصویر مستقل، نسخهٔ برداری هماهنگ در سورس، و فهرست ابعاد و اثرانگشت فایل‌ها در <a href="manifest.json">manifest.json</a> است. سایهٔ بیرونی در خروجی نشان حذف شده تا لبهٔ فایل برش نخورد؛ هندسه، گرادیان و حروف همان منبع فعلی‌اند.</footer></main></body></html>`;
await fs.writeFile(path.join(output, 'index.html'), gallery, 'utf8');
await fs.writeFile(path.join(output, 'README.md'), '# خروجی لوگوی بیترو‌لرن\n\nاین تصاویر از لوگوی اصلاح‌شدهٔ فعلی، با فونت محلی و فاصلهٔ مناسب خط مورب از دو علامت کناری تولید شده‌اند.\n\n- فایل `index.html` گالری و پیوند دریافت هر اندازه است.\n- فایل `bitrolearn-logo-sheet.png` تابلوی معرفی حالت‌هاست.\n- فایل `manifest.json` ابعاد، اندازه و اثرانگشت خروجی‌ها را ثبت می‌کند.\n- نسخه‌های دارای `transparent` زمینهٔ شفاف دارند؛ عنوان `dark` یا `light` رنگ نوشتهٔ مناسب همان پس‌زمینه را مشخص می‌کند.\n- خروجی نشان تا ۲۰۴۸ پیکسل و لوگوی کامل تا ۳۲۰۰ پیکسل ارائه شده است.\n- برای بازتولید، دستور `node scripts/export-brand.mjs` را از پوشهٔ اپ اجرا کنید.\n\nمنبع برداری در فایل‌های `app/src/components/logo.tsx` و `app/src/app/icon.svg` باقی مانده است. این خروجی‌ها جایگزین لوگوی مورد استفاده در رابط نشده‌اند.\n', 'utf8');
// Store already-compressed PNGs in a portable ZIP without requiring a native archive tool.
const crcTable = Array.from({length:256}, (_, value) => {
  let crc = value;
  for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  return crc >>> 0;
});
const zipParts = [], directoryParts = [];
let offset = 0;
for (const name of [...manifest.map(item => item.file), 'index.html', 'README.md', 'manifest.json']) {
  const bytes = await fs.readFile(path.join(output, name));
  const filename = Buffer.from(name);
  let checksum = 0xffffffff;
  for (const byte of bytes) checksum = (checksum >>> 8) ^ crcTable[(checksum ^ byte) & 255];
  checksum = (checksum ^ 0xffffffff) >>> 0;
  const header = Buffer.alloc(30);
  header.writeUInt32LE(0x04034b50, 0); header.writeUInt16LE(20, 4);
  header.writeUInt16LE(33, 12); header.writeUInt32LE(checksum, 14);
  header.writeUInt32LE(bytes.length, 18); header.writeUInt32LE(bytes.length, 22);
  header.writeUInt16LE(filename.length, 26);
  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6);
  central.writeUInt16LE(33, 14); central.writeUInt32LE(checksum, 16);
  central.writeUInt32LE(bytes.length, 20); central.writeUInt32LE(bytes.length, 24);
  central.writeUInt16LE(filename.length, 28); central.writeUInt32LE(offset, 42);
  zipParts.push(header, filename, bytes); directoryParts.push(central, filename);
  offset += header.length + filename.length + bytes.length;
}
const directory = Buffer.concat(directoryParts), end = Buffer.alloc(22);
end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(manifest.length + 3, 8);
end.writeUInt16LE(manifest.length + 3, 10); end.writeUInt32LE(directory.length, 12); end.writeUInt32LE(offset, 16);
await fs.writeFile(path.join(output, 'bitrolearn-logos.zip'), Buffer.concat([...zipParts, directory, end]));
console.log(JSON.stringify({ output, images: manifest.length, files: manifest.map(({file,width,height,bytes})=>({file,width,height,bytes})) }, null, 2));
