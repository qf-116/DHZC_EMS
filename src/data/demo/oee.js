// ============================================================
// OEE 配置（oeeConfigByDeviceId / oeeInputs / 速度配置 / 班次日历）初始快照；§11
// OEE 结果不直接存静态数值：由 selector 按 oeeInputs + 停机事实 + 配置推导，
// 保证 saveDowntime / saveSpeedConfig 后重算可见（避免「保存成功但 OEE 永远不变」反例）。
// ============================================================

// 物料池（理想速度基础档案）
export const materialPool = [
  { code: 'XN010102-000001', name: '52S液冷电池插箱（0.5C）', model: 'XN-LM314-52S-1', idealSpeed: 30 },
  { code: 'XN010102-000002', name: '52S液冷电池插箱（1C）', model: 'XN-LM314-52S-2', idealSpeed: 24 },
  { code: 'XN020105-000003', name: '端板总成', model: 'XN-DB-2025', idealSpeed: 40 },
  { code: 'XN020301-000004', name: '侧板总成', model: 'XN-CB-3140', idealSpeed: 36 },
];

// 理想生产速度配置（设备 × 物料，版本与生效时间；修改须经 saveSpeedConfig 动作）
// 理论生产速度：设备级单值（2026-11-05 简化，去掉设备 × 物料维度）——单位「秒/件」，
// 与平均加工节拍口径一致；换产物料导致速度变化较大时人工调整。
// idealSpeedSec = 3600 ÷ 原理论速度（个/小时），保证 OEE 数值连续。
export const speedConfigs = [
  { id: 'SC-DEV-001', deviceId: 'DEV-001', deviceName: 'CNC加工中心-01', idealSpeedSec: 120, version: 3, effectiveFrom: '2026-08-12 09:30', status: '生效' },
  { id: 'SC-DEV-002', deviceId: 'DEV-002', deviceName: 'CNC加工中心-02', idealSpeedSec: 120, version: 2, effectiveFrom: '2026-08-12 09:30', status: '生效' },
  { id: 'SC-DEV-003', deviceId: 'DEV-003', deviceName: '激光焊接机-03', idealSpeedSec: 300, version: 2, effectiveFrom: '2026-08-12 09:30', status: '生效' },
  { id: 'SC-DEV-004', deviceId: 'DEV-004', deviceName: '数控铲齿机-04', idealSpeedSec: 360, version: 3, effectiveFrom: '2026-09-01 08:00', status: '生效' },
];

// OEE 目标（按设备，含适用范围与版本）
export const oeeTargets = [
  { deviceId: 'DEV-001', target: 78, version: 1, effectiveFrom: '2026-08-01', scope: '全部物料' },
  { deviceId: 'DEV-002', target: 75, version: 1, effectiveFrom: '2026-08-01', scope: '全部物料' },
  { deviceId: 'DEV-003', target: 70, version: 1, effectiveFrom: '2026-08-01', scope: '全部物料' },
  { deviceId: 'DEV-004', target: 65, version: 2, effectiveFrom: '2026-09-01', scope: '全部物料' },
];

// 班次日历（演示：白班 08:00-20:00 / 夜班 20:00-08:00，周一至周日）
export const shiftCalendar = [
  { shiftId: 'day', name: '白班', timeRange: '08:00 - 20:00', appliesTo: '全部设备', version: 1, effectiveFrom: '2026-01-01' },
  { shiftId: 'night', name: '夜班', timeRange: '20:00 - 08:00（次日）', appliesTo: '全部设备', version: 1, effectiveFrom: '2026-01-01' },
];

// oeeInputsByDeviceId：统计窗口的时段与物料输入（产量 / 合格数不再存结果，
// 由 productionReports 报工事件在窗口内汇总）
// realtime：最近 1 小时滚动窗口；daily：按天统计（演示覆盖 2026-09-16）
export const oeeInputs = {
  realtime: {
    // 性能率 = 实际速度 / 理想速度，实际速度 = 报工产量/运行分钟×60
    'DEV-001': { loadMinutes: 60, runMinutes: 45, materialCode: 'XN010102-000001', dataComplete: '99.9%' },
    'DEV-002': { loadMinutes: 60, runMinutes: 42, materialCode: 'XN010102-000001', dataComplete: '98.8%' },
    'DEV-003': { loadMinutes: 60, runMinutes: 20, materialCode: 'XN020105-000003', dataComplete: '99.1%' },
    'DEV-004': { loadMinutes: 60, runMinutes: 18, materialCode: 'XN010102-000002', dataComplete: '99.7%' },
    // DEV-005 无生产数据：整行显示不可计算原因，不伪造 0
    'DEV-005': null,
  },
  daily: {
    // { deviceId: { '2026-09-16': { loadMinutes, runMinutes, materialCode } } }
    'DEV-001': { '2026-09-16': { loadMinutes: 660, runMinutes: 528, materialCode: 'XN010102-000001' } },
    'DEV-002': { '2026-09-16': { loadMinutes: 660, runMinutes: 502, materialCode: 'XN010102-000001' } },
    'DEV-003': { '2026-09-16': { loadMinutes: 660, runMinutes: 390, materialCode: 'XN020105-000003' } },
    'DEV-004': { '2026-09-16': { loadMinutes: 660, runMinutes: 315, materialCode: 'XN010102-000002' } },
    'DEV-005': null,
  },
};

// OEE 资格矩阵：必要条件 = 有效绑定/指标、班次日历、负荷时间、理想速度、产量、质量来源
export const oeeEligibility = {
  'DEV-001': { hasBinding: true, hasShiftCalendar: true, hasLoad: true, hasSpeed: true, hasOutput: true, hasQuality: true, eligible: true },
  'DEV-002': { hasBinding: true, hasShiftCalendar: true, hasLoad: true, hasSpeed: true, hasOutput: true, hasQuality: true, eligible: true },
  'DEV-003': { hasBinding: true, hasShiftCalendar: true, hasLoad: true, hasSpeed: true, hasOutput: true, hasQuality: true, eligible: true },
  'DEV-004': { hasBinding: true, hasShiftCalendar: true, hasLoad: true, hasSpeed: true, hasOutput: true, hasQuality: true, eligible: true },
  'DEV-005': { hasBinding: true, hasShiftCalendar: true, hasLoad: false, hasSpeed: false, hasOutput: false, hasQuality: false, eligible: false, reason: '数据中断且未配置理想生产速度' },
  'DEV-006': { hasBinding: true, hasShiftCalendar: false, hasLoad: false, hasSpeed: false, hasOutput: false, hasQuality: false, eligible: false, reason: '动力设备未纳入 OEE 统计（无班次日历与生产口径）' },
};

// OEE 重算任务履历（recomputeOee 动作追加；演示确定性）
export const oeeRecomputeLog = [
  { recomputeId: 'RC-20260916-001', deviceId: 'DEV-004', range: '2026-09-16 实时窗口', reason: '停机事实 DT-20260916-901 变更', at: '2026-09-16 16:25:00', revision: 1 },
];


// ---------- 报工事件（2026-11-05）----------
// OEE 产量 / 合格数不再保存聚合结果，由 productionReportsByDeviceId 中的
// 逐条报工事件（报工时间 / 数量+1 / 是否合格）在统计窗口内汇总。
// 事件种子见 ./productionReports.js。
