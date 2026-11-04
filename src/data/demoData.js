export const devices = [
  { id: 'DEV-001', name: 'CNC加工中心-01', code: 'CNC-001', workshop: '一号车间', line: '加工一线', comm: 'ONLINE', run: 'RUN', temp: 68.5, load: 78, feed: 1200, alarm: 1, lubricant: '正常', coolant: '正常', program: 'P-8842 / V3.2', compare: '一致', updated: '16:41:08', quality: '正常' },
  { id: 'DEV-002', name: 'CNC加工中心-02', code: 'CNC-002', workshop: '一号车间', line: '加工一线', comm: 'DELAYED', run: 'RUN', temp: 76.2, load: 84, feed: 1080, alarm: 2, lubricant: '正常', coolant: '异常', program: 'P-8842 / V3.2', compare: '参数不一致', updated: '16:38:22', quality: '延迟' },
  { id: 'DEV-003', name: '激光焊接机-03', code: 'LW-003', workshop: '一号车间', line: '焊接一线', comm: 'ONLINE', run: 'STANDBY', temp: null, load: null, feed: null, alarm: 0, lubricant: '正常', coolant: '正常', program: 'P-5521 / V2.1', compare: '不适用', updated: '16:41:05', quality: '正常' },
  { id: 'DEV-004', name: '数控铲齿机-04', code: 'GM-004', workshop: '二号车间', line: '铲齿线', comm: 'ONLINE', run: 'FAULT', temp: 91.8, load: 95, feed: 0, alarm: 3, lubricant: '异常', coolant: '异常', program: 'P-7310 / V5.0', compare: '一致', updated: '16:41:07', quality: '正常' },
  { id: 'DEV-005', name: '机器人焊接-05', code: 'RB-005', workshop: '二号车间', line: '焊接二线', comm: 'OFFLINE', run: 'RUN', temp: 63.2, load: 58, feed: 760, alarm: 0, lubricant: '无数据', coolant: '无数据', program: 'P-9034 / V1.8', compare: '不适用', updated: '15:22:30', quality: '离线' },
];

export const alarmEvents = [
  { id: 'ALM-20260902-001', device: 'DEV-004', deviceName: '数控铲齿机-04', name: '主轴温度高高报警', rule: 'R-TEMP-001', severity: '紧急', status: '已触发', metric: '主轴温度', trigger: '91.8 ℃', threshold: '> 88 ℃ 持续 60s', time: '16:22:35', duration: '18m 33s', repeat: 2, ack: '-', escalation: '0', notify: '成功', policy: 'NP-URGENT', recovery: '自动恢复', handler: '-', recovered: '', merge: 0 },
  { id: 'ALM-20260902-002', device: 'DEV-002', deviceName: 'CNC加工中心-02', name: '冷却液温度持续超限', rule: 'R-TEMP-002', severity: '重要', status: '处理中', metric: '冷却液温度', trigger: '44.6 ℃', threshold: '> 42 ℃ 持续 60s', time: '15:58:11', duration: '43m 0s', repeat: 1, ack: '16:02:40', escalation: '0', notify: '成功', policy: 'NP-IMPORTANT', recovery: '自动恢复', handler: '李明', recovered: '', merge: 0 },
  { id: 'ALM-20260902-003', device: 'DEV-002', deviceName: 'CNC加工中心-02', name: 'MES程序参数不一致', rule: 'R-COMPARE-001', severity: '重要', status: '处理中', metric: '程序比对', trigger: '进给倍率 120%', threshold: '基准 105% · 容差 ±3%', time: '14:41:20', duration: '1h 59m', repeat: 1, ack: '14:48:02', escalation: '1', notify: '成功', policy: 'NP-IMPORTANT', recovery: '人工处置关闭', handler: '王强', recovered: '', merge: 0, repairOrder: 'BX-20260902-011' },
  { id: 'ALM-20260902-004', device: 'DEV-001', deviceName: 'CNC加工中心-01', name: '数据采集延迟', rule: 'R-QUALITY-001', severity: '一般', status: '已关闭', metric: '数据质量', trigger: '延迟 32s', threshold: '> 30s 持续 60s', time: '13:02:10', duration: '1m 12s', repeat: 1, ack: '13:04:00', escalation: '0', notify: '成功', policy: 'NP-GENERAL', recovery: '自动恢复', handler: '-', recovered: '延迟 8s · 13:03:22', merge: 3 },
  { id: 'ALM-20260902-005', device: 'DEV-003', deviceName: '激光焊接机-03', name: '设备状态切换频繁', rule: 'R-STATE-001', severity: '提示', status: '已关闭', metric: '运行状态', trigger: '切换 8 次/10min', threshold: '> 6 次', time: '11:20:44', duration: '10m 0s', repeat: 1, ack: '11:24:18', escalation: '0', notify: '成功', policy: 'NP-GENERAL', recovery: '自动恢复', handler: '-', recovered: '状态 RUN · 11:30:44', merge: 0 },
  { id: 'ALM-20260902-006', device: 'DEV-002', deviceName: 'CNC加工中心-02', name: '点检异常项未闭环', rule: 'R-INSPECT-001', severity: '一般', status: '处理中', metric: '点检结果', trigger: '气压 0.52 MPa', threshold: '0.6 ~ 0.8 MPa', time: '10:12:30', duration: '6h 29m', repeat: 1, ack: '10:20:05', escalation: '0', notify: '成功', policy: 'NP-GENERAL', recovery: '业务闭环', handler: '-', recovered: '', merge: 0 },
  { id: 'ALM-20260902-007', device: 'DEV-003', deviceName: '激光焊接机-03', name: '保养任务逾期未执行', rule: 'R-MAINT-001', severity: '一般', status: '已触发', metric: '保养计划', trigger: '逾期 2 天', threshold: '超期 24h 未完成', time: '09:00:00', duration: '7h 41m', repeat: 1, ack: '-', escalation: '0', notify: '成功', policy: 'NP-GENERAL', recovery: '业务闭环', handler: '-', recovered: '', merge: 0 },
  { id: 'ALM-20260902-008', device: 'DEV-001', deviceName: 'CNC加工中心-01', name: '备件库存低于安全库存', rule: 'R-SPARE-001', severity: '提示', status: '处理中', metric: '备件库存', trigger: '主轴轴承润滑脂 剩 36', threshold: '安全库存 40', time: '08:35:12', duration: '8h 06m', repeat: 2, ack: '08:50:40', escalation: '0', notify: '成功', policy: 'NP-GENERAL', recovery: '业务闭环', handler: '陈晨', recovered: '', merge: 0 },
];

