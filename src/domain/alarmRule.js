// ============================================================
// 报警规则领域层（纯 JS：结构化契约、校验、样本判定、批量分组、历史回测）
// 依据 docs/报警规则配置与批量创建技术功能设计方案.md V1.2：
// - M0-M4 契约：目标主键 / 版本号 / legacy adapter / 元数据归一化（保持不变）
// - P2 扩展：区间（rangeOut/rangeIn）、状态（state）、质量（quality）、组合（combo）
//   四类触发条件的判定、恢复与校验；治理参数（抑制/风暴/静默）校验；历史趋势回测
// ============================================================

// 旧种子中的业务事件类规则：不映射为结构化规则，编辑入口只读
export const LEGACY_BUSINESS_RULE_TYPES = ['程序', '备件', '点检', '保养', '维修'];
export const RULE_TYPE_LABEL = { threshold: '阈值', state: '状态', quality: '质量', combo: '组合' };
export const TRIGGER_MODES = ['upper', 'lower', 'rangeOut', 'rangeIn'];
export const NUMERIC_TRIGGER_MODES = ['upper', 'lower', 'rangeOut', 'rangeIn'];

// ---------- 指标元数据归一化（M0 契约 6） ----------
export function normalizeMetricMeta(metric) {
  if (!metric) return null;
  const dataTypeMap = { '数值': 'number', '状态': 'state', '事件': 'event', number: 'number', state: 'state', enum: 'state' };
  let range = null;
  let enumValues = null;
  if (typeof metric.range === 'string') {
    const m = metric.range.match(/^(-?[\d.]+)\s*~\s*(-?[\d.]+)$/);
    if (m) range = { min: Number(m[1]), max: Number(m[2]) };
    // 状态类指标量程为枚举列表（如 运行/待机/计划停机/故障/维修中/无数据）
    if (metric.dataType === '状态' && metric.range.includes('/')) {
      enumValues = metric.range.split('/').map((s) => s.trim()).filter(Boolean);
    }
  } else if (metric.range && typeof metric.range === 'object') {
    const min = Number(metric.range.min); const max = Number(metric.range.max);
    if (!Number.isNaN(min) && !Number.isNaN(max)) range = { min, max };
  }
  return {
    metricCode: metric.metricCode,
    metricVersion: metric.metricVersion || 'v1',
    name: metric.name || metric.metricCode,
    unit: metric.unit && metric.unit !== '--' ? metric.unit : '',
    dataType: dataTypeMap[metric.dataType] || 'other',
    range,
    enumValues,
    precision: typeof metric.precision === 'number' ? metric.precision : null,
    syncStatus: metric.syncStatus || '正常',
  };
}

// ---------- canonical 目标解析 ----------
export function resolveRuleTargets(state) {
  const out = [];
  const bindings = state?.entities?.bindingsByDeviceId || {};
  const metricsByKey = state?.entities?.metricsByKey || {};
  const devicesById = state?.entities?.devicesById || {};
  Object.values(bindings).forEach((b) => {
    if (b.configStatus !== '已启用') return;
    (b.items || []).filter((i) => i.enabled).forEach((item) => {
      (item.metrics || []).filter((m) => m.selected).forEach((sel) => {
        const metric = normalizeMetricMeta(metricsByKey[sel.metricCode]);
        if (!metric || metric.syncStatus === '已失效') return;
        const device = devicesById[b.deviceId];
        out.push({
          key: `${b.deviceId}|${item.iotDeviceId}|${sel.metricCode}`,
          deviceId: b.deviceId,
          deviceName: device?.name || b.deviceId,
          deviceModel: device?.model || '--',
          bindingId: b.bindingId,
          bindingVersion: b.version,
          sourceId: item.iotDeviceId,
          sourceCode: item.iotDeviceCode,
          sourceRole: item.role || '--',
          sensorType: item.sensorType || '--',
          metricCode: sel.metricCode,
          metricVersion: sel.metricVersion || metric.metricVersion,
          metric,
        });
      });
    });
  });
  return out;
}

// ---------- 表单模型 ----------
export function createEmptyTriggerConfig(type = 'threshold') {
  if (type === 'state') {
    return { type: 'state', abnormalValues: [], normalValues: [], durationSec: 0, unit: null };
  }
  if (type === 'quality') {
    return { type: 'quality', mode: 'outage', durationMin: 5, invalidRatePercent: null, invalidCount: null, delaySec: null };
  }
  if (type === 'combo') {
    return { type: 'combo', operator: 'AND', windowSec: 300, conditions: [] };
  }
  return {
    type: 'threshold',
    mode: 'upper',
    operator: '>',
    threshold: null,
    low: null,
    high: null,
    unit: null,
    durationSec: 60,
  };
}

export function createEmptyRuleForm(type = 'threshold') {
  return {
    code: null,
    name: '',
    type,
    severity: '重要',
    description: '',
    cause: '',
    advice: '',
    target: { deviceId: null, sourceId: null, metricCode: null },
    triggerConfig: createEmptyTriggerConfig(type),
    recoveryConfig: {
      mode: 'auto',
      closeMode: 'auto',
      condition: {
        type: 'hysteresis',
        direction: 'upper',
        thresholdMode: 'deadband', // deadband | explicit | range | state | quality
        triggerValue: null,
        recoveryValue: null,
        deadband: 5,
        recoveryLow: null,
        recoveryHigh: null,
        unit: null,
      },
      stabilize: { durationSec: 30, qualityRequired: 'GOOD', invalidDataPolicy: 'hold', rebreachPolicy: 'resetTimer' },
      notifyOnRecover: true,
    },
    notificationConfig: null,
    suppressionConfig: { mergeActiveEvent: true, countRepeatedTrigger: true, remindEnabled: true, remindIntervalMin: 5, maxRemindCount: null, createNewAfterClose: true },
    stormConfig: { enabled: true, windowMin: 60, maxEvents: 3, scope: 'sameRule', overflowAction: 'merge' },
    silenceConfig: { source: 'template', enabled: false, windows: [] },
    qualityPolicy: { badDataAction: 'hold', maxStaleSec: 0 },
    batchId: null,
    templateId: null,
    templateVersion: null,
  };
}

