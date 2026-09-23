// ============================================================
// 报警规则模板（P2 模板持久化）：结构化模板实体种子
// 模板 = 除设备绑定外的全部规则要素（触发 / 恢复 / 通知 / 治理参数），
// 存入 DemoStore entities.ruleTemplatesById，增删改经 reducer 留痕；
// 应用模板只生成规则草稿，模板更新不回写已发布规则。
// applicableMetricCodes 限定模板可套用的 canonical 指标（不兼容指标不允许套用）。
// ============================================================

const hysteresis = (direction, deadband, unit) => ({
  mode: 'auto',
  closeMode: 'auto',
  condition: {
    type: 'hysteresis',
    direction,
    thresholdMode: 'deadband',
    triggerValue: null,
    recoveryValue: null,
    deadband,
    unit,
  },
  stabilize: { durationSec: 30, qualityRequired: 'GOOD', invalidDataPolicy: 'hold', rebreachPolicy: 'resetTimer' },
  notifyOnRecover: true,
});

const notificationOf = (code) => {
  const presets = {
    'NP-URGENT': { channels: ['站内', '短信', '企业微信'], receivers: ['李明', '王强', '赵艳'], first: '立即', interval: '5 分钟', escalation: '10 分钟 / 30 分钟', silent: '', retries: 3 },
    'NP-IMPORTANT': { channels: ['站内', '企业微信'], receivers: ['王强', '陈晨'], first: '立即', interval: '10 分钟', escalation: '30 分钟', silent: '00:00-07:00', retries: 2 },
    'NP-GENERAL': { channels: ['站内'], receivers: ['李明'], first: '1 分钟', interval: '不重复', escalation: '无', silent: '18:30-08:00', retries: 1 },
  };
  const p = presets[code] || presets['NP-IMPORTANT'];
  return { policyCode: code, overridden: false, ...p };
};

