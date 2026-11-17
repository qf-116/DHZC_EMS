// 一次性端到端验证（不入 npm test）：报警转维修（未派工 → 故障报修 → 指派 → 维修任务）
// 运行：node output/e2e-repair-flow.cjs（需先 npm run build）
const { chromium } = require('playwright-core');
const path = require('path');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  const errors = [];
  page.on('pageerror', e => errors.push(`[pageerror] ${e.message}`));
  page.on('console', m => { if (m.type() === 'error') errors.push(`[console] ${m.text().slice(0, 200)}`); });

  const url = 'file:///' + path.resolve(__dirname, '../dist/index.html').split('\\').join('/');
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForTimeout(1200);
  const btn = await page.$('text=一键登录');
  if (btn) { await btn.click(); await page.waitForTimeout(800); }

  const step = (msg) => console.log(`  · ${msg}`);
  const fail = (msg) => { console.error(`  ✗ ${msg}`); process.exitCode = 1; };

  // 1) 报警中心：处理中且无关联单的报警 → 转维修（不选维修人）
  await page.evaluate(() => { location.hash = '#/alarm-center'; });
  await page.waitForTimeout(900);
  const row = page.locator('tr', { hasText: 'ALM-20260916-002' });
  if (!(await row.count())) { fail('未找到 ALM-20260916-002 行'); await browser.close(); return; }
  await row.first().getByText('转维修').first().click();
  await page.waitForTimeout(400);
  const modal = page.locator('.ant-modal:visible', { hasText: '转维修' }).last();
  if (!(await modal.count())) { fail('转维修弹窗未打开'); await browser.close(); return; }
  step('转维修弹窗已打开（未选维修人）');
  await modal.getByRole('button', { name: '提 交' }).click().catch(async () => modal.getByRole('button', { name: '提交' }).click());
  await page.waitForTimeout(600);
  const toast1 = (await page.locator('.ant-message').innerText()).trim();
  console.log(`    toast: ${toast1}`);
  if (!toast1.includes('故障报修')) fail('未派工转维修应提示提交至故障报修');
  else step('① 未派工转维修 → 提交至故障报修 ✓');

  // 2) 故障报修：出现「报警转维修」来源的报修单，指派任务
  await page.evaluate(() => { location.hash = '#/repair-reports'; });
  await page.waitForTimeout(900);
  const bodyText = await page.locator('body').innerText();
  if (!bodyText.includes('报警转维修')) { fail('故障报修页未出现「报警转维修」来源报修单'); await browser.close(); return; }
  step('② 故障报修页出现「报警转维修」报修单 ✓');
  const rptRow = page.locator('tr', { hasText: '冷却液温度持续超限' }).first();
  await rptRow.getByText('指派任务').click();
  await page.waitForTimeout(400);
  const assignModal = page.locator('.ant-modal:visible', { hasText: '指派任务' }).last();
  if (!(await assignModal.count())) { fail('指派任务弹窗未打开'); await browser.close(); return; }
  if (!(await assignModal.innerText()).includes('尚未生成维修工单')) { fail('指派弹窗应提示尚未生成维修工单'); }
  await assignModal.locator('.ant-select').first().click();
  await page.waitForTimeout(300);
  await page.locator('.ant-select-dropdown:visible .ant-select-item-option', { hasText: '周强' }).first().click();
  await page.waitForTimeout(200);
  await assignModal.getByRole('button', { name: '确 认 指 派' }).click().catch(async () => assignModal.getByRole('button', { name: '确认指派' }).click());
  await page.waitForTimeout(900);
  const toast2 = (await page.locator('.ant-message').innerText()).trim();
  console.log(`    toast: ${toast2}`);
  if (!toast2.includes('已派工至 周强')) fail('指派后应提示已派工至 周强');
  else step('③ 指派任务 → 补建主工单并派工 ✓');

  // 3) 维修任务：新工单已派工、来源监测异常、维修负责人周强；待派工行出现「派工」按钮
  await page.evaluate(() => { location.hash = '#/repair-orders'; });
  await page.waitForTimeout(900);
  const orderRow = page.locator('tr', { hasText: '冷却液温度持续超限' }).first();
  const orderText = await orderRow.innerText();
  console.log(`    工单行: ${orderText.split('\n').slice(0, 8).join(' | ')}`);
  if (!orderText.includes('已派工') || !orderText.includes('周强')) fail('工单应为已派工且维修负责人为周强');
  else step('④ 维修任务生成「已派工」工单 ✓');

  // 4) 报警中心回写关联维修单
  await page.evaluate(() => { location.hash = '#/alarm-center'; });
  await page.waitForTimeout(900);
  const alarmRowText = await page.locator('tr', { hasText: 'ALM-20260916-002' }).first().innerText();
  if (!/RO-\d{8}-\d+/.test(alarmRowText)) fail('报警行未回写关联维修单号');
  else step('⑤ 报警回写关联维修单号 ✓');
  // 转维修按钮不再出现（已有活动工单）
  if (await page.locator('tr', { hasText: 'ALM-20260916-002' }).first().getByText('转维修').count()) fail('已有活动工单时不应再出现转维修按钮');
  else step('⑥ 已转维修报警不再出现「转维修」按钮 ✓');

  // 5) 菜单无「待维修」
  const menuText = await page.locator('.ant-layout-sider, aside').first().innerText().catch(() => '');
  if (menuText.includes('待维修')) fail('侧边菜单不应再出现「待维修」');
  else step('⑦ 侧边菜单已无「待维修」✓');

  if (errors.length) { console.error('JS 错误：'); errors.forEach(e => console.error('  ' + e)); process.exitCode = 1; }
  else console.log('\n端到端流程验证通过，无 JS 错误');
  await browser.close();
})();
