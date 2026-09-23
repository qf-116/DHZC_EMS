// ============================================================
// 持久化（§4.2）：可序列化业务快照写入 localStorage 键 dms-demo:state
// 解析失败 / 存储不可用 → 回初始快照并给出明确演示提示
// 版本升级（M0 迁移契约）：旧版本快照先尝试结构迁移（normalizeLegacyRule + 补齐新实体容器），
// 迁移成功保留用户数据并提示；迁移失败才回初始快照，不静默整包丢弃。
// ============================================================

import { createDemoState, STORE_VERSION } from '../data/demo/index.js';
import { normalizeLegacyRule } from '../domain/alarmRule.js';

const STORAGE_KEY = 'dms-demo:state';

// 旧快照 → 当前版本结构：补齐新增实体容器、归一化旧规则（业务类标记只读、阈值类补结构化字段）
function migrateParsed(parsed) {
  const base = createDemoState();
  const next = {
    ...parsed,
    version: STORE_VERSION,
    entities: {
      ...base.entities,
      ...parsed.entities,
      alarmBatchesById: parsed.entities?.alarmBatchesById || {},
    },
  };
  next.entities.alarmRulesById = Object.fromEntries(
    Object.entries(parsed.entities?.alarmRulesById || {}).map(([code, rule]) => [code, normalizeLegacyRule(rule)])
  );
  return next;
}

export function loadDemoState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { state: null, notice: null };
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || !parsed.entities) {
      return { state: null, notice: '本地快照结构无效，已恢复初始状态' };
    }
    if (parsed.version === STORE_VERSION) return { state: parsed, notice: null };
    if (typeof parsed.version !== 'number' || parsed.version > STORE_VERSION) {
      return { state: null, notice: '本地快照版本已更新，已恢复初始状态' };
    }
    // 旧版本快照：尝试结构迁移，保留用户已有草稿与业务事实
    try {
      return { state: migrateParsed(parsed), notice: '本地快照已迁移至新版本结构（报警规则已补齐结构化字段）' };
    } catch {
      return { state: null, notice: '本地快照迁移失败，已恢复初始状态' };
    }
  } catch {
    return { state: null, notice: '本地快照解析失败，已恢复初始状态' };
  }
}

export function saveDemoState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return { ok: true };
  } catch {
    // 存储不可用时保持内存态，页面继续展示当前操作结果（演示模式允许）
    return { ok: false };
  }
}

export function clearDemoState() {
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* 存储不可用时忽略 */ }
}

export function resetDemo() {
  clearDemoState();
  return createDemoState();
}
