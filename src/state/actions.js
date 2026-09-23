// ============================================================
// 动作层（§5.1 / §5.2 / §9 跨模块动作矩阵）
// 职责：入参预校验 → 构造符合 §5.1 结构的 action → dispatch；
//       返回 { ok, message, refs } 作为用户反馈（toast 只作辅助，状态变化以 reducer 为准）。
// 幂等键按设计约束构造，重复请求由 reducer 命中登记后返回同一结果。
// ============================================================

import { canAlarmTransition } from '../domain/alarm.js';
import { canRepairTransition } from '../domain/repair.js';
import { validateOutbound, validateReturn } from '../domain/spare.js';

let actionSeq = 0;
const nextActionId = () => `demo-action-20260916-${String(++actionSeq).padStart(4, '0')}`;

export function createDemoActions(state, dispatch) {
  const E = state.entities;
  const actor = state.meta.actorContext || { userId: 'demo-user', userName: '管理员', source: 'host-context' };

  const act = (type, payload, idempotencyKey) => {
    // Action 结果契约：返回 reducer 的真实结果 { ok, message, refs }（meta.lastAction）
    return dispatch({ type, payload, actorContext: actor, actionId: nextActionId(), idempotencyKey, at: undefined });
  };
  const fail = (message) => ({ ok: false, message, refs: {} });

  return {
    // ---------- 设备生命周期（简化流程） ----------
    createLifecycleTask(payload = {}) {
      const taskId = `LT-${String(Object.keys(E.lifecycleTasksById || {}).length + 1).padStart(3, '0')}`;
      const taskNo = `LCT-${String(state.meta.demoDay || '2026-09-18').replaceAll('-', '')}-${String(Object.keys(E.lifecycleTasksById || {}).length + 1).padStart(3, '0')}`;
      if (!(payload.equipmentName || '').trim()) return fail('设备名称必填');
      if (!(payload.model || '').trim()) return fail('型号必填');
      if (!(payload.brand || '').trim()) return fail('品牌必填');
      if (!(payload.quantity > 0)) return fail('数量必须大于 0');
      if (!(payload.shipDate || '').trim()) return fail('发货时间必填');
      if (!(payload.contractNo || '').trim()) return fail('合同号必填');
      if (!(payload.useDept || '').trim()) return fail('使用部门必填');
      if ((payload.sourceType || 'MANUAL') === 'MANUAL' && !(payload.sourceNote || '').trim()) return fail('手工新增必须填写来源说明');
      act('lifecycle/createTask', {
        taskId,
        taskNo,
        sourceType: payload.sourceType || 'MANUAL',
        equipmentName: payload.equipmentName.trim(),
        model: payload.model.trim(),
        quantity: Number(payload.quantity),
        brand: payload.brand.trim(),
        supplier: payload.supplier || '--',
        purchaseOrderNo: payload.purchaseOrderNo || '--',
        contractNo: payload.contractNo.trim(),
        shipDate: payload.shipDate,
        useDept: payload.useDept,
        trialOwner: payload.trialOwner || actor.userName,
        attachments: payload.attachments || [],
      }, `lifecycle-create:${taskId}`);
      return { ok: true, message: `采购入账任务 ${taskNo} 已创建`, refs: { taskId, taskNo } };
    },
    submitLifecycleProcurement(taskId, payload = {}) {
      const task = E.lifecycleTasksById?.[taskId];
      if (!task) return fail('生命周期任务不存在');
      if (!['采购入账待提交', '采购入账待修改', '试用不合格退回'].includes(task.status)) return fail(`当前状态「${task.status}」不能提交采购入账`);
      if (!(payload.equipmentName || task.equipmentName || '').trim()) return fail('设备名称必填');
      if (!(payload.model || task.model || '').trim()) return fail('型号必填');
      if (!(payload.brand || task.brand || '').trim()) return fail('品牌必填');
      if (!((payload.quantity ?? task.quantity) > 0)) return fail('数量必须大于 0');
      if (!(payload.shipDate || task.shipDate)) return fail('发货时间必填');
      if (!(payload.contractNo || task.contractNo || '').trim()) return fail('合同号必填');
      act('lifecycle/submitProcurement', { taskId, ...payload }, `lifecycle-procurement:${taskId}:v${(task.version || 0) + 1}`);
      return { ok: true, message: '采购入账已提交，已生成使用部门试用确认任务', refs: { taskId } };
    },
    confirmLifecycleTrial(taskId, payload = {}) {
      const task = E.lifecycleTasksById?.[taskId];
      if (!task) return fail('生命周期任务不存在');
      if (task.status !== '使用部门试用确认中') return fail(`当前状态「${task.status}」不能试用确认`);
      if (!['合格', '不合格'].includes(payload.result)) return fail('请选择试用结论');
      if (!(payload.opinion || '').trim()) return fail('试用意见必填');
      if (payload.result === '不合格' && !(payload.problem || '').trim()) return fail('不合格时必须填写主要问题');
      act('lifecycle/confirmTrial', { taskId, result: payload.result, opinion: payload.opinion, problem: payload.problem || '' }, `lifecycle-trial:${taskId}:v${(task.version || 0) + 1}`);
      return { ok: true, message: payload.result === '合格' ? '试用确认合格，已转设备手续入账' : '试用确认不合格，已退回采购', refs: { taskId } };
    },
    registerLifecycleDevice(taskId, payload = {}) {
      const task = E.lifecycleTasksById?.[taskId];
      if (!task) return fail('生命周期任务不存在');
      if (task.status !== '待设备手续入账') return fail(`当前状态「${task.status}」不能办理设备入账`);
      if (!(payload.acceptanceFile || '').trim()) return fail('验收单附件必传');
      if (!(payload.archiveFile || '').trim()) return fail('设备档案附件必传');
      if (!(payload.owner || '').trim()) return fail('设备负责人必填');
      if (!(payload.workshopName || '').trim()) return fail('车间必填');
      act('lifecycle/registerDevice', { taskId, ...payload }, `lifecycle-register:${taskId}:v${(task.version || 0) + 1}`);
      return { ok: true, message: '设备手续已办理，设备台账已入账', refs: { taskId } };
    },
    createAssetChange(payload = {}) {
      if (!payload.deviceId) return fail('设备必选');
      const device = E.devicesById?.[payload.deviceId];
      if (!device) return fail('设备不存在');
      if (device.lifecycleStatus === '报废/归档') return fail('已报废归档设备不能发起变更');
      if (!['调拨', '改造', '借用', '外送'].includes(payload.type)) return fail('变更类型不合法');
      if (!(payload.reason || '').trim()) return fail('变更原因必填');
      const changeId = `ACG-${String(Object.keys(E.assetChangeRecordsById || {}).length + 1).padStart(3, '0')}`;
      const from = { dept: device.workshopName || '--', owner: device.owner || '--', lifecycleStatus: device.lifecycleStatus };
      act('lifecycle/createChange', { changeId, changeNo: `变更-${String(state.meta.demoDay || '').replaceAll('-', '')}-${String(Object.keys(E.assetChangeRecordsById || {}).length + 1).padStart(3, '0')}`, from, ...payload }, `lifecycle-change:${changeId}`);
      return { ok: true, message: '资产变更申请已提交', refs: { changeId } };
    },
    approveAssetChange(changeId, approved = true, opinion = '') {
      const record = E.assetChangeRecordsById?.[changeId];
      if (!record) return fail('变更申请不存在');
      if (record.status !== '待审批') return fail(`当前状态「${record.status}」不能审批`);
      act('lifecycle/approveChange', { changeId, approved, opinion }, `lifecycle-change-approve:${changeId}:v${record.version || 0}`);
      return { ok: true, message: approved ? '变更申请已审批通过' : '变更申请已驳回', refs: { changeId } };
    },
    completeAssetChange(changeId, payload = {}) {
      const record = E.assetChangeRecordsById?.[changeId];
      if (!record) return fail('变更申请不存在');
      if (record.status !== '审批通过') return fail(`当前状态「${record.status}」不能执行`);
      act('lifecycle/completeChange', { changeId, ...payload }, `lifecycle-change-complete:${changeId}:v${record.version || 0}`);
      return { ok: true, message: '资产变更已执行并写入设备履历', refs: { changeId } };
    },
    createIdleApplication(payload = {}) {
      if (!payload.deviceId) return fail('设备必选');
      const device = E.devicesById?.[payload.deviceId];
      if (!device) return fail('设备不存在');
      if (device.lifecycleStatus !== '在用') return fail(`当前设备状态「${device.lifecycleStatus}」不能申请闲置`);
      if (Object.values(E.idleApplicationsById || {}).some(r => r.deviceId === payload.deviceId && ['复核中', '待审批'].includes(r.status))) return fail('该设备已有闲置复核单');
      if (!(payload.reason || '').trim()) return fail('闲置原因必填');
      const idleId = `IDLE-${String(Object.keys(E.idleApplicationsById || {}).length + 1).padStart(3, '0')}`;
      act('lifecycle/createIdle', { idleId, idleNo: `闲置-${String(state.meta.demoDay || '').replaceAll('-', '')}-${String(Object.keys(E.idleApplicationsById || {}).length + 1).padStart(3, '0')}`, ...payload }, `lifecycle-idle:${idleId}`);
      return { ok: true, message: '闲置申请已提交', refs: { idleId } };
    },
    reviewIdleApplication(idleId, result, opinion = '') {
      const record = E.idleApplicationsById?.[idleId];
      if (!record) return fail('闲置申请不存在');
      if (!['复核中', '待审批'].includes(record.status)) return fail(`当前状态「${record.status}」不能复核`);
      if (!['继续闲置', '再启用', '转报废'].includes(result)) return fail('复核结论不合法');
      act('lifecycle/reviewIdle', { idleId, result, opinion }, `lifecycle-idle-review:${idleId}:v${record.version || 0}`);
      return { ok: true, message: `闲置复核已提交：${result}`, refs: { idleId } };
    },
    createScrapApplication(payload = {}) {
      if (!payload.deviceId) return fail('设备必选');
      const device = E.devicesById?.[payload.deviceId];
      if (!device) return fail('设备不存在');
      if (['报废/归档', '报废申请中'].includes(device.lifecycleStatus)) return fail(`当前设备状态「${device.lifecycleStatus}」不能重复申请报废`);
      if (Object.values(E.scrapApplicationsById || {}).some(r => r.deviceId === payload.deviceId && !['鉴定未通过'].includes(r.status))) return fail('该设备已有报废流程单');
      if (!(payload.reason || '').trim()) return fail('报废原因必填');
      const scrapId = `SCR-${String(Object.keys(E.scrapApplicationsById || {}).length + 1).padStart(3, '0')}`;
      act('lifecycle/createScrap', { scrapId, scrapNo: `报废-${String(state.meta.demoDay || '').replaceAll('-', '')}-${String(Object.keys(E.scrapApplicationsById || {}).length + 1).padStart(3, '0')}`, ...payload }, `lifecycle-scrap:${scrapId}`);
      return { ok: true, message: '报废申请已提交，等待技术鉴定', refs: { scrapId } };
    },
    appraiseScrap(scrapId, result, opinion = '') {
      const record = E.scrapApplicationsById?.[scrapId];
      if (!record) return fail('报废申请不存在');
      if (record.status !== '技术鉴定中') return fail(`当前状态「${record.status}」不能鉴定`);
      if (!['同意报废', '不建议报废'].includes(result)) return fail('鉴定结论不合法');
      if (!(opinion || '').trim()) return fail('鉴定意见必填');
      act('lifecycle/appraiseScrap', { scrapId, result, opinion }, `lifecycle-scrap-appraise:${scrapId}:v${record.version || 0}`);
      return { ok: true, message: result === '同意报废' ? '技术鉴定通过，等待财务核销' : '技术鉴定未通过', refs: { scrapId } };
    },
    confirmScrapWriteOff(scrapId, payload = {}) {
      const record = E.scrapApplicationsById?.[scrapId];
      if (!record) return fail('报废申请不存在');
      if (record.status !== '待财务核销') return fail(`当前状态「${record.status}」不能核销`);
      if (!(payload.writeOffNo || '').trim()) return fail('财务核销单号必填');
      act('lifecycle/writeOffScrap', { scrapId, ...payload }, `lifecycle-scrap-writeoff:${scrapId}:v${record.version || 0}`);
      return { ok: true, message: '财务核销已确认，设备已报废', refs: { scrapId } };
    },
    archiveScrap(scrapId) {
      const record = E.scrapApplicationsById?.[scrapId];
      if (!record) return fail('报废申请不存在');
      if (record.status !== '已报废') return fail(`当前状态「${record.status}」不能归档`);
      act('lifecycle/archiveScrap', { scrapId }, `lifecycle-scrap-archive:${scrapId}:v${record.version || 0}`);
      return { ok: true, message: '报废记录已归档', refs: { scrapId } };
    },
    // ---------- 绑定 ----------
    saveBinding(deviceId, summary) {
      const draft = (state.ui.bindingDraftsByDeviceId || {})[`draft-${deviceId}`];
      if (!draft) return fail('没有待保存的绑定草稿');
      const current = E.bindingsByDeviceId[deviceId];
      const version = (current?.version || 0) + 1;
      act('binding/save', { deviceId, summary }, `binding:${deviceId}:v${version}`);
      return { ok: true, message: `绑定 v${version} 已保存，状态「待生效」；启用后生效`, refs: { deviceId, version } };
    },
    enableBinding(deviceId) {
      const b = E.bindingsByDeviceId[deviceId];
      if (!b) return fail('该设备尚未创建绑定');
      if (!['待生效', '换绑中'].includes(b.configStatus)) return fail(`当前状态「${b.configStatus}」不能启用`);
      act('binding/enable', { deviceId }, `binding-enable:${deviceId}:v${b.version}`);
      return { ok: true, message: `绑定 v${b.version} 已启用，影响监测/报警/OEE/报表/大屏`, refs: { deviceId, bindingId: b.bindingId } };
    },
    disableBinding(deviceId, opts = {}) {
      const b = E.bindingsByDeviceId[deviceId];
      if (!b) return fail('该设备尚未创建绑定');
      if (b.configStatus !== '已启用') return fail(`当前状态「${b.configStatus}」不能停用`);
      act('binding/disable', { deviceId, reason: opts?.reason || '' }, `binding-disable:${deviceId}:v${b.version}`);
      return { ok: true, message: `绑定 v${b.version} 已停用`, refs: { deviceId } };
    },
    addBindingSource(deviceId, source) {
      act('binding/addSource', { deviceId, source });
      return { ok: true, message: `已将 ${source.iotDeviceCode} 加入绑定草稿（未保存）`, refs: { deviceId } };
    },
    removeBindingSource(deviceId, iotDeviceId) {
      act('binding/removeSource', { deviceId, iotDeviceId });
      return { ok: true, message: '已从绑定草稿移除（未保存）', refs: { deviceId } };
    },
    toggleBindingMetric(deviceId, iotDeviceId, metricCode) {
      act('binding/toggleMetric', { deviceId, iotDeviceId, metricCode });
      return { ok: true, message: '指标选择已切换（未保存）', refs: { deviceId } };
    },
    saveBindingTemplate(template) {
      act('bindingTemplate/save', { template });
      return { ok: true, message: `绑定模板「${template.name}」已保存，可在「应用到设备」中批量使用`, refs: { templateId: template.templateId } };
    },
    deleteBindingTemplate(templateId, name) {
      act('bindingTemplate/delete', { templateId });
      return { ok: true, message: `绑定模板「${name}」已删除`, refs: {} };
    },
    // 批量应用模板：按模板结构为每台设备构造绑定（IoT 来源编码演示模拟：
    // 由物联网平台按设备自动分配专属编码 IOT-2xx，全局唯一，不与已占用编码冲突）
    applyBindingTemplate({ deviceIds, template, autoEnable }) {
      if (!template) return fail('请先选择绑定模板');
      if (!deviceIds || deviceIds.length === 0) return fail('请先选择要应用的设备');
      let seq = 0;
      const bindings = deviceIds.map((deviceId) => {
        const current = E.bindingsByDeviceId[deviceId];
        const version = (current?.version || 0) + 1;
        const bindingId = `binding-${deviceId.replace('DEV-', 'D')}-${version >= 10 ? '' : '0'}${version}`;
        const device = E.devicesById[deviceId];
        const items = (template.items || []).map((t) => {
          seq += 1;
          return {
            iotDeviceId: `iot-auto-${bindingId}-${seq}`, iotDeviceCode: `IOT-2${100 + seq}`,
            name: `${device?.name || deviceId} ${t.sensorType || '来源设备'}`,
            sensorType: t.sensorType || '来源设备',
            enabled: true,
            metrics: (t.metrics || []).map(m => ({ ...m, selected: true })),
          };
        });
        return { deviceId, bindingId, version, configStatus: autoEnable ? '已启用' : '待生效', items, summary: `应用模板「${template.name}」` };
      });
      act('binding/applyTemplate', { bindings, autoEnable, templateName: template.name });
      return {
        ok: true,
        message: `模板「${template.name}」已应用到 ${deviceIds.length} 台设备（${autoEnable ? '已启用，影响监测/报警/OEE/报表' : '待生效，需再点「启用」'}）`,
        refs: { deviceIds },
      };
    },

    // ---------- 实时 ----------
    refreshRealtime() {
      act('realtime/refresh', {});
      return { ok: true, message: '数据刷新完成', refs: {} };
    },
    setProviderMode(mode) {
      act('realtime/setProviderMode', { mode });
      const label = { 'mock-polling': '轮询', 'mock-subscription': '订阅', disconnect: '断开（降级）' }[mode];
      return { ok: true, message: `已切换为${label}`, refs: {} };
    },

    // ---------- 报警 ----------
    ackAlarm(alarmId, { note }) {
      const alarm = E.alarmEventsById[alarmId];
      if (!alarm) return fail('报警事件不存在');
      if (!(note || '').trim()) return fail('确认必须填写说明');
      if (!canAlarmTransition(alarm.status, '已确认')) return fail(`当前状态「${alarm.status}」不能确认`);
      act('alarm/ack', { alarmId, note }, `ack:${alarmId}:v1`);
      return { ok: true, message: `已确认 ${alarm.id}，下一步：处置（填写措施与预计完成时间）`, refs: { alarmId } };
    },
    handleAlarm(alarmId, { measure, expectedAt }) {
      const alarm = E.alarmEventsById[alarmId];
      if (!alarm) return fail('报警事件不存在');
      if (!(measure || '').trim()) return fail('处置必须填写措施');
      if (!expectedAt) return fail('处置必须填写预计完成时间');
      if (alarm.status === '已关闭') return fail('已关闭报警不能处置');
      act('alarm/handle', { alarmId, measure, expectedAt }, `handle:${alarmId}:v1`);
      return { ok: true, message: '处置已记录；如需维修请使用「转维修申请」', refs: { alarmId } };
    },
    createRepairFromAlarm(alarmId, extra = {}) {
      const alarm = E.alarmEventsById[alarmId];
      if (!alarm) return fail('报警事件不存在');
      const existing = Object.values(E.repairOrdersById).find(o => o.alarmId === alarmId && !['已完成', '已取消'].includes(o.status));
      if (existing) {
        return { ok: true, idempotent: true, message: `该报警已存在活动工单 ${existing.repairOrderId}，不重复建单`, refs: { repairOrderId: existing.repairOrderId } };
      }
      if (alarm.status === '已关闭') return fail('已关闭报警不能转维修；如需维修请人工报修');
      act('alarm/createRepairFromAlarm', { alarmId, ...extra }, `repair-from-alarm:${alarmId}`);
      return {
        ok: true,
        message: extra?.dispatch?.assignee
          ? `已生成唯一主工单并直接派工至 ${extra.dispatch.assignee}；可在「维修任务」中开工执行`
          : '已生成唯一主工单并回写至报警；请到「维修任务」派工',
        refs: { alarmId },
      };
    },
    closeAlarm(alarmId, { evidence, closeReason }) {
      const alarm = E.alarmEventsById[alarmId];
      if (!alarm) return fail('报警事件不存在');
      if (alarm.status !== '已恢复待关闭') return fail(`当前状态「${alarm.status}」，只有「已恢复待关闭」可关闭`);
      if (!(evidence || '').trim() || !(closeReason || '').trim()) return fail('关闭必须填写恢复证据和原因');
      act('alarm/close', { alarmId, evidence, closeReason }, `close:${alarmId}:v1`);
      return { ok: true, message: `已关闭 ${alarm.id}`, refs: { alarmId } };
    },

    // 规则动作（M0 Action 结果契约）：act 返回 dispatch 的真实结果（meta.lastAction），
    // 页面据此提示成功/失败；保存、发布、批量提交统一此方式。
    saveRuleDraft(rule) {
      const code = (rule.code || '').trim();
      const name = (rule.name || '').trim();
      if (!code) return fail('规则编号必填');
      if (!name) return fail('规则名称必填');
      return act('alarm/rule/saveDraft', { rule: { ...rule, code, name } });
    },
    saveAndPublishRule(rule) {
      const code = (rule.code || '').trim();
      const name = (rule.name || '').trim();
      if (!code) return fail('规则编号必填');
      if (!name) return fail('规则名称必填');
      return act('alarm/rule/saveAndPublish', { rule: { ...rule, code, name } });
    },
    publishRule(ruleCode) {
      const rule = E.alarmRulesById[ruleCode];
      if (!rule) return fail('规则不存在');
      if (rule.status !== '草稿' && !rule.draftConfig) return fail(`当前状态「${rule.status}」，只有草稿或存在待发布草稿时可发布`);
      return act('alarm/rule/publish', { ruleCode });
    },
    disableRule(ruleCode, reason = '') {
      const rule = E.alarmRulesById[ruleCode];
      if (!rule) return fail('规则不存在');
      if (rule.status !== '已发布') return fail(`当前状态「${rule.status}」，不能停用`);
      return act('alarm/rule/disable', { ruleCode, reason }, `alarm-rule-disable:${ruleCode}`);
    },

    // ---------- 批量创建（M3-M4） ----------
    // 预览为纯计算（不改状态）：按 canonical 目标逐条校验并分组，返回 rows/summary/groups
    previewBatchRules(request) {
      if (!request?.targets?.length) return fail('请先选择要批量创建的目标');
      if (!request.triggerConfig || request.triggerConfig.threshold === null || request.triggerConfig.threshold === undefined || request.triggerConfig.threshold === '') {
        return fail('触发阈值必填');
      }
      const rules = E.alarmRulesById || {};
      const rows = request.targets.map((target) => {
        const device = E.devicesById[target.deviceId];
        const binding = E.bindingsByDeviceId[target.deviceId];
        if (!device || !binding || binding.configStatus !== '已启用') {
          return { targetKey: target.key, deviceId: target.deviceId, deviceName: target.deviceName, metricCode: target.metricCode, result: 'blocked', reason: !device ? '设备不存在' : !binding ? '设备尚未创建绑定' : `绑定状态「${binding.configStatus}」` };
        }
        const stillBound = (binding.items || []).some(i => i.enabled && (i.metrics || []).some(m => m.selected && m.metricCode === target.metricCode));
        if (!stillBound) return { targetKey: target.key, deviceId: target.deviceId, deviceName: target.deviceName, metricCode: target.metricCode, result: 'blocked', reason: '指标未在当前启用绑定中' };
        const existing = Object.values(rules).find((r) => r.type === '阈值'
          && ['草稿', '已发布'].includes(r.status)
          && ((r.target?.deviceId === target.deviceId && r.target?.metricCode === target.metricCode)
            || (!r.target && r.metricCode === target.metricCode)));
        if (existing) return { targetKey: target.key, deviceId: target.deviceId, deviceName: target.deviceName, metricCode: target.metricCode, result: 'skipped', reason: `已存在${existing.status}规则 ${existing.code}` };
        return { targetKey: target.key, deviceId: target.deviceId, deviceName: target.deviceName, metricCode: target.metricCode, result: 'creatable', reason: '可创建' };
      });
      const summary = {
        total: rows.length,
        creatable: rows.filter((r) => r.result === 'creatable').length,
        skipped: rows.filter((r) => r.result === 'skipped').length,
        blocked: rows.filter((r) => r.result === 'blocked').length,
      };
      return {
        ok: true,
        message: `预览完成：可创建 ${summary.creatable}，已存在跳过 ${summary.skipped}，阻断 ${summary.blocked}`,
        rows,
        summary,
        refs: { summary },
      };
    },
    // 提交批量草稿：单批次、逐目标隔离；重复 clientRequestId 由 reducer 幂等登记返回原结果
    commitBatchDraft(request) {
      if (!request?.targets?.length) return fail('请先选择要批量创建的目标');
      const batchId = `BATCH-${String(state.meta.demoDay || '20260916').replaceAll('-', '')}-${String(Object.keys(E.alarmBatchesById || {}).length + 1).padStart(3, '0')}`;
      const clientRequestId = [
        request.metricCode, request.triggerConfig?.mode, request.triggerConfig?.threshold,
        request.triggerConfig?.durationSec, request.recoveryConfig?.condition?.deadband ?? request.recoveryConfig?.condition?.recoveryValue,
        request.targets.map((t) => t.key).sort().join(','),
      ].join(':');
      const res = act('alarm/rule/batchCommit', {
        request,
        batchId,
        clientRequestId,
        batchName: request.name || `${request.metricCode} 批量创建`,
      }, `batch-commit:${clientRequestId}`);
      return res;
    },

    // ---------- 维修 ----------
    createRepairReport(payload) {
      const { deviceId, faultDesc, level, faultType, title } = payload;
      const device = E.devicesById[deviceId];
      if (!device) return fail('设备不存在');
      if (!(faultDesc || '').trim()) return fail('故障描述必填');
      act('repair/createReport', { deviceId, faultDesc, level, faultType, title });
      return { ok: true, message: '报修已提交，生成待派工主工单', refs: { deviceId } };
    },
    assignRepair(repairOrderId, { assignee, assigneeGroup }) {
      const order = E.repairOrdersById[repairOrderId];
      if (!order) return fail('维修工单不存在');
      if (!canRepairTransition(order.status, '已派工')) return fail(`当前状态「${order.status}」不能派工`);
      if (!(assignee || '').trim()) return fail('派工必须指定维修人');
      act('repair/assign', { repairOrderId, assignee, assigneeGroup }, `assign:${repairOrderId}:v${(order.reworkCount || 0) + 1}`);
      return { ok: true, message: `已派工至 ${assignee}`, refs: { repairOrderId } };
    },
    startRepair(repairOrderId) {
      const order = E.repairOrdersById[repairOrderId];
      if (!order) return fail('维修工单不存在');
      if (!canRepairTransition(order.status, '维修中')) return fail(`当前状态「${order.status}」不能开工`);
      act('repair/start', { repairOrderId }, `start:${repairOrderId}:v${(order.reworkCount || 0) + 1}`);
      return { ok: true, message: '已开工；生成维修停机事实并联动 OEE', refs: { repairOrderId } };
    },
    pauseRepair(repairOrderId, reason) {
      const order = E.repairOrdersById[repairOrderId];
      if (!order || order.status !== '维修中') return fail('仅「维修中」工单可挂起');
      act('repair/pause', { repairOrderId, reason }, `pause:${repairOrderId}:v${(order.reworkCount || 0) + 1}`);
      return { ok: true, message: '工单已挂起', refs: { repairOrderId } };
    },
    resumeRepair(repairOrderId) {
      const order = E.repairOrdersById[repairOrderId];
      if (!order || order.status !== '挂起') return fail('仅「挂起」工单可恢复');
      act('repair/resume', { repairOrderId }, `resume:${repairOrderId}:v${(order.reworkCount || 0) + 1}`);
      return { ok: true, message: '工单已恢复维修', refs: { repairOrderId } };
    },
    submitRepair(repairOrderId, { measures, verification, laborHours }) {
      const order = E.repairOrdersById[repairOrderId];
      if (!order) return fail('维修工单不存在');
      if (!canRepairTransition(order.status, '待验收')) return fail(`当前状态「${order.status}」不能提交验收`);
      if (!(measures || '').trim() || !(verification || '').trim()) return fail('必须填写维修措施与验证方式');
      act('repair/submit', { repairOrderId, measures, verification, laborHours }, `submit-repair:${repairOrderId}:v${order.reworkCount || 0}`);
      return { ok: true, message: '已提交，进入「待验收」；验收通过后设备才恢复', refs: { repairOrderId } };
    },
    acceptRepair(repairOrderId, { result = '通过', opinion }) {
      const order = E.repairOrdersById[repairOrderId];
      if (!order) return fail('维修工单不存在');
      if (order.status !== '待验收') return fail(`当前状态「${order.status}」不能验收`);
      act('repair/accept', { repairOrderId, result, opinion }, `accept:${repairOrderId}:v${order.reworkCount || 0}`);
      return {
        ok: true,
        message: result === '返修'
          ? '已退回返修（原履历保留），状态回到「维修中」'
          : '验收通过：设备恢复、关联停机结束、报警进入恢复流程',
        refs: { repairOrderId },
      };
    },

    // ---------- 备件 ----------
    consumeSpare({ repairOrderId, spareCode, warehouseId, qty, requestId, person }) {
      const order = E.repairOrdersById[repairOrderId];
      if (!order) return fail('维修工单不存在');
      if (!['已派工', '维修中'].includes(order.status)) return fail(`工单状态「${order.status}」不允许领料出库`);
      const stockRow = E.stockByKey[`${warehouseId}|${spareCode}`];
      const check = validateOutbound(stockRow, qty);
      if (!check.ok) return fail(check.error);
      const key = `outbound:${repairOrderId}:${spareCode}:${requestId}`;
      if (E.idempotencyByKey[key]) {
        return { ok: true, idempotent: true, message: `重复提交已忽略（幂等）：${E.idempotencyByKey[key].message}`, refs: E.idempotencyByKey[key].refs || {} };
      }
      act('spare/consume', { repairOrderId, spareCode, warehouseId, qty, requestId, person }, key);
      return { ok: true, message: `出库成功：${warehouseId} 可用库存 −${qty}，已生成维修出库单`, refs: { repairOrderId, spareCode } };
    },
    returnSpare({ outboundId, qty, reason, requestId }) {
      const outbound = E.outboundsById[outboundId];
      if (!outbound) return fail('出库单不存在');
      const item = outbound.items[0];
      const returned = Object.values(E.returnsById).filter(r => r.outboundId === outboundId).reduce((s, r) => s + r.qty, 0);
      const check = validateReturn(item.qty, returned, qty);
      if (!check.ok) return fail(check.error);
      const key = `return:${outboundId}:${requestId}`;
      if (E.idempotencyByKey[key]) {
        return { ok: true, idempotent: true, message: `重复提交已忽略（幂等）`, refs: {} };
      }
      act('spare/return', { outboundId, qty, reason, requestId }, key);
      return { ok: true, message: `退库成功：${item.spareName} ×${qty} 已回冲 ${outbound.warehouseId}`, refs: { outboundId } };
    },
    inboundSpare({ spareCode, warehouseId, qty, requestId, supplier, batch, handler }) {
      if (!(qty > 0)) return fail('入库数量必须为正数');
      act('spare/inbound', { spareCode, warehouseId, qty, requestId, supplier, batch, handler }, `inbound:${warehouseId}:${spareCode}:${requestId}`);
      return { ok: true, message: '入库成功', refs: { spareCode } };
    },

    // ---------- 停机 ----------
    saveDowntime(fact) {
      act('downtime/save', { fact }, `downtime:${fact.deviceId}:${fact.start}:${fact.category}`);
      return {
        ok: true,
        message: ['计划停机', '换模'].includes(fact.category)
          ? '停机事实已保存；计划停机按口径影响可用率，已触发 OEE 重算'
          : '停机事实已保存',
        refs: { deviceId: fact.deviceId },
      };
    },
    deleteDowntime(downtimeId, reason) {
      const fact = E.downtimeFactsById[downtimeId];
      if (!fact) return fail('停机事实不存在');
      act('downtime/delete', { downtimeId, reason }, `downtime-del:${downtimeId}:v1`);
      return { ok: true, message: fact.status === '待执行' ? '待执行停机已删除' : '停机已取消留痕并触发 OEE 重算', refs: { downtimeId } };
    },

    // ---------- OEE ----------
    saveSpeedConfig(configId, idealSpeed) {
      const cfg = E.speedConfigsById[configId];
      if (!cfg) return fail('速度配置不存在');
      if (!(idealSpeed > 0)) return fail('理想速度必须为正数');
      act('oee/saveSpeed', { configId, idealSpeed }, `speed:${configId}:v${(cfg.version || 1) + 1}`);
      return { ok: true, message: `速度配置已保存（v${(cfg.version || 1) + 1}），已触发 OEE 重算`, refs: { configId } };
    },
    saveOeeConfig(deviceId, target) {
      if (!(target > 0 && target <= 100)) return fail('OEE 目标必须为 0 ~ 100');
      act('oee/saveConfig', { deviceId, target }, `oee-target:${deviceId}:v${(E.oeeTargetsByDeviceId[deviceId]?.version || 0) + 1}`);
      return { ok: true, message: `OEE 目标已保存：${target}%`, refs: { deviceId } };
    },
    recomputeOee(deviceId, range, reason) {
      const revision = Object.keys(E.oeeRecomputeLogById).length + 1;
      act('oee/recompute', { deviceId, range, reason }, `oee:${deviceId}:${range}:r${revision}`);
      return { ok: true, message: 'OEE 重算完成：结果按当前停机事实与配置重新推导', refs: { deviceId } };
    },

    // ---------- 报表 ----------
    runReport(theme, filters) {
      act('report/run', { theme, filters });
      return { ok: true, message: '查询完成', refs: { theme } };
    },
    createExportTask(theme, filters) {
      act('report/createExport', { theme, filters });
      return { ok: true, message: '导出任务已创建', refs: { theme } };
    },

    // ---------- 大屏 / 重置 ----------
    setScreenPage(page) {
      act('screen/setPage', { page });
      return { ok: true, message: `大屏切换到 ${page}`, refs: {} };
    },
  };
}

// resetDemo 不走 reducer：由 DemoStore 直接以初始快照替换状态（§4.2）
export function resetDemoAction() {
  return { type: 'demo/reset', actionId: nextActionId() };
}
