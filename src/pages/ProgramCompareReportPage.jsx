import React, { useMemo, useState } from 'react';
import { Alert, App, Button, Card, DatePicker, Select, Space, Table, Tag } from 'antd';
import dayjs from 'dayjs';
import { Download, Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../components/PageHeader.jsx';
import StatusTag from '../components/StatusTag.jsx';
import EmptyState from '../components/EmptyState.jsx';
import DegradedBanner from '../components/DegradedBanner.jsx';
import MetricTile from '../components/MetricTile.jsx';
import { useDemoState, useDemoActions } from '../state/DemoStore.jsx';
import { selectProgramCompare, selectExportTasks } from '../state/selectors.js';

const THEME = 'program';

const { RangePicker } = DatePicker;

const resultTag = (v) => {
  const color = { 一致: 'success', 参数不一致: 'error', 比对失败: 'warning', 不适用: 'default' }[v] || 'default';
  return <Tag color={color}>{v}</Tag>;
};

// 程序比对统计报表：由 programCompareById（程序比对记录）按设备聚合。
// 口径：未处理数 = 处置状态为「待确认」或「处理中」的记录；未处理数 > 0 的设备提示跳转 /program-compare 处置。
export default function ProgramCompareReportPage() {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const state = useDemoState();
  const actions = useDemoActions();
  const meta = state.meta;

  // UI 层筛选：统计日期范围、设备
  const [range, setRange] = useState(null);
  const [device, setDevice] = useState('all');

  // 明细的 time 字段仅含当日时刻（HH:mm:ss），记录日期取自 recordId 内嵌日期（PC-YYYYMMDD-…）
  const recordDay = (r) => {
    const m = String(r.recordId || '').match(/(\d{4})(\d{2})(\d{2})/);
    return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
  };
  const inRange = (d) => {
    if (!range || !range[0] || !range[1]) return true;
    if (!d) return false;
    const s = String(d).slice(0, 10);
    return s >= range[0].format('YYYY-MM-DD') && s <= range[1].format('YYYY-MM-DD');
  };

  const records = useMemo(() => selectProgramCompare(state), [state]);
  const deviceOptions = useMemo(() => {
    const names = [...new Set(records.map(r => r.deviceName).filter(Boolean))];
    return names.map(n => ({ value: n, label: n }));
  }, [records]);

  const scoped = useMemo(
    () => records.filter(r => (device === 'all' || r.deviceName === device) && inRange(recordDay(r))),
    [records, device, range],
  );

  const rows = useMemo(() => {
    const byDevice = new Map();
    for (const r of scoped) {
      if (!byDevice.has(r.deviceName)) {
        byDevice.set(r.deviceName, {
          deviceName: r.deviceName, deviceId: r.deviceId,
          total: 0, same: 0, diff: 0, failed: 0, notApplicable: 0,
          pending: 0, lastTime: null, programs: new Set(),
        });
      }
      const row = byDevice.get(r.deviceName);
      row.total += 1;
      if (r.result === '一致') row.same += 1;
      else if (r.result === '参数不一致') row.diff += 1;
      else if (r.result === '比对失败') row.failed += 1;
      else if (r.result === '不适用') row.notApplicable += 1;
      if (r.handled === '待确认' || r.handled === '处理中') row.pending += 1;
      if (r.time && r.time !== '--' && (!row.lastTime || r.time > row.lastTime)) row.lastTime = r.time;
      if (r.program) row.programs.add(`${r.program} / ${r.version || ''}`);
    }
    return [...byDevice.values()].map(r => ({ ...r, programs: [...r.programs].join('；') || '--' }))
      .sort((a, b) => b.pending - a.pending || b.total - a.total);
  }, [scoped]);

  const totals = useMemo(() => rows.reduce((a, r) => ({
    total: a.total + r.total, same: a.same + r.same, diff: a.diff + r.diff,
    failed: a.failed + r.failed, pending: a.pending + r.pending,
  }), { total: 0, same: 0, diff: 0, failed: 0, pending: 0 }), [rows]);

  const exportTasks = useMemo(
    () => selectExportTasks(state).filter(t => t.theme === THEME),
    [state],
  );

  const currentFilters = { device: device === 'all' ? '' : device };
  const handleQuery = () => {
    const res = actions.runReport(THEME, currentFilters);
    res.ok ? message.success(res.message) : message.error(res.message);
  };
  const handleReset = () => { setDevice('all'); setRange(null); };
  const handleExport = () => {
    const res = actions.createExportTask(THEME, currentFilters);
    res.ok ? message.success(res.message) : message.error(res.message);
  };
  const handleDownload = (task) => {
    message.success(`导出任务 ${task.exportId} 已创建`);
  };

  const columns = [
    { title: '设备', dataIndex: 'deviceName', width: 160, render: v => v || '--' },
    { title: '比对程序', dataIndex: 'programs', ellipsis: true },
    { title: '比对次数', dataIndex: 'total', width: 90, align: 'center', sorter: (a, b) => a.total - b.total, render: v => <Tag color="processing">{v}</Tag> },
    { title: '一致数', dataIndex: 'same', width: 90, align: 'center', render: v => (v > 0 ? <Tag color="success">{v}</Tag> : v) },
    { title: '参数不一致数', dataIndex: 'diff', width: 110, align: 'center', render: v => (v > 0 ? <Tag color="error">{v}</Tag> : v) },
    { title: '比对失败数', dataIndex: 'failed', width: 100, align: 'center', render: v => (v > 0 ? <Tag color="warning">{v}</Tag> : v) },
    { title: '不适用数', dataIndex: 'notApplicable', width: 90, align: 'center', render: v => v || '--' },
    {
      title: '未处理数', dataIndex: 'pending', width: 100, align: 'center',
      render: v => (v > 0 ? <Tag color="error">{v}</Tag> : v),
    },
    { title: '最近比对时间', dataIndex: 'lastTime', width: 110, render: v => v || '--' },
    {
      title: '操作', width: 110,
      render: (_, r) => (r.pending > 0
        ? <Button type="link" size="small" onClick={() => navigate('/program-compare')}>去处理（{r.pending}）</Button>
        : '--'),
    },
  ];

  return (
    <>
      <PageHeader
        title="程序比对统计报表"
        subtitle={`统计日 ${meta.demoDay || '--'} · 口径截止 ${meta.lastSampleAt || '--'}`}
      />
      <DegradedBanner meta={meta} />
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
          <Button type="primary" icon={<Search size={14} />} onClick={handleQuery}>查询</Button>
          <Button onClick={handleReset}>重置</Button>
        </Space>
      </Card>
      <Space wrap style={{ marginBottom: 12 }}>
        <Button type="primary" icon={<Download size={14} />} onClick={handleExport}>导出</Button>
      </Space>
      <div className="metric-grid" style={{ marginBottom: 12 }}>
        <MetricTile label="比对记录总数" value={totals.total} unit="条" />
        <MetricTile label="参数不一致" value={totals.diff} unit="条" color="#dc2626" />
        <MetricTile label="比对失败" value={totals.failed} unit="条" color="#d46b08" />
        <MetricTile label="未处理" value={totals.pending} unit="条" color="#d97706" />
      </div>
      {rows.length === 0 ? (
        <EmptyState
          description="当前筛选条件下无程序比对统计行"
          reason="当前筛选条件下没有数据，调整筛选后重试"
          next="重置筛选"
          nextLabel="重置筛选"
          onNext={handleReset}
        />
      ) : (
        <Table rowKey="deviceName" size="small" scroll={{ x: 1000 }} dataSource={rows} columns={columns} />
      )}
      {totals.pending > 0 && (
        <Alert
          type="warning"
          showIcon
          style={{ marginTop: 12 }}
          message={`存在 ${totals.pending} 条未处理的比对记录`}
          action={<Button size="small" type="primary" onClick={() => navigate('/program-compare')}>前往程序比对</Button>}
        />
      )}
      {exportTasks.length > 0 && (
        <Card size="small" title="导出任务" style={{ marginTop: 12 }}>
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
