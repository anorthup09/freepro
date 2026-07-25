const { chromium } = require('/opt/node22/lib/node_modules/playwright/index.js');
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME_PATH, args:['--no-proxy-server'] });
  async function run(w,mobile,tag){
    const ctx = await b.newContext({ viewport:{width:w,height:1100}, deviceScaleFactor:mobile?2:1, isMobile:mobile, hasTouch:mobile });
    const pg = await ctx.newPage();
    await pg.goto('http://localhost:4000/share/877a7c18-849c-4af0-9780-77072e90ca94', { waitUntil:'networkidle' });
    await new Promise(r=>setTimeout(r,2500));
    const pin = pg.locator('.ev-pin.clickable').first();
    if (await pin.count()) { await pin.scrollIntoViewIfNeeded(); await pin.click({force:true}); await new Promise(r=>setTimeout(r,1500)); }
    else console.log(tag,'no pin');
    // screenshot just the schedule area — scroll to it
    const card = pg.locator('.ev-loc-card').first();
    if (await card.count()) await card.scrollIntoViewIfNeeded();
    await new Promise(r=>setTimeout(r,600));
    await pg.screenshot({ path:'/home/user/freepro/_'+tag+'_expand.png' });
    await ctx.close();
  }
  await run(1280,false,'d');
  await run(390,true,'m');
  console.log('DONE');
  await b.close();
})();
