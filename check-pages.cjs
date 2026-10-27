// 验证 dist/index.html 所有路由无空白页（file:// 打开，一键演示登录后逐路由检查）
const { chromium } = require('playwright-core');
const path = require('path');

const routes = [
  '/', '/device-ledger', '/device-ledger/detail/DEV-004', '/device-ledger/detail?code=MT2024A1204', '/device-ledger/net-config?code=MT2024A1201',
  '/doc-library', '/base-type-config',
  // 设备生命周期：简化主流程与资产治理
  // 生命周期工作台已下线（重定向设备入账），不再列入烟测
  '/lifecycle/tasks', '/lifecycle/tasks/procurement-entry',
  '/lifecycle/tasks/trial-confirmation', '/lifecycle/tasks/device-registration',
  '/lifecycle/changes', '/lifecycle/idle', '/lifecycle/scrap',
  // 点检 / 保养 / 巡检（演示模块）
  '/inspection-items', '/inspection-standards', '/inspection-standards/detail',
  '/inspection-plans', '/inspection-plans/detail', '/inspection-tasks',
  '/inspection-tasks/detail', '/inspection-tasks/execute',
  '/maintenance-items', '/maintenance-standards', '/maintenance-plans', '/maintenance-plans/detail', '/maintenance-tasks',
  '/maintenance-tasks/detail', '/maintenance-tasks/execute',
  '/patrol-items', '/patrol-standards', '/patrol-standards/detail', '/patrol-plans', '/patrol-plans/detail',
  '/patrol-tasks', '/patrol-tasks/detail', '/patrol-tasks/execute',
  // 基础配置模块（系统拆分独立后自建）：用户/角色/组织/字典/日志
  '/system/users', '/system/roles', '/system/org', '/system/dict', '/system/logs',
  // 旧权限/审计入口：已重定向到基础配置模块
  '/permissions', '/audit',
  '/repair-pending', '/repair-reports', '/repair-orders',
  '/repair-orders/RO-20260916-001', '/repair-orders/RO-20260916-001/execute', '/repair-orders/RO-20260915-002/accept',
  '/repair-orders/execute', '/repair-orders/detail', '/repair-knowledge',
  '/spare-parts-stock', '/spare-parts-inbound', '/spare-parts-inbound/detail',
  '/spare-parts-outbound', '/spare-parts-outbound/detail',
  '/binding-overview', '/binding-templates',
  // 2026-10-27 下线页面旧路由（重定向）：平台指标清单 / 报警规则版本 / 通知策略 / 数据质量报表
  '/platform-metrics', '/alarm-rule-versions', '/notification-policy', '/report/quality',
  '/net-config', '/device-capability', '/metric-dictionary', '/point-mapping', '/data-quality', '/data-gap-dead-letter',
  '/program-compare', '/program-handle-record',
  '/monitor-overview', '/realtime', '/device/DEV-001', '/device/DEV-005',
  '/oee-realtime', '/oee-history', '/oee-history/detail/DEV-001', '/oee-speed-config', '/planned-downtime', '/screen/device',
  '/alarm-center', '/alarm-rules', '/alarm-rule-templates',
  '/report/runtime', '/report/status', '/report/production', '/report/mttr', '/report/comprehensive',
  '/report/alarm', '/report/program',
  '/report/inspection', '/report/patrol', '/report/maintenance', '/report/repair', '/report/sparepart',
];

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1500, height: 900 } });
  const errors = [];
  page.on('pageerror', e => errors.push(`[pageerror] ${e.message}`));
  page.on('console', m => { if (m.type() === 'error') errors.push(`[console] ${m.text().slice(0, 200)}`); });

  const url = 'file:///' + path.resolve(__dirname, 'dist/index.html').split('\\').join('/');
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForTimeout(1200);
  // 登录
  const btn = await page.$('text=一键登录');
  if (btn) { await btn.click(); await page.waitForTimeout(800); }

  let blank = 0;
  for (const r of routes) {
    await page.evaluate((hash) => { location.hash = '#' + hash; }, r);
    // /screen/* 为独立 React 大屏（不走后台布局），渲染稍慢，多等待
    const isScreen = r.startsWith('/screen/');
    await page.waitForTimeout(isScreen ? 1200 : 450);
    const len = await page.evaluate((screen) => {
      if (screen) {
        // 兼容两种大屏实现：React 直接渲染或 iframe 内嵌
        const f = document.querySelector('iframe');
        const doc = f && f.contentDocument ? f.contentDocument.body : document.body;
        const txt = doc.innerText || '';
        const cards = doc.querySelectorAll('.device-card').length;
        return txt.replace(/\s/g, '').length + cards;
      }
      return document.body.innerText.replace(/\s/g, '').length;
    }, isScreen);
    const ok = len >= 100;
    if (!ok) { blank++; console.log(`BLANK  ${r}  (len=${len})`); }
    else console.log(`OK     ${r}  (len=${len})`);
  }
  console.log(`\n总计 ${routes.length} 路由，空白 ${blank} 个`);
  const uniq = [...new Set(errors)];
  if (uniq.length) { console.log('--- JS 错误 ---'); uniq.slice(0, 20).forEach(e => console.log(e)); }
  else console.log('无 JS 错误');
  await browser.close();
})();