// 规则类型切换：保留基础信息，重建触发/恢复结构（质量规则不需要指标目标）
export function switchRuleFormType(form, type) {
  const base = createEmptyRuleForm(type);
  return {
    ...form,
    type,
    triggerConfig: base.triggerConfig,
    recoveryConfig: type === 'threshold' ? form.recoveryConfig : base.recoveryConfig,
    target: type === 'quality' ? { deviceId: form.target.deviceId, sourceId: form.target.sourceId, metricCode: null } : form.target,
  };
}

// 旧规则 → 表单：结构化字段优先，缺失时用 legacy adapter 解析；解析失败返回默认（页面按类型判断只读）
export function ruleToForm(rule) {
  const base = createEmptyRuleForm();
  if (!rule) return base;
  const typeKey = ({ 阈值: 'threshold', 状态: 'state', 质量: 'quality', 组合: 'combo' })[rule.type] || 'threshold';
  const trigger = rule.triggerConfig || parseLegacyCondition(rule) || createEmptyTriggerConfig(typeKey);
  const form = {
    ...base,
    code: rule.code || null,
    name: rule.name || '',
    type: trigger.type || typeKey,
    severity: rule.severity || '重要',
    description: rule.description || '',
    target: {
      deviceId: rule.target?.deviceId || null,
      sourceId: rule.target?.sourceId || null,
      metricCode: rule.target?.metricCode || (trigger.type === 'quality' ? null : rule.metricCode) || null,
    },
    triggerConfig: structuredClone(trigger),
    recoveryConfig: rule.recoveryConfig
      ? structuredClone(rule.recoveryConfig)
      : parseLegacyRecovery(rule) || base.recoveryConfig,
    suppressionConfig: rule.suppressionConfig || base.suppressionConfig,
    stormConfig: rule.stormConfig || base.stormConfig,
    silenceConfig: rule.silenceConfig || base.silenceConfig,
    qualityPolicy: rule.qualityPolicy || base.qualityPolicy,
    notificationConfig: rule.notificationConfig || null,
  };
  if (form.triggerConfig.type === 'threshold' && form.recoveryConfig.condition) {
    form.recoveryConfig.condition.triggerValue = form.triggerConfig.threshold;
    form.recoveryConfig.condition.direction = form.triggerConfig.mode === 'lower' ? 'lower' : 'upper';
    form.recoveryConfig.condition.unit = form.triggerConfig.unit || form.recoveryConfig.condition.unit;
  }
  return form;
}

// 表单 → 规则实体（含兼容展示字段；condition/recovery 仅为列表展示，不是唯一事实来源）
export function formToRule(form, extra = {}) {
  const triggerConfig = structuredClone(form.triggerConfig);
  const recoveryConfig = structuredClone(form.recoveryConfig);
  finalizeRuleConfigs(triggerConfig, recoveryConfig);
  return {
    ...extra,
    code: form.code || extra.code || null,
    name: (form.name || '').trim(),
    type: RULE_TYPE_LABEL[form.type] || '阈值',
    severity: form.severity,
    description: form.description || '',
    cause: form.cause || '',
    advice: form.advice || '',
    target: form.target?.deviceId ? { ...form.target } : null,
    metricCode: form.target?.metricCode || null, // 兼容字段：报警事件与报表按指标过滤使用
    triggerConfig,
    recoveryConfig,
    notificationConfig: form.notificationConfig || null,
    suppressionConfig: form.suppressionConfig || null,
    stormConfig: form.stormConfig || null,
    silenceConfig: form.silenceConfig || null,
    qualityPolicy: form.qualityPolicy || null,
    policyCode: form.notificationConfig?.policyCode || null,
    condition: conditionTextOf(triggerConfig),
    recovery: recoveryTextOf(recoveryConfig, triggerConfig),
  };
}

// 触发/恢复结构固化：deadband 推导恢复值、区间按独立回差固化恢复带（保存与批量编辑共用）
export function finalizeRuleConfigs(triggerConfig, recoveryConfig) {
  if (!triggerConfig || !recoveryConfig) return;
  if (recoveryConfig.condition && recoveryConfig.condition.thresholdMode === 'deadband' && triggerConfig.type === 'threshold'
    && ['upper', 'lower'].includes(triggerConfig.mode)) {
    const t = Number(triggerConfig.threshold);
    const d = Number(recoveryConfig.condition.deadband);
    if (!Number.isNaN(t) && !Number.isNaN(d)) {
      const raw = triggerConfig.mode === 'lower' ? t + d : t - d;
      recoveryConfig.condition.recoveryValue = Math.round(raw * 1e10) / 1e10; // 消除浮点噪声（0.15+0.02）
    }
  }
  if (triggerConfig.type === 'threshold' && ['rangeOut', 'rangeIn'].includes(triggerConfig.mode) && recoveryConfig.condition) {
    const c = recoveryConfig.condition;
    c.type = 'range';
    const lo = Number(triggerConfig.low); const hi = Number(triggerConfig.high);
    const dl = Number(c.lowDeadband ?? 0); const dh = Number(c.highDeadband ?? 0);
    if (!Number.isNaN(lo) && !Number.isNaN(hi)) {
      c.recoveryLow = Math.round((lo + dl) * 1e10) / 1e10;
      c.recoveryHigh = Math.round((hi - dh) * 1e10) / 1e10;
    }
  }
}