export const ruleTemplateSeeds = [
  {
    templateId: 'RT-TEMP-001',
    name: '温度类越上限通用模板',
    metricType: '温度类指标（主轴/冷却液/轴承温度）',
    applicableMetricCodes: ['M.spindle_temp', 'M.coolant_temp', 'M.bearing_temp'],
    status: '启用',
    remark: '温度热惯性大，持续 60s 过滤加工载荷波动；回差取量程 4%',
    refs: 6,
    triggerConfig: { type: 'threshold', mode: 'upper', operator: '>', threshold: 80, unit: '℃', durationSec: 60 },
    recoveryConfig: hysteresis('upper', 5, '℃'),
    notificationConfig: notificationOf('NP-IMPORTANT'),
    suppressionConfig: { mergeActiveEvent: true, countRepeatedTrigger: true, remindEnabled: true, remindIntervalMin: 5, maxRemindCount: null, createNewAfterClose: true },
    stormConfig: { enabled: true, windowMin: 60, maxEvents: 3, scope: 'sameRule', overflowAction: 'merge' },
    silenceConfig: { source: 'template', enabled: false, windows: [] },
  },
  {
    templateId: 'RT-PRESS-001',
    name: '压力类区间外通用模板',
    metricType: '压力类指标（气压/油压/液压）',
    applicableMetricCodes: ['M.air_pressure', 'M.oil_pressure'],
    status: '启用',
    remark: '压力类存在正常工作区间，双向共用一条规则；上下独立回差 0.05 消除边界震荡',
    refs: 4,
    triggerConfig: { type: 'threshold', mode: 'rangeOut', low: 0.6, high: 0.8, unit: 'MPa', durationSec: 30 },
    recoveryConfig: {
      mode: 'auto', closeMode: 'auto',
      condition: { type: 'range', lowDeadband: 0.05, highDeadband: 0.05, recoveryLow: 0.65, recoveryHigh: 0.75, unit: 'MPa' },
      stabilize: { durationSec: 30, qualityRequired: 'GOOD', invalidDataPolicy: 'hold', rebreachPolicy: 'resetTimer' },
      notifyOnRecover: true,
    },
    notificationConfig: notificationOf('NP-GENERAL'),
    suppressionConfig: { mergeActiveEvent: true, countRepeatedTrigger: true, remindEnabled: true, remindIntervalMin: 5, maxRemindCount: null, createNewAfterClose: true },
    stormConfig: { enabled: true, windowMin: 60, maxEvents: 3, scope: 'sameRule', overflowAction: 'merge' },
    silenceConfig: { source: 'template', enabled: false, windows: [] },
  },
  {
    templateId: 'RT-VIB-001',
    name: '振动类短持续越上限模板',
    metricType: '振动类指标（振动幅值/加速度）',
    applicableMetricCodes: ['M.vib_amplitude'],
    status: '启用',
    remark: '振动响应快，持续时间宜短；建议配合速率规则检测突发异常',
    refs: 2,
    triggerConfig: { type: 'threshold', mode: 'upper', operator: '>', threshold: 4.5, unit: 'mm/s', durationSec: 10 },
    recoveryConfig: hysteresis('upper', 0.5, 'mm/s'),
    notificationConfig: notificationOf('NP-IMPORTANT'),
    suppressionConfig: { mergeActiveEvent: true, countRepeatedTrigger: true, remindEnabled: true, remindIntervalMin: 10, maxRemindCount: null, createNewAfterClose: true },
    stormConfig: { enabled: true, windowMin: 60, maxEvents: 2, scope: 'sameRule', overflowAction: 'merge' },
    silenceConfig: { source: 'template', enabled: false, windows: [] },
  },
  {
    templateId: 'RT-STATE-001',
    name: '设备故障枚举判定模板',
    metricType: '状态类指标（设备状态/报警码）',
    applicableMetricCodes: ['S.machine_state', 'S.alarm_code'],
    status: '启用',
    remark: 'FAULT / ESTOP 立即触发，状态恢复即恢复；配合人工确认关闭用于责任认定',
    refs: 5,
    triggerConfig: { type: 'state', abnormalValues: ['故障', '无数据'], normalValues: ['运行', '待机'], durationSec: 0, unit: null },
    recoveryConfig: {
      mode: 'auto', closeMode: 'auto',
      condition: { type: 'state', normalValues: ['运行', '待机'] },
      stabilize: { durationSec: 0, qualityRequired: 'GOOD', invalidDataPolicy: 'hold', rebreachPolicy: 'resetTimer' },
      notifyOnRecover: true,
    },
    notificationConfig: notificationOf('NP-URGENT'),
    suppressionConfig: { mergeActiveEvent: true, countRepeatedTrigger: true, remindEnabled: true, remindIntervalMin: 10, maxRemindCount: null, createNewAfterClose: true },
    stormConfig: { enabled: true, windowMin: 60, maxEvents: 5, scope: 'sameDevice', overflowAction: 'merge' },
    silenceConfig: { source: 'template', enabled: false, windows: [] },
  },
  {
    templateId: 'RT-CURR-001',
    name: '电流类过载保护模板',
    metricType: '电流类指标（主电机电流）',
    applicableMetricCodes: ['M.motor_current', 'M.weld_current'],
    status: '停用',
    remark: '电流突升常伴随堵转/过载；已由厂家标准参数替代，保留历史引用',
    refs: 0,
    triggerConfig: { type: 'threshold', mode: 'upper', operator: '>', threshold: 18, unit: 'A', durationSec: 30 },
    recoveryConfig: hysteresis('upper', 1, 'A'),
    notificationConfig: notificationOf('NP-URGENT'),
    suppressionConfig: { mergeActiveEvent: true, countRepeatedTrigger: true, remindEnabled: true, remindIntervalMin: 5, maxRemindCount: null, createNewAfterClose: true },
    stormConfig: { enabled: true, windowMin: 60, maxEvents: 2, scope: 'sameRule', overflowAction: 'merge' },
    silenceConfig: { source: 'template', enabled: false, windows: [] },
  },
];