export const metricRows = [
  { device: 'DEV-001', metric: '主轴温度', endpoint: 'PLC-01', address: 'D4200', unit: '℃', period: '1s', valid: '0-120', support: '支持', status: '启用' },
  { device: 'DEV-001', metric: '主轴负载', endpoint: 'PLC-01', address: 'D4202', unit: '%', period: '1s', valid: '0-100', support: '支持', status: '启用' },
  { device: 'DEV-002', metric: '冷却液温度', endpoint: 'PLC-02', address: 'D5101', unit: '℃', period: '2s', valid: '0-80', support: '支持', status: '启用' },
  { device: 'DEV-003', metric: '激光功率', endpoint: 'MES-03', address: 'laser.power', unit: 'kW', period: '5s', valid: '0-12', support: '待确认', status: '停用' },
  { device: 'DEV-005', metric: '振动加速度', endpoint: 'IoT-05', address: 'vib.rms', unit: 'mm/s', period: '1s', valid: '0-30', support: '不支持', status: '未配置' },
];

export const qualityRows = [
  { device: 'DEV-001', metric: '主轴温度', endpoint: 'PLC-01', expected: 3600, received: 3600, valid: 3598, missing: 2, delayed: 0, backfill: 0, duplicate: 0, rate: '99.94%', last: '16:41:08' },
  { device: 'DEV-002', metric: '冷却液温度', endpoint: 'PLC-02', expected: 3600, received: 3562, valid: 3558, missing: 38, delayed: 12, backfill: 24, duplicate: 3, rate: '98.83%', last: '16:38:22' },
  { device: 'DEV-004', metric: '润滑油压', endpoint: 'PLC-04', expected: 3600, received: 3594, valid: 3588, missing: 6, delayed: 1, backfill: 2, duplicate: 1, rate: '99.67%', last: '16:41:07' },
  { device: 'DEV-005', metric: '主轴负载', endpoint: 'IoT-05', expected: 3600, received: 0, valid: 0, missing: 3600, delayed: 0, backfill: 0, duplicate: 0, rate: '0%', last: '15:22:30' },
];

export const programRows = [
  { device: 'DEV-002', program: 'P-8842', version: 'V3.2', baseline: 2, result: '参数不一致', diff: '进给倍率：105% / 120%；冷却流量：8.0 / 7.2 L/min', tolerance: '±1%', handled: '处理中', user: '-', time: '16:20:12' },
  { device: 'DEV-001', program: 'P-8842', version: 'V3.2', baseline: 1, result: '一致', diff: '-', tolerance: '±1%', handled: '无需处理', user: '-', time: '16:18:55' },
  { device: 'DEV-004', program: 'P-7310', version: 'V5.0', baseline: 1, result: '比对失败', diff: 'PLC 读取超时', tolerance: '±0.5%', handled: '待确认', user: '王强', time: '15:44:10' },
  { device: 'DEV-003', program: 'P-5521', version: 'V2.1', baseline: 0, result: '不适用', diff: '无程序下发基线', tolerance: '-', handled: '无需处理', user: '-', time: '-' },
];

