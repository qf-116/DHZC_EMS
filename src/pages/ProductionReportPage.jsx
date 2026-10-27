import React, { useMemo, useState } from 'react';
import { App, Button, Card, DatePicker, Select, Space, Table, Tag } from 'antd';
import dayjs from 'dayjs';
import { Download, Search } from 'lucide-react';
import PageHeader from '../components/PageHeader.jsx';
import StatusTag from '../components/StatusTag.jsx';
import EmptyState from '../components/EmptyState.jsx';
import DegradedBanner from '../components/DegradedBanner.jsx';
import { useDemoState, useDemoActions } from '../state/DemoStore.jsx';
import { selectReportRows, selectExportTasks, selectAllDevices } from '../state/selectors.js';

const THEME = 'production';

const { RangePicker } = DatePicker;

const fmt = v => (v === null || v === undefined || v === '' ? '--' : v);

// 生产产出报表：产量 · 合格数量 · 合格率 · 加工节拍
// 数据来源：selectReportRows(state, 'production', filters)；空值统一显示 '--'
export default function ProductionReportPage() {
  const { message } = App.useApp();
  const state = useDemoState();
  const actions = useDemoActions();
  const meta = state.meta;

  // UI 层筛选，不进入业务快照
  const [workshop, setWorkshop] = useState('all');
  const [device, setDevice] = useState('all');
  const [date, setDate] = useState('all');
  const [range, setRange] = useState(null);

  // 日期范围过滤助手（按前 10 位日期字符串比较）
  const inRange = (d) => {
    if (!range || !range[0] || !range[1]) return true;
    if (!d) return false;
    const s = String(d).slice(0, 10);
    return s >= range[0].format('YYYY-MM-DD') && s <= range[1].format('YYYY-MM-DD');
  };

  const devices = useMemo(() => selectAllDevices(state), [state]);
  const workshopOf = useMemo(
    () => Object.fromEntries(devices.map(d => [d.name, d.workshopName])),
    [devices],
  );
  const workshopOptions = useMemo(
    () => [...new Set(devices.map(d => d.workshopName).filter(Boolean))].map(w => ({ value: w, label: w })),
    [devices],
  );
  const deviceOptions = useMemo(() => devices.map(d => ({ value: d.name, label: d.name })), [devices]);

  const allThemeRows = useMemo(() => selectReportRows(state, THEME), [state]);
  const dateOptions = useMemo(
    () => [...new Set(allThemeRows.map(r => r.date).filter(Boolean))].map(d => ({ value: d, label: d })),
    [allThemeRows],
  );

  const rows = useMemo(() => {
    const base = selectReportRows(state, THEME, {
      device: device === 'all' ? '' : device,
      date: date === 'all' ? '' : date,
    });
    // 统计日期范围：按行日期过滤后再出表
    const byRange = base.filter(r => inRange(r.date));
    return workshop === 'all' ? byRange : byRange.filter(r => workshopOf[r.device] === workshop);
  }, [state, device, date, workshop, workshopOf, range]);

  const exportTasks = useMemo(
    () => selectExportTasks(state).filter(t => t.theme === THEME),
    [state],
  );

  const currentFilters = {
    device: device === 'all' ? '' : device,
    date: date === 'all' ? '' : date,
    workshop: workshop === 'all' ? '' : workshop,
  };

  const handleQuery = () => {
    const res = actions.runReport(THEME, currentFilters);
    res.ok ? message.success(res.message) : message.error(res.message);
  };
  const handleReset = () => { setWorkshop('all'); setDevice('all'); setDate('all'); setRange(null); };
  const handleExport = () => {
    const res = actions.createExportTask(THEME, currentFilters);
    res.ok ? message.success(res.message) : message.error(res.message);
  };
  const handleDownload = (task) => {
    message.success(`导出任务 ${task.exportId} 已创建`);
  };

  const columns = [
    { title: '日期', dataIndex: 'date', width: 110 },
    { title: '设备', dataIndex: 'device', width: 150 },
    { title: '车间', dataIndex: 'device', width: 110, render: v => workshopOf[v] || '--' },
    { title: '产量', dataIndex: 'output', width: 90, sorter: (a, b) => (a.output ?? -1) - (b.output ?? -1), render: fmt },
    { title: '加工数量', dataIndex: 'processed', width: 100, render: fmt },
    { title: '合格数量', dataIndex: 'qualified', width: 100, render: fmt },
    { title: '不合格数量', dataIndex: 'unqualified', width: 110, render: fmt },
    { title: '合格率', dataIndex: 'passRate', width: 90, render: v => (v == null || v === '' ? '--' : <Tag color="success">{v}</Tag>) },
    { title: '平均加工节拍', dataIndex: 'beat', width: 120, render: fmt },
  ];

  return (
    <>
      <PageHeader
        title="生产产出报表"
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
          <Select value={workshop} onChange={setWorkshop} style={{ width: 140 }} options={[{ value: 'all', label: '全部车间' }, ...workshopOptions]} />
          <Select value={device} onChange={setDevice} style={{ width: 170 }} showSearch optionFilterProp="label" options={[{ value: 'all', label: '全部设备' }, ...deviceOptions]} />
          <Select value={date} onChange={setDate} style={{ width: 140 }} options={[{ value: 'all', label: '全部日期' }, ...dateOptions]} />
          <Button type="primary" icon={<Search size={14} />} onClick={handleQuery}>查询</Button>
          <Button onClick={handleReset}>重置</Button>
        </Space>
      </Card>
      <Space wrap style={{ marginBottom: 12 }}>
        <Button type="primary" icon={<Download size={14} />} onClick={handleExport}>导出</Button>
      </Space>
      {rows.length === 0 ? (
        <EmptyState
          description="当前筛选条件下无生产产出统计行"
          reason="当前筛选条件下没有数据，调整筛选后重试"
          next="重置筛选"
          nextLabel="重置筛选"
          onNext={handleReset}
        />
      ) : (
        <Table rowKey={r => r.date + r.device} size="small" scroll={{ x: 1000 }} dataSource={rows} columns={columns} />
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
