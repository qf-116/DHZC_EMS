// ============================================================
// 报警规则 M0 契约测试（纯 Node，无框架）：node tests/alarmRule.test.mjs
// 覆盖：元数据归一化 / legacy adapter / 版本号契约 / 草稿校验 / 样本判定 /
//       批量分组 / reducer 原子发布与触发门禁 / 批量幂等
// ============================================================

import assert from 'node:assert/strict';
import {
  normalizeMetricMeta, parseLegacyCondition, parseLegacyRecovery, normalizeLegacyRule,
  nextPublishVersion, validateRuleDraft, sampleTriggered, sampleRecovered,
  comboTriggered, comboRecovered, qualityTriggerHit, replayTrend,
  createEmptyRuleForm, formToRule, ruleToForm, switchRuleFormType, conditionTextOf, resolveRuleTargets,
  groupBatchTargets, batchGroupKey, ruleGroupInfo, applyBatchEditPatch,
} from '../src/domain/alarmRule.js';
import { reducer } from '../src/state/reducer.js';
import { createDemoState } from '../src/data/demo/index.js';

let passed = 0;
const test = (name, fn) => {
  try { fn(); passed += 1; console.log(`  ✓ ${name}`); }
  catch (e) { console.error(`  ✗ ${name}\n    ${e.message}`); process.exitCode = 1; }
};

// ---------- 域：元数据归一化 ----------
test('normalizeMetricMeta：中文数据类型与字符串量程归一化', () => {
  const m = normalizeMetricMeta({ metricCode: 'M.x', name: 'X', unit: '℃', dataType: '数值', precision: 0.1, range: '0 ~ 150' });
  assert.equal(m.dataType, 'number');
  assert.deepEqual(m.range, { min: 0, max: 150 });
  assert.equal(m.syncStatus, '正常');
});
test('normalizeMetricMeta：状态类与无单位归一化', () => {
  const m = normalizeMetricMeta({ metricCode: 'S.x', dataType: '状态', unit: '--', range: '运行/待机' });
  assert.equal(m.dataType, 'state');
  assert.equal(m.unit, '');
  assert.equal(m.range, null);
});

// ---------- 域：legacy adapter ----------
test('parseLegacyCondition：越上限条件解析', () => {
  const t = parseLegacyCondition({ type: '阈值', condition: '> 80℃ 持续 60s' });
  assert.equal(t.mode, 'upper');
  assert.equal(t.threshold, 80);
  assert.equal(t.unit, '℃');
  assert.equal(t.durationSec, 60);
});
test('parseLegacyCondition：区间外条件解析为 P2 模式', () => {
  const t = parseLegacyCondition({ type: '阈值', condition: '区间外 0.6 ~ 0.8 MPa 持续 30s' });
  assert.equal(t.mode, 'rangeOut');
  assert.equal(t.low, 0.6);
});
test('parseLegacyCondition：业务类规则不解析（不映射为阈值）', () => {
  assert.equal(parseLegacyCondition({ type: '程序', condition: '实际参数 ≠ 基线且超容差' }), null);
});
test('parseLegacyRecovery：回差与恢复值解析', () => {
  const r = parseLegacyRecovery({ type: '阈值', recoverCondition: '< 75℃（回差 5℃）持续 30s' });
  assert.equal(r.condition.recoveryValue, 75);
  assert.equal(r.condition.deadband, 5);
  assert.equal(r.stabilize.durationSec, 30);
});
test('normalizeLegacyRule：业务类标记 legacyOnly；阈值类补结构化字段', () => {
  const biz = normalizeLegacyRule({ code: 'R-COMPARE-001', type: '程序', status: '已发布', version: 'V2' });
  assert.equal(biz.legacyOnly, true);
  assert.equal(biz.publishedVersion, 'V2');
  const th = normalizeLegacyRule({ code: 'R-TEMP-001', type: '阈值', status: '已发布', version: 'V3', condition: '> 80℃ 持续 60s', recoverCondition: '< 75℃（回差 5℃）持续 30s' });
  assert.equal(th.triggerConfig.mode, 'upper');
  assert.equal(th.recoveryConfig.condition.deadband, 5);
  assert.equal(th.publishedVersion, 'V3');
});

// ---------- 域：版本号契约 ----------
test('nextPublishVersion：新规则首次发布 V1', () => {
  assert.equal(nextPublishVersion(null), 'V1');
});
test('nextPublishVersion：已发布规则递增', () => {
  assert.equal(nextPublishVersion('V3'), 'V4');
});

// ---------- 域：样本判定 ----------
const trig = { type: 'threshold', mode: 'upper', threshold: 80, durationSec: 60, unit: '℃' };
test('sampleTriggered：样本 0 不满足 >80℃ 不触发（阻断项 5）', () => {
  assert.equal(sampleTriggered(trig, { value: 0, qualityCode: 'GOOD' }), false);
});
test('sampleTriggered：91.8 满足 >80℃ 触发', () => {
  assert.equal(sampleTriggered(trig, { value: 91.8, qualityCode: 'GOOD' }), true);
});
test('sampleTriggered：null / BAD / OFFLINE 不触发', () => {
  assert.equal(sampleTriggered(trig, { value: null, qualityCode: 'GOOD' }), false);
  assert.equal(sampleTriggered(trig, { value: 91.8, qualityCode: 'BAD' }), false);
  assert.equal(sampleTriggered(trig, { value: 91.8, qualityCode: 'OFFLINE' }), false);
});
test('sampleRecovered：upper 恢复阈值以下恢复；BAD 不恢复', () => {
  const rc = { condition: { type: 'hysteresis', direction: 'upper', recoveryValue: 75 } };
  assert.equal(sampleRecovered(rc, { value: 70, qualityCode: 'GOOD' }), true);
  assert.equal(sampleRecovered(rc, { value: 80, qualityCode: 'GOOD' }), false);
  assert.equal(sampleRecovered(rc, { value: 70, qualityCode: 'BAD' }), false);
});

// ---------- 域：草稿校验 ----------
const ctx = (state) => ({
  devicesById: state.entities.devicesById,
  bindingsByDeviceId: state.entities.bindingsByDeviceId,
  metricsByKey: state.entities.metricsByKey,
  alarmRulesById: state.entities.alarmRulesById,
});
const baseState = createDemoState();
const validForm = (over = {}) => formToRule({
  ...createEmptyRuleForm(),
  name: '测试轴承温度超限',
  target: { deviceId: 'DEV-001', sourceId: 'iot-s-20012', metricCode: 'M.bearing_temp' },
  triggerConfig: { type: 'threshold', mode: 'upper', operator: '>', threshold: 90, unit: '℃', durationSec: 60 },
  recoveryConfig: {
    ...createEmptyRuleForm().recoveryConfig,
    condition: { type: 'hysteresis', direction: 'upper', thresholdMode: 'deadband', triggerValue: 90, recoveryValue: null, deadband: 5, unit: '℃' },
  },
  notificationConfig: { policyCode: 'NP-IMPORTANT', channels: ['站内'], receivers: ['李明'] },
}, { code: 'R-TEST-001' });