export const ruleRows = [
  { code: 'R-TEMP-001', name: '主轴温度持续超限', type: '阈值', device: 'CNC加工中心', metric: '主轴温度', condition: '> 80℃ 持续 60s', recovery: '< 75℃（回差 5℃）持续 30s 自动恢复', suppress: '活动事件抑制 · 重复提醒 5min', storm: '≤ 3 条/小时', trig7d: 18, supp7d: 35, severity: '重要', policy: '站内+企业微信；5min升级', status: '已发布', version: 'V3' },
  { code: 'R-PRESS-001', name: '气压压力区间异常', type: '阈值', device: 'CNC加工中心', metric: '气压压力', condition: '区间外 0.6 ~ 0.8 MPa 持续 30s', recovery: '回到 0.65 ~ 0.75 MPa（回差 0.05）持续 30s 自动恢复', suppress: '活动事件抑制 · 重复提醒 5min', storm: '≤ 3 条/小时', trig7d: 7, supp7d: 4, severity: '一般', policy: '站内', status: '已发布', version: 'V1' },
  { code: 'R-STATE-001', name: '设备故障立即报警', type: '状态', device: '全部设备', metric: '运行状态', condition: 'FAULT / ESTOP 立即触发', recovery: '状态恢复正常自动恢复', suppress: '活动事件抑制 · 重复提醒 10min', storm: '≤ 5 条/小时', trig7d: 12, supp7d: 3, severity: '紧急', policy: '站内+短信；立即升级', status: '已发布', version: 'V5' },
  { code: 'R-COMPARE-001', name: 'MES程序参数不一致', type: '程序', device: '有程序下发设备', metric: '程序比对', condition: '实际参数 ≠ 基线且超容差', recovery: '人工处置关闭或基线更新', suppress: '活动事件抑制 · 不重复提醒', storm: '≤ 2 条/小时', trig7d: 9, supp7d: 2, severity: '重要', policy: '站内；10min升级', status: '已发布', version: 'V2' },
  { code: 'R-QUALITY-001', name: '采集数据延迟', type: '质量', device: '全部设备', metric: '最后采集时间', condition: '延迟 > 30s 持续 60s', recovery: '延迟 < 10s 持续 60s 自动恢复（回差 20s）', suppress: '活动事件抑制 · 重复提醒 15min', storm: '≤ 3 条/小时', trig7d: 27, supp7d: 41, severity: '一般', policy: '站内', status: '已发布', version: 'V4' },
  { code: 'R-INSPECT-001', name: '点检异常项报警', type: '点检', device: '全部设备', metric: '点检结果', condition: '点检项目结果 = 异常', recovery: '异常项闭环（转维修 / 处理完成）后关闭', suppress: '活动事件抑制 · 不重复提醒', storm: '≤ 2 条/小时', trig7d: 6, supp7d: 1, severity: '一般', policy: '站内', status: '已发布', version: 'V1' },
  { code: 'R-MAINT-001', name: '保养任务逾期未执行', type: '保养', device: '全部设备', metric: '保养任务', condition: '超过计划完成时间 24h 未完成', recovery: '任务完成或提交延期申请后关闭', suppress: '活动事件抑制 · 每日提醒 1 次', storm: '≤ 1 条/小时', trig7d: 4, supp7d: 0, severity: '一般', policy: '站内+企业微信', status: '已发布', version: 'V1' },
  { code: 'R-REPAIR-001', name: '报修超时未响应', type: '维修', device: '全部设备', metric: '报修单', condition: '报修后 30min 未生成维修任务', recovery: '生成维修任务后自动关闭', suppress: '活动事件抑制 · 重复提醒 10min', storm: '≤ 2 条/小时', trig7d: 3, supp7d: 0, severity: '重要', policy: '站内+企业微信', status: '已发布', version: 'V1' },
  { code: 'R-SPARE-001', name: '备件库存低于安全库存', type: '备件', device: '全部备件', metric: '库存数量', condition: '当前库存 < 安全库存', recovery: '补货入库至安全库存后自动关闭', suppress: '活动事件抑制 · 每日提醒 1 次', storm: '≤ 1 条/小时', trig7d: 5, supp7d: 2, severity: '提示', policy: '站内', status: '已发布', version: 'V1' },
];

export const auditRows = [
  { time: '17:05:18', user: '李明', action: '关闭报警', object: 'ALM-20260902-004', before: '处理中', after: '已关闭', reason: '现场确认采集恢复，异常消除', ip: '192.168.10.24' },
  { time: '16:50:42', user: '王强', action: '规则发布', object: 'R-TEMP-001 / V3', before: 'V2', after: 'V3', reason: '调整恢复阈值避免反复触发', ip: '192.168.10.31' },
  { time: '16:22:40', user: '赵艳', action: '确认报警', object: 'ALM-20260902-001', before: '已触发', after: '处理中', reason: '已通知现场检查', ip: '192.168.10.18' },
];

export const ruleVersions = [
  { code: 'R-TEMP-001', name: '主轴温度持续超限', version: 'V3', publish: '2026-09-02 16:50:42', publisher: '王强', effective: '2026-09-02 16:50:42 至今', condition: '主轴温度 > 80℃，持续 60s；恢复 < 75℃，持续 30s', notify: '站内+企业微信；5min 升级', events: 18, status: '已发布' },
  { code: 'R-TEMP-001', name: '主轴温度持续超限', version: 'V2', publish: '2026-08-18 10:12:00', publisher: '李明', effective: '2026-08-18 10:12:00 至 2026-09-02 16:50:41', condition: '主轴温度 > 82℃，持续 90s；恢复 < 74℃，持续 60s', notify: '站内+企业微信', events: 35, status: '已归档' },
  { code: 'R-STATE-001', name: '设备故障立即报警', version: 'V5', publish: '2026-08-26 09:30:00', publisher: '王强', effective: '2026-08-26 09:30:00 至今', condition: '运行状态 = FAULT / ESTOP', notify: '站内+短信；立即升级', events: 12, status: '已发布' },
  { code: 'R-COMPARE-001', name: 'MES程序参数不一致', version: 'V2', publish: '2026-08-30 14:20:00', publisher: '赵艳', effective: '2026-08-30 14:20:00 至今', condition: '实际参数 ≠ 基线且超容差', notify: '站内；10min 升级', events: 9, status: '已发布' },
  { code: 'R-QUALITY-001', name: '采集数据延迟', version: 'V4', publish: '2026-08-22 11:05:00', publisher: '李明', effective: '2026-08-22 11:05:00 至今', condition: '最后采集时间延迟 > 30s', notify: '站内', events: 27, status: '已发布' },
];