// ---------- 分组信息（列表分组列 / 批量编辑同组校验） ----------
// 有 canonical 目标：按目标设备型号精确分组；无目标但有指标编码的旧种子规则：
// 按指标元数据归入「全型号」组（型号维度记 *，不与精确分组混组）。
// 返回 { groupKey, label } 或 null（业务事件类等无法定位指标的规则不参与分组）。
export function ruleGroupInfo(rule, targets) {
  if (!rule) return null;
  let t = null;
  let byTarget = false;
  if (rule.target?.deviceId && rule.target.metricCode) {
    t = (targets || []).find((x) => x.deviceId === rule.target.deviceId
      && x.metricCode === rule.target.metricCode
      && (!rule.target.sourceId || x.sourceId === rule.target.sourceId));
    byTarget = !!t;
  } else if (rule.metricCode) {
    t = (targets || []).find((x) => x.metricCode === rule.metricCode);
  }
  if (!t) return null;
  const m = t.metric;
  const modelDim = byTarget ? (t.deviceModel || '--') : '*';
  const key = [t.metricCode, m.dataType || 'other', m.unit || '', m.range ? `${m.range.min}:${m.range.max}` : 'no-range', modelDim].join('|');
  const r = m.range;
  const label = `${m.name} ${m.unit || ''} ${r ? `${r.min}~${r.max}` : ''} · ${byTarget ? (t.deviceModel || '--') : '全型号'}`.replace(/\s+/g, ' ').trim();
  return { groupKey: key, label };
}

// ---------- 批量编辑 patch 应用（P2：同分组勾选批量编辑） ----------
// patch 字段留空（null/undefined）= 不修改；各规则保持自身触发模式：
// upper/lower 应用 threshold，rangeOut/rangeIn 应用 low/high；回差按各自恢复模式应用。
// 返回 { draft } 或 { error }；只处理结构化数值阈值规则，已停用/旧业务规则跳过。
export function applyBatchEditPatch(rule, patch) {
  if (!rule || !rule.code) return { error: '规则不存在' };
  if (rule.legacyOnly) return { error: '旧业务规则不支持结构化批量编辑' };
  if (!rule.triggerConfig || rule.triggerConfig.type !== 'threshold') return { error: '仅数值阈值规则支持批量编辑' };
  if (rule.status === '已停用') return { error: '已停用规则不参与批量编辑' };
  const base = rule.draftConfig ? structuredClone(rule.draftConfig) : { ...rule };
  delete base.draftConfig;
  const triggerConfig = structuredClone(base.triggerConfig);
  const recoveryConfig = structuredClone(base.recoveryConfig || {});
  const p = patch || {};
  const has = (v) => v !== null && v !== undefined && v !== '';
  if (triggerConfig.mode === 'upper' || triggerConfig.mode === 'lower') {
    if (has(p.threshold)) triggerConfig.threshold = Number(p.threshold);
    if (has(p.deadband) && recoveryConfig.condition) recoveryConfig.condition.deadband = Number(p.deadband);
    if (has(p.recoveryValue) && recoveryConfig.condition) {
      recoveryConfig.condition.thresholdMode = 'explicit';
      recoveryConfig.condition.recoveryValue = Number(p.recoveryValue);
    }
  } else if (triggerConfig.mode === 'rangeOut' || triggerConfig.mode === 'rangeIn') {
    if (has(p.low)) triggerConfig.low = Number(p.low);
    if (has(p.high)) triggerConfig.high = Number(p.high);
    if (has(p.deadband) && recoveryConfig.condition) {
      recoveryConfig.condition.lowDeadband = Number(p.deadband);
      recoveryConfig.condition.highDeadband = Number(p.deadband);
    }
  }
  if (has(p.durationSec)) triggerConfig.durationSec = Number(p.durationSec);
  if (has(p.stabilizeSec) && recoveryConfig.stabilize) recoveryConfig.stabilize.durationSec = Number(p.stabilizeSec);
  let notificationConfig = base.notificationConfig ? structuredClone(base.notificationConfig) : null;
  if (p.notificationConfig) notificationConfig = structuredClone(p.notificationConfig);
  finalizeRuleConfigs(triggerConfig, recoveryConfig);
  const draft = {
    ...base,
    severity: has(p.severity) ? p.severity : base.severity,
    triggerConfig,
    recoveryConfig,
    notificationConfig,
    policyCode: notificationConfig?.policyCode || base.policyCode || null,
    condition: conditionTextOf(triggerConfig),
    recovery: recoveryTextOf(recoveryConfig, triggerConfig),
  };
  return { draft };
}

// ---------- 展示文本由结构生成 ----------
export function conditionTextOf(triggerConfig) {
  if (!triggerConfig) return '--';
  const u = triggerConfig.unit || '';
  const dur = triggerConfig.durationSec ?? 0;
  if (triggerConfig.type === 'state') {
    return `状态 ∈ [${(triggerConfig.abnormalValues || []).join(' / ')}] 立即触发`;
  }
  if (triggerConfig.type === 'quality') {
    const m = { outage: '数据中断', invalidRate: '无效率超限', invalidCount: '无效数据超限', delay: '采集延迟' }[triggerConfig.mode] || '质量异常';
    return `质量：${m} 持续 ${triggerConfig.durationMin ?? 5} 分钟`;
  }
  if (triggerConfig.type === 'combo') {
    const items = (triggerConfig.conditions || []).map((c) => `${c.target?.metricCode || '--'} ${c.operator}${c.value}`);
    return `${triggerConfig.operator}（${items.join(' , ')}）窗口 ${triggerConfig.windowSec}s`;
  }
  if (triggerConfig.mode === 'upper') return `> ${triggerConfig.threshold}${u} 持续 ${dur}s`;
  if (triggerConfig.mode === 'lower') return `< ${triggerConfig.threshold}${u} 持续 ${dur}s`;
  if (triggerConfig.mode === 'rangeOut') return `区间外 ${triggerConfig.low} ~ ${triggerConfig.high}${u} 持续 ${dur}s`;
  if (triggerConfig.mode === 'rangeIn') return `区间内 ${triggerConfig.low} ~ ${triggerConfig.high}${u} 持续 ${dur}s`;
  return '枚举判定';
}

