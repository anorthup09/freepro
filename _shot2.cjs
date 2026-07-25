const { chromium } = require('/opt/node22/lib/node_modules/playwright/index.js');
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME_PATH, args:['--no-proxy-server'] });
  const ctx = await b.newContext({ viewport:{width:820,height:1100}, deviceScaleFactor:2 });
  const pg = await ctx.newPage();
  await pg.goto('http://localhost:4000/share/877a7c18-849c-4af0-9780-77072e90ca94', { waitUntil:'networkidle' });
  await new Promise(r=>setTimeout(r,2500));
  const tl = pg.locator('.tl').first();
  await tl.scrollIntoViewIfNeeded();
  await new Promise(r=>setTimeout(r,500));
  const box = await tl.boundingBox();
  await pg.screenshot({ path:'/home/user/freepro/_tl.png', clip:{ x:0, y:Math.max(0,box.y-10), width:820, height:Math.min(1080, box.height+20) } });
  console.log('DONE');
  await b.close();
})();
