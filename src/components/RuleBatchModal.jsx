import React from 'react';
import { Modal, Steps, Select, Table, Tag, Space, Button, InputNumber, Alert, Statistic, Radio, App } from 'antd';
import { useDemoState, useDemoActions } from '../state/DemoStore.jsx';
import { groupBatchTargets } from '../domain/alarmRule.js';
import { notificationRows } from '../data/demoData.js';

// 批量新建报警规则（M3-M4）：选择同类指标目标 → 统一配置 → 逐目标预览 → 只生成草稿。
// 分组键 = 指标 + 数据类型 + 单位 + 量程 + 设备型号（§10.3）；已有规则默认跳过，不覆盖。
// 批量发布/灰度/回滚为 P2，本组件不提供。
const STEP_TITLES = ['选择对象', '统一配置', '预览校验', '生成结果'];

// 快速查重（展示提示）：同设备同指标已存在阈值规则
function existingRuleOf(rules, target) {
  return Object.values(rules).find((r) => r.type === '阈值'
    && ['草稿', '已发布'].includes(r.status)
    && ((r.target?.deviceId === target.deviceId && r.target?.metricCode === target.metricCode)
      || (!r.target && r.metricCode === target.metricCode)));
}

export default function RuleBatchModal({ open, onClose, targets, onCommitted }) {
  const { message } = App.useApp();
  const state = useDemoState();
  const actions = useDemoActions();

  const [step, setStep] = React.useState(0);
  const [metricCode, setMetricCode] = React.useState(null);
  const [selectedKeys, setSelectedKeys] = React.useState([]);
  const [cfg, setCfg] = React.useState({
    severity: '重要',
    mode: 'upper',
    threshold: null,
    durationSec: 60,
    thresholdMode: 'deadband',
    deadband: 5,
    recoveryValue: null,
    stabilizeSec: 30,
    policyCode: 'NP-IMPORTANT',
  });
  const [preview, setPreview] = React.useState(null);
  const [committing, setCommitting] = React.useState(false);
  const [batchResult, setBatchResult] = React.useState(null);

  const reset = () => {
    setStep(0); setMetricCode(null); setSelectedKeys([]); setPreview(null); setBatchResult(null); setCommitting(false);
    setCfg({ severity: '重要', mode: 'upper', threshold: null, durationSec: 60, thresholdMode: 'deadband', deadband: 5, recoveryValue: null, stabilizeSec: 30, policyCode: 'NP-IMPORTANT' });
  };
  const close = () => { onClose(); };

  const numericMetrics = React.useMemo(() => {
    const seen = new Map();
    targets.forEach((t) => {
      if (t.metric?.dataType !== 'number') return;
      if (!seen.has(t.metricCode)) seen.set(t.metricCode, { value: t.metricCode, label: `${t.metricCode} ${t.metric.name}（${targets.filter((x) => x.metricCode === t.metricCode).length} 台设备）` });
    });
    return [...seen.values()];
  }, [targets]);

  const metricTargets = React.useMemo(
    () => (metricCode ? targets.filter((t) => t.metricCode === metricCode) : []),
    [targets, metricCode]
  );
  const groups = React.useMemo(() => groupBatchTargets(metricTargets.filter((t) => selectedKeys.includes(t.key))), [metricTargets, selectedKeys]);
  const selectedTargets = metricTargets.filter((t) => selectedKeys.includes(t.key));

  const buildRequest = () => ({
    metricCode,
    severity: cfg.severity,
    name: `${metricTargets[0]?.metric?.name || metricCode} 批量${cfg.mode === 'lower' ? '过低' : '超限'}报警`,
    triggerConfig: { type: 'threshold', mode: cfg.mode, operator: cfg.mode === 'lower' ? '<' : '>', threshold: cfg.threshold, unit: metricTargets[0]?.metric?.unit || '', durationSec: cfg.durationSec },
    recoveryConfig: {
      mode: 'auto', closeMode: 'auto',
      condition: {
        type: 'hysteresis',
        direction: cfg.mode,
        thresholdMode: cfg.thresholdMode,
        triggerValue: cfg.threshold,
        recoveryValue: cfg.thresholdMode === 'deadband' ? null : cfg.recoveryValue,
        deadband: cfg.thresholdMode === 'deadband' ? cfg.deadband : null,
        unit: metricTargets[0]?.metric?.unit || '',
      },
      stabilize: { durationSec: cfg.stabilizeSec, qualityRequired: 'GOOD', invalidDataPolicy: 'hold', rebreachPolicy: 'resetTimer' },
      notifyOnRecover: true,
    },
    notificationConfig: buildNotification(cfg.policyCode),
    targets: selectedTargets,
  });

  const runPreview = () => {
    const res = actions.previewBatchRules(buildRequest());
    if (!res.ok) { message.warning(res.message); return; }
    setPreview(res);
    setStep(2);
  };

  const runCommit = async () => {
    setCommitting(true);
    try {
      const res = actions.commitBatchDraft(buildRequest());
      if (!res.ok) { message.error(res.message); return; }
      // 从动作真实结果读取（dispatch 返回 meta.lastAction），不依赖尚未重渲染的 store 快照
      setBatchResult({ batchId: res.refs.batchId, result: res.refs, rows: res.refs.rows || [] });
      setStep(3);
      message.success(res.message);
      onCommitted?.(res.refs);
    } finally {
      setCommitting(false);
    }
  };

  const resultRows = batchResult?.rows || [];
  const creatable = preview?.summary?.creatable ?? 0;

  return (
    <Modal
      title="批量新建报警规则（同类指标 · 只生成草稿）"
      width={860}
      open={open}
      onCancel={close}
      maskClosable={false}
      footer={step === 3
        ? [<Button key="done" type="primary" onClick={() => { reset(); close(); }}>完成</Button>]
        : [
          <Button key="cancel" onClick={close}>取消</Button>,
          step > 0 && <Button key="prev" onClick={() => setStep(step - 1)}>上一步</Button>,
          step === 0 && <Button key="next" type="primary" disabled={!metricCode || selectedKeys.length === 0} onClick={() => setStep(1)}>下一步（已选 {selectedKeys.length} 个目标）</Button>,
          step === 1 && <Button key="preview" type="primary" disabled={cfg.threshold === null || cfg.threshold === undefined} onClick={runPreview}>生成预览</Button>,
          step === 2 && <Button key="commit" type="primary" loading={committing} disabled={creatable === 0} onClick={runCommit}>生成 {creatable} 条草稿</Button>,
        ].filter(Boolean)}
    >
      <Steps size="small" current={step} items={STEP_TITLES.map((t) => ({ title: t }))} style={{ marginBottom: 16 }} />

      {step === 0 && (
        <Space direction="vertical" style={{ width: '100%' }} size={10}>
          <Alert type="info" showIcon message="只有同一指标（相同 metricCode、数值型）才能批量创建；每台设备生成一条独立规则草稿，差距过大的指标不会被合并成一条规则。" />
          <Select
            placeholder="选择指标（仅数值型，按绑定关系聚合设备）"
            style={{ width: 420 }}
            value={metricCode}
            onChange={(v) => { setMetricCode(v); setSelectedKeys([]); setPreview(null); }}
            options={numericMetrics}
            showSearch
            optionFilterProp="label"
          />
          {metricCode && (
            <Table
              rowKey="key"
              size="small"
              dataSource={metricTargets}
              pagination={false}
              rowSelection={{ selectedRowKeys: selectedKeys, onChange: setSelectedKeys }}
              columns={[
                { title: '设备', dataIndex: 'deviceName', width: 160, render: (v, t) => `${v}（${t.deviceId}）` },
                { title: '型号', dataIndex: 'deviceModel', width: 110 },
                { title: '来源', width: 170, render: (_, t) => `${t.sourceCode} · ${t.sensorType}` },
                { title: '单位', width: 70, render: (_, t) => t.metric.unit || '--' },
                { title: '量程', width: 100, render: (_, t) => (t.metric.range ? `${t.metric.range.min} ~ ${t.metric.range.max}` : '--') },
                { title: '已有规则', width: 120, render: (_, t) => {
                  const er = existingRuleOf(state.entities.alarmRulesById, t);
                  return er ? <Tag color="orange">{er.status} {er.code}</Tag> : <Tag color="green">无</Tag>;
                } },
              ]}
            />
          )}
        </Space>
      )}

      {step === 1 && (
        <Space direction="vertical" style={{ width: '100%' }} size={10}>
          <Alert type="info" showIcon
            message={groups.length <= 1
              ? `已选 ${selectedKeys.length} 个目标，自动识别为 ${groups.length} 个配置组（同指标 + 同数据类型 + 同单位 + 同量程 + 同设备型号），可统一配置阈值。`
              : `已选 ${selectedKeys.length} 个目标，自动识别为 ${groups.length} 个配置组（量程或型号不同）：${groups.map((g) => `${g.targets.length} 台`).join('、')}。当前版本按统一绝对值配置；如各组阈值差异大，请分批创建。`} />
          {groups.length > 1 && (
            <Table rowKey="groupKey" size="small" pagination={false} dataSource={groups} columns={[
              { title: '配置组', dataIndex: 'groupKey', render: (v) => <span style={{ fontSize: 12 }}>{v}</span> },
              { title: '目标数', width: 80, render: (_, g) => `${g.targets.length} 台` },
              { title: '设备', render: (_, g) => g.targets.map((t) => t.deviceName).join('、') },
            ]} />
          )}
          <Space wrap>
            <span>触发模式</span>
            <Select value={cfg.mode} onChange={(v) => setCfg({ ...cfg, mode: v })} style={{ width: 200 }} options={[{ value: 'upper', label: '越上限（值 > 阈值）' }, { value: 'lower', label: '越下限（值 < 阈值）' }]} />
            <span>{cfg.mode === 'lower' ? '低于' : '高于'}</span>
            <InputNumber value={cfg.threshold} onChange={(v) => setCfg({ ...cfg, threshold: v })} step={metricCode === 'M.air_pressure' ? 0.05 : 1} />
            <span>{metricTargets[0]?.metric?.unit || ''}</span>
            <span>持续</span>
            <InputNumber value={cfg.durationSec} min={0} onChange={(v) => setCfg({ ...cfg, durationSec: v ?? 0 })} />
            <span>秒</span>
          </Space>
          <Space wrap>
            <span>报警等级</span>
            <Select value={cfg.severity} onChange={(v) => setCfg({ ...cfg, severity: v })} style={{ width: 100 }} options={['紧急', '重要', '一般', '提示'].map((v) => ({ value: v, label: v }))} />
            <span>通知策略（固定模板）</span>
            <Select value={cfg.policyCode} onChange={(v) => setCfg({ ...cfg, policyCode: v })} style={{ width: 280 }}
              options={notificationRows.filter((n) => n.status === '启用').map((n) => ({ value: n.code, label: `${n.code} ${n.name}` }))} />
          </Space>
          <Space wrap>
            <span>恢复阈值</span>
            <Radio.Group value={cfg.thresholdMode} onChange={(e) => setCfg({ ...cfg, thresholdMode: e.target.value })} options={[{ value: 'deadband', label: '按回差' }, { value: 'explicit', label: '直接指定' }]} optionType="button" />
            {cfg.thresholdMode === 'deadband' ? (
              <>
                <span>= 触发阈值 {cfg.mode === 'lower' ? '+' : '−'}</span>
                <InputNumber value={cfg.deadband} min={0} onChange={(v) => setCfg({ ...cfg, deadband: v ?? 0 })} />
              </>
            ) : (
              <InputNumber value={cfg.recoveryValue} onChange={(v) => setCfg({ ...cfg, recoveryValue: v })} placeholder="恢复阈值" />
            )}
            <span>{metricTargets[0]?.metric?.unit || ''}</span>
            <span>稳定</span>
            <InputNumber value={cfg.stabilizeSec} min={0} onChange={(v) => setCfg({ ...cfg, stabilizeSec: v ?? 0 })} />
            <span>秒（GOOD 数据）</span>
          </Space>
        </Space>
      )}

      {step === 2 && preview && (
        <Space direction="vertical" style={{ width: '100%' }} size={10}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
            <Statistic title="目标总数" value={preview.summary.total} />
            <Statistic title="可创建" value={preview.summary.creatable} valueStyle={{ color: '#00b8d4' }} />
            <Statistic title="已存在跳过" value={preview.summary.skipped} valueStyle={{ color: '#d97706' }} />
            <Statistic title="阻断" value={preview.summary.blocked} valueStyle={{ color: '#d64545' }} />
          </div>
          <Alert type="info" showIcon message="批量只生成草稿，不直接发布；生成后可在规则列表逐条调整，再逐条发布。" />
          <Table rowKey="targetKey" size="small" pagination={false} dataSource={preview.rows} columns={[
            { title: '设备', dataIndex: 'deviceName', width: 170 },
            { title: '指标', dataIndex: 'metricCode', width: 150 },
            { title: '结果', dataIndex: 'result', width: 100, render: (v) => ({ creatable: <Tag color="green">可创建</Tag>, skipped: <Tag color="orange">跳过</Tag>, blocked: <Tag color="red">阻断</Tag> }[v] || v) },
            { title: '说明', dataIndex: 'reason' },
          ]} />
        </Space>
      )}

      {step === 3 && batchResult && (
        <Space direction="vertical" style={{ width: '100%' }} size={10}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
            <Statistic title="生成草稿" value={batchResult.result?.created ?? 0} valueStyle={{ color: '#00b8d4' }} />
            <Statistic title="跳过" value={batchResult.result?.skipped ?? 0} valueStyle={{ color: '#d97706' }} />
            <Statistic title="阻断" value={batchResult.result?.blocked ?? 0} valueStyle={{ color: '#d64545' }} />
            <Statistic title="失败" value={batchResult.result?.failed ?? 0} />
          </div>
          <Alert type="success" showIcon message={`批次 ${batchResult.batchId} 已记录（草稿已生成）。草稿发布前不会触发报警；重复提交同一批次不会重复生成规则。`} />
          <Table rowKey="targetKey" size="small" pagination={false} dataSource={resultRows} columns={[
            { title: '设备', dataIndex: 'deviceName', width: 170 },
            { title: '规则编号', dataIndex: 'ruleCode', width: 150, render: (v) => v || '--' },
            { title: '结果', dataIndex: 'result', width: 100, render: (v) => ({ created: <Tag color="green">已创建</Tag>, skipped: <Tag color="orange">跳过</Tag>, blocked: <Tag color="red">阻断</Tag>, failed: <Tag color="red">失败</Tag> }[v] || v) },
            { title: '说明', dataIndex: 'reason' },
          ]} />
        </Space>
      )}
    </Modal>
  );
}

function buildNotification(policyCode) {
  const n = notificationRows.find((x) => x.code === policyCode) || notificationRows[1];
  return {
    policyCode: n.code,
    overridden: false,
    channels: n.channels.split(' / '),
    receivers: n.receivers.split('、'),
    first: n.first,
    interval: n.interval,
    escalation: n.escalation,
    silent: n.silent === '无' ? '' : n.silent,
    retries: n.retries,
  };
}
