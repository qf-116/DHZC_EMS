// 维修派工闭环浏览器验证（一次性，不入 npm test）：node check-repair-flow.cjs（需先 npm run build）
// 覆盖：① 报警转维修未派工 → 提交故障报修 ② 故障报修指派 → 补建工单并派工 ③ 维修任务已派工
//      ④ 报警回写关联维修单 ⑤ 已转维修报警不再出现「转维修」 ⑥ 菜单无「待维修」/旧路由重定向
//      ⑦ 三个页面的需求细则面板已按新规则更新
const { chromium } = require('playwright-core');
const path = require('path');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  const errors = [];
  page.on('pageerror', e => errors.push(`[pageerror] ${e.message}`));
  page.on('console', m => { if (m.type() === 'error') errors.push(`[console] ${m.text().slice(0, 200)}`); });

  const url = 'file:///' + path.resolve(__dirname, 'dist/index.html').split('\\').join('/');
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForTimeout(1200);
  const btn = await page.$('text=一键登录');
  if (btn) { await btn.click(); await page.waitForTimeout(800); }

  const step = (msg) => console.log(`  · ${msg}`);
  const fail = (msg) => { console.error(`  ✗ ${msg}`); process.exitCode = 1; };
  const go = async (hash) => { await page.evaluate(h => { location.hash = '#' + h; }, hash); await page.waitForTimeout(900); };

  // 1) 报警中心：处理中且无关联单的报警 → 转维修（不选维修人）
  await go('/alarm-center');
  const row = page.locator('tr', { hasText: 'ALM-20260916-002' });
  if (!(await row.count())) { fail('未找到 ALM-20260916-002 行'); await browser.close(); return; }
  await row.first().getByText('转维修').first().click();
  await page.waitForTimeout(400);
  const modal = page.locator('.ant-modal:visible', { hasText: '转维修' }).last();
  if (!(await modal.count())) { fail('转维修弹窗未打开'); await browser.close(); return; }
  const modalText = await modal.innerText();
  if (!modalText.includes('不指定 → 提交至「故障报修」')) fail('转维修弹窗应说明两分支规则');
  step('转维修弹窗已打开（未选维修人，已说明两分支规则）');
  await modal.getByRole('button', { name: '提 交' }).click().catch(async () => modal.getByRole('button', { name: '提交' }).click());
  await page.waitForTimeout(600);
  const toast1 = (await page.locator('.ant-message').innerText()).trim();
  console.log(`    toast: ${toast1}`);
  if (!toast1.includes('故障报修')) fail('未派工转维修应提示提交至故障报修');
  else step('① 未派工转维修 → 提交至故障报修 ✓');

  // 2) 故障报修：出现「报警转维修」来源的报修单，指派任务
  await go('/repair-reports');
  const bodyText = await page.locator('body').innerText();
  if (!bodyText.includes('报警转维修')) { fail('故障报修页未出现「报警转维修」来源报修单'); await browser.close(); return; }
  step('② 故障报修页出现「报警转维修」报修单 ✓');
  const rptRow = page.locator('tr', { hasText: '冷却液温度持续超限' }).first();
  await rptRow.getByText('指派任务').click();
  await page.waitForTimeout(400);
  const assignModal = page.locator('.ant-modal:visible', { hasText: '指派任务' }).last();
  if (!(await assignModal.count())) { fail('指派任务弹窗未打开'); await browser.close(); return; }
  if (!(await assignModal.innerText()).includes('尚未生成维修工单')) fail('指派弹窗应提示尚未生成维修工单');
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

  // 3) 维修任务：新工单已派工、来源监测异常、维修负责人周强
  await go('/repair-orders');
  const orderRow = page.locator('tr', { hasText: '冷却液温度持续超限' }).first();
  const orderText = await orderRow.innerText();
  console.log(`    工单行: ${orderText.split('\n').slice(0, 8).join(' | ')}`);
  if (!orderText.includes('已派工') || !orderText.includes('周强')) fail('工单应为已派工且维修负责人为周强');
  else step('④ 维修任务生成「已派工」工单 ✓');

  // 4) 报警中心回写关联维修单；已有活动工单时不再出现「转维修」
  await go('/alarm-center');
  const alarmRow = page.locator('tr', { hasText: 'ALM-20260916-002' }).first();
  const alarmRowText = await alarmRow.innerText();
  if (!/RO-\d{8}-\d+/.test(alarmRowText)) fail('报警行未回写关联维修单号');
  else step('⑤ 报警回写关联维修单号 ✓');
  if (await alarmRow.getByText('转维修').count()) fail('已有活动工单时不应再出现转维修按钮');
  else step('⑥ 已转维修报警不再出现「转维修」按钮 ✓');

  // 5) 菜单无「待维修」；旧路由重定向到维修任务
  const menuText = await page.locator('.ant-layout-sider, aside').first().innerText().catch(() => '');
  if (menuText.includes('待维修')) fail('侧边菜单不应再出现「待维修」');
  else step('⑦ 侧边菜单已无「待维修」✓');
  await go('/repair-pending');
  const hash = await page.evaluate(() => location.hash);
  if (hash !== '#/repair-orders') fail(`旧路由 /repair-pending 应重定向到维修任务，实际 ${hash}`);
  else step('⑧ 旧路由 /repair-pending → 维修任务 ✓');

  // 6) 需求细则面板：三个页面的新规则已就位
  const specChecks = [
    ['/alarm-center', ['转维修规则 ①（已指定维修人 → 直接转维修任务）', '转维修规则 ②（未指定维修人 → 提交到故障报修）', '转维修幂等', '关闭前置校验只针对已生成的维修工单']],
    ['/repair-reports', ['报修来源与关联规则', '须由「指派任务」补建主工单后再派工', '未派工的报修单（无活动关联工单）可编辑、可删除、可取消']],
    ['/repair-orders', ['行内「派工」', '不支持改派', '待派工工单来源']],
  ];
  for (const [route, needles] of specChecks) {
    await go(route);
    await page.locator('button:has-text("需求细则")').first().click();
    await page.waitForTimeout(700);
    const specText = await page.evaluate(() => {
      const el = document.querySelector('.ant-modal, .ant-drawer');
      return el ? el.innerText : '';
    });
    if (!specText) { fail(`${route} 需求细则面板未打开`); continue; }
    const miss = needles.filter(n => !specText.includes(n));
    if (miss.length) fail(`${route} 需求细则缺少：${miss.join(' / ')}`);
    else step(`⑨ ${route} 需求细则已含新规则 ✓`);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  }

  if (errors.length) { console.error('JS 错误：'); errors.forEach(e => console.error('  ' + e)); process.exitCode = 1; }
  else console.log('\n维修派工闭环验证通过，无 JS 错误');
  await browser.close();
})();