test('validateRuleDraft：完整合法草稿通过', () => {
  const res = validateRuleDraft(validForm(), ctx(baseState));
  assert.deepEqual(res.errors, []);
});
test('validateRuleDraft：缺名称被阻断', () => {
  const r = validForm(); r.name = ' ';
  const res = validateRuleDraft(r, ctx(baseState));
  assert.ok(res.errors.some((e) => e.includes('规则名称')));
});
test('validateRuleDraft：阈值超量程被阻断', () => {
  const r = validForm();
  r.triggerConfig.threshold = 999;
  const res = validateRuleDraft(r, ctx(baseState));
  assert.ok(res.errors.some((e) => e.includes('量程')));
});
test('validateRuleDraft：停用绑定设备被阻断', () => {
  const r = validForm();
  r.target = { deviceId: 'DEV-007', sourceId: 'iot-main-007', metricCode: 'M.spindle_speed' };
  r.triggerConfig = { ...r.triggerConfig, threshold: 5000, unit: 'rpm' };
  const res = validateRuleDraft(r, ctx(baseState));
  assert.ok(res.errors.some((e) => e.includes('已启用')));
});
test('validateRuleDraft：上限恢复阈值高于触发阈值被阻断', () => {
  const r = validForm();
  r.recoveryConfig.condition.deadband = -5;
  const res = validateRuleDraft(r, ctx(baseState));
  assert.ok(res.errors.some((e) => e.includes('回差')));
});
test('validateRuleDraft：缺通知接收人被阻断', () => {
  const r = validForm();
  r.notificationConfig = { policyCode: 'NP-IMPORTANT', channels: ['站内'], receivers: [] };
  const res = validateRuleDraft(r, ctx(baseState));
  assert.ok(res.errors.some((e) => e.includes('接收人')));
});

// ---------- 域：批量分组 ----------
test('groupBatchTargets：同指标不同型号拆分', () => {
  const t = (deviceModel, rangeMin, rangeMax) => ({
    metricCode: 'M.x', deviceModel, metric: { dataType: 'number', unit: '℃', range: { min: rangeMin, max: rangeMax } },
  });
  const groups = groupBatchTargets([t('A型', 0, 150), t('A型', 0, 150), t('B型', 0, 200)]);
  assert.equal(groups.length, 2);
  assert.equal(groups[0].targets.length, 2);
  assert.ok(groups[0].groupKey.includes('M.x'));
});
test('batchGroupKey：同指标同量程同型号一致', () => {
  const t = (deviceModel) => ({ metricCode: 'M.x', deviceModel, metric: { dataType: 'number', unit: '℃', range: { min: 0, max: 150 } } });
  assert.equal(batchGroupKey(t('A')), batchGroupKey(t('A')));
});

// ---------- reducer：目标解析 ----------
test('resolveRuleTargets：仅含启用绑定且勾选的有效指标（DEV-007 停用绑定被排除）', () => {
  const targets = resolveRuleTargets(baseState);
  assert.ok(targets.length > 0);
  assert.ok(targets.every((t) => t.deviceId.startsWith('DEV-')));
  assert.ok(!targets.some((t) => t.deviceId === 'DEV-007'));
  assert.ok(targets.some((t) => t.deviceId === 'DEV-001' && t.metricCode === 'M.bearing_temp'));
});

// ---------- reducer：原子发布 + 触发门禁 ----------
const lastOf = (state) => state.meta.lastAction;
const withCode = (r, code) => ({ ...r, code });

test('saveAndPublish：新规则原子发布为 V1 并写完整版本快照', () => {
  let s = baseState;
  s = reducer(s, { type: 'alarm/rule/saveAndPublish', payload: { rule: withCode(validForm(), 'R-M0-001') }, actionId: 'a1' });
  const res = lastOf(s);
  assert.equal(res.ok, true, res.message);
  const rule = s.entities.alarmRulesById['R-M0-001'];
  assert.equal(rule.status, '已发布');
  assert.equal(rule.version, 'V1');
  assert.equal(rule.publishedVersion, 'V1');
  const snap = s.entities.alarmRuleVersionsById['R-M0-001|V1'];
  assert.ok(snap, '版本快照必须存在');
  assert.equal(snap.triggerSnapshot.threshold, 90);
  assert.equal(snap.recoverySnapshot.condition.recoveryValue, 85);
  assert.equal(snap.notificationSnapshot.policyCode, 'NP-IMPORTANT');
});
test('saveAndPublish：校验失败不落库', () => {
  let s = baseState;
  const bad = withCode(validForm(), 'R-M0-BAD');
  bad.triggerConfig.threshold = 999;
  s = reducer(s, { type: 'alarm/rule/saveAndPublish', payload: { rule: bad }, actionId: 'a2' });
  assert.equal(lastOf(s).ok, false);
  assert.equal(s.entities.alarmRulesById['R-M0-BAD'], undefined);
});
test('触发门禁：草稿规则不能触发', () => {
  let s = baseState;
  s = reducer(s, { type: 'alarm/rule/saveDraft', payload: { rule: withCode(validForm(), 'R-M0-DRAFT') }, actionId: 'a3' });
  s = reducer(s, { type: 'alarm/raise', payload: { deviceId: 'DEV-001', ruleCode: 'R-M0-DRAFT', sample: { value: 95, qualityCode: 'GOOD', metricCode: 'M.bearing_temp' } }, actionId: 'a4' });
  assert.equal(lastOf(s).ok, false);
  assert.ok(lastOf(s).message.includes('草稿') || lastOf(s).message.includes('已发布'));
});
test('触发门禁：样本未满足阈值不创建事件（样本值 0 + >90℃）', () => {
  let s = baseState;
  s = reducer(s, { type: 'alarm/rule/saveAndPublish', payload: { rule: withCode(validForm(), 'R-M0-002') }, actionId: 'a5' });
  const before = Object.keys(s.entities.alarmEventsById).length;
  s = reducer(s, { type: 'alarm/raise', payload: { deviceId: 'DEV-001', ruleCode: 'R-M0-002', sample: { value: 0, qualityCode: 'GOOD', metricCode: 'M.bearing_temp' } }, actionId: 'a6' });
  assert.equal(lastOf(s).ok, false);
  assert.equal(Object.keys(s.entities.alarmEventsById).length, before);
});
test('触发门禁：无启用绑定设备不能触发', () => {
  let s = baseState;
  s = reducer(s, { type: 'alarm/raise', payload: { deviceId: 'DEV-008', ruleCode: 'R-TEMP-001', sample: { value: 91, qualityCode: 'GOOD' } }, actionId: 'a7' });
  assert.equal(lastOf(s).ok, false);
  assert.ok(lastOf(s).message.includes('绑定'));
});
test('触发门禁：满足条件的样本创建事件并记录 ruleVersion', () => {
  let s = baseState;
  s = reducer(s, { type: 'alarm/rule/saveAndPublish', payload: { rule: withCode(validForm(), 'R-M0-003') }, actionId: 'a8' });
  s = reducer(s, { type: 'alarm/raise', payload: { deviceId: 'DEV-001', ruleCode: 'R-M0-003', sample: { value: 95, qualityCode: 'GOOD', metricCode: 'M.bearing_temp' } }, actionId: 'a9' });
  const res = lastOf(s);
  assert.equal(res.ok, true, res.message);
  const evt = s.entities.alarmEventsById[res.refs.alarmId];
  assert.equal(evt.ruleVersion, 'V1');
  assert.equal(evt.deviceId, 'DEV-001');
});
test('触发门禁：停用规则不能触发', () => {
  let s = baseState;
  s = reducer(s, { type: 'alarm/rule/saveAndPublish', payload: { rule: withCode(validForm(), 'R-M0-004') }, actionId: 'b1' });
  s = reducer(s, { type: 'alarm/rule/disable', payload: { ruleCode: 'R-M0-004' }, actionId: 'b2' });
  s = reducer(s, { type: 'alarm/raise', payload: { deviceId: 'DEV-001', ruleCode: 'R-M0-004', sample: { value: 95, qualityCode: 'GOOD' } }, actionId: 'b3' });
  assert.equal(lastOf(s).ok, false);
});
test('版本契约：已发布规则存草稿不改变发布内容；再发布递增为 V2', () => {
  let s = baseState;
  s = reducer(s, { type: 'alarm/rule/saveAndPublish', payload: { rule: withCode(validForm(), 'R-M0-005') }, actionId: 'c1' });
  const snapV1 = s.entities.alarmRuleVersionsById['R-M0-005|V1'];
  const edited = withCode(validForm(), 'R-M0-005');
  edited.triggerConfig = { ...edited.triggerConfig, threshold: 100 };
  s = reducer(s, { type: 'alarm/rule/saveDraft', payload: { rule: edited }, actionId: 'c2' });
  let rule = s.entities.alarmRulesById['R-M0-005'];
  assert.equal(rule.status, '已发布', '已发布规则保存草稿后状态不变');
  assert.equal(rule.triggerConfig.threshold, 90, '当前发布内容不被草稿覆盖');
  assert.equal(rule.draftConfig.triggerConfig.threshold, 100, '草稿独立保存');
  assert.equal(s.entities.alarmRuleVersionsById['R-M0-005|V1'], snapV1, '版本快照不变');
  s = reducer(s, { type: 'alarm/rule/publish', payload: { ruleCode: 'R-M0-005' }, actionId: 'c3' });
  assert.equal(lastOf(s).ok, true, lastOf(s).message);
  rule = s.entities.alarmRulesById['R-M0-005'];
  assert.equal(rule.version, 'V2');
  assert.equal(rule.triggerConfig.threshold, 100);
  assert.equal(rule.draftConfig, null);
  assert.ok(s.entities.alarmRuleVersionsById['R-M0-005|V2']);
  assert.equal(s.entities.alarmRuleVersionsById['R-M0-005|V1'].triggerSnapshot.threshold, 90, 'V1 快照不可变');
});
test('版本契约：新规则草稿保存不消耗版本号', () => {
  let s = baseState;
  s = reducer(s, { type: 'alarm/rule/saveDraft', payload: { rule: withCode(validForm(), 'R-M0-D2') }, actionId: 'd1' });
  const rule = s.entities.alarmRulesById['R-M0-D2'];
  assert.equal(rule.status, '草稿');
  assert.equal(rule.publishedVersion || null, null);
});

