// ============================================================
// 报警领域层（纯 JS：状态机、去重键、关闭前置检查；§6.4）
// ============================================================

// 报警状态机：候选 → 已触发 → 已确认 → 处理中 → 已恢复待关闭 → 已关闭
export const ALARM_TRANSITIONS = {
  '已触发': ['已确认'],
  '已确认': ['处理中', '已恢复待关闭'],
  '处理中': ['已恢复待关闭'],
  '已恢复待关闭': ['已关闭'],
  '已关闭': [], // 已关闭不能直接重开；重新触发生成新事件并关联历史
};

export function canAlarmTransition(from, to) {
  return (ALARM_TRANSITIONS[from] || []).includes(to);
}

export const ALARM_SEVERITY = ['紧急', '重要', '一般', '提示'];

// 去重键：同一 deviceId + ruleVersion + bindingVersion 且存在活动事件时不重复建事件（合并计数）
export function alarmDedupeKey(deviceId, ruleCode, ruleVersion, bindingVersion) {
  return `${deviceId}:${ruleCode}:${ruleVersion}:${bindingVersion}`;
}

// 恢复口径
export const RECOVERY_MODES = ['自动恢复', '业务闭环', '人工确认关闭'];

// 关闭依据检查：温度/压力类可恢复待关闭后关闭；程序不一致与维修关联故障需业务处理；
// 自动恢复类恢复后自动关闭；业务闭环类随业务动作（如验收通过）关闭。
// 关闭前校验设备恢复、维修验收与关联停机（返回 blocker 列表，空数组才允许关闭）
export function closeBlockers(alarm, ctx = {}) {
  const blockers = [];
  if (!alarm) return ['报警事件不存在'];
  if (alarm.status !== '已恢复待关闭') blockers.push('报警尚未进入「已恢复待关闭」状态');
  if (alarm.recovery === '人工确认关闭' && !(ctx.closeReason || '').trim()) blockers.push('人工关闭必须填写关闭原因（责任认定留痕）');
  if (alarm.recovery === '自动恢复' && alarm.recoveredEvidence === false) blockers.push('指标尚未恢复，不能关闭');
  if (alarm.relatedRepairOrderId && ctx.repairStatus && !['已完成', '已取消'].includes(ctx.repairStatus)) {
    blockers.push(`关联维修工单 ${alarm.relatedRepairOrderId} 尚未完成验收`);
  }
  if (alarm.relatedDowntimeId && ctx.downtimeStatus === '进行中') blockers.push('关联停机事实尚未结束');
  return blockers;
}

// 确认/处置/关闭所需的表单约束（§6.4：确认必填说明、处置必填措施+预计完成时间、关闭必填证据+原因）
export const ALARM_FORM_RULES = {
  ack: { required: ['note'], notePlaceholder: '确认说明（必填）' },
  handle: { required: ['measure', 'expectedAt'], measurePlaceholder: '处置措施（必填）' },
  close: { required: ['evidence', 'closeReason'], evidencePlaceholder: '恢复证据（必填）' },
};

// 报警时间线事件类型
export const TIMELINE_TYPES = ['触发', '重复触发', '通知', '确认', '处置', '更新处置', '转维修', '恢复', '关闭', '重开关联'];
