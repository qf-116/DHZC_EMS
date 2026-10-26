// ============================================================
// Selectors（§5.3）：页面只允许消费这里的读模型，不得自行拼装跨域事实
// OEE 由 oeeInputs + 停机事实 + 配置实时推导，保证 saveDowntime / saveSpeedConfig
// 之后的重算结果可见（§6.8 / §11.1）。
// ============================================================

import { computeOee, oeeBlockers, oeeLossBreakdown, computeMttrMtbf, pct, round1 } from '../domain/oee.js';
import { availableQty, stockLevel } from '../domain/spare.js';
import { reportRows as reportSeedRows } from '../data/demoData.js';

// ---------- 设备 ----------
export function selectDeviceCrosswalk(state, deviceId) {
  return state.entities.crosswalkById[deviceId] || null;
}

export function selectDevice(state, deviceId) {
  const device = state.entities.devicesById[deviceId];
  if (!device) return null; // 详情参数无效时页面必须显示「未找到对象」，禁止回退第一条
  const crosswalk = selectDeviceCrosswalk(state, deviceId);
  return {
    ...device,
    assetCode: crosswalk?.assetCode || device.assetCode,
    monitorCode: crosswalk?.monitorCode || deviceId,
    location: [device.workshopName, device.lineName, device.stationName].filter(Boolean).join(' / '),
  };
}

export function selectAllDevices(state) {
  return Object.values(state.entities.devicesById).map(d => selectDevice(state, d.deviceId));
}

// ---------- 绑定 ----------
export function selectBinding(state, deviceId) {
  return state.entities.bindingsByDeviceId[deviceId] || null;
}

export function selectBindingVersions(state, deviceId) {
  return Object.values(state.entities.bindingVersionsById)
    .filter(v => v.deviceId === deviceId)
    .sort((a, b) => b.version - a.version);
}

export function selectBindingDraft(state, deviceId) {
  return (state.ui.bindingDraftsByDeviceId || {})[`draft-${deviceId}`] || null;
}

export function selectBindingImpact(state, deviceId) {
  const binding = selectBinding(state, deviceId);
  return {
    bindingId: binding?.bindingId || null,
    version: binding?.version || 0,
    domains: ['运行监测', '报警中心', 'OEE', '报表', '大屏'],
    description: binding ? `绑定 v${binding.version} 影响该设备的实时监测、指标报警判定、OEE 计算与报表统计` : '设备未绑定，监测/OEE 不可用',
  };
}

// ---------- 实时与健康 ----------
export function selectHealth(state, deviceId) {
  return state.entities.healthByDeviceId[deviceId] || { status: '未知', latencySec: null, lastSampleAt: null, qualityRate: '--' };
}

export function selectRealtime(state, deviceId) {
  const binding = selectBinding(state, deviceId);
  const health = selectHealth(state, deviceId);
  const samples = Object.values(state.entities.samplesByKey).filter(s => s.deviceId === deviceId);
  const disconnected = state.meta.provider === 'disconnect' || health.status === '数据中断';
  const metricRows = (binding?.items || [])
    .filter(i => i.enabled)
    // 实时监测行只呈现「监控中」指标（monitored）；未勾选指标仍存储，台账数据指标历史可查
    .flatMap(i => (i.metrics || []).filter(m => m.monitored).map(m => {
      const def = state.entities.metricsByKey[m.metricCode];
      const sample = disconnected
        ? null
        : samples.find(s => s.sourceId === i.iotDeviceId && s.metricCode === m.metricCode);
      return {
        metricCode: m.metricCode,
        name: def?.name || m.metricCode,
        unit: def?.unit || '--',
        value: sample ? sample.value : null,          // null ≠ 0：无数据显示 --（硬规则 6）
        sourceTime: sample?.sourceTime || null,
        receiveTime: sample?.receiveTime || null,
        qualityCode: sample?.qualityCode || 'NO_DATA',
        iotDeviceCode: i.iotDeviceCode,
        metricVersion: m.metricVersion,
      };
    }));
  // 设备状态样本来源：任一启用来源接入 S.machine_state 即可（状态采集用于状态派生，不受监控勾选影响）
  const stateItem = (binding?.items || []).find(i => i.enabled && (i.metrics || []).some(m => m.metricCode === 'S.machine_state'));
  const stateSample = disconnected
    ? null
    : samples.find(s => s.sourceId === stateItem?.iotDeviceId && s.metricCode === 'S.machine_state');
  return {
    deviceId,
    bindingStatus: binding?.configStatus || '未配置',
    healthStatus: health.status,
    latencySec: health.latencySec,
    runStatus: stateSample ? stateSample.value : '无数据',
    sourceTime: stateSample?.sourceTime || null,
    receiveTime: stateSample?.receiveTime || null,
    lastSampleAt: health.lastSampleAt,
    degraded: disconnected,
    provider: state.meta.provider,
    metrics: metricRows,
  };
}

