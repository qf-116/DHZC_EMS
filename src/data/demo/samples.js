// ============================================================
// 指标样本（MetricSample）与通信健康（SourceHealth）初始快照；§3.2
// sourceTime 决定统计分桶，receiveTime 只用于数据延迟，二者严格分离。
// 样本为演示快照：确定性数据，不做真实订阅。
// ============================================================

export const DEMO_TIME = '2026-09-16 16:41:08';       // 演示基准时间
export const DEMO_LAST_SAMPLE_AT = '2026-09-16 16:41:10';

// samplesByKey: `${deviceId}|${metricCode}` → 最新样本；sourceId 与当前绑定项对应。
export const samples = [
  // DEV-001 正常（绑定 8 项指标全量有样本：主控制器 + 振动/温度子传感器）
  { key: 'DEV-001|M.spindle_temp', deviceId: 'DEV-001', sourceId: 'iot-main-001', metricCode: 'M.spindle_temp', value: 68.5, unit: '℃', sourceTime: '16:41:05', receiveTime: '16:41:08', qualityCode: 'GOOD', bindingVersion: 2 },
  { key: 'DEV-001|M.coolant_temp', deviceId: 'DEV-001', sourceId: 'iot-main-001', metricCode: 'M.coolant_temp', value: 32.1, unit: '℃', sourceTime: '16:41:05', receiveTime: '16:41:08', qualityCode: 'GOOD', bindingVersion: 2 },
  { key: 'DEV-001|M.spindle_speed', deviceId: 'DEV-001', sourceId: 'iot-main-001', metricCode: 'M.spindle_speed', value: 8200, unit: 'rpm', sourceTime: '16:41:05', receiveTime: '16:41:08', qualityCode: 'GOOD', bindingVersion: 2 },
  { key: 'DEV-001|M.feed_rate', deviceId: 'DEV-001', sourceId: 'iot-main-001', metricCode: 'M.feed_rate', value: 1200, unit: 'mm/min', sourceTime: '16:41:05', receiveTime: '16:41:08', qualityCode: 'GOOD', bindingVersion: 2 },
  { key: 'DEV-001|M.vib_amplitude', deviceId: 'DEV-001', sourceId: 'iot-s-20011', metricCode: 'M.vib_amplitude', value: 2.8, unit: 'mm/s', sourceTime: '16:41:05', receiveTime: '16:41:08', qualityCode: 'GOOD', bindingVersion: 2 },
  { key: 'DEV-001|M.bearing_temp', deviceId: 'DEV-001', sourceId: 'iot-s-20012', metricCode: 'M.bearing_temp', value: 52.4, unit: '℃', sourceTime: '16:41:05', receiveTime: '16:41:08', qualityCode: 'GOOD', bindingVersion: 2 },
  { key: 'DEV-001|S.machine_state', deviceId: 'DEV-001', sourceId: 'iot-main-001', metricCode: 'S.machine_state', value: '运行', unit: '--', sourceTime: '16:41:05', receiveTime: '16:41:08', qualityCode: 'GOOD', bindingVersion: 2 },
  { key: 'DEV-001|S.alarm_code', deviceId: 'DEV-001', sourceId: 'iot-main-001', metricCode: 'S.alarm_code', value: '无', unit: '--', sourceTime: '16:41:05', receiveTime: '16:41:08', qualityCode: 'GOOD', bindingVersion: 2 },
  // DEV-002 延迟（receiveTime - sourceTime ≈ 32s；剧本 B；主控制器 4 项 + 进给速度）
  { key: 'DEV-002|M.spindle_temp', deviceId: 'DEV-002', sourceId: 'iot-main-002', metricCode: 'M.spindle_temp', value: 76.2, unit: '℃', sourceTime: '16:37:50', receiveTime: '16:38:22', qualityCode: 'DELAYED', bindingVersion: 2 },
  { key: 'DEV-002|M.coolant_temp', deviceId: 'DEV-002', sourceId: 'iot-main-002', metricCode: 'M.coolant_temp', value: 44.6, unit: '℃', sourceTime: '16:37:50', receiveTime: '16:38:22', qualityCode: 'DELAYED', bindingVersion: 2 },
  { key: 'DEV-002|M.spindle_speed', deviceId: 'DEV-002', sourceId: 'iot-main-002', metricCode: 'M.spindle_speed', value: 7600, unit: 'rpm', sourceTime: '16:37:50', receiveTime: '16:38:22', qualityCode: 'DELAYED', bindingVersion: 2 },
  { key: 'DEV-002|M.feed_rate', deviceId: 'DEV-002', sourceId: 'iot-main-002', metricCode: 'M.feed_rate', value: 1080, unit: 'mm/min', sourceTime: '16:37:50', receiveTime: '16:38:22', qualityCode: 'DELAYED', bindingVersion: 2 },
  { key: 'DEV-002|S.machine_state', deviceId: 'DEV-002', sourceId: 'iot-main-002', metricCode: 'S.machine_state', value: '运行', unit: '--', sourceTime: '16:37:50', receiveTime: '16:38:22', qualityCode: 'DELAYED', bindingVersion: 2 },
  // DEV-003 待机（无温度/速度数据：null，不显示 0；振动子传感器正常）
  { key: 'DEV-003|M.spindle_temp', deviceId: 'DEV-003', sourceId: 'iot-main-003', metricCode: 'M.spindle_temp', value: null, unit: '℃', sourceTime: '16:40:55', receiveTime: '16:40:58', qualityCode: 'NO_VALUE', bindingVersion: 1 },
  { key: 'DEV-003|M.spindle_speed', deviceId: 'DEV-003', sourceId: 'iot-main-003', metricCode: 'M.spindle_speed', value: 0, unit: 'rpm', sourceTime: '16:40:55', receiveTime: '16:40:58', qualityCode: 'GOOD', bindingVersion: 1 },
  { key: 'DEV-003|M.vib_amplitude', deviceId: 'DEV-003', sourceId: 'iot-s-20031', metricCode: 'M.vib_amplitude', value: 1.2, unit: 'mm/s', sourceTime: '16:40:55', receiveTime: '16:40:58', qualityCode: 'GOOD', bindingVersion: 1 },
  { key: 'DEV-003|S.machine_state', deviceId: 'DEV-003', sourceId: 'iot-main-003', metricCode: 'S.machine_state', value: '待机', unit: '--', sourceTime: '16:40:55', receiveTime: '16:40:58', qualityCode: 'GOOD', bindingVersion: 1 },
  // DEV-004 故障（主轴温度 91.8；剧本 A；含温度子传感器轴承温度）
  { key: 'DEV-004|M.spindle_temp', deviceId: 'DEV-004', sourceId: 'iot-main-004', metricCode: 'M.spindle_temp', value: 91.8, unit: '℃', sourceTime: '16:41:04', receiveTime: '16:41:07', qualityCode: 'GOOD', bindingVersion: 2 },
  { key: 'DEV-004|M.oil_pressure', deviceId: 'DEV-004', sourceId: 'iot-main-004', metricCode: 'M.oil_pressure', value: 0.08, unit: 'MPa', sourceTime: '16:41:04', receiveTime: '16:41:07', qualityCode: 'GOOD', bindingVersion: 2 },
  { key: 'DEV-004|M.axis_load', deviceId: 'DEV-004', sourceId: 'iot-main-004', metricCode: 'M.axis_load', value: 95, unit: '%', sourceTime: '16:41:04', receiveTime: '16:41:07', qualityCode: 'GOOD', bindingVersion: 2 },
  { key: 'DEV-004|M.bearing_temp', deviceId: 'DEV-004', sourceId: 'iot-s-20041', metricCode: 'M.bearing_temp', value: 61.5, unit: '℃', sourceTime: '16:41:04', receiveTime: '16:41:07', qualityCode: 'GOOD', bindingVersion: 2 },
  { key: 'DEV-004|S.machine_state', deviceId: 'DEV-004', sourceId: 'iot-main-004', metricCode: 'S.machine_state', value: '故障', unit: '--', sourceTime: '16:41:04', receiveTime: '16:41:07', qualityCode: 'GOOD', bindingVersion: 2 },
  // DEV-005 数据中断（无有效样本；剧本 C —— 全部 qualityCode=BAD/OFFLINE，值 null）
  { key: 'DEV-005|M.weld_current', deviceId: 'DEV-005', sourceId: 'iot-main-005', metricCode: 'M.weld_current', value: null, unit: 'A', sourceTime: null, receiveTime: null, qualityCode: 'OFFLINE', bindingVersion: 1 },
  { key: 'DEV-005|S.machine_state', deviceId: 'DEV-005', sourceId: 'iot-main-005', metricCode: 'S.machine_state', value: '无数据', unit: '--', sourceTime: null, receiveTime: null, qualityCode: 'OFFLINE', bindingVersion: 1 },
  // DEV-006 正常
  { key: 'DEV-006|M.air_pressure', deviceId: 'DEV-006', sourceId: 'iot-main-006', metricCode: 'M.air_pressure', value: 0.72, unit: 'MPa', sourceTime: '16:40:00', receiveTime: '16:40:02', qualityCode: 'GOOD', bindingVersion: 2 },
  { key: 'DEV-006|M.motor_current', deviceId: 'DEV-006', sourceId: 'iot-main-006', metricCode: 'M.motor_current', value: 12.4, unit: 'A', sourceTime: '16:40:00', receiveTime: '16:40:02', qualityCode: 'GOOD', bindingVersion: 2 },
  { key: 'DEV-006|S.machine_state', deviceId: 'DEV-006', sourceId: 'iot-main-006', metricCode: 'S.machine_state', value: '运行', unit: '--', sourceTime: '16:40:00', receiveTime: '16:40:02', qualityCode: 'GOOD', bindingVersion: 2 },
];

