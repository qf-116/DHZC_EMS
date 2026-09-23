import React from 'react';
import { Card, Table, Tag, Button, Space, Select, App, Input, InputNumber, Switch, Alert, Modal, Statistic, Tooltip, Cascader, Checkbox, Radio } from 'antd';
import { Plus, TestTube2, Zap, Info, Copy, Layers } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../components/PageHeader.jsx';
import { metricAlarmTemplates, ruleTemplates, notificationRows } from '../data/demoData.js';
import { useDemoState, useDemoActions } from '../state/DemoStore.jsx';
import {
  resolveRuleTargets, createEmptyRuleForm, ruleToForm, formToRule, switchRuleFormType,
  validateRuleDraft, conditionTextOf, recoveryTextOf, replayTrend, ruleGroupInfo,
  LEGACY_BUSINESS_RULE_TYPES, NUMERIC_TRIGGER_MODES,
} from '../domain/alarmRule.js';
import RuleBatchModal from '../components/RuleBatchModal.jsx';

// 报警规则配置 V4（方案 V1.2 M1-M4）：
// - 受控表单统一模型（createEmptyRuleForm / ruleToForm / formToRule），保存内容全部来自表单状态；
// - 规则目标使用 DemoStore 正式绑定事实（canonical deviceId + sourceId + metricCode），
//   不再读取 standardData 静态绑定；
// - 原子「保存并发布」（单个 reducer 动作，发布失败弹窗保留、草稿不丢失）；
// - MVP 仅开放数值阈值（越上限/越下限）；区间/状态/质量/组合为 P2，
//   治理参数（抑制/风暴/静默）保留展示但标注演示占位；
// - 批量新建：同类指标逐目标预览，只生成草稿（见 RuleBatchModal）。
const hint = { fontSize: 12, color: '#5d6b78', lineHeight: 1.7 };

const InfoTip = ({ text }) => (
  <Tooltip title={<div style={{ maxWidth: 320, lineHeight: 1.7 }}>{text}</div>}>
    <Info size={13} style={{ color: '#8a97a3', cursor: 'help', verticalAlign: '-2px', marginLeft: 4 }} />
  </Tooltip>
);

const PolicyField = ({ label, children }) => (
  <div>
    <div style={{ fontSize: 12, color: '#5d6b78', marginBottom: 4 }}>{label}</div>
    {children}
  </div>
);

const RULE_TYPE_LABEL = { threshold: '阈值规则', state: '状态规则', quality: '质量规则', combo: '组合规则' };

// 静默窗口展示文本
const silenceText = (windows) => (windows || []).map((w) => `${w.start}-${w.end}`).join('、') || '';

