// ============================================================
// 维修领域层（纯 JS：报修/主工单统一状态机、幂等约束；§6.5）
// ============================================================

// 维修状态机：
// 报修草稿 → 已提交/待派工 → 已派工 → 维修中 → 待验收 → 已完成
//                          ↘ 挂起 → 恢复      ↘ 返修 → 维修中
//                          ↘ 已取消
export const REPAIR_TRANSITIONS = {
  '草稿': ['已提交'],
  '待派工': ['已派工', '已取消'],
  '已派工': ['维修中', '已取消'],
  '维修中': ['挂起', '待验收'],
  '挂起': ['维修中', '已取消'],
  '待验收': ['已完成', '维修中'], // 验收通过 → 已完成；退回返修 → 维修中
  '已完成': [],
  '已取消': [],
};

// 说明（2026-11-09 维修模块对齐原型）：
// 状态机保留「挂起 → 已取消」这条边，但原型《维修任务》规则第 6 条的「取消任务」入口
// 只对「待派工 / 已派工」开放（repair/cancel 动作按该白名单校验），挂起工单如需终止请先恢复后取消。

export function canRepairTransition(from, to) {
  return (REPAIR_TRANSITIONS[from] || []).includes(to);
}

export const REPAIR_LEVELS = ['紧急', '严重', '一般'];
export const FAULT_TYPES = ['机械', '电气', '液压', '气动', '控制系统', '过热', '磨损', '其他'];

// 处理方式（原型「查看.html」「去维修.html」原文：单选，更换备件/现场处理/厂家维修/暂时停用）
// 规则：处理方式选择「更换备件」时，才出现更换备件的操作表格。
export const HANDLING_METHODS = ['更换备件', '现场处理', '厂家维修', '暂时停用'];
export const HANDLING_METHOD_REPLACE = '更换备件';

// 维修类型 / 维修部位（原型为下拉，数据来源未在原型给出，取演示常用值）
export const REPAIR_TYPES = ['故障维修', '预测性维修', '预防性维修', '日常维修', '改造维修'];
export const REPAIR_PARTS = ['整机', '机械系统', '液压系统', '电气系统', '控制系统', '传动系统', '密封件', '润滑系统'];

// 报修单展示状态（原型「故障报修」规则原文：未处理 / 进行中 / 已完成 / 已取消）
export const REPORT_STATUSES = ['未处理', '进行中', '已完成', '已取消'];

// 报修单状态派生（不改工单状态机，展示层口径）：
// 无关联工单 → 未处理；工单待派工 → 未处理（尚未派工处理）；
// 工单已派工/维修中/挂起/待验收 → 进行中；工单已完成 → 已完成；工单已取消 → 已取消；
// 报修单自身被取消（reportStatus='已取消'）→ 已取消。
export function deriveReportStatus(orderStatus, reportStatus) {
  if (reportStatus === '已取消') return '已取消';
  if (!orderStatus) return '未处理';
  if (orderStatus === '已完成') return '已完成';
  if (orderStatus === '已取消') return '已取消';
  if (orderStatus === '待派工') return '未处理';
  return '进行中';
}

// 维修总时长（小时）：由「维修开始时间 / 维修结束时间」派生（原型无独立工时输入项）
export function repairDurationHours(startTime, endTime) {
  const parse = (s) => {
    if (!s || typeof s !== 'string') return null;
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/);
    if (!m) return null;
    return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]), Number(m[6] || 0)).getTime();
  };
  const s = parse(startTime);
  const e = parse(endTime);
  if (s === null || e === null) return null;
  const diff = (e - s) / 3600000;
  if (diff < 0) return null;
  return Math.round(diff * 100) / 100;
}

// 一条活动故障默认只允许一张活动主工单：报警转维修幂等（repair-from-alarm:alarmId）
export function hasActiveRepairForAlarm(orders, alarmId) {
  return (orders || []).some(o => o.alarmId === alarmId && !['已完成', '已取消'].includes(o.status));
}

// 验收通过才允许恢复设备 / 结算；提交维修结果只进入待验收
export function acceptanceResultRepairStatus(result) {
  return result === '通过' ? '已完成' : '维修中'; // 返修保留原履历
}

// SLA 等级对应的响应时限（演示口径，小时）
export const SLA_HOURS = { '紧急': 2, '严重': 8, '一般': 24 };

// 维修时间线事件类型
export const REPAIR_TIMELINE_TYPES = ['创建', '派工', '接单', '开工', '挂起', '恢复', '维修录入', '领料', '退库', '提交', '验收通过', '退回返修', '取消'];
