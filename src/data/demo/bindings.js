// ============================================================
// 设备绑定（DeviceBinding / BindingItem / MetricSelection）初始快照；§3.2
// 一个活动绑定对应一个业务设备；恰好一个 IoT 主设备，可多个子传感器；
// 换绑不覆盖旧版本（bindingVersions 保存历史与生效区间）。
// 协议/网关/IP/端口/点位不在本系统维护（IoT 平台职责），此处只存来源编码与指标选择。
// ============================================================

const sel = (code, version, monitored = true) => ({ metricCode: code, metricVersion: version, monitored });

export const bindingsByDeviceId = {
  'DEV-001': {
    bindingId: 'binding-001-v2', deviceId: 'DEV-001', version: 2, configStatus: '已启用', healthStatus: '正常',
    effectiveFrom: '2026-06-01 09:00', effectiveTo: null, pullCycleSec: 60, lastPullTime: '2026-09-16 16:41:10', pullFailCount: 0, pendingCompensation: 0,
    items: [
      { iotDeviceId: 'iot-main-001', iotDeviceCode: 'IOT-D-10001', role: 'main', sensorType: '--', enabled: true, metrics: [sel('M.spindle_temp', 'v1.2'), sel('M.coolant_temp', 'v1.2'), sel('M.spindle_speed', 'v1.1'), sel('M.feed_rate', 'v1.1'), sel('S.machine_state', 'v1.3'), sel('S.alarm_code', 'v1.3')] },
      { iotDeviceId: 'iot-s-20011', iotDeviceCode: 'IOT-S-20011', role: 'sensor', sensorType: '振动传感器', enabled: true, metrics: [sel('M.vib_amplitude', 'v2.0'), sel('M.bearing_temp', 'v1.0', false)] },
      { iotDeviceId: 'iot-s-20012', iotDeviceCode: 'IOT-S-20012', role: 'sensor', sensorType: '温度传感器', enabled: true, metrics: [sel('M.bearing_temp', 'v1.0')] },
    ],
  },
  'DEV-002': {
    bindingId: 'binding-002-v2', deviceId: 'DEV-002', version: 2, configStatus: '已启用', healthStatus: '延迟',
    effectiveFrom: '2026-08-30 09:00', effectiveTo: null, pullCycleSec: 60, lastPullTime: '2026-09-16 16:38:22', pullFailCount: 0, pendingCompensation: 12,
    items: [
      { iotDeviceId: 'iot-main-002', iotDeviceCode: 'IOT-D-10002', role: 'main', sensorType: '--', enabled: true, metrics: [sel('M.spindle_temp', 'v1.2'), sel('M.coolant_temp', 'v1.2'), sel('M.spindle_speed', 'v1.1'), sel('S.machine_state', 'v1.3')] },
    ],
  },
  'DEV-003': {
    bindingId: 'binding-003-v1', deviceId: 'DEV-003', version: 1, configStatus: '已启用', healthStatus: '部分中断',
    effectiveFrom: '2026-07-15 14:00', effectiveTo: null, pullCycleSec: 60, lastPullTime: '2026-09-16 16:40:55', pullFailCount: 1, pendingCompensation: 2,
    items: [
      { iotDeviceId: 'iot-main-003', iotDeviceCode: 'IOT-D-10003', role: 'main', sensorType: '--', enabled: true, metrics: [sel('M.spindle_temp', 'v1.2'), sel('M.spindle_speed', 'v1.1'), sel('S.machine_state', 'v1.3')] },
      { iotDeviceId: 'iot-s-20031', iotDeviceCode: 'IOT-S-20031', role: 'sensor', sensorType: '振动传感器', enabled: true, metrics: [sel('M.vib_amplitude', 'v2.0')] },
      { iotDeviceId: 'iot-s-20032', iotDeviceCode: 'IOT-S-20032', role: 'sensor', sensorType: '温度传感器', enabled: false, metrics: [sel('M.bearing_temp', 'v1.0')] },
    ],
  },
  'DEV-004': {
    bindingId: 'binding-004-v2', deviceId: 'DEV-004', version: 2, configStatus: '已启用', healthStatus: '正常',
    effectiveFrom: '2026-08-10 08:00', effectiveTo: null, pullCycleSec: 60, lastPullTime: '2026-09-16 16:41:07', pullFailCount: 0, pendingCompensation: 0,
    items: [
      { iotDeviceId: 'iot-main-004', iotDeviceCode: 'IOT-D-10004', role: 'main', sensorType: '--', enabled: true, metrics: [sel('M.spindle_temp', 'v1.2'), sel('M.oil_pressure', 'v1.0'), sel('M.axis_load', 'v1.0'), sel('S.machine_state', 'v1.3')] },
      { iotDeviceId: 'iot-s-20041', iotDeviceCode: 'IOT-S-20041', role: 'sensor', sensorType: '温度传感器', enabled: true, metrics: [sel('M.bearing_temp', 'v1.0')] },
    ],
  },
  'DEV-005': {
    bindingId: 'binding-005-v1', deviceId: 'DEV-005', version: 1, configStatus: '已启用', healthStatus: '数据中断',
    effectiveFrom: '2026-05-20 10:00', effectiveTo: null, pullCycleSec: 60, lastPullTime: '2026-09-16 15:22:30', pullFailCount: 3, pendingCompensation: 5,
    items: [
      { iotDeviceId: 'iot-main-005', iotDeviceCode: 'IOT-D-10005', role: 'main', sensorType: '--', enabled: true, metrics: [sel('M.weld_current', 'v1.0'), sel('S.machine_state', 'v1.3')] },
    ],
  },
  'DEV-006': {
    bindingId: 'binding-006-v2', deviceId: 'DEV-006', version: 2, configStatus: '已启用', healthStatus: '正常',
    effectiveFrom: '2026-08-01 08:30', effectiveTo: null, pullCycleSec: 300, lastPullTime: '2026-09-16 16:40:02', pullFailCount: 0, pendingCompensation: 0,
    items: [
      { iotDeviceId: 'iot-main-006', iotDeviceCode: 'IOT-D-10006', role: 'main', sensorType: '--', enabled: true, metrics: [sel('M.air_pressure', 'v1.0'), sel('M.motor_current', 'v1.1'), sel('S.machine_state', 'v1.3')] },
    ],
  },
  'DEV-007': {
    bindingId: 'binding-007-v1', deviceId: 'DEV-007', version: 1, configStatus: '已停用', healthStatus: '--',
    effectiveFrom: '2026-03-10 09:00', effectiveTo: '2026-06-30 16:00', pullCycleSec: 60, lastPullTime: '2026-08-30 18:00:00', pullFailCount: 0, pendingCompensation: 0,
    items: [
      { iotDeviceId: 'iot-main-007', iotDeviceCode: 'IOT-D-10007', role: 'main', sensorType: '--', enabled: false, metrics: [sel('M.spindle_speed', 'v1.1', false), sel('M.oil_pressure', 'v1.0', false), sel('S.machine_state', 'v1.3', false)] },
    ],
  },
  // DEV-008 无绑定：验证「空绑定必须能创建首个绑定」
};

