import React from 'react';
import { Card, Table, Tag, Button, Space, Select, App, Modal, Form, Input, InputNumber, Tooltip, Alert } from 'antd';

import { Plus, AppWindow, Edit3, Trash2 } from 'lucide-react';
import PageHeader from '../components/PageHeader.jsx';
import { notificationRows } from '../data/demoData.js';
import { useDemoState, useDemoActions } from '../state/DemoStore.jsx';
import { resolveRuleTargets, conditionTextOf, recoveryTextOf } from '../domain/alarmRule.js';

// 报警规则模板管理（P2 模板持久化）：模板实体存于 DemoStore（entities.ruleTemplatesById），
// 增删改经 actions → reducer 留痕；「应用到设备」按设备启用绑定匹配适用指标，
// 复用批量创建链路逐目标校验、只生成草稿（独立批次、幂等）。
// 模板更新不回写已发布规则——规则发布是不可变版本快照，模板仅作为生成时的初始值。

export default function RuleTemplatePage() {
  const { message, modal } = App.useApp();
  const state = useDemoState();
  const actions = useDemoActions();
  const E = state.entities;

  const [open, setOpen] = React.useState(false);
  const [editing, setEditing] = React.useState(null);
  const [applyRow, setApplyRow] = React.useState(null);
  const [applyDevices, setApplyDevices] = React.useState([]);
  const [applying, setApplying] = React.useState(false);
  const [form] = Form.useForm();

  const targets = React.useMemo(() => resolveRuleTargets(state), [state]);
  const templates = Object.values(E.ruleTemplatesById || {});
  // 查询条件（前端过滤）：名称/适用指标关键字 + 状态
  const [qKw, setQKw] = React.useState('');
  const [qStatus, setQStatus] = React.useState(null);
  const kw = qKw.trim();
  const filteredTemplates = React.useMemo(() => templates.filter((t) => (!kw
    || [t.name, t.metricType, ...(t.applicableMetricCodes || [])].some((v) => String(v || '').includes(kw)))
    && (!qStatus || t.status === qStatus)), [templates, kw, qStatus]);

  // 引用计数：按模板生成的规则数（含草稿/已发布）
  const refsOf = (templateId) => Object.values(E.alarmRulesById || {}).filter((r) => r.templateId === templateId).length;

  const openModal = (record) => {
    setEditing(record || null);
    form.resetFields();
    if (record) {
      const tc = record.triggerConfig || {};
      form.setFieldsValue({
        name: record.name,
        metricType: record.metricType,
        mode: tc.mode || (tc.type === 'state' ? 'state' : 'upper'),
        threshold: tc.threshold,
        low: tc.low,
        high: tc.high,
        duration: tc.durationSec ?? 60,
        deadband: record.recoveryConfig?.condition?.deadband ?? 5,
        remind: record.suppressionConfig?.remindIntervalMin ?? 5,
        storm: record.stormConfig?.maxEvents ?? 3,
        policy: record.notificationConfig?.policyCode || 'NP-IMPORTANT',
        remark: record.remark,
        status: record.status || '启用',
      });
    }
    setOpen(true);
  };

  const handleSubmit = async () => {
    const v = await form.validateFields();
    const unit = v.applicableMetricCodes?.length
      ? (targets.find((t) => t.metricCode === v.applicableMetricCodes[0])?.metric.unit || '')
      : '';
    const isState = v.mode === 'state';
    const isRange = v.mode === 'rangeOut' || v.mode === 'rangeIn';
    const triggerConfig = isState
      ? { type: 'state', abnormalValues: v.abnormalValues || ['故障'], normalValues: v.normalValues || ['运行', '待机'], durationSec: 0, unit: null }
      : {
        type: 'threshold',
        mode: v.mode,
        operator: v.mode === 'lower' ? '<' : '>',
        threshold: isRange ? null : v.threshold,
        low: isRange ? v.low : null,
        high: isRange ? v.high : null,
        unit,
        durationSec: v.duration,
      };
    const recoveryConfig = isState
      ? {
        mode: 'auto', closeMode: 'auto',
        condition: { type: 'state', normalValues: v.normalValues || ['运行', '待机'] },
        stabilize: { durationSec: 0, qualityRequired: 'GOOD', invalidDataPolicy: 'hold', rebreachPolicy: 'resetTimer' },
        notifyOnRecover: true,
      }
      : isRange
        ? {
          mode: 'auto', closeMode: 'auto',
          condition: { type: 'range', lowDeadband: v.deadband, highDeadband: v.deadband, recoveryLow: null, recoveryHigh: null, unit },
          stabilize: { durationSec: 30, qualityRequired: 'GOOD', invalidDataPolicy: 'hold', rebreachPolicy: 'resetTimer' },
          notifyOnRecover: true,
        }
        : {
          mode: 'auto', closeMode: 'auto',
          condition: { type: 'hysteresis', direction: v.mode === 'lower' ? 'lower' : 'upper', thresholdMode: 'deadband', triggerValue: v.threshold ?? null, recoveryValue: null, deadband: v.deadband, unit },
          stabilize: { durationSec: 30, qualityRequired: 'GOOD', invalidDataPolicy: 'hold', rebreachPolicy: 'resetTimer' },
          notifyOnRecover: true,
        };
    const tpl = notificationRows.find((n) => n.code === v.policy) || notificationRows[1];
    const notificationConfig = {
      policyCode: tpl.code,
      overridden: false,
      channels: tpl.channels.split(' / '),
      receivers: tpl.receivers.split('、'),
      first: tpl.first,
      interval: tpl.interval,
      escalation: tpl.escalation,
      silent: tpl.silent === '无' ? '' : tpl.silent,
      retries: tpl.retries,
    };
    const res = actions.saveRuleTemplate({
      templateId: editing?.templateId,
      name: v.name,
      metricType: v.metricType,
      applicableMetricCodes: v.applicableMetricCodes || [],
      status: v.status || '启用',
      remark: v.remark || '',
      triggerConfig,
      recoveryConfig,
      notificationConfig,
      suppressionConfig: { mergeActiveEvent: true, countRepeatedTrigger: true, remindEnabled: true, remindIntervalMin: v.remind, maxRemindCount: null, createNewAfterClose: true },
      stormConfig: { enabled: true, windowMin: 60, maxEvents: v.storm, scope: 'sameRule', overflowAction: 'merge' },
      silenceConfig: { source: 'template', enabled: false, windows: [] },
    });
    message[res.ok ? 'success' : 'error'](res.message);
    if (res.ok) setOpen(false);
  };

  const confirmDelete = (r) => modal.confirm({
    title: '删除规则模板',
    content: refsOf(r.templateId) > 0
      ? `模板「${r.name}」已被 ${refsOf(r.templateId)} 条规则引用。删除模板不影响已发布规则（规则为不可变版本快照），但后续无法再从该模板导入，确定删除吗？`
      : `确定删除模板「${r.name}」吗？删除后不可恢复。`,
    okText: '删除', okButtonProps: { danger: true }, cancelText: '取消',
    onOk: () => {
      const res = actions.deleteRuleTemplate(r.templateId);
      message[res.ok ? 'success' : 'error'](res.message);
    },
  });

  // 应用到设备：按各设备启用绑定匹配适用指标，逐 (设备, 指标) 生成独立草稿（复用批量创建链路，按指标分批）
  const submitApply = () => {
    if (!applyDevices.length) { message.warning('请选择要应用的设备'); return; }
    setApplying(true);
    try {
      const codes = applyRow.applicableMetricCodes || [];
      const pairs = [];
      applyDevices.forEach((deviceId) => {
        codes.forEach((metricCode) => {
          const t = targets.find((x) => x.deviceId === deviceId && x.metricCode === metricCode);
          if (t) pairs.push(t);
        });
      });
      if (!pairs.length) {
        message.warning('所选设备中没有启用绑定匹配到模板适用指标；请先在联网配置中启用对应指标');
        return;
      }
      const byMetric = new Map();
      pairs.forEach((t) => {
        if (!byMetric.has(t.metricCode)) byMetric.set(t.metricCode, []);
        byMetric.get(t.metricCode).push(t);
      });
      const results = [];
      let created = 0;
      let skipped = 0;
      let blocked = 0;
      byMetric.forEach((list, metricCode) => {
        const unit = list[0]?.metric.unit || '';
        const tc = structuredClone(applyRow.triggerConfig);
        if (tc.type === 'threshold') tc.unit = unit;
        const rc = structuredClone(applyRow.recoveryConfig);
        if (rc.condition) rc.condition.unit = unit;
        const res = actions.commitBatchDraft({
          name: `${applyRow.name} · ${metricCode}`,
          metricCode,
          severity: '重要',
          triggerConfig: tc,
          recoveryConfig: rc,
          notificationConfig: applyRow.notificationConfig,
          suppressionConfig: applyRow.suppressionConfig,
          stormConfig: applyRow.stormConfig,
          silenceConfig: applyRow.silenceConfig,
          templateId: applyRow.templateId,
          targets: list,
        });
        if (res.ok) {
          created += res.refs.created || 0;
          skipped += res.refs.skipped || 0;
          blocked += res.refs.blocked || 0;
          results.push(`${metricCode}：草稿 ${res.refs.created}（批次 ${res.refs.batchId}）`);
        } else {
          results.push(`${metricCode}：${res.message}`);
        }
      });
      setApplyRow(null);
      setApplyDevices([]);
      Modal.info({
        title: '模板应用完成（只生成草稿）',
        width: 520,
        content: (
          <div style={{ fontSize: 13, lineHeight: 2 }}>
            <div>生成草稿 {created} 条，已有规则跳过 {skipped}，阻断 {blocked}。</div>
            {results.map((r) => <div key={r} style={{ fontSize: 12, color: '#5d6b78' }}>· {r}</div>)}
            <div style={{ marginTop: 8, fontSize: 12, color: '#8a97a3' }}>草稿已入库（DemoStore 批次记录），请到「报警规则配置」逐条确认参数后发布。</div>
          </div>
        ),
      });
    } finally {
      setApplying(false);
    }
  };

  const columns = [
    { title: '模板编号', dataIndex: 'templateId', width: 120 },
    { title: '模板名称', dataIndex: 'name', width: 190 },
    { title: '适用指标', dataIndex: 'metricType', width: 220, render: (v, r) => (
      <div>
        <div>{v}</div>
        <div style={{ fontSize: 11, color: '#8a97a3' }}>{(r.applicableMetricCodes || []).join('、')}</div>
      </div>
    ) },
    { title: '触发条件', width: 200, render: (_, r) => conditionTextOf(r.triggerConfig) },
    { title: '恢复条件（迟滞）', width: 240, render: (_, r) => recoveryTextOf(r.recoveryConfig, r.triggerConfig) },
    { title: '重复提醒', width: 90, render: (_, r) => `${r.suppressionConfig?.remindIntervalMin ?? '--'} 分钟/次` },
    { title: '风暴限流', width: 90, render: (_, r) => `≤ ${r.stormConfig?.maxEvents ?? '--'} 条/小时` },
    { title: '通知策略', width: 120, render: (_, r) => r.notificationConfig?.policyCode || '--' },
    { title: '引用规则数', key: 'refs', width: 100, render: (_, r) => {
      const n = refsOf(r.templateId);
      return n > 0 ? <Tooltip title={`已按该模板生成 ${n} 条规则；模板更新不回写已发布规则`}>{n} 条</Tooltip> : '--';
    } },
    { title: '状态', dataIndex: 'status', width: 80, render: (v) => <Tag color={v === '启用' ? 'success' : 'default'}>{v}</Tag> },
    { title: '备注', dataIndex: 'remark', minWidth: 200 },
    { title: '操作', fixed: 'right', width: 220, render: (_, r) => (
      <Space size={0}>
        <Button type="link" size="small" icon={<AppWindow size={12} />} onClick={() => { setApplyRow(r); setApplyDevices([]); }}>应用到设备</Button>
        <Button type="link" size="small" icon={<Edit3 size={12} />} onClick={() => openModal(r)}>编辑</Button>
        <Button type="link" size="small" danger icon={<Trash2 size={12} />} onClick={() => confirmDelete(r)}>删除</Button>
      </Space>
    ) },
  ];

  const applicableOptions = React.useMemo(() => {
    const seen = new Map();
    targets.forEach((t) => { if (!seen.has(t.metricCode)) seen.set(t.metricCode, { value: t.metricCode, label: `${t.metricCode} ${t.metric.name}` }); });
    return [...seen.values()];
  }, [targets]);

  return (
    <>
      <PageHeader
        title="报警规则模板"
        subtitle="模板实体存于 DemoStore · 增删改真实落库 · 应用 = 选模板 + 选设备 + 匹配启用绑定指标 · 只生成草稿 · 模板更新不回写已发布规则"
      />
      {/* 筛选卡：查询条件独立在列表卡上方 */}
      <Card size="small" style={{ marginBottom: 12 }}>
        <Space wrap>
          <Input style={{ width: 240 }} allowClear placeholder="搜索：模板名称 / 适用指标" value={qKw} onChange={(e) => setQKw(e.target.value)} />
          <Select style={{ width: 110 }} placeholder="状态" allowClear value={qStatus} onChange={setQStatus}
            options={['启用', '停用'].map((v) => ({ value: v, label: v }))} />
          <Button onClick={() => { setQKw(''); setQStatus(null); }}>重置</Button>
          <span style={{ fontSize: 12, color: '#8a97a3' }}>共 {filteredTemplates.length} 条</span>
        </Space>
      </Card>
      {/* 列表卡：操作工具栏 → 表格 */}
      <Card size="small">
        <Space wrap style={{ marginBottom: 12 }}>
          <Button type="primary" icon={<Plus size={14} />} onClick={() => openModal(null)}>新增模板</Button>
          <Alert type="info" showIcon style={{ padding: '2px 10px' }} message="模板在「报警规则配置」保存规则时也可一键沉淀（存为模板）" />
        </Space>
        <Table
          rowKey="templateId" size="small" scroll={{ x: 2100 }}
          dataSource={filteredTemplates}
          columns={columns}
          pagination={{ pageSize: 10, showTotal: (t) => `共 ${t} 条` }}
        />
      </Card>

      {/* 新增 / 编辑模板（弹窗）：结构化参数，保存即入 DemoStore */}
      <Modal
        title={editing ? `编辑模板（${editing.templateId}）` : '新增规则模板'}
        width={680}
        open={open}
        onOk={handleSubmit}
        onCancel={() => setOpen(false)}
        okText="保存" cancelText="取消"
        destroyOnHidden
      >
        <div style={{ maxHeight: '60vh', overflowY: 'auto', paddingRight: 8 }}>
          <Form form={form} layout="vertical" initialValues={{ mode: 'upper', duration: 60, deadband: 5, remind: 5, storm: 3, policy: 'NP-IMPORTANT', status: '启用' }}>
            <Form.Item label="模板名称" name="name" rules={[{ required: true, message: '请输入模板名称' }]}>
              <Input placeholder="如：温度类越上限通用模板" />
            </Form.Item>
            <Form.Item label="适用指标说明" name="metricType" rules={[{ required: true, message: '请输入适用指标类型' }]}>
              <Input placeholder="如：温度类指标（主轴/冷却液/轴承温度）" />
            </Form.Item>
            <Form.Item label="适用指标（canonical，限定模板可套用的指标；应用到设备时按启用绑定匹配）" name="applicableMetricCodes">
              <Select mode="multiple" placeholder="选择适用的平台指标" options={applicableOptions} maxTagCount="responsive" />
            </Form.Item>
            <Space wrap>
              <Form.Item label="判定模式" name="mode" rules={[{ required: true }]}>
                <Select style={{ width: 200 }} options={[
                  { value: 'upper', label: '越上限' }, { value: 'lower', label: '越下限' },
                  { value: 'rangeOut', label: '区间外' }, { value: 'rangeIn', label: '区间内' },
                  { value: 'state', label: '枚举判定（状态类）' },
                ]} />
              </Form.Item>
              <Form.Item noStyle shouldUpdate={(a, b) => a.mode !== b.mode}>
                {({ getFieldValue }) => {
                  const mode = getFieldValue('mode');
                  if (mode === 'state') {
                    return (
                      <Space wrap>
                        <Form.Item label="异常状态枚举" name="abnormalValues" initialValue={['故障']}><Select mode="tags" style={{ width: 200 }} placeholder="输入枚举值后回车" /></Form.Item>
                        <Form.Item label="正常状态枚举" name="normalValues" initialValue={['运行', '待机']}><Select mode="tags" style={{ width: 200 }} placeholder="输入枚举值后回车" /></Form.Item>
                      </Space>
                    );
                  }
                  if (mode === 'rangeOut' || mode === 'rangeIn') {
                    return (
                      <Space wrap>
                        <Form.Item label="区间下限" name="low" rules={[{ required: true, message: '必填' }]}><InputNumber step={0.1} /></Form.Item>
                        <Form.Item label="上限" name="high" rules={[{ required: true, message: '必填' }]}><InputNumber step={0.1} /></Form.Item>
                      </Space>
                    );
                  }
                  return <Form.Item label="触发阈值" name="threshold" rules={[{ required: true, message: '必填' }]}><InputNumber /></Form.Item>;
                }}
              </Form.Item>
              <Form.Item label="持续（秒）" name="duration" rules={[{ required: true }]}><InputNumber min={0} /></Form.Item>
              <Form.Item noStyle shouldUpdate={(a, b) => a.mode !== b.mode}>
                {({ getFieldValue }) => (getFieldValue('mode') === 'state' ? null : (
                  <Form.Item label="回差" name="deadband" rules={[{ required: true }]}><InputNumber min={0} step={0.01} /></Form.Item>
                ))}
              </Form.Item>
            </Space>
            <Space wrap>
              <Form.Item label="重复提醒间隔（分钟）" name="remind" rules={[{ required: true }]}><InputNumber min={1} /></Form.Item>
              <Form.Item label="风暴限流（条/小时）" name="storm" rules={[{ required: true }]}><InputNumber min={1} /></Form.Item>
              <Form.Item label="通知策略" name="policy" rules={[{ required: true, message: '请选择通知策略' }]}>
                <Select style={{ width: 240 }} options={notificationRows.map((n) => ({ value: n.code, label: `${n.code} ${n.name}` }))} />
              </Form.Item>
              <Form.Item label="状态" name="status">
                <Select style={{ width: 100 }} options={[{ value: '启用', label: '启用' }, { value: '停用', label: '停用' }]} />
              </Form.Item>
            </Space>
            <Form.Item label="备注" name="remark"><Input.TextArea rows={2} placeholder="模板适用场景与参数依据，如：温度热惯性大，持续 60s 过滤加工载荷波动" /></Form.Item>
          </Form>
        </div>
      </Modal>

      {/* 应用到设备（弹窗）：按启用绑定匹配适用指标，批量生成规则草稿 */}
      <Modal
        title={`应用模板到设备（${applyRow?.name || ''}）`}
        width={560}
        open={!!applyRow}
        onOk={submitApply}
        confirmLoading={applying}
        onCancel={() => setApplyRow(null)}
        okText="生成规则草稿" cancelText="取消"
      >
        {applyRow && (
          <>
            <div style={{ fontSize: 12, color: '#5d6b78', lineHeight: 1.8, marginBottom: 8 }}>
              触发：{conditionTextOf(applyRow.triggerConfig)} · 恢复：{recoveryTextOf(applyRow.recoveryConfig, applyRow.triggerConfig)} · 通知策略 {applyRow.notificationConfig?.policyCode || '--'}
              <br />适用指标：{(applyRow.applicableMetricCodes || []).join('、') || '未限定（按指标说明人工匹配）'}
            </div>
            <Select
              mode="multiple" placeholder="选择要应用的设备（可多选）" style={{ width: '100%' }}
              value={applyDevices} onChange={setApplyDevices}
              options={deviceOptionsOf(targets)}
              maxTagCount="responsive"
            />
            <div style={{ fontSize: 12, color: '#8a97a3', marginTop: 8, lineHeight: 1.7 }}>
              将按各设备<b>当前启用绑定</b>匹配模板适用指标，每个匹配目标生成 1 条独立规则草稿（独立批次记录、已有规则跳过）；生成后为草稿状态，需逐条确认参数后发布。
            </div>
          </>
        )}
      </Modal>
    </>
  );
}

function deviceOptionsOf(targets) {
  const seen = new Map();
  targets.forEach((t) => { if (!seen.has(t.deviceId)) seen.set(t.deviceId, { value: t.deviceId, label: `${t.deviceId} ${t.deviceName}` }); });
  return [...seen.values()];
}
