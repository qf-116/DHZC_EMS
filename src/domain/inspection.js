// ============================================================
// 点检域共用规则（原型口径，供点检各页面复用）
// 来源：原型「添加_编辑点检计划.html」「点检任务.html」「执行点检.html」
//   - 执行周期：日/周/月/季度/半年/年/自定义
//   - 跳过星期六、跳过星期天（结构化存储 skipSat / skipSun，列表再拼成说明文案）
//   - 任务完成判定：所有设备 项目数=已检项目数；
//     或 除已跳过（跳过原因非空）的设备外，其余设备 项目数=已检项目数
// ============================================================

export const INSPECTION_CYCLE_OPTIONS = ['日', '周', '月', '季度', '半年', '年', '自定义'];

// 跳过规则：结构化为两个布尔位；'星期六' → 星期六，'星期天'/'星期日' → 星期天
export function parseSkipText(text) {
  const t = String(text || '');
  return {
    skipSat: t.includes('星期六'),
    skipSun: t.includes('星期天') || t.includes('星期日'),
  };
}

// 结构化跳过规则 → 说明文案
export function skipText(skip) {
  const parts = [];
  if (skip?.skipSat) parts.push('跳过星期六');
  if (skip?.skipSun) parts.push('跳过星期天');
  return parts.join('、');
}

// 兼容历史快照：结构化字段优先，缺失时回落到自由文本 skip
export function skipFlagsOf(r) {
  if (r?.skipSat != null || r?.skipSun != null) {
    return { sat: !!r.skipSat, sun: !!r.skipSun };
  }
  return parseSkipText(r?.skip);
}

// 负责人：结构化数组 owners[]；兼容历史快照的 owner 字符串（以「、」分隔）
export function ownersOf(r) {
  if (Array.isArray(r?.owners)) return r.owners;
  const s = r?.owner || '';
  return s ? String(s).split(/[、,，]/).map(x => x.trim()).filter(Boolean) : [];
}

// 列表「执行周期」列：周期 + 跳过规则拼装说明
export function cycleText(r) {
  if (!r || !r.cycle) return '--';
  const base = r.cycle === '自定义' && r.interval ? `自定义 · 每 ${r.interval} 天` : r.cycle;
  const { sat, sun } = skipFlagsOf(r);
  const skips = [sat && '跳过星期六', sun && '跳过星期天'].filter(Boolean);
  return skips.length ? `${base} · ${skips.join('、')}` : base;
}

// 数值型项目的正常值范围：从 normalValue 里解析「下限 ~ 上限」
// 返回 null 表示没有可比对的区间（调用方需自行处理展示口径）
export function parseNormalRange(normalValue) {
  const m = String(normalValue || '').match(/(-?\d+(?:\.\d+)?)\s*[~～\-—]\s*(-?\d+(?:\.\d+)?)/);
  if (!m) return null;
  const min = Number(m[1]);
  const max = Number(m[2]);
  if (Number.isNaN(min) || Number.isNaN(max)) return null;
  return min <= max ? { min, max } : { min: max, max: min };
}

// 单边正常值（如「≤ 0.005mm」「≥ 5 MPa」）：解析出界值与方向
export function parseNormalBound(normalValue) {
  const m = String(normalValue || '').match(/([≤≥<>])\s*(-?\d+(?:\.\d+)?)/);
  if (!m) return null;
  const v = Number(m[2]);
  if (Number.isNaN(v)) return null;
  return { op: m[1], value: v };
}

// 任务完成判定（原型：点检任务.html 状态流转原文）
// details：设备明细行，字段 { itemTotal, checked, skipReason }
export function taskCompletion(details) {
  const rows = Array.isArray(details) ? details : [];
  if (rows.length === 0) {
    return { canComplete: false, reason: '该任务暂无设备明细，无法判定完成条件' };
  }
  const countOf = r => r.itemTotal ?? r.itemCount;
  const unconfigured = rows.filter(r => !r.skipReason && (countOf(r) == null || (countOf(r) === 0 && !r.standard)));
  if (unconfigured.length > 0) {
    const names = unconfigured.map(r => r.name || r.code || '--').join('、');
    return { canComplete: false, reason: `以下设备未配置点检项目：${names}` };
  }
  const allDone = rows.every(r => (r.checked ?? 0) === (countOf(r) ?? 0));
  if (allDone) return { canComplete: true, reason: '所有设备的点检项目数均等于已检项目数' };
  const notSkipped = rows.filter(r => !r.skipReason);
  const exceptDone = notSkipped.every(r => (r.checked ?? 0) === (countOf(r) ?? 0));
  if (exceptDone) {
    return { canComplete: true, reason: '除已跳过的设备外，其余设备的点检项目数均等于已检项目数' };
  }
  const blocking = notSkipped.filter(r => (r.checked ?? 0) !== (countOf(r) ?? 0));
  const names = blocking.map(r => r.name || r.code || '--').join('、');
  return { canComplete: false, reason: `以下设备尚未完成点检：${names}` };
}
