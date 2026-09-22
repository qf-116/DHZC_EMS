import React from 'react';
import { Card, Table, Tag, Button, Space, Select, App, Input, InputNumber, Switch, Alert, Modal, Statistic, TimePicker, Tooltip, Cascader, Checkbox } from 'antd';
import { Plus, TestTube2, Zap, Info } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../components/PageHeader.jsx';
import { metricAlarmTemplates, ruleTemplates, notificationRows } from '../data/demoData.js';
import { netBindings } from '../data/standardData.js';
import { useDemoState, useDemoActions } from '../state/DemoStore.jsx';

// 报警规则配置 V3：围绕「一直大于某个值 → 报警爆炸」问题补齐防抖、恢复迟滞（回差）、
// 活动事件重复抑制、报警风暴保护（限流合并）与治理统计。
// 不同类型指标的判定模式与参数不同：选择指标后按「指标判定特征模板」自动带出推荐配置（可修改）。
// 指标仍强联动设备绑定关系（仅可选已勾选指标），规则发布生成不可变版本快照。
const sourceMeta = {
  'R-TEMP-001': { dataSource: 'realtime', chain: ['MT2024A1201 数控车床', 'IOT-D-10001 主设备', 'M.spindle_temp 主轴温度'], latency: '秒级（订阅流）' },
  'R-PRESS-001': { dataSource: 'realtime', chain: ['MT2024A1201 数控车床', 'IOT-D-10001 主设备', 'M.air_pressure 气压压力'], latency: '秒级（订阅流）' },
  'R-STATE-001': { dataSource: 'realtime', chain: ['MT2024A1201 数控车床', 'IOT-D-10001 主设备', 'S.machine_state 设备状态'], latency: '秒级（订阅流）' },
  'R-COMPARE-001': { dataSource: 'aggregated', chain: ['MES 程序比对', '设备程序快照', '基线参数集'], latency: '事件级（比对任务）' },
  'R-QUALITY-001': { dataSource: 'aggregated', chain: ['全部设备', '绑定健康汇总', 'last_pull_time'], latency: '分钟级（聚合）' },
};
const enrich = (r) => ({
  ...r,
  ...(sourceMeta[r.code] || { dataSource: 'aggregated', chain: [r.deviceScope || '--', '--', r.metricCode || '--'], latency: '事件级（业务）' }),
});

// 级联数据源：系统设备 → 子设备（来源 IoT 设备，主设备 / 传感器）→ 已勾选指标
// forState = true 时（状态规则）叶子指标仅保留状态类 S.*；空枝（无可用指标）自动裁剪
const buildCascadeOptions = (forState) => netBindings
  .filter(b => b.configStatus === '已启用')
  .map(b => ({
    value: b.code,
    label: `${b.code} ${b.deviceName}`,
    children: (b.items || [])
      .filter(i => i.enabled)
      .map(i => ({
        value: i.iotDeviceCode,
        label: `${i.iotDeviceCode}${i.role === 'main' ? '（主设备）' : `（子设备 · ${i.sensorType || '传感器'}）`}`,
        children: (i.metrics || [])
          .filter(x => x.selected)
          .filter(x => !forState || x.metricCode.startsWith('S.'))
          .map(x => ({ value: x.metricCode, label: `${x.metricCode} ${x.name}` })),
      }))
      .filter(c => c.children.length > 0),
  }))
  .filter(d => d.children.length > 0);
const metricOptions = (devCode, iotCode) => {
  const b = netBindings.find(x => x.code === devCode);
  const item = b?.items.find(i => i.iotDeviceCode === iotCode);
  return (item?.metrics || []).filter(x => x.selected).map(x => ({ value: x.metricCode, label: `${x.metricCode} ${x.name}` }));
};

const hint = { fontSize: 12, color: '#5d6b78', lineHeight: 1.7 };

// 悬浮说明图标：较长的解释文字收纳进 Tooltip，悬浮查看，不常驻占空间
const InfoTip = ({ text }) => (
  <Tooltip title={<div style={{ maxWidth: 320, lineHeight: 1.7 }}>{text}</div>}>
    <Info size={13} style={{ color: '#8a97a3', cursor: 'help', verticalAlign: '-2px', marginLeft: 4 }} />
  </Tooltip>
);

// 规则类型 → 受控状态值；切换类型时下方触发/恢复条件配置区随之联动
const RULE_TYPE_KEY = { 阈值: 'threshold', 状态: 'state', 质量: 'quality', 组合: 'combo' };
const RULE_TYPE_LABEL = { threshold: '阈值规则', state: '状态规则', quality: '质量规则', combo: '组合规则' };

