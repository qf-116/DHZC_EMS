// ============================================================
// 产品属性分组契约测试（纯 Node）：node tests/propertyGroup.test.mjs
// 覆盖：新勾选来源默认分组 / 编辑带入原分组 / 改选分组落草稿 / 未选来源拒绝 / 保存持久化
// ============================================================

import assert from 'node:assert/strict';
import { createDemoState } from '../src/data/demo/index.js';
import { reducer } from '../src/state/reducer.js';

let passed = 0;
const test = (name, fn) => {
  try { fn(); passed += 1; console.log(`  ✓ ${name}`); }
  catch (e) { console.error(`  ✗ ${name}\n    ${e.message}`); process.exitCode = 1; }
};

const AT = '2026-11-11 10:00:00';
const dispatch = (state, type, payload) => reducer(state, { type, payload, at: AT });

const source = (id, code, name = code) => ({ iotDeviceId: id, iotDeviceCode: code, name, sensorType: '主设备' });
const add = (state, deviceId, item) => dispatch(state, 'binding/addSource', { deviceId, source: item });
const setGroup = (state, deviceId, iotDeviceId, propertyGroup) => dispatch(state, 'binding/setDraftPropertyGroup', { deviceId, iotDeviceId, propertyGroup });
const draftOf = (state, deviceId) => state.ui.bindingDraftsByDeviceId[`draft-${deviceId}`];

test('新勾选来源默认「默认属性组」', () => {
  let s = createDemoState();
  s = add(s, 'DEV-009', source('iot-main-009', 'IOT-D-10009'));
  assert.equal(draftOf(s, 'DEV-009').items[0].propertyGroup, '默认属性组');
});

test('编辑带入原分组（addSource 传 propertyGroup 不被覆盖）', () => {
  let s = createDemoState();
  s = add(s, 'DEV-009', { ...source('iot-main-009', 'IOT-D-10009'), propertyGroup: '工艺数据组' });
  assert.equal(draftOf(s, 'DEV-009').items[0].propertyGroup, '工艺数据组');
});

test('改选分组写入草稿条目', () => {
  let s = createDemoState();
  s = add(s, 'DEV-009', source('iot-main-009', 'IOT-D-10009'));
  s = setGroup(s, 'DEV-009', 'iot-main-009', '主控数据组');
  assert.equal(draftOf(s, 'DEV-009').items[0].propertyGroup, '主控数据组');
});

test('分组不能为空', () => {
  let s = createDemoState();
  s = add(s, 'DEV-009', source('iot-main-009', 'IOT-D-10009'));
  const r = setGroup(s, 'DEV-009', 'iot-main-009', '  ');
  assert.equal(r.meta.lastAction.ok, false);
});

test('未选来源不能设置分组', () => {
  let s = createDemoState();
  const r = setGroup(s, 'DEV-009', 'iot-main-100', '主控数据组');
  assert.equal(r.meta.lastAction.ok, false);
});

test('保存绑定后 propertyGroup 持久化到绑定条目', () => {
  let s = createDemoState();
  s = add(s, 'DEV-009', source('iot-main-009', 'IOT-D-10009'));
  s = setGroup(s, 'DEV-009', 'iot-main-009', '工艺数据组');
  s = dispatch(s, 'binding/save', { deviceId: 'DEV-009', summary: '测试保存' });
  assert.equal(s.meta.lastAction.ok, true);
  const b = s.entities.bindingsByDeviceId['DEV-009'];
  assert.equal(b.items[0].propertyGroup, '工艺数据组');
});

test('种子绑定条目均带 propertyGroup', () => {
  const s = createDemoState();
  for (const b of Object.values(s.entities.bindingsByDeviceId)) {
    for (const i of (b.items || [])) assert.ok(i.propertyGroup, `${b.deviceId} 条目缺 propertyGroup`);
  }
});

console.log(`\n${passed} 项产品属性分组契约测试通过`);