// ---------- reducer：批量提交（M3-M4 契约） ----------
const batchRequest = (deviceIds, over = {}) => ({
  metricCode: 'M.bearing_temp',
  severity: '重要',
  triggerConfig: { type: 'threshold', mode: 'upper', threshold: 90, unit: '℃', durationSec: 60 },
  recoveryConfig: {
    mode: 'auto', closeMode: 'auto',
    condition: { type: 'hysteresis', direction: 'upper', thresholdMode: 'deadband', triggerValue: 90, recoveryValue: 85, deadband: 5, unit: '℃' },
    stabilize: { durationSec: 30, qualityRequired: 'GOOD', invalidDataPolicy: 'hold', rebreachPolicy: 'resetTimer' },
    notifyOnRecover: true,
  },
  notificationConfig: { policyCode: 'NP-IMPORTANT', channels: ['站内'], receivers: ['李明'] },
  targets: deviceIds.map((deviceId) => {
    const t = resolveRuleTargets(baseState).find((x) => x.deviceId === deviceId && x.metricCode === 'M.bearing_temp');
    return t;
  }).filter(Boolean),
  ...over,
});

test('batchCommit：逐目标生成独立草稿，结果计数正确', () => {
  let s = baseState;
  const req = batchRequest(['DEV-001', 'DEV-004']);
  assert.equal(req.targets.length, 2, 'DEV-001/DEV-004 均有启用轴承温度目标');
  s = reducer(s, { type: 'alarm/rule/batchCommit', payload: { request: req, batchId: 'BATCH-T1', clientRequestId: 'crq-1', batchName: '轴承温度批量' }, actionId: 'e1' });
  const res = lastOf(s);
  assert.equal(res.ok, true, res.message);
  const batch = s.entities.alarmBatchesById['BATCH-T1'];
  assert.ok(batch, '批次实体已写入');
  assert.equal(batch.result.created, 2);
  assert.equal(batch.result.skipped, 0);
  const codes = batch.rows.map((r) => r.ruleCode).filter(Boolean);
  assert.equal(codes.length, 2);
  codes.forEach((code) => {
    const rule = s.entities.alarmRulesById[code];
    assert.equal(rule.status, '草稿');
    assert.equal(rule.type, '阈值');
    assert.equal(rule.batchId, 'BATCH-T1');
    assert.ok(rule.target.deviceId === 'DEV-001' || rule.target.deviceId === 'DEV-004');
  });
  assert.notEqual(codes[0], codes[1], '每条规则独立 code');
});
test('batchCommit：已有已发布同指标规则的目标跳过（R-TEMP-001 覆盖主轴温度）', () => {
  let s = baseState;
  const req = batchRequest(['DEV-001', 'DEV-004']);
  req.metricCode = 'M.spindle_temp';
  req.targets = resolveRuleTargets(baseState).filter((x) => x.metricCode === 'M.spindle_temp' && ['DEV-001', 'DEV-004'].includes(x.deviceId));
  s = reducer(s, { type: 'alarm/rule/batchCommit', payload: { request: req, batchId: 'BATCH-T2', clientRequestId: 'crq-2', batchName: '主轴温度批量' }, actionId: 'e2' });
  const batch = s.entities.alarmBatchesById['BATCH-T2'];
  assert.equal(batch.result.created, 0);
  assert.equal(batch.result.skipped, 2);
});
test('batchCommit：重复 clientRequestId 幂等，不重复生成', () => {
  let s = baseState;
  const req = batchRequest(['DEV-001', 'DEV-004']);
  const act1 = { type: 'alarm/rule/batchCommit', payload: { request: req, batchId: 'BATCH-T3', clientRequestId: 'crq-dup', batchName: '幂等测试' }, actionId: 'e3', idempotencyKey: 'batch-commit:crq-dup' };
  s = reducer(s, act1);
  const first = lastOf(s);
  assert.equal(first.ok, true);
  const countAfterFirst = Object.keys(s.entities.alarmRulesById).length;
  s = reducer(s, { ...act1, actionId: 'e4' });
  const second = lastOf(s);
  assert.equal(second.ok, true);
  assert.equal(second.idempotent, true, '重复请求必须命中幂等登记');
  assert.equal(Object.keys(s.entities.alarmRulesById).length, countAfterFirst, '规则数量不变');
});
test('batchCommit：批量草稿未发布不能触发', () => {
  let s = baseState;
  const req = batchRequest(['DEV-001']);
  req.targets = req.targets.slice(0, 1);
  s = reducer(s, { type: 'alarm/rule/batchCommit', payload: { request: req, batchId: 'BATCH-T4', clientRequestId: 'crq-4', batchName: '未发布触发测试' }, actionId: 'e5' });
  const batch = s.entities.alarmBatchesById['BATCH-T4'];
  const code = batch.rows.find((r) => r.ruleCode)?.ruleCode;
  s = reducer(s, { type: 'alarm/raise', payload: { deviceId: 'DEV-001', ruleCode: code, sample: { value: 95, qualityCode: 'GOOD' } }, actionId: 'e6' });
  assert.equal(lastOf(s).ok, false);
});

