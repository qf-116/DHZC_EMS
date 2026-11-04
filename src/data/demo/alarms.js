// ============================================================
// 报警（AlarmRule / AlarmRuleVersion / AlarmEvent / NotificationDelivery）初始快照；§3.2
// 状态机与关闭口径见 domain/alarm.js；去重键 = deviceId:rule:ruleVersion:bindingVersion
// 演示种子只含白名单业务域规则（点检/保养类规则不属于本次范围）。
// ============================================================

export const alarmRules = [
  { code: 'R-TEMP-001', name: '主轴温度持续超限', type: '阈值', deviceScope: '绑定主轴温度指标设备', metricCode: 'M.spindle_temp', condition: '> 80℃ 持续 60s', recovery: '自动恢复', recoverCondition: '< 75℃（回差 5℃）持续 30s', suppress: '活动事件抑制 · 重复提醒 5min', storm: '≤ 3 条/小时', severity: '重要', policyCode: 'NP-IMPORTANT', status: '已发布', version: 'V3', trig7d: 18, supp7d: 35 },
  { code: 'R-TEMP-002', name: '冷却液温度持续超限', type: '阈值', deviceScope: '绑定冷却液温度指标设备', metricCode: 'M.coolant_temp', condition: '> 42℃ 持续 60s', recovery: '自动恢复', recoverCondition: '< 39℃（回差 3℃）持续 60s', suppress: '活动事件抑制 · 重复提醒 5min', storm: '≤ 3 条/小时', severity: '重要', policyCode: 'NP-IMPORTANT', status: '已发布', version: 'V2', trig7d: 7, supp7d: 4 },
  { code: 'R-PRESS-001', name: '气压压力区间异常', type: '阈值', deviceScope: '绑定气源压力指标设备', metricCode: 'M.air_pressure', condition: '区间外 0.6 ~ 0.8 MPa 持续 30s', recovery: '自动恢复', recoverCondition: '回到 0.65 ~ 0.75 MPa（回差 0.05）持续 30s', suppress: '活动事件抑制 · 重复提醒 5min', storm: '≤ 3 条/小时', severity: '一般', policyCode: 'NP-GENERAL', status: '已发布', version: 'V1', trig7d: 7, supp7d: 4 },
  { code: 'R-STATE-001', name: '设备故障立即报警', type: '状态', deviceScope: '全部已启用绑定设备', metricCode: 'S.machine_state', condition: '状态 = 故障 立即触发', recovery: '自动恢复', recoverCondition: '状态恢复正常自动恢复', suppress: '活动事件抑制 · 重复提醒 10min', storm: '≤ 5 条/小时', severity: '紧急', policyCode: 'NP-URGENT', status: '已发布', version: 'V5', trig7d: 12, supp7d: 3 },
  { code: 'R-COMPARE-001', name: 'MES程序参数不一致', type: '程序', deviceScope: '有程序下发设备', metricCode: '程序比对', condition: '实际参数 ≠ 基线且超容差', recovery: '人工处置关闭', recoverCondition: '人工确认关闭或基线更新', suppress: '活动事件抑制 · 不重复提醒', storm: '≤ 2 条/小时', severity: '重要', policyCode: 'NP-IMPORTANT', status: '已发布', version: 'V2', trig7d: 9, supp7d: 2 },
  { code: 'R-QUALITY-001', name: '采集数据延迟', type: '质量', deviceScope: '全部已启用绑定设备', metricCode: '最后采集时间', condition: '延迟 > 30s 持续 60s', recovery: '自动恢复', recoverCondition: '延迟 < 10s 持续 60s（回差 20s）', suppress: '活动事件抑制 · 重复提醒 15min', storm: '≤ 3 条/小时', severity: '一般', policyCode: 'NP-GENERAL', status: '已发布', version: 'V4', trig7d: 27, supp7d: 41 },
  { code: 'R-SPARE-001', name: '备件库存低于安全库存', type: '备件', deviceScope: '全部备件', metricCode: '库存数量', condition: '当前库存 < 安全库存', recovery: '业务闭环', recoverCondition: '补货入库至安全库存后关闭', suppress: '活动事件抑制 · 每日提醒 1 次', storm: '≤ 1 条/小时', severity: '提示', policyCode: 'NP-GENERAL', status: '已发布', version: 'V1', trig7d: 5, supp7d: 2 },
];

