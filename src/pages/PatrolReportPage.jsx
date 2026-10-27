import React, { useMemo, useState } from 'react';
import { Card, Table, Button, Space, Statistic, App, Row, Col, DatePicker } from 'antd';
import dayjs from 'dayjs';
import { FileBarChart, Download } from 'lucide-react';
import PageHeader from '../components/PageHeader.jsx';
import StatusTag from '../components/StatusTag.jsx';
import DegradedBanner from '../components/DegradedBanner.jsx';
import { useDemoState } from '../state/DemoStore.jsx';
// 范围外演示模块：数据为只读演示种子（完整闭环由点巡保养业务模块承接）
import { patrolTasks, patrolTaskDetails, patrolPlans } from '../data/standardData.js';

const dash = (v) => (v === null || v === undefined || v === '' ? '--' : v);
const { RangePicker } = DatePicker;

// 巡检执行统计报表（演示种子聚合）：按巡检计划/线路聚合任务完成、逾期与漏检情况
export default function PatrolReportPage() {
  const { message } = App.useApp();
  const state = useDemoState();

  // 统计日期范围筛选：未选范围时不过滤；选了范围后缺日期的行排除
  const [range, setRange] = useState(null);
  const inRange = (d) => {
    if (!range || !range[0] || !range[1]) return true;
    if (!d) return false;
    const s = String(d).slice(0, 10);
    return s >= range[0].format('YYYY-MM-DD') && s <= range[1].format('YYYY-MM-DD');
  };
  // 任务行按计划日期 date 过滤；设备明细行按执行时间 execTime 过滤
  const filteredTasks = useMemo(() => patrolTasks.filter(t => inRange(t.date)), [range]); // eslint-disable-line react-hooks/exhaustive-deps
  const filteredDetails = useMemo(() => patrolTaskDetails.filter(d => inRange(d.execTime)), [range]); // eslint-disable-line react-hooks/exhaustive-deps

  const rows = useMemo(() => {
    const byPlan = {};
    for (const t of filteredTasks) {
      if (!byPlan[t.plan]) byPlan[t.plan] = { plan: t.plan, tasks: 0, done: 0, overdue: 0, running: 0, notStarted: 0, should: 0 };
      const g = byPlan[t.plan];
      g.tasks += 1;
      g.should += t.shouldCount || 0;
      if (t.status === '已完成') g.done += 1;
      else if (t.status === '已逾期') g.overdue += 1;
      else if (t.status === '逾期完成') { g.overdue += 1; g.done += 1; }
      else if (t.status === '进行中') g.running += 1;
      else if (t.status === '未开始') g.notStarted += 1;
    }
    // 漏检归属（演示口径）：patrolTaskDetails 为最近一次任务的设备明细，
    // 漏检项目按设备所挂巡检标准对应到计划（一号/二号/动力站线路各归其计划）
    const planByName = {};
    for (const p of patrolPlans) planByName[p.name] = p.name;
    const missedByPlan = {};
    let skippedDevices = 0;
    for (const d of filteredDetails) {
      if (d.skipReason) skippedDevices += 1;
      const plan = patrolPlans.find(p => d.standard && p.name.startsWith(d.standard.replace('标准', '')));
      const key = plan ? plan.name : Object.keys(byPlan)[0];
      if (key && byPlan[key]) missedByPlan[key] = (missedByPlan[key] || 0) + (d.unchecked || 0);
    }
    return Object.values(byPlan).map((g) => ({
      ...g,
      missed: missedByPlan[g.plan] || 0,
      skippedDevices,
      doneRate: g.tasks ? Math.round((g.done / g.tasks) * 1000) / 10 : null,
    }));
  }, [filteredTasks, filteredDetails]);

  const totalTasks = filteredTasks.length;
  const totalDone = filteredTasks.filter(t => ['已完成', '逾期完成'].includes(t.status)).length;
  const totalOverdue = filteredTasks.filter(t => ['已逾期'].includes(t.status)).length;
  const totalMissed = filteredDetails.reduce((s, d) => s + (d.unchecked || 0), 0);

  const columns = [
    { title: '巡检计划 / 线路', dataIndex: 'plan', width: 200 },
    { title: '任务数', dataIndex: 'tasks', width: 90, align: 'center' },
    { title: '应巡设备次', dataIndex: 'should', width: 110, align: 'center', render: (v) => dash(v) },
    { title: '已完成', dataIndex: 'done', width: 90, align: 'center' },
    { title: '进行中', dataIndex: 'running', width: 90, align: 'center' },
    { title: '未开始', dataIndex: 'notStarted', width: 90, align: 'center' },
    { title: '逾期', dataIndex: 'overdue', width: 90, align: 'center', render: (v) => (v > 0 ? <span style={{ color: '#cf1322' }}>{v}</span> : v) },
    { title: '漏检项目数', dataIndex: 'missed', width: 110, align: 'center', render: (v) => (v > 0 ? <span style={{ color: '#cf1322' }}>{v}</span> : v) },
    { title: '完成率', dataIndex: 'doneRate', width: 100, align: 'center', render: (v) => (v === null || v === undefined ? '--' : `${v}%`) },
    { title: '计划状态', key: 'status', width: 100, render: (_, r) => {
      const plan = patrolPlans.find(p => p.name === r.plan);
      return <StatusTag value={plan ? plan.status : '--'} />;
    } },
  ];

  return (
    <>
      <PageHeader
        title="巡检执行统计"
        backPath="/"
        subtitle={`统计日 2026-09-16 · 快照 ${state.meta.updatedAt || '--'}`}
      />
      <DegradedBanner meta={state.meta} />
      <Row gutter={12} style={{ marginBottom: 12 }}>
        <Col span={6}><Card size="small"><Statistic title="巡检任务总数" value={totalTasks} /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title="已完成任务" value={totalDone} valueStyle={{ color: '#3f8600' }} /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title="逾期任务" value={totalOverdue} valueStyle={{ color: totalOverdue > 0 ? '#cf1322' : undefined }} /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title="漏检项目数" value={totalMissed} valueStyle={{ color: totalMissed > 0 ? '#cf1322' : undefined }} /></Card></Col>
      </Row>
      <Card size="small" title={<Space size={8}><FileBarChart size={14} />按巡检线路统计</Space>}>
        <Space wrap style={{ marginBottom: 12 }}>
          <RangePicker
            style={{ width: 250 }} allowClear
            value={range} onChange={setRange}
            presets={[
              { label: '最近7天', value: [dayjs().subtract(6, 'day'), dayjs()] },
              { label: '最近30天', value: [dayjs().subtract(29, 'day'), dayjs()] },
            ]}
            placeholder={['开始日期', '结束日期']}
          />
          <Button onClick={() => setRange(null)}>重置</Button>
          <Button icon={<Download size={14} />} onClick={() => message.success('已导出')}>导出</Button>
        </Space>
        <Table
          rowKey="plan"
          size="small"
          columns={columns}
          dataSource={rows}
          pagination={false}
          locale={{ emptyText: <span style={{ color: '#8a97a3' }}>暂无巡检任务数据</span> }}
        />
      </Card>
    </>
  );
}
