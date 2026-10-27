import React, { useMemo, useState } from 'react';
import { Card, Table, Button, Space, Statistic, App, DatePicker } from 'antd';
import dayjs from 'dayjs';
import { Download } from 'lucide-react';
import PageHeader from '../components/PageHeader.jsx';
import DegradedBanner from '../components/DegradedBanner.jsx';
import StatusTag from '../components/StatusTag.jsx';
import EmptyState from '../components/EmptyState.jsx';
import { useDemoState } from '../state/DemoStore.jsx';
import {
  inspectionTasks, inspectionTaskDetails, inspectionPlans,
} from '../data/standardData.js';
import { crosswalkByAssetCode } from '../data/demo/deviceCrosswalk.js';

const canonOf = (assetCode) => crosswalkByAssetCode[assetCode] || null;
const { RangePicker } = DatePicker;
const pct = (a, b) => (b ? `${Math.round((a / b) * 100)}%` : '--');

// 点检执行统计报表（范围外演示模块）：/report/inspection。
// 聚合 inspectionTasks（按执行人 / 状态）与 inspectionTaskDetails（按设备）演示快照：
// 完成率 = 已完成 / 任务总数；逾期数 = 点检日期早于演示日期且未完结（未开始/进行中）；
// 异常检出率：演示快照未包含异常判定结果，按「无数据不伪造 0」原则以 -- 展示（完整闭环由点巡保养业务模块承接）。
export default function InspectionReportPage() {
  const { message } = App.useApp();
  const state = useDemoState();
  const meta = state.meta;
  const demoDay = meta.demoDay || '2026-09-16';

  // 统计日期范围筛选：未选范围时不过滤；选了范围后缺日期的行排除
  const [range, setRange] = useState(null);
  const inRange = (d) => {
    if (!range || !range[0] || !range[1]) return true;
    if (!d) return false;
    const s = String(d).slice(0, 10);
    return s >= range[0].format('YYYY-MM-DD') && s <= range[1].format('YYYY-MM-DD');
  };
  const tasks = useMemo(() => inspectionTasks.filter(t => inRange(t.date)), [range]); // eslint-disable-line react-hooks/exhaustive-deps

  const isOverdue = (t) => t.date && demoDay && t.date < demoDay && ['未开始', '进行中'].includes(t.status);

  // 按执行人聚合（任务口径）
  const byOwner = useMemo(() => {
    const map = new Map();
    tasks.forEach(t => {
      const key = t.owner || '--';
      const row = map.get(key) || { owner: key, total: 0, done: 0, running: 0, pending: 0, closed: 0, overdue: 0 };
      row.total += 1;
      if (t.status === '已完成') row.done += 1;
      else if (t.status === '进行中') row.running += 1;
      else if (t.status === '未开始') row.pending += 1;
      else if (t.status === '已关闭') row.closed += 1;
      if (isOverdue(t)) row.overdue += 1;
      map.set(key, row);
    });
    return [...map.values()];
  }, [tasks, demoDay]); // eslint-disable-line react-hooks/exhaustive-deps

  // 按设备聚合（任务明细口径，设备展示经 canonical crosswalk）
  const byDevice = useMemo(() => inspectionTaskDetails.map(d => {
    const c = canonOf(d.code);
    return {
      code: d.code,
      device: c ? c.name : (d.code || '--'),
      assetCode: c ? c.assetCode : (d.code || '--'),
      itemTotal: d.itemTotal ?? 0,
      checked: d.checked ?? 0,
      unchecked: d.unchecked ?? 0,
      skipped: d.skipReason ? 1 : 0,
      rate: pct(d.checked ?? 0, d.itemTotal || 0),
    };
  }), []);

  // 按状态聚合
  const byStatus = useMemo(() => {
    const order = ['已完成', '进行中', '待执行', '已逾期', '已关闭'];
    const labelOf = (t) => (isOverdue(t) ? '已逾期' : ({ 未开始: '待执行', 进行中: '进行中', 已完成: '已完成', 已关闭: '已关闭' }[t.status] || t.status));
    const map = new Map();
    tasks.forEach(t => {
      const key = labelOf(t);
      map.set(key, (map.get(key) || 0) + 1);
    });
    return order.filter(k => map.has(k)).map(k => ({ status: k, count: map.get(k) }));
  }, [tasks, demoDay]); // eslint-disable-line react-hooks/exhaustive-deps

  // 计划口径完成率（种子 doneTasks/totalTasks）
  const byPlan = useMemo(() => inspectionPlans.map(p => ({
    code: p.code, name: p.name, total: p.totalTasks, done: p.doneTasks,
    rate: pct(p.doneTasks ?? 0, p.totalTasks || 0), status: p.status,
  })), []);

  const totalTasks = tasks.length;
  const totalDone = tasks.filter(t => t.status === '已完成').length;
  const totalOverdue = tasks.filter(isOverdue).length;

  const handleExport = () => {
    message.success('报表导出成功');
  };

  return (
    <>
      <PageHeader
        title="点检执行统计"
        subtitle={`统计基准日：${demoDay}`}
      />
      <DegradedBanner meta={meta} />

      <Card size="small" style={{ marginBottom: 12 }}>
        <Space size={40} wrap>
          <RangePicker
            style={{ width: 250 }} allowClear
            value={range} onChange={setRange}
            presets={[
              { label: '最近7天', value: [dayjs().subtract(6, 'day'), dayjs()] },
              { label: '最近30天', value: [dayjs().subtract(29, 'day'), dayjs()] },
            ]}
            placeholder={['开始日期', '结束日期']}
          />
          <Statistic title="任务总数" value={totalTasks} />
          <Statistic title="已完成" value={totalDone} />
          <Statistic title="完成率" value={pct(totalDone, totalTasks)} />
          <Statistic title="逾期数" value={totalOverdue} />
          <Statistic title="计划任务总数" value={inspectionPlans.reduce((s, p) => s + (p.totalTasks || 0), 0)} />
          <Button onClick={() => setRange(null)}>重置</Button>
        </Space>
      </Card>

      <Card size="small" style={{ marginBottom: 12 }}>
        <Space wrap style={{ marginBottom: 12 }}>
          <Button type="primary" icon={<Download size={14} />} onClick={handleExport}>导出报表</Button>
        </Space>
        <div style={{ fontWeight: 600, marginBottom: 12 }}>按执行人聚合（任务口径）</div>
        <Table
          rowKey="owner" size="small" pagination={false}
          dataSource={byOwner}
          locale={{ emptyText: <EmptyState description="暂无执行人维度数据" reason="暂无点检任务数据" /> }}
          columns={[
            { title: '执行人', dataIndex: 'owner', width: 140 },
            { title: '任务总数', dataIndex: 'total', width: 100 },
            { title: '已完成', dataIndex: 'done', width: 90 },
            { title: '进行中', dataIndex: 'running', width: 90 },
            { title: '待执行', dataIndex: 'pending', width: 90 },
            { title: '已关闭', dataIndex: 'closed', width: 90 },
            { title: '逾期数（派生）', dataIndex: 'overdue', width: 120 },
            { title: '完成率', dataIndex: 'done', width: 100, render: (_, r) => pct(r.done, r.total) },
            { title: '异常检出率', width: 110, render: () => <span title="暂无异常判定数据">--</span> },
          ]}
        />
      </Card>

      <Card size="small" style={{ marginBottom: 12 }}>
        <div style={{ fontWeight: 600, marginBottom: 12 }}>按设备聚合（任务明细口径 · 设备展示经 canonical 设备映射）</div>
        <Table
          rowKey="code" size="small" pagination={false}
          dataSource={byDevice}
          locale={{ emptyText: <EmptyState description="暂无设备维度数据" reason="暂无任务明细数据" /> }}
          columns={[
            { title: '设备（canonical）', dataIndex: 'device', width: 200 },
            { title: '资产编号', dataIndex: 'assetCode', width: 130 },
            { title: '点检项目数', dataIndex: 'itemTotal', width: 100 },
            { title: '已检', dataIndex: 'checked', width: 80 },
            { title: '未检', dataIndex: 'unchecked', width: 80 },
            { title: '跳过（台）', dataIndex: 'skipped', width: 90 },
            { title: '完成率（明细）', dataIndex: 'rate', width: 110 },
            { title: '异常检出率', width: 110, render: () => <span title="暂无异常判定数据">--</span> },
          ]}
        />
      </Card>

      <Space size={12} style={{ display: 'flex', alignItems: 'flex-start' }} align="start">
        <Card size="small" style={{ width: 360 }}>
          <div style={{ fontWeight: 600, marginBottom: 12 }}>按状态聚合（任务口径）</div>
          <Table
            rowKey="status" size="small" pagination={false}
            dataSource={byStatus}
            locale={{ emptyText: <EmptyState description="暂无状态维度数据" reason="暂无点检任务数据" /> }}
            columns={[
              { title: '状态', dataIndex: 'status', width: 140, render: v => <StatusTag value={v} /> },
              { title: '任务数', dataIndex: 'count', width: 90 },
            ]}
          />
        </Card>
        <Card size="small" style={{ flex: 1, minWidth: 420 }}>
          <div style={{ fontWeight: 600, marginBottom: 12 }}>按计划完成率</div>
          <Table
            rowKey="code" size="small" pagination={false}
            dataSource={byPlan}
            locale={{ emptyText: <EmptyState description="暂无计划维度数据" reason="暂无点检计划数据" /> }}
            columns={[
              { title: '计划编号', dataIndex: 'code', width: 170 },
              { title: '计划名称', dataIndex: 'name', ellipsis: true },
              { title: '已完成/总数', width: 110, render: (_, r) => `${r.done ?? '--'}/${r.total ?? '--'}` },
              { title: '完成率', dataIndex: 'rate', width: 90 },
              { title: '状态', dataIndex: 'status', width: 90, render: v => <StatusTag value={v} /> },
            ]}
          />
        </Card>
      </Space>
    </>
  );
}
