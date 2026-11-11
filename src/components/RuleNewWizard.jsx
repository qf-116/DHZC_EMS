import React from 'react';
import { Modal, Steps, Space, Select, Table, Tag, Button, Alert, App, Input } from 'antd';
import { Plus } from 'lucide-react';
import {
  createEmptyRuleForm, switchRuleFormType, formToRule, validateRuleDraft,
  resolveProductSources, listRuleProducts, planRuleBatch, finalizeRuleConfigs,
  resolveRuleTargets, normalizeMetricMeta, RULE_TYPE_LABEL,
} from '../domain/alarmRule.js';
import { metricAlarmTemplates } from '../data/demoData.js';
import { iotProducts } from '../data/demo/bindings.js';
import RuleFormBody from './RuleFormBody.jsx';

// 新增报警规则向导（2026-11-04 定稿为三步）：
// ① 选设备：产品 → 该产品下的物联网平台设备（多选，反查绑定台账设备）
// ② 选指标：表格列出所选设备共同接入的指标（列：指标名称 / 编码 / 类型〔数值|状态〕/ 覆盖台数），
//    支持按指标名称关键词与类型（数值 / 状态）筛选，单选一个指标
// ③ 配条件：规则类型（按指标类型自动带出，可改）→ 名称格式 / 等级 → 判定 / 恢复 / 治理参数；
//    提交即一次性创建并发布（无草稿态），同目标已存在的条目跳过、结果逐条提示
const NAME_TEMPLATES = [
  { value: '{device}{metric}超限报警', label: '{设备}{指标}超限报警' },
  { value: '{device}{metric}报警', label: '{设备}{指标}报警' },
  { value: '{device} {metric} 超限报警', label: '{设备} {metric} 超限报警' },
  { value: '{device}{metric}过低报警', label: '{设备}{metric}过低报警' },
  { value: '{device}质量异常报警', label: '{设备}质量异常报警' },
];

const RULE_TYPES = [
  { value: 'threshold', label: '阈值规则（指标阈值）' },
  { value: 'state', label: '状态规则（状态枚举）' },
  { value: 'quality', label: '质量规则（通信健康）' },
  { value: 'combo', label: '组合规则（多子条件）' },
];

const METRIC_TYPE_LABEL = { number: '数值', state: '状态' };

