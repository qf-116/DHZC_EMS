// ============================================================
// 报警规则领域层（纯 JS：结构化契约、校验、样本判定、批量分组）
// 依据 docs/报警规则配置与批量创建技术功能设计方案.md V1.2 §0.4 M0 契约：
// - 目标主键：deviceId(DEV-*) + bindingId/version + sourceId + metricCode/version
// - 新规则首次发布 V1，草稿保存不消耗版本号
// - 旧「程序/备件/点检/保养/维修」业务规则不映射为阈值规则（legacy 只读）
// - 指标元数据先归一化再比较，不直接比较展示字符串
// ============================================================

// 旧种子中的业务事件类规则：不映射为阈值规则，编辑入口只读（legacy adapter 之外的类型）
export const LEGACY_BUSINESS_RULE_TYPES = ['程序', '备件', '点检', '保养', '维修'];
export const RULE_TYPE_LABEL = { threshold: '阈值', state: '状态', quality: '质量', combo: '组合' };
// MVP 可编辑的触发模式：越上限 / 越下限（区间、状态、质量、组合均为 P2）
export const MVP_TRIGGER_MODES = ['upper', 'lower'];

// ---------- 指标元数据归一化（M0 契约 6） ----------
// 平台指标清单存在中文展示值（dataType='数值'）与字符串量程（range='0 ~ 150'），
// 批量分组与校验只能使用归一化结果。
export function normalizeMetricMeta(metric) {
  if (!metric) return null;
  const dataTypeMap = { '数值': 'number', '状态': 'state', '事件': 'event', number: 'number', state: 'state', enum: 'state' };
  let range = null;
  if (typeof metric.range === 'string') {
    const m = metric.range.match(/^(-?[\d.]+)\s*~\s*(-?[\d.]+)$/);
    if (m) range = { min: Number(m[1]), max: Number(m[2]) };
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
    precision: typeof metric.precision === 'number' ? metric.precision : null,
    syncStatus: metric.syncStatus || '正常',
  };
}