// 趋势（最近 12 个采样点，确定性；sourceTime 从 16:30 起每 60s）
export const trends = {
  'DEV-001|M.spindle_temp': [64.2, 65.0, 65.8, 66.5, 67.1, 66.8, 67.4, 68.0, 67.6, 68.2, 68.5, 68.5],
  'DEV-002|M.coolant_temp': [41.2, 41.8, 42.4, 43.0, 43.5, 44.0, 43.8, 44.2, 44.5, 44.3, 44.6, 44.6],
  'DEV-004|M.spindle_temp': [72.0, 74.5, 77.0, 79.5, 82.0, 84.5, 86.0, 88.2, 89.4, 90.5, 91.2, 91.8],
  'DEV-004|M.oil_pressure': [0.32, 0.28, 0.24, 0.20, 0.17, 0.15, 0.13, 0.11, 0.10, 0.09, 0.085, 0.08],
};

// healthBySource: deviceId → 通信健康（不覆盖绑定配置状态）
export const health = {
  'DEV-001': { status: '正常', latencySec: 3, lastSampleAt: '16:41:08', qualityRate: '99.94%' },
  'DEV-002': { status: '延迟', latencySec: 32, lastSampleAt: '16:38:22', qualityRate: '98.83%' },
  'DEV-003': { status: '部分中断', latencySec: 5, lastSampleAt: '16:40:58', qualityRate: '99.10%' },
  'DEV-004': { status: '正常', latencySec: 3, lastSampleAt: '16:41:07', qualityRate: '99.67%' },
  'DEV-005': { status: '数据中断', latencySec: null, lastSampleAt: '15:22:30', qualityRate: '0%' },
  'DEV-006': { status: '正常', latencySec: 4, lastSampleAt: '16:40:02', qualityRate: '99.90%' },
  'DEV-007': { status: '未知', latencySec: null, lastSampleAt: '2026-08-30 18:00', qualityRate: '--' },
  'DEV-008': { status: '未知', latencySec: null, lastSampleAt: null, qualityRate: '--' },
};