// ---------- 报警 ----------
export function selectActiveAlarms(state, deviceId = null) {
  return Object.values(state.entities.alarmEventsById)
    .filter(a => a.status !== '已关闭' && (!deviceId || a.deviceId === deviceId))
    .sort((a, b) => (a.time < b.time ? 1 : -1));
}

export function selectAlarm(state, alarmId) {
  return state.entities.alarmEventsById[alarmId] || null;
}

export function selectAlarmTimeline(state, alarmId) {
  return state.entities.alarmEventsById[alarmId]?.timeline || [];
}

export function selectNotificationDeliveries(state, alarmId) {
  return Object.values(state.entities.notificationDeliveriesById)
    .filter(n => n.alarmId === alarmId)
    .sort((a, b) => (a.sentAt > b.sentAt ? 1 : -1));
}

export function selectAllAlarms(state) {
  return Object.values(state.entities.alarmEventsById).sort((a, b) => (a.time < b.time ? 1 : -1));
}

// ---------- 维修 ----------
export function selectRepairById(state, repairOrderId) {
  return state.entities.repairOrdersById[repairOrderId] || null; // 无效参数由页面显示「未找到对象」
}

export function selectRepairThread(state, deviceId) {
  const orders = Object.values(state.entities.repairOrdersById)
    .filter(o => o.deviceId === deviceId)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  const reports = Object.values(state.entities.repairReportsById)
    .filter(r => r.deviceId === deviceId);
  return { orders, reports };
}

export function selectAllRepairOrders(state) {
  return Object.values(state.entities.repairOrdersById).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}
export function selectAllRepairReports(state) {
  return Object.values(state.entities.repairReportsById).sort((a, b) => (a.createTime < b.createTime ? 1 : -1));
}

// ---------- 备件 ----------
export function selectAvailableStock(state, warehouseId, spareCode) {
  const row = state.entities.stockByKey[`${warehouseId}|${spareCode}`];
  if (!row) return null; // 未配置库存 ≠ 0
  return { ...row, available: availableQty(row), level: stockLevel(row) };
}

export function selectStockRows(state) {
  return Object.values(state.entities.stockByKey).map(row => ({
    ...row, available: availableQty(row), level: stockLevel(row),
    spare: state.entities.sparesByCode[row.spareCode] || null,
  }));
}

export function selectRepairParts(state, repairOrderId) {
  return state.entities.repairOrdersById[repairOrderId]?.parts || [];
}

export function selectOutboundForRepair(state, repairOrderId) {
  return Object.values(state.entities.outboundsById).filter(o => o.repairOrderId === repairOrderId);
}

export function selectStockFlows(state, filter = {}) {
  return Object.values(state.entities.stockFlowsById)
    .filter(f => (!filter.warehouseId || f.warehouseId === filter.warehouseId)
      && (!filter.spareCode || f.spareCode === filter.spareCode))
    .sort((a, b) => (a.time < b.time ? 1 : -1));
}

// ---------- 停机 ----------
// range: { from: '2026-09-16', to: '2026-09-16' } 或 null（全部）
export function selectDowntime(state, deviceId, range = null) {
  return Object.values(state.entities.downtimeFactsById)
    .filter(f => (!deviceId || f.deviceId === deviceId)
      && (!range || (dateOf(f.start) >= range.from && dateOf(f.start) <= range.to)))
    .sort((a, b) => (a.start < b.start ? 1 : -1));
}

// 计划/实际停机对比：计划 = 计划停机+换模；实际 = 故障+维修+待料
export function selectPlannedVsActual(state, deviceId, range = null) {
  const facts = selectDowntime(state, deviceId, range);
  const planned = facts.filter(f => ['计划停机', '换模'].includes(f.category));
  const actual = facts.filter(f => ['故障停机', '维修停机', '待料'].includes(f.category));
  const sum = (arr) => arr.reduce((s, f) => s + (f.minutes || 0), 0);
  return { plannedFacts: planned, actualFacts: actual, plannedMinutes: sum(planned), actualMinutes: sum(actual) };
}

