import React, { useMemo, useState } from 'react';
import { App, Button, Card, DatePicker, Select, Space, Table, Tag } from 'antd';
import dayjs from 'dayjs';
import { Download } from 'lucide-react';
import PageHeader from '../components/PageHeader.jsx';
import ColTitle from '../components/ColTitle.jsx';
import FilterBar, { FilterField } from '../components/FilterBar.jsx';
import StatusTag from '../components/StatusTag.jsx';
import EmptyState from '../components/EmptyState.jsx';
import DegradedBanner from '../components/DegradedBanner.jsx';
import { useDemoState, useDemoActions } from '../state/DemoStore.jsx';
import { selectReportRows, selectExportTasks, selectAllDevices } from '../state/selectors.js';

const THEME = 'production';

const { RangePicker } = DatePicker;

const fmt = v => (v === null || v === undefined || v === '' ? '--' : v);

// 生产产出报表（2026-11-04 口径）：统计日期范围内各台设备的报工生产数量汇总——
//   一台设备一行，产量/加工/合格/不合格逐日求和，合格率按汇总数量重算（非各日平均），
//   平均加工节拍按产量加权平均；列表不展示「日期」列，默认统计范围最近 7 天（锚定数据最后日期）。
// 数据来源：selectReportRows(state, 'production', filters)；空值统一显示 '--'
export default function ProductionReportPage() {
  const { message } = App.useApp();
  const state = useDemoState();
  const actions = useDemoActions();
  const meta = state.meta;

  // UI 层筛选，不进入业务快照
  const [workshop, setWorkshop] = useState('all');
  const [device, setDevice] = useState('all');
  const [range, setRange] = useState(null); // 默认最近 7 天（锚定演示数据最后日期，见下方 effect）

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
  // 数据覆盖的最后日期：默认范围与快捷预设锚定它（演示数据停在 2026-09-16，锚定真实日期才能出数）
  const dataMax = useMemo(
    () => allThemeRows.map(r => r.date).filter(Boolean).sort().pop() || null,
    [allThemeRows],
  );
  const preset7 = useMemo(() => (dataMax ? [dayjs(dataMax).subtract(6, 'day'), dayjs(dataMax)] : null), [dataMax]);
  const preset30 = useMemo(() => (dataMax ? [dayjs(dataMax).subtract(29, 'day'), dayjs(dataMax)] : null), [dataMax]);
  React.useEffect(() => { if (preset7) setRange(preset7); }, [preset7]);

  const rows = useMemo(() => {
    const base = selectReportRows(state, THEME, {
      device: device === 'all' ? '' : device,
    });
    // 日期范围过滤后按设备聚合（2026-11-04 口径：范围内逐日求和，一台设备一行）
    const byRange = base.filter(r => inRange(r.date))
      .filter(r => workshop === 'all' || workshopOf[r.device] === workshop);
    const byDevice = new Map();
    for (const r of byRange) {
      if (!byDevice.has(r.device)) {
        byDevice.set(r.device, { device: r.device, output: 0, processed: 0, qualified: 0, unqualified: 0, beatNum: 0, beatW: 0 });
      }
      const a = byDevice.get(r.device);
      a.output += Number(r.output) || 0;
      a.processed += Number(r.processed) || 0;
      a.qualified += Number(r.qualified) || 0;
      a.unqualified += Number(r.unqualified) || 0;
      // 节拍 '2.4 s/件' → 按产量加权
      const beat = parseFloat(String(r.beat || ''));
      const out = Number(r.output) || 0;
      if (!Number.isNaN(beat) && out > 0) { a.beatNum += beat * out; a.beatW += out; }
    }
    return [...byDevice.values()].map((a) => ({
      device: a.device,
      output: a.output,
      processed: a.processed || '--',
      qualified: a.qualified || '--',
      unqualified: a.unqualified || '--',
      passRate: a.processed > 0 ? `${((a.qualified / a.processed) * 100).toFixed(1)}%` : '--',
      beat: a.beatW > 0 ? `${(a.beatNum / a.beatW).toFixed(1)} s/件` : '--',
    })).sort((x, y) => (y.output ?? 0) - (x.output ?? 0));
  }, [state, device, workshop, workshopOf, range]);

  const exportTasks = useMemo(
    () => selectExportTasks(state).filter(t => t.theme === THEME),
    [state],
  );

  const currentFilters = {
    device: device === 'all' ? '' : device,
    workshop: workshop === 'all' ? '' : workshop,
    range: range && range[0] ? `${range[0].format('YYYY-MM-DD')}~${range[1].format('YYYY-MM-DD')}` : '',
  };

  const handleQuery = () => {
    const res = actions.runReport(THEME, currentFilters);
    res.ok ? message.success(res.message) : message.error(res.message);
  };
  const handleReset = () => { setWorkshop('all'); setDevice('all'); setRange(preset7); };
  const handleExport = () => {
    const res = actions.createExportTask(THEME, currentFilters);
    res.ok ? message.success(res.message) : message.error(res.message);
  };
  const handleDownload = (task) => {
    message.success(`导出任务 ${task.exportId} 已创建`);
  };

  const columns = [
    { title: '设备', dataIndex: 'device', width: 150 },
    { title: '车间', dataIndex: 'device', width: 110, render: v => workshopOf[v] || '--' },
    { title: '产量', dataIndex: 'output', width: 90, sorter: (a, b) => (a.output ?? -1) - (b.output ?? -1), render: fmt },
    { title: '加工数量', dataIndex: 'processed', width: 100, render: fmt },
    { title: '合格数量', dataIndex: 'qualified', width: 100, render: fmt },
    { title: '不合格数量', dataIndex: 'unqualified', width: 110, render: fmt },
    { title: <ColTitle title="合格率" tip="合格率 = 汇总合格数量 ÷ 汇总加工数量 × 100%（按合计口径重算，非各日平均）" />, dataIndex: 'passRate', width: 90, render: v => (v == null || v === '' ? '--' : <Tag color="success">{v}</Tag>) },
    { title: <ColTitle title="平均节拍" tip="平均加工节拍 = Σ（各日节拍 × 各日产量）÷ Σ 产量（按产量加权平均）" />, dataIndex: 'beat', width: 110, render: fmt },
  ];

  return (
    <>
      <PageHeader
        title="生产产出报表"
        subtitle={`统计日 ${meta.demoDay || '--'} · 口径截止 ${meta.lastSampleAt || '--'}`}
      />
      <DegradedBanner meta={meta} />
      <FilterBar onQuery={handleQuery} onReset={handleReset}>
        <FilterField label="统计日期">
          <RangePicker
            style={{ width: 250 }} allowClear
            value={range} onChange={setRange}
            presets={[
              { label: '最近7天', value: preset7 },
              { label: '最近30天', value: preset30 },
            ]}
            placeholder={['开始日期', '结束日期']}
          />
        </FilterField>
        <FilterField label="车间">
          <Select value={workshop} onChange={setWorkshop} style={{ width: 140 }} options={[{ value: 'all', label: '全部车间' }, ...workshopOptions]} />
        </FilterField>
        <FilterField label="设备">
          <Select value={device} onChange={setDevice} style={{ width: 170 }} showSearch optionFilterProp="label" options={[{ value: 'all', label: '全部设备' }, ...deviceOptions]} />
        </FilterField>
      </FilterBar>
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
        <Table rowKey="device" size="small" scroll={{ x: 900 }} dataSource={rows} columns={columns} />
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
