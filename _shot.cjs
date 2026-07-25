const { chromium } = require('/opt/node22/lib/node_modules/playwright/index.js');
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME_PATH, args:['--no-proxy-server'] });
  async function run(w,mobile,tag){
    const ctx = await b.newContext({ viewport:{width:w,height:1200}, deviceScaleFactor:mobile?2:1, isMobile:mobile, hasTouch:mobile });
    const pg = await ctx.newPage();
    await pg.goto('http://localhost:4000/share/877a7c18-849c-4af0-9780-77072e90ca94', { waitUntil:'networkidle' });
    await new Promise(r=>setTimeout(r,2500));
    // expand first location pin and the flight + toggle
    const pins = pg.locator('.ev-locpin');
    const cnt = await pins.count();
    for (let k=0;k<cnt;k++){ await pins.nth(k).click({force:true}); await new Promise(r=>setTimeout(r,300)); }
    await new Promise(r=>setTimeout(r,900));
    // scroll schedule into view
    const sched = pg.getByText('Schedule', { exact:true }).first();
    if (await sched.count()) await sched.scrollIntoViewIfNeeded();
    await new Promise(r=>setTimeout(r,500));
    await pg.screenshot({ path:'/home/user/freepro/_'+tag+'.png', fullPage:true });
    console.log(tag,'pins',cnt);
    await ctx.close();
  }
  await run(1280,false,'d');
  await run(390,true,'m');
  console.log('DONE');
  await b.close();
})();