// ---------- reducer：单动作单 tick ----------
test('单动作单 tick：一次用户动作 tick 只 +1', () => {
  let s = baseState;
  const t0 = s.meta.tick || 0;
  s = reducer(s, { type: 'alarm/rule/saveDraft', payload: { rule: withCode(validForm(), 'R-M0-TICK') }, actionId: 'f1' });
  assert.equal((s.meta.tick || 0) - t0, 1);
});

// ---------- 表单模型 ----------
test('ruleToForm：结构化规则完整回填，formToRule 往返一致', () => {
  const rule = withCode(validForm(), 'R-RT-1');
  rule.triggerConfig = { type: 'threshold', mode: 'lower', operator: '<', threshold: 0.15, unit: 'MPa', durationSec: 30 };
  rule.recoveryConfig = {
    mode: 'auto', closeMode: 'auto',
    condition: { type: 'hysteresis', direction: 'lower', thresholdMode: 'deadband', triggerValue: 0.15, recoveryValue: 0.17, deadband: 0.02, unit: 'MPa' },
    stabilize: { durationSec: 20, qualityRequired: 'GOOD', invalidDataPolicy: 'hold', rebreachPolicy: 'resetTimer' },
    notifyOnRecover: true,
  };
  rule.target = { deviceId: 'DEV-004', sourceId: 'iot-main-004', metricCode: 'M.oil_pressure' };
  const form = ruleToForm(rule);
  assert.equal(form.triggerConfig.mode, 'lower');
  assert.equal(form.triggerConfig.threshold, 0.15);
  assert.equal(form.triggerConfig.durationSec, 30);
  assert.equal(form.target.metricCode, 'M.oil_pressure');
  assert.equal(form.recoveryConfig.condition.deadband, 0.02);
  assert.equal(form.recoveryConfig.stabilize.durationSec, 20);
  const rebuilt = formToRule(form, { code: 'R-RT-1' });
  assert.equal(rebuilt.triggerConfig.threshold, 0.15);
  assert.equal(rebuilt.recoveryConfig.condition.recoveryValue, 0.17, 'deadband 保存时固化恢复值 0.15 + 0.02');
  assert.equal(rebuilt.condition, '< 0.15MPa 持续 30s');
});
test('ruleToForm：legacy 阈值规则经 adapter 回填触发与恢复', () => {
  const legacy = normalizeLegacyRule({
    code: 'R-TEMP-001', type: '阈值', status: '已发布', version: 'V3',
    condition: '> 80℃ 持续 60s', recoverCondition: '< 75℃（回差 5℃）持续 30s',
  });
  const form = ruleToForm(legacy);
  assert.equal(form.triggerConfig.mode, 'upper');
  assert.equal(form.triggerConfig.threshold, 80);
  assert.equal(form.recoveryConfig.condition.deadband, 5);
});
test('formToRule：deadband 模式保存时固化恢复值并生成展示文本', () => {
  const form = createEmptyRuleForm();
  form.name = '固化测试';
  form.triggerConfig = { type: 'threshold', mode: 'upper', operator: '>', threshold: 80, unit: '℃', durationSec: 60 };
  form.recoveryConfig.condition = { type: 'hysteresis', direction: 'upper', thresholdMode: 'deadband', triggerValue: 80, recoveryValue: null, deadband: 5, unit: '℃' };
  const rule = formToRule(form);
  assert.equal(rule.recoveryConfig.condition.recoveryValue, 75);
  assert.equal(rule.condition, '> 80℃ 持续 60s');
  assert.equal(rule.recovery, '自动恢复：<= 75℃ 持续 30s');
});
test('conditionTextOf：lower 模式展示 <', () => {
  assert.equal(conditionTextOf({ type: 'threshold', mode: 'lower', threshold: 0.15, unit: 'MPa', durationSec: 30 }), '< 0.15MPa 持续 30s');
});

// ---------- P2-A：区间规则 ----------
const rangeTrigger = { type: 'threshold', mode: 'rangeOut', low: 0.6, high: 0.8, unit: 'MPa', durationSec: 30 };
test('sampleTriggered：区间外两侧触发、带内不触发', () => {
  assert.equal(sampleTriggered(rangeTrigger, { value: 0.5, qualityCode: 'GOOD' }), true);
  assert.equal(sampleTriggered(rangeTrigger, { value: 0.9, qualityCode: 'GOOD' }), true);
  assert.equal(sampleTriggered(rangeTrigger, { value: 0.7, qualityCode: 'GOOD' }), false);
});
const rangeRecovery = { condition: { type: 'range', recoveryLow: 0.65, recoveryHigh: 0.75, unit: 'MPa' } };
test('sampleRecovered：区间恢复带内恢复、带外保持', () => {
  assert.equal(sampleRecovered(rangeRecovery, { value: 0.7, qualityCode: 'GOOD' }), true);
  assert.equal(sampleRecovered(rangeRecovery, { value: 0.62, qualityCode: 'GOOD' }), false);
  assert.equal(sampleRecovered(rangeRecovery, { value: 0.7, qualityCode: 'BAD' }), false);
});
test('formToRule：区间规则按独立回差固化恢复带', () => {
  const form = switchRuleFormType(createEmptyRuleForm(), 'threshold');
  form.name = '区间固化测试';
  form.target = { deviceId: 'DEV-006', sourceId: 'iot-main-006', metricCode: 'M.air_pressure' };
  form.triggerConfig = { type: 'threshold', mode: 'rangeOut', low: 0.6, high: 0.8, unit: 'MPa', durationSec: 30 };
  form.recoveryConfig.condition = { type: 'range', lowDeadband: 0.05, highDeadband: 0.05, unit: 'MPa' };
  form.notificationConfig = { policyCode: 'NP-GENERAL', channels: ['站内'], receivers: ['李明'] };
  const rule = formToRule(form, { code: 'R-RANGE-1' });
  assert.equal(rule.recoveryConfig.condition.recoveryLow, 0.65);
  assert.equal(rule.recoveryConfig.condition.recoveryHigh, 0.75);
  const res = validateRuleDraft(rule, ctx(baseState));
  assert.deepEqual(res.errors, [], res.errors.join(';'));
});
test('validateRuleDraft：区间上下限反转被阻断', () => {
  const form = switchRuleFormType(createEmptyRuleForm(), 'threshold');
  form.name = '区间反转测试';
  form.target = { deviceId: 'DEV-006', sourceId: 'iot-main-006', metricCode: 'M.air_pressure' };
  form.triggerConfig = { type: 'threshold', mode: 'rangeOut', low: 0.8, high: 0.6, unit: 'MPa', durationSec: 30 };
  form.recoveryConfig.condition = { type: 'range', recoveryLow: 0.65, recoveryHigh: 0.75, unit: 'MPa' };
  form.notificationConfig = { policyCode: 'NP-GENERAL', channels: ['站内'], receivers: ['李明'] };
  const res = validateRuleDraft(formToRule(form, { code: 'R-RANGE-2' }), ctx(baseState));
  assert.ok(res.errors.some((e) => e.includes('下限必须小于上限')));
});