export const alarmRuleVersions = [
  { code: 'R-TEMP-001', name: '主轴温度持续超限', version: 'V3', publish: '2026-09-02 16:50:42', publisher: '王强', effective: '2026-09-02 16:50:42 至今', condition: '主轴温度 > 80℃，持续 60s；恢复 < 75℃，持续 30s', notify: '站内+企业微信；5min 升级', events: 18, status: '已发布' },
  { code: 'R-TEMP-001', name: '主轴温度持续超限', version: 'V2', publish: '2026-08-18 10:12:00', publisher: '李明', effective: '2026-08-18 10:12:00 至 2026-09-02 16:50:41', condition: '主轴温度 > 82℃，持续 90s；恢复 < 74℃，持续 60s', notify: '站内+企业微信', events: 35, status: '已归档' },
  { code: 'R-STATE-001', name: '设备故障立即报警', version: 'V5', publish: '2026-08-26 09:30:00', publisher: '王强', effective: '2026-08-26 09:30:00 至今', condition: '运行状态 = 故障', notify: '站内+短信；立即升级', events: 12, status: '已发布' },
  { code: 'R-COMPARE-001', name: 'MES程序参数不一致', version: 'V2', publish: '2026-08-30 14:20:00', publisher: '赵艳', effective: '2026-08-30 14:20:00 至今', condition: '实际参数 ≠ 基线且超容差', notify: '站内；10min 升级', events: 9, status: '已发布' },
  { code: 'R-QUALITY-001', name: '采集数据延迟', version: 'V4', publish: '2026-08-22 11:05:00', publisher: '李明', effective: '2026-08-22 11:05:00 至今', condition: '最后采集时间延迟 > 30s', notify: '站内', events: 27, status: '已发布' },
];

