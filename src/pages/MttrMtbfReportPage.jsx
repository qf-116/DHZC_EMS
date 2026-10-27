import React, { useMemo, useState } from 'react';
import { Alert, App, Button, Card, DatePicker, Select, Space, Table, Tag, Tooltip } from 'antd';
import dayjs from 'dayjs';
import { Download, Search } from 'lucide-react';
import PageHeader from '../components/PageHeader.jsx';
import StatusTag from '../components/StatusTag.jsx';
import EmptyState from '../components/EmptyState.jsx';
import DegradedBanner from '../components/DegradedBanner.jsx';
import MetricTile from '../components/MetricTile.jsx';
import { useDemoState, useDemoActions } from '../state/DemoStore.jsx';
import { selectExportTasks, selectAllDevices } from '../state/selectors.js';
import { round1 } from '../domain/oee.js';

const THEME = 'mttr';

const { RangePicker } = DatePicker;

const fmtDur = (min) => {
  if (min === null || min === undefined) return '--';
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return `${h}h ${String(m).padStart(2, '0')}m`;
};

// 'YYYY-MM-DD HH:MM' → 分钟差（演示快照内的时间运算，不取当前时间）
const minsBetween = (start, end) => {
  if (!start || !end) return null;
  const a = new Date(String(start).replace(' ', 'T'));
  const b = new Date(String(end).replace(' ', 'T'));
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return null;
  return Math.round((b - a) / 60000);
};