// 绑定版本历史（换绑/停用留痕；bindingId: { deviceId, version, configStatus, effectiveFrom, effectiveTo, summary }）
export const bindingVersions = [
  { bindingId: 'binding-001-v1', deviceId: 'DEV-001', version: 1, configStatus: '已停用', effectiveFrom: '2026-03-01 09:00', effectiveTo: '2026-06-01 08:59', summary: '初始绑定（仅主设备）' },
  { bindingId: 'binding-001-v2', deviceId: 'DEV-001', version: 2, configStatus: '已启用', effectiveFrom: '2026-06-01 09:00', effectiveTo: null, summary: '增加振动/温度子传感器，补充进给速度指标' },
  { bindingId: 'binding-002-v1', deviceId: 'DEV-002', version: 1, configStatus: '已停用', effectiveFrom: '2026-03-10 09:00', effectiveTo: '2026-08-30 08:59', summary: '初始绑定' },
  { bindingId: 'binding-002-v2', deviceId: 'DEV-002', version: 2, configStatus: '已启用', effectiveFrom: '2026-08-30 09:00', effectiveTo: null, summary: '换绑至新网关主设备 IOT-D-10002' },
  { bindingId: 'binding-004-v1', deviceId: 'DEV-004', version: 1, configStatus: '已停用', effectiveFrom: '2026-05-12 10:00', effectiveTo: '2026-08-10 07:59', summary: '初始绑定' },
  { bindingId: 'binding-004-v2', deviceId: 'DEV-004', version: 2, configStatus: '已启用', effectiveFrom: '2026-08-10 08:00', effectiveTo: null, summary: '增加温度子传感器与轴向负载指标' },
  { bindingId: 'binding-006-v1', deviceId: 'DEV-006', version: 1, configStatus: '已停用', effectiveFrom: '2026-01-15 09:00', effectiveTo: '2026-08-01 08:29', summary: '初始绑定' },
  { bindingId: 'binding-006-v2', deviceId: 'DEV-006', version: 2, configStatus: '已启用', effectiveFrom: '2026-08-01 08:30', effectiveTo: null, summary: '采集周期由 60s 调整为 300s' },
  { bindingId: 'binding-007-v1', deviceId: 'DEV-007', version: 1, configStatus: '已停用', effectiveFrom: '2026-03-10 09:00', effectiveTo: '2026-06-30 16:00', summary: '设备停用后绑定停用' },
];