// ---------- P2-A：状态规则 ----------
const stateTrigger = { type: 'state', abnormalValues: ['故障', '急停'], normalValues: ['运行', '待机'], durationSec: 0 };
test('sampleTriggered：状态枚举命中触发、正常态不触发', () => {
  assert.equal(sampleTriggered(stateTrigger, { value: '故障', qualityCode: 'GOOD' }), true);
  assert.equal(sampleTriggered(stateTrigger, { value: '运行', qualityCode: 'GOOD' }), false);
});
test('sampleRecovered：状态回到正常枚举恢复', () => {
  const rc = { condition: { type: 'state', normalValues: ['运行', '待机'] } };
  assert.equal(sampleRecovered(rc, { value: '运行', qualityCode: 'GOOD' }), true);
  assert.equal(sampleRecovered(rc, { value: '故障', qualityCode: 'GOOD' }), false);
});
test('validateRuleDraft：状态枚举为空 / 重叠被阻断', () => {
  const form = switchRuleFormType(createEmptyRuleForm(), 'state');
  form.name = '状态测试';
  form.target = { deviceId: 'DEV-001', sourceId: 'iot-main-001', metricCode: 'S.machine_state' };
  form.triggerConfig = { type: 'state', abnormalValues: ['故障', '运行'], normalValues: ['运行', '待机'], durationSec: 0 };
  form.notificationConfig = { policyCode: 'NP-URGENT', channels: ['站内'], receivers: ['李明'] };
  const res = validateRuleDraft(formToRule(form, { code: 'R-STATE-T1' }), ctx(baseState));
  assert.ok(res.errors.some((e) => e.includes('重叠')));
  const form2 = switchRuleFormType(createEmptyRuleForm(), 'state');
  form2.name = '状态空枚举测试';
  form2.target = form.target;
  form2.triggerConfig = { type: 'state', abnormalValues: [], normalValues: [], durationSec: 0 };
  form2.notificationConfig = form.notificationConfig;
  const res2 = validateRuleDraft(formToRule(form2, { code: 'R-STATE-T2' }), ctx(baseState));
  assert.ok(res2.errors.some((e) => e.includes('异常状态枚举')));
});
test('validateRuleDraft：状态规则用于数值指标被阻断', () => {
  const form = switchRuleFormType(createEmptyRuleForm(), 'state');
  form.name = '状态类型不匹配';
  form.target = { deviceId: 'DEV-001', sourceId: 'iot-main-001', metricCode: 'M.spindle_temp' };
  form.triggerConfig = { type: 'state', abnormalValues: ['故障'], normalValues: ['运行'], durationSec: 0 };
  form.notificationConfig = { policyCode: 'NP-URGENT', channels: ['站内'], receivers: ['李明'] };
  const res = validateRuleDraft(formToRule(form, { code: 'R-STATE-T3' }), ctx(baseState));
  assert.ok(res.errors.some((e) => e.includes('状态类')));
});

// ---------- P2-A：质量规则 ----------
test('qualityTriggerHit：中断 / 延迟 / 无效率模式', () => {
  assert.equal(qualityTriggerHit({ type: 'quality', mode: 'outage' }, { status: '数据中断' }), true);
  assert.equal(qualityTriggerHit({ type: 'quality', mode: 'outage' }, { status: '正常' }), false);
  assert.equal(qualityTriggerHit({ type: 'quality', mode: 'delay', delaySec: 30 }, { status: '延迟', latencySec: 32 }), true);
  assert.equal(qualityTriggerHit({ type: 'quality', mode: 'delay', delaySec: 30 }, { status: '延迟', latencySec: 5 }), false);
  assert.equal(qualityTriggerHit({ type: 'quality', mode: 'invalidRate', invalidRatePercent: 5 }, { status: '正常', qualityRate: '94.00%' }), true);
});
test('validateRuleDraft：质量规则缺模式参数被阻断', () => {
  const form = switchRuleFormType(createEmptyRuleForm(), 'quality');
  form.name = '质量参数缺失';
  form.target = { deviceId: 'DEV-001', sourceId: null, metricCode: null };
  form.triggerConfig = { type: 'quality', mode: 'delay', durationMin: 5, delaySec: null };
  form.notificationConfig = { policyCode: 'NP-GENERAL', channels: ['站内'], receivers: ['李明'] };
  const res = validateRuleDraft(formToRule(form, { code: 'R-QUAL-T1' }), ctx(baseState));
  assert.ok(res.errors.some((e) => e.includes('延迟')));
});
test('parseLegacyCondition：旧状态 / 质量规则解析为结构化触发', () => {
  const s = parseLegacyCondition({ type: '状态', condition: '状态 = 故障 立即触发' });
  assert.equal(s.type, 'state');
  assert.deepEqual(s.abnormalValues, ['故障']);
  const q = parseLegacyCondition({ type: '质量', condition: '延迟 > 30s 持续 60s' });
  assert.equal(q.type, 'quality');
  assert.equal(q.mode, 'delay');
  assert.equal(q.delaySec, 30);
});

// ---------- P2-A：组合规则 ----------
const comboCfg = {
  type: 'combo', operator: 'AND', windowSec: 300,
  conditions: [
    { target: { deviceId: 'DEV-001', sourceId: 'iot-main-001', metricCode: 'M.spindle_temp' }, operator: '>', value: 80, durationSec: 60 },
    { target: { deviceId: 'DEV-001', sourceId: 'iot-main-001', metricCode: 'M.coolant_temp' }, operator: '>', value: 42, durationSec: 60 },
  ],
};
const comboSamples = (t1, t2) => ([
  { deviceId: 'DEV-001', metricCode: 'M.spindle_temp', sample: { value: t1, qualityCode: 'GOOD' } },
  { deviceId: 'DEV-001', metricCode: 'M.coolant_temp', sample: { value: t2, qualityCode: 'GOOD' } },
]);
test('comboTriggered：AND 全满足触发；缺样本返回 null', () => {
  assert.equal(comboTriggered(comboCfg, comboSamples(90, 44)), true);
  assert.equal(comboTriggered(comboCfg, comboSamples(90, 30)), false);
  assert.equal(comboTriggered(comboCfg, [comboSamples(90, 44)[0]]), null);
});
test('comboTriggered：OR 任一满足触发', () => {
  assert.equal(comboTriggered({ ...comboCfg, operator: 'OR' }, comboSamples(90, 30)), true);
});
test('comboRecovered：全部子条件退出触发态才恢复', () => {
  assert.equal(comboRecovered(comboCfg, comboSamples(70, 30)), true);
  assert.equal(comboRecovered(comboCfg, comboSamples(90, 30)), false);
});
test('validateRuleDraft：组合规则少于 2 个子条件被阻断', () => {
  const form = switchRuleFormType(createEmptyRuleForm(), 'combo');
  form.name = '组合条件不足';
  form.triggerConfig = { type: 'combo', operator: 'AND', windowSec: 300, conditions: [comboCfg.conditions[0]] };
  form.notificationConfig = { policyCode: 'NP-IMPORTANT', channels: ['站内'], receivers: ['李明'] };
  const res = validateRuleDraft(formToRule(form, { code: 'R-COMBO-T1' }), ctx(baseState));
  assert.ok(res.errors.some((e) => e.includes('至少需要 2 个子条件')));
});

// ---------- P2-D：历史趋势回测 ----------
test('replayTrend：按持续时长与抑制口径真实回放', () => {
  // 12 点逐 60s：8 个命中点（含 2 点回落打断），durationSec=0 → 每 1 点即事件
  const trig = { type: 'threshold', mode: 'upper', threshold: 80, durationSec: 0 };
  const r = replayTrend(trig, [90, 91, 70, 92, 93, 94, 95, 96, 97, 98, 99, 100]);
  assert.equal(r.hits, 11);
  assert.equal(r.events, 2, '两段连续超限各生成 1 条事件');
  assert.equal(r.suppressed, 9, '活动事件期间的命中计为抑制');
});
test('replayTrend：持续时间不足不生成事件', () => {
  const trig = { type: 'threshold', mode: 'upper', threshold: 80, durationSec: 180 };
  const r = replayTrend(trig, [90, 91, 70, 92, 93]);
  assert.equal(r.events, 0);
  assert.equal(r.dataStatus, '已按当前配置回放');
});
test('replayTrend：无趋势数据明确标注', () => {
  const r = replayTrend({ type: 'threshold', mode: 'upper', threshold: 80, durationSec: 0 }, []);
  assert.equal(r.dataStatus, '无历史趋势数据');
});

