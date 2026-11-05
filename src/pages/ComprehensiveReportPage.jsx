import React, { useEffect, useMemo, useState } from 'react';
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
import { selectReportRows, selectExportTasks, selectAllDevices, selectProductionReportStats } from '../state/selectors.js';

// 窗口内计划停机分钟（计划停机+换模，只影响可用率分母）——与 selectors 内同一口径
function plannedDowntimeMinutes(state, deviceId, day) {
  const dateOf = (ts) => (typeof ts === 'string' ? ts.slice(0, 10) : '');
  return Object.values(state.entities.downtimeFactsById)
    .filter(f => f.deviceId === deviceId
      && ['计划停机', '换模'].includes(f.category)
      && ['已结束', '进行中'].includes(f.status)
      && dateOf(f.start) === day)
    .reduce((s, f) => s + (f.minutes || 0), 0);
}
// 生效的理论生产速度（设备级单值，秒/件）——与 selectors 内同一口径；理想产量/小时 = 3600 ÷ 节拍秒
function speedFor(state, deviceId) {
  return Object.values(state.entities.speedConfigsById)
    .find(c => c.deviceId === deviceId && c.status === '生效') || null;
}

const THEME = 'comprehensive';

const { RangePicker } = DatePicker;

const fmt = v => (v === null || v === undefined || v === '' ? '--' : v);

const pctTag = (v, tip) => {
  if (v === null || v === undefined) return <Tooltip title={tip}><Tag>--</Tag></Tooltip>;
  return <Tag color="success">{v}%</Tag>;
};