export const notificationRows = [
  { code: 'NP-URGENT', name: '紧急报警立即通知', level: '紧急', channels: '站内 / 短信 / 企业微信', groups: '设备管理员、当班班组长', receivers: '李明、王强、赵艳', first: '立即', interval: '5 分钟', escalation: '10 分钟 / 30 分钟', silent: '无', retries: 3, status: '启用' },
  { code: 'NP-IMPORTANT', name: '重要报警值班通知', level: '重要', channels: '站内 / 企业微信', groups: '当班班组长、维修人员', receivers: '王强、陈晨', first: '立即', interval: '10 分钟', escalation: '30 分钟', silent: '00:00-07:00', retries: 2, status: '启用' },
  { code: 'NP-GENERAL', name: '一般报警日间通知', level: '一般', channels: '站内', groups: '设备管理员', receivers: '李明', first: '1 分钟', interval: '不重复', escalation: '无', silent: '18:30-08:00', retries: 1, status: '启用' },
];

export const capabilityRows = [
  { code: 'CNC-001', name: 'CNC加工中心-01', type: 'CNC', location: '一号车间 / 加工一线', source: 'PLC', protocol: 'Modbus TCP', gateway: 'GW-01', state: '支持', metricTotal: 12, configured: 11, unsupported: 1, production: '支持', dispatch: '支持', compare: '支持', integration: '联调完成', acceptance: '通过' },
  { code: 'CNC-002', name: 'CNC加工中心-02', type: 'CNC', location: '一号车间 / 加工一线', source: 'PLC', protocol: 'Modbus TCP', gateway: 'GW-01', state: '支持', metricTotal: 12, configured: 10, unsupported: 2, production: '支持', dispatch: '支持', compare: '支持', integration: '联调完成', acceptance: '通过' },
  { code: 'LW-003', name: '激光焊接机-03', type: '激光', location: '一号车间 / 焊接一线', source: 'MES', protocol: 'REST', gateway: 'GW-03', state: '支持', metricTotal: 6, configured: 5, unsupported: 0, production: '支持', dispatch: '待确认', compare: '未配置', integration: '联调中', acceptance: '待验收' },
  { code: 'GM-004', name: '数控铲齿机-04', type: '铲齿机', location: '二号车间 / 铲齿线', source: 'PLC', protocol: 'OPC UA', gateway: 'GW-04', state: '支持', metricTotal: 10, configured: 9, unsupported: 1, production: '支持', dispatch: '支持', compare: '支持', integration: '联调完成', acceptance: '通过' },
  { code: 'RB-005', name: '机器人焊接-05', type: '机器人', location: '二号车间 / 焊接二线', source: 'IoT', protocol: 'MQTT', gateway: 'GW-05', state: '支持', metricTotal: 8, configured: 6, unsupported: 2, production: '支持', dispatch: '不支持', compare: '不支持', integration: '联调中', acceptance: '待验收' },
];

export const metricDictionaryRows = [
  { code: 'SPINDLE_TEMP', name: '主轴温度', category: '温度', unit: '℃', precision: '0.1', type: 'DECIMAL', range: '0-120', alarm: '是', display: '是', report: '是', status: '启用' },
  { code: 'SPINDLE_LOAD', name: '主轴负载', category: '负载', unit: '%', precision: '0', type: 'DECIMAL', range: '0-100', alarm: '是', display: '是', report: '是', status: '启用' },
  { code: 'COOLANT_TEMP', name: '冷却液温度', category: '温度', unit: '℃', precision: '0.1', type: 'DECIMAL', range: '0-80', alarm: '是', display: '是', report: '是', status: '启用' },
  { code: 'FEED_RATE', name: '进给率', category: '加工', unit: 'mm/min', precision: '0', type: 'DECIMAL', range: '0-5000', alarm: '否', display: '是', report: '是', status: '启用' },
  { code: 'VIB_RMS', name: '振动加速度', category: '振动', unit: 'mm/s', precision: '0.01', type: 'DECIMAL', range: '0-30', alarm: '待配置', display: '是', report: '否', status: '启用' },
];

