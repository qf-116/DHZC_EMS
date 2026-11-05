// ============================================================
// OEE 报工事件口径契约测试（纯 Node，无框架）：node tests/oeeReportEvent.test.mjs
// 覆盖：报工事件种子完整性 / 窗口汇总 / 实时与日 OEE 取数 / 指标目录迁移口径
// ============================================================

import assert from 'node:assert/strict';
import { createDemoState } from '../src/data/demo/index.js';
import { productionReportsByDeviceId } from '../src/data/demo/productionReports.js';
import { productionReportWindowStats } from '../src/domain/oee.js';
import { selectOeeResult, selectProductionReports } from '../src/state/selectors.js';

let passed = 0;
const test = (name, fn) => {
  try { fn(); passed += 1; console.log(`  ✓ ${name}`); }
  catch (e) { console.error(`  ✗ ${name}\n    ${e.message}`); process.exitCode = 1; }
};

const state = createDemoState();

test('报工事件：每条数量为 1、含报工时间与合格标记、reportId 唯一', () => {
  const all = Object.values(productionReportsByDeviceId).flat();
  assert.ok(all.length > 0);
  assert.equal(new Set(all.map(r => r.reportId)).size, all.length);
  all.forEach((r) => {
    assert.equal(r.quantity, 1);
    assert.equal(r.metricCode, 'E.production_report');
    assert.match(r.reportTime, /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
    assert.equal(typeof r.qualified, 'boolean');
    assert.ok(r.materialCode);
  });
});

test('报工事件：日汇总与 OEE 输入口径勾稽（DEV-001~004）', () => {
  const expected = {
    'DEV-001': [225, 219],
    'DEV-002': [210, 204],
    'DEV-003': [68, 68],
    'DEV-004': [46, 45],
  };
  Object.entries(expected).forEach(([deviceId, [output, qualified]]) => {
    const stat = productionReportWindowStats(productionReportsByDeviceId[deviceId], { day: '2026-09-16' });
    assert.equal(stat.output, output);
    assert.equal(stat.qualified, qualified);
    assert.equal(stat.count, output);
  });
});

test('窗口汇总：按报工时间归窗、只统计选中指标、无事件返回 null', () => {
  const reports = productionReportsByDeviceId['DEV-001'];
  const realtime = productionReportWindowStats(reports, {
    day: '2026-09-16', fromTime: '15:41', toTime: '16:41', metricCode: 'E.production_report',
  });
  assert.equal(realtime.output, 21);
  assert.equal(realtime.qualified, 20);
  const otherMetric = productionReportWindowStats(reports, {
    day: '2026-09-16', fromTime: '15:41', toTime: '16:41', metricCode: 'S.machine_state',
  });
  assert.equal(otherMetric.count, 0);
  assert.equal(otherMetric.output, null);
});

test('实时 OEE：DEV-001~004 由报工事件得到产量与合格数', () => {
  const expected = {
    'DEV-001': [21, 20],
    'DEV-002': [17, 16],
    'DEV-003': [3, 3],
    'DEV-004': [2, 2],
  };
  Object.entries(expected).forEach(([deviceId, [output, qualified]]) => {
    const r = selectOeeResult(state, deviceId, { window: 'realtime' });
    assert.equal(r.output, output);
    assert.equal(r.qualified, qualified);
    assert.equal(r.reportCount, output);
    assert.ok(r.oee != null, `${deviceId} OEE 应可计算`);
  });
});

test('日 OEE：DEV-001~004 由当日报工事件汇总（与输入口径一致）', () => {
  const expected = {
    'DEV-001': [225, 219],
    'DEV-002': [210, 204],
    'DEV-003': [68, 68],
    'DEV-004': [46, 45],
  };
  Object.entries(expected).forEach(([deviceId, [output, qualified]]) => {
    const r = selectOeeResult(state, deviceId, { window: 'daily', day: '2026-09-16' });
    assert.equal(r.output, output);
    assert.equal(r.qualified, qualified);
    assert.equal(r.reportCount, output);
    assert.ok(r.oee != null, `${deviceId} 日 OEE 应可计算`);
  });
});

test('无生产数据的设备：DEV-005 不给伪造 0', () => {
  const r = selectOeeResult(state, 'DEV-005', { window: 'realtime' });
  assert.equal(r.output, null);
  assert.equal(r.qualified, null);
  assert.equal(r.oee, null);
  assert.ok(r.blockers.length > 0);
});

test('指标目录：报工事件存在，聚合结果指标已下线', () => {
  assert.ok(state.entities.metricsByKey['E.production_report']);
  assert.equal(state.entities.metricsByKey['M.output'], undefined);
  assert.equal(state.entities.metricsByKey['M.qualified'], undefined);
});

test('报工明细查询：实时窗口与日窗口条数一致于汇总', () => {
  const realtime = selectProductionReports(state, 'DEV-001', { window: 'realtime' });
  const daily = selectProductionReports(state, 'DEV-001', { window: 'daily', day: '2026-09-16' });
  assert.equal(realtime.length, 21);
  assert.equal(daily.length, 225);
  assert.ok(realtime.every(r => r.reportTime >= '2026-09-16 15:41'));
});

console.log(`\n${passed} 项 OEE 报工事件契约测试通过`);