export default function RuleConfigPage() {
  const { message, modal } = App.useApp();
  const navigate = useNavigate();
  const state = useDemoState();
  const actions = useDemoActions();
  const E = state.entities;

  const [open, setOpen] = React.useState(false);
  const [editing, setEditing] = React.useState(null);          // 编辑中的规则（新增为 null）
  const [form, setForm] = React.useState(() => createEmptyRuleForm());
  const [testOpen, setTestOpen] = React.useState(false);
  const [testRule, setTestRule] = React.useState(null);
  const [batchOpen, setBatchOpen] = React.useState(false);
  const [importedTpl, setImportedTpl] = React.useState(null);
  const [saveTplOpen, setSaveTplOpen] = React.useState(false);
  const [saveTplName, setSaveTplName] = React.useState('');
  const [saveTplScope, setSaveTplScope] = React.useState('');
  // 查询条件 + 勾选批量编辑
  const [qKw, setQKw] = React.useState('');
  const [qType, setQType] = React.useState(null);
  const [qStatus, setQStatus] = React.useState(null);
  const [qGroup, setQGroup] = React.useState(null);
  const [selectedRowKeys, setSelectedRowKeys] = React.useState([]);
  const [beOpen, setBeOpen] = React.useState(false);
  const [beForm, setBeForm] = React.useState({});

  // canonical 目标（启用绑定 + 勾选指标 + 未失效），级联与展示都从这里取
  const targets = React.useMemo(() => resolveRuleTargets(state), [state]);
  const cascadeOptions = React.useMemo(() => {
    const devMap = new Map();
    targets.forEach((t) => {
      if (!devMap.has(t.deviceId)) devMap.set(t.deviceId, { value: t.deviceId, label: `${t.deviceId} ${t.deviceName}`, children: new Map() });
      const dev = devMap.get(t.deviceId);
      if (!dev.children.has(t.sourceId)) {
        dev.children.set(t.sourceId, { value: t.sourceId, label: `${t.sourceCode}${t.sourceRole === 'main' ? '（主设备）' : `（子设备 · ${t.sensorType}）`}`, children: [] });
      }
      dev.children.get(t.sourceId).children.push({ value: t.metricCode, label: `${t.metricCode} ${t.metric.name}` });
    });
    return [...devMap.values()].map((d) => ({ value: d.value, label: d.label, children: [...d.children.values()] }));
  }, [targets]);
  const currentTarget = React.useMemo(
    () => targets.find((t) => t.deviceId === form.target.deviceId && t.sourceId === form.target.sourceId && t.metricCode === form.target.metricCode) || null,
    [targets, form.target]
  );
  // 状态规则级联：仅状态类 S.* 指标；质量规则：仅选设备（监控数据链路，不需要指标）
  const cascadeStateOptions = React.useMemo(() => cascadeOptions
    .map((d) => ({ ...d, children: d.children
      .map((s) => ({ ...s, children: s.children.filter((m) => m.value.startsWith('S.')) }))
      .filter((s) => s.children.length > 0) }))
    .filter((d) => d.children.length > 0), [cascadeOptions]);
  const deviceOptions = React.useMemo(() => {
    const seen = new Map();
    targets.forEach((t) => { if (!seen.has(t.deviceId)) seen.set(t.deviceId, { value: t.deviceId, label: `${t.deviceId} ${t.deviceName}` }); });
    return [...seen.values()];
  }, [targets]);
  const enumOptions = React.useMemo(
    () => (currentTarget?.metric?.enumValues || []).map((v) => ({ value: v, label: v })),
    [currentTarget]
  );

  // 通知策略 = 模板 + 临时调整（仅本规则生效，不回写策略本体）
  const peopleOptions = ['李明', '王强', '赵艳', '陈晨', '张伟', '王建国', '吴敏'].map((v) => ({ value: v, label: v }));
  const policyTplOf = (code) => notificationRows.find((n) => n.code === code) || notificationRows[1];
  const draftFromTpl = (n) => ({
    channels: n.channels.split(' / '),
    receivers: n.receivers.split('、'),
    first: n.first,
    interval: n.interval,
    escalation: n.escalation,
    silent: n.silent === '无' ? '' : n.silent,
    retries: n.retries,
  });
  const [policyCode, setPolicyCode] = React.useState('NP-IMPORTANT');
  const [policyDraft, setPolicyDraft] = React.useState(() => draftFromTpl(policyTplOf('NP-IMPORTANT')));
  const changePolicy = (code) => {
    setPolicyCode(code);
    setPolicyDraft(draftFromTpl(policyTplOf(code)));
    message.info('已按所选策略模板重新带出通知配置，可临时调整（仅本规则生效）');
  };
  const resetPolicy = () => {
    setPolicyDraft(draftFromTpl(policyTplOf(policyCode)));
    message.success('已恢复为策略模板默认内容');
  };
  const curTpl = policyTplOf(policyCode);
  const policyModified = JSON.stringify(policyDraft) !== JSON.stringify(draftFromTpl(curTpl));

  const patch = (p) => setForm((f) => ({ ...f, ...p }));
  const patchTrigger = (p) => setForm((f) => ({ ...f, triggerConfig: { ...f.triggerConfig, ...p } }));
  const patchRecoveryCondition = (p) => setForm((f) => ({ ...f, recoveryConfig: { ...f.recoveryConfig, condition: { ...f.recoveryConfig.condition, ...p } } }));
  // 规则类型切换：重建触发/恢复结构（质量规则不需要指标目标；P2 开放区间/状态/质量/组合）
  const changeRuleType = (t) => {
    setImportedTpl(null);
    setForm((f) => switchRuleFormType(f, t));
  };

  // legacy 判定：业务事件类规则（程序/备件等）或无法解析出结构化触发的旧规则 → 只读查看。
  // P2 起区间/状态/质量/组合均可结构化编辑（种子规则已由 normalizeLegacyRule 补齐结构）。
  const legacyLocked = React.useMemo(() => {
    if (!editing) return false;
    if (LEGACY_BUSINESS_RULE_TYPES.includes(editing.type)) return true;
    return !editing.triggerConfig;
  }, [editing]);
  const editingFromDraft = !!(editing?.draftConfig);

  const openCreate = () => {
    setEditing(null);
    setImportedTpl(null);
    setForm(createEmptyRuleForm());
    const pc = 'NP-IMPORTANT';
    setPolicyCode(pc); setPolicyDraft(draftFromTpl(policyTplOf(pc)));
    setOpen(true);
  };
  const openEdit = (r) => {
    setEditing(r);
    setImportedTpl(null);
    // 待发布草稿优先回填；legacy 规则经 adapter 解析，解析不出则保持默认并只读展示
    const src = r.draftConfig || r;
    setForm(ruleToForm(src));
    const nc = src.notificationConfig;
    const pc = nc?.policyCode || r.policyCode || 'NP-IMPORTANT';
    setPolicyCode(pc);
    setPolicyDraft(nc ? { channels: nc.channels || ['站内'], receivers: nc.receivers || [], first: nc.first || '立即', interval: nc.interval || '5 分钟', escalation: nc.escalation || '无', silent: nc.silent || '', retries: nc.retries ?? 1 } : draftFromTpl(policyTplOf(pc)));
    setOpen(true);
  };
  const [testForm, setTestForm] = React.useState(null);
  const openTest = (r, cfgForm) => {
    setTestRule(r);
    // 回测使用当前表单配置（未保存也可）；列表入口使用该规则当前生效/草稿配置
    setTestForm(formToRule(cfgForm || ruleToForm(r.draftConfig || r)));
    setTestOpen(true);
  };
  // 真实回测（P2）：按触发配置对目标指标最近趋势采样点回放（60s 间隔），
  // 持续时间 / 无效数据 / 抑制口径与执行层一致；无趋势数据时退回种子统计并明示。
  const backtest = React.useMemo(() => {
    if (!testRule || !testForm) return null;
    const key = `${testForm.target?.deviceId}|${testForm.target?.metricCode}`;
    const values = state.entities.trends[key];
    const replay = replayTrend(testForm.triggerConfig, Array.isArray(values) ? values : [], { stepSec: 60 });
    return { key, hasTrend: Array.isArray(values) && values.length > 0, replay };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [testRule, testForm, state.entities.trends]);

  // 指标特征模板：选择数值指标后自动带出推荐判定模式与参数（用户可修改；仅阈值规则应用）
  const applyMetricTemplate = (metricCode) => {
    const t = metricAlarmTemplates[metricCode];
    if (!t || form.type !== 'threshold') return;
    patch({
      triggerConfig: { ...form.triggerConfig, mode: t.mode === 'lower' ? 'lower' : 'upper', threshold: t.threshold ?? null, durationSec: t.duration ?? 60 },
      recoveryConfig: { ...form.recoveryConfig, condition: { ...form.recoveryConfig.condition, deadband: t.deadband ?? 5 } },
    });
  };

  const changeTarget = ([deviceId, sourceId, metricCode]) => {
    const t = targets.find((x) => x.deviceId === deviceId && x.sourceId === sourceId && x.metricCode === metricCode) || null;
    patch({ target: { deviceId: deviceId || null, sourceId: sourceId || null, metricCode: metricCode || null } });
    if (metricCode && !importedTpl) applyMetricTemplate(metricCode);
    // 名称自动建议（留空时）
    if (t && !form.name.trim()) {
      patch({ target: { deviceId, sourceId, metricCode }, name: `${t.deviceName}${t.metric.name}${(metricAlarmTemplates[metricCode]?.mode) === 'lower' ? '过低' : '超限'}报警` });
    }
  };

  // 从规则模板导入参数（P2 模板持久化：模板实体存于 DemoStore，应用 = 参数整体带入，可修改）
  const applyRuleTemplate = (templateId) => {
    const t = Object.values(state.entities.ruleTemplatesById || {}).find((x) => x.templateId === templateId);
    if (!t) { setImportedTpl(null); return; }
    setImportedTpl(t);
    setForm((f) => ({
      ...f,
      triggerConfig: structuredClone(t.triggerConfig),
      recoveryConfig: structuredClone(t.recoveryConfig),
      suppressionConfig: t.suppressionConfig ? structuredClone(t.suppressionConfig) : f.suppressionConfig,
      stormConfig: t.stormConfig ? structuredClone(t.stormConfig) : f.stormConfig,
      silenceConfig: t.silenceConfig ? structuredClone(t.silenceConfig) : f.silenceConfig,
      templateId: t.templateId,
      templateVersion: null,
    }));
    const nc = t.notificationConfig;
    if (nc?.policyCode) {
      setPolicyCode(nc.policyCode);
      setPolicyDraft({ channels: nc.channels || ['站内'], receivers: nc.receivers || [], first: nc.first || '立即', interval: nc.interval || '5 分钟', escalation: nc.escalation || '无', silent: nc.silent || '', retries: nc.retries ?? 1 });
    }
    message.success(`已从模板「${t.name}」导入参数（触发/恢复/通知/治理），请继续选择目标（个别目标可微调）`);
  };
  // 存为模板（P2 模板持久化）：写入 DemoStore 模板实体，不包含设备目标
  const submitSaveTemplate = () => {
    const name = (saveTplName || '').trim();
    if (name.length < 2) { message.warning('模板名称至少 2 个字'); return; }
    const rule = buildRule();
    const res = actions.saveRuleTemplate({
      name,
      metricType: saveTplScope || currentTarget?.metric?.name || '通用指标',
      applicableMetricCodes: form.target.metricCode ? [form.target.metricCode] : [],
      status: '启用',
      remark: `由规则 ${form.code || '（新建）'} 配置沉淀于 ${state.meta.demoDay}`,
      triggerConfig: rule.triggerConfig,
      recoveryConfig: rule.recoveryConfig,
      notificationConfig: rule.notificationConfig,
      suppressionConfig: rule.suppressionConfig,
      stormConfig: rule.stormConfig,
      silenceConfig: rule.silenceConfig,
    });
    if (!res.ok) { message.error(res.message); return; }
    message.success(res.message);
    setSaveTplOpen(false);
    setSaveTplName('');
    setSaveTplScope('');
  };

  // 客户端预校验（与 reducer 同一领域函数）：阻断错误红色展示，发布前必须清零
  const buildRule = () => {
    const rule = formToRule(form, { code: form.code || nextRuleCode() });
    // 通知策略 = 模板 + 临时调整，随规则完整落库（M0 契约：不得只保存 policyCode）
    rule.notificationConfig = {
      policyCode,
      policyName: curTpl.name,
      overridden: policyModified,
      channels: [...policyDraft.channels],
      receivers: [...policyDraft.receivers],
      first: policyDraft.first,
      interval: policyDraft.interval,
      escalation: policyDraft.escalation,
      silent: policyDraft.silent,
      retries: policyDraft.retries,
    };
    rule.policyCode = policyCode;
    return rule;
  };
  const nextRuleCode = () => `R-NEW-${String(Object.keys(E.alarmRulesById).length + 1).padStart(3, '0')}`;
  const validation = React.useMemo(() => {
    if (!open || legacyLocked) return { errors: [], warnings: [] };
    return validateRuleDraft(buildRule(), {
      devicesById: E.devicesById, bindingsByDeviceId: E.bindingsByDeviceId, metricsByKey: E.metricsByKey, alarmRulesById: E.alarmRulesById,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form, open, legacyLocked, policyDraft, policyCode]);

  const saveRule = ({ publish = false } = {}) => {
    const rule = buildRule();
    const res = publish ? actions.saveAndPublishRule(rule) : actions.saveRuleDraft(rule);
    if (!res.ok) {
      // 保存/发布失败：弹窗与表单内容保留，用户可修正后重试
      message.error(res.message);
      return;
    }
    message.success(res.message);
    setOpen(false);
  };
  const confirmPublish = () => {
    if (editing?.status === '已发布') {
      const fromV = editing.publishedVersion || editing.version;
      modal.confirm({
        title: '发布新版本',
        content: `规则「${editing.code}」当前发布版本 ${fromV}，发布后历史报警仍按原版本快照解释，新报警按新版本判定。`,
        okText: '发布新版本', cancelText: '取消',
        onOk: () => saveRule({ publish: true }),
      });
      return;
    }
    saveRule({ publish: true });
  };
  const copyConfig = async () => {
    const json = JSON.stringify(buildRule(), null, 2);
    try {
      await navigator.clipboard.writeText(json);
      message.success('当前规则配置 JSON 已复制到剪贴板（模板持久化为 P2，可先粘贴复用）');
    } catch {
      Modal.info({ title: '规则配置 JSON', width: 560, content: <pre style={{ maxHeight: 320, overflow: 'auto', fontSize: 12 }}>{json}</pre> });
    }
  };

  // 批量发布（P2）：批次内草稿逐条发布（独立校验与版本快照，部分成功语义）
  const confirmBatchPublish = (batch) => {
    const draftCount = Object.values(E.alarmRulesById).filter((x) => x.batchId === batch.batchId && x.status === '草稿').length;
    modal.confirm({
      title: '批量发布批次草稿',
      content: `批次「${batch.batchId}」内有 ${draftCount} 条草稿规则，发布后每条生成独立版本快照并开始判定报警；校验失败的条目将保留原因不发布。确认发布？`,
      okText: '批量发布', cancelText: '取消',
      onOk: () => {
        const res = actions.publishBatch(batch.batchId);
        message[res.ok ? 'success' : 'error'](res.message);
      },
    });
  };

  const confirmStop = (r) => modal.confirm({
    title: '停用报警规则',
    content: `确定停用报警规则「${r.name}（${r.code}）」吗？停用后不再触发新报警，历史报警与版本快照保留。`,
    okText: '停用', cancelText: '取消',
    onOk: () => {
      const res = actions.disableRule(r.code);
      message[res.ok ? 'success' : 'error'](res.message);
    },
  });

  // 列表读模型：chain 由 canonical 目标生成；legacy 规则回退 deviceScope + metricCode；
  // 分组列 = 指标 + 数据类型 + 单位 + 量程 + 设备型号（与批量创建/批量编辑同组口径）
  const allRows = Object.values(E.alarmRulesById).map((r) => {
    const deviceName = r.target?.deviceId ? E.devicesById[r.target.deviceId]?.name || r.target.deviceId : null;
    const chain = r.target
      ? [`${r.target.deviceId} ${deviceName || ''}`.trim(), r.target.sourceCode || r.target.sourceId || '--', r.target.metricCode]
      : [r.deviceScope || '--', r.metricCode || '--'];
    const group = ruleGroupInfo(r, targets);
    return {
      ...r,
      chain,
      groupKey: group?.groupKey || null,
      groupLabel: group?.label || null,
      versionText: r.status === '已发布' ? `${r.publishedVersion || r.version}${r.draftConfig ? '（有待发布草稿）' : ''}` : r.version || '待发布',
    };
  });
  // 分组色板：同组同色
  const groupKeys = [...new Set(allRows.map((r) => r.groupKey).filter(Boolean))].sort();
  const GROUP_COLORS = ['blue', 'cyan', 'geekblue', 'purple', 'magenta', 'orange'];
  const groupColorOf = (key) => GROUP_COLORS[Math.max(0, groupKeys.indexOf(key)) % GROUP_COLORS.length];
  // 查询条件（前端过滤，演示数据量级适用）
  const kw = qKw.trim();
  const rows = allRows.filter((r) => {
    if (kw && ![r.code, r.name, r.metricCode, r.target?.deviceId].some((v) => String(v || '').includes(kw))) return false;
    if (qType && r.type !== qType) return false;
    if (qStatus && r.status !== qStatus) return false;
    if (qGroup && r.groupKey !== qGroup) return false;
    return true;
  });
  // 勾选批量编辑：同分组（≥2 条）才可编辑；无分组（旧结构）不可勾入
  const selectedRules = selectedRowKeys.map((k) => allRows.find((r) => r.code === k)).filter(Boolean);
  const selectedGroupKeys = [...new Set(selectedRules.map((r) => r.groupKey))];
  const selectionReady = selectedRules.length >= 2 && selectedGroupKeys.length === 1 && selectedGroupKeys[0] !== null;
  const selectionHint = selectedRules.length === 0 ? ''
    : selectedRules.some((r) => !r.groupKey) ? '已选含不可分组规则（旧结构），不能批量编辑'
      : selectedGroupKeys.length > 1 ? `已选 ${selectedRules.length} 条，跨 ${selectedGroupKeys.length} 个分组，不能批量编辑`
        : `已选 ${selectedRules.length} 条，同分组「${selectedRules[0].groupLabel}」，可批量编辑`;
  const submitBatchEdit = () => {
    const patch = {};
    Object.entries(beForm).forEach(([k, v]) => { if (v !== null && v !== undefined && v !== '') patch[k] = v; });
    if (patch.policyCode) {
      const n = notificationRows.find((x) => x.code === patch.policyCode) || notificationRows[1];
      patch.notificationConfig = {
        policyCode: n.code, overridden: false,
        channels: n.channels.split(' / '), receivers: n.receivers.split('、'),
        first: n.first, interval: n.interval, escalation: n.escalation,
        silent: n.silent === '无' ? '' : n.silent, retries: n.retries,
      };
      delete patch.policyCode;
    }
    if (Object.keys(patch).length === 0) { message.warning('请至少填写一个要修改的字段'); return; }
    const res = actions.batchEditRules(selectedRowKeys, patch);
    if (!res.ok) { message.error(res.message); return; }
    message.success(res.message);
    setBeOpen(false);
    setBeForm({});
    const rowsRes = res.refs.rows || [];
    if (rowsRes.some((r) => r.result !== 'updated')) {
      Modal.info({
        title: '批量编辑结果（逐条）',
        width: 560,
        content: (
          <div style={{ fontSize: 13, lineHeight: 2 }}>
            {rowsRes.map((r) => (
              <div key={r.code}>· {r.code}：{r.result === 'updated' ? '✅' : r.result === 'failed' ? '❌' : '⏭'} {r.reason}</div>
            ))}
          </div>
        ),
      });
    }
    setSelectedRowKeys([]);
  };
  const chattering = rows.filter((r) => (r.supp7d || 0) > (r.trig7d || 0));
  const batches = Object.values(E.alarmBatchesById || {}).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

  return (
    <>
      <PageHeader title="报警规则配置" subtitle="规则目标 = 设备 → 子设备 → 指标（正式绑定事实）· 受控表单真实落库 · 原子保存并发布 · 首次发布 V1 · 已发布规则编辑生成待发布草稿 · 同类指标批量创建（只生成草稿）" />

      {chattering.length > 0 && (
        <Alert
          type="warning" showIcon icon={<Zap size={14} />}
          style={{ marginBottom: 12 }}
          message={`报警治理提示：${chattering.map((r) => `${r.name}（近7天触发 ${r.trig7d} 次、重复抑制 ${r.supp7d} 次）`).join('、')}。抑制次数高于触发次数说明值在阈值附近反复震荡，建议增大恢复回差或延长触发持续时间。`}
        />
      )}

      {/* 筛选卡（规范 §1/§4：查询条件独立在列表卡上方） */}
      <Card size="small" style={{ marginBottom: 12 }}>
        <Space wrap>
          <Input
            style={{ width: 240 }} allowClear
            placeholder="搜索：规则编号 / 名称 / 指标 / 设备"
            value={qKw} onChange={(e) => setQKw(e.target.value)}
          />
          <Select style={{ width: 110 }} placeholder="类型" allowClear value={qType} onChange={setQType}
            options={['阈值', '状态', '质量', '组合', '程序', '备件'].map((v) => ({ value: v, label: v }))} />
          <Select style={{ width: 110 }} placeholder="状态" allowClear value={qStatus} onChange={setQStatus}
            options={['草稿', '已发布', '已停用'].map((v) => ({ value: v, label: v }))} />
          <Select style={{ width: 260 }} placeholder="分组（指标 · 量程 · 型号）" allowClear value={qGroup} onChange={setQGroup}
            options={groupKeys.map((k) => ({ value: k, label: allRows.find((r) => r.groupKey === k)?.groupLabel || k }))}
            showSearch optionFilterProp="label" maxTagCount="responsive" />
          <Button onClick={() => { setQKw(''); setQType(null); setQStatus(null); setQGroup(null); }}>重置</Button>
          <span style={{ fontSize: 12, color: '#8a97a3' }}>共 {rows.length} 条</span>
        </Space>
      </Card>
      {/* 列表卡：操作工具栏（左上第一行）→ 表格 */}
      <Card size="small">
        <Space wrap style={{ marginBottom: 12 }}>
          <Button type="primary" icon={<Plus size={14} />} onClick={openCreate}>新增规则</Button>
          <Button icon={<Layers size={14} />} onClick={() => setBatchOpen(true)}>批量新建（同类指标）</Button>
          <Tooltip title={selectionReady ? `对同分组 ${selectedRules.length} 条规则统一调整参数（生成待发布草稿）` : (selectionHint || '勾选同一分组的至少 2 条规则后可批量编辑')}>
            <Button
              icon={<Copy size={14} />}
              disabled={!selectionReady}
              onClick={() => setBeOpen(true)}
            >
              批量编辑（同分组）
            </Button>
          </Tooltip>
          {selectionHint && <span style={{ fontSize: 12, color: selectionReady ? '#00b8d4' : '#8a97a3' }}>{selectionHint}</span>}
        </Space>
        <Table
          rowKey="code"
          size="small"
          dataSource={rows}
          rowSelection={{
            selectedRowKeys,
            onChange: setSelectedRowKeys,
            getCheckboxProps: (r) => ({ disabled: !r.groupKey }),
          }}
          columns={[
            { title: '分组', dataIndex: 'groupLabel', width: 210, render: (v, r) => (v ? <Tag color={groupColorOf(r.groupKey)} style={{ marginInlineEnd: 0 }}>{v}</Tag> : <span style={{ color: '#8a97a3' }}>--</span>) },
            { title: '规则编号', dataIndex: 'code', width: 110 },
            { title: '规则名称', dataIndex: 'name', width: 170 },
            { title: '类型', dataIndex: 'type', width: 70, render: (v) => <Tag color={LEGACY_BUSINESS_RULE_TYPES.includes(v) ? 'default' : 'blue'}>{v}</Tag> },
            { title: '目标链路（设备 → 子设备 → 指标）', dataIndex: 'chain', width: 280, render: (v) => v.join(' → ') },
            { title: '触发条件', dataIndex: 'condition', width: 180 },
            { title: '恢复条件（迟滞）', dataIndex: 'recovery', width: 230 },
            { title: '重复抑制 / 风暴保护', dataIndex: 'suppress', width: 190, render: (v, r) => (
              <div style={{ fontSize: 12, lineHeight: 1.7 }}>
                <div>{v}</div>
                <div style={{ color: '#8a97a3' }}>风暴限流 {r.storm}</div>
              </div>
            ) },
            { title: '近7天 触发/抑制', width: 110, render: (_, r) => (
              <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                {r.trig7d || 0} / <span style={{ color: (r.supp7d || 0) > (r.trig7d || 0) ? '#d97706' : undefined }}>{r.supp7d || 0}</span>
              </span>
            ) },
            { title: '等级', dataIndex: 'severity', width: 70, render: (v) => v === '紧急' ? <Tag color="error">{v}</Tag> : v === '重要' ? <Tag color="warning">{v}</Tag> : <Tag color="gold">{v || '--'}</Tag> },
            { title: '通知策略', dataIndex: 'policyCode', width: 120, render: (v, r) => v || r.notificationConfig?.policyCode || '--' },
            { title: '版本', dataIndex: 'versionText', width: 130 },
            { title: '状态', dataIndex: 'status', width: 80, render: (v) => <Tag color={v === '已发布' ? 'success' : v === '草稿' ? 'processing' : 'default'}>{v}</Tag> },
            { title: '操作', width: 150, fixed: 'right', render: (_, r) => (
              <div className="list-actions">
                <a onClick={() => openEdit(r)}>{r.draftConfig ? '编辑草稿' : '编辑'}</a>
                <a onClick={() => openTest(r)}>测试</a>
                <a onClick={() => navigate('/alarm-rule-versions')}>版本</a>
                {r.status === '已发布' && <a style={{ color: '#d97706' }} onClick={() => confirmStop(r)}>停用</a>}
                {r.status === '草稿' && <a style={{ color: '#00b8d4' }} onClick={() => { openEdit(r); }}>发布</a>}
              </div>
            ) },
          ]}
          scroll={{ x: 1900 }}
        />
        {batches.length > 0 && (
          <>
            <div style={{ margin: '16px 0 8px', fontWeight: 600, fontSize: 13 }}>批量创建批次记录</div>
            <Table
              rowKey="batchId"
              size="small"
              dataSource={batches}
              pagination={false}
              columns={[
                { title: '批次号', dataIndex: 'batchId', width: 170 },
                { title: '名称', dataIndex: 'name' },
                { title: '指标', dataIndex: 'metricCode', width: 150 },
                { title: '目标数', dataIndex: 'targetCount', width: 70 },
                { title: '草稿 / 跳过 / 阻断 / 失败', width: 150, render: (_, r) => `${r.result.created} / ${r.result.skipped} / ${r.result.blocked} / ${r.result.failed}` },
                { title: '状态', dataIndex: 'status', width: 100, render: (v) => <Tag color={v === '已发布' ? 'success' : v === '发布失败' ? 'error' : 'processing'}>{v}</Tag> },
                { title: '发布结果', width: 140, render: (_, r) => (r.publishResult ? `成功 ${r.publishResult.published} / 失败 ${r.publishResult.failed}` : '--') },
                { title: '创建人', dataIndex: 'creator', width: 80 },
                { title: '创建时间', dataIndex: 'createdAt', width: 170 },
                { title: '操作', width: 100, render: (_, r) => (['草稿已生成', '部分发布', '发布失败'].includes(r.status)
                  ? <a onClick={() => confirmBatchPublish(r)}>批量发布</a>
                  : <span style={{ color: '#8a97a3' }}>已发布 {r.publishedAt || ''}</span>) },
              ]}
            />
          </>
        )}
      </Card>

      {/* 新增 / 编辑规则弹窗：受控表单，保存失败弹窗保留 */}
      <Modal
        title={editing
          ? `编辑报警规则（${editing.code} / ${editing.status === '已发布' ? `当前发布 ${editing.publishedVersion || editing.version}` : editing.status}）`
          : '新增报警规则'}
        width={780}
        open={open}
        onCancel={() => setOpen(false)}
        footer={legacyLocked
          ? [<Button key="close" type="primary" onClick={() => setOpen(false)}>知道了</Button>]
          : [
            <Button key="cancel" onClick={() => setOpen(false)}>取消</Button>,
            <Button key="draft" onClick={() => saveRule({ publish: false })}>保存草稿</Button>,
            <Button key="tpl" icon={<Copy size={13} />} onClick={copyConfig}>复制配置</Button>,
            <Button key="savetpl" onClick={() => { setSaveTplName(form.name ? `${form.name} 模板` : ''); setSaveTplScope(currentTarget?.metric?.name || ''); setSaveTplOpen(true); }}>存为模板</Button>,
            <Button key="pub" type="primary" onClick={confirmPublish}>{editing?.status === '已发布' ? '发布新版本' : '保存并发布'}</Button>,
          ]}
      >
        <div style={{ maxHeight: '66vh', overflowY: 'auto', paddingRight: 8 }}>
          <Space direction="vertical" style={{ width: '100%' }} size={12}>
            {legacyLocked && (
              <Alert type="warning" showIcon
                message="该规则为旧版业务规则或区间等结构（结构化编辑将在后续版本开放），当前仅可查看，不能修改。"
                description={editing ? `规则类型：${editing.type}；触发条件：${editing.condition || '--'}` : ''}
              />
            )}
            {editingFromDraft && !legacyLocked && (
              <Alert type="info" showIcon message={`该规则存在待发布草稿，当前编辑的是草稿内容；当前发布版本 ${editing.publishedVersion || editing.version} 不受影响，发布后生成新版本。`} />
            )}
            {validation.errors.length > 0 && (
              <Alert type="error" showIcon message={<>保存前需修正以下问题：<br />{validation.errors.map((e, i) => <div key={i}>· {e}</div>)}</>} />
            )}
            {validation.warnings.length > 0 && (
              <Alert type="warning" showIcon message={<>提示：<br />{validation.warnings.map((e, i) => <div key={i}>· {e}</div>)}</>} />
            )}

            <Input
              placeholder="规则名称，如：主轴温度持续超限"
              value={form.name}
              disabled={legacyLocked}
              onChange={(e) => patch({ name: e.target.value })}
            />
            <Space wrap>
              {!editing && (
                <Select
                  allowClear placeholder="从模板导入（触发/恢复/通知/治理参数）" style={{ width: 280 }}
                  value={importedTpl?.templateId || undefined}
                  onChange={(v) => (v ? applyRuleTemplate(v) : setImportedTpl(null))}
                  options={Object.values(state.entities.ruleTemplatesById || {}).filter((t) => t.status === '启用').map((t) => ({ value: t.templateId, label: `${t.name}` }))}
                />
              )}
              <Select value={form.type} disabled={legacyLocked} onChange={changeRuleType} style={{ width: 130 }} options={[{ value: 'threshold', label: '阈值' }, { value: 'state', label: '状态' }, { value: 'quality', label: '质量' }, { value: 'combo', label: '组合' }]} />
              <Select value={form.severity} disabled={legacyLocked} onChange={(v) => patch({ severity: v })} style={{ width: 100 }} options={['紧急', '重要', '一般', '提示'].map((v) => ({ value: v, label: v }))} />
              <Tag color="red" style={{ marginInlineEnd: 0 }}>判定数据源：实时订阅流（由目标指标自动确定）</Tag>
            </Space>

            <Card size="small" title={<>
              {form.type === 'quality' ? '质量监控对象（选择设备，监控其数据链路质量，无需选择指标）' : '规则目标（设备 → 子设备 → 指标 级联，仅限当前启用绑定中的已勾选指标）'}
              <InfoTip text={form.type === 'quality'
                ? '质量规则作用于设备的数据链路质量（订阅断开、拉取超时、BAD 质量码占比、采集延迟），不作用于指标数值，因此不出现指标级联与阈值/回差配置。'
                : '级联来自正式设备绑定事实：① 系统设备（canonical 编号 DEV-*）→ ② 来源设备（主设备 / 传感器）→ ③ 已勾选指标。停用绑定与失效指标不进入可选范围；状态规则仅可选状态类 S.* 指标；目标以绑定版本固化，换绑后需确认规则仍有效。'} />
            </>}>
              <Space direction="vertical" style={{ width: '100%' }}>
                {form.type === 'quality' ? (
                  <Select
                    placeholder="选择质量监控设备（启用绑定中的设备）"
                    style={{ width: '100%' }}
                    disabled={legacyLocked}
                    value={form.target.deviceId || undefined}
                    onChange={(v) => patch({ target: { deviceId: v || null, sourceId: null, metricCode: null } })}
                    options={deviceOptions}
                    showSearch
                    optionFilterProp="label"
                  />
                ) : (
                  <Cascader
                    style={{ width: '100%' }}
                    className="rule-target-cascader"
                    disabled={legacyLocked}
                    value={[form.target.deviceId, form.target.sourceId, form.target.metricCode].filter(Boolean)}
                    options={form.type === 'state' ? cascadeStateOptions : cascadeOptions}
                    onChange={changeTarget}
                    placeholder={form.type === 'state' ? '① 系统设备 → ② 子设备 → ③ 状态类指标（S.*）' : '① 系统设备 → ② 子设备（主设备 / 传感器）→ ③ 已勾选指标'}
                    showSearch
                  />
                )}
                {currentTarget && form.type !== 'quality' && (
                  <div style={hint}>
                    指标：{currentTarget.metric.name}（{currentTarget.metricCode} {currentTarget.metricVersion}）· 单位 {currentTarget.metric.unit || '--'} · {currentTarget.metric.enumValues ? `取值 ${currentTarget.metric.enumValues.join(' / ')}` : `量程 ${currentTarget.metric.range ? `${currentTarget.metric.range.min} ~ ${currentTarget.metric.range.max}` : '--'}`} · 绑定 {currentTarget.bindingId} v{currentTarget.bindingVersion}
                  </div>
                )}
                {importedTpl && (
                  <Alert type="success" showIcon
                    message={<>已按规则模板「<b>{importedTpl.name}</b>」导入参数，可修改。更换指标时模板参数保持不变。</>} />
                )}
              </Space>
            </Card>

            <Card
              size="small"
              title={<>① 触发条件<InfoTip text="阈值：持续时间为 0 时立即触发，仅建议状态类使用；区间 = 值超出正常区间任一方向即候选，双向共用一条规则。状态：取值落入异常枚举立即触发，状态恢复即恢复。质量：监控数据链路（中断 / 无效率 / 延迟），异常持续 N 分钟判定为质量事件。组合：多条件 AND / OR，各子条件独立配置目标与阈值。样本数据无效（null / BAD / OFFLINE）不参与触发判定。" /></>}
              extra={<Tag color="blue">{RULE_TYPE_LABEL[form.type]}配置方式</Tag>}
            >
              <Space direction="vertical" style={{ width: '100%' }} size={8}>
                {form.type === 'threshold' && (
                  <>
                    <Space wrap>
                      <span>判定模式</span>
                      <Select
                        value={form.triggerConfig.mode}
                        disabled={legacyLocked}
                        onChange={(v) => patchTrigger({ mode: v, operator: v === 'lower' ? '<' : '>' })}
                        style={{ width: 250 }}
                        options={[
                          { value: 'upper', label: '越上限（值 > 阈值 为异常）' },
                          { value: 'lower', label: '越下限（值 < 阈值 为异常）' },
                          { value: 'rangeOut', label: '区间外（超出正常区间 为异常）' },
                          { value: 'rangeIn', label: '区间内（落入区间 为异常）' },
                        ]}
                      />
                    </Space>
                    {['rangeOut', 'rangeIn'].includes(form.triggerConfig.mode) ? (
                      <Space wrap>
                        <span>{form.triggerConfig.mode === 'rangeOut' ? '正常区间' : '异常区间'}</span>
                        <InputNumber value={form.triggerConfig.low} disabled={legacyLocked} step={currentTarget?.metricCode === 'M.air_pressure' ? 0.05 : 1} onChange={(v) => patchTrigger({ low: v })} />
                        <span>~</span>
                        <InputNumber value={form.triggerConfig.high} disabled={legacyLocked} step={currentTarget?.metricCode === 'M.air_pressure' ? 0.05 : 1} onChange={(v) => patchTrigger({ high: v })} />
                        <span>{currentTarget?.metric.unit || ''}</span>
                        <span>持续</span>
                        <InputNumber value={form.triggerConfig.durationSec} disabled={legacyLocked} min={0} onChange={(v) => patchTrigger({ durationSec: v ?? 0 })} />
                        <span>秒 才触发</span>
                      </Space>
                    ) : (
                      <Space wrap>
                        <span>{form.triggerConfig.mode === 'lower' ? '低于' : '高于'}</span>
                        <InputNumber value={form.triggerConfig.threshold} disabled={legacyLocked} onChange={(v) => patchTrigger({ threshold: v })} step={currentTarget?.metricCode === 'M.air_pressure' ? 0.05 : 1} />
                        <span>{currentTarget?.metric.unit || ''}</span>
                        <span>持续</span>
                        <InputNumber value={form.triggerConfig.durationSec} disabled={legacyLocked} min={0} onChange={(v) => patchTrigger({ durationSec: v ?? 0 })} />
                        <span>秒 才触发</span>
                      </Space>
                    )}
                  </>
                )}
                {form.type === 'state' && (
                  <>
                    <Space wrap>
                      <span>异常状态（落入即立即触发）</span>
                      <Select
                        mode="multiple" placeholder="选择异常枚举，如：故障 / 无数据"
                        value={form.triggerConfig.abnormalValues} disabled={legacyLocked}
                        onChange={(v) => patchTrigger({ abnormalValues: v })}
                        options={enumOptions} style={{ minWidth: 280 }}
                        maxTagCount="responsive"
                      />
                    </Space>
                    <Space wrap>
                      <span>正常状态（用于恢复判定）</span>
                      <Select
                        mode="multiple" placeholder="选择正常枚举，如：运行 / 待机"
                        value={form.triggerConfig.normalValues} disabled={legacyLocked}
                        onChange={(v) => patchTrigger({ normalValues: v })}
                        options={enumOptions} style={{ minWidth: 280 }}
                        maxTagCount="responsive"
                      />
                    </Space>
                    <div style={hint}>异常与正常枚举不能重叠；状态规则立即触发（持续时间 0），状态恢复即恢复。</div>
                  </>
                )}
                {form.type === 'quality' && (
                  <>
                    <Space wrap>
                      <span>质量规则类型</span>
                      <Select
                        value={form.triggerConfig.mode} disabled={legacyLocked}
                        onChange={(v) => patchTrigger({ mode: v })}
                        style={{ width: 260 }}
                        options={[
                          { value: 'outage', label: '数据中断（订阅断开 / 拉取超时）' },
                          { value: 'invalidRate', label: '无效率超限（BAD 占比）' },
                          { value: 'delay', label: '采集延迟超限' },
                        ]}
                      />
                    </Space>
                    <Space wrap>
                      <span>持续</span>
                      <InputNumber value={form.triggerConfig.durationMin} disabled={legacyLocked} min={1} onChange={(v) => patchTrigger({ durationMin: v ?? 5 })} />
                      <span>分钟未恢复即产生质量报警</span>
                      {form.triggerConfig.mode === 'invalidRate' && (
                        <>
                          <span>；无效率阈值</span>
                          <InputNumber value={form.triggerConfig.invalidRatePercent} disabled={legacyLocked} min={0} max={100} onChange={(v) => patchTrigger({ invalidRatePercent: v })} />
                          <span>%</span>
                        </>
                      )}
                      {form.triggerConfig.mode === 'delay' && (
                        <>
                          <span>；最大允许延迟</span>
                          <InputNumber value={form.triggerConfig.delaySec} disabled={legacyLocked} min={1} onChange={(v) => patchTrigger({ delaySec: v })} />
                          <span>秒</span>
                        </>
                      )}
                    </Space>
                    <div style={hint}>质量判定数据为数据链路质量汇总（分钟级聚合），触发时按设备当前通信健康事实（状态 / 延迟 / 质量率）判定，不依赖指标样本值。</div>
                  </>
                )}
                {form.type === 'combo' && (
                  <>
                    <Space wrap>
                      <span>组合关系</span>
                      <Select
                        value={form.triggerConfig.operator} disabled={legacyLocked}
                        onChange={(v) => patchTrigger({ operator: v })}
                        style={{ width: 180 }}
                        options={[{ value: 'AND', label: '全部满足（AND）' }, { value: 'OR', label: '任一满足（OR）' }]}
                      />
                      <span>时间窗口</span>
                      <InputNumber value={form.triggerConfig.windowSec} disabled={legacyLocked} min={1} onChange={(v) => patchTrigger({ windowSec: v ?? 300 })} />
                      <span>秒</span>
                    </Space>
                    {form.triggerConfig.conditions.map((c, idx) => (
                      <Space key={idx} wrap style={{ width: '100%', justifyContent: 'space-between' }}>
                        <Space wrap>
                          <span>子条件 {String.fromCharCode(65 + idx)}</span>
                          <Cascader
                            style={{ width: 320 }}
                            className="rule-target-cascader"
                            disabled={legacyLocked}
                            value={[c.target?.deviceId, c.target?.sourceId, c.target?.metricCode].filter(Boolean)}
                            options={cascadeOptions}
                            onChange={(path) => {
                              const [deviceId, sourceId, metricCode] = path;
                              const t = targets.find((x) => x.deviceId === deviceId && x.sourceId === sourceId && x.metricCode === metricCode);
                              const conditions = [...form.triggerConfig.conditions];
                              conditions[idx] = { ...c, target: { deviceId: deviceId || null, sourceId: sourceId || null, metricCode: metricCode || null }, unit: t?.metric.unit || '' };
                              patchTrigger({ conditions });
                            }}
                            placeholder="目标（设备 → 子设备 → 指标）"
                            showSearch
                          />
                          <Select value={c.operator} disabled={legacyLocked} onChange={(v) => { const conditions = [...form.triggerConfig.conditions]; conditions[idx] = { ...c, operator: v }; patchTrigger({ conditions }); }} style={{ width: 70 }} options={[{ value: '>', label: '>' }, { value: '<', label: '<' }]} />
                          <InputNumber value={c.value} disabled={legacyLocked} onChange={(v) => { const conditions = [...form.triggerConfig.conditions]; conditions[idx] = { ...c, value: v }; patchTrigger({ conditions }); }} step={0.1} />
                          <span>持续</span>
                          <InputNumber value={c.durationSec} disabled={legacyLocked} min={0} onChange={(v) => { const conditions = [...form.triggerConfig.conditions]; conditions[idx] = { ...c, durationSec: v ?? 0 }; patchTrigger({ conditions }); }} />
                          <span>秒</span>
                        </Space>
                        <a style={{ color: '#d64545' }} disabled={legacyLocked} onClick={() => patchTrigger({ conditions: form.triggerConfig.conditions.filter((_, i) => i !== idx) })}>删除</a>
                      </Space>
                    ))}
                    <Button
                      type="dashed" block disabled={legacyLocked}
                      onClick={() => patchTrigger({ conditions: [...form.triggerConfig.conditions, { target: { deviceId: null, sourceId: null, metricCode: null }, operator: '>', value: null, durationSec: 60 }] })}
                    >
                      + 添加子条件（至少 2 个）
                    </Button>
                  </>
                )}
                <div style={hint}>触发条件文本：{conditionTextOf(form.triggerConfig)}</div>
              </Space>
            </Card>

            <Card
              size="small"
              title={<>② 恢复条件<InfoTip text="回差（迟滞带）防止值在阈值附近震荡导致反复横跳；区间恢复带上下回差独立配置；状态规则状态恢复即恢复；质量规则数据恢复正常持续后恢复；组合规则全部子条件回到非触发态并稳定后恢复。恢复需 GOOD 数据稳定持续；恢复过程中再次超限，稳定计时归零。有维修工单关联时指标恢复后仍需业务验收才能关闭。" /></>}
              extra={<Tag color="blue">{RULE_TYPE_LABEL[form.type]}恢复口径</Tag>}
            >
              <Space direction="vertical" style={{ width: '100%' }} size={8}>
                <Space wrap>
                  <span>恢复方式</span>
                  <Select value="auto" disabled style={{ width: 190 }} options={[{ value: 'auto', label: '自动恢复（满足条件）' }, { value: 'business', label: '恢复后业务闭环（随维修验收）' }, { value: 'manual', label: '人工确认关闭' }]} />
                  <span style={hint}>自动恢复为默认；有维修工单/停机关联时恢复后仍需业务闭环才能关闭</span>
                </Space>
                {form.type === 'threshold' && ['rangeOut', 'rangeIn'].includes(form.triggerConfig.mode) && (
                  <Space wrap>
                    <span>恢复区间 = [下限 +</span>
                    <InputNumber value={form.recoveryConfig.condition.lowDeadband ?? 0} disabled={legacyLocked} step={currentTarget?.metricCode === 'M.air_pressure' ? 0.01 : 1} min={0} onChange={(v) => patchRecoveryCondition({ lowDeadband: v ?? 0 })} />
                    <span>, 上限 −</span>
                    <InputNumber value={form.recoveryConfig.condition.highDeadband ?? 0} disabled={legacyLocked} step={currentTarget?.metricCode === 'M.air_pressure' ? 0.01 : 1} min={0} onChange={(v) => patchRecoveryCondition({ highDeadband: v ?? 0 })} />
                    <span>]（独立回差）持续</span>
                    <InputNumber value={form.recoveryConfig.stabilize.durationSec} disabled={legacyLocked} min={0} onChange={(v) => patch({ recoveryConfig: { ...form.recoveryConfig, stabilize: { ...form.recoveryConfig.stabilize, durationSec: v ?? 0 } } })} />
                    <span>秒</span>
                  </Space>
                )}
                {form.type === 'threshold' && !['rangeOut', 'rangeIn'].includes(form.triggerConfig.mode) && (
                  <>
                    <Space wrap>
                      <span>恢复阈值</span>
                      <Radio.Group
                        value={form.recoveryConfig.condition.thresholdMode}
                        disabled={legacyLocked}
                        onChange={(e) => patchRecoveryCondition({ thresholdMode: e.target.value })}
                        options={[{ value: 'deadband', label: '按回差' }, { value: 'explicit', label: '直接指定' }]}
                        optionType="button"
                      />
                      {form.recoveryConfig.condition.thresholdMode === 'deadband' ? (
                        <>
                          <span>= 触发阈值 {form.triggerConfig.mode === 'lower' ? '+' : '−'}</span>
                          <InputNumber value={form.recoveryConfig.condition.deadband} disabled={legacyLocked} min={0} onChange={(v) => patchRecoveryCondition({ deadband: v ?? 0 })} step={currentTarget?.metricCode === 'M.air_pressure' ? 0.01 : 1} />
                          <span>（回差）</span>
                        </>
                      ) : (
                        <InputNumber value={form.recoveryConfig.condition.recoveryValue} disabled={legacyLocked} onChange={(v) => patchRecoveryCondition({ recoveryValue: v })} step={currentTarget?.metricCode === 'M.air_pressure' ? 0.01 : 1} placeholder="恢复阈值" />
                      )}
                      <span>{currentTarget?.metric.unit || ''}</span>
                    </Space>
                    <Space wrap>
                      <span>恢复稳定</span>
                      <InputNumber value={form.recoveryConfig.stabilize.durationSec} disabled={legacyLocked} min={0} onChange={(v) => patch({ recoveryConfig: { ...form.recoveryConfig, stabilize: { ...form.recoveryConfig.stabilize, durationSec: v ?? 0 } } })} />
                      <span>秒（GOOD 数据持续；无效数据保持报警，再次超限计时归零）</span>
                    </Space>
                  </>
                )}
                {form.type === 'state' && (
                  <div style={hint}>状态恢复即恢复：状态回到正常枚举（{form.triggerConfig.normalValues.join('、') || '未配置'}）后进入恢复流程；无阈值与回差概念。</div>
                )}
                {form.type === 'quality' && (
                  <div style={hint}>数据质量恢复正常（质量码 GOOD 且拉取/订阅成功）持续 {form.recoveryConfig.stabilize.durationSec}s 后自动恢复；不涉及阈值回差。</div>
                )}
                {form.type === 'combo' && (
                  <div style={hint}>组合规则恢复：{form.triggerConfig.operator === 'OR' ? '所有处于触发态的子条件' : '全部子条件'}回到非触发态并持续 {form.recoveryConfig.stabilize.durationSec}s 后恢复；各子条件阈值独立，回差在子条件内消化。</div>
                )}
                <div style={hint}>恢复条件文本：{recoveryTextOf(form.recoveryConfig, form.triggerConfig)}</div>
              </Space>
            </Card>

            <Card
              size="small"
              title={<>③ 重复报警抑制<InfoTip text="活动事件未关闭期间命中同一去重键时合并计数（系统统一口径，不可关闭）；重复提醒不新建事件；报警关闭后再次触发必须新建事件。提醒间隔与次数为本规则可调参数，随版本快照保存。" /></>}
            >
              <Space direction="vertical" size={8}>
                <Switch disabled checkedChildren="活动事件未关闭期间抑制重复触发（系统统一口径）" checked />
                <Space wrap>
                  <Switch
                    checked={form.suppressionConfig.remindEnabled} disabled={legacyLocked}
                    checkedChildren="重复提醒开启" unCheckedChildren="不重复提醒"
                    onChange={(v) => patch({ suppressionConfig: { ...form.suppressionConfig, remindEnabled: v } })}
                  />
                  <span>抑制期间每</span>
                  <InputNumber value={form.suppressionConfig.remindIntervalMin} disabled={legacyLocked} min={1} onChange={(v) => patch({ suppressionConfig: { ...form.suppressionConfig, remindIntervalMin: v ?? 5 } })} />
                  <span>分钟重复提醒一次（不新建事件）</span>
                </Space>
              </Space>
            </Card>

            <Card
              size="small"
              title={<>④ 报警风暴保护（限流合并）<InfoTip text="统计窗口内新建事件达到上限后，超出部分按超限动作处理（合并计入首条事件或降级 / 暂停新建），并生成系统提示；风暴结束后自动解除。限流只兜底极端风暴，正常抖动应由抑制与回差消化；参数随版本快照保存。" /></>}
            >
              <Space direction="vertical" size={8}>
                <Space wrap>
                  <Switch
                    checked={form.stormConfig.enabled} disabled={legacyLocked}
                    checkedChildren="风暴保护开启" unCheckedChildren="关闭"
                    onChange={(v) => patch({ stormConfig: { ...form.stormConfig, enabled: v } })}
                  />
                  <span>统计窗口</span>
                  <InputNumber value={form.stormConfig.windowMin} disabled={legacyLocked || !form.stormConfig.enabled} min={1} addonAfter="分钟" onChange={(v) => patch({ stormConfig: { ...form.stormConfig, windowMin: v ?? 60 } })} />
                  <span>内最多新建</span>
                  <InputNumber value={form.stormConfig.maxEvents} disabled={legacyLocked || !form.stormConfig.enabled} min={1} addonAfter="条" onChange={(v) => patch({ stormConfig: { ...form.stormConfig, maxEvents: v ?? 3 } })} />
                </Space>
                {form.stormConfig.enabled && (
                  <Space wrap>
                    <span>统计范围</span>
                    <Select value={form.stormConfig.scope} disabled={legacyLocked} style={{ width: 170 }} onChange={(v) => patch({ stormConfig: { ...form.stormConfig, scope: v } })} options={[{ value: 'sameRule', label: '同规则' }, { value: 'sameDevice', label: '同设备' }, { value: 'sameMetric', label: '同指标' }]} />
                    <span>超限动作</span>
                    <Select value={form.stormConfig.overflowAction} disabled={legacyLocked} style={{ width: 170 }} onChange={(v) => patch({ stormConfig: { ...form.stormConfig, overflowAction: v } })} options={[{ value: 'merge', label: '合并到首条事件' }, { value: 'downgrade', label: '降级为提示' }, { value: 'pauseNew', label: '暂停新建事件' }]} />
                  </Space>
                )}
              </Space>
            </Card>

            <Card
              size="small"
              title={<>⑤ 静默时段（模板默认 + 规则级覆盖）<InfoTip text="静默时段内满足触发条件只记录不通知。规则级静默覆盖通知策略中的静默设置：启用后以本规则配置为准，未启用则沿用策略模板；计划停机静默始终联动「计划停机配置」。最终生效口径随版本快照保存。" /></>}
            >
              <Space direction="vertical" size={8} style={{ width: '100%' }}>
                <Space wrap>
                  <Switch
                    checked={form.silenceConfig.enabled} disabled={legacyLocked}
                    checkedChildren="本规则覆盖策略静默" unCheckedChildren="沿用策略模板静默"
                    onChange={(v) => patch({ silenceConfig: { ...form.silenceConfig, enabled: v, source: v ? 'override' : 'template' } })}
                  />
                  <Switch disabled checkedChildren="计划停机期间静默" checked />
                </Space>
                <div style={hint}>
                  模板默认：{policyDraft.silent || '不静默'} ／ 本规则覆盖：{form.silenceConfig.enabled ? silenceText(form.silenceConfig.windows) : '未启用'} ／ 最终生效：{form.silenceConfig.enabled ? (silenceText(form.silenceConfig.windows) || '不静默') : (policyDraft.silent || '不静默')}
                </div>
                {form.silenceConfig.enabled && (
                  <>
                    {form.silenceConfig.windows.map((w, idx) => (
                      <Space key={idx} wrap>
                        <span>静默 {idx + 1}</span>
                        <Input style={{ width: 110 }} value={w.start} disabled={legacyLocked} placeholder="22:00" onChange={(e) => { const windows = [...form.silenceConfig.windows]; windows[idx] = { ...w, start: e.target.value }; patch({ silenceConfig: { ...form.silenceConfig, windows } }); }} />
                        <span>~</span>
                        <Input style={{ width: 110 }} value={w.end} disabled={legacyLocked} placeholder="07:00" onChange={(e) => { const windows = [...form.silenceConfig.windows]; windows[idx] = { ...w, end: e.target.value }; patch({ silenceConfig: { ...form.silenceConfig, windows } }); }} />
                        <a style={{ color: '#d64545' }} onClick={() => patch({ silenceConfig: { ...form.silenceConfig, windows: form.silenceConfig.windows.filter((_, i) => i !== idx) } })}>删除</a>
                      </Space>
                    ))}
                    <Button type="dashed" block disabled={legacyLocked} onClick={() => patch({ silenceConfig: { ...form.silenceConfig, windows: [...form.silenceConfig.windows, { start: '22:00', end: '07:00' }] } })}>+ 添加静默时段</Button>
                  </>
                )}
              </Space>
            </Card>

            <Card
              size="small"
              title={<>⑥ 通知策略（模板 + 临时调整）<InfoTip text="策略在这里作为模板使用：选择策略后自动带出其内容（渠道 / 接收人 / 通知节奏 / 升级 / 静默 / 重试），可针对本规则临时调整；调整仅本规则生效，不回写策略本体。发布版本快照记录调整后的最终通知口径。" /></>}
            >
              <Space direction="vertical" size={8} style={{ width: '100%' }}>
                <Space wrap>
                  <span>策略模板</span>
                  <Select
                    value={policyCode}
                    disabled={legacyLocked}
                    onChange={changePolicy}
                    style={{ width: 320 }}
                    options={notificationRows.filter((n) => n.status === '启用').map((n) => ({ value: n.code, label: `${n.code} ${n.name}（${n.level}）` }))}
                  />
                  {policyModified && <Tag color="orange" style={{ marginInlineEnd: 0 }}>已临时调整</Tag>}
                  {policyModified && <a onClick={resetPolicy}>恢复模板默认</a>}
                  <a onClick={() => navigate('/notification-policy')}>查看 / 新增策略</a>
                </Space>
                <Alert
                  type={policyModified ? 'warning' : 'info'}
                  showIcon
                  message={policyModified
                    ? <>已按策略「<b>{curTpl.code} {curTpl.name}</b>」带出并做了临时调整：调整仅对本规则生效，策略本体不受影响。</>
                    : <>已按策略「<b>{curTpl.code} {curTpl.name}</b>」带出默认通知配置，可针对本规则临时调整，调整仅本规则生效。</>}
                />
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '10px 16px' }}>
                  <PolicyField label="通知渠道（站内为兜底必发）">
                    <Checkbox.Group
                      value={policyDraft.channels}
                      disabled={legacyLocked}
                      onChange={(vals) => setPolicyDraft({ ...policyDraft, channels: vals.includes('站内') ? vals : [...vals, '站内'] })}
                      options={[
                        { label: '站内（必发）', value: '站内', disabled: true },
                        { label: '短信', value: '短信' },
                        { label: '企业微信', value: '企业微信' },
                      ]}
                    />
                  </PolicyField>
                  <PolicyField label="接收人">
                    <Select
                      mode="multiple"
                      allowClear
                      value={policyDraft.receivers}
                      disabled={legacyLocked}
                      onChange={(vals) => setPolicyDraft({ ...policyDraft, receivers: vals })}
                      options={peopleOptions}
                      maxTagCount="responsive"
                      style={{ width: '100%' }}
                      placeholder="选择接收人"
                    />
                  </PolicyField>
                  <PolicyField label="首次通知（触发后多久发第一条）">
                    <Select value={policyDraft.first} disabled={legacyLocked} onChange={(v) => setPolicyDraft({ ...policyDraft, first: v })} style={{ width: '100%' }} options={['立即', '1 分钟', '5 分钟'].map((v) => ({ value: v, label: v }))} />
                  </PolicyField>
                  <PolicyField label="重复通知间隔（未确认时每隔多久提醒）">
                    <Select value={policyDraft.interval} disabled={legacyLocked} onChange={(v) => setPolicyDraft({ ...policyDraft, interval: v })} style={{ width: '100%' }} options={['5 分钟', '10 分钟', '30 分钟', '不重复'].map((v) => ({ value: v, label: v }))} />
                  </PolicyField>
                  <PolicyField label="升级节点（超时未确认逐级上报）">
                    <Select value={policyDraft.escalation} disabled={legacyLocked} onChange={(v) => setPolicyDraft({ ...policyDraft, escalation: v })} style={{ width: '100%' }} options={['10 分钟 / 30 分钟', '30 分钟', '无'].map((v) => ({ value: v, label: v }))} />
                  </PolicyField>
                  <PolicyField label="最大重试（发送失败重试次数）">
                    <InputNumber value={policyDraft.retries} disabled={legacyLocked} min={1} max={10} onChange={(v) => setPolicyDraft({ ...policyDraft, retries: v ?? 1 })} style={{ width: '100%' }} addonAfter="次" />
                  </PolicyField>
                  <PolicyField label="静默时段（时段内只记录不通知）">
                    <Input value={policyDraft.silent} disabled={legacyLocked} onChange={(e) => setPolicyDraft({ ...policyDraft, silent: e.target.value })} style={{ width: '100%' }} placeholder="如 00:00-07:00，留空为不静默" />
                  </PolicyField>
                </div>
                <div style={hint}>站内通知为兜底必发渠道；外部渠道不可作为唯一通知方式。保存 / 发布时以上调整将作为本规则的 notificationConfig 完整落库并进入版本快照。</div>
              </Space>
            </Card>

            {!legacyLocked && (
              <Button icon={<TestTube2 size={14} />} onClick={() => openTest(editing || { code: '当前配置', name: form.name || '未命名规则', trig7d: 23, supp7d: 31 }, form)}>
                历史数据回测（按当前配置真实回放）
              </Button>
            )}
          </Space>
        </div>
      </Modal>

      {/* 历史数据回测弹窗（P2）：按当前配置对趋势采样点真实回放；无趋势数据时明示退回种子统计 */}
      <Modal
        title={`历史数据回测${testRule ? ` · ${testRule.code} ${testRule.name}` : ''}`}
        width={560}
        open={testOpen}
        footer={<Button type="primary" onClick={() => setTestOpen(false)}>知道了</Button>}
        onCancel={() => setTestOpen(false)}
      >
        {testRule && backtest && (
          <>
            {backtest.hasTrend ? (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 8 }}>
                  <Statistic title="回测窗口" value={backtest.replay.points} suffix="点" />
                  <Statistic title="条件命中" value={backtest.replay.hits} suffix="点" />
                  <Statistic title="生成事件" value={backtest.replay.events} suffix="条" valueStyle={{ color: '#00b8d4' }} />
                  <Statistic title="被抑制 / 合并" value={backtest.replay.suppressed} suffix="点" valueStyle={{ color: '#d97706' }} />
                </div>
                <Alert type="success" showIcon message={`已按当前配置（${conditionTextOf(testForm.triggerConfig)}）对 ${backtest.key} 最近 ${backtest.replay.points} 个采样点（60s 间隔）真实回放：持续时间、无效数据与活动事件抑制口径与执行层一致。若被抑制占比过高，建议增大回差或延长持续时间。`} />
              </>
            ) : (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 8 }}>
                  <Statistic title="近7天条件命中" value={(testRule.trig7d || 0) + (testRule.supp7d || 0)} suffix="次" />
                  <Statistic title="实际生成事件" value={testRule.trig7d || 0} suffix="条" valueStyle={{ color: '#00b8d4' }} />
                  <Statistic title="被抑制 / 合并" value={testRule.supp7d || 0} suffix="次" valueStyle={{ color: '#d97706' }} />
                </div>
                <Alert type="info" showIcon message={`该目标（${backtest.key}）暂无历史趋势采样数据，无法按当前配置真实回放；以上为该规则近 7 天种子统计（含抑制口径）。接入趋势数据的目标（如主轴温度、冷却液温度、油压）支持真实回放。`} />
              </>
            )}
          </>
        )}
      </Modal>

      {/* 同分组批量编辑：统一调整参数 → 逐条生成待发布草稿（各规则保持自身触发模式） */}
      <Modal
        title={`批量编辑（同分组 ${selectedRules.length} 条 · ${selectedRules[0]?.groupLabel || ''}）`}
        width={640}
        open={beOpen}
        onOk={submitBatchEdit}
        onCancel={() => setBeOpen(false)}
        okText="批量保存为草稿" cancelText="取消"
      >
        <Space direction="vertical" style={{ width: '100%' }} size={10}>
          <Alert type="info" showIcon
            message={<>将修改：{selectedRules.map((r) => r.code).join('、')}。留空的字段不修改；每条规则保持自身触发模式（越上/下限应用阈值，区间应用上下限），保存后逐条生成<b>待发布草稿</b>，当前发布版本与版本快照不受影响，需发布后生效。</>} />
          <Space wrap>
            <div><div style={{ fontSize: 12, color: '#5d6b78', marginBottom: 4 }}>报警等级</div>
              <Select allowClear placeholder="不修改" style={{ width: 120 }} value={beForm.severity} onChange={(v) => setBeForm({ ...beForm, severity: v ?? null })}
                options={['紧急', '重要', '一般', '提示'].map((v) => ({ value: v, label: v }))} />
            </div>
            <div><div style={{ fontSize: 12, color: '#5d6b78', marginBottom: 4 }}>触发阈值（越上/下限规则）</div>
              <InputNumber placeholder="不修改" value={beForm.threshold} onChange={(v) => setBeForm({ ...beForm, threshold: v })} />
            </div>
            <div><div style={{ fontSize: 12, color: '#5d6b78', marginBottom: 4 }}>区间下限（区间规则）</div>
              <InputNumber placeholder="不修改" value={beForm.low} onChange={(v) => setBeForm({ ...beForm, low: v })} />
            </div>
            <div><div style={{ fontSize: 12, color: '#5d6b78', marginBottom: 4 }}>区间上限（区间规则）</div>
              <InputNumber placeholder="不修改" value={beForm.high} onChange={(v) => setBeForm({ ...beForm, high: v })} />
            </div>
          </Space>
          <Space wrap>
            <div><div style={{ fontSize: 12, color: '#5d6b78', marginBottom: 4 }}>持续（秒）</div>
              <InputNumber min={0} placeholder="不修改" value={beForm.durationSec} onChange={(v) => setBeForm({ ...beForm, durationSec: v })} />
            </div>
            <div><div style={{ fontSize: 12, color: '#5d6b78', marginBottom: 4 }}>恢复回差</div>
              <InputNumber min={0} step={0.01} placeholder="不修改" value={beForm.deadband} onChange={(v) => setBeForm({ ...beForm, deadband: v })} />
            </div>
            <div><div style={{ fontSize: 12, color: '#5d6b78', marginBottom: 4 }}>恢复阈值（直接指定模式）</div>
              <InputNumber placeholder="不修改" value={beForm.recoveryValue} onChange={(v) => setBeForm({ ...beForm, recoveryValue: v })} />
            </div>
            <div><div style={{ fontSize: 12, color: '#5d6b78', marginBottom: 4 }}>恢复稳定（秒）</div>
              <InputNumber min={0} placeholder="不修改" value={beForm.stabilizeSec} onChange={(v) => setBeForm({ ...beForm, stabilizeSec: v })} />
            </div>
          </Space>
          <div>
            <div style={{ fontSize: 12, color: '#5d6b78', marginBottom: 4 }}>通知策略（整体替换为所选策略模板）</div>
            <Select allowClear placeholder="不修改" style={{ width: 320 }} value={beForm.policyCode} onChange={(v) => setBeForm({ ...beForm, policyCode: v ?? null })}
              options={notificationRows.filter((n) => n.status === '启用').map((n) => ({ value: n.code, label: `${n.code} ${n.name}（${n.level}）` }))} />
          </div>
        </Space>
      </Modal>

      {/* 存为模板（P2 模板持久化）：写入 DemoStore 模板实体，不包含设备目标 */}
      <Modal
        title="存为规则模板"
        width={480}
        open={saveTplOpen}
        onOk={submitSaveTemplate}
        onCancel={() => setSaveTplOpen(false)}
        okText="保存模板" cancelText="取消"
      >
        <Space direction="vertical" style={{ width: '100%' }} size={10}>
          <div>
            <div style={{ fontSize: 12, color: '#5d6b78', marginBottom: 4 }}>模板名称（必填）</div>
            <Input value={saveTplName} onChange={(e) => setSaveTplName(e.target.value)} placeholder="如：温度类越上限通用模板" />
          </div>
          <div>
            <div style={{ fontSize: 12, color: '#5d6b78', marginBottom: 4 }}>适用指标说明</div>
            <Input value={saveTplScope} onChange={(e) => setSaveTplScope(e.target.value)} placeholder={currentTarget ? `如：${currentTarget.metric.name}类指标` : '如：温度类指标'} />
          </div>
          <Alert type="info" showIcon message="模板保存触发 / 恢复 / 通知 / 治理参数（不含设备目标与指标绑定）；可在「报警规则模板」页维护，新增规则时导入或批量应用到设备。模板更新不回写已发布规则。" />
        </Space>
      </Modal>

      <RuleBatchModal
        open={batchOpen}
        onClose={() => setBatchOpen(false)}
        targets={targets}
        onCommitted={() => message.success('批量草稿已生成，可在规则列表中逐条编辑后发布')}
      />
    </>
  );
}
