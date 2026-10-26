// ============================================================
// IoT 绑定领域层（纯 JS：绑定状态机与校验；§6.1）
// ============================================================

import { BINDING_CONFIG_STATUS } from './device.js';

// 绑定状态机：待配置 → 草稿 → 校验通过 → 待生效 → 已启用 →（已停用 / 换绑中）
// 来源设备不再区分主/子角色：设备先选、IoT 来源可多个、来源间平级（2026-09 流程调整）。
export const BINDING_TRANSITIONS = {
  '未配置': ['草稿'],
  '草稿': ['校验中', '已停用'],
  '校验中': ['校验通过', '草稿'],
  '校验通过': ['待生效', '草稿'],
  '待生效': ['已启用', '草稿'],
  '已启用': ['已停用', '换绑中'],
  '换绑中': ['已启用', '已停用'],
  '已停用': ['草稿'],
};

export function canTransitionBinding(from, to) {
  return (BINDING_TRANSITIONS[from] || []).includes(to);
}

// 校验一条绑定草稿：至少 1 个启用项、同一绑定内来源编码不重复。
// 说明：① IoT 来源编码被其它设备占用仅作提示、不作为限制条件（业务允许多台设备绑定同一来源）；
// ② 2026-10 口径调整：绑定即接入该来源上报的全部指标并存储（指标自动发现，不在绑定时人工勾选），
//    因此绑定校验不再要求选择指标；监控指标（曲线呈现）在「监控指标配置」中按需勾选，可以不选。
// ctx: { sourceDevicesById, metricsByKey }
export function validateBindingDraft(draft, ctx = {}) {
  const errors = [];
  const items = draft.items || [];
  const enabled = items.filter(i => i.enabled);
  if (enabled.length === 0) errors.push('至少保留一个启用的 IoT 来源设备');
  const codes = enabled.map(i => i.iotDeviceCode);
  if (new Set(codes).size !== codes.length) errors.push('同一绑定内 IoT 来源编码重复');
  return { ok: errors.length === 0, errors };
}

// 影响范围：绑定变更影响报警规则、监测、OEE 与报表（供 saveBinding 反馈展示）
export function bindingImpact(binding) {
  if (!binding) return { devices: 0, domains: [] };
  return {
    devices: 1,
    domains: ['数据接入', '运行监测', '报警中心', 'OEE', '报表', '大屏'],
    description: `绑定版本 v${binding.version} 变更将影响该设备的实时监测、指标报警判定、OEE 计算与报表统计`,
  };
}
