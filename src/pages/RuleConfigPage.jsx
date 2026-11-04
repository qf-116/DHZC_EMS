import React from 'react';
import { Card, Table, Tag, Button, Space, Select, App, Input, InputNumber, Alert, Modal, Statistic, Tooltip, Descriptions } from 'antd';
import { Plus, TestTube2, Zap, Trash2, PowerOff, Pencil } from 'lucide-react';
import PageHeader from '../components/PageHeader.jsx';
import { metricAlarmTemplates } from '../data/demoData.js';
import { iotProducts } from '../data/demo/bindings.js';
import { useDemoState, useDemoActions } from '../state/DemoStore.jsx';
import {
  resolveRuleTargets, createEmptyRuleForm, ruleToForm, formToRule, switchRuleFormType,
  validateRuleDraft, conditionTextOf, replayTrend, ruleProductOf, nextRuleCode,
  LEGACY_BUSINESS_RULE_TYPES,
} from '../domain/alarmRule.js';
import RuleFormBody from '../components/RuleFormBody.jsx';
import RuleNewWizard from '../components/RuleNewWizard.jsx';
import FilterBar, { FilterField } from '../components/FilterBar.jsx';

// 报警规则配置 V5（2026-11-03 合并「新增规则」与「批量新建」）：
// - 新增规则走三步向导（产品 → 物联网设备多选 → 单指标 → 参数 → 预览），N 台设备生成 N 条规则，直接发布、无草稿态；
// - 列表保留产品列与产品查询（产品 = 物联网平台产品目录，同产品物模型一致）；
// - 支持单条停用、批量停用、单条删除、批量删除（历史报警事件保留）。
// - 规则编辑：受控表单，保存即发布新版本。
const hint = { fontSize: 12, color: '#5d6b78', lineHeight: 1.7 };

