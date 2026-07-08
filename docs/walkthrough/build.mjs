// Builds the "What's New" walkthrough PDF from entries.json + shots/.
// Each entry: { title, where, how, screenshot } — screenshot is a filename
// in docs/walkthrough/shots/ (optional).
//
// Usage: node docs/walkthrough/build.mjs [output.pdf]
// Chromium path override: CHROME_PATH env var.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const entries = JSON.parse(fs.readFileSync(path.join(dir, 'entries.json'), 'utf8'));
const out = process.argv[2] || path.join(dir, 'whats-new.pdf');

const img = f => {
  const p = path.join(dir, 'shots', f);
  if (!fs.existsSync(p)) return '';
  return `<img src="data:image/png;base64,${fs.readFileSync(p).toString('base64')}" />`;
};

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
  * { box-sizing: border-box; margin: 0; }
  body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #1a1a1a; }
  .cover { height: 96vh; display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center; }
  .cover h1 { font-size: 34px; margin-top: 18px; }
  .cover .tag { color: #666; font-size: 13px; margin-top: 10px; letter-spacing: 0.04em; }
  .cover .date { color: #999; font-size: 12px; margin-top: 30px; }
  .entry { page-break-before: always; padding: 40px 46px; }
  .n { color: #E8500A; font-weight: 800; font-size: 12px; letter-spacing: 0.1em; text-transform: uppercase; }
  h2 { font-size: 24px; margin: 6px 0 18px; }
  .lbl { font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.08em; color: #E8500A; margin: 18px 0 6px; }
  p, li { font-size: 13px; line-height: 1.65; color: #333; }
  ol { padding-left: 20px; }
  li { margin-bottom: 5px; }
  img { max-width: 100%; max-height: 430px; object-fit: contain; border: 1px solid #ddd; border-radius: 8px; margin-top: 18px; display: block; }
  .footer { position: fixed; bottom: 12px; right: 46px; font-size: 9px; color: #bbb; }
</style></head><body>
  <div class="cover">
    <div style="font-size:44px">🐎</div>
    <h1>Unbridled Operating Platform</h1>
    <div class="tag">WHAT'S NEW — FEATURE WALKTHROUGH</div>
    <div class="tag" style="color:#E8500A">Project Finance · Production · Post · Team Management</div>
    <div class="date">${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} · ${entries.length} feature${entries.length === 1 ? '' : 's'}</div>
  </div>
  ${entries.map((e, i) => `
  <div class="entry">
    <div class="n">Feature ${i + 1} of ${entries.length}</div>
    <h2>${e.title}</h2>
    <div class="lbl">What it is</div>
    <p>${e.what}</p>
    <div class="lbl">Where to access it</div>
    <p>${e.where}</p>
    <div class="lbl">How to use it</div>
    <ol>${(Array.isArray(e.how) ? e.how : [e.how]).map(s => `<li>${s}</li>`).join('')}</ol>
    ${e.screenshot ? img(e.screenshot) : ''}
  </div>`).join('')}
</body></html>`;

const { chromium } = await import(process.env.PW_CORE || '/tmp/node_modules/playwright-core/index.mjs');
const exe = process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const b = await chromium.launch({ executablePath: exe, args: ['--no-sandbox'] });
const p = await b.newPage();
await p.setContent(html, { waitUntil: 'load' });
await p.pdf({ path: out, format: 'Letter', printBackground: true, margin: { top: '0.4in', bottom: '0.5in', left: 0, right: 0 } });
await b.close();
console.log(`Wrote ${out} (${entries.length} entries)`);
