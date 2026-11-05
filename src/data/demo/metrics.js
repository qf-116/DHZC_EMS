// ============================================================
// 平台指标清单（IoT 平台只读同步，含版本与失效标记；本系统不得编辑协议/网关/点位）
// ============================================================

export const metrics = [
  { metricCode: 'M.spindle_temp', metricVersion: 'v1.2', name: '主轴温度', unit: '℃', dataType: '数值', precision: 0.1, range: '0 ~ 150', syncStatus: '正常', lastSyncTime: '2026-09-16 06:00' },
  { metricCode: 'M.coolant_temp', metricVersion: 'v1.2', name: '冷却液温度', unit: '℃', dataType: '数值', precision: 0.1, range: '0 ~ 80', syncStatus: '正常', lastSyncTime: '2026-09-16 06:00' },
  { metricCode: 'M.spindle_speed', metricVersion: 'v1.1', name: '主轴转速', unit: 'rpm', dataType: '数值', precision: 1, range: '0 ~ 12000', syncStatus: '正常', lastSyncTime: '2026-09-16 06:00' },
  { metricCode: 'M.feed_rate', metricVersion: 'v1.1', name: '进给速度', unit: 'mm/min', dataType: '数值', precision: 1, range: '0 ~ 30000', syncStatus: '正常', lastSyncTime: '2026-09-16 06:00' },
  { metricCode: 'M.vib_amplitude', metricVersion: 'v2.0', name: '振动幅值', unit: 'mm/s', dataType: '数值', precision: 0.01, range: '0 ~ 50', syncStatus: '正常', lastSyncTime: '2026-09-16 06:00' },
  { metricCode: 'M.bearing_temp', metricVersion: 'v1.0', name: '轴承温度', unit: '℃', dataType: '数值', precision: 0.1, range: '0 ~ 120', syncStatus: '正常', lastSyncTime: '2026-09-16 06:00' },
  { metricCode: 'M.ambient_humidity', metricVersion: 'v1.0', name: '环境湿度', unit: '%RH', dataType: '数值', precision: 1, range: '0 ~ 100', syncStatus: '已失效', lastSyncTime: '2026-08-28 06:00' },
  { metricCode: 'S.machine_state', metricVersion: 'v1.3', name: '设备状态', unit: '--', dataType: '状态', precision: '--', range: '运行/待机/计划停机/故障/维修中/无数据', syncStatus: '正常', lastSyncTime: '2026-09-16 06:00' },
  { metricCode: 'S.alarm_code', metricVersion: 'v1.3', name: '报警代码', unit: '--', dataType: '事件', precision: '--', range: 'PLC 报警表', syncStatus: '正常', lastSyncTime: '2026-09-16 06:00' },
  { metricCode: 'M.air_pressure', metricVersion: 'v1.0', name: '气源压力', unit: 'MPa', dataType: '数值', precision: 0.01, range: '0 ~ 1.0', syncStatus: '正常', lastSyncTime: '2026-09-16 06:00' },
  { metricCode: 'M.motor_current', metricVersion: 'v1.1', name: '电机电流', unit: 'A', dataType: '数值', precision: 0.1, range: '0 ~ 60', syncStatus: '正常', lastSyncTime: '2026-09-16 06:00' },
  { metricCode: 'M.oil_pressure', metricVersion: 'v1.0', name: '润滑油压', unit: 'MPa', dataType: '数值', precision: 0.01, range: '0 ~ 0.6', syncStatus: '正常', lastSyncTime: '2026-09-16 06:00' },
  { metricCode: 'M.weld_current', metricVersion: 'v1.0', name: '焊接电流', unit: 'A', dataType: '数值', precision: 1, range: '0 ~ 500', syncStatus: '正常', lastSyncTime: '2026-09-16 06:00' },
  { metricCode: 'M.axis_load', metricVersion: 'v1.0', name: '轴向负载', unit: '%', dataType: '数值', precision: 1, range: '0 ~ 100', syncStatus: '正常', lastSyncTime: '2026-09-16 06:00' },
  { metricCode: 'M.output', metricVersion: 'v1.1', name: '加工数量', unit: '件', dataType: '数值', precision: 1, range: '0 ~ 999999', syncStatus: '正常', lastSyncTime: '2026-09-16 06:00' },
  { metricCode: 'M.qualified', metricVersion: 'v1.1', name: '合格数量', unit: '件', dataType: '数值', precision: 1, range: '0 ~ 999999', syncStatus: '正常', lastSyncTime: '2026-09-16 06:00' },
];

export const metricsByKey = Object.fromEntries(metrics.map(m => [m.metricCode, m]));