// 接入任务（ingestionTasksById）：含状态机、失败原因、影响范围与下一步（§6.2）
export const ingestionTasks = [
  { taskId: 'IT-20260916-001', deviceId: 'DEV-002', deviceName: 'CNC加工中心-02', type: '补传任务', status: '重试中', startedAt: '16:20:00', updatedAt: '16:38:22', failCount: 2, successCount: 6, failReason: '网关重连后部分报文乱序', impact: '冷却液温度指标延迟约 32s；影响实时监测与报警判定', owner: '系统自动', nextStep: '等待下一轮重试；连续 3 次失败转人工处理' },
  { taskId: 'IT-20260916-002', deviceId: 'DEV-003', deviceName: '激光焊接机-03', type: '补偿任务', status: '部分成功', startedAt: '15:10:00', updatedAt: '15:35:00', failCount: 1, successCount: 1, failReason: '温度子传感器 IOT-S-20032 已停用，2 条样本无法补偿', impact: '轴承温度指标缺口 5 分钟', owner: '李明', nextStep: '如需恢复轴承温度，请在物联网接入配置重新启用该子传感器' },
  { taskId: 'IT-20260916-003', deviceId: 'DEV-005', deviceName: '机器人焊接-05', type: '拉取任务', status: '失败', startedAt: '15:22:30', updatedAt: '16:41:00', failCount: 3, successCount: 0, failReason: '主设备 IOT-D-10005 心跳超时（数据中断）', impact: '该设备全部指标无数据；OEE 不可计算；实时页显示离线', owner: '王强', nextStep: '现场检查设备网络；或重新绑定备用主控制器' },
  { taskId: 'IT-20260916-004', deviceId: 'DEV-001', deviceName: 'CNC加工中心-01', type: '拉取任务', status: '成功', startedAt: '16:40:10', updatedAt: '16:41:08', failCount: 0, successCount: 6, failReason: '--', impact: '--', owner: '系统自动', nextStep: '--' },
];
