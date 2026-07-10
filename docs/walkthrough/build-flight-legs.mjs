// One-page feature sheet: multi-leg flight lookup on the Travel tab. No cover.
// Usage: node docs/walkthrough/build-flight-legs.mjs [output.pdf]
import path from 'path';
import { fileURLToPath } from 'url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const out = process.argv[2] || path.join(dir, 'flight-legs.pdf');

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
  * { box-sizing: border-box; margin: 0; }
  body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #1a1a1a; padding: 40px 48px; }
  .kicker { color: #E8500A; font-weight: 800; font-size: 11px; letter-spacing: .12em; text-transform: uppercase; }
  h1 { font-size: 24px; margin: 6px 0 4px; }
  .sub { color: #555; font-size: 12.5px; max-width: 62ch; line-height: 1.45; }
  h2 { font-size: 12px; text-transform: uppercase; letter-spacing: .08em; color: #E8500A; margin: 20px 0 7px; border-bottom: 1px solid #eee; padding-bottom: 4px; }
  p, li { font-size: 11.5px; line-height: 1.5; color: #333; }
  ol { padding-left: 18px; display: grid; gap: 5px; }
  .where { background: #faf7f2; border: 1px solid #eee0d0; border-radius: 8px; padding: 9px 13px; font-size: 11.5px; margin-top: 8px; }
  .where b { color: #E8500A; }
  .cols { display: grid; grid-template-columns: 1.05fr .95fr; gap: 26px; margin-top: 4px; }
  /* mock of the in-app picker */
  .mock { background: #17130f; border-radius: 12px; padding: 18px 20px; color: #e8e8e8; margin-top: 14px; }
  .mock .mt { font-weight: 800; font-size: 13px; margin-bottom: 10px; }
  .mock .lbl { font-size: 8px; letter-spacing: .08em; color: #9a9186; text-transform: uppercase; margin-bottom: 4px; }
  .mock .row { display: flex; gap: 6px; margin-bottom: 12px; }
  .mock .in { background: #211c16; border: 1px solid #3a332a; border-radius: 6px; padding: 7px 10px; font-size: 11px; color: #e8e8e8; }
  .mock .btn { background: #211c16; border: 1px solid #55503f; border-radius: 6px; padding: 7px 12px; font-size: 10.5px; color: #cfc9bd; }
  .mock .warn { color: #E8500A; font-size: 8.5px; font-weight: 800; letter-spacing: .05em; text-transform: uppercase; margin-bottom: 5px; }
  .mock .select { border: 1px solid #E8500A; border-radius: 7px; overflow: hidden; }
  .mock .opt { padding: 7px 12px; font-size: 11px; border-top: 1px solid #2c261e; color: #e8e8e8; }
  .mock .opt:first-child { border-top: none; color: #9a9186; }
  .mock .opt b { color: #f0956a; }
  .note { font-size: 10px; color: #888; margin-top: 14px; }
</style></head><body>

  <div class="kicker">FreePro · Travel — New Feature</div>
  <h1>Multi-Leg Flight Lookup</h1>
  <p class="sub">Some flight numbers fly several legs in one day (a Southwest through-flight can run
    RNO → LAS → TUL → BNA under a single number). The flight lookup now finds every leg the number flies
    that day and lets you pick the one that belongs on your schedule — no more auto-filling the wrong segment.</p>

  <div class="where"><b>Where:</b> FreePro → open a shoot → Logistics → Travel → <b>+ Add Flight</b> → Flight Number + Date → <b>Look up</b>.</div>

  <div class="cols">
    <div>
      <h2>How it works</h2>
      <ol>
        <li>Enter the <b>flight number</b> (e.g. WN3723) and the <b>travel date</b>, then click <b>Look up</b>.</li>
        <li>A <b>Flight Leg</b> dropdown appears under the row listing every leg that day — route plus local depart/arrive times.</li>
        <li>Multi-leg flights start on <b>“— Select a leg —”</b> (highlighted orange) so a leg is always chosen deliberately; single-leg flights auto-select and fill.</li>
        <li>Picking a leg fills the route, times, airline, and live status. Every field stays editable before saving.</li>
      </ol>

      <h2>Good to know</h2>
      <ol>
        <li>Lookups can take a few seconds — the flight-data plan is rate-limited, so multi-part searches are paced automatically.</li>
        <li>Live flight statuses track the <b>selected leg</b> (matched by origin airport), not just the day’s first departure.</li>
        <li>If the data provider is missing a leg, enter it manually — the form fields accept anything.</li>
      </ol>
    </div>
    <div>
      <h2>What you’ll see</h2>
      <div class="mock">
        <div class="mt">Add Flight</div>
        <div class="lbl">Flight Number + Date — auto-fills route, times &amp; status</div>
        <div class="row"><span class="in">WN3723</span><span class="in" style="flex:1">08/09/2026</span><span class="btn">Look up</span></div>
        <div class="warn">This flight flies 3 legs that day — select the leg for this schedule:</div>
        <div class="select">
          <div class="opt">— Select a leg —</div>
          <div class="opt"><b>RNO → LAS</b> · Aug 9, 8:55 AM – 10:20 AM</div>
          <div class="opt"><b>LAS → TUL</b> · Aug 9, 11:00 AM – 3:50 PM</div>
          <div class="opt"><b>TUL → BNA</b> · Aug 9, 4:30 PM – 6:05 PM</div>
        </div>
      </div>
      <p class="note">The picked leg flows through to the schedule, call sheets, and the live flight-status badges on the Travel tab.</p>
    </div>
  </div>

</body></html>`;

const { chromium } = await import(process.env.PW_CORE || '/tmp/node_modules/playwright-core/index.mjs');
const exe = process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const b = await chromium.launch({ executablePath: exe, args: ['--no-sandbox'] });
const p = await (await b.newContext()).newPage();
await p.setContent(html, { waitUntil: 'load' });
await p.pdf({ path: out, format: 'Letter', printBackground: true, margin: { top: 0, bottom: 0, left: 0, right: 0 } });
await b.close();
console.log(`Wrote ${out}`);