// ---------- P2-A：reducer 全类型触发门禁 ----------
test('触发门禁：状态规则样本不在异常枚举不触发；命中触发', () => {
  let s = baseState;
  const form = switchRuleFormType(createEmptyRuleForm(), 'state');
  form.name = 'DEV-001 故障立即报警';
  form.target = { deviceId: 'DEV-001', sourceId: 'iot-main-001', metricCode: 'S.machine_state' };
  form.triggerConfig = { type: 'state', abnormalValues: ['故障'], normalValues: ['运行', '待机'], durationSec: 0 };
  form.recoveryConfig = { mode: 'auto', closeMode: 'auto', condition: { type: 'state', normalValues: ['运行', '待机'] }, stabilize: { durationSec: 0, qualityRequired: 'GOOD', invalidDataPolicy: 'hold', rebreachPolicy: 'resetTimer' }, notifyOnRecover: true };
  form.notificationConfig = { policyCode: 'NP-URGENT', channels: ['站内'], receivers: ['李明'] };
  s = reducer(s, { type: 'alarm/rule/saveAndPublish', payload: { rule: formToRule(form, { code: 'R-P2-STATE' }) }, actionId: 'p2s1' });
  assert.equal(lastOf(s).ok, true, lastOf(s).message);
  const before = Object.keys(s.entities.alarmEventsById).length;
  s = reducer(s, { type: 'alarm/raise', payload: { deviceId: 'DEV-001', ruleCode: 'R-P2-STATE', sample: { value: '运行', qualityCode: 'GOOD', metricCode: 'S.machine_state' } }, actionId: 'p2s2' });
  assert.equal(lastOf(s).ok, false, '正常态不能触发');
  s = reducer(s, { type: 'alarm/raise', payload: { deviceId: 'DEV-001', ruleCode: 'R-P2-STATE', sample: { value: '故障', qualityCode: 'GOOD', metricCode: 'S.machine_state' } }, actionId: 'p2s3' });
  assert.equal(lastOf(s).ok, true, lastOf(s).message);
  assert.equal(Object.keys(s.entities.alarmEventsById).length, before + 1);
});
test('触发门禁：质量规则按通信健康事实判定（目标一致 + 延迟阈值）', () => {
  let s = baseState;
  const form = switchRuleFormType(createEmptyRuleForm(), 'quality');
  form.name = 'DEV-002 采集延迟质量报警';
  form.target = { deviceId: 'DEV-002', sourceId: null, metricCode: null };
  form.triggerConfig = { type: 'quality', mode: 'delay', durationMin: 1, delaySec: 30 };
  form.notificationConfig = { policyCode: 'NP-GENERAL', channels: ['站内'], receivers: ['李明'] };
  s = reducer(s, { type: 'alarm/rule/saveAndPublish', payload: { rule: formToRule(form, { code: 'R-P2-QUAL' }) }, actionId: 'p2q1' });
  assert.equal(lastOf(s).ok, true, lastOf(s).message);
  // 目标一致性：规则绑定 DEV-002，不能用于 DEV-001
  s = reducer(s, { type: 'alarm/raise', payload: { deviceId: 'DEV-001', ruleCode: 'R-P2-QUAL' }, actionId: 'p2q2' });
  assert.equal(lastOf(s).ok, false, '目标不一致不能触发');
  // DEV-002 延迟 32s > 30s → 触发
  s = reducer(s, { type: 'alarm/raise', payload: { deviceId: 'DEV-002', ruleCode: 'R-P2-QUAL' }, actionId: 'p2q3' });
  assert.equal(lastOf(s).ok, true, lastOf(s).message);
});
test('触发门禁：组合规则 AND 全满足触发、部分满足不触发', () => {
  let s = baseState;
  const form = switchRuleFormType(createEmptyRuleForm(), 'combo');
  form.name = '主轴高温且冷却液高温组合';
  form.target = { deviceId: 'DEV-001', sourceId: 'iot-main-001', metricCode: 'M.spindle_temp' };
  form.triggerConfig = comboCfg;
  form.notificationConfig = { policyCode: 'NP-IMPORTANT', channels: ['站内'], receivers: ['李明'] };
  s = reducer(s, { type: 'alarm/rule/saveAndPublish', payload: { rule: formToRule(form, { code: 'R-P2-COMBO' }) }, actionId: 'p2c1' });
  assert.equal(lastOf(s).ok, true, lastOf(s).message);
  const before = Object.keys(s.entities.alarmEventsById).length;
  s = reducer(s, { type: 'alarm/raise', payload: { deviceId: 'DEV-001', ruleCode: 'R-P2-COMBO', conditionSamples: [comboSamples(90, 30)[0]] }, actionId: 'p2c2' });
  assert.equal(lastOf(s).ok, false, '缺少子条件样本不能触发');
  s = reducer(s, { type: 'alarm/raise', payload: { deviceId: 'DEV-001', ruleCode: 'R-P2-COMBO', conditionSamples: comboSamples(90, 30) }, actionId: 'p2c3' });
  assert.equal(lastOf(s).ok, false, 'AND 部分满足不触发');
  s = reducer(s, { type: 'alarm/raise', payload: { deviceId: 'DEV-001', ruleCode: 'R-P2-COMBO', conditionSamples: comboSamples(90, 44) }, actionId: 'p2c4' });
  assert.equal(lastOf(s).ok, true, lastOf(s).message);
  assert.equal(Object.keys(s.entities.alarmEventsById).length, before + 1);
});

// ---------- P2-C：批量发布 ----------
const publishableBatch = () => {
  let s = baseState;
  const req = batchRequest(['DEV-004']);
  req.targets = req.targets.slice(0, 1);
  s = reducer(s, { type: 'alarm/rule/batchCommit', payload: { request: req, batchId: 'BATCH-P2P', clientRequestId: 'crq-p2p', batchName: '批量发布测试' }, actionId: 'g1' });
  return { s, batchId: 'BATCH-P2P' };
};
test('batchPublish：批次内草稿逐条发布，各自独立版本快照', () => {
  let { s, batchId } = publishableBatch();
  s = reducer(s, { type: 'alarm/rule/batchPublish', payload: { batchId }, actionId: 'g2' });
  const res = lastOf(s);
  assert.equal(res.ok, true, res.message);
  assert.equal(res.refs.published, 1);
  const batch = s.entities.alarmBatchesById[batchId];
  assert.equal(batch.status, '已发布');
  const rule = Object.values(s.entities.alarmRulesById).find((r) => r.batchId === batchId);
  assert.equal(rule.status, '已发布');
  assert.equal(rule.version, 'V1');
  assert.ok(s.entities.alarmRuleVersionsById[`${rule.code}|V1`].triggerSnapshot);
  // 幂等：重复发布忽略
  s = reducer(s, { type: 'alarm/rule/batchPublish', payload: { batchId }, actionId: 'g3' });
  assert.equal(lastOf(s).idempotent, true);
});
test('batchPublish：校验失败条目不发布，部分成功保留原因', () => {
  let s = baseState;
  // 真实路径建批次（1 条合法草稿），再追加 1 条不合法草稿挂到同批次（阈值超量程）
  const req = batchRequest(['DEV-004']);
  req.targets = req.targets.slice(0, 1);
  s = reducer(s, { type: 'alarm/rule/batchCommit', payload: { request: req, batchId: 'BATCH-MIX', clientRequestId: 'crq-mix', batchName: '部分成功测试' }, actionId: 'g4' });
  assert.equal(lastOf(s).refs.created, 1);
  const badRule = withCode(validForm(), 'R-P2-BAD');
  badRule.triggerConfig = { ...badRule.triggerConfig, threshold: 999 };
  badRule.batchId = 'BATCH-MIX';
  s = reducer(s, { type: 'alarm/rule/saveDraft', payload: { rule: badRule }, actionId: 'g5' });
  s = reducer(s, { type: 'alarm/rule/batchPublish', payload: { batchId: 'BATCH-MIX' }, actionId: 'g6' });
  const res = lastOf(s);
  assert.equal(res.ok, true, '部分成功仍返回成功');
  assert.equal(res.refs.published, 1);
  assert.equal(res.refs.failed, 1);
  const batch = s.entities.alarmBatchesById['BATCH-MIX'];
  assert.equal(batch.status, '部分发布');
  assert.equal(batch.publishResult.failures[0].ruleCode, 'R-P2-BAD');
});