// MTTR / MTBF 分析报表：指标由事实派生（口径与 selectMttrMtbf 一致，支持按统计日期范围重算），
// MTTR = 已完成维修单（开工 → 验收通过）修复时长均值；
// MTBF = 有效运行时长 ÷ 已关闭的设备状态故障事件数。
// 样本量不足（无已完成维修单 / 无已关闭故障事件 / 运行时长为 0）时显示 '--' 并注明原因，不伪造 0。
export default function MttrMtbfReportPage() {
  const { message } = App.useApp();
  const state = useDemoState();
  const actions = useDemoActions();
  const meta = state.meta;

  const [workshop, setWorkshop] = useState('all');
  const [device, setDevice] = useState('all');
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
    () => Object.fromEntries(devices.map(d => [d.deviceId, d.workshopName])),
    [devices],
  );
  const workshopOptions = useMemo(
    () => [...new Set(devices.map(d => d.workshopName).filter(Boolean))].map(w => ({ value: w, label: w })),
    [devices],
  );
  const deviceOptions = useMemo(
    () => devices.map(d => ({ value: d.deviceId, label: d.name })),
    [devices],
  );

  // 按统计日期范围过滤底层事实：维修单按创建时间（createdAt），
  // 故障事件 time 仅含当日时分秒（无行级日期），按统计日 demoDay 是否落在范围内出数，
  // 日运行时长按日期键过滤。
  const scopedFacts = useMemo(() => {
    const orders = Object.values(state.entities.repairOrdersById)
      .filter(o => inRange(o.createdAt));
    const alarms = Object.values(state.entities.alarmEventsById)
      .filter(a => a.metricCode === 'S.machine_state' && a.status === '已关闭')
      .filter(() => inRange(meta.demoDay));
    const dailyInputs = {};
    for (const [devId, days] of Object.entries(state.entities.oeeInputs.daily || {})) {
      const kept = Object.fromEntries(Object.entries(days || {}).filter(([day]) => inRange(day)));
      if (Object.keys(kept).length > 0) dailyInputs[devId] = kept;
    }
    return { orders, alarms, dailyInputs };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, range, meta.demoDay]);

  // 全部设备汇总（口径与 selectMttrMtbf 一致，但在日期范围内重算）
  const overall = useMemo(() => {
    const restoreMinutes = scopedFacts.orders
      .filter(o => o.status === '已完成')
      .map(o => minsBetween(o.startedAt, o.acceptedAt))
      .filter(m => m !== null);
    const mttr = restoreMinutes.length
      ? round1(restoreMinutes.reduce((s, m) => s + m, 0) / restoreMinutes.length) : null;
    const runMinutes = Object.values(scopedFacts.dailyInputs)
      .reduce((s, days) => s + Object.values(days || {}).reduce((a, d) => a + (d.runMinutes || 0), 0), 0);
    const mtbf = scopedFacts.alarms.length > 0 && runMinutes > 0
      ? round1(runMinutes / scopedFacts.alarms.length) : null;
    return { mttr, mtbf };
  }, [scopedFacts]);
  const overallFaultCount = scopedFacts.alarms.length;

  // 逐设备派生：口径与 selectMttrMtbf 一致（已完成维修单 + 已关闭 S.machine_state 事件 + 日运行时长）
  const rows = useMemo(() => {
    const { orders, alarms, dailyInputs } = scopedFacts;
    const deviceIds = new Set([
      ...orders.map(o => o.deviceId),
      ...alarms.map(a => a.deviceId),
      ...Object.keys(dailyInputs),
    ]);
    const list = [...deviceIds].map((deviceId) => {
      const devOrders = orders.filter(o => o.deviceId === deviceId);
      const completed = devOrders.filter(o => o.status === '已完成');
      const restoreMinutes = completed
        .map(o => minsBetween(o.startedAt, o.acceptedAt))
        .filter(m => m !== null);
      const devAlarms = alarms.filter(a => a.deviceId === deviceId);
      const runMinutes = Object.values(dailyInputs[deviceId] || {})
        .reduce((s, d) => s + (d.runMinutes || 0), 0);
      const repairTotal = restoreMinutes.reduce((s, m) => s + m, 0);
      // MTTR 与 selectMttrMtbf 同口径（范围内已完成维修单修复时长均值）
      const mttr = restoreMinutes.length
        ? round1(restoreMinutes.reduce((s, m) => s + m, 0) / restoreMinutes.length) : null;
      const mtbf = devAlarms.length > 0 && runMinutes > 0 ? round1(runMinutes / devAlarms.length) : null;
      const availability = runMinutes > 0 && repairTotal > 0
        ? `${round1((runMinutes / (runMinutes + repairTotal)) * 100)}%` : null;
      const lastFault = devAlarms.length
        ? `${meta.demoDay || ''} ${devAlarms.map(a => a.time).sort().slice(-1)[0]}`
        : null;
      const reasons = [];
      if (mttr === null) reasons.push('无已完成维修单（或缺少开工/验收时间），无法计算 MTTR');
      if (mtbf === null) reasons.push('无已关闭的状态故障事件或运行时长为 0，无法计算 MTBF');
      return {
        deviceId,
        deviceName: state.entities.devicesById[deviceId]?.name || deviceId,
        workshopName: workshopOf[deviceId] || '--',
        faultCount: devAlarms.length,
        repairTime: repairTotal > 0 ? fmtDur(repairTotal) : null,
        mttr, runMinutes, mtbf, availability, lastFault,
        sampleNote: reasons.join('；') || null,
      };
    });
    return list;
  }, [scopedFacts, workshopOf, meta.demoDay]);

  const filteredRows = useMemo(() => rows.filter(r => {
    if (device !== 'all' && r.deviceId !== device) return false;
    if (workshop !== 'all' && r.workshopName !== workshop) return false;
    return true;
  }).sort((a, b) => a.deviceName.localeCompare(b.deviceName, 'zh')), [rows, device, workshop]);

  const exportTasks = useMemo(
    () => selectExportTasks(state).filter(t => t.theme === THEME),
    [state],
  );

  const currentFilters = {
    device: device === 'all' ? '' : device,
    workshop: workshop === 'all' ? '' : workshop,
  };
  const handleQuery = () => {
    const res = actions.runReport(THEME, currentFilters);
    res.ok ? message.success(res.message) : message.error(res.message);
  };
  const handleReset = () => { setWorkshop('all'); setDevice('all'); setRange(null); };
  const handleExport = () => {
    const res = actions.createExportTask(THEME, currentFilters);
    res.ok ? message.success(res.message) : message.error(res.message);
  };
  const handleDownload = (task) => {
    message.success(`导出任务 ${task.exportId} 已创建`);
  };

  const columns = [
    { title: '设备', dataIndex: 'deviceName', width: 160 },
    { title: '车间', dataIndex: 'workshopName', width: 110 },
    {
      title: '故障次数（已关闭状态事件）', dataIndex: 'faultCount', width: 130, align: 'center',
      sorter: (a, b) => a.faultCount - b.faultCount,
      render: v => <Tag color={v >= 5 ? 'error' : v >= 3 ? 'warning' : v > 0 ? 'success' : 'default'}>{v > 0 ? `${v} 次` : '--'}</Tag>,
    },
    { title: '维修总时长', dataIndex: 'repairTime', width: 110, render: v => v || '--' },
    {
      title: 'MTTR（平均修复时间）', dataIndex: 'mttr', width: 130,
      render: (v, r) => (v === null
        ? <Tooltip title={r.sampleNote || '样本量不足，无法计算'}><Tag>--</Tag></Tooltip>
        : <Tooltip title="MTTR = 已完成维修单（开工 → 验收通过）修复时长均值"><Tag color="processing">{fmtDur(v)}</Tag></Tooltip>),
    },
    { title: '累计运行时长', dataIndex: 'runMinutes', width: 120, render: v => (v > 0 ? fmtDur(v) : '--') },
    {
      title: 'MTBF（平均故障间隔）', dataIndex: 'mtbf', width: 130,
      render: (v, r) => (v === null
        ? <Tooltip title={r.sampleNote || '样本量不足，无法计算'}><Tag>--</Tag></Tooltip>
        : <Tooltip title="MTBF = 有效运行时长 ÷ 已关闭状态故障事件数"><Tag color="processing">{fmtDur(v)}</Tag></Tooltip>),
    },
    {
      title: '可用率', dataIndex: 'availability', width: 100,
      render: (v, r) => (v === null
        ? <Tooltip title={r.sampleNote || '运行时长或维修时长样本不足'}><Tag>--</Tag></Tooltip>
        : <Tooltip title="可用率 = 运行 ÷（运行 + 故障维修）"><Tag color={parseFloat(v) >= 98 ? 'success' : 'warning'}>{v}</Tag></Tooltip>),
    },
    { title: '最近故障时间', dataIndex: 'lastFault', width: 160, render: v => v || '--' },
    {
      title: '样本说明', dataIndex: 'sampleNote', ellipsis: true,
      render: v => v || <Tag color="success">样本充足</Tag>,
    },
  ];

  return (
    <>
      <PageHeader
        title="MTTR / MTBF 分析报表"
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
          <Button type="primary" icon={<Search size={14} />} onClick={handleQuery}>查询</Button>
          <Button onClick={handleReset}>重置</Button>
        </Space>
      </Card>
      <Space wrap style={{ marginBottom: 12 }}>
        <Button type="primary" icon={<Download size={14} />} onClick={handleExport}>导出</Button>
      </Space>
      <div className="metric-grid" style={{ marginBottom: 12 }}>
        <MetricTile label="平均 MTTR（全部设备）" value={overall.mttr === null ? '--' : fmtDur(overall.mttr)} color="#d46b08" />
        <MetricTile label="平均 MTBF（全部设备）" value={overall.mtbf === null ? '--' : fmtDur(overall.mtbf)} color="#1668dc" />
        <MetricTile label="已关闭故障事件" value={overallFaultCount > 0 ? overallFaultCount : '--'} unit={overallFaultCount > 0 ? '次' : ''} color="#cf1322" />
      </div>
      {overall.mttr === null && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 12 }}
          message="样本量不足"
          description="当前快照中没有已完成（开工且验收通过）的维修单，全部设备汇总 MTTR 暂不可计算；待维修工单走完「开工 → 提交 → 验收通过」后自动派生。"
        />
      )}
      {filteredRows.length === 0 ? (
        <EmptyState
          description="当前筛选条件下无 MTTR / MTBF 统计行"
          reason="当前筛选条件下没有数据，调整筛选后重试"
          next="重置筛选"
          nextLabel="重置筛选"
          onNext={handleReset}
        />
      ) : (
        <Table rowKey="deviceId" size="small" scroll={{ x: 1200 }} dataSource={filteredRows} columns={columns} />
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
