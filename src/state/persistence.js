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
    },
  };
  // 已下线实体不随旧快照迁移，避免旧页面数据重新出现
  delete next.entities.ruleTemplatesById;
  delete next.entities.alarmBatchesById;
  // 绑定模板管理下线（V14）：模板数据与向导模板预填一并移除
  if (next.ui && next.ui.bindingTemplates) delete next.ui.bindingTemplates;
  // 来源设备 product 回填（V15）：旧快照来源设备无产品归属，按名称推断（主控制器→网关 / 振动→VB12 / 温度→TP08）
  next.entities.sourceDevicesById = Object.fromEntries(
    Object.entries(parsed.entities?.sourceDevicesById || {}).map(([id, s]) => {
      if (s.product) return [id, s];
      const n = `${s.name || ''}${s.iotDeviceCode || ''}`;
      const product = /振动/.test(n) ? '振动传感器 VB12' : /温度/.test(n) ? '温度传感器 TP08' : '工业智能网关 GW200';
      return [id, { ...s, product }];
    })
  );
  // 报警三态状态机迁移（V13）：已确认 / 已恢复待关闭 并入处理中；恢复口径改名
  next.entities.alarmEventsById = Object.fromEntries(
    Object.entries(parsed.entities?.alarmEventsById || {}).map(([id, a]) => {
      const status = ['已确认', '已恢复待关闭'].includes(a.status) ? '处理中' : a.status;
      const recovery = a.recovery === '人工确认关闭' ? '人工处置关闭' : a.recovery;
      return [id, { ...a, status, recovery }];
    })
  );
  next.entities.alarmRulesById = Object.fromEntries(
    Object.entries(parsed.entities?.alarmRulesById || {})
      .map(([code, rule]) => [code, normalizeLegacyRule(rule)])
      // 报警规则已无草稿态：历史草稿规则（从未生效）随迁移清理
      .filter(([, rule]) => rule.status !== '草稿')
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
    if (parsed.version < 12) {
      // V12 之前的快照缺少物联网平台产品等关键结构（来源设备无 product 字段），无法安全迁移
      return { state: null, notice: '本地快照版本过旧（缺少物联网平台产品数据），已恢复初始演示状态' };
    }
    // 旧版本快照：尝试结构迁移，保留用户已有草稿与业务事实
    try {
      return { state: migrateParsed(parsed), notice: '本地快照已迁移至新版本结构（报警状态机已收敛为三态，历史草稿规则已清理）' };
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