export function recoveryTextOf(recoveryConfig, triggerConfig) {
  if (!recoveryConfig) return '--';
  const c = recoveryConfig.condition || {};
  const st = recoveryConfig.stabilize || {};
  const dur = st.durationSec ?? 30;
  const type = triggerConfig?.type || 'threshold';
  if (type === 'state') return '状态恢复正常自动恢复';
  if (type === 'quality') return '数据质量恢复正常自动恢复';
  if (type === 'combo') return '全部子条件回到恢复状态并稳定后恢复';
  if (c.type === 'range' && c.recoveryLow != null && c.recoveryHigh != null) {
    return `自动恢复：回到 ${c.recoveryLow} ~ ${c.recoveryHigh}${c.unit || ''} 持续 ${dur}s`;
  }
  if (c.type === 'hysteresis' && typeof c.recoveryValue === 'number') {
    const op = (c.direction || triggerConfig?.mode) === 'lower' ? '>=' : '<=';
    return `自动恢复：${op} ${c.recoveryValue}${c.unit || ''} 持续 ${dur}s`;
  }
  return '自动恢复';
}

// ---------- legacy adapter（M0 契约 5/7） ----------
// 解析旧规则的 condition/recoverCondition 展示文本；程序/备件等业务规则不解析、不映射。
export function parseLegacyCondition(rule) {
  if (!rule) return null;
  if (rule.type === '状态') {
    // 如「状态 = 故障 立即触发」
    const m = String(rule.condition || '').match(/状态\s*=?\s*([^\s，,]+)/);
    if (m) {
      return { type: 'state', abnormalValues: [m[1]], normalValues: ['运行', '待机'], durationSec: 0, legacyParsed: true };
    }
    return null;
  }
  if (rule.type === '质量') {
    // 如「延迟 > 30s 持续 60s」
    const cond = String(rule.condition || '');
    const delayM = cond.match(/延迟\s*>\s*(\d+)\s*s/);
    if (delayM) {
      return { type: 'quality', mode: 'delay', delaySec: Number(delayM[1]), durationMin: 1, legacyParsed: true };
    }
    return { type: 'quality', mode: 'outage', durationMin: 5, legacyParsed: true };
  }
  if (rule.type !== '阈值') return null;
  const cond = String(rule.condition || '');
  const durM = cond.match(/持续\s*(\d+)\s*s/);
  const durationSec = durM ? Number(durM[1]) : 0;
  const unitM = cond.match(/(℃|MPa|mm\/s|rpm|%|A)/);
  const unit = unitM ? unitM[1] : '';
  const rangeM = cond.match(/区间(外|内)\s*(-?[\d.]+)\s*~\s*(-?[\d.]+)/);
  if (rangeM) {
    return { type: 'threshold', mode: rangeM[1] === '外' ? 'rangeOut' : 'rangeIn', low: Number(rangeM[2]), high: Number(rangeM[3]), unit, durationSec, legacyParsed: true };
  }
  const upM = cond.match(/>\s*(-?[\d.]+)/);
  if (upM) {
    return { type: 'threshold', mode: 'upper', operator: '>', threshold: Number(upM[1]), unit, durationSec, legacyParsed: true };
  }
  const lowM = cond.match(/<\s*(-?[\d.]+)/);
  if (lowM) {
    return { type: 'threshold', mode: 'lower', operator: '<', threshold: Number(lowM[1]), unit, durationSec, legacyParsed: true };
  }
  return null;
}

export function parseLegacyRecovery(rule) {
  if (!rule || !['阈值', '状态', '质量'].includes(rule.type)) return null;
  const s = String(rule.recoverCondition || '');
  if (!s) return null;
  if (rule.type === '状态') {
    return {
      mode: 'auto', closeMode: 'auto',
      condition: { type: 'state', normalValues: ['运行', '待机'] },
      stabilize: { durationSec: 0, qualityRequired: 'GOOD', invalidDataPolicy: 'hold', rebreachPolicy: 'resetTimer' },
      notifyOnRecover: true, legacyParsed: true,
    };
  }
  if (rule.type === '质量') {
    return {
      mode: 'auto', closeMode: 'auto',
      condition: { type: 'quality', requiredQualityCode: 'GOOD' },
      stabilize: { durationSec: 60, qualityRequired: 'GOOD', invalidDataPolicy: 'resetTimer', rebreachPolicy: 'resetTimer' },
      notifyOnRecover: true, legacyParsed: true,
    };
  }
  const rvM = s.match(/[<=]+\s*(-?[\d.]+)/);
  const dbM = s.match(/回差\s*(-?[\d.]+)/);
  const durM = s.match(/持续\s*(\d+)\s*s/);
  const unitM = s.match(/(℃|MPa|mm\/s|rpm|%|A)/);
  if (!rvM && !dbM) return null;
  return {
    mode: 'auto',
    closeMode: 'auto',
    condition: {
      type: 'hysteresis',
      direction: 'upper',
      thresholdMode: dbM ? 'deadband' : 'explicit',
      triggerValue: null,
      recoveryValue: rvM ? Number(rvM[1]) : null,
      deadband: dbM ? Number(dbM[1]) : null,
      unit: unitM ? unitM[1] : '',
    },
    stabilize: {
      durationSec: durM ? Number(durM[1]) : 30,
      qualityRequired: 'GOOD',
      invalidDataPolicy: 'hold',
      rebreachPolicy: 'resetTimer',
    },
    notifyOnRecover: true,
    legacyParsed: true,
  };
}

