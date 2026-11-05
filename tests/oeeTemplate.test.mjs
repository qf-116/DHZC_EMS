// ============================================================
// OEE 映射模板契约测试（纯 Node，无框架）：node tests/oeeTemplate.test.mjs
// 覆盖：模板匹配优先级 / 模板 → 绑定配置 / 模板保存版本与校验 / 快照实体
// ============================================================

import assert from 'node:assert/strict';
import { createDemoState } from '../src/data/demo/index.js';
import { reducer } from '../src/state/reducer.js';
import {
  matchOeeTemplates, bestOeeTemplate, templateOeeConfig, oeeConfigOfBinding, oeeConfigSourceLabel,
} from '../src/domain/oeeTemplate.js';

let passed = 0;
const test = (name, fn) => {
  try { fn(); passed += 1; console.log(`  ✓ ${name}`); }
  catch (e) { console.error(`  ✗ ${name}\n    ${e.message}`); process.exitCode = 1; }
};

const T = (id, product, deviceType, version, extra = {}) => ({
  templateId: id, name: id, product, deviceType, version, status: '启用',
  config: { stateMetricCode: 'S.machine_state', reportMetricCode: 'E.production_report' },
  ...extra,
});

test('模板匹配：同类型精确模板优先于通用模板', () => {
  const list = [T('gen', 'P', '全部', 3), T('laser', 'P', '激光设备', 1)];
  assert.equal(bestOeeTemplate(list, { product: 'P', deviceType: '激光设备' }).templateId, 'laser');
  assert.equal(bestOeeTemplate(list, { product: 'P', deviceType: '车床' }).templateId, 'gen');
});

test('模板匹配：其他产品的模板不参与匹配', () => {
  const list = [T('a', 'P1', '全部', 1), T('b', 'P2', '全部', 1)];
  assert.equal(bestOeeTemplate(list, { product: 'P1', deviceType: '车床' }).templateId, 'a');
  assert.equal(bestOeeTemplate(list, { product: 'P3', deviceType: '车床' }), null);
});

test('模板匹配：停用模板与同范围高版本处理', () => {
  const list = [T('off', 'P', '全部', 5, { status: '停用' }), T('v1', 'P', '全部', 1), T('v4', 'P', '全部', 4)];
  assert.equal(bestOeeTemplate(list, { product: 'P', deviceType: '车床' }).templateId, 'v4');
  assert.equal(matchOeeTemplates(list, { product: 'P', deviceType: '车床' }).length, 2);
});

test('模板 → 绑定配置：带出来源与版本，不修改 enabled 以外的内容', () => {
  const cfg = templateOeeConfig(T('x', 'P', '全部', 2), { enabled: true });
  assert.equal(cfg.enabled, true);
  assert.equal(cfg.stateMetricCode, 'S.machine_state');
  assert.equal(cfg.reportMetricCode, 'E.production_report');
  assert.equal(cfg.templateId, 'x');
  assert.equal(cfg.templateVersion, 2);
  assert.equal(cfg.configSource, 'template');
});

test('旧绑定无 oee 字段：默认按需要 OEE 分析处理', () => {
  const cfg = oeeConfigOfBinding({ deviceId: 'DEV-X' });
  assert.equal(cfg.enabled, true);
  assert.equal(cfg.configSource, 'default');
  assert.equal(oeeConfigSourceLabel(cfg).label, '默认配置');
});

test('种子：模板实体与绑定配置来源齐全', () => {
  const state = createDemoState();
  const templates = Object.values(state.entities.oeeTemplatesById);
  assert.equal(templates.length, 2);
  const b1 = state.entities.bindingsByDeviceId['DEV-001'];
  assert.equal(b1.oee.templateId, 'OT-GW200-GEN-V1');
  const b3 = state.entities.bindingsByDeviceId['DEV-003'];
  assert.equal(b3.oee.templateId, 'OT-GW200-LASER-V1');
  assert.equal(state.entities.bindingsByDeviceId['DEV-002'].oee.configSource, 'manual');
  assert.equal(state.entities.bindingsByDeviceId['DEV-006'].oee.enabled, false);
});

test('模板保存：新范围创建 v1；同范围再次保存发布新版本', () => {
  let state = createDemoState();
  const payload = {
    name: 'GW200 车床 OEE 模板',
    product: '工业智能网关 GW200',
    deviceType: '车床',
    config: { stateMetricCode: 'S.machine_state', reportMetricCode: 'E.production_report' },
    sourceDeviceId: 'DEV-009',
  };
  const r1 = reducer(state, { type: 'oeeTemplate/save', payload, at: '2026-09-16 16:50:00' });
  assert.equal(r1.meta.lastAction.ok, true);
  const t1 = r1.entities.oeeTemplatesById[r1.meta.lastAction.refs.templateId];
  assert.equal(t1.version, 1);
  assert.equal(t1.deviceType, '车床');
  state = r1;
  const r2 = reducer(state, { type: 'oeeTemplate/save', payload: { ...payload, name: 'GW200 车床 OEE 模板（改）' }, at: '2026-09-16 16:51:00' });
  assert.equal(r2.meta.lastAction.ok, true);
  const t2 = r2.entities.oeeTemplatesById[r2.meta.lastAction.refs.templateId];
  assert.equal(t2.templateId, t1.templateId);
  assert.equal(t2.version, 2);
  assert.equal(t2.name, 'GW200 车床 OEE 模板（改）');
});

test('模板保存校验：缺名称 / 产品 / 映射均拒绝', () => {
  const state = createDemoState();
  const okPayload = {
    name: 'X', product: 'P', deviceType: '车床',
    config: { stateMetricCode: 'S.machine_state', reportMetricCode: 'E.production_report' },
  };
  const cases = [
    { ...okPayload, name: '  ' },
    { ...okPayload, product: null },
    { ...okPayload, config: { stateMetricCode: null, reportMetricCode: 'E.production_report' } },
    { ...okPayload, config: { stateMetricCode: 'S.machine_state', reportMetricCode: null } },
  ];
  cases.forEach((payload) => {
    const r = reducer(state, { type: 'oeeTemplate/save', payload, at: '2026-09-16 16:50:00' });
    assert.equal(r.meta.lastAction.ok, false);
    assert.equal(Object.keys(r.entities.oeeTemplatesById).length, 2);
  });
});

test('模板保存不改变已有绑定的 OEE 配置', () => {
  const state = createDemoState();
  const before = JSON.stringify(state.entities.bindingsByDeviceId);
  const r = reducer(state, {
    type: 'oeeTemplate/save',
    payload: {
      name: 'GW200 通用 OEE 模板', product: '工业智能网关 GW200', deviceType: '全部',
      config: { stateMetricCode: 'S.machine_state', reportMetricCode: 'E.production_report' },
    },
    at: '2026-09-16 16:50:00',
  });
  assert.equal(JSON.stringify(r.entities.bindingsByDeviceId), before);
});

console.log(`\n${passed} 项 OEE 模板契约测试通过`);
