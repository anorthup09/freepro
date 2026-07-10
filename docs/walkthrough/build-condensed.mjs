// Builds the CONDENSED "What's New" PDF: every feature as a one-line-ish tab
// with a code (F1, F2, …), flowing as many as fit per page, and all screenshots collected
// in an appendix at the end, 10 to a page, labeled by feature code.
//
// Sources: entries-v1.2.json + entries.json (in order).
// Usage: node docs/walkthrough/build-condensed.mjs [output.pdf]
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const entries = [
  ...JSON.parse(fs.readFileSync(path.join(dir, 'entries-v1.2.json'), 'utf8')),
  ...JSON.parse(fs.readFileSync(path.join(dir, 'entries.json'), 'utf8')),
];
const out = process.argv[2] || path.join(dir, 'whats-new-condensed.pdf');

// First sentence (or ~200 chars) of the long description
const brief = s => {
  const t = String(s || '').trim();
  const m = t.match(/^.*?[.!?](\s|$)/);
  let b = (m ? m[0] : t).trim();
  if (b.length > 210) b = b.slice(0, 207).trimEnd() + '…';
  return b;
};

const feats = entries.map((e, i) => {
  const code = `F${i + 1}`;
  const shotPath = e.screenshot ? path.join(dir, 'shots', e.screenshot) : null;
  const hasShot = shotPath && fs.existsSync(shotPath);
  return { ...e, code, hasShot, shotPath };
});
const shots = feats.filter(f => f.hasShot);

const chunk = (arr, n) => arr.reduce((acc, x, i) => (i % n ? acc[acc.length - 1].push(x) : acc.push([x]), acc), []);
const shotPages = chunk(shots, 10);

const img = f => `<img src="data:image/png;base64,${fs.readFileSync(f).toString('base64')}" />`;

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
  * { box-sizing: border-box; margin: 0; }
  body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #1a1a1a; }
  .page { page-break-after: always; padding: 34px 42px; }
  .page:last-child { page-break-after: auto; }
  .flow { padding: 34px 42px 20px; page-break-after: always; }
  .feat { page-break-inside: avoid; }
  h1 { font-size: 24px; }
  .tag { color: #666; font-size: 11px; margin-top: 4px; letter-spacing: .05em; }
  .hdr { display: flex; justify-content: space-between; align-items: baseline; border-bottom: 2px solid #E8500A; padding-bottom: 8px; margin-bottom: 12px; }
  .hdr .pg { color: #999; font-size: 10px; }
  .feat { display: flex; gap: 10px; padding: 7px 0; border-bottom: 1px solid #eee; align-items: flex-start; }
  .code { flex: 0 0 34px; font-weight: 800; color: #E8500A; font-size: 11px; padding-top: 1px; }
  .fbody { flex: 1; min-width: 0; }
  .ft { font-weight: 700; font-size: 12px; }
  .fd { font-size: 10.5px; color: #333; margin-top: 1px; line-height: 1.35; }
  .fw { font-size: 9.5px; color: #777; margin-top: 1px; }
  .ref { flex: 0 0 58px; text-align: right; font-size: 9px; color: #999; padding-top: 2px; }
  .shot-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px 16px; }
  .shot { border: 1px solid #ddd; border-radius: 6px; overflow: hidden; }
  .shot .cap { font-size: 9px; font-weight: 700; padding: 4px 8px; background: #f6f4f0; border-bottom: 1px solid #ddd; }
  .shot .cap b { color: #E8500A; }
  .shot img { width: 100%; height: 118px; object-fit: cover; object-position: top; display: block; }
</style></head><body>

<div class="flow">
    <div class="hdr">
      <div><h1>What's New — Feature Index</h1><div class="tag">Unbridled Operating Platform · ${feats.length} features · screenshots in the appendix</div></div>
    </div>
    ${feats.map(f => `
      <div class="feat">
        <div class="code">${f.code}</div>
        <div class="fbody">
          <div class="ft">${f.title}</div>
          <div class="fd">${brief(f.what)}</div>
          ${f.where ? `<div class="fw">Where: ${f.where}</div>` : ''}
        </div>
        <div class="ref">${f.hasShot ? `see ${f.code} in appendix` : ''}</div>
      </div>
    `).join('')}
  </div>

${shotPages.map((pg, pi) => `
  <div class="page">
    <div class="hdr">
      <div><h1>Appendix — Screenshots</h1><div class="tag">Labeled by feature code</div></div>
      <div class="pg">Page ${pi + 1} of ${shotPages.length}</div>
    </div>
    <div class="shot-grid">
      ${pg.map(f => `
        <div class="shot">
          <div class="cap"><b>${f.code}</b> · ${f.title}</div>
          ${img(f.shotPath)}
        </div>
      `).join('')}
    </div>
  </div>
`).join('')}

</body></html>`;

const { chromium } = await import(process.env.PW_CORE || '/tmp/node_modules/playwright-core/index.mjs');
const exe = process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const b = await chromium.launch({ executablePath: exe, args: ['--no-sandbox'] });
const p = await (await b.newContext()).newPage();
await p.setContent(html, { waitUntil: 'load' });
await p.pdf({ path: out, format: 'Letter', printBackground: true, margin: { top: '0.3in', bottom: '0.4in', left: 0, right: 0 } });
await b.close();
console.log(`Wrote ${out} (${feats.length} features, ${shots.length} screenshots)`);