// 报警事件（AlarmEvent）
// 状态：已触发 / 处理中 / 已关闭（2026-11-04 三态状态机）
export const alarmEvents = [
  {
    id: 'ALM-20260916-001', deviceId: 'DEV-004', deviceName: '数控铲齿机-04', name: '主轴温度高高报警',
    rule: 'R-TEMP-001', ruleVersion: 'V3', bindingVersion: 2, severity: '紧急', status: '已触发',
    metric: '主轴温度', metricCode: 'M.spindle_temp', trigger: '91.8 ℃', threshold: '> 88 ℃ 持续 60s',
    time: '16:22:35', duration: '18m 33s', repeat: 2, ack: '-', escalation: '0', notify: '成功', policy: 'NP-URGENT',
    recovery: '自动恢复', handler: '-', recovered: '', recoveredEvidence: null, merge: 0,
    dedupeKey: 'DEV-004:R-TEMP-001:V3:2', relatedRepairOrderId: null, relatedDowntimeId: 'DT-20260916-901',
    timeline: [
      { type: '触发', time: '16:22:35', actor: '系统', detail: '主轴温度 91.8℃ 超过阈值 88℃ 持续 60s' },
      { type: '重复触发', time: '16:31:10', actor: '系统', detail: '持续超限，重复抑制计数 +1' },
      { type: '通知', time: '16:22:36', actor: '系统', detail: 'NP-URGENT：站内 + 短信送达李明、王强' },
    ],
  },
  {
    id: 'ALM-20260916-002', deviceId: 'DEV-002', deviceName: 'CNC加工中心-02', name: '冷却液温度持续超限',
    rule: 'R-TEMP-002', ruleVersion: 'V2', bindingVersion: 2, severity: '重要', status: '处理中',
    metric: '冷却液温度', metricCode: 'M.coolant_temp', trigger: '44.6 ℃', threshold: '> 42 ℃ 持续 60s',
    time: '15:58:11', duration: '43m 0s', repeat: 1, ack: '16:02:40', escalation: '0', notify: '成功', policy: 'NP-IMPORTANT',
    recovery: '自动恢复', handler: '李明', recovered: '', recoveredEvidence: null, merge: 0,
    dedupeKey: 'DEV-002:R-TEMP-002:V2:2', relatedRepairOrderId: null, relatedDowntimeId: null,
    timeline: [
      { type: '触发', time: '15:58:11', actor: '系统', detail: '冷却液温度 44.6℃ 超过阈值 42℃ 持续 60s' },
      { type: '通知', time: '15:58:12', actor: '系统', detail: 'NP-IMPORTANT：站内 + 企业微信送达王强、陈晨' },
      { type: '确认', time: '16:02:40', actor: '李明', detail: '已通知现场检查冷却系统，怀疑管路结垢' },
    ],
  },
  {
    id: 'ALM-20260916-003', deviceId: 'DEV-002', deviceName: 'CNC加工中心-02', name: 'MES程序参数不一致',
    rule: 'R-COMPARE-001', ruleVersion: 'V2', bindingVersion: 2, severity: '重要', status: '处理中',
    metric: '程序比对', metricCode: '程序比对', trigger: '进给倍率 120%', threshold: '基准 105% · 容差 ±3%',
    time: '14:41:20', duration: '1h 59m', repeat: 1, ack: '14:48:02', escalation: '1', notify: '成功', policy: 'NP-IMPORTANT',
    recovery: '人工处置关闭', handler: '王强', recovered: '', recoveredEvidence: null, merge: 0,
    dedupeKey: 'DEV-002:R-COMPARE-001:V2:2', relatedRepairOrderId: 'RO-20260916-001', relatedDowntimeId: null,
    timeline: [
      { type: '触发', time: '14:41:20', actor: '系统', detail: '进给倍率 120% 超出基线 105% ±3%' },
      { type: '确认', time: '14:48:02', actor: '王强', detail: '现场核实为操作工误改参数' },
      { type: '转维修', time: '14:52:00', actor: '王强', detail: '生成维修工单 RO-20260916-001，停止加工程序参数恢复' },
      { type: '通知', time: '15:12:00', actor: '系统', detail: '10 分钟未处置，按 NP-IMPORTANT 升级 1 次' },
    ],
  },
  {
    id: 'ALM-20260916-004', deviceId: 'DEV-001', deviceName: 'CNC加工中心-01', name: '数据采集延迟',
    rule: 'R-QUALITY-001', ruleVersion: 'V4', bindingVersion: 2, severity: '一般', status: '已关闭',
    metric: '数据质量', metricCode: '最后采集时间', trigger: '延迟 32s', threshold: '> 30s 持续 60s',
    time: '13:02:10', duration: '1m 12s', repeat: 1, ack: '13:04:00', escalation: '0', notify: '成功', policy: 'NP-GENERAL',
    recovery: '自动恢复', handler: '-', recovered: '延迟 8s · 13:03:22', recoveredEvidence: true, merge: 3,
    dedupeKey: 'DEV-001:R-QUALITY-001:V4:2', relatedRepairOrderId: null, relatedDowntimeId: null,
    timeline: [
      { type: '触发', time: '13:02:10', actor: '系统', detail: '采集延迟 32s 超过 30s 持续 60s' },
      { type: '恢复', time: '13:03:22', actor: '系统', detail: '延迟回落至 8s，持续 60s 满足自动恢复条件' },
      { type: '关闭', time: '13:04:10', actor: '系统', detail: '自动恢复类规则恢复后自动关闭' },
    ],
  },
  {
    id: 'ALM-20260916-005', deviceId: 'DEV-003', deviceName: '激光焊接机-03', name: '设备状态切换频繁',
    rule: 'R-STATE-001', ruleVersion: 'V5', bindingVersion: 1, severity: '提示', status: '已关闭',
    metric: '运行状态', metricCode: 'S.machine_state', trigger: '切换 8 次/10min', threshold: '> 6 次',
    time: '11:20:44', duration: '10m 0s', repeat: 1, ack: '11:24:18', escalation: '0', notify: '成功', policy: 'NP-GENERAL',
    recovery: '自动恢复', handler: '-', recovered: '状态 稳定 · 11:30:44', recoveredEvidence: true, merge: 0,
    dedupeKey: 'DEV-003:R-STATE-001:V5:1', relatedRepairOrderId: null, relatedDowntimeId: null,
    timeline: [
      { type: '触发', time: '11:20:44', actor: '系统', detail: '10 分钟内状态切换 8 次' },
      { type: '关闭', time: '11:30:44', actor: '系统', detail: '状态稳定后自动恢复并关闭' },
    ],
  },
  {
    id: 'ALM-20260916-006', deviceId: 'DEV-006', deviceName: '空压机', name: '备件库存低于安全库存',
    rule: 'R-SPARE-001', ruleVersion: 'V1', bindingVersion: 2, severity: '提示', status: '处理中',
    metric: '备件库存', metricCode: '库存数量', trigger: '空压机滤芯 剩 28', threshold: '安全库存 40',
    time: '08:35:12', duration: '8h 06m', repeat: 2, ack: '08:50:40', escalation: '0', notify: '成功', policy: 'NP-GENERAL',
    recovery: '业务闭环', handler: '陈晨', recovered: '', recoveredEvidence: null, merge: 0,
    dedupeKey: 'DEV-006:R-SPARE-001:V1:2', relatedRepairOrderId: null, relatedDowntimeId: null,
    timeline: [
      { type: '触发', time: '08:35:12', actor: '系统', detail: '空压机滤芯库存 28 低于安全库存 40' },
      { type: '确认', time: '08:50:40', actor: '陈晨', detail: '已提交采购申请，等待到货入库' },
    ],
  },
];

