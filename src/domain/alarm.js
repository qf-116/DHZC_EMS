// ============================================================
// 报警领域层（纯 JS：状态机、去重键、关闭前置检查）
// 2026-11-04 简化：三态状态机 已触发 → 处理中 → 已关闭
// —— 确认 = 接管，直接进入处理中；处置在处理中登记/更新，满足关闭口径即关闭
// ============================================================

// 报警状态机：已触发 →（确认）→ 处理中 →（处置关闭 / 恢复联动）→ 已关闭
export const ALARM_TRANSITIONS = {
  '已触发': ['处理中'],
  '处理中': ['已关闭'],
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

// 恢复口径（2026-11-04：「人工确认关闭」改为「人工处置关闭」——处置提交即关闭）
export const RECOVERY_MODES = ['自动恢复', '业务闭环', '人工处置关闭'];

// 处置关闭前置检查（处置提交拟关闭时调用；返回 blocker 列表，空数组才允许关闭）
// —— 关联维修工单须已完成验收、关联停机事实须已结束；状态由调用方保证（仅处理中可关闭）
export function closeBlockers(alarm, ctx = {}) {
  const blockers = [];
  if (!alarm) return ['报警事件不存在'];
  if (alarm.relatedRepairOrderId && ctx.repairStatus && !['已完成', '已取消'].includes(ctx.repairStatus)) {
    blockers.push(`关联维修工单 ${alarm.relatedRepairOrderId} 尚未完成验收`);
  }
  if (alarm.relatedDowntimeId && ctx.downtimeStatus === '进行中') blockers.push('关联停机事实尚未结束');
  return blockers;
}

// 确认/处置所需的表单约束（确认必填说明；处置必填措施 + 预计完成时间，恢复说明选填）
export const ALARM_FORM_RULES = {
  ack: { required: ['note'], notePlaceholder: '确认说明（必填）' },
  handle: { required: ['measure', 'expectedAt'], measurePlaceholder: '处置措施（必填）' },
};

// 报警时间线事件类型
export const TIMELINE_TYPES = ['触发', '重复触发', '通知', '确认', '处置', '更新处置', '转维修', '恢复', '关闭', '重开关联'];