// ---------- canonical 目标解析 ----------
// 从 DemoStore 正式绑定事实解析可配置目标；停用绑定与失效指标不进入范围。
export function resolveRuleTargets(state) {
  const out = [];
  const bindings = state?.entities?.bindingsByDeviceId || {};
  const metricsByKey = state?.entities?.metricsByKey || {};
  const devicesById = state?.entities?.devicesById || {};
  Object.values(bindings).forEach((b) => {
    if (b.configStatus !== '已启用') return; // 默认排除停用绑定
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

// ---------- 表单模型（M1：受控表单唯一事实来源） ----------
export function createEmptyRuleForm() {
  return {
    code: null,
    name: '',
    type: 'threshold',          // MVP 仅 threshold 可新建；state/quality/combo 为 P2
    severity: '重要',
    description: '',
    cause: '',
    advice: '',
    target: { deviceId: null, sourceId: null, metricCode: null },
    triggerConfig: {
      type: 'threshold',
      mode: 'upper',            // MVP: upper | lower
      operator: '>',
      threshold: null,
      unit: null,
      durationSec: 60,
    },
    recoveryConfig: {
      mode: 'auto',             // MVP 仅 auto 可选；business/manual 为 P2
      closeMode: 'auto',
      condition: {
        type: 'hysteresis',
        direction: 'upper',
        thresholdMode: 'deadband', // deadband | explicit
        triggerValue: null,
        recoveryValue: null,
        deadband: 5,
        unit: null,
      },
      stabilize: { durationSec: 30, qualityRequired: 'GOOD', invalidDataPolicy: 'hold', rebreachPolicy: 'resetTimer' },
      notifyOnRecover: true,
    },
    notificationConfig: null,   // 由页面按「策略模板 + 临时调整」填充
    suppressionConfig: { mergeActiveEvent: true, countRepeatedTrigger: true, remindEnabled: true, remindIntervalMin: 5, maxRemindCount: null, createNewAfterClose: true },
    stormConfig: { enabled: true, windowMin: 60, maxEvents: 3, scope: 'sameRule', overflowAction: 'merge' },
    silenceConfig: { source: 'template', enabled: false, windows: [] },
    qualityPolicy: { badDataAction: 'hold', maxStaleSec: 0 },
    batchId: null,
    templateId: null,
    templateVersion: null,
  };
}

// 旧规则 → 表单：结构化字段优先，缺失时用 legacy adapter 解析；解析失败返回 null（页面转只读）
export function ruleToForm(rule) {
  const base = createEmptyRuleForm();
  if (!rule) return base;
  const trigger = rule.triggerConfig || parseLegacyCondition(rule);
  const form = {
    ...base,
    code: rule.code || null,
    name: rule.name || '',
    type: ({ 阈值: 'threshold', 状态: 'state', 质量: 'quality', 组合: 'combo' })[rule.type] || 'threshold',
    severity: rule.severity || '重要',
    description: rule.description || '',
    target: {
      deviceId: rule.target?.deviceId || null,
      sourceId: rule.target?.sourceId || null,
      metricCode: rule.target?.metricCode || rule.metricCode || null,
    },
    triggerConfig: trigger
      ? {
        type: 'threshold',
        mode: trigger.mode,
        operator: trigger.operator || (trigger.mode === 'lower' ? '<' : '>'),
        threshold: trigger.threshold ?? null,
        low: trigger.low ?? null,
        high: trigger.high ?? null,
        unit: trigger.unit || null,
        durationSec: trigger.durationSec ?? 60,
      }
      : base.triggerConfig,
    recoveryConfig: rule.recoveryConfig
      ? structuredClone(rule.recoveryConfig)
      : parseLegacyRecovery(rule) || base.recoveryConfig,
    notificationConfig: rule.notificationConfig || null,
  };
  if (form.recoveryConfig.condition) {
    form.recoveryConfig.condition.triggerValue = form.triggerConfig.threshold;
    form.recoveryConfig.condition.direction = form.triggerConfig.mode || 'upper';
    form.recoveryConfig.condition.unit = form.triggerConfig.unit || form.recoveryConfig.condition.unit;
  }
  return form;
}

// 表单 → 规则实体（含兼容展示字段；condition/recovery 仅为列表展示，不是唯一事实来源）
export function formToRule(form, extra = {}) {
  const triggerConfig = { ...form.triggerConfig };
  const recoveryConfig = structuredClone(form.recoveryConfig);
  // 恢复阈值在保存时按当前触发值/回差固化（deadband 模式推导 explicit 值，便于执行层直接判定）
  if (recoveryConfig.condition && recoveryConfig.condition.thresholdMode === 'deadband') {
    const t = Number(triggerConfig.threshold);
    const d = Number(recoveryConfig.condition.deadband);
    if (!Number.isNaN(t) && !Number.isNaN(d)) {
      const raw = triggerConfig.mode === 'lower' ? t + d : t - d;
      recoveryConfig.condition.recoveryValue = Math.round(raw * 1e10) / 1e10; // 消除浮点噪声（0.15+0.02）
    }
  }
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

// ---------- 展示文本由结构生成 ----------
export function conditionTextOf(triggerConfig) {
  if (!triggerConfig) return '--';
  const u = triggerConfig.unit || '';
  const dur = triggerConfig.durationSec ?? 0;
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
  if (c.type === 'hysteresis' && typeof c.recoveryValue === 'number') {
    const op = (c.direction || triggerConfig?.mode) === 'lower' ? '>=' : '<=';
    return `自动恢复：${op} ${c.recoveryValue}${c.unit || ''} 持续 ${dur}s`;
  }
  return '自动恢复';
}

// ---------- legacy adapter（M0 契约 5/7） ----------
// 仅解析「阈值」类旧规则的 condition/recoverCondition 展示文本；
// 程序/备件等业务规则不解析、不映射，保持只读。
export function parseLegacyCondition(rule) {
  if (!rule || rule.type !== '阈值') return null;
  const cond = String(rule.condition || '');
  const durM = cond.match(/持续\s*(\d+)\s*s/);
  const durationSec = durM ? Number(durM[1]) : 0;
  const unitM = cond.match(/(℃|MPa|mm\/s|rpm|%|A)/);
  const unit = unitM ? unitM[1] : '';
  const rangeM = cond.match(/区间外\s*(-?[\d.]+)\s*~\s*(-?[\d.]+)/);
  if (rangeM) {
    return { type: 'threshold', mode: 'rangeOut', low: Number(rangeM[1]), high: Number(rangeM[2]), unit, durationSec, legacyParsed: true };
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
  if (!rule || rule.type !== '阈值') return null;
  const s = String(rule.recoverCondition || '');
  if (!s) return null;
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

// 旧规则结构归一化：业务事件类标记 legacyOnly；阈值类补齐结构化字段与发布版本指针。
// 用于种子装配与 STORE_VERSION 迁移，不改变任何展示字段。
export function normalizeLegacyRule(rule) {
  if (!rule || typeof rule !== 'object') return rule;
  const out = { ...rule };
  if (LEGACY_BUSINESS_RULE_TYPES.includes(out.type)) {
    out.legacyOnly = true;
  }
  if (out.status === '已发布' && !out.publishedVersion) out.publishedVersion = out.version || null;
  if (out.type === '阈值' && !out.triggerConfig) {
    const trigger = parseLegacyCondition(out);
    if (trigger) out.triggerConfig = trigger;
    if (!out.recoveryConfig) {
      const recovery = parseLegacyRecovery(out);
      if (recovery) {
        if (trigger) {
          recovery.condition.triggerValue = trigger.mode === 'rangeOut' ? null : trigger.threshold;
          recovery.condition.direction = trigger.mode === 'lower' ? 'lower' : 'upper';
        }
        out.recoveryConfig = recovery;
      }
    }
  }
  return out;
}

// ---------- 版本号契约（M0 契约 4） ----------
// 新规则首次发布 V1；已发布规则每次发布递增；草稿保存不消耗版本号。
export function nextPublishVersion(publishedVersion) {
  if (!publishedVersion) return 'V1';
  const n = Number(String(publishedVersion).replace(/\D/g, '')) || 0;
  return `V${n + 1}`;
}

// ---------- 规则草稿校验（MVP：数值阈值 upper/lower） ----------
// ctx: { devicesById, bindingsByDeviceId, metricsByKey, alarmRulesById }
export function validateRuleDraft(rule, ctx = {}) {
  const errors = [];
  const warnings = [];
  const name = (rule?.name || '').trim();
  if (name.length < 2 || name.length > 100) errors.push('规则名称必填且为 2~100 字');
  if (!rule?.code) errors.push('规则编号缺失');

  const trigger = rule?.triggerConfig;
  if (!trigger || trigger.type !== 'threshold') {
    errors.push('MVP 仅支持数值阈值规则（越上限/越下限）');
    return { errors, warnings };
  }
  if (!['upper', 'lower'].includes(trigger.mode)) {
    errors.push('触发模式仅支持越上限/越下限（区间/状态/质量/组合为 P2）');
  }
  const threshold = Number(trigger.threshold);
  if (trigger.threshold === null || trigger.threshold === undefined || trigger.threshold === '' || Number.isNaN(threshold)) {
    errors.push('触发阈值必填且为数值');
  }
  const durationSec = Number(trigger.durationSec ?? 0);
  if (Number.isNaN(durationSec) || durationSec < 0) errors.push('触发持续时间不能为负数');
  if (durationSec === 0) warnings.push('持续时间为 0 将立即触发，仅建议状态类使用；模拟量建议 ≥ 1 秒');

  // 目标校验：canonical 目标必须指向存在设备 + 启用绑定 + 启用指标
  const target = rule?.target;
  const devicesById = ctx.devicesById || {};
  const bindingsByDeviceId = ctx.bindingsByDeviceId || {};
  const metricsByKey = ctx.metricsByKey || {};
  if (!target?.deviceId) {
    errors.push('必须选择规则目标设备');
  } else {
    if (!devicesById[target.deviceId]) errors.push(`目标设备 ${target.deviceId} 不存在`);
    const binding = bindingsByDeviceId[target.deviceId];
    if (!binding) errors.push(`设备 ${target.deviceId} 尚未创建绑定`);
    else if (binding.configStatus !== '已启用') errors.push(`设备 ${target.deviceId} 绑定当前状态「${binding.configStatus}」，必须为已启用`);
    if (!target.metricCode) errors.push('必须选择规则目标指标');
    else {
      const stillBound = binding
        ? (binding.items || []).some((i) => i.enabled && (i.metrics || []).some((m) => m.selected && m.metricCode === target.metricCode))
        : false;
      if (!stillBound) errors.push(`指标 ${target.metricCode} 未在设备当前启用绑定中`);
      const metric = normalizeMetricMeta(metricsByKey[target.metricCode]);
      if (!metric) errors.push(`指标 ${target.metricCode} 不在平台指标清单中`);
      else {
        if (metric.syncStatus === '已失效') errors.push(`指标 ${metric.name} 已失效，不能参与报警规则`);
        if (metric.dataType !== 'number') errors.push('数值阈值规则仅适用于数值型指标');
        // 阈值必须在量程内（超出即阻断；量程缺失仅警告）
        if (!Number.isNaN(threshold) && metric.range) {
          if (threshold < metric.range.min || threshold > metric.range.max) {
            errors.push(`触发阈值 ${threshold}${metric.unit} 超出指标量程 ${metric.range.min} ~ ${metric.range.max}${metric.unit}`);
          }
        } else if (!metric.range) {
          warnings.push('指标缺少结构化量程，无法校验阈值是否超量程');
        }
      }
    }
  }

  // 恢复配置校验：恢复值必须在触发值的正确侧
  const recovery = rule?.recoveryConfig;
  const rc = recovery?.condition || {};
  let recoveryValue = Number.NaN;
  if (rc.thresholdMode === 'deadband') {
    const deadband = Number(rc.deadband);
    if (Number.isNaN(deadband) || deadband < 0) errors.push('恢复回差必须 ≥ 0');
    else if (!Number.isNaN(threshold)) {
      recoveryValue = trigger.mode === 'lower' ? threshold + deadband : threshold - deadband;
    }
  } else if (rc.recoveryValue !== null && rc.recoveryValue !== undefined && rc.recoveryValue !== '') {
    recoveryValue = Number(rc.recoveryValue);
    if (Number.isNaN(recoveryValue)) errors.push('恢复阈值必须为数值');
  }
  if (!Number.isNaN(threshold) && !Number.isNaN(recoveryValue)) {
    if (trigger.mode === 'upper' && recoveryValue >= threshold) errors.push(`上限规则恢复阈值 ${recoveryValue} 必须低于触发阈值 ${threshold}`);
    if (trigger.mode === 'lower' && recoveryValue <= threshold) errors.push(`下限规则恢复阈值 ${recoveryValue} 必须高于触发阈值 ${threshold}`);
  } else if (!errors.some((e) => e.includes('回差'))) {
    errors.push('必须配置恢复阈值（直接指定或按回差计算）');
  }
  const stSec = Number(recovery?.stabilize?.durationSec ?? 30);
  if (Number.isNaN(stSec) || stSec < 0) errors.push('恢复稳定时间不能为负数');

  // 通知配置校验
  const nc = rule?.notificationConfig;
  if (!nc?.policyCode) errors.push('必须选择通知策略');
  if (nc && (!nc.receivers || nc.receivers.length === 0)) errors.push('通知接收人至少 1 人');
  if (nc && (!nc.channels || nc.channels.length === 0)) errors.push('通知渠道至少 1 个');

  // 同目标同类型重复规则（警告：批量提交时将跳过）
  const rules = Object.values(ctx.alarmRulesById || {});
  const dup = rules.find((r) => r.code !== rule?.code
    && r.type === '阈值'
    && ['草稿', '已发布'].includes(r.status)
    && r.target?.deviceId === target?.deviceId
    && r.target?.metricCode === target?.metricCode);
  if (dup) warnings.push(`同目标已存在规则 ${dup.code}（${dup.status}），发布前请确认是否重复`);

  return { errors, warnings };
}

// ---------- 样本判定（M2 触发/恢复门禁） ----------
// 返回 false 表示样本不满足条件或数据无效（null/BAD/OFFLINE），执行层不得据此实例化或恢复事件。
export function sampleTriggered(triggerConfig, sample) {
  if (!triggerConfig || triggerConfig.type !== 'threshold' || !sample) return false;
  const v = sample.value;
  if (typeof v !== 'number' || Number.isNaN(v)) return false;
  if (['BAD', 'OFFLINE'].includes(sample.qualityCode)) return false;
  if (triggerConfig.mode === 'upper') return typeof triggerConfig.threshold === 'number' && v > triggerConfig.threshold;
  if (triggerConfig.mode === 'lower') return typeof triggerConfig.threshold === 'number' && v < triggerConfig.threshold;
  return false; // rangeOut/rangeIn 为 P2
}

export function sampleRecovered(recoveryConfig, sample) {
  if (!recoveryConfig || !sample) return false;
  const v = sample.value;
  if (typeof v !== 'number' || Number.isNaN(v)) return false;
  if (['BAD', 'OFFLINE'].includes(sample.qualityCode)) return false;
  const c = recoveryConfig.condition || {};
  if (c.type !== 'hysteresis' || typeof c.recoveryValue !== 'number') return false;
  return c.direction === 'lower' ? v >= c.recoveryValue : v <= c.recoveryValue;
}

// ---------- 批量分组（M3） ----------
// 同组 = 同 canonical 指标模板 + 数据类型 + 单位 + 量程 + 设备型号（方案 §10.3）
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
