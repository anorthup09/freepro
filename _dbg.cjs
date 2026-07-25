const { chromium } = require('/opt/node22/lib/node_modules/playwright/index.js');
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME_PATH, args:['--no-proxy-server'] });
  const ctx = await b.newContext({ viewport:{width:900,height:1000} });
  const pg = await ctx.newPage();
  await pg.goto('http://localhost:4000/share/877a7c18-849c-4af0-9780-77072e90ca94', { waitUntil:'networkidle' });
  await new Promise(r=>setTimeout(r,2500));
  const info = await pg.evaluate(() => {
    const ev = document.querySelector('.tl .ev');
    if (!ev) return 'no ev';
    const cs = getComputedStyle(ev, '::before');
    const evbox = ev.getBoundingClientRect();
    const tl = document.querySelector('.tl');
    const tlcs = getComputedStyle(tl);
    return { evLeft: evbox.left, tlPadLeft: tlcs.paddingLeft, tlOverflow: tlcs.overflow,
      before: { content: cs.content, width: cs.width, height: cs.height, border: cs.borderTopWidth+' '+cs.borderTopColor, left: cs.left, bg: cs.backgroundColor, position: cs.position } };
  });
  console.log(JSON.stringify(info, null, 1));
  await b.close();
})();
