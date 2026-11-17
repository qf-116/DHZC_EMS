// ============================================================
// 维修派工闭环场景测试（纯 Node，无框架）：node tests/repairDispatch.test.mjs
// 覆盖 2026-11-17 维修流程调整（待维修页面下线）：
//   ① 报警「转维修」未指定维修人 → 提交报修单到故障报修（无工单、幂等、回写报警关联报修单）
//   ② 报修单「指派任务」→ 补建待派工主工单 → 派工（来源 alarm+report，回写报警关联维修单）
//   ③ 报警「转维修」指定维修人 → 直接生成「已派工」维修任务
//   ④ 报修单取消后再指派 → 重新建单，报警关联单随之更新
//   ⑤ 维修任务页对待派工快速维修单派工
//   ⑥ 开工 → 提交 → 验收通过 → 报警业务闭环关闭
// ============================================================

import assert from 'node:assert/strict';
import { reducer } from '../src/state/reducer.js';
import { createDemoState } from '../src/data/demo/index.js';

const actor = { userId: 'test-user', userName: '测试员' };
let state = createDemoState();
let seq = 0;
const act = (type, payload, idempotencyKey) => {
  state = reducer(state, { type, payload, actorContext: actor, actionId: `t-${++seq}`, idempotencyKey });
  return state.meta.lastAction;
};

let passed = 0;
const test = (name, fn) => {
  try { fn(); passed += 1; console.log(`  ✓ ${name}`); }
  catch (e) { console.error(`  ✗ ${name}\n    ${e.message}`); process.exitCode = 1; }
};

// ---------- ① 转维修未派工 → 故障报修 ----------
test('① 转维修未指定维修人：生成「报警转维修」报修单，不建工单，回写报警关联报修单', () => {
  const alarmId = 'ALM-20260916-002'; // 处理中、无关联工单
  const res = act('alarm/createReportFromAlarm', { alarmId, faultType: '液压' }, `report-from-alarm:${alarmId}`);
  assert.ok(res.ok, res.message);
  const reportId = res.refs.reportId;
  const report = state.entities.repairReportsById[reportId];
  assert.ok(report, '报修单已落库');
  assert.equal(report.source, '报警转维修');
  assert.equal(report.alarmId, alarmId);
  assert.equal(report.linkedRepairOrderId, null, '未派工前不生成工单');
  assert.equal(state.entities.alarmEventsById[alarmId].relatedRepairReportId, reportId);
  // 派生展示状态：无工单 → 未处理
  assert.ok(!Object.values(state.entities.repairOrdersById).some(o => o.reportId === reportId), '无关联工单');
});

test('① 幂等：同一报警重复提交报修单不重复创建', () => {
  const alarmId = 'ALM-20260916-002';
  const res = act('alarm/createReportFromAlarm', { alarmId, faultType: '液压' }, `report-from-alarm:${alarmId}`);
  assert.ok(res.ok && res.idempotent, '重复请求命中幂等');
  const count = Object.values(state.entities.repairReportsById).filter(r => r.alarmId === alarmId).length;
  assert.equal(count, 1, '仍只有一条报修单');
});

// ---------- ② 报修单指派 → 补建工单 → 派工 ----------
test('② 指派任务：按报修单补建待派工主工单（alarm+report），回写报警关联维修单', () => {
  const alarmId = 'ALM-20260916-002';
  const reportId = state.entities.alarmEventsById[alarmId].relatedRepairReportId;
  const res = act('repair/createOrderFromReport', { reportId }, `create-order-from-report:${reportId}:v1`);
  assert.ok(res.ok, res.message);
  const orderId = res.refs.repairOrderId;
  const order = state.entities.repairOrdersById[orderId];
  assert.ok(order, '工单已落库');
  assert.equal(order.status, '待派工');
  assert.equal(order.source, 'alarm+report');
  assert.equal(order.alarmId, alarmId);
  assert.equal(order.reportId, reportId);
  assert.equal(state.entities.repairReportsById[reportId].linkedRepairOrderId, orderId);
  assert.equal(state.entities.alarmEventsById[alarmId].relatedRepairOrderId, orderId);
});

test('② 幂等：已有活动工单的报修单重复提交不重复建单', () => {
  const alarmId = 'ALM-20260916-002';
  const reportId = state.entities.alarmEventsById[alarmId].relatedRepairReportId;
  const linked = state.entities.repairReportsById[reportId].linkedRepairOrderId;
  // 重复点击（同一幂等键）→ 命中登记结果；动作层另有「已有活动工单」前置拦截
  const res = act('repair/createOrderFromReport', { reportId }, `create-order-from-report:${reportId}:v1`);
  assert.ok(res.ok && res.idempotent, '命中幂等');
  assert.equal(res.refs.repairOrderId, linked, '沿用既有工单');
  assert.equal(Object.values(state.entities.repairOrdersById).filter(o => o.reportId === reportId).length, 1, '仍只有一张工单');
});