// ---------- OEE ----------
const dateOf = (ts) => (typeof ts === 'string' ? ts.slice(0, 10) : '');

// 窗口内计划停机分钟（计划停机+换模，只影响可用率分母）
// windowArg: 'YYYY-MM-DD'（全天累计）或 { fromMs, toMs }（时间区间，分钟取交集，避免实时窗口可用率 >100%）
function plannedDowntimeMinutes(state, deviceId, windowArg) {
  const toMs = (ts) => new Date(String(ts).replace(' ', 'T')).getTime();
  return Object.values(state.entities.downtimeFactsById)
    .filter(f => f.deviceId === deviceId
      && ['计划停机', '换模'].includes(f.category)
      && ['已结束', '进行中'].includes(f.status))
    .reduce((s, f) => {
      if (typeof windowArg === 'string') {
        return dateOf(f.start) === windowArg ? s + (f.minutes || 0) : s;
      }
      const stMs = toMs(f.start);
      if (Number.isNaN(stMs)) return s;
      const enMs = f.end ? toMs(f.end) : windowArg.toMs;
      const overlapMin = Math.round(Math.max(0, Math.min(enMs, windowArg.toMs) - Math.max(stMs, windowArg.fromMs)) / 60000);
      return s + overlapMin;
    }, 0);
}

function speedFor(state, deviceId, materialCode) {
  return Object.values(state.entities.speedConfigsById)
    .find(c => c.deviceId === deviceId && c.materialCode === materialCode && c.status === '生效') || null;
}

// OEE 结果：window='realtime'（最近 1 小时）或 'daily'（按天）
// 返回 null 数值字段一律表示「不可计算」，页面必须显示原因而不是 0
export function selectOeeResult(state, deviceId, { window = 'realtime', day = null } = {}) {
  const inputsMap = state.entities.oeeInputs[window] || {};
  const raw = window === 'daily'
    ? (inputsMap[deviceId] || {})[day || state.meta.demoDay]
    : inputsMap[deviceId];
  const eligibility = state.entities.oeeEligibilityByDeviceId[deviceId] || {};
  const binding = selectBinding(state, deviceId);
  const health = selectHealth(state, deviceId);

  const config = {
    hasBinding: binding?.configStatus === '已启用'
      && health.status !== '数据中断'
      && state.meta.provider !== 'disconnect',
    hasShiftCalendar: (state.entities.shiftCalendar || []).length > 0 && eligibility.hasShiftCalendar !== false,
    idealSpeed: null,
  };
  if (!raw) {
    return {
      deviceId, window, day: day || state.meta.demoDay,
      availability: null, performance: null, quality: null, oee: null,
      plannedDowntimeMinutes: null, blockers: ['该窗口无生产数据'], dataStatus: '无生产数据',
      eligibility, target: state.entities.oeeTargetsByDeviceId[deviceId]?.target ?? null,
    };
  }
  const speedCfg = speedFor(state, deviceId, raw.materialCode);
  config.idealSpeed = speedCfg?.idealSpeed ?? null;
  let plannedWindow = day || state.meta.demoDay;
  if (window === 'realtime') {
    // 实时窗口为最近 1 小时：计划停机只取与该区间的交集分钟
    const toMs = new Date(String(state.meta.updatedAt || state.meta.lastSampleAt || '').replace(' ', 'T')).getTime();
    if (!Number.isNaN(toMs)) plannedWindow = { fromMs: toMs - 60 * 60000, toMs };
  }
  const plannedDowntimeMinutesValue = plannedDowntimeMinutes(state, deviceId, plannedWindow);
  const blockers = oeeBlockers({ ...raw }, config);
  const result = blockers.length ? { availability: null, performance: null, quality: null, oee: null } : computeOee({
    loadMinutes: raw.loadMinutes,
    plannedDowntimeMinutes: plannedDowntimeMinutesValue,
    runMinutes: raw.runMinutes,
    idealSpeed: config.idealSpeed,
    actualSpeed: config.idealSpeed != null && raw.runMinutes > 0
      ? round1((raw.output / raw.runMinutes) * 60) : null,
    output: raw.output,
    qualified: raw.qualified,
  });
  return {
    deviceId, window, day: day || state.meta.demoDay,
    ...result,
    loadMinutes: raw.loadMinutes,
    runMinutes: raw.runMinutes,
    plannedDowntimeMinutes: plannedDowntimeMinutesValue,
    idealSpeed: config.idealSpeed,
    actualSpeed: config.idealSpeed != null && raw.runMinutes > 0 ? round1((raw.output / raw.runMinutes) * 60) : null,
    output: raw.output,
    qualified: raw.qualified,
    materialCode: raw.materialCode,
    dataComplete: raw.dataComplete || '--',
    dataStatus: blockers.length ? '不可计算' : '正常',
    blockers,
    eligibility,
    target: state.entities.oeeTargetsByDeviceId[deviceId]?.target ?? null,
  };
}

