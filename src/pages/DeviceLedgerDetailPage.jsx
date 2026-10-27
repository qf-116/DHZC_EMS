import React, { useEffect, useMemo, useState } from 'react';
import { Card, Descriptions, Tag, Button, Space, App, Alert, Tabs, Table, Modal, Checkbox } from 'antd';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ArrowLeft, Printer, Activity } from 'lucide-react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import PageHeader from '../components/PageHeader.jsx';
import StatusTag from '../components/StatusTag.jsx';
import EmptyState from '../components/EmptyState.jsx';
import DegradedBanner from '../components/DegradedBanner.jsx';
import MetricTile from '../components/MetricTile.jsx';
import MetricHistoryPanel from '../components/MetricHistoryPanel.jsx';
import { useDemoState } from '../state/DemoStore.jsx';
import { selectDevice360 } from '../state/selectors.js';
// 点检/保养/巡检为演示种子（完整闭环由点巡保养业务模块承接）；维修/报警来自演示状态机
import { inspectionTaskDetails, inspectionTasks, maintenanceTasks, patrolTaskDetails, patrolPlanDevices, patrolTasks } from '../data/standardData.js';
import { reportRows } from '../data/demoData.js';

const QUALITY_COLOR = { GOOD: 'success', DELAYED: 'processing', NO_VALUE: 'warning', OFFLINE: 'error', BAD: 'error', NO_DATA: 'default' };
const QUALITY_LABEL = { GOOD: '正常', DELAYED: '延迟', NO_VALUE: '无值', OFFLINE: '离线', BAD: '异常', NO_DATA: '无数据' };
const hint = { fontSize: 12, color: 'var(--detail-muted, #5d6b78)', lineHeight: 1.8 };
const dash = (v) => (v === null || v === undefined || v === '' ? '--' : v);
const emptyText = (label) => <span style={{ color: '#8a97a3' }}>该设备暂无{label}</span>;
const NO_CURVES = [];

// 设备详情（统一页面）：/device-ledger/detail/:deviceId；兼容旧 query（deviceId / monitorCode / code=资产编码）。
// /device/:deviceId 与 /device-ledger/net-config 重定向到本页。
// 栏目：基础信息 / 生命周期履历 / 点检 / 巡检 / 保养 / 维修 / 联网配置（全设备）；联网设备另有 实时监测 / 指标历史数据 / 状态与趋势 / 报警事件 / 生产记录。
export default function DeviceLedgerDetailPage() {
  const state = useDemoState();
  return <DeviceLedgerDetailContent state={state} />;
}

