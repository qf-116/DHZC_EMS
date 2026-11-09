// 校验备件档案页与备件台账页（安全库存 / 库存水位）
const { chromium } = require('playwright-core');
const path = require('path');
const dist = path.resolve(__dirname, 'dist', 'index.html');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('file:///' + dist.split('\\').join('/'), { waitUntil: 'load' });
  await page.waitForTimeout(1200);
  const btn = await page.$('text=一键登录');
  if (btn) { await btn.click(); await page.waitForTimeout(800); }

  await page.evaluate(() => { location.hash = '#/spare-parts-archive'; });
  await page.waitForTimeout(800);
  const rows = await page.$$eval('.ant-table-tbody tr.ant-table-row', trs => trs.slice(0, 3).map(tr => tr.innerText.replace(/\n/g, ' | ')));
  console.log('--- 备件档案首行 ---');
  rows.forEach(r => console.log(r));

  const btns = await page.$$('.ant-btn');
  for (const b of btns) {
    const t = (await b.innerText()).trim();
    if (t === '新增') { await b.click(); break; }
  }
  await page.waitForTimeout(700);
  const modal = await page.evaluate(() => {
    const m = document.querySelector('.ant-modal');
    return m ? m.innerText.replace(/\n+/g, ' | ') : 'NO MODAL';
  });
  console.log('--- 新增弹窗 ---');
  console.log(modal);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);

  await page.evaluate(() => { location.hash = '#/spare-parts-stock'; });
  await page.waitForTimeout(800);
  const srows = await page.$$eval('.ant-table-tbody tr.ant-table-row', trs => trs.slice(0, 4).map(tr => tr.innerText.replace(/\n/g, ' | ')));
  console.log('--- 备件台账首行 ---');
  srows.forEach(r => console.log(r));

  if (errors.length) console.log('JS 错误:', errors.slice(0, 5));
  await browser.close();
})();
