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
    // meta / ui 结构补齐：旧快照缺失字段（如 ui.bindingDraftsByDeviceId 容器）从种子补齐
    meta: { ...base.meta, ...(parsed.meta || {}) },
    ui: { ...base.ui, ...(parsed.ui || {}) },
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
  // 主数据目录合并（2026-11-05）：设备 / 来源设备 / 指标 / 映射 / 速度配置等种子目录按 key 合并——
  // 新种子补充新增条目（如新设备、新指标），旧快照已有条目保留用户修改，避免目录类新增永远进不来
  const catalogMergeKeys = ['devicesById', 'sourceDevicesById', 'metricsByKey', 'crosswalkByDeviceId', 'crosswalkByAssetCode', 'speedConfigsById'];
  for (const k of catalogMergeKeys) {
    if (base.entities[k]) next.entities[k] = { ...base.entities[k], ...(parsed.entities?.[k] || {}) };
  }
  // 种子移除设备清理（V17）：DEV-007（已停用绑定、无业务关联）从种子删除，旧快照同步移除
  const REMOVED_DEVICES = ['DEV-007'];
  for (const dev of REMOVED_DEVICES) {
    delete next.entities.devicesById[dev];
    delete next.entities.crosswalkByDeviceId?.[dev];
    delete next.entities.crosswalkByAssetCode?.[`MT2024A12${dev.slice(-2)}`];
    if (next.entities.bindingsByDeviceId?.[dev]) {
      const bid = next.entities.bindingsByDeviceId[dev].bindingId;
      delete next.entities.bindingsByDeviceId[dev];
      for (const [vk, v] of Object.entries(next.entities.bindingVersionsById || {})) {
        if (v.bindingId === bid) delete next.entities.bindingVersionsById[vk];
      }
    }
    delete next.entities.healthByDeviceId?.[dev];
    delete next.entities.oeeInputs?.daily?.[dev];
    delete next.entities.oeeInputs?.realtime?.[dev];
    delete next.entities.productionReportsByDeviceId?.[dev];
  }
  // 旧指标下线（V18）：OEE 改报工事件口径，删除「加工数量 / 合格数量」聚合指标
  delete next.entities.metricsByKey['M.output'];
  delete next.entities.metricsByKey['M.qualified'];
  const OBSOLETE_METRICS = new Set(['M.output', 'M.qualified']);
  // 报工事件实体（V18）：旧快照无此结构时补种子（报工事件为只读演示源数据）
  if (!next.entities.productionReportsByDeviceId) {
    next.entities.productionReportsByDeviceId = base.entities.productionReportsByDeviceId;
  }
  delete next.entities.oeeCounters;
  // 绑定 items 指标回填（V16/V18）：指标目录新增报工事件指标后，旧快照绑定 items 缺失目录指标 —— 补齐（monitored=false）
  const catalogCodes = Object.keys(base.entities.metricsByKey || {});
  next.entities.bindingsByDeviceId = Object.fromEntries(
    Object.entries(next.entities.bindingsByDeviceId || {})
      .filter(([id]) => !REMOVED_DEVICES.includes(id))
      .map(([id, b]) => {
        const items = (b.items || []).map((item) => {
          const kept = (item.metrics || []).filter((m) => !OBSOLETE_METRICS.has(m.metricCode));
          const have = new Set(kept.map((m) => m.metricCode));
          const filled = [...kept, ...catalogCodes
            .filter((c) => !have.has(c))
            .map((c) => ({ metricCode: c, metricVersion: base.entities.metricsByKey[c]?.metricVersion || null, monitored: false }))];
          return { ...item, metrics: filled };
        });
        // OEE 配置迁移（V18）：旧「产量指标 / 合格数指标」映射收敛为「报工事件」映射
        const oee = b.oee ? {
          enabled: !!b.oee.enabled,
          stateMetricCode: b.oee.stateMetricCode || null,
          reportMetricCode: b.oee.reportMetricCode || (b.oee.outputMetricCode ? 'E.production_report' : null),
        } : b.oee;
        return [id, { ...b, items, ...(b.oee ? { oee } : {}) }];
      })
  );
  // 来源设备 product 回填（V15）：旧快照来源设备无产品归属，按名称推断（主控制器→网关 / 振动→VB12 / 温度→TP08）
  next.entities.sourceDevicesById = Object.fromEntries(
    Object.entries(next.entities.sourceDevicesById || {}).map(([id, s]) => {
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