// Shared content entry for the dashboard modal; no application shell or store writes.
export function DeviceLedgerDetailContent({ state, deviceId: suppliedDeviceId, embedded = false, initialTab = 'base', initialCurves = NO_CURVES }) {
  const { deviceId: deviceIdParam } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { message } = App.useApp();
  const meta = state.meta;

  const deviceId = useMemo(() => {
    if (suppliedDeviceId) return state.entities.devicesById[suppliedDeviceId] ? suppliedDeviceId : null;
    if (deviceIdParam && state.entities.devicesById[deviceIdParam]) return deviceIdParam;
    const qDeviceId = searchParams.get('deviceId') || searchParams.get('monitorCode');
    if (qDeviceId && state.entities.devicesById[qDeviceId]) return qDeviceId;
    const code = searchParams.get('code');
    if (code) {
      const hit = Object.values(state.entities.crosswalkById).find(c => c.assetCode === code);
      if (hit) return hit.deviceId;
    }
    return null;
  }, [suppliedDeviceId, deviceIdParam, searchParams, state]);

  const d360 = useMemo(() => (deviceId ? selectDevice360(state, deviceId) : null), [state, deviceId]);

  const [trendKey, setTrendKey] = useState(null);
  const [activeTab, setActiveTab] = useState(embedded ? initialTab : searchParams.get('tab') || initialTab);
  // 自定义监控曲线：本页 UI 偏好（不入 store / 不入绑定），换设备时清空
  const [monitorCurves, setMonitorCurves] = useState(initialCurves);   // 已选数值指标 metricCode 列表
  const [curveModalOpen, setCurveModalOpen] = useState(false);
  const [curveDraft, setCurveDraft] = useState([]);         // 弹窗内的临时勾选

  useEffect(() => { setMonitorCurves(initialCurves); setCurveDraft([]); setCurveModalOpen(false); }, [deviceId, initialCurves]);
  useEffect(() => { if (curveModalOpen) setCurveDraft(monitorCurves); }, [curveModalOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!d360) {
    const shown = suppliedDeviceId || deviceIdParam || searchParams.get('deviceId') || searchParams.get('code') || '未提供设备编号';
    return (
      <>
        {!embedded && <PageHeader
          title="设备详情"
          subtitle={`未找到设备：${shown}`}
          actions={<Button icon={<ArrowLeft size={14} />} onClick={() => navigate('/device-ledger')}>返回列表</Button>}
        />}
        <Card size="small">
          <EmptyState
            description="未找到对象：该设备编号在设备台账中不存在"
            reason="设备可能已被移除，或链接中的设备编号有误"
            onNext={embedded ? undefined : () => navigate('/device-ledger')}
            next={embedded ? undefined : '返回设备台账'}
            nextLabel="返回设备台账"
          />
        </Card>
      </>
    );
  }

  const { device, binding, realtime, health, activeAlarms, repair, oee, lifecycleHistory } = d360;
  const hasBinding = !!binding;
  const lifecycleOnly = device.lifecycleStatus !== '在用';
  // 入账来源：按 deviceId 反查生成本设备的生命周期流程任务（任务侧持有 registration.deviceIds）
  const lifecycleTaskForDevice = Object.values(state.entities.lifecycleTasksById || {})
    .find(t => (t.registration?.deviceIds || []).includes(device.deviceId)) || null;

  // ===== 关联业务记录 =====
  // 点检/巡检/保养：演示种子按资产编码（assetCode）过滤，任务明细为最近一次任务的设备行，按最新任务补齐计划口径；
  // 维修/报警：演示状态机数据，按 canonical deviceId 过滤，跨页联动。
  const code = device.assetCode;
  const latestInspectionTask = [...inspectionTasks].sort((a, b) => (b.date + b.createTime).localeCompare(a.date + a.createTime))[0];
  const inspectionRows = inspectionTaskDetails.filter(d => d.code === code).map(d => ({
    key: `XJ-${d.code}`,
    plan: latestInspectionTask?.plan || '--',
    date: latestInspectionTask?.date || '--',
    owner: latestInspectionTask?.owner || '--',
    taskStatus: latestInspectionTask?.status || '--',
    items: d.itemNames || '--', itemCount: d.itemTotal, checked: d.checked, unchecked: d.unchecked,
    execTime: d.execTime || '', skipReason: d.skipReason || '',
  }));
  const maintenanceRows = maintenanceTasks.filter(t => (t.device || '').includes(code)).map(t => ({ key: t.code, ...t }));
  const latestPatrolTask = [...patrolTasks].sort((a, b) => (b.date + b.createTime).localeCompare(a.date + a.createTime))[0];
  const patrolRows = patrolTaskDetails.filter(d => d.code === code).map(d => ({
    key: `XJ-P-${d.code}`,
    plan: latestPatrolTask?.plan || '--',
    date: latestPatrolTask?.date || '--',
    owner: latestPatrolTask?.owner || '--',
    taskStatus: latestPatrolTask?.status || '--',
    standard: patrolPlanDevices.find(p => p.code === code)?.standard || '--',
    items: d.itemNames || '--', itemCount: d.itemCount, checked: d.checked, unchecked: d.unchecked,
    execTime: d.execTime || '', skipReason: d.skipReason || '',
  }));
  const repairReportRows = Object.values(state.entities.repairReportsById)
    .filter(r => r.deviceId === device.deviceId).map(r => ({ key: r.reportId, ...r }));
  const repairOrderRows = Object.values(state.entities.repairOrdersById)
    .filter(r => r.deviceId === device.deviceId).map(r => ({ key: r.repairOrderId, ...r }));
  const alarmRows = Object.values(state.entities.alarmEventsById)
    .filter(a => a.deviceId === device.deviceId).map(a => ({ key: a.id, ...a }));
  // 生产记录：设备上报的生产结果（OEE 分析的生产数据来源），按设备名过滤
  const productionRows = reportRows.production
    .map((r, i) => ({ key: `PR-${r.device}-${r.date}-${i}`, ...r }))
    .filter(r => r.device === device.name);

  // 趋势：使用演示快照中的确定性趋势序列（trends[`${deviceId}|${metricCode}`]）
  const trendEntries = Object.keys(state.entities.trends || {})
    .filter(k => k.startsWith(`${device.deviceId}|`))
    .map(k => ({ key: k, metricCode: k.split('|')[1], values: state.entities.trends[k] }));
  const currentTrend = trendEntries.find(t => t.key === trendKey) || trendEntries[0] || null;

  // ===== 接入状态徽标 =====
  const accessTag = !hasBinding
    ? <Tag>未接入监测</Tag>
    : (lifecycleOnly
      ? <Tag color="default">不参与监测</Tag>
      : (health?.status === '数据中断' ? <Tag color="error">数据中断</Tag> : <Tag color="success">监测中</Tag>));

  const sourceItems = (binding?.items || []).filter(i => i.enabled);
  // 2026-10 口径：绑定即全量接入存储——接入指标 = 绑定来源上报的全部指标；监控中 = 勾选纳入曲线呈现的子集
  const totalMetrics = (binding?.items || [])
    .reduce((s, i) => s + (i.enabled ? (i.metrics || []).length : 0), 0);
  const totalMonitored = (binding?.items || [])
    .reduce((s, i) => s + (i.enabled ? (i.metrics || []).filter(m => m.monitored).length : 0), 0);

  // ===== 自定义监控曲线：候选 = 监控中（monitored）的数值类指标（状态/事件类 S.* 不参与） =====
  const numericMetricOptions = (realtime.metrics || [])
    .filter(r => state.entities.metricsByKey[r.metricCode]?.dataType === '数值');

  // 曲线序列：优先用平台快照趋势（trends）；无快照时按当前采样值生成确定性演示序列（含小幅波动与漂移）
  const curveSeries = (metricCode, value) => {
    if (value === null || value === undefined) return null;
    const seedKey = `${device.deviceId}|${metricCode}`;
    if (state.entities.trends?.[seedKey]) return state.entities.trends[seedKey];
    const seed = [...(`${device.deviceId}${metricCode}`)].reduce((s, c) => s + c.charCodeAt(0), 0);
    return Array.from({ length: 12 }, (_, i) => {
      const wave = Math.sin((seed % 17) + i * 0.9) * 0.035;
      const drift = (i / 11 - 0.5) * 0.06;
      return +(value * (1 + wave + drift)).toFixed(3);
    });
  };
  const chartPoint = (value, index, count) => {
    const times = state.entities.trendTimes?.[device.deviceId];
    return { i: embedded && times?.length === count ? times[index] : `t${index + 1}`, v: value };
  };

  const metricColumns = [
    { title: '指标编码', dataIndex: 'metricCode', width: 160 },
    { title: '指标名称', dataIndex: 'name', width: 120 },
    { title: '来源设备', dataIndex: 'iotDeviceCode', width: 130, render: v => v || '--' },
    { title: '值', dataIndex: 'value', width: 100, render: v => (v ?? '--') },
    { title: '单位', dataIndex: 'unit', width: 80, render: v => v || '--' },
    {
      title: '质量码', dataIndex: 'qualityCode', width: 100,
      render: v => <Tag color={QUALITY_COLOR[v] || 'default'}>{QUALITY_LABEL[v] || v || '--'}</Tag>,
    },
    { title: '采集时间', dataIndex: 'sourceTime', width: 140, render: v => v || '--' },
    { title: '接收时间', dataIndex: 'receiveTime', width: 140, render: v => v || '--' },
    { title: '指标版本', dataIndex: 'metricVersion', width: 90, render: v => v || '--' },
  ];

  // ===== Tab 结构：栏目顺序固定；联网设备追加监测类栏目，未联网设备到联网配置为止 =====
  const tabItems = [];

  // 基础信息：档案字段 + OEE 资格 + 设备二维码
  tabItems.push({
    key: 'base', label: '基础信息', children: (
      <>
        <Card size="small" style={{ marginBottom: 12 }} title="档案信息">
          <Descriptions size="small" bordered column={3} labelStyle={{ width: 120 }}>
            <Descriptions.Item label="资产编号">{device.assetCode}</Descriptions.Item>
            <Descriptions.Item label="设备名称">{device.name}</Descriptions.Item>
            <Descriptions.Item label="设备类型">{device.type || '--'}</Descriptions.Item>
            <Descriptions.Item label="规格型号">{device.model || '--'}</Descriptions.Item>
            <Descriptions.Item label="品牌">{device.brand || '--'}</Descriptions.Item>
            <Descriptions.Item label="设备ID">{device.deviceId}</Descriptions.Item>
            <Descriptions.Item label="监测编码">{device.monitorCode || '--'}</Descriptions.Item>
            <Descriptions.Item label="绑定状态">
              <StatusTag value={binding?.configStatus || '未配置'} tip={binding ? `绑定 v${binding.version}` : '未创建绑定'} />
            </Descriptions.Item>
            <Descriptions.Item label="生命周期"><StatusTag value={device.lifecycleStatus} /></Descriptions.Item>
            <Descriptions.Item label="入账来源">
              {lifecycleTaskForDevice ? (
                <Space size={6}>
                  {embedded ? <span>{lifecycleTaskForDevice.taskNo}</span> : <a onClick={() => navigate('/lifecycle/tasks')}>{lifecycleTaskForDevice.taskNo}</a>}
                  <Tag color={lifecycleTaskForDevice.sourceType === 'MANUAL' ? 'default' : 'processing'}>
                    {lifecycleTaskForDevice.sourceType === 'MANUAL' ? '手工新增' : '采购系统同步'}
                  </Tag>
                </Space>
              ) : (
                <span style={{ color: '#8a97a3' }}>手工建档 / 未走流程</span>
              )}
            </Descriptions.Item>
            <Descriptions.Item label="组织">{device.organizationId || '--'}</Descriptions.Item>
            <Descriptions.Item label="车间">{device.workshopName || '--'}</Descriptions.Item>
            <Descriptions.Item label="产线 / 工位">{[device.lineName, device.stationName].filter(Boolean).join(' / ') || '--'}</Descriptions.Item>
            <Descriptions.Item label="位置">{device.location || '--'}</Descriptions.Item>
            <Descriptions.Item label="设备负责人">{device.owner || '--'}</Descriptions.Item>
            <Descriptions.Item label="启用日期">{device.enableDate || '--'}</Descriptions.Item>
            <Descriptions.Item label="采购日期">{device.buyDate || '--'}</Descriptions.Item>
            <Descriptions.Item label="资产编号（档案）">{device.assetNo || '--'}</Descriptions.Item>
          </Descriptions>
        </Card>
        <Card size="small" style={{ marginBottom: 12 }} title="OEE 资格">
          <Descriptions size="small" bordered column={3} labelStyle={{ width: 120 }}>
            <Descriptions.Item label="是否纳入 OEE 分析">
              <Tag color={device.oeeEligible ? 'success' : 'default'}>{device.oeeEligible == null ? '--' : device.oeeEligible ? '是' : '否'}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="绑定前提">
              {binding?.configStatus === '已启用' ? <Tag color="success">绑定已启用</Tag> : <Tag color="default">绑定未启用</Tag>}
            </Descriptions.Item>
            <Descriptions.Item label="OEE 统计">
              <Tag color={device.oeeEligible ? 'success' : 'default'}>{device.oeeEligible == null ? '--' : device.oeeEligible ? '是' : '否'}</Tag>
            </Descriptions.Item>
          </Descriptions>
        </Card>
        <Card size="small" title="设备二维码">
          <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
            <div style={{ width: 96, height: 96, background: 'repeating-conic-gradient(#202730 0% 25%, #fff 0% 50%) 50% / 10px 10px', borderRadius: 6 }} />
            <div style={hint}>
              <div>资产编号：{device.assetCode}</div>
              <div>设备名称：{device.name}</div>
              <div>规格型号：{device.model || '--'}</div>
              <div>设备类型：{device.type || '--'}</div>
              <div>车间 / 产线：{device.workshopName || '--'} / {device.lineName || '--'}</div>
            </div>
          </div>
          <div style={{ marginTop: 12 }}>
            {!embedded && <Button icon={<Printer size={14} />} onClick={() => message.info('已打印（38*68 mm 标签）')}>打印二维码</Button>}
          </div>
        </Card>
      </>
    ),
  });

  tabItems.push({
    key: 'lifecycle-history', label: '生命周期履历', children: (
      <Card size="small" title="生命周期履历">
        <Table
          rowKey="key" size="small" pagination={{ pageSize: 8, showTotal: t => `共 ${t} 条` }}
          dataSource={lifecycleHistory}
          locale={{ emptyText: <EmptyState description="该设备暂无生命周期履历" reason="设备手续入账、资产变更、闲置或报废动作会写入履历" /> }}
          columns={[
            { title: '时间', dataIndex: 'time', width: 160, render: dash },
            { title: '类型', dataIndex: 'type', width: 110 },
            { title: '单据/事件', dataIndex: 'title', width: 170, ellipsis: true },
            { title: '说明', dataIndex: 'detail', ellipsis: true },
            { title: '处理人', dataIndex: 'actor', width: 100, render: dash },
            { title: '状态', dataIndex: 'status', width: 100, render: v => <StatusTag value={v} /> },
          ]}
        />
      </Card>
    ),
  });

  tabItems.push({
    key: 'inspection', label: '点检记录', children: (
      <Table
        rowKey="key" size="small" pagination={false}
        dataSource={inspectionRows}
        locale={{ emptyText: emptyText('点检记录') }}
        columns={[
          { title: '点检计划', dataIndex: 'plan', width: 180 },
          { title: '任务日期', dataIndex: 'date', width: 100 },
          { title: '任务状态', dataIndex: 'taskStatus', width: 90, render: (v) => <StatusTag value={v} /> },
          { title: '点检项目', dataIndex: 'items' },
          { title: '应检', dataIndex: 'itemCount', width: 70, align: 'center', render: dash },
          { title: '已检', dataIndex: 'checked', width: 70, align: 'center', render: dash },
          { title: '未检', dataIndex: 'unchecked', width: 70, align: 'center', render: (v) => (v > 0 ? <span style={{ color: '#cf1322' }}>{v}</span> : v) },
          { title: '执行时间', dataIndex: 'execTime', width: 130, render: dash },
          { title: '跳过原因', dataIndex: 'skipReason', render: dash },
        ]}
      />
    ),
  });

  tabItems.push({
    key: 'patrol', label: '巡检记录', children: (
      <Table
        rowKey="key" size="small" pagination={false}
        dataSource={patrolRows}
        locale={{ emptyText: emptyText('巡检记录') }}
        columns={[
          { title: '巡检计划', dataIndex: 'plan', width: 170 },
          { title: '巡检标准', dataIndex: 'standard', width: 160, render: dash },
          { title: '任务日期', dataIndex: 'date', width: 100 },
          { title: '任务状态', dataIndex: 'taskStatus', width: 90, render: (v) => <StatusTag value={v} /> },
          { title: '巡检项目', dataIndex: 'items' },
          { title: '应检', dataIndex: 'itemCount', width: 70, align: 'center', render: dash },
          { title: '已检', dataIndex: 'checked', width: 70, align: 'center', render: dash },
          { title: '未检', dataIndex: 'unchecked', width: 70, align: 'center', render: (v) => (v > 0 ? <span style={{ color: '#cf1322' }}>{v}</span> : v) },
          { title: '执行时间', dataIndex: 'execTime', width: 130, render: dash },
          { title: '跳过原因', dataIndex: 'skipReason', render: dash },
        ]}
      />
    ),
  });

  tabItems.push({
    key: 'maintenance', label: '保养记录', children: (
      <Table
        rowKey="key" size="small" pagination={false}
        dataSource={maintenanceRows}
        locale={{ emptyText: emptyText('保养记录') }}
        columns={[
          { title: '任务编号', dataIndex: 'code', width: 150 },
          { title: '保养计划', dataIndex: 'plan', width: 170 },
          { title: '保养日期', dataIndex: 'date', width: 100 },
          { title: '负责人', dataIndex: 'owner', width: 110, render: dash },
          { title: '状态', dataIndex: 'status', width: 90, render: (v) => <StatusTag value={v} /> },
          { title: '备注', dataIndex: 'remark', render: dash },
        ]}
      />
    ),
  });

  tabItems.push({
    key: 'repair', label: '维修记录', children: (
      <>
        <div style={{ fontWeight: 600, margin: '4px 0 8px' }}>报修登记（{repairReportRows.length}）</div>
        <Table
          rowKey="key" size="small" pagination={false} style={{ marginBottom: 12 }}
          dataSource={repairReportRows}
          locale={{ emptyText: emptyText('报修登记') }}
          columns={[
            { title: '报修编号', dataIndex: 'reportId', width: 150 },
            { title: '报修标题', dataIndex: 'title' },
            { title: '故障类型', dataIndex: 'faultType', width: 90, render: dash },
            { title: '级别', dataIndex: 'level', width: 80, render: (v) => <StatusTag value={v} /> },
            { title: '状态', dataIndex: 'status', width: 100, render: (v) => <StatusTag value={v} /> },
            { title: '报修人', dataIndex: 'creator', width: 90, render: dash },
            { title: '报修时间', dataIndex: 'createTime', width: 140, render: dash },
          ]}
        />
        <div style={{ fontWeight: 600, margin: '4px 0 8px' }}>维修工单（{repairOrderRows.length}）</div>
        <Table
          rowKey="key" size="small" pagination={false}
          dataSource={repairOrderRows}
          locale={{ emptyText: emptyText('维修工单') }}
          columns={[
            {
              title: '工单号', dataIndex: 'repairOrderId', width: 150,
              render: (v, r) => embedded ? v : <a onClick={() => navigate(`/repair-orders/${r.repairOrderId}`)}>{v}</a>,
            },
            { title: '工单标题', dataIndex: 'title' },
            { title: '故障类型', dataIndex: 'faultType', width: 90, render: dash },
            { title: '级别', dataIndex: 'level', width: 80, render: (v) => <StatusTag value={v} /> },
            { title: '状态', dataIndex: 'status', width: 100, render: (v) => <StatusTag value={v} /> },
            { title: '维修人', dataIndex: 'assignee', width: 90, render: dash },
            { title: '创建时间', dataIndex: 'createdAt', width: 140, render: dash },
          ]}
        />
      </>
    ),
  });

  tabItems.push({
    key: 'network', label: '联网配置', children: (
      hasBinding ? (
        <>
          <Card size="small" style={{ marginBottom: 12 }} title="绑定与拉取">
            <Descriptions size="small" bordered column={3} labelStyle={{ width: 120 }}>
              <Descriptions.Item label="监测编码">{device.monitorCode}</Descriptions.Item>
              <Descriptions.Item label="绑定ID">{binding.bindingId}</Descriptions.Item>
              <Descriptions.Item label="绑定版本">v{binding.version}</Descriptions.Item>
              <Descriptions.Item label="配置状态"><StatusTag value={binding.configStatus} /></Descriptions.Item>
              <Descriptions.Item label="通信健康"><StatusTag value={health?.status || null} /></Descriptions.Item>
              <Descriptions.Item label="最后样本">{health?.lastSampleAt || '--'}</Descriptions.Item>
              <Descriptions.Item label="生效区间">{binding.effectiveFrom || '--'} 至 {binding.effectiveTo || '至今'}</Descriptions.Item>
              <Descriptions.Item label="拉取周期">{binding.pullCycleSec != null ? `${binding.pullCycleSec} 秒` : '--'}</Descriptions.Item>
              <Descriptions.Item label="最近拉取">{binding.lastPullTime || '--'}</Descriptions.Item>
              <Descriptions.Item label="拉取失败次数">{binding.pullFailCount ?? '--'}</Descriptions.Item>
              <Descriptions.Item label="待补偿样本">{binding.pendingCompensation ?? '--'}</Descriptions.Item>
              <Descriptions.Item label="启用中的来源设备">{sourceItems.length} 个</Descriptions.Item>
            </Descriptions>
          </Card>
          <Card size="small" style={{ marginBottom: 12 }} title="接入参数（平台维护 · 只读）">
            <Descriptions column={3} size="small" bordered>
              <Descriptions.Item label="协议">--</Descriptions.Item>
              <Descriptions.Item label="网关">--</Descriptions.Item>
              <Descriptions.Item label="IP">--</Descriptions.Item>
              <Descriptions.Item label="端口">--</Descriptions.Item>
              <Descriptions.Item label="点表">--</Descriptions.Item>
            </Descriptions>
          </Card>
          <Card size="small" title={`来源设备（共 ${(binding.items || []).length} 个，接入指标 ${totalMetrics} 项 / 监控中 ${totalMonitored} 项）`}>
            <Table
              rowKey="iotDeviceId" size="small" pagination={false}
              dataSource={binding.items || []}
              locale={{ emptyText: emptyText('来源设备') }}
              columns={[
                { title: '编码', dataIndex: 'iotDeviceCode', width: 140 },
                { title: '类型', width: 110, render: (_, r) => (r.sensorType && r.sensorType !== '--' ? <Tag color="cyan">{r.sensorType}</Tag> : '--') },
                { title: '启用', dataIndex: 'enabled', width: 90, render: v => <StatusTag value={v ? '已启用' : '已停用'} /> },
                {
                  title: '接入指标（蓝色 = 监控中）', render: (_, r) => (
                    <Space size={4} wrap>
                      {(r.metrics || []).map(m => (
                        <Tag key={m.metricCode} color={m.monitored ? 'blue' : 'default'}>{m.metricCode}{m.metricVersion ? ` · ${m.metricVersion}` : ''}</Tag>
                      ))}
                      {(r.metrics || []).length === 0 && <span style={{ color: '#8a97a3', fontSize: 12 }}>--</span>}
                    </Space>
                  ),
                },
              ]}
            />
            {!embedded && <div style={{ marginTop: 12 }}>
              <Button onClick={() => navigate('/binding-overview')}>前往物联网接入配置</Button>
            </div>}
          </Card>
        </>
      ) : (
        <Card size="small">
          <EmptyState
            description="该设备尚未创建 IoT 绑定，未接入运行监测"
            reason="未绑定设备不参与运行监测、报警判定与 OEE 统计"
            next={embedded ? undefined : '前往物联网接入配置创建首个绑定'}
            onNext={() => navigate('/binding-overview')}
            nextLabel="前往物联网接入配置"
          />
        </Card>
      )
    ),
  });

  if (hasBinding) {
    tabItems.push({
      key: 'realtime', label: '实时监测', children: (
        <>
          <div className="metric-grid" style={{ marginBottom: 12 }}>
            <MetricTile label="运行状态" value={lifecycleOnly ? null : realtime.runStatus || null} color="#1668dc" />
            <MetricTile label="通信健康" value={lifecycleOnly ? null : health.status || null} color="#16a34a" />
            <MetricTile label="数据延迟" value={health.latencySec ?? null} unit="s" color="#d97706" />
            <MetricTile label="采集质量率" value={lifecycleOnly ? null : health.qualityRate || null} color="#1668dc" />
            <MetricTile label="OEE（实时窗口）" value={oee && oee.oee != null ? oee.oee : null} unit={oee && oee.oee != null ? '%' : undefined} color="#16a34a" />
          </div>
          {oee && oee.oee == null && !lifecycleOnly && (
            <Alert
              type="info" showIcon style={{ marginBottom: 12 }}
              message={`OEE 不可计算：${(oee.blockers || []).join('；') || '该窗口无生产数据'}`}
            />
          )}
          <Card size="small" title={`实时指标样本（绑定 v${binding.version}）`}>
            <Table
              rowKey={r => `${r.iotDeviceCode}|${r.metricCode}`}
              size="small" pagination={false}
              dataSource={realtime.metrics}
              columns={metricColumns}
              locale={{ emptyText: <EmptyState description="该设备未配置监控指标（仅存储未监控）" reason="可在物联网接入配置「监控指标配置」中勾选纳入曲线监控的指标" next={embedded ? undefined : '前往物联网接入配置'} onNext={() => navigate('/binding-overview')} /> }}
            />
          </Card>
        </>
      ),
    });
    tabItems.push({
      key: 'metric-history', label: '指标历史数据', children: (
        <MetricHistoryPanel device={device} realtime={realtime} metricsByKey={state.entities.metricsByKey} referenceTime={meta.updatedAt} />
      ),
    });
    tabItems.push({
      key: 'trend', label: '状态与趋势', children: (
        <>
          {embedded && (
            <dl className="device-ledger-summary">
              <div><dt>运行状态</dt><dd>{realtime.runStatus || '--'}</dd></div>
              <div><dt>今日稼动率</dt><dd>{device.dashboardUtilization == null ? '--' : `${device.dashboardUtilization}%`}</dd></div>
              {['S.lubricant_state', 'S.coolant_state', 'S.program_compare'].map(metricCode => {
                const metric = realtime.metrics.find(row => row.metricCode === metricCode);
                return metric && <div key={metricCode}><dt>{metric.name}</dt><dd data-status={metric.value}>{metric.value ?? '--'}</dd></div>;
              })}
            </dl>
          )}
          {(numericMetricOptions.length > 0 || monitorCurves.length > 0) && (
            <Card
              className={embedded ? 'device-ledger-monitor' : undefined}
              size="small" style={{ marginBottom: 12 }}
              title={`监控曲线（${monitorCurves.length ? `已配置 ${monitorCurves.length} 项` : '未配置'}）`}
              extra={(
                <Button size="small" icon={<Activity size={13} />} onClick={() => setCurveModalOpen(true)}>
                  配置监控曲线
                </Button>
              )}
            >
              {monitorCurves.length === 0 ? (
                <span style={{ color: '#8a97a3', fontSize: 12 }}>
                  尚未配置：点击「配置监控曲线」，勾选该设备已绑定来源中类型为「数值」的指标，选择后在此形成曲线趋势图进行监控。
                </span>
              ) : (
                <div className={embedded ? 'device-ledger-curves' : undefined} style={embedded ? undefined : { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
                  {monitorCurves.map((code) => {
                    const row = numericMetricOptions.find(r => r.metricCode === code);
                    const values = curveSeries(code, row?.value ?? null);
                    return (
                      <div className={embedded ? 'device-ledger-curve' : undefined} key={code}>
                        <div style={{ fontSize: 12, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          <b>{row?.name || code}</b>
                          <span style={{ color: 'var(--detail-muted, #8a97a3)' }}>{code} · 来源 {row?.iotDeviceCode || '--'}</span>
                          <Tag color="processing">{row?.value ?? '--'} {row?.unit || ''}</Tag>
                          <Tag color={QUALITY_COLOR[row?.qualityCode] || 'default'}>{QUALITY_LABEL[row?.qualityCode] || row?.qualityCode || '--'}</Tag>
                        </div>
                        {values ? (
                          <ResponsiveContainer width="100%" height={embedded ? '100%' : 160} className={embedded ? 'device-ledger-chart' : undefined}>
                            <LineChart data={values.map((v, i) => chartPoint(v, i, values.length))}>
                              <CartesianGrid strokeDasharray="3 3" stroke="var(--detail-chart-grid, #e5e8ea)" />
                              <XAxis dataKey="i" tick={{ fontSize: 10, fill: 'var(--detail-chart-label, #5d6b78)' }} />
                              <YAxis tick={{ fontSize: 10, fill: 'var(--detail-chart-label, #5d6b78)' }} domain={['auto', 'auto']} />
                              <Tooltip contentStyle={{ background: 'var(--detail-tooltip-bg, #fff)', borderColor: 'var(--detail-chart-grid, #e5e8ea)', color: 'var(--detail-tooltip-text, #202730)' }} />
                              <Line type="linear" dataKey="v" stroke="var(--detail-chart-line, #00b8d4)" strokeWidth={2} dot={false} isAnimationActive={!embedded} />
                            </LineChart>
                          </ResponsiveContainer>
                        ) : (
                          <div className={embedded ? 'device-ledger-chart-empty' : undefined} style={embedded ? undefined : { color: '#8a97a3', fontSize: 12, padding: '48px 0', textAlign: 'center', border: '1px dashed #eef1f4', borderRadius: 6 }}>
                            当前无数据（数据中断或指标无值），无法成图
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
              {embedded && monitorCurves.length > 0 && (
                <div style={hint} className="device-ledger-series-note">
                  {'演示序列 · 近 55 分钟，每 5 分钟一个采样点；仅用于界面演示。'}
                </div>
              )}
            </Card>
          )}
          {embedded && monitorCurves.length > 0 ? null : trendEntries.length === 0 ? (
            <Card size="small">
              <EmptyState
                description="该设备暂无可展示的趋势序列"
                reason={realtime.healthStatus === '数据中断' ? '设备数据中断，无有效样本序列' : '当前筛选条件下没有数据'}
              />
            </Card>
          ) : (
            <div className="trend-facet">
              <Card
                size="small"
                title={`趋势 · ${currentTrend.metricCode}`}
                extra={(
                  <Space>
                    {trendEntries.map(t => (
                      <Button key={t.key} size="small" type={t.key === currentTrend.key ? 'primary' : 'default'} onClick={() => setTrendKey(t.key)}>
                        {t.metricCode}
                      </Button>
                    ))}
                  </Space>
                )}
              >
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={currentTrend.values.map((v, i) => chartPoint(v, i, currentTrend.values.length))}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--detail-chart-grid, #e5e8ea)" />
                    <XAxis dataKey="i" tick={{ fontSize: 10, fill: 'var(--detail-chart-label, #5d6b78)' }} />
                    <YAxis tick={{ fontSize: 10, fill: 'var(--detail-chart-label, #5d6b78)' }} domain={['auto', 'auto']} />
                    <Tooltip contentStyle={{ background: 'var(--detail-tooltip-bg, #fff)', borderColor: 'var(--detail-chart-grid, #e5e8ea)', color: 'var(--detail-tooltip-text, #202730)' }} />
                    <Line type="linear" dataKey="v" stroke="var(--detail-chart-line, #1668dc)" strokeWidth={2} dot={false} isAnimationActive={!embedded} />
                  </LineChart>
                </ResponsiveContainer>
              </Card>
              <Card size="small" title="数据质量标记">
                <div className="quality-marks">
                  <span className="quality-mark">正常</span>
                  <span className="quality-mark warn">延迟</span>
                  <span className="quality-mark warn">补传</span>
                  <span className="quality-mark danger">缺失</span>
                </div>
              </Card>
            </div>
          )}
        </>
      ),
    });
    tabItems.push({
      key: 'alarm', label: '报警事件', children: (
        <Card size="small" title="该设备报警事件">
          <Table
            rowKey="key" size="small" pagination={false}
            locale={{ emptyText: <EmptyState description="该设备暂无报警事件" reason="报警由监测指标触发，已关闭事件可在报警中心查看全部" next={embedded ? undefined : '前往报警中心'} onNext={() => navigate('/alarm-center')} nextLabel="前往报警中心" /> }}
            dataSource={alarmRows}
            columns={[
              { title: '报警ID', dataIndex: 'id', width: 150 },
              { title: '报警名称', dataIndex: 'name' },
              { title: '级别', dataIndex: 'severity', width: 80, render: v => <StatusTag value={v} /> },
              { title: '状态', dataIndex: 'status', width: 110, render: v => <StatusTag value={v} /> },
              { title: '触发指标', dataIndex: 'metric', width: 100, render: dash },
              { title: '触发值', dataIndex: 'trigger', width: 110, render: dash },
              { title: '阈值', dataIndex: 'threshold', width: 140, ellipsis: true, render: dash },
              { title: '触发时间', dataIndex: 'time', width: 100, render: dash },
              { title: '持续时长', dataIndex: 'duration', width: 90, render: dash },
              {
                title: '操作', width: 80,
                render: (_, r) => (embedded || r.status === '已关闭' ? null : <Button type="link" size="small" onClick={() => navigate('/alarm-center')}>去处理</Button>),
              },
            ]}
          />
        </Card>
      ),
    });
    tabItems.push({
      key: 'production', label: '生产记录', children: (
        <Card size="small" title="生产结果记录（OEE 分析生产数据）">
          <Table
            rowKey="key" size="small" pagination={false}
            dataSource={productionRows}
            locale={{ emptyText: <EmptyState description="该设备暂无生产记录数据" reason="生产结果由设备上报产生，OEE 分析所需的生产数据将在此展示" /> }}
            columns={[
              { title: '日期', dataIndex: 'date', width: 120 },
              { title: '产出', dataIndex: 'output', width: 90, align: 'center', render: dash },
              { title: '加工数', dataIndex: 'processed', width: 90, align: 'center', render: dash },
              { title: '合格', dataIndex: 'qualified', width: 90, align: 'center', render: dash },
              { title: '不合格', dataIndex: 'unqualified', width: 90, align: 'center', render: (v) => (v > 0 ? <span style={{ color: '#cf1322' }}>{v}</span> : v) },
              { title: '合格率', dataIndex: 'passRate', width: 100, align: 'center', render: dash },
              { title: '加工节拍', dataIndex: 'beat', width: 110, render: dash },
            ]}
          />
        </Card>
      ),
    });
  }

  return (
    <>
      {!embedded && <PageHeader
        title={`${device.name} · ${device.assetCode}`}
        subtitle={`${device.location || device.workshopName || '--'} · 生命周期 ${device.lifecycleStatus || '--'}`}
        actions={(
          <Space>
            {accessTag}
            <Button icon={<ArrowLeft size={14} />} onClick={() => navigate('/device-ledger')}>返回列表</Button>
          </Space>
        )}
      />}
      {!embedded && <DegradedBanner meta={meta} />}
      {hasBinding && !lifecycleOnly && realtime.healthStatus === '数据中断' && (
        <Alert
          type="warning" showIcon style={{ marginBottom: 12 }}
          message="该设备数据中断：所有指标无数据（无数据 ≠ 0）"
          description={`最后样本 ${health.lastSampleAt || '--'}。${embedded ? '恢复采集前不使用历史值推断当前状态。' : '可查看接入任务了解失败原因与下一步处理建议。'}`}
        />
      )}

      <Tabs
        defaultActiveKey="base"
        activeKey={activeTab || undefined}
        onChange={setActiveTab}
        items={tabItems}
        tabBarGutter={16}
      />

      {/* 配置监控曲线：勾选该设备绑定来源中类型为「数值」的指标，确定后形成曲线趋势图 */}
      <Modal
        title={`配置监控曲线 · ${device.name}（${device.deviceId}）`}
        width={640}
        centered={embedded}
        rootClassName={embedded ? 'device-archive-curve-modal' : undefined}
        open={curveModalOpen}
        onCancel={() => setCurveModalOpen(false)}
        onOk={() => {
          setMonitorCurves(curveDraft);
          setCurveModalOpen(false);
        }}
        okText={`确定（已选 ${curveDraft.length} 项）`}
        cancelText="取消"
      >
        <Alert
          type="info" showIcon style={{ marginBottom: 12 }}
          message="仅列出该设备绑定（启用）来源中类型为「数值」的指标；状态 / 事件类指标（S.*）不参与曲线监控。可多选，确定后在「状态与趋势」栏目形成各指标的曲线趋势图。"
        />
        {numericMetricOptions.length === 0 ? (
          <div style={{ color: '#8a97a3', fontSize: 12, padding: '8px 0' }}>
            该设备监控中（monitored）的数值类指标为空：请先在「物联网接入配置 · 监控指标配置」中把数值型指标勾选纳入监控。
          </div>
        ) : (
          <div style={{ border: '1px solid #eef1f4', borderRadius: 6, padding: '8px 12px', maxHeight: 320, overflow: 'auto' }}>
            {numericMetricOptions.map((r) => (
              <div key={r.metricCode} style={{ padding: '4px 0' }}>
                <Checkbox
                  checked={curveDraft.includes(r.metricCode)}
                  onChange={(e) => {
                    setCurveDraft(e.target.checked
                      ? [...curveDraft, r.metricCode]
                      : curveDraft.filter((c) => c !== r.metricCode));
                  }}
                >
                  <span>{r.name}（{r.metricCode}）</span>
                  <span style={{ color: '#8a97a3', marginLeft: 6 }}>来源 {r.iotDeviceCode || '--'}</span>
                  <Tag style={{ marginLeft: 6 }}>{r.value ?? '--'} {r.unit || ''}</Tag>
                  <Tag color={QUALITY_COLOR[r.qualityCode] || 'default'}>{QUALITY_LABEL[r.qualityCode] || r.qualityCode}</Tag>
                </Checkbox>
              </div>
            ))}
          </div>
        )}
      </Modal>
    </>
  );
}