export function selectOeeRealtimeRows(state) {
  return Object.keys(state.entities.oeeInputs.realtime || {}).map(deviceId => selectOeeResult(state, deviceId, { window: 'realtime' }));
}

export function selectOeeDailyRows(state, day = null) {
  const d = day || state.meta.demoDay;
  return Object.keys(state.entities.devicesById)
    .map(deviceId => selectOeeResult(state, deviceId, { window: 'daily', day: d }));
}

export function selectOeeLosses(state, deviceId, opts) {
  const result = selectOeeResult(state, deviceId, opts);
  const facts = selectDowntime(state, deviceId).filter(f => dateOf(f.start) === result.day);
  return oeeLossBreakdown(result, facts);
}

export function selectOeeRecomputeLog(state, deviceId = null) {
  return Object.values(state.entities.oeeRecomputeLogById)
    .filter(r => !deviceId || r.deviceId === deviceId)
    .sort((a, b) => (a.at < b.at ? 1 : -1));
}

// MTTR / MTBF：从维修事实与故障事件推导（不从页面数值均值二次推导）
export function selectMttrMtbf(state, deviceId = null) {
  const orders = Object.values(state.entities.repairOrdersById)
    .filter(o => o.status === '已完成' && (!deviceId || o.deviceId === deviceId));
  const repairFacts = orders.map(o => {
    const start = o.startedAt ? new Date(o.startedAt.replace(' ', 'T')) : null;
    const end = o.acceptedAt ? new Date(o.acceptedAt.replace(' ', 'T')) : null;
    return { repairOrderId: o.repairOrderId, restoreMinutes: start && end ? Math.round((end - start) / 60000) : null };
  });
  const alarms = Object.values(state.entities.alarmEventsById)
    .filter(a => (!deviceId || a.deviceId === deviceId) && a.metricCode === 'S.machine_state' && a.status === '已关闭');
  const runMinutes = Object.entries(state.entities.oeeInputs.daily || {})
    .filter(([devId]) => !deviceId || devId === deviceId)
    .reduce((s, [, days]) => s + Object.values(days || {}).reduce((a, d) => a + (d.runMinutes || 0), 0), 0);
  return computeMttrMtbf(repairFacts, alarms, runMinutes);
}

// ---------- 接入任务 / 程序比对 ----------
export function selectIngestionTasks(state, deviceId = null) {
  return Object.values(state.entities.ingestionTasksById)
    .filter(t => !deviceId || t.deviceId === deviceId);
}

export function selectProgramCompare(state, deviceId = null) {
  return Object.values(state.entities.programCompareById)
    .filter(p => !deviceId || p.deviceId === deviceId);
}

export function selectProgramHandles(state, deviceId = null) {
  return Object.values(state.entities.programHandlesById)
    .filter(p => !deviceId || p.deviceId === deviceId)
    .sort((a, b) => (a.time < b.time ? 1 : -1));
}

// ---------- 报表读模型 ----------
// 主题行数据来自演示种子（demoData.reportRows 兼容导出），筛选与口径在 selector 内统一处理
export function selectReportRows(state, theme, filters = {}) {
  const rows = reportSeedRows[theme] || [];
  const f = filters;
  return rows.filter(r => {
    if (f.device && !(r.device || '').includes(f.device)) return false;
    if (f.date && r.date !== f.date) return false;
    if (f.month && r.month && r.month !== f.month) return false;
    return true;
  });
}