// IoT 来源设备（只读；主设备 + 子传感器）
export const sourceDevices = [
  { iotDeviceId: 'iot-main-001', iotDeviceCode: 'IOT-D-10001', name: 'CNC-01 主控制器', kind: '主设备', product: '工业智能网关 GW200' },
  { iotDeviceId: 'iot-s-20011', iotDeviceCode: 'IOT-S-20011', name: 'CNC-01 振动传感器', kind: '子传感器', product: '振动传感器 VB12' },
  { iotDeviceId: 'iot-s-20012', iotDeviceCode: 'IOT-S-20012', name: 'CNC-01 温度传感器', kind: '子传感器', product: '温度传感器 TP08' },
  { iotDeviceId: 'iot-main-002', iotDeviceCode: 'IOT-D-10002', name: 'CNC-02 主控制器', kind: '主设备', product: '工业智能网关 GW200' },
  { iotDeviceId: 'iot-main-003', iotDeviceCode: 'IOT-D-10003', name: '激光-03 主控制器', kind: '主设备', product: '工业智能网关 GW200' },
  { iotDeviceId: 'iot-s-20031', iotDeviceCode: 'IOT-S-20031', name: '激光-03 振动传感器', kind: '子传感器', product: '振动传感器 VB12' },
  { iotDeviceId: 'iot-s-20032', iotDeviceCode: 'IOT-S-20032', name: '激光-03 温度传感器', kind: '子传感器', product: '温度传感器 TP08' },
  { iotDeviceId: 'iot-main-004', iotDeviceCode: 'IOT-D-10004', name: '铲齿-04 主控制器', kind: '主设备', product: '工业智能网关 GW200' },
  { iotDeviceId: 'iot-s-20041', iotDeviceCode: 'IOT-S-20041', name: '铲齿-04 温度传感器', kind: '子传感器', product: '温度传感器 TP08' },
  { iotDeviceId: 'iot-main-005', iotDeviceCode: 'IOT-D-10005', name: '机器人-05 主控制器', kind: '主设备', product: '工业智能网关 GW200' },
  { iotDeviceId: 'iot-main-006', iotDeviceCode: 'IOT-D-10006', name: '空压机 主控制器', kind: '主设备', product: '工业智能网关 GW200' },
  { iotDeviceId: 'iot-main-007', iotDeviceCode: 'IOT-D-10007', name: '磨床 主控制器', kind: '主设备', product: '工业智能网关 GW200' },
  { iotDeviceId: 'iot-main-100', iotDeviceCode: 'IOT-D-10100', name: '备用主控制器（未占用）', kind: '主设备', product: '工业智能网关 GW200' },
  { iotDeviceId: 'iot-s-20100', iotDeviceCode: 'IOT-S-20100', name: '备用温度传感器（未占用）', kind: '子传感器', product: '温度传感器 TP08' },
];
