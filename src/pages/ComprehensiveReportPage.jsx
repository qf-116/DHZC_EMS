import React, { useMemo, useState } from 'react';
import { App, Button, Card, DatePicker, Select, Space, Table, Tag, Tooltip } from 'antd';
import dayjs from 'dayjs';
import { Download, Search } from 'lucide-react';
import PageHeader from '../components/PageHeader.jsx';
import StatusTag from '../components/StatusTag.jsx';
import EmptyState from '../components/EmptyState.jsx';
import DegradedBanner from '../components/DegradedBanner.jsx';
import { useDemoState, useDemoActions } from '../state/DemoStore.jsx';
import { selectOeeDailyRows, selectReportRows, selectExportTasks, selectAllDevices } from '../state/selectors.js';

const THEME = 'comprehensive';

const { RangePicker } = DatePicker;

const fmt = v => (v === null || v === undefined || v === '' ? '--' : v);

const pctTag = (v, tip) => {
  if (v === null || v === undefined) return <Tooltip title={tip}><Tag>--</Tag></Tooltip>;
  return <Tag color="success">{v}%</Tag>;
};

// 设备综合运行分析报表：口径说明
// - OEE / 可用率 / 性能率 / 质量率：selectOeeDailyRows（演示日按天窗口，由 oeeInputs + 停机事实 + 速度配置推导；不可计算时显示原因）
// - 运行状态 / 稼动率 / 报警数 / 数据完整率 / 参数不一致数：selectReportRows(state, 'comprehensive')（当日快照汇总）
// 两路数据按设备名合并，任一路缺失该列显示 '--'，不伪造 0。
export default function ComprehensiveReportPage() {
  const { message } = App.useApp();
  const state = useDemoState();
  const actions = useDemoActions();
  const meta = state.meta;

  // UI 层筛选：统计日期范围、车间、设备
  const [range, setRange] = useState(null);
  const [workshop, setWorkshop] = useState('all');
  const [device, setDevice] = useState('all');

  // 演示快照仅有统计日（meta.demoDay）一个日期锚点：范围不含统计日时整表无数据（不伪造数据）
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

  const oeeRows = useMemo(() => selectOeeDailyRows(state), [state]);
  const compRows = useMemo(() => selectReportRows(state, THEME), [state]);
  const compByName = useMemo(() => Object.fromEntries(compRows.map(r => [r.device, r])), [compRows]);

  const rows = useMemo(() => {
    const list = [];
    const seen = new Set();
    for (const o of oeeRows) {
      const name = state.entities.devicesById[o.deviceId]?.name || o.deviceId;
      const comp = compByName[name] || null;
      // 既无日生产数据、也无综合报表行的设备不列入（不伪造空行）
      if (o.loadMinutes == null && !comp) continue;
      seen.add(name);
      list.push({ key: name, name, oee: o, comp });
    }
    for (const c of compRows) {
      if (!seen.has(c.device)) list.push({ key: c.device, name: c.device, oee: null, comp: c });
    }
    return list;
  }, [oeeRows, compRows, compByName, state.entities.devicesById]);

  const filteredRows = useMemo(() => {
    if (!inRange(meta.demoDay)) return [];
    return rows.filter(r => {
      if (device !== 'all' && r.name !== device) return false;
      if (workshop !== 'all' && workshopOf[r.name] !== workshop) return false;
      return true;
    });
  }, [rows, device, workshop, workshopOf, range, meta.demoDay]);

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
    {
      title: '设备', dataIndex: 'name', fixed: 'left', width: 160,
      render: (v, r) => (
        <Tooltip title={r.oee && r.oee.dataStatus !== '正常' ? `OEE 口径：${r.oee.dataStatus}${r.oee.blockers?.length ? '（' + r.oee.blockers.join('；') + '）' : ''}` : undefined}>
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
      title: '稼动率', key: 'rate', width: 100,
      render: (_, r) => (r.comp?.rate ? <Tag color="success">{r.comp.rate}</Tag> : '--'),
    },
    {
      title: 'OEE（日）', key: 'oee', width: 110,
      render: (_, r) => (r.oee && r.oee.oee !== null
        ? <Tooltip title={`目标 ${r.oee.target ?? '--'}%`}><Tag color={r.oee.target != null && r.oee.oee < r.oee.target ? 'warning' : 'success'}>{r.oee.oee}%</Tag></Tooltip>
        : <Tooltip title={r.oee ? `${r.oee.dataStatus}${r.oee.blockers?.length ? '：' + r.oee.blockers.join('；') : ''}` : '该设备无按天 OEE 口径数据'}><Tag>--</Tag></Tooltip>),
    },
    {
      title: '可用率', key: 'availability', width: 100,
      render: (_, r) => (r.oee
        ? pctTag(r.oee.availability, r.oee.blockers?.join('；') || '该窗口不可计算')
        : '--'),
    },
    {
      title: '性能率', key: 'performance', width: 100,
      render: (_, r) => (r.oee ? pctTag(r.oee.performance, r.oee.blockers?.join('；') || '该窗口不可计算') : '--'),
    },
    {
      title: '质量率', key: 'quality', width: 100,
      render: (_, r) => (r.oee ? pctTag(r.oee.quality, r.oee.blockers?.join('；') || '该窗口不可计算') : '--'),
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
    { title: '数据完整率', key: 'qualityRate', width: 110, render: (_, r) => fmt(r.comp?.quality) },
    {
      title: '产量', key: 'output', width: 90, align: 'center',
      sorter: (a, b) => ((a.oee?.output ?? a.comp?.output) ?? -1) - ((b.oee?.output ?? b.comp?.output) ?? -1),
      render: (_, r) => fmt(r.oee?.output ?? r.comp?.output),
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
      {filteredRows.length === 0 ? (
        <EmptyState
          description="当前筛选条件下无综合分析行"
          reason="当前筛选条件下没有数据，调整筛选后重试"
          next="重置筛选"
          nextLabel="重置筛选"
          onNext={handleReset}
        />
      ) : (
        <Table rowKey="key" size="small" scroll={{ x: 1500 }} dataSource={filteredRows} columns={columns} />
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