// 指标判定特征模板：不同类型指标的报警规则模式与推荐参数不同。
// 规则配置选择指标后按此自动带出推荐配置（可修改），发布时随版本快照保存。
// mode: upper 越上限 / lower 越下限 / rangeOut 区间外 / state 枚举判定
export const metricAlarmTemplates = {
  'M.spindle_temp': { name: '主轴温度', category: '温度类', unit: '℃', range: '0-120', mode: 'upper', threshold: 80, duration: 60, deadband: 5, suggest: '越上限 > 80℃ 持续 60s；温度热惯性大，持续 60s 过滤加工载荷波动，回差取量程 4%（5℃）' },
  'M.coolant_temp': { name: '冷却液温度', category: '温度类', unit: '℃', range: '0-80', mode: 'upper', threshold: 42, duration: 60, deadband: 3, suggest: '越上限 > 42℃ 持续 60s；回差 3℃' },
  'M.bearing_temp': { name: '轴承温度', category: '温度类', unit: '℃', range: '0-120', mode: 'upper', threshold: 70, duration: 60, deadband: 4, suggest: '越上限 > 70℃ 持续 60s；回差 4℃' },
  'M.spindle_speed': { name: '主轴转速', category: '转速类', unit: 'rpm', range: '0-10000', mode: 'rangeOut', low: 500, high: 8000, duration: 10, deadband: 100, suggest: '区间外（正常 500~8000rpm）持续 10s；转速偏离工作区间即异常，双向共用一条规则' },
  'M.feed_rate': { name: '进给率', category: '加工类', unit: 'mm/min', range: '0-5000', mode: 'rangeOut', low: 600, high: 2000, duration: 10, deadband: 50, suggest: '区间外（正常 600~2000mm/min）持续 10s；用于程序参数漂移的辅助判定' },
  'M.air_pressure': { name: '气压压力', category: '压力类', unit: 'MPa', range: '0-1.0', mode: 'rangeOut', low: 0.6, high: 0.8, duration: 30, deadband: 0.05, suggest: '区间外（正常 0.6~0.8MPa）持续 30s；压力类存在正常工作区间，低于下限或高于上限均异常' },
  'M.oil_pressure': { name: '润滑油压', category: '压力类', unit: 'MPa', range: '0-1.0', mode: 'lower', threshold: 0.15, duration: 30, deadband: 0.02, suggest: '越下限 < 0.15MPa 持续 30s；油压过低直接威胁润滑，只设下限；恢复阈值 = 阈值 + 回差' },
  'M.motor_current': { name: '电机电流', category: '电流类', unit: 'A', range: '0-30', mode: 'upper', threshold: 18, duration: 30, deadband: 1, suggest: '越上限 > 18A 持续 30s；电流突升常伴随堵转/过载，回差 1A' },
  'M.vib_amplitude': { name: '振动幅值', category: '振动类', unit: 'mm/s', range: '0-30', mode: 'upper', threshold: 4.5, duration: 10, deadband: 0.5, suggest: '越上限 > 4.5mm/s 持续 10s；振动响应快，持续时间宜短；建议另配速率规则（振动增速率）检测突发异常' },
  'S.machine_state': { name: '设备状态', category: '状态类', unit: '枚举', range: 'RUN/STANDBY/FAULT/ESTOP/OFFLINE', mode: 'state', duration: 0, suggest: '枚举判定：状态 = FAULT / ESTOP 立即触发（持续 0），状态恢复即恢复；无阈值与回差概念' },
  'S.alarm_code': { name: 'CNC 报警码', category: '状态类', unit: '枚举', range: '0-9999', mode: 'state', duration: 0, suggest: '枚举判定：报警码 ≠ 0 立即触发；恢复条件为报警码回到 0' },
};

// 报警规则模板管理：同型设备的指标特征一致，模板 = 除「设备绑定」外的全部规则要素预设。
// 应用 = 选模板 + 选设备 + 选指标 → 三步生成规则；模板更新不回写已发布规则（规则发布是不可变版本快照）。
// refs = 已引用该模板生成的规则数（演示数据）。
export const ruleTemplates = [
  { code: 'RT-TEMP-001', name: '温度类越上限通用模板', metricType: '温度类指标（主轴/冷却液/轴承温度）', ruleType: '阈值', mode: 'upper', threshold: 80, duration: 60, deadband: 5, remind: 5, storm: 3, policy: 'NP-IMPORTANT', refs: 6, status: '启用', remark: '温度热惯性大，持续 60s 过滤加工载荷波动；回差取量程 4%' },
  { code: 'RT-PRESS-001', name: '压力类区间外通用模板', metricType: '压力类指标（气压/油压/液压）', ruleType: '阈值', mode: 'rangeOut', low: 0.6, high: 0.8, duration: 30, deadband: 0.05, remind: 5, storm: 3, policy: 'NP-GENERAL', refs: 4, status: '启用', remark: '压力类存在正常工作区间，双向共用一条规则；回差 0.05 消除边界震荡' },
  { code: 'RT-VIB-001', name: '振动类短持续越上限模板', metricType: '振动类指标（振动幅值/加速度）', ruleType: '阈值', mode: 'upper', threshold: 4.5, duration: 10, deadband: 0.5, remind: 10, storm: 2, policy: 'NP-IMPORTANT', refs: 2, status: '启用', remark: '振动响应快，持续时间宜短；建议配合速率规则检测突发异常' },
  { code: 'RT-STATE-001', name: '设备故障枚举判定模板', metricType: '状态类指标（设备状态/报警码）', ruleType: '状态', mode: 'state', duration: 0, deadband: 0, remind: 10, storm: 5, policy: 'NP-URGENT', refs: 5, status: '启用', remark: 'FAULT / ESTOP 立即触发，状态恢复即恢复；配合人工处置关闭用于责任认定' },
  { code: 'RT-CURR-001', name: '电流类过载保护模板', metricType: '电流类指标（主电机电流）', ruleType: '阈值', mode: 'upper', threshold: 18, duration: 30, deadband: 1, remind: 5, storm: 2, policy: 'NP-URGENT', refs: 0, status: '停用', remark: '电流突升常伴随堵转/过载；已由厂家标准参数替代，保留历史引用' },
];