// ---------- P2-C：模板持久化 ----------
test('template/save + delete：模板实体真实落库与删除', () => {
  let s = baseState;
  const tpl = {
    name: 'P2 测试模板',
    metricType: '温度类',
    applicableMetricCodes: ['M.bearing_temp'],
    status: '启用',
    triggerConfig: { type: 'threshold', mode: 'upper', threshold: 90, unit: '℃', durationSec: 60 },
    recoveryConfig: { mode: 'auto', closeMode: 'auto', condition: { type: 'hysteresis', direction: 'upper', thresholdMode: 'deadband', deadband: 5, unit: '℃' }, stabilize: { durationSec: 30, qualityRequired: 'GOOD', invalidDataPolicy: 'hold', rebreachPolicy: 'resetTimer' }, notifyOnRecover: true },
    notificationConfig: { policyCode: 'NP-IMPORTANT', channels: ['站内'], receivers: ['李明'] },
  };
  s = reducer(s, { type: 'alarm/template/save', payload: { template: tpl }, actionId: 'h1' });
  const res = lastOf(s);
  assert.equal(res.ok, true, res.message);
  const id = res.refs.templateId;
  assert.ok(s.entities.ruleTemplatesById[id], '模板已入库');
  // 应用模板 → 批量生成草稿并回填 templateId
  const targets = resolveRuleTargets(s).filter((t) => t.deviceId === 'DEV-004' && t.metricCode === 'M.bearing_temp');
  s = reducer(s, {
    type: 'alarm/rule/batchCommit',
    payload: {
      request: { metricCode: 'M.bearing_temp', triggerConfig: tpl.triggerConfig, recoveryConfig: tpl.recoveryConfig, notificationConfig: tpl.notificationConfig, templateId: id, targets },
      batchId: 'BATCH-TPL', clientRequestId: 'crq-tpl', batchName: '模板应用测试',
    },
    actionId: 'h2',
  });
  const batch = s.entities.alarmBatchesById['BATCH-TPL'];
  assert.equal(batch.result.created, 1);
  const draft = Object.values(s.entities.alarmRulesById).find((r) => r.batchId === 'BATCH-TPL');
  assert.equal(draft.templateId, id, '草稿回填模板引用');
  // 删除模板不影响已发布规则与草稿
  s = reducer(s, { type: 'alarm/template/delete', payload: { templateId: id }, actionId: 'h3' });
  assert.equal(lastOf(s).ok, true);
  assert.equal(s.entities.ruleTemplatesById[id], undefined);
  assert.ok(s.entities.alarmRulesById[draft.code], '已生成草稿不受模板删除影响');
});

// ---------- P2-D：版本回滚 ----------
test('rollback：按历史快照内容发布为新版本，历史快照不变', () => {
  let s = baseState;
  const r1 = withCode(validForm(), 'R-P2-RB');
  r1.triggerConfig = { ...r1.triggerConfig, threshold: 90 };
  s = reducer(s, { type: 'alarm/rule/saveAndPublish', payload: { rule: r1 }, actionId: 'k1' });
  const r2 = withCode(validForm(), 'R-P2-RB');
  r2.triggerConfig = { ...r2.triggerConfig, threshold: 100 };
  s = reducer(s, { type: 'alarm/rule/saveAndPublish', payload: { rule: r2 }, actionId: 'k2' });
  assert.equal(s.entities.alarmRulesById['R-P2-RB'].version, 'V2');
  const snapV1 = s.entities.alarmRuleVersionsById['R-P2-RB|V1'];
  s = reducer(s, { type: 'alarm/rule/rollback', payload: { ruleCode: 'R-P2-RB', version: 'V1' }, actionId: 'k3' });
  const res = lastOf(s);
  assert.equal(res.ok, true, res.message);
  const rule = s.entities.alarmRulesById['R-P2-RB'];
  assert.equal(rule.version, 'V3', '回滚 = 发布新版本 V3');
  assert.equal(rule.triggerConfig.threshold, 90, '内容回到 V1 快照');
  assert.equal(s.entities.alarmRuleVersionsById['R-P2-RB|V1'].triggerSnapshot.threshold, 90, 'V1 快照不变');
  assert.equal(s.entities.alarmRuleVersionsById['R-P2-RB|V2'].triggerSnapshot.threshold, 100, 'V2 快照不变');
  assert.ok(s.entities.alarmRuleVersionsById['R-P2-RB|V3'], 'V3 快照已写入');
});
test('rollback：旧结构快照（无结构化触发配置）明确不可回滚', () => {
  let s = baseState;
  s = reducer(s, { type: 'alarm/rule/rollback', payload: { ruleCode: 'R-TEMP-001', version: 'V2' }, actionId: 'k4' });
  assert.equal(lastOf(s).ok, false);
  assert.ok(lastOf(s).message.includes('不支持') || lastOf(s).message.includes('快照'));
});
test('rollback：当前版本无需回滚被拦截', () => {
  let s = baseState;
  s = reducer(s, { type: 'alarm/rule/rollback', payload: { ruleCode: 'R-TEMP-001', version: 'V3' }, actionId: 'k5' });
  assert.equal(lastOf(s).ok, false);
});

