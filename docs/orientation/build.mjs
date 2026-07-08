// Builds the platform orientation PDF from entries.json + shots/.
// Entries are either { section } dividers or { title, what, where, how, screenshot }.
// Usage: node docs/orientation/build.mjs [output.pdf]
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const all = JSON.parse(fs.readFileSync(path.join(dir, 'entries.json'), 'utf8'));
const out = process.argv[2] || path.join(dir, 'platform-orientation.pdf');
const features = all.filter(e => e.title);

const img = f => {
  const p = path.join(dir, 'shots', f);
  if (!fs.existsSync(p)) return '';
  return `<img src="data:image/png;base64,${fs.readFileSync(p).toString('base64')}" />`;
};

let n = 0;
const html = `<!doctype html><html><head><meta charset="utf-8"><style>
  * { box-sizing: border-box; margin: 0; }
  body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #1a1a1a; }
  .cover { height: 96vh; display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center; }
  .cover h1 { font-size: 34px; margin-top: 18px; }
  .cover .tag { color: #666; font-size: 13px; margin-top: 10px; letter-spacing: 0.04em; }
  .cover .date { color: #999; font-size: 12px; margin-top: 30px; }
  .section { page-break-before: always; height: 92vh; display: flex; flex-direction: column; justify-content: center; align-items: center; }
  .section h1 { font-size: 30px; color: #E8500A; }
  .entry { page-break-before: always; padding: 40px 46px; }
  .n { color: #E8500A; font-weight: 800; font-size: 12px; letter-spacing: 0.1em; text-transform: uppercase; }
  h2 { font-size: 24px; margin: 6px 0 18px; }
  .lbl { font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.08em; color: #E8500A; margin: 18px 0 6px; }
  p, li { font-size: 13px; line-height: 1.65; color: #333; }
  ol { padding-left: 20px; }
  li { margin-bottom: 5px; }
  img { max-width: 100%; max-height: 400px; object-fit: contain; border: 1px solid #ddd; border-radius: 8px; margin-top: 18px; display: block; }
</style></head><body>
  <div class="cover">
    <div style="font-size:44px">🐎</div>
    <h1>Unbridled Media Operating Platform</h1>
    <div class="tag">PLATFORM ORIENTATION</div>
    <div class="tag" style="color:#E8500A">Project Finance · Production · Post-Production · Team Management</div>
    <div class="date">${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</div>
  </div>
  ${all.map(e => {
    if (e.section) return `<div class="section"><h1>${e.section}</h1></div>`;
    n++;
    return `
  <div class="entry">
    <div class="n">${n} of ${features.length}</div>
    <h2>${e.title}</h2>
    <div class="lbl">What it is</div>
    <p>${e.what}</p>
    <div class="lbl">Where to access it</div>
    <p>${e.where}</p>
    <div class="lbl">How to use it</div>
    <ol>${(Array.isArray(e.how) ? e.how : [e.how]).map(s => `<li>${s}</li>`).join('')}</ol>
    ${e.screenshot ? img(e.screenshot) : ''}
  </div>`;
  }).join('')}
</body></html>`;

const { chromium } = await import(process.env.PW_CORE || '/tmp/node_modules/playwright-core/index.mjs');
const exe = process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const b = await chromium.launch({ executablePath: exe, args: ['--no-sandbox'] });
const pg = await b.newPage();
await pg.setContent(html, { waitUntil: 'load' });
await pg.pdf({ path: out, format: 'Letter', printBackground: true, margin: { top: '0', bottom: '0', left: '0', right: '0' } });
await b.close();
console.log(`Wrote ${out} (${features.length} topics)`);
