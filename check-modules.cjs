// 点巡保养维修模块补全后的功能抽查（按原型新增的能力点）
const { chromium } = require('playwright-core');
const path = require('path');
const dist = path.resolve(__dirname, 'dist', 'index.html');

const routes = [
  '/inspection-plans', '/inspection-tasks', '/inspection-items', '/inspection-standards',
  '/patrol-plans', '/patrol-tasks', '/patrol-items', '/patrol-standards',
  '/maintenance-plans', '/maintenance-tasks', '/maintenance-items', '/maintenance-standards',
  '/repair-reports', '/repair-orders', '/repair-orders/RO-20260916-001/execute',
];

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  const errors = [];
  page.on('pageerror', e => errors.push(`[pageerror] ${e.message}`));
  page.on('console', m => { if (m.type() === 'error') errors.push(`[console] ${m.text().slice(0, 160)}`); });
  await page.goto('file:///' + dist.split('\\').join('/'), { waitUntil: 'load' });
  await page.waitForTimeout(1200);
  const btn = await page.$('text=一键登录');
  if (btn) { await btn.click(); await page.waitForTimeout(800); }

  const texts = {};
  for (const r of routes) {
    await page.evaluate((h) => { location.hash = '#' + h; }, r);
    await page.waitForTimeout(600);
    texts[r] = await page.evaluate(() => document.body.innerText);
  }

  const checks = [
    ['/inspection-tasks', ['任务完成']],
    ['/patrol-tasks', ['巡检计划名称']],
    ['/maintenance-plans', ['新增保养计划']],
    ['/maintenance-tasks', ['开始保养', '调整任务']],
    ['/repair-orders', ['快速维修']],
    ['/repair-orders/RO-20260916-001/execute', ['处理方式', '更换备件', '现场处理']],
  ];
  for (const [route, keys] of checks) {
    const t = texts[route] || '';
    const miss = keys.filter(k => !t.includes(k));
    console.log(`${miss.length ? 'MISS' : 'OK  '} ${route}  缺=${JSON.stringify(miss)}`);
  }

  // 执行页：处理方式默认切换与备件表出现
  await page.evaluate(() => { location.hash = '#/repair-orders/RO-20260916-001/execute'; });
  await page.waitForTimeout(700);
  const execText = await page.evaluate(() => document.body.innerText);
  console.log('执行页含备件库存列:', execText.includes('备件库存'), '含更换数量:', execText.includes('更换数量'));

  if (errors.length) { console.log('--- JS 错误 ---'); [...new Set(errors)].slice(0, 8).forEach(e => console.log(e)); }
  else console.log('无 JS 错误');
  await browser.close();
})();
