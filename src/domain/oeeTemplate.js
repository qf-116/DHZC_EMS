// ============================================================
// OEE 映射模板领域规则（2026-11-05）
// 匹配顺序：同产品 + 同设备类型（精确）→ 同产品 + 全部类型（通用）→ 无模板。
// 同范围存在多个版本时取版本号最高的一条；停用模板不参与匹配。
// ============================================================

export const OEE_TEMPLATE_GENERIC_SCOPE = '全部';

export function matchOeeTemplates(templates = [], { product = null, deviceType = null } = {}) {
  return (templates || [])
    .filter((t) => t && t.status !== '停用')
    .filter((t) => (!product ? true : t.product === product))
    .filter((t) => (!deviceType || !t.deviceType
      ? true
      : t.deviceType === deviceType || t.deviceType === OEE_TEMPLATE_GENERIC_SCOPE))
    .sort((a, b) => {
      const aExact = deviceType && a.deviceType === deviceType ? 0 : 1;
      const bExact = deviceType && b.deviceType === deviceType ? 0 : 1;
      if (aExact !== bExact) return aExact - bExact;
      return (b.version || 0) - (a.version || 0);
    });
}

export function bestOeeTemplate(templates = [], { product = null, deviceType = null } = {}) {
  return matchOeeTemplates(templates, { product, deviceType })[0] || null;
}

// 模板 → 绑定 oee 配置（只带出取数映射与来源标记，enabled 由调用方决定）
export function templateOeeConfig(template, { enabled = true } = {}) {
  if (!template) return null;
  return {
    enabled,
    stateMetricCode: template.config?.stateMetricCode || null,
    reportMetricCode: template.config?.reportMetricCode || null,
    templateId: template.templateId,
    templateName: template.name,
    templateVersion: template.version,
    configSource: 'template',
  };
}

// 旧种子绑定没有 oee 字段时的默认配置（默认参与 OEE，取状态 + 报工事件）
export function oeeConfigOfBinding(binding) {
  if (binding?.oee) return binding.oee;
  if (!binding) return null;
  return {
    enabled: true,
    stateMetricCode: 'S.machine_state',
    reportMetricCode: 'E.production_report',
    configSource: 'default',
  };
}

export function oeeConfigSourceLabel(config) {
  const source = config?.configSource || (config?.templateId ? 'template' : 'manual');
  if (source === 'template') return { key: 'template', label: '产品模板', color: 'blue' };
  if (source === 'copy') return { key: 'copy', label: '设备复制', color: 'purple' };
  if (source === 'default') return { key: 'default', label: '默认配置', color: 'cyan' };
  return { key: 'manual', label: '设备覆盖', color: 'default' };
}