test('② 派工：工单转为「已派工」并写入维修人 / 班组', () => {
  const alarmId = 'ALM-20260916-002';
  const orderId = state.entities.alarmEventsById[alarmId].relatedRepairOrderId;
  const res = act('repair/assign', { repairOrderId: orderId, assignee: '周强', assigneeGroup: '机修班' }, `assign:${orderId}:v1`);
  assert.ok(res.ok, res.message);
  const order = state.entities.repairOrdersById[orderId];
  assert.equal(order.status, '已派工');
  assert.equal(order.assignee, '周强');
  assert.equal(order.assigneeGroup, '机修班');
});

// ---------- ③ 转维修直接派工 ----------
test('③ 转维修指定维修人：直接生成「已派工」维修任务', () => {
  const alarmId = 'ALM-20260916-006'; // 处理中、无关联工单
  const res = act('alarm/createRepairFromAlarm', { alarmId, faultType: '其他', dispatch: { assignee: '赵强', assigneeGroup: '机修班' } }, `repair-from-alarm:${alarmId}`);
  assert.ok(res.ok, res.message);
  const orderId = res.refs.repairOrderId;
  const order = state.entities.repairOrdersById[orderId];
  assert.equal(order.status, '已派工');
  assert.equal(order.assignee, '赵强');
  assert.equal(order.source, 'alarm');
  assert.equal(state.entities.alarmEventsById[alarmId].relatedRepairOrderId, orderId);
});

// ---------- ④ 报修单取消后再指派 ----------
test('④ 取消报修（未开工工单一并取消）后，已取消报修单不能再派工，报警可重新转维修', () => {
  const alarmId = 'ALM-20260916-002';
  const reportId = state.entities.alarmEventsById[alarmId].relatedRepairReportId;
  const oldOrderId = state.entities.repairReportsById[reportId].linkedRepairOrderId;
  const res = act('repair/cancelReport', { reportId, reason: '测试取消' }, `cancel-report:${reportId}:v2`);
  assert.ok(res.ok, res.message);
  assert.equal(state.entities.repairReportsById[reportId].status, '已取消');
  assert.equal(state.entities.repairOrdersById[oldOrderId].status, '已取消', '未开工工单一并取消');
  // 已取消的报修单不能再次派工
  const res2 = act('repair/createOrderFromReport', { reportId }, `create-order-from-report:${reportId}:${oldOrderId}`);
  assert.ok(!res2.ok, '已取消的报修单不能派工');
  // 报警下已无活动工单 / 报修单 → 可重新转维修，生成新报修单
  const res3 = act('alarm/createReportFromAlarm', { alarmId, faultType: '液压' }, `report-from-alarm:${alarmId}:2`);
  assert.ok(res3.ok, res3.message);
  const newReportId = res3.refs.reportId;
  assert.notEqual(newReportId, reportId, '生成新报修单');
  assert.equal(state.entities.alarmEventsById[alarmId].relatedRepairReportId, newReportId, '报警关联报修单更新');
});

// ---------- ⑤ 维修任务页对待派工快速维修单派工 ----------
test('⑤ 快速维修任务（待派工）可在维修任务页派工', () => {
  const res = act('repair/createQuickOrder', { title: '测试快速维修', deviceId: 'DEV-001', faultDesc: '测试', level: '一般', faultType: '其他' }, `quick-create:q-${seq}`);
  assert.ok(res.ok, res.message);
  const orderId = Object.values(state.entities.repairOrdersById).find(o => o.title === '测试快速维修').repairOrderId;
  assert.equal(state.entities.repairOrdersById[orderId].status, '待派工');
  const res2 = act('repair/assign', { repairOrderId: orderId, assignee: '王强', assigneeGroup: '机修班' }, `assign:${orderId}:v1`);
  assert.ok(res2.ok, res2.message);
  assert.equal(state.entities.repairOrdersById[orderId].status, '已派工');
});

// ---------- ⑥ 业务闭环：开工 → 提交 → 验收通过 → 报警关闭 ----------
test('⑥ 转维修工单验收通过后报警联动关闭（业务闭环）', () => {
  const alarmId = 'ALM-20260916-006';
  const orderId = state.entities.alarmEventsById[alarmId].relatedRepairOrderId;
  assert.ok(act('repair/start', { repairOrderId: orderId }, `start:${orderId}:v1`).ok);
  assert.ok(act('repair/submit', { repairOrderId: orderId, measures: '更换冷却滤芯并清洗管路', verification: '冷却液温度回落至 40℃ 以下' }, `submit:${orderId}:v1`).ok);
  const res = act('repair/accept', { repairOrderId: orderId, result: '通过' }, `accept:${orderId}:v1`);
  assert.ok(res.ok, res.message);
  assert.equal(state.entities.repairOrdersById[orderId].status, '已完成');
  assert.equal(state.entities.alarmEventsById[alarmId].status, '已关闭', '报警由验收联动关闭');
});

console.log(`\n${passed} 项场景全部通过`);
