import React, { useMemo, useState } from 'react';
import { App, Button, Card, DatePicker, Select, Space, Table, Tag } from 'antd';
import dayjs from 'dayjs';
import { Download, Search } from 'lucide-react';
import PageHeader from '../components/PageHeader.jsx';
import StatusTag from '../components/StatusTag.jsx';
import EmptyState from '../components/EmptyState.jsx';
import DegradedBanner from '../components/DegradedBanner.jsx';
import { useDemoState, useDemoActions } from '../state/DemoStore.jsx';
import { selectExportTasks } from '../state/selectors.js';

const THEME = 'alarm';

const STATUS_KEYS = ['已触发', '已确认', '处理中', '已恢复待关闭', '已关闭'];
const SEVERITY_KEYS = ['紧急', '重要', '一般', '提示'];

const { RangePicker } = DatePicker;

const severityTag = (key, count) => {
  const color = { 紧急: 'error', 重要: 'warning', 一般: 'processing', 提示: 'default' }[key] || 'default';
  return <Tag color={color}>{count}</Tag>;
};

// 'HH:MM:SS' → 秒（演示快照同日时间运算，不取当前时间）
const toSec = (t) => {
  const parts = String(t || '').split(':').map(Number);
  if (parts.length !== 3 || parts.some(Number.isNaN)) return null;
  return parts[0] * 3600 + parts[1] * 60 + parts[2];
};