// 旧规则结构归一化：业务事件类标记 legacyOnly；阈值/状态/质量类补结构化字段与发布版本指针。
export function normalizeLegacyRule(rule) {
  if (!rule || typeof rule !== 'object') return rule;
  const out = { ...rule };
  if (LEGACY_BUSINESS_RULE_TYPES.includes(out.type)) {
    out.legacyOnly = true;
  }
  if (out.status === '已发布' && !out.publishedVersion) out.publishedVersion = out.version || null;
  if (!out.triggerConfig && ['阈值', '状态', '质量'].includes(out.type)) {
    const trigger = parseLegacyCondition(out);
    if (trigger) {
      out.triggerConfig = trigger;
      if (!out.recoveryConfig) {
        const recovery = parseLegacyRecovery(out);
        if (recovery) {
          if (trigger.type === 'threshold') {
            recovery.condition.triggerValue = ['rangeOut', 'rangeIn'].includes(trigger.mode) ? null : trigger.threshold;
            recovery.condition.direction = trigger.mode === 'lower' ? 'lower' : 'upper';
            if (['rangeOut', 'rangeIn'].includes(trigger.mode)) {
              recovery.condition.type = 'range';
              recovery.condition.recoveryLow = trigger.low + (Number(recovery.condition.deadband) || 0);
              recovery.condition.recoveryHigh = trigger.high - (Number(recovery.condition.deadband) || 0);
            }
          }
          out.recoveryConfig = recovery;
        }
      }
    }
  }
  return out;
}

// ---------- 版本号契约 ----------
export function nextPublishVersion(publishedVersion) {
  if (!publishedVersion) return 'V1';
  const n = Number(String(publishedVersion).replace(/\D/g, '')) || 0;
  return `V${n + 1}`;
}

