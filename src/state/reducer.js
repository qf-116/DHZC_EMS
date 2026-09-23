// ============================================================
// DemoState reducer（§4 / §5）：共享业务事实的唯一变更入口
// —— 页面禁止直接 import 旧静态业务数组并修改数组（硬规则 3）
// —— 每个动作声明输入/前置状态/状态变化/关联实体/幂等键（硬规则 8）
// —— 演示时间确定性推进：基于 DEMO_TIME 每次动作 +7 秒，可重放
// ============================================================

import {
  canAlarmTransition, closeBlockers, ALARM_FORM_RULES,
} from '../domain/alarm.js';
import {
  validateRuleDraft, nextPublishVersion, conditionTextOf, recoveryTextOf,
  sampleTriggered, MVP_TRIGGER_MODES,
} from '../domain/alarmRule.js';
import { canRepairTransition } from '../domain/repair.js';
import { validateDowntime } from '../domain/downtime.js';
import { validateOutbound, validateReturn, outboundIdempotencyKey } from '../domain/spare.js';
import { validateBindingDraft, canTransitionBinding } from '../domain/binding.js';

// ---------- 演示时钟 ----------
const DEMO_BASE_MS = new Date('2026-09-16T16:41:08+08:00').getTime();
function fmtDemoTime(ms) {
  const d = new Date(ms);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}
function timeOnly(ts) { return typeof ts === 'string' && ts.includes(' ') ? ts.split(' ')[1] : (ts || '--'); }
function dateOnly(ts) { return typeof ts === 'string' && ts.includes(' ') ? ts.split(' ')[0] : (ts || '--'); }

// ---------- 不可变辅助 ----------
const setIn = (map, key, value) => ({ ...map, [key]: value });
const setE = (state, path, key, value) => ({ ...state, entities: { ...state.entities, [path]: setIn(state.entities[path] || {}, key, value) } });
const setEnt = (state, path, value) => ({ ...state, entities: { ...state.entities, [path]: value } });

function withMeta(state, at, extra = {}) {
  // at 由 dispatch 入口按 tick 推进；tick 写回 meta 保证演示时间确定性可重放
  return { ...state, meta: { ...state.meta, updatedAt: at, ...extra } };
}

// 记录动作结果与幂等登记
function finish(state, action, ok, message, refs = {}, idempotent = false, at) {
  const ts = at || action.at || state.meta.updatedAt;
  const record = { type: action.type, ok, idempotent, message, refs, at: ts, actionId: action.actionId };
  let next = withMeta(state, ts, { lastAction: record });
  if (action.idempotencyKey && ok && !idempotent) {
    next = setE(next, 'idempotencyByKey', action.idempotencyKey, { message, refs, at: ts });
  }
  return next;
}

// 追加业务履历
function addHistory(state, at, entityType, entityId, summary, detail = {}) {
  const id = `BH-${Object.keys(state.entities.businessHistoryById).length + 1}-${state.meta.tick || 0}`;
  const list = setIn(state.entities.businessHistoryById, id, { historyId: id, at, entityType, entityId, summary, ...detail });
  return setEnt(state, 'businessHistoryById', list);
}

function pushTimeline(order, type, actor, detail, at) {
  return { ...order, timeline: [...(order.timeline || []), { type, time: at, actor, detail }] };
}

// 校验不通过 → 不变更事实，只反馈
function reject(state, action, message, errors = []) {
  return finish(state, action, false, message, { errors }, false, action.at);
}

// 主设备当前运行状态辅助（供验收后恢复设备显示）
function deviceRunStatusAfterAccept(state, deviceId) {
  const health = state.entities.healthByDeviceId[deviceId];
  if (health && health.status === '数据中断') return '无数据';
  return '待机';
}

// 规则校验上下文（M0 契约：领域校验统一从 DemoStore 实体取事实）
function ruleContext(E) {
  return {
    devicesById: E.devicesById || {},
    bindingsByDeviceId: E.bindingsByDeviceId || {},
    metricsByKey: E.metricsByKey || {},
    alarmRulesById: E.alarmRulesById || {},
  };
}

// 写入不可变规则版本快照：兼容 AlarmRuleVersionPage 旧字段 + M2 结构化快照
function writeRuleVersionSnapshot(next, rule, version, at, actor) {
  return setE(next, 'alarmRuleVersionsById', `${rule.code}|${version}`, {
    // 兼容展示字段
    code: rule.code, name: rule.name, version, publish: at, publisher: actor.userName,
    effective: `${at} 至今`, condition: rule.condition, notify: rule.notificationConfig?.policyCode || rule.policyCode || '--',
    events: 0, status: '已发布',
    // 结构化不可变快照（历史报警解释不随规则编辑漂移）
    targetSnapshot: rule.target ? structuredClone(rule.target) : null,
    triggerSnapshot: rule.triggerConfig ? structuredClone(rule.triggerConfig) : null,
    recoverySnapshot: rule.recoveryConfig ? structuredClone(rule.recoveryConfig) : null,
    notificationSnapshot: rule.notificationConfig ? structuredClone(rule.notificationConfig) : null,
    suppressionSnapshot: rule.suppressionConfig ? structuredClone(rule.suppressionConfig) : null,
    stormSnapshot: rule.stormConfig ? structuredClone(rule.stormConfig) : null,
    silenceSnapshot: rule.silenceConfig ? structuredClone(rule.silenceConfig) : null,
    qualitySnapshot: rule.qualityPolicy ? structuredClone(rule.qualityPolicy) : null,
    batchId: rule.batchId || null,
  });
}