// 报警统计报表：由 alarmEventsById 按设备 × 级别 × 状态聚合（页面内简单聚合，不引用旧 demoData）。
// 平均确认时长 = 有确认时间的事件（触发 → 确认）均值，无样本显示 '--'。
export default function AlarmReportPage() {
  const { message } = App.useApp();
  const state = useDemoState();
  const actions = useDemoActions();
  const meta = state.meta;

  // UI 层筛选：设备 / 级别 / 统计日期范围（限制参与聚合的事件范围）
  const [device, setDevice] = useState('all');
  const [severity, setSeverity] = useState('all');
  const [range, setRange] = useState(null);

  // 日期范围过滤助手（按前 10 位日期字符串比较）
  const inRange = (d) => {
    if (!range || !range[0] || !range[1]) return true;
    if (!d) return false;
    const s = String(d).slice(0, 10);
    return s >= range[0].format('YYYY-MM-DD') && s <= range[1].format('YYYY-MM-DD');
  };

  const alarms = useMemo(() => Object.values(state.entities.alarmEventsById), [state]);
  const deviceOptions = useMemo(() => {
    const names = [...new Set(alarms.map(a => a.deviceName).filter(Boolean))];
    return names.map(n => ({ value: n, label: n }));
  }, [alarms]);

  const scopedAlarms = useMemo(
    () => alarms.filter(a => {
      // 报警事件 time 仅含当日时分秒（无行级日期），按统计日是否落在所选范围内出数
      if (!inRange(meta.demoDay)) return false;
      if (device !== 'all' && a.deviceName !== device) return false;
      if (severity !== 'all' && a.severity !== severity) return false;
      return true;
    }),
    [alarms, device, severity, range, meta.demoDay],
  );

  // 按设备聚合：各状态 / 各级别数量 + 重复触发 / 升级 / 平均确认时长
  const rows = useMemo(() => {
    const byDevice = new Map();
    for (const a of scopedAlarms) {
      if (!byDevice.has(a.deviceName)) {
        byDevice.set(a.deviceName, {
          deviceName: a.deviceName, deviceId: a.deviceId, total: 0,
          status: Object.fromEntries(STATUS_KEYS.map(k => [k, 0])),
          severity: Object.fromEntries(SEVERITY_KEYS.map(k => [k, 0])),
          repeat: 0, escalation: 0, ackSamples: [],
        });
      }
      const row = byDevice.get(a.deviceName);
      row.total += 1;
      if (row.status[a.status] !== undefined) row.status[a.status] += 1;
      if (row.severity[a.severity] !== undefined) row.severity[a.severity] += 1;
      row.repeat += a.repeat || 0;
      row.escalation += Number(a.escalation) || 0;
      const ackSec = toSec(a.ack);
      const trigSec = toSec(a.time);
      if (ackSec !== null && trigSec !== null) {
        let diff = ackSec - trigSec;
        if (diff < 0) diff += 86400; // 跨日确认按 +24h 计
        row.ackSamples.push(diff);
      }
    }
    return [...byDevice.values()].map(r => ({
      ...r,
      avgAck: r.ackSamples.length
        ? `${Math.floor(r.ackSamples.reduce((s, x) => s + x, 0) / r.ackSamples.length / 60)}m ${Math.round(r.ackSamples.reduce((s, x) => s + x, 0) / r.ackSamples.length % 60)}s`
        : null,
    })).sort((a, b) => b.total - a.total);
  }, [scopedAlarms]);

  const exportTasks = useMemo(
    () => selectExportTasks(state).filter(t => t.theme === THEME),
    [state],
  );

  const currentFilters = {
    device: device === 'all' ? '' : device,
    severity: severity === 'all' ? '' : severity,
  };
  const handleQuery = () => {
    const res = actions.runReport(THEME, currentFilters);
    res.ok ? message.success(res.message) : message.error(res.message);
  };
  const handleReset = () => { setDevice('all'); setSeverity('all'); setRange(null); };
  const handleExport = () => {
    const res = actions.createExportTask(THEME, currentFilters);
    res.ok ? message.success(res.message) : message.error(res.message);
  };
  const handleDownload = (task) => {
    message.success(`导出任务 ${task.exportId} 已创建`);
  };

  const STATUS_COLOR = { 已触发: 'error', 已确认: 'orange', 处理中: 'processing', 已恢复待关闭: 'warning', 已关闭: 'default' };

  const columns = [
    { title: '设备', dataIndex: 'deviceName', width: 160, render: v => v || '--' },
    { title: '报警总数', dataIndex: 'total', width: 100, align: 'center', sorter: (a, b) => a.total - b.total, render: v => <Tag color="processing">{v}</Tag> },
    ...STATUS_KEYS.map(k => ({
      title: k, key: `status-${k}`, width: 110, align: 'center',
      render: (_, r) => (r.status[k] > 0 ? <Tag color={STATUS_COLOR[k]}>{r.status[k]}</Tag> : '--'),
    })),
    ...SEVERITY_KEYS.map(k => ({
      title: `${k}级别`, key: `sev-${k}`, width: 90, align: 'center',
      render: (_, r) => (r.severity[k] > 0 ? severityTag(k, r.severity[k]) : '--'),
    })),
    { title: '重复触发', dataIndex: 'repeat', width: 100, align: 'center', render: v => (v > 0 ? <Tag color="warning">{v}</Tag> : v) },
    { title: '升级次数', dataIndex: 'escalation', width: 100, align: 'center', render: v => (v > 0 ? <Tag color="error">{v}</Tag> : v) },
    {
      title: '平均确认时长', key: 'avgAck', width: 120,
      render: (_, r) => (r.avgAck || <Tag>--</Tag>),
    },
  ];

  return (
    <>
      <PageHeader
        title="报警统计报表"
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
          <Select value={severity} onChange={setSeverity} style={{ width: 120 }} options={[{ value: 'all', label: '全部级别' }, ...SEVERITY_KEYS.map(k => ({ value: k, label: k }))]} />
          <Button type="primary" icon={<Search size={14} />} onClick={handleQuery}>查询</Button>
          <Button onClick={handleReset}>重置</Button>
        </Space>
      </Card>
      {rows.length === 0 ? (
        <EmptyState
          description="当前筛选条件下无报警统计行"
          reason={range && !inRange(meta.demoDay)
            ? `统计日 ${meta.demoDay || '--'} 不在所选日期范围内，报警事件按统计日出数`
            : '当前筛选条件下没有数据，调整筛选后重试'}
          next="重置筛选"
          nextLabel="重置筛选"
          onNext={handleReset}
        />
      ) : (
        <Table rowKey="deviceName" size="small" scroll={{ x: 1300 }} dataSource={rows} columns={columns} />
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
