import React, { useMemo, useState } from 'react';
import { App, Button, Card, DatePicker, Select, Space, Table, Tag, Tooltip } from 'antd';
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

const THEME = 'runtime';

const { RangePicker } = DatePicker;

// '13h 20m' → 分钟；非格式化输入返回 null
const parseDur = (v) => {
  const m = String(v || '').match(/^(?:(\d+)h\s*)?(?:(\d+)m)?$/);
  if (!m || (!m[1] && !m[2])) return null;
  return (Number(m[1]) || 0) * 60 + (Number(m[2]) || 0);
};
const fmtDur = (min) => (min == null ? '--' : `${Math.floor(min / 60)}h ${min % 60}m`);

// 运行状态统计（原名「运行时长与设备状态统计报表」，2026-11-04 简化命名）
// 口径（2026-11-04 需求方确认）：列表为所选日期范围内的汇总结果——
//   每台设备一行，时长类逐日求和、稼动率/状态占比按汇总时长重算、切换次数求和、
//   最长连续运行/最长离线取范围内最大值；列表不展示「日期」列与「数据完整率」列（2026-11-04 删除）。
//   默认统计范围 = 最近 7 天（锚定演示数据最后日期）。
// 数据来源：selectReportRows(state, 'runtime', filters)（内部引用演示种子兼容导出，页面不直接 import demoData）
export default function RunTimeReportPage() {
  const { message } = App.useApp();
  const state = useDemoState();
  const actions = useDemoActions();
  const meta = state.meta;

  // 筛选条件属 UI 状态，只存页面层，不进入业务快照
  const [workshop, setWorkshop] = useState('all');
  const [device, setDevice] = useState('all');
  const [range, setRange] = useState(null); // 默认最近 7 天（见下方 effect，锚定演示数据最后日期）

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
  const deviceOptions = useMemo(
    () => devices.map(d => ({ value: d.name, label: d.name })),
    [devices],
  );

  const allThemeRows = useMemo(() => selectReportRows(state, THEME), [state]);
  // 数据覆盖的最后日期：默认范围与快捷预设都锚定它（演示数据停在 2026-09-16，锚定真实日期才能出数）
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
    // 统计日期范围过滤后，按设备聚合（2026-11-04 口径：范围内逐日求和，一台设备一行）
    const byRange = base.filter(r => inRange(r.date))
      .filter(r => workshop === 'all' || workshopOf[r.device] === workshop);
    const byDevice = new Map();
    for (const r of byRange) {
      if (!byDevice.has(r.device)) {
        byDevice.set(r.device, {
          date: null, device: r.device, run: 0, standby: 0, fault: 0, offline: 0,
          switches: 0, maxRun: null, maxOffline: null, days: 0,
        });
      }
      const a = byDevice.get(r.device);
      a.run += parseDur(r.run) ?? 0;
      a.standby += parseDur(r.standby) ?? 0;
      a.fault += parseDur(r.fault) ?? 0;
      a.offline += parseDur(r.offline) ?? 0;
      a.switches += Number(r.switches) || 0;
      a.maxRun = Math.max(a.maxRun ?? -1, parseDur(r.maxRun) ?? -1);
      a.maxOffline = Math.max(a.maxOffline ?? -1, parseDur(r.maxOffline) ?? -1);
      a.days += 1;
    }
    return [...byDevice.values()].map((a) => {
      const denominator = a.run + a.standby + a.fault;
      const rate = denominator > 0 ? `${((a.run / denominator) * 100).toFixed(1)}%` : '--';
      const total = a.run + a.standby + a.fault + a.offline;
      const pct = (x) => (total > 0 ? `${((x / total) * 100).toFixed(1)}%` : '--');
      return {
        date: null,
        device: a.device,
        run: fmtDur(a.run), standby: fmtDur(a.standby), fault: fmtDur(a.fault), offline: fmtDur(a.offline),
        rate,
        ratio: `运行 ${pct(a.run)} / 待机 ${pct(a.standby)} / 故障 ${pct(a.fault)}`,
        switches: a.switches,
        maxRun: fmtDur(a.maxRun >= 0 ? a.maxRun : null),
        maxOffline: fmtDur(a.maxOffline >= 0 ? a.maxOffline : null),
        days: a.days,
      };
    }).sort((x, y) => String(y.run).localeCompare(String(x.run)));
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
    { title: '运行', dataIndex: 'run', width: 90 },
    { title: '待机', dataIndex: 'standby', width: 90 },
    { title: '故障', dataIndex: 'fault', width: 90 },
    { title: '离线', dataIndex: 'offline', width: 90 },
    { title: <ColTitle title="稼动率" tip="稼动率 = Σ 运行 ÷（Σ 运行 + Σ 待机 + Σ 故障）× 100%，离线不计入分母（按汇总时长重算，非各日平均）" />, dataIndex: 'rate', width: 90, render: (v, r) => (
      <Tooltip title={`稼动率 = ${r.run} ÷（${r.run} + ${r.standby} + ${r.fault}），离线 ${r.offline} 不计入分母`}><Tag color="success">{v}</Tag></Tooltip>
    ) },
    { title: '状态占比', dataIndex: 'ratio', minWidth: 240 },
    { title: <ColTitle title="切换次数" tip="统计范围内设备状态跳变次数逐日求和" />, dataIndex: 'switches', width: 100, sorter: (a, b) => a.switches - b.switches },
    { title: <ColTitle title="最长连续运行" tip="统计范围内各日最长连续运行段的最大值；跨天段落连续计算" />, dataIndex: 'maxRun', width: 120, sorter: (a, b) => String(a.maxRun).localeCompare(String(b.maxRun)) },
    { title: <ColTitle title="最长离线" tip="统计范围内各日最长离线段的最大值" />, dataIndex: 'maxOffline', width: 100, sorter: (a, b) => String(a.maxOffline).localeCompare(String(b.maxOffline)) },
  ];

  return (
    <>
      <PageHeader
        title="运行状态统计"
        subtitle={`统一时区 ${meta.timezone || '+08:00'} · 统计日 ${meta.demoDay || '--'} · 口径截止 ${meta.lastSampleAt || '--'}`}
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
          description="当前筛选条件下无运行时长统计行"
          reason="当前筛选条件下没有数据，调整筛选后重试"
          next="重置筛选"
          nextLabel="重置筛选"
          onNext={handleReset}
        />
      ) : (
        <Table rowKey="device" size="small" scroll={{ x: 1290 }} dataSource={rows} columns={columns} />
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
