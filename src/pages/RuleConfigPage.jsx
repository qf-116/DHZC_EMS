import React from 'react';
import { Card, Table, Tag, Button, Space, Select, App, Input, InputNumber, Switch, Alert, Modal, Statistic, Tooltip, Cascader, Checkbox, Radio } from 'antd';
import { Plus, TestTube2, Zap, Info, Copy, Layers } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../components/PageHeader.jsx';
import { metricAlarmTemplates, ruleTemplates, notificationRows } from '../data/demoData.js';
import { useDemoState, useDemoActions } from '../state/DemoStore.jsx';
import {
  resolveRuleTargets, createEmptyRuleForm, ruleToForm, formToRule,
  validateRuleDraft, conditionTextOf, LEGACY_BUSINESS_RULE_TYPES, MVP_TRIGGER_MODES,
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

  // legacy 判定：业务事件类规则 / 区间等 P2 模式 → 只读查看，不支持结构化编辑
  const legacyLocked = React.useMemo(() => {
    if (!editing) return false;
    if (LEGACY_BUSINESS_RULE_TYPES.includes(editing.type)) return true;
    const trig = editing.triggerConfig || null;
    if (editing.type === '阈值') return !trig || !MVP_TRIGGER_MODES.includes(trig.mode);
    return true; // 状态/质量/组合结构化编辑为 P2
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
  const openTest = (r) => { setTestRule(r); setTestOpen(true); };

  // 指标特征模板：选择指标后自动带出推荐判定模式与参数（用户可修改）
  const applyMetricTemplate = (metricCode) => {
    const t = metricAlarmTemplates[metricCode];
    if (!t) return;
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

  // 从规则模板导入参数（模板 = 除设备绑定外的规则要素预设；更换指标不覆盖已导入参数）
  const applyRuleTemplate = (code) => {
    const t = ruleTemplates.find((x) => x.code === code);
    if (!t) { setImportedTpl(null); return; }
    setImportedTpl(t);
    if (t.mode === 'lower' || t.mode === 'upper') {
      patch({
        triggerConfig: { ...form.triggerConfig, mode: t.mode, threshold: t.threshold, durationSec: t.duration },
        recoveryConfig: { ...form.recoveryConfig, condition: { ...form.recoveryConfig.condition, deadband: t.deadband ?? 5 } },
      });
      setPolicyCode(t.policy || policyCode); setPolicyDraft(draftFromTpl(policyTplOf(t.policy || policyCode)));
    } else {
      message.info(`模板「${t.name}」为${t.ruleType}类模板，结构化编辑将在后续版本开放，已保留当前参数`);
    }
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

  const confirmStop = (r) => modal.confirm({
    title: '停用报警规则',
    content: `确定停用报警规则「${r.name}（${r.code}）」吗？停用后不再触发新报警，历史报警与版本快照保留。`,
    okText: '停用', cancelText: '取消',
    onOk: () => {
      const res = actions.disableRule(r.code);
      message[res.ok ? 'success' : 'error'](res.message);
    },
  });

  // 列表读模型：chain 由 canonical 目标生成；legacy 规则回退 deviceScope + metricCode
  const rows = Object.values(E.alarmRulesById).map((r) => {
    const deviceName = r.target?.deviceId ? E.devicesById[r.target.deviceId]?.name || r.target.deviceId : null;
    const chain = r.target
      ? [`${r.target.deviceId} ${deviceName || ''}`.trim(), r.target.sourceCode || r.target.sourceId || '--', r.target.metricCode]
      : [r.deviceScope || '--', r.metricCode || '--'];
    return {
      ...r,
      chain,
      versionText: r.status === '已发布' ? `${r.publishedVersion || r.version}${r.draftConfig ? '（有待发布草稿）' : ''}` : r.version || '待发布',
    };
  });
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

      <Card size="small">
        <Space wrap style={{ marginBottom: 12 }}>
          <Button type="primary" icon={<Plus size={14} />} onClick={openCreate}>新增规则</Button>
          <Button icon={<Layers size={14} />} onClick={() => setBatchOpen(true)}>批量新建（同类指标）</Button>
        </Space>
        <Table
          rowKey="code"
          size="small"
          dataSource={rows}
          columns={[
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
                { title: '状态', dataIndex: 'status', width: 100, render: (v) => <Tag color="processing">{v}</Tag> },
                { title: '创建人', dataIndex: 'creator', width: 80 },
                { title: '创建时间', dataIndex: 'createdAt', width: 170 },
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
                  allowClear placeholder="从模板导入（同型设备通用参数）" style={{ width: 250 }}
                  value={importedTpl?.code || undefined}
                  onChange={(v) => (v ? applyRuleTemplate(v) : setImportedTpl(null))}
                  options={ruleTemplates.filter((t) => t.status === '启用').map((t) => ({ value: t.code, label: `${t.name}` }))}
                />
              )}
              <Select value={form.type} disabled style={{ width: 130 }} options={[{ value: 'threshold', label: '阈值' }, { value: 'state', label: '状态（P2）' }, { value: 'quality', label: '质量（P2）' }, { value: 'combo', label: '组合（P2）' }]} />
              <Select value={form.severity} disabled={legacyLocked} onChange={(v) => patch({ severity: v })} style={{ width: 100 }} options={['紧急', '重要', '一般', '提示'].map((v) => ({ value: v, label: v }))} />
              <Tag color="red" style={{ marginInlineEnd: 0 }}>判定数据源：实时订阅流（由目标指标自动确定）</Tag>
            </Space>

            <Card size="small" title={<>规则目标（设备 → 子设备 → 指标 级联，仅限当前启用绑定中的已勾选指标）<InfoTip text="级联来自正式设备绑定事实：① 系统设备（canonical 编号 DEV-*）→ ② 来源设备（主设备 / 传感器）→ ③ 已勾选指标。停用绑定与失效指标不进入可选范围；目标以绑定版本固化，换绑后需确认规则仍有效。" /></>}>
              <Space direction="vertical" style={{ width: '100%' }}>
                <Cascader
                  style={{ width: '100%' }}
                  className="rule-target-cascader"
                  disabled={legacyLocked}
                  value={[form.target.deviceId, form.target.sourceId, form.target.metricCode].filter(Boolean)}
                  options={cascadeOptions}
                  onChange={changeTarget}
                  placeholder="① 系统设备 → ② 子设备（主设备 / 传感器）→ ③ 已勾选指标"
                  showSearch
                />
                {currentTarget && (
                  <div style={hint}>
                    指标：{currentTarget.metric.name}（{currentTarget.metricCode} {currentTarget.metricVersion}）· 单位 {currentTarget.metric.unit || '--'} · 量程 {currentTarget.metric.range ? `${currentTarget.metric.range.min} ~ ${currentTarget.metric.range.max}` : '--'} · 绑定 {currentTarget.bindingId} v{currentTarget.bindingVersion}
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
              title={<>① 触发条件<InfoTip text="持续时间为 0 时立即触发，仅建议状态类使用；阈值类规则必须设置持续时间，避免数据瞬时抖动产生短促报警。样本数据无效（null / BAD / OFFLINE）不参与触发判定。区间、状态、质量、组合条件为后续版本能力。" /></>}
              extra={<Tag color="blue">{RULE_TYPE_LABEL[form.type]}配置方式</Tag>}
            >
              <Space direction="vertical" style={{ width: '100%' }} size={8}>
                <Space wrap>
                  <span>判定模式</span>
                  <Select
                    value={form.triggerConfig.mode}
                    disabled={legacyLocked}
                    onChange={(v) => patch({ triggerConfig: { ...form.triggerConfig, mode: v, operator: v === 'lower' ? '<' : '>' } })}
                    style={{ width: 250 }}
                    options={[{ value: 'upper', label: '越上限（值 > 阈值 为异常）' }, { value: 'lower', label: '越下限（值 < 阈值 为异常）' }]}
                  />
                </Space>
                <Space wrap>
                  <span>{form.triggerConfig.mode === 'lower' ? '低于' : '高于'}</span>
                  <InputNumber value={form.triggerConfig.threshold} disabled={legacyLocked} onChange={(v) => patch({ triggerConfig: { ...form.triggerConfig, threshold: v } })} step={currentTarget?.metricCode === 'M.air_pressure' ? 0.05 : 1} />
                  <span>{currentTarget?.metric.unit || ''}</span>
                  <span>持续</span>
                  <InputNumber value={form.triggerConfig.durationSec} disabled={legacyLocked} min={0} onChange={(v) => patch({ triggerConfig: { ...form.triggerConfig, durationSec: v ?? 0 } })} />
                  <span>秒 才触发</span>
                </Space>
                <div style={hint}>触发条件文本：{conditionTextOf(form.triggerConfig)}</div>
              </Space>
            </Card>

            <Card
              size="small"
              title={<>② 恢复条件<InfoTip text="回差（迟滞带）防止值在阈值附近震荡导致反复横跳：温度 > 80℃ 持续 60s 触发后，需回落到 <= 75℃（80 − 5）且持续 30s 才恢复；75 ~ 80℃ 之间保持原状态不翻转。越下限模式恢复阈值 = 触发阈值 + 回差。恢复需 GOOD 数据稳定持续；恢复过程中再次超限，稳定计时归零。业务闭环 / 人工确认关闭为后续版本能力（有维修工单关联时指标恢复后仍需业务验收才能关闭）。" /></>}
              extra={<Tag color="blue">{RULE_TYPE_LABEL[form.type]}恢复口径</Tag>}
            >
              <Space direction="vertical" style={{ width: '100%' }} size={8}>
                <Space wrap>
                  <span>恢复方式</span>
                  <Select value="auto" disabled style={{ width: 190 }} options={[{ value: 'auto', label: '自动恢复（满足条件）' }, { value: 'business', label: '恢复后业务闭环（P2）' }, { value: 'manual', label: '人工确认关闭（P2）' }]} />
                  <span style={hint}>MVP 自动恢复；有维修工单/停机关联时恢复后仍需业务闭环才能关闭</span>
                </Space>
                <Space wrap>
                  <span>恢复阈值</span>
                  <Radio.Group
                    value={form.recoveryConfig.condition.thresholdMode}
                    disabled={legacyLocked}
                    onChange={(e) => patch({ recoveryConfig: { ...form.recoveryConfig, condition: { ...form.recoveryConfig.condition, thresholdMode: e.target.value } } })}
                    options={[{ value: 'deadband', label: '按回差' }, { value: 'explicit', label: '直接指定' }]}
                    optionType="button"
                  />
                  {form.recoveryConfig.condition.thresholdMode === 'deadband' ? (
                    <>
                      <span>= 触发阈值 {form.triggerConfig.mode === 'lower' ? '+' : '−'}</span>
                      <InputNumber value={form.recoveryConfig.condition.deadband} disabled={legacyLocked} min={0} onChange={(v) => patch({ recoveryConfig: { ...form.recoveryConfig, condition: { ...form.recoveryConfig.condition, deadband: v ?? 0 } } })} step={currentTarget?.metricCode === 'M.air_pressure' ? 0.01 : 1} />
                      <span>（回差）</span>
                    </>
                  ) : (
                    <InputNumber value={form.recoveryConfig.condition.recoveryValue} disabled={legacyLocked} onChange={(v) => patch({ recoveryConfig: { ...form.recoveryConfig, condition: { ...form.recoveryConfig.condition, recoveryValue: v } } })} step={currentTarget?.metricCode === 'M.air_pressure' ? 0.01 : 1} placeholder="恢复阈值" />
                  )}
                  <span>{currentTarget?.metric.unit || ''}</span>
                </Space>
                <Space wrap>
                  <span>恢复稳定</span>
                  <InputNumber value={form.recoveryConfig.stabilize.durationSec} disabled={legacyLocked} min={0} onChange={(v) => patch({ recoveryConfig: { ...form.recoveryConfig, stabilize: { ...form.recoveryConfig.stabilize, durationSec: v ?? 0 } } })} />
                  <span>秒（GOOD 数据持续；无效数据保持报警，再次超限计时归零）</span>
                </Space>
              </Space>
            </Card>

            <Card
              size="small"
              title={<>③ 重复报警抑制<InfoTip text="活动事件未关闭期间命中同一去重键时合并计数；重复提醒不新建事件；报警关闭后再次触发必须新建事件。这些口径由系统统一执行，规则级可调参数为后续版本能力。" /></>}
              extra={<Tag color="default" style={{ marginInlineEnd: 0 }}>P2 · 演示占位</Tag>}
            >
              <Space direction="vertical" size={8}>
                <Switch disabled checkedChildren="活动事件未关闭期间抑制重复触发（系统统一口径）" checked />
                <Space wrap>
                  <span>抑制期间每</span>
                  <InputNumber disabled value={5} min={1} />
                  <span>分钟重复提醒一次（不新建事件）</span>
                </Space>
              </Space>
            </Card>

            <Card
              size="small"
              title={<>④ 报警风暴保护（限流合并）<InfoTip text="超出限流的新触发合并计入首条事件并生成系统提示；风暴结束后自动解除。规则级可调参数为后续版本能力。" /></>}
              extra={<Tag color="default" style={{ marginInlineEnd: 0 }}>P2 · 演示占位</Tag>}
            >
              <Space wrap>
                <span>单规则每小时最多新建</span>
                <InputNumber disabled value={3} min={1} />
                <span>条事件</span>
              </Space>
            </Card>

            <Card
              size="small"
              title={<>⑤ 静默时段<InfoTip text="静默时段内满足触发条件只记录不通知；计划停机静默联动「计划停机配置」。规则级静默覆盖为后续版本能力。" /></>}
              extra={<Tag color="default" style={{ marginInlineEnd: 0 }}>P2 · 演示占位</Tag>}
            >
              <Space wrap>
                <Switch disabled checkedChildren="计划停机期间静默" checked />
                <span style={hint}>规则级自定义静默时段为 P2；通知策略中的静默时段仍然生效</span>
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
              <Button icon={<TestTube2 size={14} />} onClick={() => openTest(editing || { code: '当前配置', name: form.name || '未命名规则', trig7d: 23, supp7d: 31 })}>
                历史数据测试（演示参考）
              </Button>
            )}
          </Space>
        </div>
      </Modal>

      {/* 历史数据测试弹窗（演示参考：回放种子统计，不使用当前未保存表单参数） */}
      <Modal
        title={`历史数据测试（演示参考）${testRule ? ` · ${testRule.code} ${testRule.name}` : ''}`}
        width={560}
        open={testOpen}
        footer={<Button type="primary" onClick={() => setTestOpen(false)}>知道了</Button>}
        onCancel={() => setTestOpen(false)}
      >
        {testRule && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 8 }}>
              <Statistic title="近7天条件命中" value={(testRule.trig7d || 0) + (testRule.supp7d || 0)} suffix="次" />
              <Statistic title="实际生成事件" value={testRule.trig7d || 0} suffix="条" valueStyle={{ color: '#00b8d4' }} />
              <Statistic title="被抑制 / 合并" value={testRule.supp7d || 0} suffix="次" valueStyle={{ color: '#d97706' }} />
            </div>
            <Alert type="info" showIcon message="演示说明：此处展示的是该规则近 7 天的种子统计（含抑制 / 合并口径），并非使用当前未保存表单参数的真实历史回放；历史回测能力在后续版本提供。若被抑制占比过高，建议增大回差或延长触发持续时间。" />
          </>
        )}
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