// ---------- 规则草稿校验（全类型） ----------
// ctx: { devicesById, bindingsByDeviceId, metricsByKey, alarmRulesById }
export function validateRuleDraft(rule, ctx = {}) {
  const errors = [];
  const warnings = [];
  const name = (rule?.name || '').trim();
  if (name.length < 2 || name.length > 100) errors.push('规则名称必填且为 2~100 字');
  if (!rule?.code) errors.push('规则编号缺失');

  const devicesById = ctx.devicesById || {};
  const bindingsByDeviceId = ctx.bindingsByDeviceId || {};
  const metricsByKey = ctx.metricsByKey || {};
  const trigger = rule?.triggerConfig;
  if (!trigger?.type) {
    errors.push('触发条件缺失');
    return { errors, warnings };
  }

  // 目标公共校验：设备存在 + 绑定启用；阈值/状态类还要求指标有效
  function validateTarget(target, { needMetric = true, label = '规则目标' } = {}) {
    if (!target?.deviceId) {
      errors.push(`必须选择${label}设备`);
      return;
    }
    if (!devicesById[target.deviceId]) errors.push(`目标设备 ${target.deviceId} 不存在`);
    const binding = bindingsByDeviceId[target.deviceId];
    if (!binding) errors.push(`设备 ${target.deviceId} 尚未创建绑定`);
    else if (binding.configStatus !== '已启用') errors.push(`设备 ${target.deviceId} 绑定当前状态「${binding.configStatus}」，必须为已启用`);
    if (!needMetric) return;
    if (!target.metricCode) {
      errors.push('必须选择规则目标指标');
      return;
    }
    const stillBound = binding
      ? (binding.items || []).some((i) => i.enabled && (i.metrics || []).some((m) => m.selected && m.metricCode === target.metricCode))
      : false;
    if (!stillBound) errors.push(`指标 ${target.metricCode} 未在设备当前启用绑定中`);
    const metric = normalizeMetricMeta(metricsByKey[target.metricCode]);
    if (!metric) {
      errors.push(`指标 ${target.metricCode} 不在平台指标清单中`);
      return;
    }
    if (metric.syncStatus === '已失效') errors.push(`指标 ${metric.name} 已失效，不能参与报警规则`);
    return metric;
  }

  if (trigger.type === 'threshold') {
    if (!['upper', 'lower', 'rangeOut', 'rangeIn'].includes(trigger.mode)) {
      errors.push('触发模式不合法');
      return { errors, warnings };
    }
    const metric = validateTarget(rule?.target);
    if (metric && metric.dataType !== 'number') errors.push('阈值规则仅适用于数值型指标');
    const isRange = ['rangeOut', 'rangeIn'].includes(trigger.mode);
    if (isRange) {
      const low = Number(trigger.low); const high = Number(trigger.high);
      if (trigger.low == null || Number.isNaN(low)) errors.push('区间下限必填且为数值');
      if (trigger.high == null || Number.isNaN(high)) errors.push('区间上限必填且为数值');
      if (!Number.isNaN(low) && !Number.isNaN(high) && low >= high) errors.push('区间下限必须小于上限');
      if (metric?.range && !Number.isNaN(low) && !Number.isNaN(high)) {
        if (low < metric.range.min || high > metric.range.max) {
          errors.push(`区间 ${low} ~ ${high}${metric.unit} 超出指标量程 ${metric.range.min} ~ ${metric.range.max}${metric.unit}`);
        }
      }
    } else {
      const threshold = Number(trigger.threshold);
      if (trigger.threshold == null || trigger.threshold === '' || Number.isNaN(threshold)) errors.push('触发阈值必填且为数值');
      if (metric?.range && !Number.isNaN(threshold)) {
        if (threshold < metric.range.min || threshold > metric.range.max) {
          errors.push(`触发阈值 ${threshold}${metric.unit} 超出指标量程 ${metric.range.min} ~ ${metric.range.max}${metric.unit}`);
        }
      } else if (metric && !metric.range) {
        warnings.push('指标缺少结构化量程，无法校验阈值是否超量程');
      }
    }
    const durationSec = Number(trigger.durationSec ?? 0);
    if (Number.isNaN(durationSec) || durationSec < 0) errors.push('触发持续时间不能为负数');
    if (durationSec === 0) warnings.push('持续时间为 0 将立即触发，仅建议状态类使用；模拟量建议 ≥ 1 秒');
    validateRecovery(rule, trigger, errors);
    validateNotification(rule, errors);
    validateGovernance(rule, warnings, errors);
    warnDuplicate(rule, '阈值', rule?.target, ctx, warnings);
    return { errors, warnings };
  }

  if (trigger.type === 'state') {
    const metric = validateTarget(rule?.target);
    if (metric && metric.dataType !== 'state') errors.push('状态规则仅适用于状态类（S.*）指标');
    const abnormal = trigger.abnormalValues || [];
    const normal = trigger.normalValues || [];
    if (abnormal.length === 0) errors.push('异常状态枚举至少 1 个');
    if (normal.length === 0) errors.push('正常状态枚举至少 1 个');
    const overlap = abnormal.filter((v) => normal.includes(v));
    if (overlap.length > 0) errors.push(`异常与正常状态枚举重叠：${overlap.join('、')}`);
    if (metric?.enumValues) {
      const unknown = [...abnormal, ...normal].filter((v) => !metric.enumValues.includes(v));
      if (unknown.length > 0) errors.push(`状态枚举不在指标取值范围内：${unknown.join('、')}`);
    }
    validateNotification(rule, errors);
    validateGovernance(rule, warnings, errors);
    warnDuplicate(rule, '状态', rule?.target, ctx, warnings);
    return { errors, warnings };
  }

  if (trigger.type === 'quality') {
    validateTarget(rule?.target, { needMetric: false, label: '质量监控' });
    const mode = trigger.mode;
    if (!['outage', 'invalidRate', 'invalidCount', 'delay'].includes(mode)) errors.push('质量规则类型不合法');
    const durationMin = Number(trigger.durationMin ?? 0);
    if (Number.isNaN(durationMin) || durationMin <= 0) errors.push('质量异常持续分钟必须大于 0');
    if (mode === 'invalidRate') {
      const p = Number(trigger.invalidRatePercent);
      if (Number.isNaN(p) || p <= 0 || p > 100) errors.push('无效率阈值必须为 0 ~ 100 之间的数值');
    }
    if (mode === 'invalidCount') {
      const n = Number(trigger.invalidCount);
      if (!Number.isInteger(n) || n <= 0) errors.push('连续无效条数必须为正整数');
    }
    if (mode === 'delay') {
      const s = Number(trigger.delaySec);
      if (Number.isNaN(s) || s <= 0) errors.push('最大允许延迟秒数必须大于 0');
    }
    validateNotification(rule, errors);
    validateGovernance(rule, warnings, errors);
    warnDuplicate(rule, '质量', rule?.target, ctx, warnings);
    return { errors, warnings };
  }

  if (trigger.type === 'combo') {
    const conditions = trigger.conditions || [];
    if (conditions.length < 2) errors.push('组合规则至少需要 2 个子条件');
    if (!['AND', 'OR'].includes(trigger.operator)) errors.push('组合关系必须明确为 AND / OR');
    const windowSec = Number(trigger.windowSec ?? 0);
    if (Number.isNaN(windowSec) || windowSec <= 0) errors.push('组合时间窗口必须大于 0');
    conditions.forEach((c, idx) => {
      const label = `子条件 ${String.fromCharCode(65 + idx)}`;
      const metric = validateTarget(c.target, { label });
      if (metric && metric.dataType !== 'number') errors.push(`${label}：组合子条件仅支持数值型指标`);
      const v = Number(c.value);
      if (c.value == null || c.value === '' || Number.isNaN(v)) errors.push(`${label}：阈值必填且为数值`);
      if (metric?.range && !Number.isNaN(v)) {
        if (v < metric.range.min || v > metric.range.max) {
          errors.push(`${label}：阈值 ${v}${metric.unit} 超出指标量程 ${metric.range.min} ~ ${metric.range.max}${metric.unit}`);
        }
      }
      const dur = Number(c.durationSec ?? 0);
      if (Number.isNaN(dur) || dur < 0) errors.push(`${label}：持续时间不能为负数`);
    });
    validateNotification(rule, errors);
    validateGovernance(rule, warnings, errors);
    warnDuplicate(rule, '组合', rule?.target, ctx, warnings);
    return { errors, warnings };
  }

  errors.push(`未知规则类型：${trigger.type}`);
  return { errors, warnings };

  // ---- 恢复条件校验（阈值类） ----
  function validateRecovery(rule2, trigger2, errs) {
    const recovery = rule2?.recoveryConfig;
    const rc = recovery?.condition || {};
    if (recovery?.mode && !['auto', 'business', 'manual'].includes(recovery.mode)) errs.push('恢复方式不合法');
    if (['rangeOut', 'rangeIn'].includes(trigger2.mode)) {
      const rc2 = rc.type === 'range' ? rc : null;
      if (!rc2) {
        errs.push('区间规则必须配置区间恢复带');
        return;
      }
      const rl = Number(rc2.recoveryLow ?? ((trigger2.low ?? 0) + Number(rc2.lowDeadband ?? 0)));
      const rh = Number(rc2.recoveryHigh ?? ((trigger2.high ?? 0) - Number(rc2.highDeadband ?? 0)));
      const tl = Number(trigger2.low); const th = Number(trigger2.high);
      if (Number.isNaN(rl) || Number.isNaN(rh)) {
        errs.push('区间恢复带必须为数值（直接指定或按独立回差计算）');
        return;
      }
      if (rl >= rh) errs.push('区间恢复带下限必须小于上限');
      if (!Number.isNaN(tl) && !Number.isNaN(th) && (rl < tl || rh > th)) {
        errs.push(`区间恢复带 ${rl} ~ ${rh} 必须落在触发区间 [${tl}, ${th}] 之内`);
      }
    } else {
      let recoveryValue = Number.NaN;
      if (rc.thresholdMode === 'deadband') {
        const deadband = Number(rc.deadband);
        if (Number.isNaN(deadband) || deadband < 0) errs.push('恢复回差必须 ≥ 0');
        else if (!Number.isNaN(Number(trigger2.threshold))) {
          recoveryValue = trigger2.mode === 'lower' ? Number(trigger2.threshold) + deadband : Number(trigger2.threshold) - deadband;
        }
      } else if (rc.recoveryValue !== null && rc.recoveryValue !== undefined && rc.recoveryValue !== '') {
        recoveryValue = Number(rc.recoveryValue);
        if (Number.isNaN(recoveryValue)) errs.push('恢复阈值必须为数值');
      }
      if (!Number.isNaN(Number(trigger2.threshold)) && !Number.isNaN(recoveryValue)) {
        if (trigger2.mode === 'upper' && recoveryValue >= Number(trigger2.threshold)) errs.push(`上限规则恢复阈值 ${recoveryValue} 必须低于触发阈值 ${trigger2.threshold}`);
        if (trigger2.mode === 'lower' && recoveryValue <= Number(trigger2.threshold)) errs.push(`下限规则恢复阈值 ${recoveryValue} 必须高于触发阈值 ${trigger2.threshold}`);
      } else if (!errs.some((e) => e.includes('回差'))) {
        errs.push('必须配置恢复阈值（直接指定或按回差计算）');
      }
    }
    const stSec = Number(recovery?.stabilize?.durationSec ?? 30);
    if (Number.isNaN(stSec) || stSec < 0) errs.push('恢复稳定时间不能为负数');
  }

  // ---- 通知校验 ----
  function validateNotification(rule2, errs) {
    const nc = rule2?.notificationConfig;
    if (!nc?.policyCode) errs.push('必须选择通知策略');
    if (nc && (!nc.receivers || nc.receivers.length === 0)) errs.push('通知接收人至少 1 人');
    if (nc && (!nc.channels || nc.channels.length === 0)) errs.push('通知渠道至少 1 个');
  }

  // ---- 治理参数校验（P2：规则级抑制 / 风暴 / 静默） ----
  function validateGovernance(rule2, warns, errs) {
    const sc = rule2?.suppressionConfig;
    if (sc) {
      const interval = Number(sc.remindIntervalMin ?? 5);
      if (Number.isNaN(interval) || interval < 1) errs.push('重复提醒间隔必须 ≥ 1 分钟');
    }
    const storm = rule2?.stormConfig;
    if (storm?.enabled) {
      const w = Number(storm.windowMin ?? 0);
      const m = Number(storm.maxEvents ?? 0);
      if (Number.isNaN(w) || w <= 0) errs.push('风暴统计窗口必须大于 0 分钟');
      if (Number.isNaN(m) || m < 1) errs.push('风暴事件上限必须 ≥ 1 条');
    }
    const silence = rule2?.silenceConfig;
    if (silence?.enabled && (silence.windows || []).length === 0) {
      warns.push('已启用规则级静默但未配置静默时段，将沿用通知策略中的静默设置');
    }
  }

  // ---- 同目标同类型重复（警告：批量提交时将跳过） ----
  function warnDuplicate(rule2, typeLabel, target, ctx2, warns) {
    const rules = Object.values(ctx2.alarmRulesById || {});
    const sameMetric = (r) => {
      if (typeLabel === '质量') return !r.target?.metricCode && r.target?.deviceId === target?.deviceId;
      return r.target?.metricCode === target?.metricCode;
    };
    const dup = rules.find((r) => r.code !== rule2?.code
      && r.type === typeLabel
      && ['草稿', '已发布'].includes(r.status)
      && r.target?.deviceId === target?.deviceId
      && sameMetric(r));
    if (dup) warns.push(`同目标已存在${typeLabel}规则 ${dup.code}（${dup.status}），发布前请确认是否重复`);
  }
}