export default function RuleConfigPage() {
  const { message, modal } = App.useApp();
  const navigate = useNavigate();
  const state = useDemoState();
  const actions = useDemoActions();

  // 停用规则：二次确认（停用后挂起判定，历史报警与版本快照保留）
  const confirmStop = (r) => modal.confirm({
    title: '停用报警规则',
    content: `确定停用报警规则「${r.name}（${r.code}）」吗？停用后规则挂起判定，历史报警与版本快照保留。`,
    okText: '停用', cancelText: '取消',
    onOk: () => {
      const res = actions.disableRule(r.code);
      message[res.ok ? 'success' : 'error'](res.message);
    },
  });
  const [open, setOpen] = React.useState(false);
  const [editing, setEditing] = React.useState(null);      // 编辑中的规则（新增为 null）
  const [testOpen, setTestOpen] = React.useState(false);   // 历史数据回测弹窗
  const [testRule, setTestRule] = React.useState(null);
  const [selDevice, setSelDevice] = React.useState('MT2024A1201');
  const [selSource, setSelSource] = React.useState('IOT-D-10001');
  const [selMetric, setSelMetric] = React.useState('M.spindle_temp');
  const [ruleType, setRuleType] = React.useState('threshold'); // threshold / state / quality / combo，联动下方触发条件配置区
  const [triggerMode, setTriggerMode] = React.useState('upper'); // upper / lower / rangeOut / rangeIn / state
  const isRange = triggerMode === 'rangeOut' || triggerMode === 'rangeIn';
  // 触发/恢复参数改为受控状态：指标模板可自动填充，用户仍可修改
  const [trigThreshold, setTrigThreshold] = React.useState(80);
  const [trigDuration, setTrigDuration] = React.useState(60);
  const [rangeLow, setRangeLow] = React.useState(0.6);
  const [rangeHigh, setRangeHigh] = React.useState(0.8);
  const [deadband, setDeadband] = React.useState(5);
  // 规则模板导入：导入后模板参数优先于指标特征模板（更换指标不覆盖已导入参数）
  const [importedTpl, setImportedTpl] = React.useState(null);

  // 通知策略 = 模板：选择策略后带出其内容，可临时调整（仅本规则生效，不回写策略本体）
  const peopleOptions = ['李明', '王强', '赵艳', '陈晨', '张伟', '王建国', '吴敏'].map(v => ({ value: v, label: v }));
  const policyTplOf = (code) => notificationRows.find(n => n.code === code) || notificationRows[1];
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
  // 是否已偏离策略模板（发布版本快照将记录调整后的内容）
  const curTpl = policyTplOf(policyCode);
  const policyModified = JSON.stringify(policyDraft) !== JSON.stringify(draftFromTpl(curTpl));

  // 从模板导入：模板 = 除设备绑定外的全部规则要素预设（触发模式 / 阈值参数 / 回差等）
  const applyRuleTemplate = (code) => {
    const t = ruleTemplates.find(x => x.code === code);
    if (!t) { setImportedTpl(null); return; }
    setImportedTpl(t);
    setRuleType(t.ruleType === '状态' ? 'state' : 'threshold');
    setTriggerMode(t.mode);
    if (t.mode === 'upper' || t.mode === 'lower') setTrigThreshold(t.threshold);
    if (t.mode === 'rangeOut' || t.mode === 'rangeIn') { setRangeLow(t.low); setRangeHigh(t.high); }
    setTrigDuration(t.duration);
    if (t.deadband != null) setDeadband(t.deadband);
    if (t.mode === 'state') {
      const sOpts = metricOptions(selDevice, selSource).filter(o => o.value.startsWith('S.'));
      if (sOpts.length) setSelMetric(sOpts[0].value);
    }
    message.success(`已从模板「${t.name}」导入参数，请继续选择设备与指标（个别设备可微调）`);
  };
  const tplCondition = (t) => {
    if (t.mode === 'state') return '枚举判定 · 立即触发';
    if (t.mode === 'rangeOut' || t.mode === 'rangeIn') return `区间外 ${t.low} ~ ${t.high} 持续 ${t.duration}s`;
    return `${t.mode === 'upper' ? '>' : '<'} ${t.threshold} 持续 ${t.duration}s`;
  };

  // 指标判定特征模板：选择指标后自动带出该类指标的推荐判定模式与参数
  const tpl = metricAlarmTemplates[selMetric];
  const applyTemplate = (metricCode) => {
    const t = metricAlarmTemplates[metricCode];
    if (!t) return;
    setTriggerMode(t.mode);
    if (t.mode === 'upper' || t.mode === 'lower') setTrigThreshold(t.threshold);
    if (t.mode === 'rangeOut' || t.mode === 'rangeIn') { setRangeLow(t.low); setRangeHigh(t.high); }
    setTrigDuration(t.duration);
    if (t.deadband != null) setDeadband(t.deadband);
  };

  const rows = Object.values(state.entities.alarmRulesById).map(enrich);
  const openCreate = () => {
    setEditing(null); setRuleType('threshold'); setImportedTpl(null); setOpen(true);
    const pc = 'NP-IMPORTANT';
    setPolicyCode(pc); setPolicyDraft(draftFromTpl(policyTplOf(pc)));
  };
  const openEdit = (r) => {
    setEditing(r); setRuleType(RULE_TYPE_KEY[r.type] || 'threshold'); setOpen(true);
    // 编辑时以规则绑定的策略为模板带出；如后续做策略覆盖持久化，此处应读取规则上的覆盖值
    const pc = r.policyCode || 'NP-IMPORTANT';
    setPolicyCode(pc); setPolicyDraft(draftFromTpl(policyTplOf(pc)));
  };
  const openTest = (r) => { setTestRule(r); setTestOpen(true); };
  const saveRule = ({ publish = false } = {}) => {
    const rule = {
      ...(editing || {}),
      code: editing?.code || `R-NEW-${String(Object.keys(state.entities.alarmRulesById).length + 1).padStart(3, '0')}`,
      name: editing?.name || `新规则 ${Object.keys(state.entities.alarmRulesById).length + 1}`,
      type: { threshold: '阈值', state: '状态', quality: '质量', combo: '组合' }[ruleType] || '阈值',
      deviceScope: editing?.deviceScope || state.entities.devicesById[selDevice]?.name || selDevice,
      metricCode: selMetric || editing?.metricCode || '--',
      condition: editing?.condition || `阈值 ${trigThreshold} 持续 ${trigDuration}s`,
      recovery: editing?.recovery || '自动恢复',
      severity: editing?.severity || '重要',
      policyCode,
      policyOverride: policyModified,
    };
    const saveRes = actions.saveRuleDraft(rule);
    if (!saveRes.ok) { message.error(saveRes.message); return; }
    if (publish) {
      const pubRes = actions.publishRule(saveRes.refs.ruleCode);
      message[pubRes.ok ? 'success' : 'error'](pubRes.message);
    } else {
      message.success(saveRes.message);
    }
    setOpen(false);
  };

  // 判定数据源不手工选择：由规则类型 + 所选指标自动推导
  // 质量 → 数据链路质量汇总（聚合）；业务事件类规则 → 事件级；其余（订阅指标 M.*/S.*）→ 实时订阅流
  const BUSINESS_RULE_CODES = ['R-COMPARE-001', 'R-INSPECT-001', 'R-MAINT-001', 'R-REPAIR-001', 'R-SPARE-001'];
  const derivedSource = ruleType === 'quality' || (editing && BUSINESS_RULE_CODES.includes(editing.code)) ? 'aggregated' : 'realtime';

  // 切换规则类型 → 联动触发条件配置区：
  // 状态：指标限定为状态类（S.*）并自动切到枚举判定；阈值：从枚举判定切回指标模式
  const changeRuleType = (t) => {
    setRuleType(t);
    if (t === 'state') {
      const sOpts = metricOptions(selDevice, selSource).filter(o => o.value.startsWith('S.'));
      if (sOpts.length && !(selMetric || '').startsWith('S.')) {
        setSelMetric(sOpts[0].value);
        applyTemplate(sOpts[0].value);
      } else {
        setTriggerMode('state');
      }
    }
    if (t === 'threshold' && triggerMode === 'state') {
      const t2 = metricAlarmTemplates[selMetric];
      if (t2 && t2.mode !== 'state') applyTemplate(selMetric);
      else setTriggerMode('upper');
    }
  };

  // 治理提示：抖动比 = 抑制 / 触发，> 1 视为高抖动规则
  const chattering = rows.filter(r => r.supp7d > r.trig7d);

  return (
    <>
      <PageHeader title="报警规则配置" subtitle="规则类型联动触发配置：阈值（判定模式+指标特征模板）/ 状态（枚举判定）/ 质量（数据质量码）/ 组合（多条件 AND·OR）· 防抖触发 · 恢复迟滞回差 · 重复抑制 · 风暴限流 · 当前启用 9 条" />

      {/* 报警治理提示：高抖动规则建议调整回差 / 持续时间 */}
      {chattering.length > 0 && (
        <Alert
          type="warning" showIcon icon={<Zap size={14} />}
          style={{ marginBottom: 12 }}
          message={`报警治理提示：${chattering.map(r => `${r.name}（近7天触发 ${r.trig7d} 次、重复抑制 ${r.supp7d} 次）`).join('、')}。抑制次数高于触发次数说明值在阈值附近反复震荡，建议增大恢复回差或延长触发持续时间。`}
        />
      )}

      <Card size="small">
        <Space wrap style={{ marginBottom: 12 }}>
          <Button type="primary" icon={<Plus size={14} />} onClick={openCreate}>新增规则</Button>
        </Space>
        <Table
          rowKey="code"
          size="small"
          dataSource={rows}
          columns={[
            { title: '规则编号', dataIndex: 'code', width: 100 },
            { title: '规则名称', dataIndex: 'name', width: 150 },
            { title: '类型', dataIndex: 'type', width: 70, render: v => <Tag color="blue">{v}</Tag> },
            { title: '指标选择链路（设备 → 子设备 → 指标）', dataIndex: 'chain', width: 280, render: v => v.join(' → ') },
            { title: '判定数据源', dataIndex: 'dataSource', width: 110, render: (v, r) => (
              <div>
                {v === 'realtime' ? <Tag color="red">实时（订阅流）</Tag> : <Tag color="purple">统计（聚合）</Tag>}
                <div style={{ fontSize: 11, color: '#8a97a3' }}>{r.latency}</div>
              </div>
            ) },
            { title: '触发条件', dataIndex: 'condition', width: 170 },
            { title: '恢复条件（迟滞）', dataIndex: 'recovery', width: 220 },
            { title: '重复抑制 / 风暴保护', dataIndex: 'suppress', width: 190, render: (v, r) => (
              <div style={{ fontSize: 12, lineHeight: 1.7 }}>
                <div>{v}</div>
                <div style={{ color: '#8a97a3' }}>风暴限流 {r.storm}</div>
              </div>
            ) },
            { title: '近7天 触发/抑制', width: 110, render: (_, r) => (
              <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                {r.trig7d} / <span style={{ color: r.supp7d > r.trig7d ? '#d97706' : undefined }}>{r.supp7d}</span>
              </span>
            ) },
            { title: '等级', dataIndex: 'severity', width: 70, render: v => v === '紧急' ? <Tag color="error">{v}</Tag> : v === '重要' ? <Tag color="warning">{v}</Tag> : <Tag color="gold">{v}</Tag> },
            { title: '通知 / 升级', dataIndex: 'policy', width: 150 },
            { title: '版本', dataIndex: 'version', width: 60 },
            { title: '状态', dataIndex: 'status', width: 70, render: v => <Tag color="success">{v}</Tag> },
            { title: '操作', width: 150, fixed: 'right', render: (_, r) => (
              <div className="list-actions">
                <a onClick={() => openEdit(r)}>编辑</a>
                <a onClick={() => openTest(r)}>测试</a>
                <a onClick={() => navigate('/alarm-rule-versions')}>版本</a>
                <a style={{ color: '#d97706' }} onClick={() => confirmStop(r)}>停用</a>
              </div>
            ) },
          ]}
          scroll={{ x: 1900 }}
        />
      </Card>

      {/* 新增 / 编辑规则弹窗（居中）：触发防抖 → 恢复迟滞 → 重复抑制 → 风暴保护 → 静默 → 通知 */}
      <Modal
        title={editing ? `编辑报警规则（${editing.code} / ${editing.version}）` : '新增报警规则'}
        width={780}
        open={open}
        onCancel={() => setOpen(false)}
        footer={[
          <Button key="draft" onClick={() => saveRule({ publish: false })}>保存草稿</Button>,
          <Button key="tpl" onClick={() => message.success('已将当前规则参数保存为新模板，可在「报警规则模板」中维护并复用')}>存为模板</Button>,
          <Button key="pub" type="primary" onClick={() => saveRule({ publish: true })}>发布</Button>,
        ]}
      >
        <div style={{ maxHeight: '66vh', overflowY: 'auto', paddingRight: 8 }}>
        <Space direction="vertical" style={{ width: '100%' }} size={12}>
          <Input placeholder="规则名称，如：主轴温度持续超限" defaultValue={editing?.name} />
          <Space wrap>
            {!editing && (
              <Select
                allowClear placeholder="从模板导入（同型设备通用参数）" style={{ width: 250 }}
                value={importedTpl?.code || undefined}
                onChange={(v) => (v ? applyRuleTemplate(v) : setImportedTpl(null))}
                options={ruleTemplates.filter(t => t.status === '启用').map(t => ({ value: t.code, label: `${t.name}` }))}
              />
            )}
            <Select value={ruleType} onChange={(t) => { setImportedTpl(null); changeRuleType(t); }} style={{ width: 130 }} options={[{ value: 'threshold', label: '阈值' }, { value: 'state', label: '状态' }, { value: 'quality', label: '质量' }, { value: 'combo', label: '组合' }]} />
            <Select defaultValue="important" style={{ width: 110 }} options={[{ value: 'urgent', label: '紧急' }, { value: 'important', label: '重要' }, { value: 'general', label: '一般' }]} />
            <span>判定数据源</span>
            <Tag color={derivedSource === 'realtime' ? 'red' : 'purple'} style={{ marginInlineEnd: 0 }}>
              {derivedSource === 'realtime' ? '实时（订阅流，秒级）' : '统计 / 事件级（聚合）'}
            </Tag>
            <InfoTip text={derivedSource === 'realtime'
              ? '判定数据源由所选指标自动确定，无需手工选择：实时订阅指标（M.* / S.*）的判定数据来自 IoT 平台实时订阅的原始采样点，秒级推送；适合温度、压力、振动、转速、设备状态等过程量的即时报警。订阅通道断开时自动降级为轮询，规则将标注降级状态。'
              : '判定数据源由规则类型自动确定，无需手工选择：质量规则判定数据为数据链路质量汇总（分钟级聚合）；程序比对 / 点检 / 保养 / 维修 / 备件等业务规则的判定数据为业务系统事件（事件级）。两者都不依赖实时订阅流。'}
            />
          </Space>

          {ruleType === 'quality' ? (
            <Card size="small" title={<>质量判定对象（质量规则无需选择指标）<InfoTip text="质量规则作用于「数据质量码」而非指标数值：绑定设备后监控其数据链路质量（订阅通道断开、数据拉取超时、无效质量码 BAD 占比），因此不出现指标三级联动与阈值/回差配置；触发与恢复参数在下方①②中按质量口径设置。" /></>}>
              <div style={hint}>监控对象 = 绑定设备的数据链路质量，触发与恢复参数在下方 ①② 中按质量口径设置。</div>
            </Card>
          ) : (
          <Card size="small" title={<>
            {`指标选择（设备 → 子设备 → 指标 级联选择，仅限绑定关系中已勾选指标${ruleType === 'state' ? ' · 状态规则仅可选状态类 S.* 指标' : ''}${ruleType === 'combo' ? ' · 此处为主条件指标，子条件在①中单独配置' : ''}）`}
            <InfoTip text="级联控件一次选完三级链路：① 系统设备（台账资产编码）→ ② 子设备（来源 IoT 设备：主设备 / 传感器）→ ③ 已勾选指标。未启用的绑定与未勾选的指标无数据，不进入可选范围；不同类型指标适用不同判定模式与参数，选择指标后自动带出推荐配置，可调整。" />
          </>}>
            <Space direction="vertical" style={{ width: '100%' }}>
              <Cascader
                style={{ width: '100%' }}
                value={selMetric ? [selDevice, selSource, selMetric] : [selDevice, selSource].filter(Boolean)}
                options={buildCascadeOptions(ruleType === 'state')}
                onChange={(path) => {
                  const [dev, src, met] = path;
                  setSelDevice(dev); setSelSource(src); setSelMetric(met || '');
                  if (met && !importedTpl) applyTemplate(met);
                }}
                placeholder="① 系统设备 → ② 子设备（主设备 / 传感器）→ ③ 已勾选指标"
                showSearch
              />
              {importedTpl ? (
                <Alert
                  type="success" showIcon
                  message={<span>已按规则模板「<b>{importedTpl.name}</b>」导入参数：触发 {tplCondition(importedTpl)}{importedTpl.mode !== 'state' ? ` · 回差 ${importedTpl.deadband}` : ''}，可修改。更换指标时模板参数保持不变（规则模板优先于指标特征模板）。</span>}
                />
              ) : tpl && (
                <Alert
                  type="info" showIcon
                  message={<span>已按指标特征带出推荐配置：<b>{tpl.category} · {tpl.mode === 'state' ? '枚举判定' : tpl.mode === 'upper' ? '越上限' : tpl.mode === 'lower' ? '越下限' : '区间外'}</b>（单位 {tpl.unit} · 量程 {tpl.range}），参数已自动填充，可修改。</span>}
                />
              )}
            </Space>
          </Card>
          )}

          <Card
            size="small"
            title={<>① 触发条件<InfoTip
              text={ruleType === 'quality'
                ? '质量规则触发不需要秒级防抖：数据链路异常（订阅断开 / 拉取超时 / BAD 质量码）持续 N 分钟才判定为质量事件，避免网络抖动误报；恢复条件见 ②。'
                : ruleType === 'combo'
                  ? '每个子条件独立配置「指标 + 判定模式 + 阈值 + 持续时间」，可选择不同来源设备的指标，并各自套用指标特征模板；示例：主轴温度高 AND 冷却液流量低 → 同时满足才触发；组合规则触发后只生成 1 条事件。'
                  : ruleType === 'state'
                    ? '状态规则固定使用枚举判定：状态点取值落入指定枚举（如 FAULT / ESTOP）即为候选，立即触发（持续时间 0），状态恢复即恢复——无阈值、持续时间与回差概念。'
                    : '持续时间为 0 时立即触发，仅建议状态类规则使用；阈值类规则必须设置持续时间，避免数据瞬时抖动产生短促报警。区间判定 = 值 < 下限 OR 值 > 上限，任一方向超出即进入候选，两个方向共用同一条规则、产生同一个事件，无需为高低两侧分别建规则；「区间内」模式用于「进入某区间才算异常」的场景（如待机功率应为 X）。'}
            /></>}
            extra={<Tag color="blue">{RULE_TYPE_LABEL[ruleType]}配置方式</Tag>}
          >
            {ruleType === 'quality' ? (
              <Space direction="vertical" style={{ width: '100%' }} size={8}>
                <Space wrap>
                  <span>质量规则类型</span>
                  <Select key="q-type" defaultValue="outage" style={{ width: 250 }} options={[{ value: 'outage', label: '数据中断（订阅断开 / 拉取超时）' }, { value: 'invalidRate', label: '无效率超限（BAD 占比）' }, { value: 'invalidCount', label: '无效数据持续条数超限' }]} />
                </Space>
                <Space wrap>
                  <span>持续</span>
                  <InputNumber defaultValue={5} min={1} />
                  <span>分钟未恢复即产生质量报警</span>
                </Space>
                <Space wrap>
                  <span>无效率阈值</span>
                  <InputNumber defaultValue={30} min={0} max={100} />
                  <span>%（仅无效率 / 无效占比类规则使用）</span>
                </Space>
              </Space>
            ) : ruleType === 'combo' ? (
              <Space direction="vertical" style={{ width: '100%' }} size={8}>
                <Space wrap>
                  <span>组合关系</span>
                  <Select key="combo-rel" defaultValue="and" style={{ width: 180 }} options={[{ value: 'and', label: '全部满足（AND）' }, { value: 'or', label: '任一满足（OR）' }]} />
                  <span style={hint}>示例：主轴温度高 AND 冷却液流量低</span>
                </Space>
                {[
                  { k: 'A', metric: 'M.spindle_temp', cond: '> 80℃ 持续 60s' },
                  { k: 'B', metric: 'M.coolant_temp', cond: '> 42℃ 持续 60s' },
                ].map(c => (
                  <Space key={c.k} wrap style={{ width: '100%', justifyContent: 'space-between' }}>
                    <Space wrap>
                      <span>子条件 {c.k}</span>
                      <Select defaultValue={c.metric} style={{ width: 250 }} options={metricOptions(selDevice, selSource)} />
                      <span>{c.cond}</span>
                    </Space>
                    <a onClick={() => message.info('已删除子条件')}>删除</a>
                  </Space>
                ))}
                <Button type="dashed" block onClick={() => message.info('添加子条件：选择指标后按指标特征模板带出推荐判定模式')}>+ 添加子条件</Button>
              </Space>
            ) : (
            <Space direction="vertical" style={{ width: '100%' }} size={8}>
              {ruleType !== 'state' && (
              <Space wrap>
                <span>判定模式</span>
                <Select value={triggerMode} onChange={setTriggerMode} style={{ width: 250 }} options={[
                  { value: 'upper', label: '越上限（值 > 阈值 为异常）' },
                  { value: 'lower', label: '越下限（值 < 阈值 为异常）' },
                  { value: 'rangeOut', label: '区间外（超出正常区间 为异常）' },
                  { value: 'rangeIn', label: '区间内（落入区间 为异常）' },
                  { value: 'state', label: '枚举判定（状态类指标）' },
                ]} />
              </Space>
              )}
              {triggerMode === 'state' && (
                <Space wrap key="trig-state">
                  <span>状态枚举</span>
                  <Select defaultValue="fault" style={{ width: 240 }} options={[{ value: 'fault', label: 'FAULT / ESTOP（故障、急停）' }, { value: 'offline', label: 'OFFLINE（离线）' }, { value: 'alarmCode', label: '报警码 ≠ 0' }]} />
                  <span>立即触发（持续时间 0，状态恢复即恢复）</span>
                </Space>
              )}
              {!isRange && triggerMode !== 'state' && (
                <Space wrap key={`trig-${triggerMode}`}>
                  <Select defaultValue={triggerMode === 'upper' ? '>' : '<'} style={{ width: 70 }} options={[{ value: '>', label: '>' }, { value: '>=', label: '≥' }, { value: '<', label: '<' }, { value: '<=', label: '≤' }, { value: '=', label: '=' }, { value: '!=', label: '≠' }]} />
                  <InputNumber value={trigThreshold} onChange={setTrigThreshold} />
                  <span>{tpl?.unit || ''}</span>
                  <span>持续</span>
                  <InputNumber value={trigDuration} onChange={setTrigDuration} min={0} />
                  <span>秒 才触发</span>
                </Space>
              )}
              {isRange && (
                <Space wrap key="trig-range">
                  <span>正常区间</span>
                  <InputNumber value={rangeLow} onChange={setRangeLow} step={0.1} />
                  <span>~</span>
                  <InputNumber value={rangeHigh} onChange={setRangeHigh} step={0.1} />
                  <span>{tpl?.unit || ''}</span>
                  <span>{triggerMode === 'rangeOut' ? '超出区间（低于下限 或 高于上限）' : '落入区间内'}持续</span>
                  <InputNumber value={trigDuration} onChange={setTrigDuration} min={0} />
                  <span>秒 才触发</span>
                </Space>
              )}
            </Space>
            )}
          </Card>

          <Card
            size="small"
            title={<>② 恢复条件<InfoTip
              text={ruleType === 'quality'
                ? '质量规则恢复条件 = 数据恢复正常质量（质量码 GOOD 且拉取/订阅成功）持续 M 分钟后自动恢复；不涉及阈值回差，恢复方式固定为自动恢复。'
                : ruleType === 'combo'
                  ? '组合规则恢复条件 = 全部子条件均回到各自恢复带且持续 M 秒（AND 关系）；OR 关系时任一子条件恢复且其余子条件均未处于触发态即恢复。回差在各子条件内独立设置（编辑子条件时配置）。'
                  : ruleType === 'state'
                    ? '状态类指标恢复条件 = 状态回到正常枚举值（如 RUN / STANDBY）或报警码回到 0，状态恢复即恢复；无阈值与回差概念，建议配合「人工确认关闭」用于故障责任认定。'
                    : isRange
                      ? '区间模式的恢复带 = [下限 + 回差, 上限 − 回差]（如 0.6 ~ 0.8 MPa、回差 0.05 → 恢复需回到 0.65 ~ 0.75 MPa 且持续 30s）；值落在恢复带与触发边界之间时保持原状态不翻转，消除区间边界附近的触发/恢复震荡。'
                      : '回差（迟滞带）防止值在阈值附近震荡导致「触发 → 恢复 → 再触发」反复横跳：温度 > 80℃ 持续 60s 触发后，需回落到 < 75℃（80 − 5）且持续 30s 才恢复；75 ~ 80℃ 之间保持原状态不翻转。越下限模式恢复阈值 = 触发阈值 + 回差。人工关闭适用于程序比对等需要责任认定的规则。'}
            /></>}
            extra={<Tag color="blue">{RULE_TYPE_LABEL[ruleType]}恢复口径</Tag>}
          >
            <Space direction="vertical" style={{ width: '100%' }} size={8}>
              {ruleType !== 'quality' && ruleType !== 'combo' && (
              <Space wrap>
                <span>恢复方式</span>
                <Select defaultValue="auto" style={{ width: 190 }} options={[{ value: 'auto', label: '自动恢复（满足条件）' }, { value: 'manual', label: '人工确认关闭' }]} />
              </Space>
              )}
              {ruleType === 'quality' ? (
                <div style={hint}>恢复方式固定为自动恢复，不涉及阈值回差。</div>
              ) : ruleType === 'combo' ? (
                <div style={hint}>回差在各子条件内独立设置（编辑子条件时配置）。</div>
              ) : triggerMode === 'state' ? (
                <div style={hint} key="rec-state">状态恢复即恢复；建议配合「人工确认关闭」用于故障责任认定。</div>
              ) : !isRange ? (
                <Space wrap key={`rec-${triggerMode}`}>
                  <span>恢复阈值 = 触发阈值 {triggerMode === 'lower' ? '+' : '−'}</span>
                  <InputNumber value={deadband} onChange={setDeadband} min={0} />
                  <span>（回差）</span>
                  <span>持续</span>
                  <InputNumber defaultValue={30} min={0} />
                  <span>秒</span>
                </Space>
              ) : (
                <Space wrap key="rec-range">
                  <span>恢复区间 = [下限 +</span>
                  <InputNumber value={deadband} onChange={setDeadband} step={0.01} min={0} />
                  <span>, 上限 −</span>
                  <InputNumber value={deadband} onChange={setDeadband} step={0.01} min={0} />
                  <span>]（回差）持续</span>
                  <InputNumber defaultValue={30} min={0} />
                  <span>秒</span>
                </Space>
              )}
            </Space>
          </Card>

          <Card
            size="small"
            title={<>③ 重复报警抑制<InfoTip text="这是「一直大于某个值」报警爆炸的主要原因：值持续超限期间，每次采样满足条件都会再建一条事件。开启抑制后同一规则 + 同一设备仅保留 1 条活动事件，报警中心的「重复」列记录被抑制的触发次数；重复提醒不新建事件，仅累计「重复」次数并刷新最后触发时间。" /></>}
          >
            <Space direction="vertical" size={8}>
              <Switch defaultChecked checkedChildren="活动事件未关闭期间抑制重复触发" unCheckedChildren="允许重复建事件（不建议）" />
              <Space wrap>
                <span>抑制期间每</span>
                <InputNumber defaultValue={5} min={1} />
                <span>分钟重复提醒一次（不新建事件）</span>
              </Space>
            </Space>
          </Card>

          <Card
            size="small"
            title={<>④ 报警风暴保护（限流合并）<InfoTip text="超出限流的新触发不再单独建事件，合并计入首条事件的「关联事件数」，并生成一条系统提示（如：网关断连导致 12 台设备同时延迟报警 → 合并为 1 条 + 关联 11）。风暴结束后自动解除，无需人工干预。建议按「单规则每小时 2~5 条」设置，限流只兜底极端风暴，正常抖动应由③抑制与②回差消化。" /></>}
          >
            <Space direction="vertical" size={8}>
              <Space wrap>
                <span>单规则每小时最多新建</span>
                <InputNumber defaultValue={3} min={1} />
                <span>条事件</span>
              </Space>
            </Space>
          </Card>

          <Card
            size="small"
            title={<>⑤ 静默时段<InfoTip text="静默时段内满足触发条件只记录不通知；计划停机静默联动「计划停机配置」，保养 / 检修窗口内不产生运行类报警。" /></>}
          >
            <Space direction="vertical" size={8}>
              <Space wrap>
                <TimePicker.RangePicker defaultValue={null} placeholder={['静默开始', '静默结束']} />
                <Switch defaultChecked checkedChildren="计划停机期间静默" />
              </Space>
            </Space>
          </Card>

          <Card
            size="small"
            title={<>⑥ 通知策略（模板 + 临时调整）<InfoTip text="策略在这里作为模板使用：选择策略后自动带出其内容（渠道 / 接收人 / 通知节奏 / 升级 / 静默 / 重试），可针对本规则临时调整——如夜间报警缩短重复间隔、给该规则追加值班人员；调整仅本规则生效，不回写「通知策略配置」中的策略本体。发布版本快照会记录调整后的最终通知口径。" /></>}
          >
            <Space direction="vertical" size={8} style={{ width: '100%' }}>
              <Space wrap>
                <span>策略模板</span>
                <Select
                  value={policyCode}
                  onChange={changePolicy}
                  style={{ width: 320 }}
                  options={notificationRows.filter(n => n.status === '启用').map(n => ({ value: n.code, label: `${n.code} ${n.name}（${n.level}）` }))}
                />
                {policyModified && <Tag color="orange" style={{ marginInlineEnd: 0 }}>已临时调整</Tag>}
                {policyModified && <a onClick={resetPolicy}>恢复模板默认</a>}
                <a onClick={() => message.info('跳转到「通知策略配置」查看 / 新增策略')}>查看 / 新增策略</a>
              </Space>
              <Alert
                type={policyModified ? 'warning' : 'info'}
                showIcon
                message={policyModified
                  ? <>已按策略「<b>{curTpl.code} {curTpl.name}</b>」带出并做了临时调整：调整仅对本规则生效，策略本体不受影响。</>
                  : <>已按策略「<b>{curTpl.code} {curTpl.name}</b>」带出默认通知配置，可针对本规则临时调整（如缩短重复间隔、追加接收人），调整仅本规则生效。</>}
              />
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '8px 16px' }}>
                <Space wrap size={4}>
                  <span>通知渠道</span>
                  <Checkbox.Group
                    value={policyDraft.channels}
                    onChange={(vals) => setPolicyDraft({ ...policyDraft, channels: vals.includes('站内') ? vals : [...vals, '站内'] })}
                    options={[
                      { label: '站内（必发）', value: '站内', disabled: true },
                      { label: '短信', value: '短信' },
                      { label: '企业微信', value: '企业微信' },
                    ]}
                  />
                </Space>
                <Space wrap size={4}>
                  <span>接收人</span>
                  <Select
                    mode="multiple"
                    allowClear
                    value={policyDraft.receivers}
                    onChange={(vals) => setPolicyDraft({ ...policyDraft, receivers: vals })}
                    options={peopleOptions}
                    maxTagCount="responsive"
                    style={{ minWidth: 240 }}
                    placeholder="选择接收人"
                  />
                </Space>
                <Space wrap size={4}>
                  <span>首次通知</span>
                  <Select
                    value={policyDraft.first}
                    onChange={(v) => setPolicyDraft({ ...policyDraft, first: v })}
                    style={{ width: 130 }}
                    options={['立即', '1 分钟', '5 分钟'].map(v => ({ value: v, label: v }))}
                  />
                  <span>重复间隔</span>
                  <Select
                    value={policyDraft.interval}
                    onChange={(v) => setPolicyDraft({ ...policyDraft, interval: v })}
                    style={{ width: 130 }}
                    options={['5 分钟', '10 分钟', '30 分钟', '不重复'].map(v => ({ value: v, label: v }))}
                  />
                </Space>
                <Space wrap size={4}>
                  <span>升级节点</span>
                  <Select
                    value={policyDraft.escalation}
                    onChange={(v) => setPolicyDraft({ ...policyDraft, escalation: v })}
                    style={{ width: 170 }}
                    options={['10 分钟 / 30 分钟', '30 分钟', '无'].map(v => ({ value: v, label: v }))}
                  />
                  <span>最大重试</span>
                  <InputNumber value={policyDraft.retries} min={1} max={10} onChange={(v) => setPolicyDraft({ ...policyDraft, retries: v ?? 1 })} />
                  <span>次</span>
                </Space>
                <Space wrap size={4}>
                  <span>静默时段</span>
                  <Input
                    value={policyDraft.silent}
                    onChange={(e) => setPolicyDraft({ ...policyDraft, silent: e.target.value })}
                    style={{ width: 200 }}
                    placeholder="如 00:00-07:00，留空为不静默"
                  />
                </Space>
              </div>
              <div style={hint}>站内通知为兜底必发渠道；外部渠道（短信 / 企业微信）不可作为唯一通知方式。静默时段内满足触发条件只记录不通知。</div>
            </Space>
          </Card>

          <Card
            size="small"
            title={<>质量过滤与降级<InfoTip text="订阅通道不可用降级为轮询时，实时规则将标注降级状态，不静默承诺秒级报警。" /></>}
          >
            <Space direction="vertical">
              <Switch defaultChecked checkedChildren="过滤无效质量码数据" />
              <Switch defaultChecked checkedChildren="数据中断时产生质量报警" />
            </Space>
          </Card>

          <Button icon={<TestTube2 size={14} />} onClick={() => openTest(editing || enrich({ code: '新规则', name: '当前配置', trig7d: 23, supp7d: 31, storm: '≤ 3 条/小时' }))}>使用历史数据测试</Button>
        </Space>
        </div>
      </Modal>

      {/* 历史数据回测弹窗：展示命中 / 实际建事件（含抑制合并）对比 */}
      <Modal
        title={`历史数据回测（${testRule?.code || ''} ${testRule?.name || ''}）`}
        width={560}
        open={testOpen}
        footer={<Button type="primary" onClick={() => setTestOpen(false)}>知道了</Button>}
        onCancel={() => setTestOpen(false)}
      >
        {testRule && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 8 }}>
              <Statistic title="近7天条件命中" value={testRule.trig7d + testRule.supp7d} suffix="次" />
              <Statistic title="实际生成事件" value={testRule.trig7d} suffix="条" valueStyle={{ color: '#00b8d4' }} />
              <Statistic title="被抑制 / 合并" value={testRule.supp7d} suffix="次" valueStyle={{ color: '#d97706' }} />
            </div>
            <Alert type="info" showIcon message="回测按当前规则参数（含持续时间、回差、抑制与限流）重放近 7 天历史数据；若「被抑制」占比过高，说明存在持续超限或阈值抖动，建议增大回差或延长持续时间。" />
          </>
        )}
      </Modal>
    </>
  );
}