// 设备综合运行分析报表（2026-11-04 范围聚合口径）
// - OEE 三率：由 oeeInputs.daily（负荷/运行分钟）+ 生产报工事件（产量/合格数）
//   + 停机事实（计划停机分钟）+ 速度配置，在统计日期范围内<b>逐日累加后重算</b>——
//   可用率 = Σ运行 ÷ Σ(负荷 − 计划停机)；性能率 = Σ报工产量 ÷ Σ(理想速度 × 运行小时)；
//   质量率 = Σ合格报工 ÷ Σ报工产量；OEE = 三率乘积（非各日平均）。
// - 运行状态 / 稼动率 / 报警数 / 参数不一致数：当日快照口径（演示快照仅覆盖统计日 demoDay，
//   范围不含统计日时这些列显示 '--'，不伪造 0）。
// - 「数据完整率」列已按需求方确认删除（2026-11-04）。
export default function ComprehensiveReportPage() {
  const { message } = App.useApp();
  const state = useDemoState();
  const actions = useDemoActions();
  const meta = state.meta;

  // UI 层筛选：统计日期范围（默认最近 7 天，锚定数据最后日期）、车间、设备
  const [range, setRange] = useState(null);
  const [workshop, setWorkshop] = useState('all');
  const [device, setDevice] = useState('all');

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

  // 数据覆盖的最后日期：默认范围与快捷预设锚定它
  const dataMax = useMemo(() => {
    const days = Object.values(state.entities.oeeInputs.daily || {})
      .flatMap(days => Object.keys(days || {})).sort();
    return days[days.length - 1] || null;
  }, [state]);
  const preset7 = useMemo(() => (dataMax ? [dayjs(dataMax).subtract(6, 'day'), dayjs(dataMax)] : null), [dataMax]);
  const preset30 = useMemo(() => (dataMax ? [dayjs(dataMax).subtract(29, 'day'), dayjs(dataMax)] : null), [dataMax]);
  useEffect(() => { if (preset7) setRange(preset7); }, [preset7]);

  const compRows = useMemo(() => selectReportRows(state, THEME), [state]);
  const compByName = useMemo(() => Object.fromEntries(compRows.map(r => [r.device, r])), [compRows]);

  // OEE 侧范围聚合：逐日累加输入（负荷/运行/产量/合格/计划停机/速度当量），比率重算
  const oeeAgg = useMemo(() => {
    const daily = state.entities.oeeInputs.daily || {};
    const out = new Map();
    for (const [deviceId, days] of Object.entries(daily)) {
      for (const day of Object.keys(days || {})) {
        if (!inRange(day)) continue;
        const raw = days[day];
        if (!out.has(deviceId)) {
          out.set(deviceId, { load: 0, run: 0, planned: 0, output: 0, qualified: 0, equiv: 0, speedMissing: false, days: [] });
        }
        const a = out.get(deviceId);
        const planned = plannedDowntimeMinutes(state, deviceId, day);
        a.load += raw.loadMinutes ?? 0;
        a.run += raw.runMinutes ?? 0;
        a.planned += planned ?? 0;
        const reportStats = selectProductionReportStats(state, deviceId, day);
        a.output += reportStats.output ?? 0;
        a.qualified += reportStats.qualified ?? 0;
        const speed = speedFor(state, deviceId);
        const perHour = (speed?.idealSpeedSec > 0) ? 3600 / speed.idealSpeedSec : null;
        if (perHour && (raw.runMinutes ?? 0) >= 0) {
          a.equiv += (perHour / 60) * (raw.runMinutes ?? 0); // 理想产量/小时 × 运行小时 = 理想产量
        } else if ((raw.runMinutes ?? 0) > 0) {
          a.speedMissing = true;
        }
        a.days.push(day);
      }
    }
    // 汇总比率重算
    return [...out.entries()].map(([deviceId, a]) => {
      const denomAvail = a.load - a.planned;
      const availability = denomAvail > 0 ? (a.run / denomAvail) * 100 : null;
      const performance = a.equiv > 0 ? (a.output / a.equiv) * 100 : null;
      const quality = a.output > 0 ? (a.qualified / a.output) * 100 : null;
      const oee = availability != null && performance != null && quality != null
        ? (availability / 100) * (performance / 100) * (quality / 100) * 100 : null;
      const blockers = [];
      if (a.days.length === 0) blockers.push('统计范围内无生产数据');
      if (a.speedMissing) blockers.push('部分日期未配置理想速度，性能率不可计算');
      return { deviceId, ...a, availability, performance, quality, oee, blockers };
    });
  }, [state, range]);

  const targetOf = useMemo(
    () => Object.fromEntries(devices.map(d => [d.deviceId, state.entities.oeeTargetsByDeviceId[d.deviceId]?.target ?? null])),
    [devices, state],
  );

  const rows = useMemo(() => {
    const aggByName = new Map();
    for (const agg of oeeAgg) {
      const deviceId = agg.deviceId;
      const name = state.entities.devicesById[deviceId]?.name || deviceId;
      if (agg.days.length > 0) aggByName.set(name, { ...agg, deviceId });
    }
    const list = [];
    const seen = new Set();
    for (const [name, agg] of aggByName) {
      const comp = compByName[name] || null;
      seen.add(name);
      list.push({ key: name, name, agg, comp });
    }
    for (const c of compRows) {
      if (!seen.has(c.device) && inRange(meta.demoDay)) list.push({ key: c.device, name: c.device, agg: null, comp: c });
    }
    return list;
  }, [oeeAgg, compRows, state.entities.devicesById, range, meta.demoDay]);

  const filteredRows = useMemo(() => rows.filter(r => {
    if (device !== 'all' && r.name !== device) return false;
    if (workshop !== 'all' && workshopOf[r.name] !== workshop) return false;
    return true;
  }), [rows, device, workshop, workshopOf]);

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
    {
      title: '设备', dataIndex: 'name', fixed: 'left', width: 160,
      render: (v, r) => (
        <Tooltip title={r.agg && r.agg.blockers.length ? `OEE 口径：${r.agg.blockers.join('；')}` : undefined}>
          {v}
        </Tooltip>
      ),
    },
    { title: '车间', dataIndex: 'name', width: 110, render: v => workshopOf[v] || '--' },
    {
      title: '运行状态', key: 'state', width: 100,
      render: (_, r) => (r.comp?.state ? <StatusTag value={r.comp.state} /> : '--'),
    },
    {
      title: <ColTitle title="稼动率" tip="稼动率 = 运行 ÷（运行 + 待机 + 故障）× 100%，离线不计入分母（统计日快照口径）" />, key: 'rate', width: 100,
      render: (_, r) => (r.comp?.rate ? <Tag color="success">{r.comp.rate}</Tag> : '--'),
    },
    {
      title: <ColTitle title="OEE" tip="OEE = 可用率 × 性能率 × 质量率（统计范围内逐日累加后重算，非各日平均）；低于目标值橙色标注" />, key: 'oee', width: 90,
      render: (_, r) => (r.agg && r.agg.oee !== null
        ? <Tooltip title={`目标 ${targetOf[r.agg.deviceId] ?? '--'}% · 可用率×性能率×质量率（范围内重算）`}>
            <Tag color={targetOf[r.agg.deviceId] != null && r.agg.oee < targetOf[r.agg.deviceId] ? 'warning' : 'success'}>{r.agg.oee.toFixed(1)}%</Tag>
          </Tooltip>
        : <Tooltip title={r.agg ? `${r.agg.blockers.join('；') || '该范围不可计算'}` : '统计范围内无生产数据'}><Tag>--</Tag></Tooltip>),
    },
    {
      title: <ColTitle title="可用率" tip="可用率 = Σ 运行分钟 ÷ Σ（负荷分钟 − 计划停机分钟）× 100%（计划停机 = 当日计划停机 + 换模）" />, key: 'availability', width: 100,
      render: (_, r) => (r.agg
        ? pctTag(r.agg.availability != null ? r.agg.availability.toFixed(1) : null,
          r.agg.availability != null ? '可用率 = Σ运行分钟 ÷ Σ(负荷 − 计划停机)' : (r.agg.blockers.join('；') || '该范围不可计算'))
        : '--'),
    },
    {
      title: <ColTitle title="性能率" tip="性能率 = Σ 产量 ÷ Σ（理想速度 × 运行小时）× 100%；理想速度按各日生产物料的生效基准速度取值" />, key: 'performance', width: 100,
      render: (_, r) => (r.agg
        ? pctTag(r.agg.performance != null ? r.agg.performance.toFixed(1) : null,
          r.agg.performance != null ? '性能率 = Σ产量 ÷ Σ(理想速度 × 运行小时)' : (r.agg.blockers.join('；') || '该范围不可计算'))
        : '--'),
    },
    {
      title: <ColTitle title="质量率" tip="质量率 = Σ 合格数 ÷ Σ 产量 × 100%" />, key: 'quality', width: 100,
      render: (_, r) => (r.agg
        ? pctTag(r.agg.quality != null ? r.agg.quality.toFixed(1) : null,
          r.agg.quality != null ? '质量率 = Σ合格数 ÷ Σ产量' : '统计范围内无产量数据')
        : '--'),
    },
    {
      title: '报警数', key: 'alarms', width: 90, align: 'center',
      sorter: (a, b) => (a.comp?.alarms ?? -1) - (b.comp?.alarms ?? -1),
      render: (_, r) => fmt(r.comp?.alarms),
    },
    {
      title: '重要报警数', key: 'importantAlarms', width: 110, align: 'center',
      render: (_, r) => fmt(r.comp?.importantAlarms),
    },
    {
      title: '产量', key: 'output', width: 90, align: 'center',
      sorter: (a, b) => (a.agg?.output ?? -1) - (b.agg?.output ?? -1),
      render: (_, r) => fmt(r.agg?.output ?? r.comp?.output),
    },
    { title: '合格率', key: 'passRate', width: 100, render: (_, r) => fmt(r.comp?.passRate) },
    { title: '参数不一致数', key: 'diffCount', width: 110, align: 'center', render: (_, r) => fmt(r.comp?.diffCount) },
  ];

  return (
    <>
      <PageHeader
        title="设备综合运行分析报表"
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
      {filteredRows.length === 0 ? (
        <EmptyState
          description="当前筛选条件下无综合分析行"
          reason="统计日期范围内没有生产数据（演示数据覆盖 2026-09-16），调整筛选后重试"
          next="重置筛选"
          nextLabel="重置筛选"
          onNext={handleReset}
        />
      ) : (
        <Table rowKey="key" size="small" scroll={{ x: 1400 }} dataSource={filteredRows} columns={columns} />
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
