// ============================================================
// OEE 领域层（纯 JS：公式、不可计算口径、损失下钻；§6.8 / §11）
// ============================================================

export const round1 = (v) => Math.round(v * 10) / 10;

export function pct(num, den) {
  // 分母无效或 ≤ 0 → null（不可计算），严格区分 0%（硬规则 6）
  if (num == null || den == null || den <= 0) return null;
  return round1((num / den) * 100);
}

// OEE 公式：
//   可用率 = 运行时间 / (负荷时间 − 计划停机时间)
//   性能率 = 实际速度 / 理想速度（或已确认的产出/运行时间口径）
//   合格率 = 良品 / 总产量
//   OEE = 可用率 × 性能率 × 合格率
export function computeOee({ loadMinutes, plannedDowntimeMinutes, runMinutes, idealSpeed, actualSpeed, output, qualified }) {
  const denomAvail = (loadMinutes ?? 0) - (plannedDowntimeMinutes ?? 0);
  const availability = (loadMinutes != null && runMinutes != null && denomAvail > 0)
    ? pct(runMinutes, denomAvail) : null;
  const performance = pct(actualSpeed, idealSpeed);
  const quality = (output != null && output > 0) ? pct(qualified, output) : null;
  const oee = (availability != null && performance != null && quality != null)
    ? round1((availability * performance * quality) / 10000) : null;
  return { availability, performance, quality, oee };
}

// 不可计算原因判定（按顺序给出首要原因；无生产数据的设备整行给出原因，不伪造 0）
export function oeeBlockers(input = {}, config = {}) {
  const blockers = [];
  if (!config.hasBinding) blockers.push('设备未启用有效 IoT 绑定');
  if (!config.hasShiftCalendar) blockers.push('未配置班次日历');
  if (input.loadMinutes == null) blockers.push('缺少负荷时间数据');
  if (config.idealSpeed == null) blockers.push('该物料未配置理想生产速度/标准节拍');
  if (input.runMinutes == null) blockers.push('缺少运行时间数据');
  if (input.runMinutes === 0 && !input.output) blockers.push('窗口内无生产数据（运行时间为 0 且无产出）');
  if (input.reportCount === 0) {
    blockers.push('窗口内无报工记录');
  } else if (input.reportCount != null) {
    if (input.output == null) blockers.push('缺少产量数据');
    if (input.qualified == null) blockers.push('缺少质量（良品）数据');
  }
  return blockers;
}

// 多物料汇总：按运行时间加权（不做无说明的等权平均）
export function weightedSpeed(materials = []) {
  const withRun = materials.filter(m => m.runMinutes > 0);
  if (!withRun.length) return null;
  const totalRun = withRun.reduce((s, m) => s + m.runMinutes, 0);
  return round1(withRun.reduce((s, m) => s + m.actualSpeed * m.runMinutes, 0) / totalRun);
}

// 损失下钻：OEE → 三率 → 停机/报警/维修/质量明细
export function oeeLossBreakdown(result, facts = []) {
  const losses = [];
  if (result == null) return losses;
  if (result.availability != null) {
    const downtimeLoss = facts.filter(f => f.category !== '计划停机');
    losses.push({
      rate: '可用率', lossMinutes: downtimeLoss.reduce((s, f) => s + (f.minutes || 0), 0),
      sources: downtimeLoss.map(f => ({ type: '停机', id: f.downtimeId, category: f.category })),
    });
  }
  if (result.performance != null && result.idealSpeed != null && result.actualSpeed != null) {
    losses.push({
      rate: '性能率', lossPct: round1(Math.max(0, 100 - result.performance)),
      sources: [{ type: '速度', id: 'ideal-speed', category: '实际速度低于理想速度' }],
    });
  }
  if (result.quality != null) {
    losses.push({
      rate: '合格率', lossPct: round1(Math.max(0, 100 - result.quality)),
      sources: [{ type: '质量', id: 'quality-detail', category: '不良品明细' }],
    });
  }
  return losses;
}

// MTTR：故障开始至设备恢复/验收的维修事实均值；MTBF：故障事件间有效运行时间。
// 均从事实推导，不从页面数值二次平均。
export function computeMttrMtbf(repairFacts = [], faultEvents = [], runMinutesTotal = 0) {
  const done = repairFacts.filter(f => f.restoreMinutes != null);
  const mttr = done.length ? round1(done.reduce((s, f) => s + f.restoreMinutes, 0) / done.length) : null;
  const mtbf = faultEvents.length > 0 && runMinutesTotal > 0
    ? round1(runMinutesTotal / faultEvents.length) : null;
  return { mttr, mtbf };
}


// ---------- 报工事件窗口汇总（2026-11-05）----------
// 报工事件 = { reportTime: 'YYYY-MM-DD HH:mm:ss', quantity, qualified, metricCode }
// 产量 = 窗口内 quantity 之和；合格数 = 窗口内 qualified=true 的 quantity 之和。
// 按报工时间（reportTime）归窗，receivedAt 只用于延迟/补偿判断，不参与归属。
export function productionReportWindowStats(reports = [], { day = null, fromTime = null, toTime = null, metricCode = null } = {}) {
  const rows = (reports || []).filter((r) => {
    if (metricCode && r.metricCode !== metricCode) return false;
    const ts = String(r.reportTime || '');
    if (day && ts.slice(0, 10) !== day) return false;
    const hm = ts.slice(11, 16);
    if (fromTime && hm < fromTime) return false;
    if (toTime && hm > toTime) return false;
    return true;
  });
  if (!rows.length) {
    return { count: 0, output: null, qualified: null, firstReportTime: null, lastReportTime: null };
  }
  const output = rows.reduce((s, r) => s + (Number(r.quantity) || 0), 0);
  const qualified = rows.reduce((s, r) => s + (r.qualified ? (Number(r.quantity) || 0) : 0), 0);
  const times = rows.map(r => r.reportTime).sort();
  return {
    count: rows.length,
    output,
    qualified,
    firstReportTime: times[0],
    lastReportTime: times[times.length - 1],
  };
}
