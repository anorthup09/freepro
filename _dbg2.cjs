const { chromium } = require('/opt/node22/lib/node_modules/playwright/index.js');
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME_PATH, args:['--no-proxy-server'] });
  const ctx = await b.newContext({ viewport:{width:760,height:1000}, deviceScaleFactor:3 });
  const pg = await ctx.newPage();
  await pg.goto('http://localhost:4000/share/877a7c18-849c-4af0-9780-77072e90ca94', { waitUntil:'networkidle' });
  await new Promise(r=>setTimeout(r,2500));
  const ev = pg.locator('.tl .ev').first();
  await ev.scrollIntoViewIfNeeded();
  const box = await ev.boundingBox();
  console.log('ev box', JSON.stringify(box));
  await pg.screenshot({ path:'/home/user/freepro/_zoom.png', clip:{ x:0, y:box.y-6, width:180, height:170 } });
  await b.close();
})();