// ---------- 工作台读模型（§7.1：行动入口，不复制完整 KPI） ----------
export function selectWorkbench(state) {
  const unacked = Object.values(state.entities.alarmEventsById).filter(a => a.status === '已触发');
  const processing = Object.values(state.entities.alarmEventsById).filter(a => a.status === '已确认' || a.status === '处理中');
  const pendingDispatch = Object.values(state.entities.repairOrdersById).filter(o => o.status === '待派工');
  const pendingAccept = Object.values(state.entities.repairOrdersById).filter(o => o.status === '待验收');
  const lowStock = Object.values(state.entities.stockByKey).filter(row => {
    const spare = state.entities.sparesByCode[row.spareCode];
    return spare && row.onHand < spare.safe;
  });
  const ingestionIssues = Object.values(state.entities.ingestionTasksById).filter(t => ['失败', '重试中', '部分成功'].includes(t.status));
  const degradedDevices = Object.keys(state.entities.healthByDeviceId)
    .filter(id => ['延迟', '数据中断', '部分中断'].includes(state.entities.healthByDeviceId[id].status))
    .map(id => ({ deviceId: id, ...state.entities.healthByDeviceId[id] }));
  const lifecycleTasks = Object.values(state.entities.lifecycleTasksById || {});
  const lifecycle = {
    all: lifecycleTasks.sort((a, b) => (a.taskNo < b.taskNo ? 1 : -1)),
    pendingProcurement: lifecycleTasks.filter(t => ['采购入账待提交', '采购入账待修改', '试用不合格退回'].includes(t.status)),
    pendingTrial: lifecycleTasks.filter(t => t.status === '使用部门试用确认中'),
    pendingRegistration: lifecycleTasks.filter(t => t.status === '待设备手续入账'),
    completed: lifecycleTasks.filter(t => t.status === '设备已入账'),
    rejected: lifecycleTasks.filter(t => t.status === '试用不合格退回'),
    changes: Object.values(state.entities.assetChangeRecordsById || {}),
    idle: Object.values(state.entities.idleApplicationsById || {}),
    scraps: Object.values(state.entities.scrapApplicationsById || {}),
  };
  return { unacked, processing, pendingDispatch, pendingAccept, lowStock, ingestionIssues, degradedDevices, lifecycle };
}

// ---------- 设备 360 / 履历 ----------
export function selectDevice360(state, deviceId) {
  if (!state.entities.devicesById[deviceId]) return null;
  return {
    device: selectDevice(state, deviceId),
    crosswalk: selectDeviceCrosswalk(state, deviceId),
    binding: selectBinding(state, deviceId),
    realtime: selectRealtime(state, deviceId),
    health: selectHealth(state, deviceId),
    activeAlarms: selectActiveAlarms(state, deviceId),
    repair: selectRepairThread(state, deviceId),
    downtime: selectDowntime(state, deviceId),
    oee: selectOeeResult(state, deviceId, { window: 'realtime' }),
    ingestionTasks: selectIngestionTasks(state, deviceId),
    history: selectBusinessHistory(state, 'device', deviceId),
    lifecycleHistory: selectDeviceLifecycleHistory(state, deviceId),
  };
}

export function selectLifecycleTasks(state, filter = {}) {
  return Object.values(state.entities.lifecycleTasksById || {})
    .filter(t => !filter.status || t.status === filter.status)
    .filter(t => !filter.keyword || [t.taskNo, t.equipmentName, t.model, t.brand, t.useDept].some(v => String(v || '').includes(filter.keyword)))
    .sort((a, b) => (a.taskNo < b.taskNo ? 1 : -1));
}

export function selectLifecycleTask(state, taskId) {
  return state.entities.lifecycleTasksById?.[taskId] || null;
}