export default function RuleNewWizard({ open, onClose, state, actions, onDone }) {
  const { message } = App.useApp();
  const E = state.entities;
  const [step, setStep] = React.useState(0);
  const [ruleType, setRuleType] = React.useState('threshold');
  const [product, setProduct] = React.useState(null);
  const [selectedKeys, setSelectedKeys] = React.useState([]);
  const [metricCode, setMetricCode] = React.useState(null);
  // ② 选指标的筛选条件（页面内实时过滤）
  const [metricKw, setMetricKw] = React.useState('');
  const [metricType, setMetricType] = React.useState('all');
  const [form, setForm] = React.useState(() => createEmptyRuleForm());
  const [submitAttempted, setSubmitAttempted] = React.useState(false);

  const reset = () => {
    setStep(0);
    setRuleType('threshold');
    setProduct(null);
    setSelectedKeys([]);
    setMetricCode(null);
    setMetricKw('');
    setMetricType('all');
    setForm(createEmptyRuleForm());
    setSubmitAttempted(false);
  };
  React.useEffect(() => { if (open) reset(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [open]);

  const patch = (p) => setForm((f) => ({ ...f, ...p }));
  const patchTrigger = (p) => setForm((f) => ({ ...f, triggerConfig: { ...f.triggerConfig, ...p } }));
  const patchRecoveryCondition = (p) => setForm((f) => ({ ...f, recoveryConfig: { ...f.recoveryConfig, condition: { ...f.recoveryConfig.condition, ...p } } }));

  const userTypeRef = React.useRef(false); // 用户是否手动改过规则类型（手动后不再按指标类型自动带出）
  // 规则类型切换：状态 / 质量 / 组合的恢复口径随类型确定
  const changeRuleType = (t) => {
    userTypeRef.current = true;
    setRuleType(t);
    setForm((f) => {
      const next = switchRuleFormType(f, t);
      if (t === 'state') next.recoveryConfig = { ...next.recoveryConfig, condition: { ...next.recoveryConfig.condition, type: 'state', normalValues: [] } };
      if (t === 'quality') next.recoveryConfig = { ...next.recoveryConfig, condition: { ...next.recoveryConfig.condition, type: 'quality', requiredQualityCode: 'GOOD' } };
      if (t === 'combo') next.recoveryConfig = { ...next.recoveryConfig, condition: { ...next.recoveryConfig.condition, type: 'state', normalValues: [] } };
      return next;
    });
  };

  // ① 选设备：产品下拉 = 来源设备上的产品 ∪ 物联网平台产品目录（合并去重、按来源设备数降序）
  const products = React.useMemo(() => {
    const map = new Map(listRuleProducts(state).map((p) => [p.product, p]));
    iotProducts.forEach((p) => { if (!map.has(p.product)) map.set(p.product, { product: p.product, sourceCount: 0 }); });
    return [...map.values()].sort((x, y) => y.sourceCount - x.sourceCount);
  }, [state]);
  const sourceRows = React.useMemo(
    () => (product ? resolveProductSources(state, product) : []),
    [state, product]
  );
  const selectableRows = React.useMemo(() => sourceRows.filter((r) => r.enabled), [sourceRows]);
  const selectedRows = React.useMemo(
    () => selectedKeys.map((k) => selectableRows.find((r) => r.key === k)).filter(Boolean),
    [selectedKeys, selectableRows]
  );
  // ② 选指标：所选设备已接入指标的交集（同一产品物模型一致）；带「数值 / 状态」类型
  const metricOptions = React.useMemo(() => {
    if (selectedRows.length === 0) return [];
    const counts = new Map();
    selectedRows.forEach((r) => r.metrics.forEach((m) => counts.set(m, (counts.get(m) || 0) + 1)));
    return [...counts.entries()]
      .map(([code, n]) => {
        const metric = normalizeMetricMeta(E.metricsByKey[code]);
        return { code, count: n, metric, dataType: metric?.dataType || 'number' };
      })
      .sort((a, b) => b.count - a.count);
  }, [selectedRows, E.metricsByKey]);
  // 指标筛选：名称 / 编码关键词 + 类型（数值 / 状态）
  const filteredMetricOptions = React.useMemo(() => metricOptions.filter((m) => {
    const k = metricKw.trim().toLowerCase();
    if (k && !`${m.metric?.name || ''} ${m.code}`.toLowerCase().includes(k)) return false;
    if (metricType !== 'all' && m.dataType !== metricType) return false;
    return true;
  }), [metricOptions, metricKw, metricType]);
  const selectedMetric = metricCode ? normalizeMetricMeta(E.metricsByKey[metricCode]) : null;
  // 组合规则的子条件可选目标（全站启用绑定下的可用目标）
  const allTargets = React.useMemo(() => resolveRuleTargets(state), [state]);
  const comboCascadeOptions = React.useMemo(() => {
    const devMap = new Map();
    allTargets.forEach((t) => {
      if (!devMap.has(t.deviceId)) devMap.set(t.deviceId, { value: t.deviceId, label: `${t.deviceId} ${t.deviceName}`, children: new Map() });
      const dev = devMap.get(t.deviceId);
      if (!dev.children.has(t.sourceId)) dev.children.set(t.sourceId, { value: t.sourceId, label: t.sourceCode, children: [] });
      dev.children.get(t.sourceId).children.push({ value: t.metricCode, label: `${t.metricCode} ${t.metric.name}` });
    });
    return [...devMap.values()].map((d) => ({ value: d.value, label: d.label, children: [...d.children.values()] }));
  }, [allTargets]);

  // 选定指标后自动带出规则类型（数值指标→阈值、状态类指标→状态）；用户手动改过则以手选为准
  React.useEffect(() => {
    if (!metricCode) return;
    const meta = normalizeMetricMeta(E.metricsByKey[metricCode]);
    if (!userTypeRef.current) {
      if ((meta?.dataType) === 'state') setRuleType('state');
      else setRuleType('threshold');
    }
  }, [metricCode]); // eslint-disable-line react-hooks/exhaustive-deps

  // 选定指标后带出推荐参数（指标特征模板）
  React.useEffect(() => {
    if (!metricCode) return;
    const t = metricAlarmTemplates[metricCode];
    setForm((f) => ({
      ...f,
      triggerConfig: { ...f.triggerConfig, unit: selectedMetric?.unit || null },
      recoveryConfig: { ...f.recoveryConfig, condition: { ...f.recoveryConfig.condition, unit: selectedMetric?.unit || null } },
    }));
    if (t && t.mode && t.mode !== 'state' && ruleType === 'threshold') {
      setForm((f) => ({
        ...f,
        triggerConfig: {
          ...f.triggerConfig,
          mode: t.mode === 'lower' ? 'lower' : t.mode === 'rangeOut' ? 'rangeOut' : 'upper',
          operator: t.mode === 'lower' ? '<' : '>',
          threshold: t.threshold ?? f.triggerConfig.threshold,
          low: t.low ?? f.triggerConfig.low,
          high: t.high ?? f.triggerConfig.high,
          durationSec: t.duration ?? f.triggerConfig.durationSec,
        },
        recoveryConfig: {
          ...f.recoveryConfig,
          condition: {
            ...f.recoveryConfig.condition,
            direction: t.mode === 'lower' ? 'lower' : 'upper',
            triggerValue: t.threshold ?? null,
            deadband: t.deadband ?? f.recoveryConfig.condition.deadband,
          },
        },
      }));
    }
  }, [metricCode, ruleType]); // eslint-disable-line react-hooks/exhaustive-deps

  // 状态规则：正常枚举即恢复口径（与触发配置的正常状态保持一致）
  React.useEffect(() => {
    if (ruleType !== 'state') return;
    setForm((f) => {
      if (f.recoveryConfig.condition.type === 'state'
        && JSON.stringify(f.recoveryConfig.condition.normalValues) === JSON.stringify(f.triggerConfig.normalValues || [])) return f;
      return { ...f, recoveryConfig: { ...f.recoveryConfig, condition: { ...f.recoveryConfig.condition, type: 'state', normalValues: f.triggerConfig.normalValues || [] } } };
    });
  }, [ruleType, form.triggerConfig.normalValues]);

  // 名称模板
  const [nameTemplate, setNameTemplate] = React.useState(NAME_TEMPLATES[0].value);
  React.useEffect(() => {
    if (ruleType === 'quality') setNameTemplate('{device}质量异常报警');
    else if (ruleType === 'combo') setNameTemplate('{device}组合条件报警');
    else setNameTemplate(NAME_TEMPLATES[0].value);
  }, [ruleType]);

  // 组合规则的主目标 = 第一个子条件目标
  const comboPrimary = form.triggerConfig.conditions?.[0]?.target || null;

  // 逐设备生成规则（N 对 N）：用于底部「创建并发布 N 条」计数与提交
  const preview = React.useMemo(() => {
    if (selectedRows.length === 0) return { rows: [], summary: null };
    const request = {
      type: RULE_TYPE_LABEL[ruleType],
      nameTemplate,
      severity: form.severity,
      triggerConfig: form.triggerConfig,
      recoveryConfig: form.recoveryConfig,
      suppressionConfig: form.suppressionConfig,
      stormConfig: form.stormConfig,
      silenceConfig: form.silenceConfig,
      qualityPolicy: form.qualityPolicy,
    };
    let targets;
    if (ruleType === 'quality') {
      targets = selectedRows.map((r) => ({
        deviceId: r.deviceId,
        deviceName: r.deviceName,
        sourceId: null,
        sourceCode: r.sourceCode,
        metricCode: null,
        bindingId: r.bindingId,
        bindingVersion: r.bindingVersion,
      }));
    } else if (ruleType === 'combo') {
      targets = comboPrimary ? [{
        deviceId: comboPrimary.deviceId,
        deviceName: allTargets.find((t) => t.deviceId === comboPrimary.deviceId)?.deviceName || comboPrimary.deviceId,
        sourceId: comboPrimary.sourceId,
        sourceCode: comboPrimary.sourceId,
        metricCode: comboPrimary.metricCode,
      }] : [];
    } else {
      targets = selectedRows.map((r) => ({
        deviceId: r.deviceId,
        deviceName: r.deviceName,
        sourceId: r.sourceId,
        sourceCode: r.sourceCode,
        metricCode,
        bindingId: r.bindingId,
        bindingVersion: r.bindingVersion,
        metricVersion: selectedMetric?.metricVersion || null,
      }));
    }
    return planRuleBatch(state, request, targets);
  }, [state, selectedRows, metricCode, nameTemplate, form, selectedMetric, ruleType, comboPrimary, allTargets]);

  // 参数校验（对所选指标量程一次性校验；组合规则校验子条件）
  const paramValidation = React.useMemo(() => {
    if (!metricCode && ruleType !== 'quality' && ruleType !== 'combo') return { errors: [], warnings: [] };
    const probe = {
      code: 'R-PROBE',
      name: `${selectedRows[0]?.deviceName || '设备'}${selectedMetric?.name || ''}报警`,
      type: RULE_TYPE_LABEL[ruleType],
      severity: form.severity,
      target: ruleType === 'combo'
        ? (comboPrimary ? { ...comboPrimary } : { deviceId: null, sourceId: null, metricCode: null })
        : ruleType === 'quality'
          ? { deviceId: selectedRows[0]?.deviceId, sourceId: null, metricCode: null }
          : {
            deviceId: selectedRows[0]?.deviceId,
            bindingId: selectedRows[0]?.bindingId,
            bindingVersion: selectedRows[0]?.bindingVersion,
            sourceId: selectedRows[0]?.sourceId,
            sourceCode: selectedRows[0]?.sourceCode,
            metricCode,
          },
      triggerConfig: form.triggerConfig,
      recoveryConfig: form.recoveryConfig,
      notificationConfig: null,
      suppressionConfig: form.suppressionConfig,
      stormConfig: form.stormConfig,
      silenceConfig: form.silenceConfig,
      qualityPolicy: form.qualityPolicy,
    };
    return validateRuleDraft(probe, {
      devicesById: E.devicesById, bindingsByDeviceId: E.bindingsByDeviceId, metricsByKey: E.metricsByKey, alarmRulesById: E.alarmRulesById,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form, metricCode, selectedRows, selectedMetric, ruleType, comboPrimary]);

  const needMetric = ruleType === 'threshold' || ruleType === 'state';
  const step2Ready = paramValidation.errors.length === 0;
  const creatable = preview.summary?.creatable || 0;

  const goNext = () => {
    if (step === 0) {
      if (!product) { message.warning('请先选择产品'); return; }
      if (selectedRows.length === 0) { message.warning('请至少勾选一台物联网设备'); return; }
      setStep(1);
      return;
    }
    if (step === 1) {
      if (!metricCode) { message.warning('请选择一个指标'); return; }
      setStep(2);
    }
  };

  // 提交前校验：类型与指标匹配、参数校验
  const preSubmitCheck = () => {
    const meta = metricCode ? normalizeMetricMeta(E.metricsByKey[metricCode]) : null;
    if (metricCode && ruleType === 'threshold' && meta?.dataType !== 'number') { message.warning('阈值规则需要数值类指标，请返回第二步重新选择指标或调整规则类型'); return false; }
    if (metricCode && ruleType === 'state' && meta?.dataType !== 'state') { message.warning('状态规则需要状态类指标（S.*），请返回第二步重新选择指标或调整规则类型'); return false; }
    return true;
  };

  const submit = () => {
    setSubmitAttempted(true);
    if (!preSubmitCheck()) return;
    if (!step2Ready) { message.warning('请先修正参数问题'); return; }
    const rules = preview.rows
      .filter((r) => r.result === 'creatable')
      .map((r) => {
        const base = formToRule(form);
        const src = selectedRows.find((x) => x.deviceId === r.deviceId && (ruleType === 'quality' || x.sourceId === r.sourceId));
        const target = ruleType === 'quality'
          ? { deviceId: r.deviceId, bindingId: src?.bindingId || null, bindingVersion: src?.bindingVersion || null, sourceId: null, sourceCode: null, metricCode: null }
          : {
            deviceId: r.deviceId,
            bindingId: src?.bindingId || null,
            bindingVersion: src?.bindingVersion || null,
            sourceId: r.sourceId,
            sourceCode: r.sourceCode,
            metricCode: r.metricCode,
            metricVersion: selectedMetric?.metricVersion || null,
          };
        finalizeRuleConfigs(base.triggerConfig, base.recoveryConfig);
        return {
          ...base,
          code: r.code,
          name: r.name,
          type: RULE_TYPE_LABEL[ruleType],
          target,
          metricCode: r.metricCode,
          condition: undefined,
          recovery: undefined,
        };
      });
    const res = actions.createRules(rules);
    if (!res.ok) { message.error(res.message); return; }
    const failed = (res.refs?.rows || []).filter((x) => x.result !== 'created');
    message.success(res.message);
    if (failed.length) {
      Modal.info({
        title: '批量创建结果（逐条）',
        width: 560,
        content: (
          <div style={{ fontSize: 13, lineHeight: 2 }}>
            {failed.map((x) => <div key={x.code}>· {x.code}：{x.reason}</div>)}
          </div>
        ),
      });
    }
    onDone?.();
    onClose();
  };

  return (
    <Modal
      title="新增报警规则"
      width={960}
      open={open}
      onCancel={() => { onClose(); }}
      footer={[
        <Button key="cancel" onClick={() => { if (step === 0) onClose(); else setStep(step - 1); }}>
          {step === 0 ? '取消' : '上一步'}
        </Button>,
        step < 2
          ? <Button key="next" type="primary" onClick={goNext}>下一步</Button>
          : <Button key="submit" type="primary" icon={<Plus size={14} />} onClick={submit} disabled={creatable === 0}>
            {creatable === 0 ? '无可创建规则' : `创建并发布 ${creatable} 条规则`}
          </Button>,
      ]}
    >
      <Steps
        current={step}
        size="small"
        style={{ marginBottom: 16 }}
        items={[{ title: '① 选设备' }, { title: '② 选指标' }, { title: '③ 配条件' }]}
      />
      {/* 内容区固定高度：三步弹窗大小保持一致，不随步骤内容增减跳动 */}
      <div style={{ height: '56vh', overflowY: 'auto', paddingRight: 6 }}>
        {step === 0 && (
          <Space direction="vertical" style={{ width: '100%' }} size={12}>
            <Space wrap>
              <span>产品</span>
              <Select
                style={{ width: 240 }}
                placeholder="选择产品（物联网平台产品目录）"
                value={product || undefined}
                onChange={(v) => { setProduct(v); setSelectedKeys([]); setMetricCode(null); }}
                options={products.map((p) => ({ value: p.product, label: `${p.product}（${p.sourceCount} 台物联网设备）` }))}
                showSearch
                optionFilterProp="label"
              />
            </Space>
            {product && (
              <>
                <div style={{ fontSize: 12, color: '#5d6b78' }}>
                  该产品下的物联网平台设备（勾选后按「物联网设备 → 绑定台账设备」反查，确定是哪台设备在报警）
                </div>
                <Table
                  rowKey="key"
                  size="small"
                  pagination={false}
                  dataSource={sourceRows}
                  rowSelection={{
                    selectedRowKeys: selectedKeys,
                    onChange: setSelectedKeys,
                    getCheckboxProps: (r) => ({ disabled: !r.enabled }),
                  }}
                  columns={[
                    { title: '物联网平台设备标识码', dataIndex: 'sourceCode', width: 170 },
                    { title: '物联网平台设备名称', dataIndex: 'sourceName', width: 180 },
                    { title: '绑定台账设备', width: 200, render: (_, r) => (r.deviceId ? `${r.deviceId} ${r.deviceName}` : <span style={{ color: '#8a97a3' }}>未绑定</span>) },
                    { title: '绑定状态', dataIndex: 'bindingStatus', width: 90, render: (v, r) => <Tag color={r.enabled ? 'success' : 'default'}>{v}</Tag> },
                    { title: '已接入指标数', width: 100, render: (_, r) => r.metrics.length },
                    { title: '说明', width: 160, render: (_, r) => (r.reason ? <span style={{ color: '#d97706' }}>{r.reason}</span> : <span style={{ color: '#8a97a3' }}>可选</span>) },
                  ]}
                />
                <div style={{ fontSize: 12, color: '#8a97a3' }}>
                  已选 {selectedRows.length} 台物联网设备；指标在下一步选择
                </div>
              </>
            )}
          </Space>
        )}

        {step === 1 && (
          <Space direction="vertical" style={{ width: '100%' }} size={12}>
            <div style={{ fontSize: 12, color: '#5d6b78' }}>
              列出已选 {selectedRows.length} 台设备共同接入的指标，选择一个作为报警判定指标（可按名称 / 类型筛选）
            </div>
            <Space wrap>
              <Input
                allowClear
                style={{ width: 220 }}
                placeholder="指标名称 / 编码"
                value={metricKw}
                onChange={(e) => setMetricKw(e.target.value)}
              />
              <Select
                style={{ width: 130 }}
                value={metricType}
                onChange={setMetricType}
                options={[
                  { value: 'all', label: '全部类型' },
                  { value: 'number', label: '数值' },
                  { value: 'state', label: '状态' },
                ]}
              />
              <Button onClick={() => { setMetricKw(''); setMetricType('all'); }}>重置</Button>
            </Space>
            <Table
              rowKey="code"
              size="small"
              pagination={false}
              dataSource={filteredMetricOptions}
              locale={{ emptyText: '没有符合筛选条件的指标' }}
              rowSelection={{
                type: 'radio',
                selectedRowKeys: metricCode ? [metricCode] : [],
                onChange: (keys) => setMetricCode(keys[0] || null),
              }}
              columns={[
                { title: '指标名称', width: 170, render: (_, m) => m.metric?.name || m.code },
                { title: '指标编码', dataIndex: 'code', width: 160 },
                { title: '类型', width: 90, render: (_, m) => (m.dataType === 'state' ? <Tag color="processing">状态</Tag> : <Tag color="success">数值</Tag>) },
                { title: '覆盖台数', width: 100, align: 'center', render: (_, m) => `${m.count}/${selectedRows.length} 台` },
                { title: '单位', width: 80, render: (_, m) => m.metric?.unit || '--' },
              ]}
            />
          </Space>
        )}

        {step === 2 && (
          <Space direction="vertical" style={{ width: '100%' }} size={12}>
            <Space wrap>
              <span>规则类型</span>
              <Select
                style={{ width: 200 }}
                value={ruleType}
                onChange={changeRuleType}
                options={RULE_TYPES}
              />
              <span>规则名称格式</span>
              <Select
                style={{ width: 260 }}
                value={nameTemplate}
                onChange={setNameTemplate}
                options={NAME_TEMPLATES.map((t) => ({ value: t.value, label: t.label }))}
              />
              <span>等级</span>
              <Select
                style={{ width: 90 }}
                value={form.severity}
                onChange={(v) => patch({ severity: v })}
                options={['紧急', '重要', '一般', '提示'].map((v) => ({ value: v, label: v }))}
              />
            </Space>
            {submitAttempted && paramValidation.errors.length > 0 && (
              <Alert type="error" showIcon message={<>保存前需修正以下问题：<br />{paramValidation.errors.map((e, i) => <div key={i}>· {e}</div>)}</>} />
            )}
            {submitAttempted && paramValidation.warnings.length > 0 && (
              <Alert type="warning" showIcon message={<>提示：<br />{paramValidation.warnings.map((e, i) => <div key={i}>· {e}</div>)}</>} />
            )}
            <RuleFormBody
              form={form}
              patch={patch}
              patchTrigger={patchTrigger}
              patchRecoveryCondition={patchRecoveryCondition}
              changeRuleType={changeRuleType}
              changeTarget={() => {}}
              currentTarget={{
                deviceId: ruleType === 'combo' ? comboPrimary?.deviceId : selectedRows[0]?.deviceId,
                sourceId: ruleType === 'combo' ? comboPrimary?.sourceId : selectedRows[0]?.sourceId,
                metricCode: ruleType === 'combo' ? comboPrimary?.metricCode : metricCode,
                metric: ruleType === 'combo'
                  ? allTargets.find((t) => t.deviceId === comboPrimary?.deviceId && t.metricCode === comboPrimary?.metricCode)?.metric
                  : selectedMetric,
              }}
              cascadeOptions={comboCascadeOptions}
              cascadeStateOptions={comboCascadeOptions}
              enumOptions={(selectedMetric?.enumValues || []).map((v) => ({ value: v, label: v }))}
              deviceOptions={[]}
              targets={allTargets}
              showTarget={false}
              showTypeSelect={false}
            />
          </Space>
        )}
      </div>
    </Modal>
  );
}