// 通知发送/送达/失败/重试/升级演示记录（不实现真实消息服务）
export const notificationDeliveries = [
  { id: 'ND-001', alarmId: 'ALM-20260916-001', policy: 'NP-URGENT', channel: '短信', receiver: '王强', status: '送达', sentAt: '16:22:37', latency: '2s', retries: 0 },
  { id: 'ND-002', alarmId: 'ALM-20260916-001', policy: 'NP-URGENT', channel: '站内', receiver: '李明', status: '送达', sentAt: '16:22:36', latency: '1s', retries: 0 },
  { id: 'ND-003', alarmId: 'ALM-20260916-002', policy: 'NP-IMPORTANT', channel: '企业微信', receiver: '陈晨', status: '送达', sentAt: '15:58:13', latency: '2s', retries: 0 },
  { id: 'ND-004', alarmId: 'ALM-20260916-003', policy: 'NP-IMPORTANT', channel: '企业微信', receiver: '王强', status: '送达', sentAt: '14:41:22', latency: '2s', retries: 0 },
  { id: 'ND-005', alarmId: 'ALM-20260916-003', policy: 'NP-IMPORTANT', channel: '站内', receiver: '设备管理员组', status: '升级', sentAt: '15:12:00', latency: '--', retries: 0, note: '10 分钟未处置自动升级' },
  { id: 'ND-006', alarmId: 'ALM-20260916-004', policy: 'NP-GENERAL', channel: '站内', receiver: '李明', status: '失败', sentAt: '13:02:15', latency: '--', retries: 3, note: '站内信服务超时，重试 3 次后成功' },
  { id: 'ND-007', alarmId: 'ALM-20260916-006', policy: 'NP-GENERAL', channel: '站内', receiver: '李明', status: '送达', sentAt: '08:35:14', latency: '2s', retries: 0 },
];

export const notificationPolicies = [
  { code: 'NP-URGENT', name: '紧急报警立即通知', level: '紧急', channels: '站内 / 短信 / 企业微信', groups: '设备管理员、当班班组长', receivers: '李明、王强、赵艳', first: '立即', interval: '5 分钟', escalation: '10 分钟 / 30 分钟', silent: '无', retries: 3, status: '启用' },
  { code: 'NP-IMPORTANT', name: '重要报警值班通知', level: '重要', channels: '站内 / 企业微信', groups: '当班班组长、维修人员', receivers: '王强、陈晨', first: '立即', interval: '10 分钟', escalation: '30 分钟', silent: '00:00-07:00', retries: 2, status: '启用' },
  { code: 'NP-GENERAL', name: '一般报警日间通知', level: '一般', channels: '站内', groups: '设备管理员', receivers: '李明', first: '1 分钟', interval: '不重复', escalation: '无', silent: '18:30-08:00', retries: 1, status: '启用' },
];