export function reducer(state, action) {
  if (!action || !action.type) return state;
  // 确定性演示时间：每次用户动作 tick+1，推进 7 秒（基于 2026-09-16 16:41:08 基准，可重放）。
  // 单动作单 tick 契约：reducer 内部的联动（binding/save→validate、repair/accept→alarm/recover、
  // repair/reject→accept）以 internal:true 委托，不重复推进演示时间。
  const isInternal = action.internal === true;
  const tick = (state.meta.tick || 0) + (isInternal ? 0 : 1);
  const at = isInternal && action.at ? action.at : fmtDemoTime(DEMO_BASE_MS + tick * 7000);
  const actor = action.actorContext || state.meta.actorContext || { userId: 'demo-user', userName: '管理员', source: 'host-context' };
  const payload = action.payload || {};
  state = { ...state, meta: { ...state.meta, tick } };

  // 幂等命中：重复请求返回同一结果，不重复创建事实
  if (action.idempotencyKey) {
    const prior = state.entities.idempotencyByKey[action.idempotencyKey];
    if (prior) {
      return finish(state, action, true, `重复请求已忽略（幂等）：${prior.message}`, prior.refs, true, at);
    }
  }

  const seq = () => String(tick + 1).padStart(4, '0');
  const E = state.entities;

  switch (action.type) {
    // ================= 设备生命周期（简化流程） =================
    case 'lifecycle/createTask': {
      const record = {
        ...payload,
        version: 1,
        currentNode: '采购入账待提交',
        status: '采购入账待提交',
        procurement: { submittedAt: null, submittedBy: null },
        trial: { result: null, opinion: '', problem: '', confirmedAt: null, confirmer: null },
        registration: { status: '未开始', deviceIds: [], acceptanceFile: null, archiveFile: null, submittedAt: null, registrar: null },
        attachments: payload.attachments || [],
        timeline: [{ type: '创建', time: at, actor: actor.userName, detail: '采购入账任务已创建' }],
      };
      let next = setE(state, 'lifecycleTasksById', payload.taskId, record);
      next = addHistory(next, at, 'lifecycleTask', payload.taskId, `创建采购入账任务 ${payload.taskNo}`, {});
      return finish(next, action, true, `采购入账任务 ${payload.taskNo} 已创建`, { taskId: payload.taskId }, false, at);
    }
    case 'lifecycle/submitProcurement': {
      const task = E.lifecycleTasksById?.[payload.taskId];
      if (!task) return reject(state, action, '生命周期任务不存在');
      if (!['采购入账待提交', '采购入账待修改', '试用不合格退回'].includes(task.status)) return reject(state, action, `当前状态「${task.status}」不能提交采购入账`);
      const updated = {
        ...task,
        ...payload,
        status: '使用部门试用确认中',
        currentNode: '使用部门试用确认中',
        version: (task.version || 0) + 1,
        procurement: { submittedAt: at, submittedBy: actor.userName },
        trial: { result: null, opinion: '', problem: '', confirmedAt: null, confirmer: null },
        timeline: [...(task.timeline || []), { type: '采购入账', time: at, actor: actor.userName, detail: '已提交使用部门试用确认' }],
      };
      let next = setE(state, 'lifecycleTasksById', task.taskId, updated);
      next = addHistory(next, at, 'lifecycleTask', task.taskId, '采购入账提交，进入使用部门试用确认', {});
      return finish(next, action, true, '采购入账已提交，已生成使用部门试用确认任务', { taskId: task.taskId }, false, at);
    }
    case 'lifecycle/confirmTrial': {
      const task = E.lifecycleTasksById?.[payload.taskId];
      if (!task) return reject(state, action, '生命周期任务不存在');
      if (task.status !== '使用部门试用确认中') return reject(state, action, `当前状态「${task.status}」不能试用确认`);
      const isOk = payload.result === '合格';
      const nextStatus = isOk ? '待设备手续入账' : '试用不合格退回';
      const updated = {
        ...task,
        status: nextStatus,
        currentNode: nextStatus,
        version: (task.version || 0) + 1,
        trial: { result: payload.result, opinion: payload.opinion, problem: payload.problem || '', confirmedAt: at, confirmer: actor.userName },
        registration: isOk ? { ...task.registration, status: '待办理' } : task.registration,
        timeline: [...(task.timeline || []), { type: `试用${payload.result}`, time: at, actor: actor.userName, detail: isOk ? payload.opinion : `${payload.problem}；${payload.opinion}` }],
      };
      let next = setE(state, 'lifecycleTasksById', task.taskId, updated);
      next = addHistory(next, at, 'lifecycleTask', task.taskId, isOk ? '试用确认合格，转设备手续入账' : '试用确认不合格，退回采购', {});
      return finish(next, action, true, isOk ? '试用确认合格，已转设备手续入账' : '试用确认不合格，已退回采购', { taskId: task.taskId }, false, at);
    }
    case 'lifecycle/registerDevice': {
      const task = E.lifecycleTasksById?.[payload.taskId];
      if (!task) return reject(state, action, '生命周期任务不存在');
      if (task.status !== '待设备手续入账') return reject(state, action, `当前状态「${task.status}」不能办理设备入账`);
      const baseCount = Object.keys(E.devicesById || {}).length;
      const count = Number(task.quantity) || 1;
      let next = state;
      const deviceIds = [];
      for (let i = 0; i < count; i += 1) {
        const n = baseCount + i + 1;
        const deviceId = `DEV-${String(n).padStart(3, '0')}`;
        const assetCode = `MT${String(state.meta.demoDay || '20260918').replaceAll('-', '').slice(0, 4)}L${String(n).padStart(4, '0')}`;
        const device = {
          deviceId,
          assetCode,
          name: payload.name || task.equipmentName,
          model: payload.model || task.model,
          type: payload.type || '通用设备',
          brand: payload.brand || task.brand,
          organizationId: 'org-demo',
          workshopName: payload.workshopName,
          lineName: payload.lineName || '--',
          stationName: payload.stationName || '--',
          assetNo: payload.assetNo || `待财务-${String(n).padStart(4, '0')}`,
          lifecycleStatus: '在用',
          owner: payload.owner,
          enableDate: dateOnly(at),
          buyDate: task.shipDate || dateOnly(at),
          oeeEligible: payload.oeeEligible === true,
          sourceTaskId: task.taskId,
          contractNo: task.contractNo,
          warranty: payload.warranty || '--',
          acceptanceFile: payload.acceptanceFile,
          archiveFile: payload.archiveFile,
        };
        next = setE(next, 'devicesById', deviceId, device);
        deviceIds.push(deviceId);
        next = addHistory(next, at, 'device', deviceId, `设备手续入账：${device.name}`, { taskId: task.taskId });
      }
      const updated = {
        ...task,
        status: '设备已入账',
        currentNode: '设备已入账',
        version: (task.version || 0) + 1,
        registration: { status: '已完成', deviceIds, acceptanceFile: payload.acceptanceFile, archiveFile: payload.archiveFile, submittedAt: at, registrar: actor.userName },
        timeline: [...(task.timeline || []), { type: '设备手续入账', time: at, actor: actor.userName, detail: `已生成 ${deviceIds.length} 台设备台账` }],
      };
      next = setE(next, 'lifecycleTasksById', task.taskId, updated);
      next = addHistory(next, at, 'lifecycleTask', task.taskId, `设备手续入账完成，生成 ${deviceIds.length} 台设备`, { deviceIds });
      return finish(next, action, true, '设备手续已办理，设备台账已入账', { taskId: task.taskId, deviceIds }, false, at);
    }
    case 'lifecycle/createChange': {
      const record = { ...payload, status: '待审批', version: 1, createdAt: payload.createdAt || at };
      let next = setE(state, 'assetChangeRecordsById', payload.changeId, record);
      next = addHistory(next, at, 'device', payload.deviceId, `提交资产变更：${payload.type}`, { changeId: payload.changeId });
      return finish(next, action, true, '资产变更申请已提交', { changeId: payload.changeId }, false, at);
    }
    case 'lifecycle/approveChange': {
      const record = E.assetChangeRecordsById?.[payload.changeId];
      if (!record) return reject(state, action, '变更申请不存在');
      const status = payload.approved ? '审批通过' : '已驳回';
      const updated = { ...record, status, opinion: payload.opinion || '', approvedAt: at, approver: actor.userName, version: (record.version || 0) + 1 };
      let next = setE(state, 'assetChangeRecordsById', record.changeId, updated);
      next = addHistory(next, at, 'device', record.deviceId, `资产变更${payload.approved ? '审批通过' : '被驳回'}：${record.type}`, { changeId: record.changeId });
      return finish(next, action, true, `变更申请已${payload.approved ? '审批通过' : '驳回'}`, { changeId: record.changeId }, false, at);
    }
    case 'lifecycle/completeChange': {
      const record = E.assetChangeRecordsById?.[payload.changeId];
      if (!record) return reject(state, action, '变更申请不存在');
      const updated = { ...record, status: '已完成', completedAt: at, executor: actor.userName, version: (record.version || 0) + 1 };
      let next = setE(state, 'assetChangeRecordsById', record.changeId, updated);
      const device = E.devicesById[record.deviceId];
      if (device && record.type === '调拨' && record.to?.dept) {
        next = setE(next, 'devicesById', record.deviceId, { ...device, department: record.to.dept, owner: record.to.owner || device.owner });
      }
      next = addHistory(next, at, 'device', record.deviceId, `资产变更完成：${record.type}`, { changeId: record.changeId });
      return finish(next, action, true, '资产变更已执行并写入设备履历', { changeId: record.changeId }, false, at);
    }
    case 'lifecycle/createIdle': {
      const record = { ...payload, status: '复核中', version: 1, createdAt: payload.createdAt || at };
      let next = setE(state, 'idleApplicationsById', payload.idleId, record);
      next = addHistory(next, at, 'device', payload.deviceId, '提交闲置申请', { idleId: payload.idleId });
      return finish(next, action, true, '闲置申请已提交', { idleId: payload.idleId }, false, at);
    }
    case 'lifecycle/reviewIdle': {
      const record = E.idleApplicationsById?.[payload.idleId];
      if (!record) return reject(state, action, '闲置申请不存在');
      const status = payload.result === '再启用' ? '已再启用' : payload.result === '转报废' ? '转报废' : '继续闲置';
      let next = setE(state, 'idleApplicationsById', record.idleId, { ...record, status, reviewResult: payload.result, reviewOpinion: payload.opinion || '', reviewedAt: at, reviewer: actor.userName, version: (record.version || 0) + 1 });
      const device = E.devicesById[record.deviceId];
      if (device && payload.result === '再启用') next = setE(next, 'devicesById', record.deviceId, { ...device, lifecycleStatus: '在用', enableDate: dateOnly(at) });
      next = addHistory(next, at, 'device', record.deviceId, `闲置复核：${payload.result}`, { idleId: record.idleId });
      return finish(next, action, true, `闲置复核已提交：${payload.result}`, { idleId: record.idleId }, false, at);
    }
    case 'lifecycle/createScrap': {
      const record = { ...payload, status: '技术鉴定中', version: 1, createdAt: payload.createdAt || at };
      let next = setE(state, 'scrapApplicationsById', payload.scrapId, record);
      next = addHistory(next, at, 'device', payload.deviceId, '提交报废申请', { scrapId: payload.scrapId });
      return finish(next, action, true, '报废申请已提交，等待技术鉴定', { scrapId: payload.scrapId }, false, at);
    }
    case 'lifecycle/appraiseScrap': {
      const record = E.scrapApplicationsById?.[payload.scrapId];
      if (!record) return reject(state, action, '报废申请不存在');
      const status = payload.result === '同意报废' ? '待财务核销' : '鉴定未通过';
      let next = setE(state, 'scrapApplicationsById', record.scrapId, { ...record, status, appraisal: payload.opinion, appraiser: actor.userName, appraisedAt: at, version: (record.version || 0) + 1 });
      next = addHistory(next, at, 'device', record.deviceId, `报废技术鉴定：${payload.result}`, { scrapId: record.scrapId });
      return finish(next, action, true, status === '待财务核销' ? '技术鉴定通过，等待财务核销' : '技术鉴定未通过', { scrapId: record.scrapId }, false, at);
    }
    case 'lifecycle/writeOffScrap': {
      const record = E.scrapApplicationsById?.[payload.scrapId];
      if (!record) return reject(state, action, '报废申请不存在');
      let next = setE(state, 'scrapApplicationsById', record.scrapId, { ...record, status: '已报废', writeOffNo: payload.writeOffNo, writeOffAt: at, financeUser: actor.userName, version: (record.version || 0) + 1 });
      const device = E.devicesById[record.deviceId];
      if (device) next = setE(next, 'devicesById', record.deviceId, { ...device, lifecycleStatus: '报废/归档', disableDate: dateOnly(at), oeeEligible: false });
      next = addHistory(next, at, 'device', record.deviceId, '财务核销完成，设备已报废', { scrapId: record.scrapId, writeOffNo: payload.writeOffNo });
      return finish(next, action, true, '财务核销已确认，设备已报废', { scrapId: record.scrapId }, false, at);
    }
    case 'lifecycle/archiveScrap': {
      const record = E.scrapApplicationsById?.[payload.scrapId];
      if (!record) return reject(state, action, '报废申请不存在');
      let next = setE(state, 'scrapApplicationsById', record.scrapId, { ...record, status: '已归档', archivedAt: at, archiver: actor.userName, version: (record.version || 0) + 1 });
      next = addHistory(next, at, 'device', record.deviceId, '报废记录已归档', { scrapId: record.scrapId });
      return finish(next, action, true, '报废记录已归档', { scrapId: record.scrapId }, false, at);
    }
    // ================= 绑定 =================
    case 'binding/validate': {
      const draft = payload.draft;
      const res = validateBindingDraft(draft, { metricsByKey: E.metricsByKey });
      return finish(state, action, res.ok, res.ok ? '校验通过：可以保存绑定草稿' : `校验未通过：${res.errors.join('；')}`, { errors: res.errors }, false, at);
    }
    case 'binding/addSource': {
      const key = `draft-${payload.deviceId}`;
      const drafts = state.ui.bindingDraftsByDeviceId || {};
      const draft = drafts[key] || { deviceId: payload.deviceId, version: ((E.bindingsByDeviceId[payload.deviceId]?.version) || 0) + 1, configStatus: '草稿', items: [] };
      if (draft.items.some(i => i.iotDeviceId === payload.source.iotDeviceId)) {
        return reject(state, action, '该 IoT 来源设备已在绑定草稿中');
      }
      const item = { ...payload.source, enabled: true, metrics: (payload.source.metrics || []) };
      const next = { ...state, ui: { ...state.ui, bindingDraftsByDeviceId: setIn(drafts, key, { ...draft, items: [...draft.items, item] }) } };
      return finish(next, action, true, `已将 ${item.iotDeviceCode} 加入绑定草稿（未保存）`, { deviceId: payload.deviceId }, false, at);
    }
    case 'binding/removeSource': {
      const key = `draft-${payload.deviceId}`;
      const drafts = state.ui.bindingDraftsByDeviceId || {};
      const draft = drafts[key];
      if (!draft) return reject(state, action, '没有进行中的绑定草稿');
      const next = { ...state, ui: { ...state.ui, bindingDraftsByDeviceId: setIn(drafts, key, { ...draft, items: draft.items.filter(i => i.iotDeviceId !== payload.iotDeviceId) }) } };
      return finish(next, action, true, '已从绑定草稿移除该来源（未保存）', {}, false, at);
    }
    case 'binding/toggleMetric': {
      const key = `draft-${payload.deviceId}`;
      const drafts = state.ui.bindingDraftsByDeviceId || {};
      const draft = drafts[key];
      if (!draft) return reject(state, action, '没有进行中的绑定草稿');
      const def = E.metricsByKey[payload.metricCode];
      if (def && def.syncStatus === '已失效') return reject(state, action, `指标 ${def.name} 已失效，不能参与绑定`);
      const items = draft.items.map(i => {
        if (i.iotDeviceId !== payload.iotDeviceId) return i;
        const metrics = [...(i.metrics || [])];
        const idx = metrics.findIndex(m => m.metricCode === payload.metricCode);
        if (idx >= 0) metrics[idx] = { ...metrics[idx], selected: !metrics[idx].selected };
        else metrics.push({ metricCode: payload.metricCode, metricVersion: def?.metricVersion || 'v1', selected: true });
        return { ...i, metrics };
      });
      const next = { ...state, ui: { ...state.ui, bindingDraftsByDeviceId: setIn(drafts, key, { ...draft, items }) } };
      return finish(next, action, true, `指标 ${payload.metricCode} 选择状态已切换（未保存）`, {}, false, at);
    }
    case 'bindingTemplate/save': {
      // 按 templateId upsert：新模板插入队首；同 id 视为编辑（保留原创建时间）
      const templates = state.ui.bindingTemplates || [];
      const existing = templates.find(t => t.templateId === payload.template.templateId);
      const record = { ...payload.template, createdAt: existing?.createdAt || at };
      const next = {
        ...state,
        ui: { ...state.ui, bindingTemplates: existing ? templates.map(t => (t.templateId === record.templateId ? record : t)) : [record, ...templates] },
      };
      return finish(next, action, true, `绑定模板「${payload.template.name}」已${existing ? '更新' : '保存'}（来源：${payload.template.sourceName || '--'}）`, { templateId: payload.template.templateId }, false, at);
    }
    case 'bindingTemplate/delete': {
      const templates = (state.ui.bindingTemplates || []).filter(t => t.templateId !== payload.templateId);
      const next = { ...state, ui: { ...state.ui, bindingTemplates: templates } };
      return finish(next, action, true, '绑定模板已删除', {}, false, at);
    }
    case 'binding/applyTemplate': {
      // bindings 由 actions 层按模板结构构造（IoT 来源编码演示模拟：由物联网平台自动分配专属编码，天然不冲突）
      const { bindings, autoEnable, templateName } = payload;
      let next = state;
      bindings.forEach((b) => {
        const prev = E.bindingsByDeviceId[b.deviceId];
        const newBinding = {
          deviceId: b.deviceId, bindingId: b.bindingId, version: b.version,
          items: b.items, configStatus: b.configStatus,
          effectiveFrom: autoEnable ? at : null, effectiveTo: null,
          healthStatus: prev?.healthStatus || '--',
          pullCycleSec: prev?.pullCycleSec || 60, lastPullTime: prev?.lastPullTime || '--',
          pullFailCount: 0, pendingCompensation: 0,
        };
        next = setE(next, 'bindingsByDeviceId', b.deviceId, newBinding);
        next = setE(next, 'bindingVersionsById', b.bindingId, { bindingId: b.bindingId, deviceId: b.deviceId, version: b.version, configStatus: b.configStatus, effectiveFrom: newBinding.effectiveFrom, effectiveTo: null, summary: b.summary });
        next = { ...next, ui: { ...next.ui, bindingDraftsByDeviceId: { ...next.ui.bindingDraftsByDeviceId, [`draft-${b.deviceId}`]: undefined } } };
        next = addHistory(next, at, 'binding', b.bindingId, `应用绑定模板「${templateName}」→ v${b.version}（${b.configStatus}）`, { deviceId: b.deviceId });
      });
      return finish(next, action, true, `模板「${templateName}」已应用到 ${bindings.length} 台设备（${autoEnable ? '已启用' : '待生效'}）`, { deviceIds: bindings.map(b => b.deviceId) }, false, at);
    }
    case 'binding/save': {
      const key = `draft-${payload.deviceId}`;
      const draft = (state.ui.bindingDraftsByDeviceId || {})[key];
      if (!draft) return reject(state, action, '没有待保存的绑定草稿');
      // 走一次校验（internal：联动校验不单独推进演示时间）
      const checked = reducer(state, { type: 'binding/validate', payload: { draft }, actorContext: actor, at, internal: true });
      if (!checked.meta.lastAction.ok) return checked;
      const current = E.bindingsByDeviceId[payload.deviceId];
      const version = (current?.version || 0) + 1;
      const bindingId = `binding-${payload.deviceId.replace('DEV-', 'D')}-${version >= 10 ? '' : '0'}${version}`;
      const newBinding = {
        ...draft, bindingId, version, configStatus: '待生效',
        effectiveFrom: null, effectiveTo: null,
        healthStatus: current?.healthStatus || '--',
        pullCycleSec: draft.pullCycleSec || current?.pullCycleSec || 60,
        lastPullTime: current?.lastPullTime || '--', pullFailCount: 0, pendingCompensation: 0,
      };
      let next = setE(state, 'bindingsByDeviceId', payload.deviceId, newBinding);
      const versionRecord = { bindingId, deviceId: payload.deviceId, version, configStatus: '待生效', effectiveFrom: null, effectiveTo: null, summary: payload.summary || '保存绑定草稿' };
      next = setE(next, 'bindingVersionsById', bindingId, versionRecord);
      next = { ...next, ui: { ...next.ui, bindingDraftsByDeviceId: { ...next.ui.bindingDraftsByDeviceId, [key]: undefined } } };
      next = addHistory(next, at, 'binding', bindingId, `保存绑定草稿 v${version}，待生效`, { deviceId: payload.deviceId });
      return finish(next, action, true, `绑定 v${version} 已保存，状态「待生效」；启用后生效，影响监测/报警/OEE/报表`, { bindingId, version, deviceId: payload.deviceId }, false, at);
    }
    case 'binding/enable': {
      const b = E.bindingsByDeviceId[payload.deviceId];
      if (!b) return reject(state, action, '该设备尚未创建绑定');
      if (!canTransitionBinding(b.configStatus, '已启用')) return reject(state, action, `当前状态「${b.configStatus}」不能启用（状态机约束）`);
      const validation = validateBindingDraft(b, { metricsByKey: E.metricsByKey });
      if (!validation.ok) return reject(state, action, `绑定启用校验未通过：${validation.errors.join('；')}`);
      const updated = { ...b, configStatus: '已启用', effectiveFrom: at, effectiveTo: null };
      let next = setE(state, 'bindingsByDeviceId', payload.deviceId, updated);
      const vkey = Object.keys(E.bindingVersionsById).find(k => E.bindingVersionsById[k].bindingId === b.bindingId);
      if (vkey) next = setE(next, 'bindingVersionsById', vkey, { ...E.bindingVersionsById[vkey], configStatus: '已启用', effectiveFrom: at });
      next = addHistory(next, at, 'binding', b.bindingId, `绑定启用（v${b.version}），生效时间 ${at}`, { deviceId: payload.deviceId });
      return finish(next, action, true, `绑定 v${b.version} 已启用（生效 ${at}），影响范围：运行监测、报警、OEE、报表、大屏`, { bindingId: b.bindingId, deviceId: payload.deviceId }, false, at);
    }
    case 'binding/disable': {
      const b = E.bindingsByDeviceId[payload.deviceId];
      if (!b) return reject(state, action, '该设备尚未创建绑定');
      if (!canTransitionBinding(b.configStatus, '已停用')) return reject(state, action, `当前状态「${b.configStatus}」不能停用`);
      const updated = { ...b, configStatus: '已停用', effectiveTo: at };
      let next = setE(state, 'bindingsByDeviceId', payload.deviceId, updated);
      next = addHistory(next, at, 'binding', b.bindingId, `绑定停用（v${b.version}）${payload.reason ? `：${payload.reason}` : ''}`, { deviceId: payload.deviceId });
      return finish(next, action, true, `绑定 v${b.version} 已停用；失效指标不再参与报警与 OEE`, { bindingId: b.bindingId }, false, at);
    }

    // ================= 实时 Provider =================
    case 'realtime/refresh': {
      if (state.meta.provider === 'disconnect') {
        return finish(withMeta(state, at, { degraded: true, latencySec: null }), action, true, '刷新已执行：断开期间无新样本，最后样本时间不变', {}, false, at);
      }
      const lastSampleAt = timeOnly(at);
      let next = withMeta(state, at, { lastSampleAt, degraded: false });
      next = { ...next, meta: { ...next.meta, latencySec: 2 + (tick % 4) } };
      return finish(next, action, true, `数据刷新完成：最后样本 ${lastSampleAt}，延迟 ${next.meta.latencySec}s`, {}, false, at);
    }
    case 'realtime/setProviderMode': {
      const mode = payload.mode;
      if (!['mock-polling', 'mock-subscription', 'disconnect'].includes(mode)) return reject(state, action, `未知数据源模式：${mode}`);
      const degraded = mode === 'disconnect';
      const label = { 'mock-polling': '轮询', 'mock-subscription': '订阅', disconnect: '断开（降级）' }[mode];
      return finish(withMeta(state, at, { provider: mode, degraded }), action, true, `已切换为${label}${degraded ? '：断开期间旧值不再标记为实时' : ''}`, {}, false, at);
    }

    // ================= 报警 =================
    case 'alarm/raise': {
      const { deviceId, ruleCode, sample } = payload;
      const rule = E.alarmRulesById[ruleCode];
      if (!rule) return reject(state, action, `规则 ${ruleCode} 不存在`);
      // 触发门禁（M2）：只有已发布规则可触发
      if (rule.status !== '已发布') return reject(state, action, `规则 ${ruleCode} 当前状态「${rule.status}」，草稿/停用规则不能触发报警`);
      // 目标一致性：结构化规则的目标设备必须与触发设备一致
      if (rule.target?.deviceId && rule.target.deviceId !== deviceId) {
        return reject(state, action, `设备 ${deviceId} 与规则目标 ${rule.target.deviceId} 不一致，不能触发`);
      }
      const binding = E.bindingsByDeviceId[deviceId];
      if (!binding || binding.configStatus !== '已启用') {
        return reject(state, action, `设备 ${deviceId} 无启用绑定，不能触发报警`);
      }
      // 指标有效性：目标指标必须仍在当前启用绑定中
      if (rule.target?.metricCode) {
        const stillBound = (binding.items || []).some(i => i.enabled && (i.metrics || []).some(m => m.selected && m.metricCode === rule.target.metricCode));
        if (!stillBound) return reject(state, action, `指标 ${rule.target.metricCode} 未在设备 ${deviceId} 当前启用绑定中，不能触发`);
      }
      // 样本判定（M2 阻断项 5）：MVP 数值阈值规则必须先满足阈值与数据有效性，再实例化事件。
      // legacy 业务规则（程序/备件/状态等非 upper/lower 结构）保留原触发路径。
      const trigger = rule.triggerConfig || null;
      if (trigger && trigger.type === 'threshold' && MVP_TRIGGER_MODES.includes(trigger.mode)) {
        if (!sample) return reject(state, action, '缺少样本数据，不能触发报警');
        if (!sampleTriggered(trigger, sample)) {
          return reject(state, action, `样本值 ${sample.value ?? '--'}${sample.unit || ''}（质量 ${sample.qualityCode || '--'}）未满足触发条件（${conditionTextOf(trigger)}），不创建报警事件`);
        }
      }
      const dedupeKey = `${deviceId}:${ruleCode}:${rule.version}:${binding?.version || 0}`;
      const active = Object.values(E.alarmEventsById).find(a => a.dedupeKey === dedupeKey && a.status !== '已关闭');
      if (active) {
        const updated = { ...active, repeat: (active.repeat || 0) + 1, timeline: [...active.timeline, { type: '重复触发', time: timeOnly(at), actor: '系统', detail: '命中去重键，合并计入活动事件' }] };
        const next = setE(state, 'alarmEventsById', active.id, updated);
        return finish(next, action, true, `命中去重键，合并到活动事件 ${active.id}（重复计数 +1）`, { alarmId: active.id, merged: true }, false, at);
      }
      const id = `ALM-${dateOnly(at).replaceAll('-', '')}-${seq()}`;
      const event = {
        id, deviceId, deviceName: E.devicesById[deviceId]?.name || deviceId, name: rule.name,
        rule: ruleCode, ruleVersion: rule.version, bindingVersion: binding?.version || 0,
        severity: rule.severity, status: '已触发', metric: rule.metricCode, metricCode: rule.metricCode,
        trigger: sample ? `${sample.value}${sample.unit || ''}` : '--', threshold: rule.condition,
        time: timeOnly(at), duration: '0m 0s', repeat: 0, ack: '-', escalation: '0', notify: '成功', policy: rule.policyCode,
        recovery: rule.recovery, handler: '-', recovered: '', recoveredEvidence: null, merge: 0,
        dedupeKey, relatedRepairOrderId: null, relatedDowntimeId: null,
        timeline: [{ type: '触发', time: timeOnly(at), actor: '系统', detail: `${rule.name}：${rule.condition}` }],
      };
      const next = setE(state, 'alarmEventsById', id, event);
      return finish(next, action, true, `已触发报警 ${id}（${rule.severity}）`, { alarmId: id }, false, at);
    }
    case 'alarm/ack': {
      const alarm = E.alarmEventsById[payload.alarmId];
      if (!alarm) return reject(state, action, '报警事件不存在');
      if (!(payload.note || '').trim()) return reject(state, action, '确认必须填写说明（§6.4）');
      if (!canAlarmTransition(alarm.status, '已确认')) return reject(state, action, `当前状态「${alarm.status}」不能确认`);
      const updated = { ...alarm, status: '已确认', ack: timeOnly(at), handler: actor.userName, timeline: [...alarm.timeline, { type: '确认', time: timeOnly(at), actor: actor.userName, detail: payload.note }] };
      let next = setE(state, 'alarmEventsById', alarm.id, updated);
      next = addHistory(next, at, 'alarm', alarm.id, '确认报警', { deviceId: alarm.deviceId, note: payload.note });
      return finish(next, action, true, `已确认 ${alarm.id}，请继续处置（填写措施与预计完成时间）`, { alarmId: alarm.id }, false, at);
    }
    case 'alarm/handle': {
      const alarm = E.alarmEventsById[payload.alarmId];
      if (!alarm) return reject(state, action, '报警事件不存在');
      if (!(payload.measure || '').trim()) return reject(state, action, '处置必须填写措施（§6.4）');
      if (!payload.expectedAt) return reject(state, action, '处置必须填写预计完成时间（§6.4）');
      if (alarm.status === '已关闭') return reject(state, action, '已关闭报警不能处置');
      const toStatus = canAlarmTransition(alarm.status, '处理中') ? '处理中' : alarm.status;
      const updated = { ...alarm, status: toStatus, handler: actor.userName, timeline: [...alarm.timeline, { type: '处置', time: timeOnly(at), actor: actor.userName, detail: `${payload.measure}（预计完成：${payload.expectedAt}）` }] };
      let next = setE(state, 'alarmEventsById', alarm.id, updated);
      next = addHistory(next, at, 'alarm', alarm.id, '处置报警', { deviceId: alarm.deviceId, measure: payload.measure });
      return finish(next, action, true, `已记录处置，状态「${toStatus}」${toStatus !== '处理中' ? '（恢复待关闭状态无需重复处置）' : ''}`, { alarmId: alarm.id }, false, at);
    }
    case 'alarm/createRepairFromAlarm': {
      const alarm = E.alarmEventsById[payload.alarmId];
      if (!alarm) return reject(state, action, '报警事件不存在');
      // 幂等：一条活动故障默认一张主工单（repair-from-alarm:{alarmId}）
      const existing = Object.values(E.repairOrdersById).find(o => o.alarmId === alarm.id && !['已完成', '已取消'].includes(o.status));
      if (existing) {
        return finish(state, action, true, `该报警已存在活动工单 ${existing.repairOrderId}，不重复建单（幂等）`, { repairOrderId: existing.repairOrderId, alarmId: alarm.id }, false, at);
      }
      if (['已关闭'].includes(alarm.status)) return reject(state, action, '已关闭报警不能转维修；如需维修请人工报修');
      const id = `RO-${dateOnly(at).replaceAll('-', '')}-${seq()}`;
      const order = {
        repairOrderId: id, code: id, deviceId: alarm.deviceId, deviceName: alarm.deviceName,
        deviceCode: E.crosswalkById[alarm.deviceId]?.assetCode || '--',
        title: `${alarm.name} 维修`, source: 'alarm', alarmId: alarm.id, reportId: null,
        faultType: payload.faultType || '其他', level: alarm.severity === '提示' ? '一般' : alarm.severity === '紧急' ? '紧急' : '严重',
        faultDesc: payload.faultDesc || `${alarm.name}（触发值 ${alarm.trigger}，阈值 ${alarm.threshold}）`,
        status: '待派工', assignee: null, assigneeGroup: null, reporter: actor.userName,
        createdAt: at, assignedAt: null, startedAt: null, submittedAt: null, acceptedAt: null,
        slaHours: alarm.severity === '紧急' ? 2 : 8, slaDueAt: '--',
        downtimeFactId: alarm.relatedDowntimeId, downtimeDuringRepair: true,
        measures: '', verification: '', laborHours: null, parts: [], timeline: [{ type: '创建', time: at, actor: actor.userName, detail: `由报警 ${alarm.id} 转维修生成` }],
        acceptance: null, reworkCount: 0,
      };
      // 转维修时可选「立即派工」：直接带出已派工工单，跳过待派工队列（方案 A，2026-09-22）
      const d = payload.dispatch;
      const directDispatch = d && (d.assignee || '').trim();
      const finalOrder = directDispatch
        ? { ...order, status: '已派工', assignee: d.assignee.trim(), assigneeGroup: d.assigneeGroup || null, assignedAt: at, timeline: [...order.timeline, { type: '派工', time: at, actor: actor.userName, detail: `转维修时直接派工至 ${d.assigneeGroup || ''} ${d.assignee.trim()}` }] }
        : order;
      let next = setE(state, 'repairOrdersById', id, finalOrder);
      next = setE(next, 'alarmEventsById', alarm.id, { ...alarm, relatedRepairOrderId: id, timeline: [...alarm.timeline, { type: '转维修', time: timeOnly(at), actor: actor.userName, detail: `生成维修工单 ${id}` }] });
      next = addHistory(next, at, 'repair', id, directDispatch ? `由报警 ${alarm.id} 创建维修工单并直接派工至 ${d.assignee.trim()}` : `由报警 ${alarm.id} 创建维修工单`, { deviceId: alarm.deviceId, alarmId: alarm.id });
      return finish(next, action, true, directDispatch
        ? `已生成主工单 ${id} 并直接派工至 ${d.assignee.trim()}，可在「维修任务」中开工执行`
        : `已生成主工单 ${id}（待派工），并回写至报警 ${alarm.id}`, { repairOrderId: id, alarmId: alarm.id }, false, at);
    }
    case 'alarm/close': {
      const alarm = E.alarmEventsById[payload.alarmId];
      if (!alarm) return reject(state, action, '报警事件不存在');
      const repair = alarm.relatedRepairOrderId ? E.repairOrdersById[alarm.relatedRepairOrderId] : null;
      const downtime = alarm.relatedDowntimeId ? E.downtimeFactsById[alarm.relatedDowntimeId] : null;
      const blockers = closeBlockers(alarm, {
        closeReason: payload.closeReason,
        repairStatus: repair?.status,
        downtimeStatus: downtime?.status,
      });
      if (blockers.length) return reject(state, action, `不能关闭：${blockers.join('；')}`);
      const updated = { ...alarm, status: '已关闭', recoveredEvidence: true, timeline: [...alarm.timeline, { type: '关闭', time: timeOnly(at), actor: actor.userName, detail: `恢复证据：${payload.evidence}；原因：${payload.closeReason}` }] };
      let next = setE(state, 'alarmEventsById', alarm.id, updated);
      next = addHistory(next, at, 'alarm', alarm.id, '关闭报警', { deviceId: alarm.deviceId, closeReason: payload.closeReason });
      return finish(next, action, true, `已关闭 ${alarm.id}`, { alarmId: alarm.id }, false, at);
    }
    // 报警恢复（验收联动内部动作，也可由页面在指标恢复后调用）
    case 'alarm/recover': {
      const alarm = E.alarmEventsById[payload.alarmId];
      if (!alarm || ['已关闭', '已恢复待关闭'].includes(alarm.status)) return state;
      if (!(payload.evidence || '').trim()) return reject(state, action, '恢复必须填写恢复证据');
      // MVP 恢复判定（M2）：提供样本时必须满足恢复阈值且数据有效（null/BAD/OFFLINE 不恢复）
      const rule = E.alarmRulesById[alarm.rule];
      if (payload.sample && rule?.recoveryConfig?.condition?.type === 'hysteresis') {
        if (!sampleRecovered(rule.recoveryConfig, payload.sample)) {
          return reject(state, action, `样本值 ${payload.sample.value ?? '--'}${payload.sample.unit || ''} 未满足恢复条件（${recoveryTextOf(rule.recoveryConfig, rule.triggerConfig)}），报警保持`);
        }
      }
      const updated = {
        ...alarm,
        status: '已恢复待关闭',
        recovered: payload.evidence || '指标恢复',
        recoveredEvidence: true,
        recoverySnapshot: rule?.recoveryConfig ? structuredClone(rule.recoveryConfig) : null,
        timeline: [...alarm.timeline, { type: '恢复', time: timeOnly(at), actor: actor.userName, detail: payload.evidence || '指标恢复' }],
      };
      let next = setE(state, 'alarmEventsById', alarm.id, updated);
      // 自动恢复类规则：无业务关联时恢复后自动关闭；有关联时仍需通过关闭校验（closeBlockers）。
      const autoClose = (rule?.recoveryConfig ? (rule.recoveryConfig.mode === 'auto' && rule.recoveryConfig.closeMode !== 'manual') : false)
        || alarm.recovery === '自动恢复';
      if (autoClose && !alarm.relatedRepairOrderId && !alarm.relatedDowntimeId) {
        next = setE(next, 'alarmEventsById', alarm.id, { ...updated, status: '已关闭', timeline: [...updated.timeline, { type: '关闭', time: timeOnly(at), actor: '系统', detail: '自动恢复类规则恢复后自动关闭' }] });
      }
      return next;
    }

    case 'alarm/rule/saveDraft': {
      const payloadRule = payload.rule || {};
      if (!(payloadRule.code || '').trim() || !(payloadRule.name || '').trim()) return reject(state, action, '规则编号与名称必填');
      const prev = E.alarmRulesById[payloadRule.code];
      if (prev && prev.status === '已发布') {
        // 已发布规则编辑 → 草稿独立保存，不覆盖当前发布内容与版本快照（M2 契约 2）
        let next = setE(state, 'alarmRulesById', payloadRule.code, {
          ...prev,
          draftConfig: structuredClone(payloadRule),
          updatedBy: actor.userName, updatedAt: at,
        });
        next = addHistory(next, at, 'alarm-rule', payloadRule.code, `保存规则 ${payloadRule.code} 草稿（待发布）`, {});
        return finish(next, action, true, `规则 ${payloadRule.code} 草稿已保存：当前发布版本 ${prev.publishedVersion || prev.version} 不受影响，发布后生成新版本`, { ruleCode: payloadRule.code }, false, at);
      }
      // 新规则/已停用草稿：草稿保存不消耗发布版本号（M2 契约 4）
      const rule = {
        ...(prev || { trig7d: 0, supp7d: 0, storm: '≤ 3 条/小时' }),
        ...payloadRule,
        status: '草稿',
        publishedVersion: prev?.publishedVersion || null,
        version: prev?.publishedVersion || '待发布',
        draftConfig: null,
        updatedBy: actor.userName, updatedAt: at,
      };
      let next = setE(state, 'alarmRulesById', rule.code, rule);
      next = addHistory(next, at, 'alarm-rule', rule.code, `保存规则草稿 ${rule.code}`, {});
      return finish(next, action, true, `规则 ${rule.code} 草稿已保存`, { ruleCode: rule.code }, false, at);
    }
    case 'alarm/rule/saveAndPublish': {
      // 原子保存并发布（M2）：校验 → 落库 → 版本递增 → 不可变快照 → 历史，单个 reducer case 内完成
      const payloadRule = payload.rule || {};
      if (!(payloadRule.code || '').trim() || !(payloadRule.name || '').trim()) return reject(state, action, '规则编号与名称必填');
      const validation = validateRuleDraft(payloadRule, ruleContext(E));
      if (validation.errors.length) return reject(state, action, `规则校验未通过：${validation.errors.join('；')}`, validation.errors);
      const prev = E.alarmRulesById[payloadRule.code];
      const prevPublished = prev?.publishedVersion
        || (prev?.status === '已发布' ? prev?.version : null)
        || null;
      const version = nextPublishVersion(prevPublished);
      const rule = {
        ...(prev || { trig7d: 0, supp7d: 0, storm: '≤ 3 条/小时' }),
        ...payloadRule,
        status: '已发布',
        version,
        publishedVersion: version,
        draftConfig: null,
        effectiveFrom: prev?.effectiveFrom || at,
        updatedBy: actor.userName, updatedAt: at,
        condition: conditionTextOf(payloadRule.triggerConfig),
        recovery: recoveryTextOf(payloadRule.recoveryConfig, payloadRule.triggerConfig),
      };
      let next = setE(state, 'alarmRulesById', rule.code, rule);
      next = writeRuleVersionSnapshot(next, rule, version, at, actor);
      next = addHistory(next, at, 'alarm-rule', rule.code, `发布规则 ${rule.code} ${version}`, {});
      return finish(next, action, true, `规则 ${rule.code} 已发布为 ${version}`, { ruleCode: rule.code, version }, false, at);
    }
    case 'alarm/rule/publish': {
      const rule = E.alarmRulesById[payload.ruleCode];
      if (!rule) return reject(state, action, '规则不存在');
      // 已发布规则存在待发布草稿 → 应用草稿并发布为新版本
      if (rule.draftConfig) {
        return reducer(state, { ...action, type: 'alarm/rule/saveAndPublish', payload: { rule: rule.draftConfig }, internal: true });
      }
      if (rule.status !== '草稿') return reject(state, action, `规则 ${rule.code} 当前状态「${rule.status}」，只有草稿或存在待发布草稿时可发布`);
      return reducer(state, { ...action, type: 'alarm/rule/saveAndPublish', payload: { rule }, internal: true });
    }
    case 'alarm/rule/disable': {
      const rule = E.alarmRulesById[payload.ruleCode];
      if (!rule) return reject(state, action, '规则不存在');
      if (rule.status !== '已发布') return reject(state, action, `规则 ${rule.code} 当前状态「${rule.status}」，不能停用`);
      let next = setE(state, 'alarmRulesById', rule.code, { ...rule, status: '已停用', draftConfig: null });
      next = addHistory(next, at, 'alarm-rule', rule.code, `停用规则 ${rule.code}${payload.reason ? `：${payload.reason}` : ''}`, {});
      return finish(next, action, true, `规则 ${rule.code} 已停用，不再触发新报警（历史报警与版本快照保留）`, { ruleCode: rule.code }, false, at);
    }
    case 'alarm/rule/batchCommit': {
      // 批量创建（M3-M4）：单批次、逐目标隔离的部分成功语义。
      // 每个目标先完成校验：失败目标不写实体；合法目标生成独立草稿；重复 clientRequestId 由幂等登记拦截。
      const { request, batchId, clientRequestId, batchName } = payload;
      const targets = request?.targets || [];
      if (!batchId || !clientRequestId) return reject(state, action, '批次缺少 batchId / clientRequestId');
      if (targets.length === 0) return reject(state, action, '批量请求没有任何目标');
      const rows = [];
      const result = { created: 0, skipped: 0, blocked: 0, failed: 0 };
      let next = state;
      let batchSeq = 0;
      targets.forEach((target) => {
        const ctx = ruleContext(next.entities);
        const device = ctx.devicesById[target.deviceId];
        const binding = ctx.bindingsByDeviceId[target.deviceId];
        const targetKey = `${target.deviceId}|${target.sourceId}|${target.metricCode}`;
        const rowBase = { targetKey, deviceId: target.deviceId, deviceName: target.deviceName, metricCode: target.metricCode, ruleCode: null, result: 'failed', reason: '' };
        // 阻断：设备 / 绑定 / 指标事实不成立（逐目标隔离，不影响其它目标）
        if (!device || !binding || binding.configStatus !== '已启用') {
          result.blocked += 1;
          rows.push({ ...rowBase, result: 'blocked', reason: !device ? '设备不存在' : !binding ? '设备尚未创建绑定' : `绑定状态「${binding.configStatus}」，必须为已启用` });
          return;
        }
        const stillBound = (binding.items || []).some(i => i.enabled && (i.metrics || []).some(m => m.selected && m.metricCode === target.metricCode));
        if (!stillBound) {
          result.blocked += 1;
          rows.push({ ...rowBase, result: 'blocked', reason: `指标 ${target.metricCode} 未在当前启用绑定中` });
          return;
        }
        // 已有同类规则默认跳过，不覆盖（同设备同指标：结构化目标或旧种子 metricCode 均计入）
        const existing = Object.values(ctx.alarmRulesById).find((r) => r.type === '阈值'
          && ['草稿', '已发布'].includes(r.status)
          && ((r.target?.deviceId === target.deviceId && r.target?.metricCode === target.metricCode)
            || (!r.target && r.metricCode === target.metricCode)));
        if (existing) {
          result.skipped += 1;
          rows.push({ ...rowBase, result: 'skipped', reason: `已存在${existing.status}规则 ${existing.code}（${existing.name}），默认不覆盖` });
          return;
        }
        // 目标级校验失败不写半条规则
        const ruleForm = {
          code: `R-B${batchId.replace(/[^0-9]/g, '')}-${String(++batchSeq).padStart(3, '0')}`,
          name: `${target.deviceName}${target.metric?.name || target.metricCode}${request.triggerConfig?.mode === 'lower' ? '过低' : '超限'}报警`,
          type: '阈值',
          severity: request.severity || '重要',
          target: { deviceId: target.deviceId, bindingId: target.bindingId, bindingVersion: target.bindingVersion, sourceId: target.sourceId, sourceCode: target.sourceCode, metricCode: target.metricCode, metricVersion: target.metricVersion },
          triggerConfig: request.triggerConfig,
          recoveryConfig: request.recoveryConfig,
          notificationConfig: request.notificationConfig,
          suppressionConfig: request.suppressionConfig || null,
          stormConfig: request.stormConfig || null,
          silenceConfig: request.silenceConfig || null,
          qualityPolicy: request.qualityPolicy || null,
        };
        const candidate = { ...ruleForm, policyCode: request.notificationConfig?.policyCode || null };
        const validation = validateRuleDraft(candidate, ctx);
        if (validation.errors.length) {
          result.failed += 1;
          rows.push({ ...rowBase, result: 'failed', reason: validation.errors.join('；') });
          return;
        }
        const rule = {
          ...candidate,
          status: '草稿',
          version: '待发布',
          publishedVersion: null,
          batchId,
          trig7d: 0, supp7d: 0,
          createdBy: actor.userName, createdAt: at,
          updatedBy: actor.userName, updatedAt: at,
          condition: conditionTextOf(request.triggerConfig),
          recovery: recoveryTextOf(request.recoveryConfig, request.triggerConfig),
        };
        next = setE(next, 'alarmRulesById', rule.code, rule);
        result.created += 1;
        rows.push({ ...rowBase, ruleCode: rule.code, result: 'created', reason: '已生成草稿' });
      });
      const batch = {
        batchId,
        type: 'alarm-rule-create',
        name: batchName || `批量创建 ${at}`,
        metricCode: request.metricCode || (targets[0] && targets[0].metricCode) || '--',
        clientRequestId,
        status: '草稿已生成',
        creator: actor.userName,
        createdAt: at,
        targetCount: targets.length,
        result,
        rows,
      };
      next = setE(next, 'alarmBatchesById', batchId, batch);
      next = addHistory(next, at, 'alarm-rule', batchId, `批量生成报警规则草稿：创建 ${result.created} / 跳过 ${result.skipped} / 阻断 ${result.blocked} / 失败 ${result.failed}`, {});
      return finish(next, action, true, `批次 ${batchId} 完成：生成草稿 ${result.created} 条，跳过 ${result.skipped}，阻断 ${result.blocked}，失败 ${result.failed}`, { batchId, ...result }, false, at);
    }

    // ================= 维修 =================
    case 'repair/createReport': {
      const device = E.devicesById[payload.deviceId];
      if (!device) return reject(state, action, '设备不存在');
      if (!(payload.faultDesc || '').trim()) return reject(state, action, '故障描述必填');
      const orderId = `RO-${dateOnly(at).replaceAll('-', '')}-${seq()}`;
      const reportId = `BX-${dateOnly(at).replaceAll('-', '')}-${seq()}`;
      const order = {
        repairOrderId: orderId, code: orderId, deviceId, deviceName: device.name,
        deviceCode: E.crosswalkById[deviceId]?.assetCode || '--',
        title: payload.title || `${device.name} 故障维修`, source: 'report', alarmId: payload.alarmId || null, reportId,
        faultType: payload.faultType || '其他', level: payload.level || '一般', faultDesc: payload.faultDesc,
        status: '待派工', assignee: null, assigneeGroup: null, reporter: actor.userName,
        createdAt: at, assignedAt: null, startedAt: null, submittedAt: null, acceptedAt: null,
        slaHours: payload.level === '紧急' ? 2 : payload.level === '严重' ? 8 : 24, slaDueAt: '--',
        downtimeFactId: null, downtimeDuringRepair: false,
        measures: '', verification: '', laborHours: null, parts: [],
        timeline: [{ type: '创建', time: at, actor: actor.userName, detail: `人工报修：${payload.faultDesc}` }],
        acceptance: null, reworkCount: 0,
      };
      const report = { reportId, code: reportId, title: order.title, deviceId, deviceName: device.name, deviceCode: order.deviceCode, faultType: order.faultType, level: order.level, faultTime: at, desc: payload.faultDesc, status: '已转工单', creator: actor.userName, createTime: at, linkedRepairOrderId: orderId, source: '人工报修' };
      let next = setE(setE(state, 'repairOrdersById', orderId, order), 'repairReportsById', reportId, report);
      next = addHistory(next, at, 'repair', orderId, '人工报修并生成主工单', { deviceId });
      return finish(next, action, true, `报修已提交，主工单 ${orderId}（待派工）`, { repairOrderId: orderId, reportId }, false, at);
    }
    case 'repair/assign': {
      const order = E.repairOrdersById[payload.repairOrderId];
      if (!order) return reject(state, action, '维修工单不存在');
      if (!canRepairTransition(order.status, '已派工')) return reject(state, action, `当前状态「${order.status}」不能派工`);
      if (!(payload.assignee || '').trim()) return reject(state, action, '派工必须指定维修人');
      const updated = { ...order, status: '已派工', assignee: payload.assignee, assigneeGroup: payload.assigneeGroup || order.assigneeGroup, assignedAt: at };
      let next = setE(state, 'repairOrdersById', order.repairOrderId, pushTimeline(updated, '派工', actor.userName, `派工至 ${payload.assigneeGroup || ''} ${payload.assignee}`, at));
      next = addHistory(next, at, 'repair', order.repairOrderId, `派工至 ${payload.assignee}`, { deviceId: order.deviceId });
      return finish(next, action, true, `${order.repairOrderId} 已派工至 ${payload.assignee}，等待接单开工`, { repairOrderId: order.repairOrderId }, false, at);
    }
    case 'repair/start': {
      const order = E.repairOrdersById[payload.repairOrderId];
      if (!order) return reject(state, action, '维修工单不存在');
      if (!canRepairTransition(order.status, '维修中')) return reject(state, action, `当前状态「${order.status}」不能开工`);
      const updated = { ...order, status: '维修中', startedAt: order.startedAt || at };
      let next = setE(state, 'repairOrdersById', order.repairOrderId, pushTimeline(updated, '开工', actor.userName || payload.assignee, '开始维修', at));
      // 维修联动：创建进行中的维修停机事实（关联 OEE 可用率）
      if (order.downtimeDuringRepair !== false && !Object.values(E.downtimeFactsById).some(f => f.relatedRepairOrderId === order.repairOrderId && f.status === '进行中')) {
        const dtId = `DT-${dateOnly(at).replaceAll('-', '')}-9${seq()}`;
        next = setE(next, 'downtimeFactsById', dtId, {
          downtimeId: dtId, deviceId: order.deviceId, deviceName: order.deviceName, category: '维修停机',
          start: at, end: null, minutes: null, reason: `维修工单 ${order.repairOrderId} 检修中`, source: '维修联动',
          status: '进行中', relatedAlarmId: order.alarmId, relatedRepairOrderId: order.repairOrderId, affectsProduction: true,
        });
        const latest = next.entities.repairOrdersById[order.repairOrderId];
        next = setE(next, 'repairOrdersById', order.repairOrderId, { ...latest, downtimeFactId: order.downtimeFactId || dtId });
      }
      next = addHistory(next, at, 'repair', order.repairOrderId, '开工维修', { deviceId: order.deviceId });
      return finish(next, action, true, `${order.repairOrderId} 开工；已生成维修停机事实并联动 OEE 可用率`, { repairOrderId: order.repairOrderId }, false, at);
    }
    case 'repair/pause': {
      const order = E.repairOrdersById[payload.repairOrderId];
      if (!order) return reject(state, action, '维修工单不存在');
      if (!canRepairTransition(order.status, '挂起')) return reject(state, action, `当前状态「${order.status}」不能挂起`);
      const updated = { ...order, status: '挂起', pauseReason: payload.reason || '' };
      let next = setE(state, 'repairOrdersById', order.repairOrderId, pushTimeline(updated, '挂起', actor.userName, payload.reason || '挂起', at));
      return finish(next, action, true, `${order.repairOrderId} 已挂起`, { repairOrderId: order.repairOrderId }, false, at);
    }
    case 'repair/resume': {
      const order = E.repairOrdersById[payload.repairOrderId];
      if (!order) return reject(state, action, '维修工单不存在');
      if (!canRepairTransition(order.status, '维修中')) return reject(state, action, `当前状态「${order.status}」不能恢复（仅挂起状态可恢复）`);
      let next = setE(state, 'repairOrdersById', order.repairOrderId, pushTimeline({ ...order, status: '维修中' }, '恢复', actor.userName, '恢复维修', at));
      return finish(next, action, true, `${order.repairOrderId} 已恢复维修`, { repairOrderId: order.repairOrderId }, false, at);
    }
    case 'repair/submit': {
      const order = E.repairOrdersById[payload.repairOrderId];
      if (!order) return reject(state, action, '维修工单不存在');
      if (!canRepairTransition(order.status, '待验收')) return reject(state, action, `当前状态「${order.status}」不能提交验收（提交后进入待验收，不直接完成）`);
      if (!(payload.measures || '').trim()) return reject(state, action, '必须填写维修措施');
      if (!(payload.verification || '').trim()) return reject(state, action, '必须填写验证方式/结果');
      const updated = { ...order, status: '待验收', measures: payload.measures, verification: payload.verification, submittedAt: at, laborHours: payload.laborHours ?? order.laborHours };
      let next = setE(state, 'repairOrdersById', order.repairOrderId, pushTimeline(updated, '提交', actor.userName, '提交验收', at));
      next = addHistory(next, at, 'repair', order.repairOrderId, '提交维修结果，进入待验收', { deviceId: order.deviceId });
      return finish(next, action, true, `${order.repairOrderId} 已提交，进入「待验收」；验收通过后设备才恢复`, { repairOrderId: order.repairOrderId }, false, at);
    }
    case 'repair/accept': {
      const order = E.repairOrdersById[payload.repairOrderId];
      if (!order) return reject(state, action, '维修工单不存在');
      if (order.status !== '待验收') return reject(state, action, `当前状态「${order.status}」不能验收`);
      const result = payload.result === '返修' ? '返修' : '通过';
      const acceptanceId = `AC-${dateOnly(at).replaceAll('-', '')}-${seq()}`;
      if (result === '返修') {
        const updated = { ...order, status: '维修中', reworkCount: (order.reworkCount || 0) + 1 };
        let next = setE(state, 'repairOrdersById', order.repairOrderId, pushTimeline(updated, '退回返修', actor.userName, payload.opinion || '验收退回返修', at));
        next = addHistory(next, at, 'repair', order.repairOrderId, '验收退回返修', { deviceId: order.deviceId, opinion: payload.opinion });
        return finish(next, action, true, `${order.repairOrderId} 已退回返修（原履历保留），状态回到「维修中」`, { repairOrderId: order.repairOrderId }, false, at);
      }
      // 通过：完成工单、结束维修停机、设备恢复、报警进入恢复待关闭（自动恢复类自动关闭）
      const updated = { ...order, status: '已完成', acceptedAt: at };
      const acceptance = { acceptanceId, repairOrderId: order.repairOrderId, result: '通过', opinion: payload.opinion || '验收通过', acceptanceTime: at, acceptor: actor.userName, deviceRestored: true };
      let next = setE(state, 'repairOrdersById', order.repairOrderId, pushTimeline(updated, '验收通过', actor.userName, payload.opinion || '验收通过', at));
      next = setE(next, 'repairAcceptancesById', acceptanceId, acceptance);
      // 结束进行中的维修/故障停机事实
      Object.values(next.entities.downtimeFactsById).forEach(f => {
        if (f.relatedRepairOrderId === order.repairOrderId && f.status === '进行中') {
          next = setE(next, 'downtimeFactsById', f.downtimeId, { ...f, end: at, status: '已结束' });
        }
      });
      if (order.alarmId && next.entities.alarmEventsById[order.alarmId]) {
        next = reducer(next, { type: 'alarm/recover', payload: { alarmId: order.alarmId, evidence: `维修验收通过（${order.repairOrderId}）` }, actorContext: actor, at, internal: true });
      }
      next = addHistory(next, at, 'repair', order.repairOrderId, '验收通过，设备恢复', { deviceId: order.deviceId, acceptanceId });
      return finish(next, action, true, `${order.repairOrderId} 验收通过：设备恢复、关联停机结束、报警进入恢复流程`, { repairOrderId: order.repairOrderId, acceptanceId }, false, at);
    }
    case 'repair/reject': {
      return reducer(state, { ...action, type: 'repair/accept', payload: { ...payload, result: '返修' }, internal: true });
    }

    // ================= 备件 =================
    case 'spare/consume': {
      const { repairOrderId, spareCode, warehouseId, qty, requestId, person } = payload;
      const order = E.repairOrdersById[repairOrderId];
      if (!order) return reject(state, action, '维修工单不存在');
      if (!['已派工', '维修中'].includes(order.status)) return reject(state, action, `工单状态「${order.status}」不允许领料出库`);
      const stockKey = `${warehouseId}|${spareCode}`;
      const stockRow = E.stockByKey[stockKey];
      const check = validateOutbound(stockRow, qty);
      if (!check.ok) return reject(state, action, check.error);
      const idemKey = outboundIdempotencyKey(repairOrderId, spareCode, requestId);
      const outboundId = `OB-${dateOnly(at).replaceAll('-', '')}-${seq()}`;
      const spare = E.sparesByCode[spareCode];
      const outbound = {
        outboundId, code: `ck${dateOnly(at).replaceAll('-', '')}${seq()}`, type: '维修出库', repairOrderId,
        idempotencyKey: idemKey, warehouseId, date: dateOnly(at), status: '已出库', person: person || actor.userName, creator: actor.userName,
        createTime: at, remark: `维修任务 ${repairOrderId} 领料。`,
        items: [{ spareCode, spareName: spare?.name || spareCode, unit: spare?.unit || '--', qty }],
      };
      let next = setE(state, 'outboundsById', outboundId, outbound);
      next = setE(next, 'stockByKey', stockKey, { ...stockRow, onHand: stockRow.onHand - qty, outboundDone: (stockRow.outboundDone || 0) + qty });
      const flowId = `SF-${outboundId}`;
      next = setE(next, 'stockFlowsById', flowId, { flowId, time: at, warehouseId, spareCode, type: '维修出库', qty: -qty, balanceAfter: stockRow.onHand - qty, ref: outboundId, note: `${repairOrderId} 领料` });
      next = setE(next, 'repairOrdersById', repairOrderId, pushTimeline({ ...order, parts: [...(order.parts || []), { spareCode, spareName: spare?.name || spareCode, qty, warehouseId, outboundId }] }, '领料', actor.userName, `${spare?.name || spareCode} ×${qty}（${warehouseId}）`, at));
      next = addHistory(next, at, 'spare', outboundId, `维修出库 ${spare?.name || spareCode} ×${qty}（${warehouseId}）→ ${repairOrderId}`, { repairOrderId, spareCode });
      return finish(next, action, true, `出库单 ${outboundId}：${spare?.name || spareCode} ×${qty}，${warehouseId} 可用库存 −${qty}`, { outboundId, repairOrderId, stockKey }, false, at);
    }
    case 'spare/return': {
      const { outboundId, qty, reason, requestId } = payload;
      const outbound = E.outboundsById[outboundId];
      if (!outbound) return reject(state, action, '出库单不存在');
      const item = outbound.items[0];
      const alreadyReturned = Object.values(E.returnsById).filter(r => r.outboundId === outboundId).reduce((s, r) => s + r.qty, 0);
      const check = validateReturn(item.qty, alreadyReturned, qty);
      if (!check.ok) return reject(state, action, check.error);
      const stockKey = `${outbound.warehouseId}|${item.spareCode}`;
      const stockRow = E.stockByKey[stockKey];
      const returnId = `RT-${dateOnly(at).replaceAll('-', '')}-${seq()}`;
      const record = { returnId, code: `th${dateOnly(at).replaceAll('-', '')}${seq()}`, outboundId, warehouseId: outbound.warehouseId, date: dateOnly(at), status: '已退库', spareCode: item.spareCode, spareName: item.spareName, unit: item.unit, qty, reason: reason || '余料退库', person: actor.userName, createTime: at };
      let next = setE(state, 'returnsById', returnId, record);
      if (stockRow) next = setE(next, 'stockByKey', stockKey, { ...stockRow, onHand: stockRow.onHand + qty });
      const flowId = `SF-${returnId}`;
      next = setE(next, 'stockFlowsById', flowId, { flowId, time: at, warehouseId: outbound.warehouseId, spareCode: item.spareCode, type: '退库', qty, balanceAfter: stockRow ? stockRow.onHand + qty : null, ref: returnId, note: reason || '余料退库' });
      next = addHistory(next, at, 'spare', returnId, `退库 ${item.spareName} ×${qty}（${outbound.warehouseId}）`, { outboundId });
      return finish(next, action, true, `退库单 ${returnId}：${item.spareName} ×${qty} 已回冲 ${outbound.warehouseId} 现存`, { returnId }, false, at);
    }
    case 'spare/inbound': {
      const { spareCode, warehouseId, qty, requestId, supplier, batch, handler } = payload;
      const stockKey = `${warehouseId}|${spareCode}`;
      const spare = E.sparesByCode[spareCode];
      if (!spare) return reject(state, action, '备件不存在');
      const inboundId = `IB-${dateOnly(at).replaceAll('-', '')}-${seq()}`;
      const stockRow = E.stockByKey[stockKey];
      const record = { inboundId, code: `rk${dateOnly(at).replaceAll('-', '')}${seq()}`, supplier: supplier || '--', buyer: handler || actor.userName, date: dateOnly(at), status: '已入库', creator: actor.userName, createTime: at, remark: '入库', items: [{ spareCode, spareName: spare.name, unit: spare.unit, warehouseId, qty, batch: batch || '--' }] };
      let next = setE(state, 'inboundsById', inboundId, record);
      if (stockRow) next = setE(next, 'stockByKey', stockKey, { ...stockRow, onHand: stockRow.onHand + qty });
      else next = setE(next, 'stockByKey', stockKey, { stockKey, warehouseId, spareCode, onHand: qty, reserved: 0, outboundDone: 0, returned: 0, batch: batch || 'B-DEMO' });
      const flowId = `SF-${inboundId}`;
      next = setE(next, 'stockFlowsById', flowId, { flowId, time: at, warehouseId, spareCode, type: '入库', qty, balanceAfter: (stockRow?.onHand || 0) + qty, ref: inboundId, note: '入库' });
      return finish(next, action, true, `入库单 ${inboundId}：${spare.name} ×${qty} → ${warehouseId}`, { inboundId }, false, at);
    }

    // ================= 停机 =================
    case 'downtime/save': {
      const fact = payload.fact;
      const errors = validateDowntime(fact, Object.values(E.downtimeFactsById));
      if (!errors.ok && errors.errors?.length) return reject(state, action, `停机登记校验未通过：${errors.errors.join('；')}`);
      const device = E.devicesById[fact.deviceId];
      if (!device) return reject(state, action, '设备不存在');
      const dtId = fact.downtimeId || `DT-${dateOnly(at).replaceAll('-', '')}-${seq()}`;
      const end = fact.end || null;
      let minutes = fact.minutes;
      if (end) minutes = Math.round((new Date(end) - new Date(fact.start)) / 60000);
      const record = { downtimeId: dtId, deviceId: fact.deviceId, deviceName: device.name, category: fact.category, start: fact.start, end, minutes, reason: fact.reason || '', source: fact.source || '人工登记', status: end ? '已结束' : '进行中', relatedAlarmId: fact.relatedAlarmId || null, relatedRepairOrderId: fact.relatedRepairOrderId || null, affectsProduction: fact.category !== '数据中断' };
      let next = setE(state, 'downtimeFactsById', dtId, record);
      next = addHistory(next, at, 'downtime', dtId, `停机事实登记：${fact.category}（${device.name}）`, { deviceId: fact.deviceId });
      // 计划停机影响可用率 → 触发 OEE 重算任务记录
      if (['计划停机', '换模'].includes(fact.category)) {
        const rcId = `RC-${dateOnly(at).replaceAll('-', '')}-${seq()}`;
        next = setE(next, 'oeeRecomputeLogById', rcId, { recomputeId: rcId, deviceId: fact.deviceId, range: `${dateOnly(fact.start)}`, reason: `停机事实 ${dtId} 变更`, at, revision: Object.keys(next.entities.oeeRecomputeLogById).length + 1 });
        return finish(next, action, true, `停机事实 ${dtId} 已保存；已触发 ${device.name} 的 OEE 重算（受影响区间 ${dateOnly(fact.start)}）`, { downtimeId: dtId, recomputeId: rcId }, false, at);
      }
      return finish(next, action, true, `停机事实 ${dtId} 已保存（${fact.category}）`, { downtimeId: dtId }, false, at);
    }
    case 'downtime/delete': {
      const fact = E.downtimeFactsById[payload.downtimeId];
      if (!fact) return reject(state, action, '停机事实不存在');
      if (fact.status !== '待执行') {
        // 已发生的停机只能取消（留痕），不能删除
        let next = setE(state, 'downtimeFactsById', fact.downtimeId, { ...fact, status: '已取消', reason: `${fact.reason}（取消原因：${payload.reason || '人工取消'}）` });
        const rcId = `RC-${dateOnly(at).replaceAll('-', '')}-${seq()}`;
        next = setE(next, 'oeeRecomputeLogById', rcId, { recomputeId: rcId, deviceId: fact.deviceId, range: dateOnly(fact.start), reason: `停机事实 ${fact.downtimeId} 取消`, at, revision: Object.keys(next.entities.oeeRecomputeLogById).length + 1 });
        return finish(next, action, true, `停机事实 ${fact.downtimeId} 已取消留痕并触发 OEE 重算（进行中/已结束事实不物理删除）`, { downtimeId: fact.downtimeId, recomputeId: rcId }, false, at);
      }
      let next = { ...state, entities: { ...state.entities, downtimeFactsById: { ...state.entities.downtimeFactsById } } };
      delete next.entities.downtimeFactsById[payload.downtimeId];
      next = addHistory(next, at, 'downtime', payload.downtimeId, '删除待执行计划停机', { deviceId: fact.deviceId });
      return finish(next, action, true, `待执行停机 ${payload.downtimeId} 已删除`, {}, false, at);
    }

    // ================= OEE =================
    case 'oee/saveSpeed': {
      const cfg = E.speedConfigsById[payload.configId];
      if (!cfg) return reject(state, action, '速度配置不存在');
      if (!(payload.idealSpeed > 0)) return reject(state, action, '理想速度必须为正数');
      const updated = { ...cfg, idealSpeed: payload.idealSpeed, version: (cfg.version || 1) + 1, effectiveFrom: dateOnly(at), status: '生效' };
      let next = setE(state, 'speedConfigsById', cfg.id, updated);
      const rcId = `RC-${dateOnly(at).replaceAll('-', '')}-${seq()}`;
      next = setE(next, 'oeeRecomputeLogById', rcId, { recomputeId: rcId, deviceId: cfg.deviceId, range: `${dateOnly(at)} 起`, reason: `理想速度配置 v${updated.version} 变更`, at, revision: Object.keys(next.entities.oeeRecomputeLogById).length + 1 });
      next = addHistory(next, at, 'oee', cfg.id, `理想速度变更为 ${payload.idealSpeed}（v${updated.version}）`, { deviceId: cfg.deviceId });
      return finish(next, action, true, `速度配置已保存：v${updated.version}，生效 ${dateOnly(at)}；受影响设备 ${cfg.deviceName}，已触发 OEE 重算`, { configId: cfg.id, recomputeId: rcId }, false, at);
    }
    case 'oee/saveConfig': {
      const target = payload.target;
      if (!(target > 0 && target <= 100)) return reject(state, action, 'OEE 目标必须为 0 ~ 100 之间的数值');
      const prev = E.oeeTargetsByDeviceId[payload.deviceId];
      const updated = { deviceId: payload.deviceId, target, version: (prev?.version || 0) + 1, effectiveFrom: dateOnly(at), scope: payload.scope || '全部物料' };
      let next = setE(state, 'oeeTargetsByDeviceId', payload.deviceId, updated);
      next = addHistory(next, at, 'oee', payload.deviceId, `OEE 目标变更为 ${target}%（v${updated.version}）`, {});
      return finish(next, action, true, `OEE 目标已保存：${target}%（v${updated.version}）`, { deviceId: payload.deviceId }, false, at);
    }
    case 'oee/recompute': {
      const rcId = `RC-${dateOnly(at).replaceAll('-', '')}-${seq()}`;
      const range = payload.range || `${payload.deviceId} 全部窗口`;
      const log = { recomputeId: rcId, deviceId: payload.deviceId, range, reason: payload.reason || '人工触发重算', at, revision: Object.keys(E.oeeRecomputeLogById).length + 1 };
      let next = setE(state, 'oeeRecomputeLogById', rcId, log);
      next = addHistory(next, at, 'oee', payload.deviceId || '--', `OEE 重算：${range}`, {});
      return finish(next, action, true, `OEE 重算完成（${range}）：结果按当前停机事实与配置重新推导`, { recomputeId: rcId }, false, at);
    }

    // ================= 报表 / 导出 =================
    case 'report/run': {
      const id = `RPT-${dateOnly(at).replaceAll('-', '')}-${seq()}`;
      const record = { reportId: id, theme: payload.theme, filters: payload.filters || {}, statsCutoff: state.meta.lastSampleAt, source: state.meta.source, generatedAt: at };
      let next = setE(state, 'reportsByKey', id, record);
      return finish(next, action, true, `查询完成（口径截止 ${record.statsCutoff}）`, { reportId: id }, false, at);
    }
    case 'report/createExport': {
      const id = `EXP-${dateOnly(at).replaceAll('-', '')}-${seq()}`;
      const record = { exportId: id, theme: payload.theme, filters: payload.filters || {}, status: '成功', note: '导出内容', createdAt: at, statsCutoff: state.meta.lastSampleAt };
      let next = setE(state, 'exportTasksById', id, record);
      return finish(next, action, true, `导出任务 ${id} 已创建（口径截止 ${record.statsCutoff}）`, { exportId: id }, false, at);
    }

    // ================= 大屏 =================
    case 'screen/setPage': {
      const next = { ...state, ui: { ...state.ui, screenPage: payload.page } };
      return finish(next, action, true, `大屏切换到 ${payload.page}`, {}, false, at);
    }

    default:
      return reject(state, action, `未知动作类型：${action.type}`);
  }
}
