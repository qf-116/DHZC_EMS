import React, { useMemo, useState } from 'react';
import { Card, Table, Tag, Button, Space, Select, DatePicker } from 'antd';
import dayjs from 'dayjs';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Download, Search } from 'lucide-react';
import { App } from 'antd';
import PageHeader from '../components/PageHeader.jsx';
import MetricTile from '../components/MetricTile.jsx';
import StatusTag from '../components/StatusTag.jsx';
import EmptyState from '../components/EmptyState.jsx';
import DegradedBanner from '../components/DegradedBanner.jsx';
import { useDemoState, useDemoActions } from '../state/DemoStore.jsx';
import { selectExportTasks } from '../state/selectors.js';

const THEME = 'repair';

const { RangePicker } = DatePicker;

const STATUS_KEYS = ['待派工', '已派工', '维修中', '挂起', '待验收', '已完成', '已取消'];

// 维修统计报表：由 repairOrdersById 按设备聚合（各状态数量、返修次数、SLA 达成）。
// 口径：SLA 达成 = 已完成工单中「验收时间 ≤ 承诺完成时间」；超期未闭环 = 未结单且承诺完成时间早于演示日。
export default function RepairReportPage() {
  const { message } = App.useApp();
  const state = useDemoState();
  const actions = useDemoActions();
  const meta = state.meta;

  // UI 层筛选：设备 / 状态 / 统计日期范围
  const [device, setDevice] = useState('all');
  const [status, setStatus] = useState('all');
  const [range, setRange] = useState(null);

  // 日期范围过滤助手（按前 10 位日期字符串比较）
  const inRange = (d) => {
    if (!range || !range[0] || !range[1]) return true;
    if (!d) return false;
    const s = String(d).slice(0, 10);
    return s >= range[0].format('YYYY-MM-DD') && s <= range[1].format('YYYY-MM-DD');
  };

  const orders = useMemo(() => Object.values(state.entities.repairOrdersById), [state]);
  const reports = useMemo(() => Object.values(state.entities.repairReportsById), [state]);
  const deviceOptions = useMemo(() => {
    const names = [...new Set(orders.map(o => o.deviceName).filter(Boolean))];
    return names.map(n => ({ value: n, label: n }));
  }, [orders]);

  const scoped = useMemo(
    () => orders.filter(o => {
      if (!inRange(o.createdAt)) return false; // 统计日期范围：按工单创建时间过滤后再聚合
      if (device !== 'all' && o.deviceName !== device) return false;
      if (status !== 'all' && o.status !== status) return false;
      return true;
    }),
    [orders, device, status, range],
  );

  // 按设备聚合
  const rows = useMemo(() => {
    const byDevice = new Map();
    for (const o of scoped) {
      if (!byDevice.has(o.deviceName)) {
        byDevice.set(o.deviceName, {
          deviceName: o.deviceName, deviceId: o.deviceId,
          total: 0, status: Object.fromEntries(STATUS_KEYS.map(k => [k, 0])),
          rework: 0, slaMet: 0, slaDone: 0, overdueOpen: 0, faultTypes: {},
        });
      }
      const row = byDevice.get(o.deviceName);
      row.total += 1;
      if (row.status[o.status] !== undefined) row.status[o.status] += 1;
      row.rework += (o.reworkCount || 0) > 0 ? 1 : 0; // 返修工单数
      const done = o.status === '已完成';
      if (done) {
        row.slaDone += 1;
        if (o.acceptedAt && o.slaDueAt && o.acceptedAt <= o.slaDueAt) row.slaMet += 1;
      } else if (o.status !== '已取消' && o.slaDueAt && o.slaDueAt.slice(0, 10) < (meta.demoDay || '')) {
        row.overdueOpen += 1;
      }
      if (o.faultType) row.faultTypes[o.faultType] = (row.faultTypes[o.faultType] || 0) + 1;
    }
    return [...byDevice.values()].sort((a, b) => b.total - a.total);
  }, [scoped, meta.demoDay]);

  const totals = useMemo(() => rows.reduce((a, r) => ({
    total: a.total + r.total,
    pendingDispatch: a.pendingDispatch + r.status['待派工'],
    doing: a.doing + r.status['已派工'] + r.status['维修中'] + r.status['挂起'],
    pendingAccept: a.pendingAccept + r.status['待验收'],
    done: a.done + r.status['已完成'],
    rework: a.rework + r.rework,
    slaMet: a.slaMet + r.slaMet, slaDone: a.slaDone + r.slaDone,
    overdueOpen: a.overdueOpen + r.overdueOpen,
  }), { total: 0, pendingDispatch: 0, doing: 0, pendingAccept: 0, done: 0, rework: 0, slaMet: 0, slaDone: 0, overdueOpen: 0 }), [rows]);

  const slaRate = totals.slaDone > 0 ? Math.round((totals.slaMet / totals.slaDone) * 100) : null;

  // 故障类型分布（由工单故障类型聚合）
  const faultTypeData = useMemo(() => {
    const acc = {};
    for (const r of rows) for (const [t, c] of Object.entries(r.faultTypes)) acc[t] = (acc[t] || 0) + c;
    return Object.entries(acc).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [rows]);

  const exportTasks = useMemo(
    () => selectExportTasks(state).filter(t => t.theme === THEME),
    [state],
  );

  const currentFilters = {
    device: device === 'all' ? '' : device,
    status: status === 'all' ? '' : status,
  };
  const handleQuery = () => {
    const res = actions.runReport(THEME, currentFilters);
    res.ok ? message.success(res.message) : message.error(res.message);
  };
  const handleReset = () => { setDevice('all'); setStatus('all'); setRange(null); };
  const handleExport = () => {
    const res = actions.createExportTask(THEME, currentFilters);
    res.ok ? message.success(res.message) : message.error(res.message);
  };
  const handleDownload = (task) => {
    message.success(`导出任务 ${task.exportId} 已创建，口径截止 ${task.statsCutoff || '--'}`);
  };

  const columns = [
    { title: '设备', dataIndex: 'deviceName', width: 160, render: v => v || '--' },
    { title: '工单总数', dataIndex: 'total', width: 90, align: 'center', sorter: (a, b) => a.total - b.total, render: v => <Tag color="processing">{v}</Tag> },
    ...STATUS_KEYS.map(k => ({
      title: k, key: `st-${k}`, width: 80, align: 'center',
      render: (_, r) => (r.status[k] > 0 ? <StatusTag value={k} /> : '--'),
    })),
    {
      title: '返修工单数', dataIndex: 'rework', width: 100, align: 'center',
      render: v => (v > 0 ? <Tag color="error">{v}</Tag> : v),
    },
    {
      title: 'SLA 达成', key: 'sla', width: 100, align: 'center',
      sorter: (a, b) => (a.slaDone ? a.slaMet / a.slaDone : -1) - (b.slaDone ? b.slaMet / b.slaDone : -1),
      render: (_, r) => (r.slaDone === 0
        ? <Tag title="暂无已完成工单，无法统计 SLA 达成">--</Tag>
        : <Tag color={r.slaMet === r.slaDone ? 'success' : 'warning'}>{r.slaMet}/{r.slaDone}</Tag>),
    },
    {
      title: '超期未闭环', dataIndex: 'overdueOpen', width: 100, align: 'center',
      render: v => (v > 0 ? <Tag color="error">{v}</Tag> : v),
    },
  ];

  return (
    <>
      <PageHeader
        title="维修统计报表"
        subtitle={`统计日 ${meta.demoDay || '--'} · 口径截止 ${meta.lastSampleAt || '--'}`}
      />
      <DegradedBanner meta={meta} />
      <div style={{ marginBottom: 12 }}>
        <Space wrap>
          <Button type="primary" icon={<Download size={14} />} onClick={handleExport}>导出</Button>
        </Space>
      </div>
      <Card size="small" style={{ marginBottom: 12 }}>
        <Space wrap>
          <RangePicker
            style={{ width: 250 }} allowClear
            value={range} onChange={setRange}
            presets={[
              { label: '最近7天', value: [dayjs().subtract(6, 'day'), dayjs()] },
              { label: '最近30天', value: [dayjs().subtract(29, 'day'), dayjs()] },
            ]}
            placeholder={['开始日期', '结束日期']}
          />
          <Select value={device} onChange={setDevice} style={{ width: 170 }} showSearch optionFilterProp="label" options={[{ value: 'all', label: '全部设备' }, ...deviceOptions]} />
          <Select value={status} onChange={setStatus} style={{ width: 130 }} options={[{ value: 'all', label: '全部状态' }, ...STATUS_KEYS.map(k => ({ value: k, label: k }))]} />
          <Button type="primary" icon={<Search size={14} />} onClick={handleQuery}>查询</Button>
          <Button onClick={handleReset}>重置</Button>
        </Space>
      </Card>
      <div className="metric-grid" style={{ marginBottom: 12 }}>
        <MetricTile label="维修工单" value={totals.total} unit="单" />
        <MetricTile label="报修记录" value={reports.length || '--'} unit={reports.length ? '单' : ''} />
        <MetricTile label="进行中（派工/维修/挂起）" value={totals.doing} unit="单" color="#d46b08" />
        <MetricTile label="待派工" value={totals.pendingDispatch} unit="单" color="#d97706" />
        <MetricTile label="待验收" value={totals.pendingAccept} unit="单" color="#8d6e63" />
        <MetricTile label="已完成" value={totals.done} unit="单" color="#16a34a" />
        <MetricTile label="返修工单" value={totals.rework} unit="单" color="#dc2626" />
        <MetricTile label="SLA 达成率" value={slaRate === null ? '--' : `${slaRate}%`} color="#1668dc" />
      </div>
      {faultTypeData.length > 0 && (
        <Card size="small" title="故障类型分布（按工单）" style={{ marginBottom: 12 }}>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={faultTypeData} margin={{ top: 6, right: 12, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e8ea" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} />
              <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
              <Tooltip formatter={v => `${v} 单`} />
              <Bar dataKey="value" name="维修工单" fill="#00b8d4" barSize={32} radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}
      {rows.length === 0 ? (
        <EmptyState
          description="当前筛选条件下无维修统计行"
          reason="当前筛选条件下没有数据，调整筛选或重置后重试"
          next="重置筛选"
          nextLabel="重置筛选"
          onNext={handleReset}
        />
      ) : (
        <Card size="small">
          <Table rowKey="deviceName" size="small" scroll={{ x: 1000 }} dataSource={rows} columns={columns} pagination={false} />
        </Card>
      )}
      {exportTasks.length > 0 && (
        <Card size="small" title="导出任务（异步任务）" style={{ marginTop: 12 }}>
          <Table
            rowKey="exportId" size="small" pagination={false}
            dataSource={exportTasks}
            columns={[
              { title: '任务号', dataIndex: 'exportId', width: 180 },
              { title: '状态', dataIndex: 'status', width: 90, render: v => <StatusTag value={v} /> },
              { title: '创建时间', dataIndex: 'createdAt', width: 170 },
              { title: '口径截止', dataIndex: 'statsCutoff', width: 170, render: v => v || '--' },
              { title: '说明', dataIndex: 'note', ellipsis: true, render: v => v || '--' },
              { title: '操作', width: 80, render: (_, r) => <Button type="link" size="small" onClick={() => handleDownload(r)}>下载</Button> },
            ]}
          />
        </Card>
      )}
    </>
  );
}