export function selectAssetChanges(state) {
  return Object.values(state.entities.assetChangeRecordsById || {}).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export function selectIdleApplications(state) {
  return Object.values(state.entities.idleApplicationsById || {}).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export function selectScrapApplications(state) {
  return Object.values(state.entities.scrapApplicationsById || {}).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export function selectDeviceLifecycleHistory(state, deviceId) {
  if (!deviceId) return [];
  const rows = [];

  Object.values(state.entities.lifecycleTasksById || {}).forEach(task => {
    const registered = (task.registration?.deviceIds || []).includes(deviceId);
    if (!registered) return;
    rows.push({ key: `${task.taskId}-register`, time: task.registration?.submittedAt, type: '设备手续入账', title: task.taskNo, detail: `生成设备台账：${task.equipmentName || '--'}`, actor: task.registration?.registrar, status: '已完成' });
    rows.push({ key: `${task.taskId}-trial`, time: task.trial?.confirmedAt, type: '试用确认', title: task.taskNo, detail: task.trial?.opinion || '--', actor: task.trial?.confirmer, status: task.trial?.result });
    rows.push({ key: `${task.taskId}-procurement`, time: task.procurement?.submittedAt, type: '采购入账', title: task.taskNo, detail: `${task.equipmentName || '--'} / ${task.model || '--'}；合同 ${task.contractNo || '--'}`, actor: task.procurement?.submittedBy, status: task.procurement?.submittedAt ? '已提交' : '待提交' });
  });

  Object.values(state.entities.assetChangeRecordsById || {})
    .filter(r => r.deviceId === deviceId)
    .forEach(r => rows.push({ key: r.changeId, time: r.completedAt || r.approvedAt || r.createdAt, type: '资产变更', title: `${r.changeNo} · ${r.type}`, detail: r.reason || '--', actor: r.executor || r.approver || r.applicant, status: r.status }));

  Object.values(state.entities.idleApplicationsById || {})
    .filter(r => r.deviceId === deviceId)
    .forEach(r => rows.push({ key: r.idleId, time: r.reviewedAt || r.createdAt, type: '闲置管理', title: r.idleNo, detail: `${r.reason || '--'}${r.reviewOpinion ? `；复核：${r.reviewOpinion}` : ''}`, actor: r.reviewer || r.applicant, status: r.status }));

  Object.values(state.entities.scrapApplicationsById || {})
    .filter(r => r.deviceId === deviceId)
    .forEach(r => rows.push({ key: r.scrapId, time: r.archivedAt || r.writeOffAt || r.appraisedAt || r.createdAt, type: '报废归档', title: r.scrapNo, detail: `${r.reason || '--'}${r.appraisal ? `；鉴定：${r.appraisal}` : ''}`, actor: r.archiver || r.financeUser || r.appraiser || r.applicant, status: r.status }));

  selectBusinessHistory(state, 'device', deviceId).forEach(h => rows.push({
    key: `BH-${h.historyId}`, time: h.at, type: '业务动作', title: h.historyId, detail: h.summary, actor: '--', status: h.at ? '已记录' : null,
  }));

  return rows
    .filter(r => r.time)
    .sort((a, b) => (a.time < b.time ? 1 : -1));
}

export function selectBusinessHistory(state, entityType, entityId) {
  return Object.values(state.entities.businessHistoryById)
    .filter(h => h.entityType === entityType && h.entityId === entityId)
    .sort((a, b) => (a.at < b.at ? 1 : -1));
}

// ---------- 大屏读模型（与后台同源 selector；只读） ----------
export function selectScreenViewModel(state) {
  const devices = selectAllDevices(state).slice(0, 5).map(d => {
    const realtime = selectRealtime(state, d.deviceId);
    const health = selectHealth(state, d.deviceId);
    const oee = selectOeeResult(state, d.deviceId, { window: 'realtime' });
    const alarms = selectActiveAlarms(state, d.deviceId);
    return {
      deviceId: d.deviceId, name: d.name, assetCode: d.assetCode,
      runStatus: realtime.runStatus, healthStatus: health.status,
      latencySec: health.latencySec, lastSampleAt: health.lastSampleAt,
      spindleTemp: realtime.metrics.find(m => m.metricCode === 'M.spindle_temp')?.value ?? null,
      coolantTemp: realtime.metrics.find(m => m.metricCode === 'M.coolant_temp')?.value ?? null,
      oee: oee.oee, alarms: alarms.length,
      urgentAlarm: alarms.find(a => a.severity === '紧急') || null,
    };
  });
  return {
    devices,
    meta: state.meta,
    summary: {
      total: devices.length,
      running: devices.filter(d => d.runStatus === '运行').length,
      fault: devices.filter(d => d.runStatus === '故障').length,
      noData: devices.filter(d => d.runStatus === '无数据').length,
      activeAlarms: selectActiveAlarms(state).length,
      unacked: selectActiveAlarms(state).filter(a => a.status === '已触发').length,
    },
  };
}

// ---------- 导出任务 ----------
export function selectExportTasks(state) {
  return Object.values(state.entities.exportTasksById).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}