export default function RuleConfigPage() {
  const { message, modal } = App.useApp();
  const state = useDemoState();
  const actions = useDemoActions();
  const E = state.entities;

  const [wizardOpen, setWizardOpen] = React.useState(false);
  // 校验提示只在提交后才出现：新建空表单时直接报「名称必填/必须选设备」没有意义
  const [submitAttempted, setSubmitAttempted] = React.useState(false);
  const [editing, setEditing] = React.useState(null);          // 编辑中的规则
  const [editBaseVersion, setEditBaseVersion] = React.useState(null); // 打开编辑时的发布版本（并发冲突比对基线）
  const [form, setForm] = React.useState(() => createEmptyRuleForm());
  const [testOpen, setTestOpen] = React.useState(false);
  const [testRule, setTestRule] = React.useState(null);
  const [detailRule, setDetailRule] = React.useState(null);
  // 查询条件 + 勾选批量操作
  const [qKw, setQKw] = React.useState('');
  const [qType, setQType] = React.useState(null);
  const [qStatus, setQStatus] = React.useState(null);
  const [qProduct, setQProduct] = React.useState(null);
  const [selectedRowKeys, setSelectedRowKeys] = React.useState([]);
  const [beOpen, setBeOpen] = React.useState(false);
  const [beForm, setBeForm] = React.useState({});

  // canonical 目标（启用绑定 + 已接入指标），级联与展示都从这里取
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

  const patch = (p) => setForm((f) => ({ ...f, ...p }));
  const patchTrigger = (p) => setForm((f) => ({ ...f, triggerConfig: { ...f.triggerConfig, ...p } }));
  const patchRecoveryCondition = (p) => setForm((f) => ({ ...f, recoveryConfig: { ...f.recoveryConfig, condition: { ...f.recoveryConfig.condition, ...p } } }));
  const changeRuleType = (t) => setForm((f) => switchRuleFormType(f, t));

  // legacy 判定：业务事件类规则（程序/备件等）或无法解析出结构化触发的旧规则 → 只读查看
  const legacyLocked = React.useMemo(() => {
    if (!editing) return false;
    if (LEGACY_BUSINESS_RULE_TYPES.includes(editing.type)) return true;
    return !editing.triggerConfig;
  }, [editing]);

  const openEdit = (r) => {
    setEditing(r);
    setEditBaseVersion(r.publishedVersion || r.version || null);
    setSubmitAttempted(false);
    setForm(ruleToForm(r));
  };
  const [testForm, setTestForm] = React.useState(null);
  const openTest = (r, cfgForm) => {
    setTestRule(r);
    // 回测使用当前表单配置（未保存也可）；列表入口使用该规则当前生效配置
    setTestForm(formToRule(cfgForm || ruleToForm(r)));
    setTestOpen(true);
  };

  // 指标特征模板：选择数值指标后自动带出推荐判定模式与参数（用户可修改）
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
    if (metricCode) applyMetricTemplate(metricCode);
    // 名称自动建议（留空时）
    if (t && !form.name.trim()) {
      patch({ target: { deviceId, sourceId, metricCode }, name: `${t.deviceName}${t.metric.name}${(metricAlarmTemplates[metricCode]?.mode) === 'lower' ? '过低' : '超限'}报警` });
    }
  };

  // 客户端预校验（与 reducer 同一领域函数）：阻断错误红色展示，发布前必须清零
  const buildRule = () => formToRule(form, { code: form.code || nextRuleCode(E.alarmRulesById) });
  const validation = React.useMemo(() => {
    if (!editing || legacyLocked) return { errors: [], warnings: [] };
    return validateRuleDraft(buildRule(), {
      devicesById: E.devicesById, bindingsByDeviceId: E.bindingsByDeviceId, metricsByKey: E.metricsByKey, alarmRulesById: E.alarmRulesById,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form, editing, legacyLocked]);

  const saveRule = () => {
    setSubmitAttempted(true);
    const rule = buildRule();
    // expectedPublishedVersion：打开弹窗时的发布版本，与当前不一致时后端阻断（并发编辑冲突）
    const res = actions.saveAndPublishRule(rule, { expectedPublishedVersion: editBaseVersion });
    if (!res.ok) {
      // 保存/发布失败：弹窗与表单内容保留，用户可修正后重试
      message.error(res.message);
      return;
    }
    message.success(res.message);
    setEditing(null);
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

  const confirmDelete = (r) => modal.confirm({
    title: '删除报警规则',
    content: `确定删除报警规则「${r.name}（${r.code}）」吗？规则定义与版本快照一并删除，历史报警事件保留。`,
    okText: '删除', cancelText: '取消',
    okButtonProps: { danger: true },
    onOk: () => {
      const res = actions.deleteRules([r.code]);
      message[res.ok ? 'success' : 'error'](res.message);
      setSelectedRowKeys((k) => k.filter((x) => x !== r.code));
    },
  });

  const confirmBatchStop = () => {
    const names = selectedRowKeys.map((k) => E.alarmRulesById[k]?.code || k).join('、');
    modal.confirm({
      title: '批量停用报警规则',
      content: `确定停用已勾选的 ${selectedRowKeys.length} 条规则（${names}）吗？停用后不再触发新报警，历史报警与版本快照保留。`,
      okText: '批量停用', cancelText: '取消',
      onOk: () => {
        const res = actions.disableRules(selectedRowKeys);
        message[res.ok ? 'success' : 'error'](res.message);
        setSelectedRowKeys([]);
      },
    });
  };

  const confirmBatchDelete = () => {
    const names = selectedRowKeys.map((k) => E.alarmRulesById[k]?.code || k).join('、');
    modal.confirm({
      title: '批量删除报警规则',
      content: `确定删除已勾选的 ${selectedRowKeys.length} 条规则（${names}）吗？规则定义与版本快照一并删除，历史报警事件保留。`,
      okText: '批量删除', cancelText: '取消',
      okButtonProps: { danger: true },
      onOk: () => {
        const res = actions.deleteRules(selectedRowKeys);
        message[res.ok ? 'success' : 'error'](res.message);
        setSelectedRowKeys([]);
      },
    });
  };

  // 真实回测（P2）：按触发配置对目标指标最近趋势采样点回放（60s 间隔）
  const backtest = React.useMemo(() => {
    if (!testRule || !testForm) return null;
    const key = `${testForm.target?.deviceId}|${testForm.target?.metricCode}`;
    const values = state.entities.trends[key];
    const replay = replayTrend(testForm.triggerConfig, Array.isArray(values) ? values : [], { stepSec: 60 });
    return { key, hasTrend: Array.isArray(values) && values.length > 0, replay };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [testRule, testForm, state.entities.trends]);

  // 列表读模型：chain 由 canonical 目标生成；legacy 规则回退 deviceScope + metricCode
  // 产品 = 物联网平台产品目录（canonical 目标按来源设备取；旧种子规则按指标物模型回退）
  const metricProductByCode = React.useMemo(() => {
    const map = new Map();
    iotProducts.forEach((p) => p.metrics.forEach((m) => {
      const code = typeof m === 'string' ? m : m.metricCode;
      if (code && !map.has(code)) map.set(code, p.product);
    }));
    return map;
  }, []);
  const allRows = Object.values(E.alarmRulesById).map((r) => {
    const deviceName = r.target?.deviceId ? E.devicesById[r.target.deviceId]?.name || r.target.deviceId : null;
    const product = ruleProductOf(r, E.sourceDevicesById)
      || (r.metricCode ? metricProductByCode.get(r.metricCode) || null : null);
    const metricName = r.target?.metricCode
      ? E.metricsByKey[r.target.metricCode]?.name
      : (r.metricCode ? E.metricsByKey[r.metricCode]?.name : null);
    return {
      ...r,
      product,
      productName: product || '--',
      deviceText: r.target?.deviceId ? `${r.target.deviceId}${deviceName ? ` ${deviceName}` : ''}` : (r.deviceScope || '--'),
      sourceText: r.target?.sourceCode || r.target?.sourceId || '--',
      metricText: r.target?.metricCode ? `${r.metricCode}${metricName ? ` ${metricName}` : ''}` : (r.metricCode || '--'),
      versionText: r.status === '已发布' ? (r.publishedVersion || r.version) : (r.version || '--'),
    };
  });
  // 查询条件（前端过滤，演示数据量级适用）
  const kw = qKw.trim();
  const rows = allRows.filter((r) => {
    if (kw && ![r.code, r.name, r.metricCode, r.target?.deviceId, r.deviceText].some((v) => String(v || '').includes(kw))) return false;
    if (qType && r.type !== qType) return false;
    if (qStatus && r.status !== qStatus) return false;
    if (qProduct && r.product !== qProduct) return false;
    return true;
  });
  const productOptions = React.useMemo(() => {
    const set = new Set();
    allRows.forEach((r) => { if (r.product) set.add(r.product); });
    return [...set].map((p) => ({ value: p, label: p }));
  }, [allRows]);

  const selectedRules = selectedRowKeys.map((k) => allRows.find((r) => r.code === k)).filter(Boolean);
  const editableSelected = selectedRules.filter((r) => !LEGACY_BUSINESS_RULE_TYPES.includes(r.type) && r.triggerConfig);
  const selectionHint = selectedRules.length === 0 ? ''
    : editableSelected.length < selectedRules.length ? `已选 ${selectedRules.length} 条，其中 ${selectedRules.length - editableSelected.length} 条为旧业务规则，不参与批量编辑`
      : `已选 ${selectedRules.length} 条，可批量编辑 / 批量停用 / 批量删除`;

  const submitBatchEdit = () => {
    const patchObj = {};
    Object.entries(beForm).forEach(([k, v]) => { if (v !== null && v !== undefined && v !== '') patchObj[k] = v; });
    if (Object.keys(patchObj).length === 0) { message.warning('请至少填写一个要修改的字段'); return; }
    const codes = editableSelected.map((r) => r.code);
    const res = actions.batchEditRules(codes, patchObj);
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

  return (
    <>
      <PageHeader title="报警规则配置" />

      {chattering.length > 0 && (
        <Alert
          type="warning" showIcon icon={<Zap size={14} />}
          style={{ marginBottom: 12 }}
          message={`报警治理提示：${chattering.map((r) => `${r.name}（近7天触发 ${r.trig7d} 次、重复抑制 ${r.supp7d} 次）`).join('、')}。抑制次数高于触发次数说明值在阈值附近反复震荡，建议增大恢复回差或延长触发持续时间。`}
        />
      )}

      {/* 筛选卡（规范 §1/§4：查询条件独立在列表卡上方） */}
      <FilterBar onQuery={() => {}} onReset={() => { setQKw(''); setQType(null); setQStatus(null); setQProduct(null); }} extra={<span style={{ fontSize: 12, color: '#8a97a3' }}>共 {rows.length} 条</span>}>
        <FilterField label="关键词">
          <Input style={{ width: 240 }} allowClear placeholder="规则编号 / 名称 / 指标 / 设备" value={qKw} onChange={(e) => setQKw(e.target.value)} />
        </FilterField>
        <FilterField label="类型">
          <Select style={{ width: 110 }} placeholder="请选择" allowClear value={qType} onChange={setQType}
            options={['阈值', '状态', '质量', '组合', '程序', '备件'].map((v) => ({ value: v, label: v }))} />
        </FilterField>
        <FilterField label="状态">
          <Select style={{ width: 110 }} placeholder="请选择" allowClear value={qStatus} onChange={setQStatus}
            options={['已发布', '已停用'].map((v) => ({ value: v, label: v }))} />
        </FilterField>
        <FilterField label="产品">
          <Select style={{ width: 200 }} placeholder="请选择" allowClear value={qProduct} onChange={setQProduct}
            options={productOptions} showSearch optionFilterProp="label" />
        </FilterField>
      </FilterBar>
      {/* 列表卡：操作工具栏（左上第一行）→ 表格 */}
      <Card size="small">
        <Space wrap style={{ marginBottom: 12 }}>
          <Button type="primary" icon={<Plus size={14} />} onClick={() => setWizardOpen(true)}>新增规则</Button>
          <Button
            icon={<Pencil size={14} />}
            disabled={editableSelected.length === 0}
            onClick={() => setBeOpen(true)}
          >
            批量编辑
          </Button>
          <Button
            icon={<PowerOff size={14} />}
            disabled={selectedRowKeys.length === 0}
            onClick={confirmBatchStop}
          >
            批量停用
          </Button>
          <Button
            icon={<Trash2 size={14} />}
            danger
            disabled={selectedRowKeys.length === 0}
            onClick={confirmBatchDelete}
          >
            批量删除
          </Button>
          {selectionHint && <span style={{ fontSize: 12, color: '#8a97a3' }}>{selectionHint}</span>}
        </Space>
        <Table
          rowKey="code"
          size="small"
          dataSource={rows}
          rowSelection={{ selectedRowKeys, onChange: setSelectedRowKeys }}
          columns={[
            { title: '产品', dataIndex: 'productName', width: 150 },
            { title: '规则编号', dataIndex: 'code', width: 100 },
            { title: '规则名称', dataIndex: 'name', width: 200 },
            { title: '台账设备', dataIndex: 'deviceText', width: 190 },
            { title: 'IoT来源', dataIndex: 'sourceText', width: 130 },
            { title: '指标', dataIndex: 'metricText', width: 170 },
            { title: '触发条件', dataIndex: 'condition', width: 180 },
            { title: '恢复条件（迟滞）', dataIndex: 'recovery', width: 230 },
            { title: '等级', dataIndex: 'severity', width: 70, render: (v) => v === '紧急' ? <Tag color="error">{v}</Tag> : v === '重要' ? <Tag color="warning">{v}</Tag> : <Tag color="gold">{v || '--'}</Tag> },
            { title: '版本', dataIndex: 'versionText', width: 80 },
            { title: '状态', dataIndex: 'status', width: 80, render: (v) => <Tag color={v === '已发布' ? 'success' : 'default'}>{v}</Tag> },
            { title: '操作', width: 190, fixed: 'right', render: (_, r) => (
              <div className="list-actions">
                <a onClick={() => setDetailRule(r)}>详情</a>
                {!LEGACY_BUSINESS_RULE_TYPES.includes(r.type) && r.triggerConfig && <a onClick={() => openEdit(r)}>编辑</a>}
                <a onClick={() => openTest(r)}>测试</a>
                {r.status === '已发布' && <a style={{ color: '#d97706' }} onClick={() => confirmStop(r)}>停用</a>}
                <a style={{ color: '#d64545' }} onClick={() => confirmDelete(r)}>删除</a>
              </div>
            ) },
          ]}
          scroll={{ x: 1720 }}
        />
      </Card>

      {/* 新增规则向导：产品 → 物联网设备多选 → 单指标 → 参数 → 预览 → 创建并发布 N 条 */}
      <RuleNewWizard
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        state={state}
        actions={actions}
        onDone={() => setSelectedRowKeys([])}
      />

      {/* 编辑规则弹窗：受控表单，保存即发布新版本 */}
      <Modal
        title={editing ? `编辑报警规则（${editing.code} / 当前发布 ${editing.publishedVersion || editing.version}）` : ''}
        width={780}
        open={!!editing}
        onCancel={() => setEditing(null)}
        footer={legacyLocked
          ? [<Button key="close" type="primary" onClick={() => setEditing(null)}>知道了</Button>]
          : [
            <Button key="cancel" onClick={() => setEditing(null)}>取消</Button>,
            <Button key="pub" type="primary" onClick={saveRule}>发布新版本</Button>,
          ]}
      >
        <div style={{ maxHeight: '66vh', overflowY: 'auto', paddingRight: 8 }}>
          <Space direction="vertical" style={{ width: '100%' }} size={12}>
            {legacyLocked && (
              <Alert type="warning" showIcon
                message="旧版业务规则仅可查看，不能修改。"
                description={editing ? `规则类型：${editing.type}；触发条件：${editing.condition || '--'}` : ''}
              />
            )}
            {submitAttempted && validation.errors.length > 0 && (
              <Alert type="error" showIcon message={<>保存前需修正以下问题：<br />{validation.errors.map((e, i) => <div key={i}>· {e}</div>)}</>} />
            )}
            {submitAttempted && validation.warnings.length > 0 && (
              <Alert type="warning" showIcon message={<>提示：<br />{validation.warnings.map((e, i) => <div key={i}>· {e}</div>)}</>} />
            )}

            <Input
              placeholder="规则名称，如：主轴温度持续超限"
              value={form.name}
              disabled={legacyLocked}
              onChange={(e) => patch({ name: e.target.value })}
            />
            <RuleFormBody
              form={form}
              patch={patch}
              patchTrigger={patchTrigger}
              patchRecoveryCondition={patchRecoveryCondition}
              changeRuleType={changeRuleType}
              changeTarget={changeTarget}
              currentTarget={currentTarget}
              cascadeOptions={cascadeOptions}
              cascadeStateOptions={cascadeStateOptions}
              enumOptions={enumOptions}
              deviceOptions={deviceOptions}
              targets={targets}
              disabled={legacyLocked}
            />
            {!legacyLocked && (
              <Button icon={<TestTube2 size={14} />} onClick={() => openTest(editing || { code: '当前配置', name: form.name || '未命名规则', trig7d: 23, supp7d: 31 }, form)}>
                历史数据回测（按当前配置真实回放）
              </Button>
            )}
          </Space>
        </div>
      </Modal>

      {/* 规则详情：触发/恢复 + 治理参数（重复抑制、风暴保护、静默）+ 近 7 天统计 */}
      <Modal
        title={detailRule ? `规则详情 · ${detailRule.code} ${detailRule.name}` : '规则详情'}
        width={720}
        open={!!detailRule}
        onCancel={() => setDetailRule(null)}
        footer={<Button type="primary" onClick={() => setDetailRule(null)}>关闭</Button>}
      >
        {detailRule && (
          <Space direction="vertical" style={{ width: '100%' }} size={12}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
              <Statistic title="近7天触发" value={detailRule.trig7d || 0} suffix="次" />
              <Statistic title="近7天重复抑制" value={detailRule.supp7d || 0} suffix="次" valueStyle={{ color: (detailRule.supp7d || 0) > (detailRule.trig7d || 0) ? '#d97706' : undefined }} />
              <Statistic title="等级" value={detailRule.severity || '--'} />
              <Statistic title="发布版本" value={detailRule.versionText || '--'} />
            </div>
            <Descriptions size="small" bordered column={2} items={[
              { key: 'p', label: '产品', children: detailRule.productName },
              { key: 's', label: '状态', children: <Tag color={detailRule.status === '已发布' ? 'success' : 'default'}>{detailRule.status}</Tag> },
              { key: 'd', label: '台账设备', children: detailRule.deviceText },
              { key: 'io', label: 'IoT来源', children: detailRule.sourceText },
              { key: 'm', label: '指标', children: detailRule.metricText },
              { key: 't', label: '类型', children: detailRule.type },
              { key: 'c', label: '触发条件', children: detailRule.condition || '--', span: 2 },
              { key: 'r', label: '恢复条件', children: detailRule.recovery || '--', span: 2 },
              { key: 'sup', label: '重复抑制', children: detailRule.suppress || '--', span: 2 },
              { key: 'st', label: '风暴保护', children: detailRule.storm || '--', span: 2 },
            ]} />
            {detailRule.silenceConfig?.enabled && (
              <div style={hint}>
                静默时段：{(detailRule.silenceConfig.windows || []).map((w) => `${w.start} ~ ${w.end}`).join('、') || '--'}
              </div>
            )}
            <div style={hint}>
              更新时间 {detailRule.updatedAt || '--'} · 更新人 {detailRule.updatedBy || '--'}
              {detailRule.effectiveFrom ? ` · 生效自 ${detailRule.effectiveFrom}` : ''}
            </div>
          </Space>
        )}
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
                <Alert type="success" showIcon message={`已按当前配置（${conditionTextOf(testForm.triggerConfig)}）对 ${backtest.key} 最近 ${backtest.replay.points} 个采样点（60s 间隔）真实回放。`} />
              </>
            ) : (
              <>
                <Alert type="warning" showIcon style={{ marginBottom: 10 }}
                  message="无数据，不能完成回测"
                  description={`该目标（${backtest.key}）没有历史趋势采样点，无法按当前配置真实回放。下方为系统事件计数，不是回测结论。`} />
                <div style={{ fontSize: 12, color: '#8a97a3', marginBottom: 6 }}>近 7 天事件计数（系统统计，非回测结果）</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 8 }}>
                  <Statistic title="条件命中" value={(testRule.trig7d || 0) + (testRule.supp7d || 0)} suffix="次" />
                  <Statistic title="实际生成事件" value={testRule.trig7d || 0} suffix="条" valueStyle={{ color: '#00b8d4' }} />
                  <Statistic title="被抑制 / 合并" value={testRule.supp7d || 0} suffix="次" valueStyle={{ color: '#d97706' }} />
                </div>
              </>
            )}
          </>
        )}
      </Modal>

      {/* 批量编辑：可跨产品勾选，逐条校验（阈值按各自指标量程）后直接发布新版本 */}
      <Modal
        title={`批量编辑（${editableSelected.length} 条）`}
        width={640}
        open={beOpen}
        onOk={submitBatchEdit}
        onCancel={() => setBeOpen(false)}
        okText="批量发布新版本" cancelText="取消"
      >
        <Space direction="vertical" style={{ width: '100%' }} size={10}>
          <Alert type="info" showIcon
            message={<>将修改：{editableSelected.map((r) => r.code).join('、')}。留空的字段不修改；保存后逐条校验并<b>直接发布新版本</b>（校验不通过的条目保留原因不影响其余条目）。</>} />
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
        </Space>
      </Modal>
    </>
  );
}