// ---------- 样本判定（触发门禁） ----------
const invalidQuality = (sample) => ['BAD', 'OFFLINE'].includes(sample?.qualityCode);

export function sampleTriggered(triggerConfig, sample) {
  if (!triggerConfig || !sample) return false;
  if (triggerConfig.type === 'state') {
    const v = sample.value;
    if (v === null || v === undefined || v === '') return false;
    return (triggerConfig.abnormalValues || []).includes(String(v));
  }
  const v = sample.value;
  if (typeof v !== 'number' || Number.isNaN(v)) return false;
  if (invalidQuality(sample)) return false;
  if (triggerConfig.type !== 'threshold') return false;
  if (triggerConfig.mode === 'upper') return typeof triggerConfig.threshold === 'number' && v > triggerConfig.threshold;
  if (triggerConfig.mode === 'lower') return typeof triggerConfig.threshold === 'number' && v < triggerConfig.threshold;
  if (triggerConfig.mode === 'rangeOut') {
    return typeof triggerConfig.low === 'number' && typeof triggerConfig.high === 'number' && (v < triggerConfig.low || v > triggerConfig.high);
  }
  if (triggerConfig.mode === 'rangeIn') {
    return typeof triggerConfig.low === 'number' && typeof triggerConfig.high === 'number' && v >= triggerConfig.low && v <= triggerConfig.high;
  }
  return false;
}

