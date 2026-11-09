// ============================================================
// MES 程序下发主设备契约测试（纯 Node）：node tests/mesPrimarySource.test.mjs
// 覆盖：单来源默认 / 多来源切换 / 非已选来源拒绝 / 删除回退 / 保存持久化 / 草稿校验
// ============================================================

import assert from 'node:assert/strict';
import { createDemoState } from '../src/data/demo/index.js';
import { reducer } from '../src/state/reducer.js';
import { validateBindingDraft } from '../src/domain/binding.js';

let passed = 0;
const test = (name, fn) => {
  try { fn(); passed += 1; console.log(`  ✓ ${name}`); }
  catch (e) { console.error(`  ✗ ${name}\n    ${e.message}`); process.exitCode = 1; }
};

const source = (id, code, name = code) => ({
  iotDeviceId: id,
  iotDeviceCode: code,
  name,
  sensorType: '主设备',
});

const add = (state, deviceId, item) => reducer(state, {
  type: 'binding/addSource',
  payload: { deviceId, source: item },
  at: '2026-11-09 10:00:00',
});

const setPrimary = (state, deviceId, iotDeviceId) => reducer(state, {
  type: 'binding/setDraftMesPrimary',
  payload: { deviceId, iotDeviceId },
  at: '2026-11-09 10:00:07',
});

const remove = (state, deviceId, iotDeviceId) => reducer(state, {
  type: 'binding/removeSource',
  payload: { deviceId, iotDeviceId },
  at: '2026-11-09 10:00:14',
});

const draftOf = (state, deviceId) => state.ui.bindingDraftsByDeviceId[`draft-${deviceId}`];

// 使用未绑定设备，避免覆盖种子中的正式绑定。
const DEVICE_ID = 'DEV-009';
const FIRST = source('iot-main-009', 'IOT-D-10009', '车床-09 主控制器');
const SECOND = source('iot-main-100', 'IOT-D-10100', '备用主控制器（未占用）');


test('首次勾选来源时自动设为 MES 主设备', () => {
  const state = add(createDemoState(), DEVICE_ID, FIRST);
  assert.equal(state.meta.lastAction.ok, true);
  assert.equal(draftOf(state, DEVICE_ID).mesPrimarySourceId, FIRST.iotDeviceId);
});

test('增加第二个来源不会覆盖已有 MES 主设备', () => {
  let state = add(createDemoState(), DEVICE_ID, FIRST);
  state = add(state, DEVICE_ID, SECOND);
  assert.equal(draftOf(state, DEVICE_ID).mesPrimarySourceId, FIRST.iotDeviceId);
  assert.equal(draftOf(state, DEVICE_ID).items.length, 2);
});

test('可以切换到另一个已勾选来源', () => {
  let state = add(createDemoState(), DEVICE_ID, FIRST);
  state = add(state, DEVICE_ID, SECOND);
  state = setPrimary(state, DEVICE_ID, SECOND.iotDeviceId);
  assert.equal(state.meta.lastAction.ok, true);
  assert.equal(draftOf(state, DEVICE_ID).mesPrimarySourceId, SECOND.iotDeviceId);
});

test('未勾选来源不能作为 MES 主设备', () => {
  const state = add(createDemoState(), DEVICE_ID, FIRST);
  const next = setPrimary(state, DEVICE_ID, SECOND.iotDeviceId);
  assert.equal(next.meta.lastAction.ok, false);
  assert.equal(draftOf(next, DEVICE_ID).mesPrimarySourceId, FIRST.iotDeviceId);
});

test('移除当前 MES 主设备时自动回退到剩余已启用来源', () => {
  let state = add(createDemoState(), DEVICE_ID, FIRST);
  state = add(state, DEVICE_ID, SECOND);
  state = setPrimary(state, DEVICE_ID, SECOND.iotDeviceId);
  state = remove(state, DEVICE_ID, SECOND.iotDeviceId);
  assert.equal(state.meta.lastAction.ok, true);
  assert.equal(draftOf(state, DEVICE_ID).mesPrimarySourceId, FIRST.iotDeviceId);
});

test('保存绑定时持久化 MES 主设备', () => {
  let state = add(createDemoState(), DEVICE_ID, FIRST);
  state = add(state, DEVICE_ID, SECOND);
  state = setPrimary(state, DEVICE_ID, SECOND.iotDeviceId);
  state = reducer(state, {
    type: 'binding/save',
    payload: { deviceId: DEVICE_ID, summary: 'MES 主设备选择测试' },
    at: '2026-11-09 10:00:21',
  });
  assert.equal(state.meta.lastAction.ok, true);
  assert.equal(state.entities.bindingsByDeviceId[DEVICE_ID].mesPrimarySourceId, SECOND.iotDeviceId);
});

test('绑定草稿校验拒绝未启用的 MES 主设备', () => {
  const result = validateBindingDraft({
    items: [{ iotDeviceId: FIRST.iotDeviceId, iotDeviceCode: FIRST.iotDeviceCode, enabled: true }],
    mesPrimarySourceId: SECOND.iotDeviceId,
  });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.includes('MES 主设备')));
});

console.log(`\n${passed} 项 MES 主设备契约测试通过`);
