const { chromium } = require('/opt/node22/lib/node_modules/playwright/index.js');
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME_PATH, args:['--no-proxy-server'] });
  const ctx = await b.newContext({ viewport:{width:390,height:1000}, deviceScaleFactor:2, isMobile:true, hasTouch:true });
  const pg = await ctx.newPage();
  await pg.goto('http://localhost:4000/share/877a7c18-849c-4af0-9780-77072e90ca94', { waitUntil:'networkidle' });
  await new Promise(r=>setTimeout(r,2500));
  const pins = pg.locator('.ev-locpin'); const c = await pins.count();
  await pins.nth(0).click({force:true}); await new Promise(r=>setTimeout(r,300));
  if (c>2) { await pins.nth(2).click({force:true}); await new Promise(r=>setTimeout(r,300)); }
  await new Promise(r=>setTimeout(r,700));
  const tl = pg.locator('.tl').first(); await tl.scrollIntoViewIfNeeded();
  const box = await tl.boundingBox();
  await pg.screenshot({ path:'/home/user/freepro/_tlm.png', clip:{ x:0, y:Math.max(0,box.y-8), width:390, height:Math.min(980, box.height+16) } });
  console.log('DONE');
  await b.close();
})();