// ---------- P2：分组列 + 同分组批量编辑 ----------
test('ruleGroupInfo：同设备同指标规则归入同组；无目标旧规则不分组', () => {
  const targets = resolveRuleTargets(baseState);
  const mk = (deviceId, metricCode) => ({
    code: 'R-G', type: '阈值', status: '已发布',
    target: { deviceId, metricCode },
  });
  const g1 = ruleGroupInfo(mk('DEV-001', 'M.spindle_temp'), targets);
  const g2 = ruleGroupInfo(mk('DEV-002', 'M.spindle_temp'), targets);
  const g3 = ruleGroupInfo(mk('DEV-006', 'M.air_pressure'), targets);
  assert.ok(g1 && g2 && g3);
  assert.notEqual(g1.groupKey, g3.groupKey, '不同指标不同组');
  assert.equal(ruleGroupInfo({ code: 'R-COMPARE-001', type: '程序' }, targets), null, '旧业务规则无分组');
});
test('applyBatchEditPatch：同组 upper/lower 各自应用阈值，回差/稳定/等级/通知统一更新', () => {
  const upper = normalizeLegacyRule({
    code: 'R-U', name: '上限', type: '阈值', status: '已发布', version: 'V1', severity: '一般',
    target: { deviceId: 'DEV-001', metricCode: 'M.bearing_temp' },
    triggerConfig: { type: 'threshold', mode: 'upper', threshold: 90, unit: '℃', durationSec: 60 },
    recoveryConfig: { mode: 'auto', closeMode: 'auto', condition: { type: 'hysteresis', direction: 'upper', thresholdMode: 'deadband', deadband: 5, unit: '℃' }, stabilize: { durationSec: 30, qualityRequired: 'GOOD', invalidDataPolicy: 'hold', rebreachPolicy: 'resetTimer' }, notifyOnRecover: true },
    notificationConfig: { policyCode: 'NP-IMPORTANT', channels: ['站内'], receivers: ['李明'] },
  });
  const lower = normalizeLegacyRule({
    code: 'R-L', name: '下限', type: '阈值', status: '草稿',
    target: { deviceId: 'DEV-001', metricCode: 'M.bearing_temp' },
    triggerConfig: { type: 'threshold', mode: 'lower', threshold: 10, unit: '℃', durationSec: 60 },
    recoveryConfig: { mode: 'auto', closeMode: 'auto', condition: { type: 'hysteresis', direction: 'lower', thresholdMode: 'deadband', deadband: 5, unit: '℃' }, stabilize: { durationSec: 30, qualityRequired: 'GOOD', invalidDataPolicy: 'hold', rebreachPolicy: 'resetTimer' }, notifyOnRecover: true },
  });
  const patch = { threshold: 95, durationSec: 45, deadband: 8, stabilizeSec: 40, severity: '紧急' };
  const r1 = applyBatchEditPatch(upper, patch);
  assert.ok(!r1.error, r1.error);
  assert.equal(r1.draft.triggerConfig.threshold, 95);
  assert.equal(r1.draft.triggerConfig.durationSec, 45);
  assert.equal(r1.draft.recoveryConfig.condition.deadband, 8);
  assert.equal(r1.draft.recoveryConfig.condition.recoveryValue, 87, 'deadband 固化恢复值 95-8');
  assert.equal(r1.draft.recoveryConfig.stabilize.durationSec, 40);
  assert.equal(r1.draft.severity, '紧急');
  assert.equal(r1.draft.status, '已发布', '已发布规则生成草稿不改状态');
  const r2 = applyBatchEditPatch(lower, patch);
  assert.equal(r2.draft.triggerConfig.threshold, 95, 'lower 规则同样应用统一阈值');
  assert.equal(r2.draft.recoveryConfig.condition.recoveryValue, 103, 'lower 固化 95+8');
});
test('applyBatchEditPatch：区间规则应用上下限与独立回差；留空字段不修改', () => {
  const range = {
    code: 'R-RANGE', name: '区间', type: '阈值', status: '草稿',
    target: { deviceId: 'DEV-006', metricCode: 'M.air_pressure' },
    triggerConfig: { type: 'threshold', mode: 'rangeOut', low: 0.6, high: 0.8, unit: 'MPa', durationSec: 30 },
    recoveryConfig: { mode: 'auto', closeMode: 'auto', condition: { type: 'range', lowDeadband: 0.05, highDeadband: 0.05, recoveryLow: 0.65, recoveryHigh: 0.75, unit: 'MPa' }, stabilize: { durationSec: 30, qualityRequired: 'GOOD', invalidDataPolicy: 'hold', rebreachPolicy: 'resetTimer' }, notifyOnRecover: true },
  };
  const r = applyBatchEditPatch(range, { low: 0.55, high: 0.85, deadband: 0.03 });
  assert.equal(r.draft.triggerConfig.low, 0.55);
  assert.equal(r.draft.triggerConfig.high, 0.85);
  assert.equal(r.draft.recoveryConfig.condition.recoveryLow, 0.58, '按新回差固化恢复带下限');
  assert.equal(r.draft.recoveryConfig.condition.recoveryHigh, 0.82, '按新回差固化恢复带上限');
  assert.equal(r.draft.triggerConfig.durationSec, 30, '留空的持续不修改');
  // 仅改等级
  const r2 = applyBatchEditPatch(range, { severity: '提示' });
  assert.equal(r2.draft.triggerConfig.low, 0.6, '未涉及字段不动');
  assert.equal(r2.draft.severity, '提示');
});
test('applyBatchEditPatch：旧业务规则 / 已停用规则跳过并说明', () => {
  const biz = normalizeLegacyRule({ code: 'R-COMPARE-001', type: '程序', status: '已发布' });
  assert.ok(applyBatchEditPatch(biz, { severity: '紧急' }).error.includes('不支持'));
  const stopped = { code: 'R-S', type: '阈值', status: '已停用', triggerConfig: { type: 'threshold', mode: 'upper', threshold: 1 } };
  assert.ok(applyBatchEditPatch(stopped, { severity: '紧急' }).error.includes('已停用'));
});
test('batchEdit reducer：同组勾选批量编辑 → 已发布生成草稿、草稿直改、逐条校验失败保留原因', () => {
  let s = baseState;
  const mk = (code, mode, threshold) => formToRule({
    ...createEmptyRuleForm(),
    name: `批量编辑 ${code}`,
    target: { deviceId: 'DEV-001', sourceId: 'iot-s-20012', metricCode: 'M.bearing_temp' },
    triggerConfig: { type: 'threshold', mode, operator: mode === 'lower' ? '<' : '>', threshold, unit: '℃', durationSec: 60 },
    recoveryConfig: { ...createEmptyRuleForm().recoveryConfig, condition: { type: 'hysteresis', direction: mode === 'lower' ? 'lower' : 'upper', thresholdMode: 'deadband', triggerValue: threshold, recoveryValue: null, deadband: 5, unit: '℃' } },
    notificationConfig: { policyCode: 'NP-IMPORTANT', channels: ['站内'], receivers: ['李明'] },
  }, { code });
  s = reducer(s, { type: 'alarm/rule/saveAndPublish', payload: { rule: mk('R-BE-1', 'upper', 90) }, actionId: 'm1' });
  s = reducer(s, { type: 'alarm/rule/saveDraft', payload: { rule: mk('R-BE-2', 'lower', 10) }, actionId: 'm2' });
  s = reducer(s, { type: 'alarm/rule/batchEdit', payload: { ruleCodes: ['R-BE-1', 'R-BE-2'], patch: { threshold: 95, severity: '紧急' } }, actionId: 'm3' });
  const res = lastOf(s);
  assert.equal(res.ok, true, res.message);
  assert.equal(res.refs.updated, 2);
  const r1 = s.entities.alarmRulesById['R-BE-1'];
  assert.equal(r1.status, '已发布', '已发布规则状态不变');
  assert.equal(r1.triggerConfig.threshold, 90, '当前发布内容不被覆盖');
  assert.equal(r1.draftConfig.triggerConfig.threshold, 95, '草稿独立保存');
  const r2 = s.entities.alarmRulesById['R-BE-2'];
  assert.equal(r2.triggerConfig.threshold, 95, '草稿规则直接更新');
  // 校验失败条目：阈值改到 999（超量程）→ failed 不落库
  s = reducer(s, { type: 'alarm/rule/batchEdit', payload: { ruleCodes: ['R-BE-2'], patch: { threshold: 999 } }, actionId: 'm4' });
  const res2 = lastOf(s);
  assert.equal(res2.ok, true);
  assert.equal(res2.refs.updated, 0);
  assert.equal(res2.refs.failed, 1);
  assert.ok(s.entities.alarmRulesById['R-BE-2'].triggerConfig.threshold === 95, '失败目标不落库');
});

console.log(`\n${passed} 项契约测试通过${process.exitCode ? '（存在失败）' : ''}`);