// 质量规则触发判定：依据设备通信健康事实（不使用指标样本值）
export function qualityTriggerHit(triggerConfig, health) {
  if (!triggerConfig || triggerConfig.type !== 'quality' || !health) return false;
  if (triggerConfig.mode === 'outage') return health.status === '数据中断';
  if (triggerConfig.mode === 'delay') {
    return typeof health.latencySec === 'number' && typeof triggerConfig.delaySec === 'number' && health.latencySec > triggerConfig.delaySec;
  }
  if (triggerConfig.mode === 'invalidRate') {
    const rate = typeof health.qualityRate === 'string' ? parseFloat(health.qualityRate) : null;
    if (rate === null || Number.isNaN(rate)) return false;
    return (100 - rate) > Number(triggerConfig.invalidRatePercent ?? Infinity);
  }
  return false;
}

// 组合规则触发判定：conditionSamples 与 triggerConfig.conditions 一一对应
// samples: [{ deviceId, sourceId, metricCode, sample }]
export function comboTriggered(triggerConfig, conditionSamples) {
  if (!triggerConfig || triggerConfig.type !== 'combo') return false;
  const conditions = triggerConfig.conditions || [];
  if (conditions.length < 2 || !Array.isArray(conditionSamples)) return false;
  const hit = (cond) => {
    const provided = conditionSamples.find((s) => s.metricCode === cond.target?.metricCode
      && (!s.sourceId || !cond.target?.sourceId || s.sourceId === cond.target.sourceId));
    if (!provided) return null; // 缺样本：无法判定
    return sampleTriggered({
      type: 'threshold', mode: cond.operator === '<' ? 'lower' : 'upper',
      threshold: cond.value,
    }, provided.sample);
  };
  const results = conditions.map(hit);
  if (results.some((r) => r === null)) return null;
  return triggerConfig.operator === 'OR' ? results.some(Boolean) : results.every(Boolean);
}

// ---------- 恢复判定 ----------
export function sampleRecovered(recoveryConfig, sample) {
  if (!recoveryConfig || !sample) return false;
  const v = sample.value;
  if (v === null || v === undefined || v === '') return false;
  if (invalidQuality(sample)) return false;
  const c = recoveryConfig.condition || {};
  if (c.type === 'state') return (c.normalValues || []).includes(String(v));
  if (c.type === 'quality') return sample.qualityCode === (c.requiredQualityCode || 'GOOD');
  if (c.type === 'range') {
    if (typeof v !== 'number' || typeof c.recoveryLow !== 'number' || typeof c.recoveryHigh !== 'number') return false;
    return v >= c.recoveryLow && v <= c.recoveryHigh;
  }
  if (c.type === 'hysteresis') {
    if (typeof v !== 'number' || typeof c.recoveryValue !== 'number') return false;
    return c.direction === 'lower' ? v >= c.recoveryValue : v <= c.recoveryValue;
  }
  return false;
}

// 组合规则恢复：所有子条件样本均不处于触发态
export function comboRecovered(triggerConfig, conditionSamples) {
  if (!triggerConfig || triggerConfig.type !== 'combo') return false;
  const conditions = triggerConfig.conditions || [];
  if (!Array.isArray(conditionSamples) || conditionSamples.length < conditions.length) return false;
  return conditions.every((cond) => {
    const provided = conditionSamples.find((s) => s.metricCode === cond.target?.metricCode
      && (!s.sourceId || !cond.target?.sourceId || s.sourceId === cond.target.sourceId));
    if (!provided) return false;
    return !sampleTriggered({ type: 'threshold', mode: cond.operator === '<' ? 'lower' : 'upper', threshold: cond.value }, provided.sample);
  });
}

// ---------- 批量分组（M3） ----------
export function batchGroupKey(target) {
  return [
    target.metricCode,
    target.metric?.dataType || 'other',
    target.metric?.unit || '',
    target.metric?.range ? `${target.metric.range.min}:${target.metric.range.max}` : 'no-range',
    target.deviceModel || '--',
  ].join('|');
}

export function groupBatchTargets(targets) {
  const groups = new Map();
  targets.forEach((t) => {
    const key = batchGroupKey(t);
    if (!groups.has(key)) groups.set(key, { groupKey: key, targets: [] });
    groups.get(key).targets.push(t);
  });
  return [...groups.values()];
}

// ---------- 历史趋势回测（P2） ----------
// values: 按时间升序的样本值数组（stepSec 采样间隔）；无效点以 null 占位
// 返回 { points, hits, events, suppressed, dataStatus }：真实按触发配置回放，
// 持续时间按「连续命中点数 × 采样间隔 ≥ durationSec」判定，活动事件期间的后续命中计为抑制。
export function replayTrend(triggerConfig, values, { stepSec = 60 } = {}) {
  const points = Array.isArray(values) ? values : [];
  if (!triggerConfig || points.length === 0) {
    return { points: points.length, hits: 0, events: 0, suppressed: 0, dataStatus: '无历史趋势数据' };
  }
  const need = Math.max(1, Math.ceil((triggerConfig.durationSec ?? 0) / stepSec));
  let hits = 0;
  let events = 0;
  let consecutive = 0;
  let activeEvent = false;
  points.forEach((v) => {
    const ok = sampleTriggered(triggerConfig, { value: v, qualityCode: v === null ? 'BAD' : 'GOOD' });
    if (ok) {
      hits += 1;
      consecutive += 1;
      if (activeEvent) return; // 活动事件未关闭：抑制合并
      if (consecutive >= need) {
        events += 1;
        activeEvent = true;
      }
    } else {
      consecutive = 0;
      if (activeEvent) {
        // 恢复条件（简化：退出触发态即按稳定 1 点恢复，用于统计事件数）
        activeEvent = false;
      }
    }
  });
  return { points: points.length, hits, events, suppressed: hits - events, dataStatus: '已按当前配置回放' };
}