export const gapRows = [
  { device: 'DEV-005', metric: '主轴负载', start: '15:22:30', end: '16:41:10', expected: 4700, reason: '设备离线' },
  { device: 'DEV-002', metric: '冷却液温度', start: '16:31:12', end: '16:38:22', expected: 210, reason: '网关重连补传中' },
  { device: 'DEV-003', metric: '激光功率', start: '16:00:00', end: '16:41:10', expected: 494, reason: '点位未配置' },
];

export const programHandleRows = [
  { record: 'PCR-20260902-002', device: 'CNC加工中心-02', program: 'P-8842 / V3.2', handler: '王强', time: '16:30:12', conclusion: '现场按基线回改参数', action: '停止加工，恢复进给倍率和冷却流量', alarm: 'ALM-20260902-003', repair: '未关联', attachment: '处置照片.jpg' },
  { record: 'PCR-20260902-001', device: 'CNC加工中心-01', program: 'P-8842 / V3.2', handler: '李明', time: '16:20:30', conclusion: '无需处理', action: '参数一致，继续生产', alarm: '未关联', repair: '未关联', attachment: '-' },
];

export const reportRows = {
  // 运行时长与设备状态统计（原「运行时长与稼动率」与「设备状态统计」两表合并：同一份状态时长数据的完整切面）
  runtime: [
    { date: '2026-09-02', device: 'CNC加工中心-01', deviceCount: 1, run: '13h 20m', standby: '1h 20m', fault: '0h 10m', offline: '0h 10m', ratio: '运行 88.9% / 待机 8.9% / 故障 1.1%', rate: '88.0%', complete: '99.9%', switches: 42, maxRun: '4h 20m', maxOffline: '0h 10m' },
    { date: '2026-09-02', device: 'CNC加工中心-02', deviceCount: 1, run: '12h 50m', standby: '1h 30m', fault: '0h 20m', offline: '0h 20m', ratio: '运行 85.3% / 待机 10.0% / 故障 1.3%', rate: '85.3%', complete: '98.8%', switches: 48, maxRun: '3h 50m', maxOffline: '0h 20m' },
    { date: '2026-09-02', device: '数控铲齿机-04', deviceCount: 1, run: '9h 30m', standby: '1h 10m', fault: '2h 40m', offline: '0h 10m', ratio: '运行 70.4% / 待机 8.6% / 故障 11.8%', rate: '69.9%', complete: '99.7%', switches: 35, maxRun: '3h 10m', maxOffline: '0h 10m' },
  ],
  alarm: [
    { date: '2026-09-02', device: '数控铲齿机-04', total: 3, pending: 1, processing: 0, recovered: 0, closed: 2, avgAck: '3m 20s', avgClose: '48m', repeat: 1, escalation: 0 },
    { date: '2026-09-02', device: 'CNC加工中心-02', total: 3, pending: 0, processing: 1, recovered: 0, closed: 2, avgAck: '4m 30s', avgClose: '70m', repeat: 0, escalation: 1 },
    { date: '2026-09-02', device: 'CNC加工中心-01', total: 2, pending: 0, processing: 1, recovered: 1, closed: 0, avgAck: '2m 40s', avgClose: '--', repeat: 0, escalation: 0 },
    { date: '2026-09-02', device: '激光焊接机-03', total: 2, pending: 1, processing: 0, recovered: 0, closed: 1, avgAck: '3m 34s', avgClose: '10m', repeat: 0, escalation: 0 },
  ],
  quality: [
    { date: '2026-09-02', device: 'CNC加工中心-01', expected: 86400, received: 86210, valid: 86180, missing: 220, delayed: 8, backfill: 20, duplicate: 2, rate: '99.74%' },
    { date: '2026-09-02', device: 'CNC加工中心-02', expected: 86400, received: 84980, valid: 84920, missing: 1420, delayed: 260, backfill: 420, duplicate: 18, rate: '98.29%' },
  ],
  production: [
    { date: '2026-09-02', device: 'CNC加工中心-01', output: 128, processed: 130, qualified: 126, unqualified: 4, passRate: '97.7%', beat: '2.4 s/件' },
    { date: '2026-09-02', device: 'CNC加工中心-02', output: 118, processed: 119, qualified: 117, unqualified: 2, passRate: '98.3%', beat: '2.6 s/件' },
    { date: '2026-09-02', device: '数控铲齿机-04', output: 86, processed: 86, qualified: 85, unqualified: 1, passRate: '98.8%', beat: '4.1 s/件' },
  ],
  program: [
    { date: '2026-09-02', device: '全部设备', dispatchCount: 8, compareCount: 8, same: 5, diff: 1, failed: 1, notApplicable: 1, handled: 1, pending: 1 },
  ],
  mttr: [
    { month: '2026-09', device: 'CNC加工中心-01', failures: 2, repairTime: '2h 40m', mttr: '1h 20m', runTime: '402h 15m', mtbf: '201h 08m', availability: '99.34%', lastFault: '2026-09-01 14:22', trend: '改善' },
    { month: '2026-09', device: 'CNC加工中心-02', failures: 3, repairTime: '4h 50m', mttr: '1h 37m', runTime: '396h 30m', mtbf: '132h 10m', availability: '98.79%', lastFault: '2026-09-02 15:58', trend: '持平' },
    { month: '2026-09', device: '激光焊接机-03', failures: 1, repairTime: '0h 50m', mttr: '0h 50m', runTime: '410h 20m', mtbf: '410h 20m', availability: '99.80%', lastFault: '2026-08-28 09:14', trend: '改善' },
    { month: '2026-09', device: '数控铲齿机-04', failures: 5, repairTime: '9h 15m', mttr: '1h 51m', runTime: '371h 05m', mtbf: '74h 13m', availability: '97.57%', lastFault: '2026-09-02 16:22', trend: '恶化' },
    { month: '2026-09', device: '机器人焊接-05', failures: 2, repairTime: '3h 05m', mttr: '1h 33m', runTime: '380h 40m', mtbf: '190h 20m', availability: '99.20%', lastFault: '2026-09-02 11:47', trend: '持平' },
    { month: '2026-09', device: '全部设备（汇总）', failures: 13, repairTime: '20h 40m', mttr: '1h 35m', runTime: '1960h 50m', mtbf: '150h 50m', availability: '98.96%', lastFault: '2026-09-02 16:22', trend: '-' },
  ],
  comprehensive: [
    { device: 'CNC加工中心-02', state: '运行', rate: '85.3%', alarms: 2, importantAlarms: 2, quality: '98.29%', output: 118, passRate: '98.3%', diffCount: 1 },
    { device: '数控铲齿机-04', state: '故障', rate: '69.9%', alarms: 3, importantAlarms: 1, quality: '99.67%', output: 86, passRate: '98.8%', diffCount: 0 },
    { device: 'CNC加工中心-01', state: '运行', rate: '88.0%', alarms: 1, importantAlarms: 0, quality: '99.74%', output: 128, passRate: '97.7%', diffCount: 0 },
  ],

  // 点检执行统计（日期 × 计划 × 设备；正常/异常按已检项目计）
  inspection: [
    { date: '2026-09-04', plan: '数控车床日常点检计划', device: '数控车床 MT2024A1201', should: 2, checked: 1, normal: 1, abnormal: 0, unchecked: 1, rate: '0%', desc: '-', handle: '-', owner: '李四' },
    { date: '2026-09-04', plan: '激光焊接机日常点检计划', device: '激光焊接机 MT2024A1204', should: 2, checked: 1, normal: 0, abnormal: 1, unchecked: 1, rate: '100%', desc: '冷却水温 31℃（标准 22~28℃）', handle: '已转维修', owner: '赵艳' },
    { date: '2026-09-04', plan: '空压机周点检计划', device: '空压机 MT2024A1206', should: 3, checked: 3, normal: 2, abnormal: 1, unchecked: 0, rate: '33.3%', desc: '排气压力 0.45MPa（标准 ≥0.5MPa）', handle: '已生成报修', owner: '李明' },
    { date: '2026-09-03', plan: '数控车床日常点检计划', device: '数控车床 MT2024A1201', should: 2, checked: 2, normal: 2, abnormal: 0, unchecked: 0, rate: '0%', desc: '-', handle: '-', owner: '李四' },
    { date: '2026-09-03', plan: '数控车床日常点检计划', device: '数控车床 MT2024A1202', should: 2, checked: 1, normal: 1, abnormal: 0, unchecked: 1, rate: '0%', desc: '-', handle: '-', owner: '李四' },
    { date: '2026-09-03', plan: '数控车床日常点检计划', device: '立式加工中心 MT2024A1203', should: 1, checked: 1, normal: 1, abnormal: 0, unchecked: 0, rate: '0%', desc: '-', handle: '-', owner: '李四' },
    { date: '2026-09-03', plan: '激光焊接机日常点检计划', device: '激光焊接机 MT2024A1204', should: 2, checked: 2, normal: 2, abnormal: 0, unchecked: 0, rate: '0%', desc: '-', handle: '-', owner: '赵艳' },
  ],

  // 巡检执行统计（日期 × 巡检计划 × 设备）
  patrol: [
    { date: '2026-09-04', plan: '一号车间日常巡检计划', device: '数控车床 MT2024A1201', should: 2, checked: 2, normal: 2, abnormal: 0, unchecked: 0, rate: '0%', desc: '-', handle: '-', owner: '李四' },
    { date: '2026-09-04', plan: '一号车间日常巡检计划', device: '立式加工中心 MT2024A1203', should: 1, checked: 1, normal: 1, abnormal: 0, unchecked: 0, rate: '0%', desc: '-', handle: '-', owner: '李四' },
    { date: '2026-09-04', plan: '一号车间日常巡检计划', device: '激光焊接机 MT2024A1204', should: 2, checked: 0, normal: 0, abnormal: 0, unchecked: 2, rate: '--', desc: '未巡检（待执行）', handle: '-', owner: '李四' },
    { date: '2026-09-04', plan: '二号车间日常巡检计划', device: '数控铲齿机 GM-004', should: 3, checked: 1, normal: 0, abnormal: 1, unchecked: 2, rate: '100%', desc: '主轴侧运行异响', handle: '已生成报修', owner: '王强' },
    { date: '2026-09-03', plan: '一号车间日常巡检计划', device: '数控车床 MT2024A1201', should: 2, checked: 2, normal: 2, abnormal: 0, unchecked: 0, rate: '0%', desc: '-', handle: '-', owner: '李四' },
    { date: '2026-09-03', plan: '一号车间日常巡检计划', device: '空压机 MT2024A1206', should: 1, checked: 1, normal: 1, abnormal: 0, unchecked: 0, rate: '0%', desc: '-', handle: '-', owner: '李四' },
    { date: '2026-09-03', plan: '动力站夜间巡检计划', device: '空压机 MT2024A1206', should: 2, checked: 2, normal: 1, abnormal: 1, unchecked: 0, rate: '50%', desc: '油位低于标线', handle: '现场补油并记录', owner: '夜班值班' },
  ],

  // 保养执行统计（按保养任务；正常/异常按已保项目计，异常=保养中发现的缺陷）
  maintenance: [
    { date: '2026-09-04', plan: '数控车床一级保养计划', device: '数控车床 MT2024A1202', level: '一级', status: '进行中', should: 4, checked: 2, normal: 1, abnormal: 1, rate: '50%', desc: '导轨润滑检查发现油路堵塞', handle: '已生成维修工单', owner: '机修班-王强' },
    { date: '2026-09-04', plan: '数控车床一级保养计划', device: '数控车床 MT2024A1201', level: '一级', status: '未开始', should: 4, checked: 0, normal: 0, abnormal: 0, rate: '--', desc: '-', handle: '-', owner: '机修班-王强' },
    { date: '2026-09-05', plan: '激光焊接机二级保养计划', device: '激光焊接机 MT2024A1204', level: '二级', status: '已逾期', should: 3, checked: 0, normal: 0, abnormal: 0, rate: '--', desc: '-', handle: '备件未到位，已提交延期申请', owner: '厂家工程师' },
    { date: '2026-09-03', plan: '数控车床一级保养计划', device: '立式加工中心 MT2024A1203', level: '一级', status: '已完成', should: 4, checked: 4, normal: 4, abnormal: 0, rate: '0%', desc: '-', handle: '-', owner: '机修班-王强' },
    { date: '2026-08-30', plan: '空压机三级保养计划', device: '空压机 MT2024A1206', level: '三级', status: '已完成', should: 5, checked: 5, normal: 4, abnormal: 1, rate: '20%', desc: '油分压差 25kPa 超标（≤15kPa）', handle: '列入备件采购', owner: '李明' },
  ],

  // 维修统计（按月 × 设备）
  repair: [
    { date: '2026-09', device: '数控车床 MT2024A1201', reports: 2, orders: 2, done: 1, doing: 1, pending: 0, mech: 1, elec: 0, hyd: 0, ctrl: 1, avgRepair: '1h 40m', firstFix: '75%', downtime: '3h 20m', cost: '2,150' },
    { date: '2026-09', device: '数控铲齿机-04', reports: 3, orders: 3, done: 2, doing: 1, pending: 0, mech: 2, elec: 1, hyd: 0, ctrl: 0, avgRepair: '1h 51m', firstFix: '67%', downtime: '9h 15m', cost: '5,680' },
    { date: '2026-09', device: '立式加工中心 MT2024A1203', reports: 1, orders: 1, done: 1, doing: 0, pending: 0, mech: 0, elec: 1, hyd: 0, ctrl: 0, avgRepair: '0h 50m', firstFix: '100%', downtime: '0h 50m', cost: '480' },
    { date: '2026-09', device: '激光焊接机 MT2024A1204', reports: 1, orders: 1, done: 1, doing: 0, pending: 0, mech: 1, elec: 0, hyd: 0, ctrl: 0, avgRepair: '1h 15m', firstFix: '100%', downtime: '1h 15m', cost: '960' },
    { date: '2026-09', device: '空压机 MT2024A1206', reports: 1, orders: 1, done: 0, doing: 0, pending: 1, mech: 1, elec: 0, hyd: 0, ctrl: 0, avgRepair: '--', firstFix: '--', downtime: '--', cost: '--' },
  ],

  // 备件管理统计（按备件；期初 = 当前库存 − 入库 + 出库）
  sparepart: [
    { code: '120001', name: '备件一', spec: '12*12*6', unit: '个', begin: 900, inbound: 200, outbound: 101, stock: 999, safe: 400, max: 1000, state: '正常', turns: '31 天', usedCount: 8 },
    { code: '120002', name: '备件二', spec: '12*12*6', unit: '千克', begin: 500, inbound: 200, outbound: 250, stock: 450, safe: 400, max: 1000, state: '正常', turns: '18 天', usedCount: 6 },
    { code: '120003', name: '备件三', spec: '12*12*6', unit: '米', begin: 500, inbound: 150, outbound: 150, stock: 500, safe: 400, max: 1000, state: '正常', turns: '22 天', usedCount: 5 },
    { code: '120004', name: '备件四', spec: '12*12*6', unit: '个', begin: 400, inbound: 100, outbound: 140, stock: 360, safe: 400, max: 1000, state: '低于安全库存', turns: '12 天', usedCount: 9 },
    { code: '120005', name: '备件五', spec: '12*12*6', unit: '个', begin: 400, inbound: 120, outbound: 160, stock: 360, safe: 400, max: 1000, state: '低于安全库存', turns: '10 天', usedCount: 11 },
  ],
};
