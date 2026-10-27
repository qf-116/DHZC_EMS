import React, { useMemo, useState } from 'react';
import { Card, Table, Select, Button, Space } from 'antd';
import { useNavigate } from 'react-router-dom';
import { Area, AreaChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import PageHeader from '../components/PageHeader.jsx';
import MetricTile from '../components/MetricTile.jsx';
import StatusTag from '../components/StatusTag.jsx';
import DegradedBanner from '../components/DegradedBanner.jsx';
import { useDemoState } from '../state/DemoStore.jsx';
import {
  selectDevice, selectRealtime, selectActiveAlarms, selectAllAlarms, selectHealth,
} from '../state/selectors.js';

// 运行监测总览：设备清单来自 devicesById + crosswalk，运行状态/通信健康由 realtime/health 派生。
// 生命周期为「停用 / 报废/归档」的设备（DEV-007/008）不参与监测统计，只展示生命周期状态。
export default function OverviewPage() {
  const navigate = useNavigate();
  const state = useDemoState();
  const meta = state.meta;
  const [workshop, setWorkshop] = useState('all');

  const rows = useMemo(() => Object.values(state.entities.devicesById).map((d) => {
    const device = selectDevice(state, d.deviceId);
    const realtime = selectRealtime(state, d.deviceId);
    const health = selectHealth(state, d.deviceId);
    const alarms = selectActiveAlarms(state, d.deviceId);
    const lifecycleOnly = device.lifecycleStatus !== '在用'; // 停用/报废设备不参与监测
    return {
      deviceId: d.deviceId,
      assetCode: device.assetCode,
      name: device.name,
      model: device.model,
      workshopName: device.workshopName,
      lineName: device.lineName,
      lifecycleStatus: device.lifecycleStatus,
      runStatus: lifecycleOnly ? null : realtime.runStatus,
      healthStatus: lifecycleOnly ? null : health.status,
      latencySec: lifecycleOnly ? null : health.latencySec,
      lastSampleAt: lifecycleOnly ? null : health.lastSampleAt,
      alarmCount: alarms.length,
      monitored: !lifecycleOnly,
    };
  }), [state]);

  const monitored = rows.filter(r => r.monitored);
  const workshops = useMemo(
    () => [...new Set(rows.map(r => r.workshopName).filter(Boolean))],
    [rows],
  );

  const counts = useMemo(() => ({
    run: monitored.filter(r => r.runStatus === '运行').length,
    standby: monitored.filter(r => r.runStatus === '待机').length,
    fault: monitored.filter(r => r.runStatus === '故障').length,
    noData: monitored.filter(r => r.runStatus === '无数据').length,
    normal: monitored.filter(r => r.healthStatus === '正常').length,
    delayed: monitored.filter(r => r.healthStatus === '延迟').length,
    partial: monitored.filter(r => r.healthStatus === '部分中断').length,
    offline: monitored.filter(r => r.healthStatus === '数据中断').length,
    abnormal: monitored.filter(r => r.runStatus === '故障' || r.healthStatus !== '正常' || r.alarmCount > 0),
  }), [monitored]);

  const alarms = useMemo(() => selectActiveAlarms(state), [state]);
  const allAlarms = useMemo(() => selectAllAlarms(state), [state]);

  // 报警趋势：按报警事件触发时间（小时）分桶派生，不使用页面自造数据
  const alarmTrend = useMemo(() => {
    const buckets = {};
    allAlarms.forEach((a) => {
      const hour = (a.time || '').slice(0, 2);
      if (!/^\d{2}$/.test(hour)) return;
      buckets[hour] = buckets[hour] || { hour, 一般: 0, 重要: 0, 紧急: 0 };
      buckets[hour][a.severity] = (buckets[hour][a.severity] || 0) + 1;
    });
    return Object.values(buckets).sort((a, b) => (a.hour < b.hour ? -1 : 1));
  }, [allAlarms]);

  const filtered = workshop === 'all' ? rows : rows.filter(r => r.workshopName === workshop);

  return (
    <>
      <PageHeader
        title="监测总览"
        subtitle={`数据更新于 ${meta.updatedAt || '--'} · 最后样本 ${meta.lastSampleAt || '--'}`}
        actions={<Button type="primary" ghost onClick={() => navigate('/realtime')}>进入实时监控</Button>}
      />
      <DegradedBanner meta={meta} />
      <div className="metric-grid">
        <MetricTile label="设备总数" value={rows.length} unit="台" />
        <MetricTile label="监测中设备" value={monitored.length} unit="台" color="#1668dc" />
        <MetricTile label="运行" value={counts.run} unit="台" color="#16a34a" />
        <MetricTile label="待机" value={counts.standby} unit="台" />
        <MetricTile label="故障" value={counts.fault} unit="台" color="#dc2626" />
        <MetricTile label="无数据" value={counts.noData} unit="台" color="#8d6e63" />
        <MetricTile label="未确认报警" value={alarms.filter(a => a.status === '已触发').length} unit="条" color="#d97706" />
        <MetricTile label="处理中报警" value={alarms.filter(a => a.status === '处理中' || a.status === '已确认').length} unit="条" />
        <MetricTile label="恢复待关闭" value={alarms.filter(a => a.status === '已恢复待关闭').length} unit="条" />
        <MetricTile label="通信正常" value={counts.normal} unit="台" color="#16a34a" />
        <MetricTile label="通信延迟 / 中断" value={counts.delayed + counts.partial + counts.offline} unit="台" color="#d97706" />
        <MetricTile label="非监测设备（停用/报废）" value={rows.length - monitored.length} unit="台" />
      </div>

      <div className="chart-card-grid">
        <Card size="small" title="报警趋势（按触发时间分桶）">
          {alarmTrend.length === 0 ? (
            <MetricTile label="报警趋势" value="暂无报警事件" />
          ) : (
            <ResponsiveContainer width="100%" height={190}>
              <AreaChart data={alarmTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e8ea" />
                <XAxis dataKey="hour" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 12 }} iconSize={10} />
                {/* 报警级别为有序尺度：单色红由浅到深编码严重度（与工作台报警趋势同一色板） */}
                <Area dataKey="一般" name="一般" stackId="a" stroke="#fca5a5" fill="#fca5a5" fillOpacity={0.85} />
                <Area dataKey="重要" name="重要" stackId="a" stroke="#ef4444" fill="#ef4444" fillOpacity={0.85} />
                <Area dataKey="紧急" name="紧急" stackId="a" stroke="#991b1b" fill="#991b1b" fillOpacity={0.85} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </Card>
        <Card size="small" title="异常设备">
          {counts.abnormal.length === 0 ? (
            <MetricTile label="异常设备" value="暂无异常设备" />
          ) : (
            <Table
              size="small"
              pagination={false}
              rowKey="deviceId"
              dataSource={counts.abnormal}
              columns={[
                { title: '设备', dataIndex: 'name', render: (v, r) => <a onClick={() => navigate(`/device/${r.deviceId}`)}>{v}</a> },
                {
                  title: '问题', render: (_, r) => {
                    if (r.healthStatus === '数据中断') return '数据中断（无数据 ≠ 0）';
                    if (r.healthStatus === '部分中断') return '部分指标中断';
                    if (r.healthStatus === '延迟') return `数据延迟 ${r.latencySec ?? '--'}s`;
                    if (r.runStatus === '故障') return '设备故障';
                    return `${r.alarmCount} 条活动报警`;
                  },
                },
              ]}
            />
          )}
        </Card>
        <Card size="small" title="数据质量">
          <MetricTile label="正常采集设备" value={counts.normal} unit="台" color="#16a34a" />
          <MetricTile label="延迟设备" value={counts.delayed} unit="台" color="#d97706" />
          <MetricTile label="部分中断 / 数据中断" value={counts.partial + counts.offline} unit="台" color="#8d6e63" />
          <MetricTile label="不参与监测（停用/报废）" value={rows.length - monitored.length} unit="台" />
        </Card>
      </div>

      <Card size="small" style={{ marginTop: 12 }} title="设备快照">
        <Space wrap style={{ marginBottom: 10 }}>
          <Select
            value={workshop}
            style={{ width: 150 }}
            onChange={setWorkshop}
            options={[{ value: 'all', label: '全部车间' }, ...workshops.map(w => ({ value: w, label: w }))]}
          />
          <Button onClick={() => setWorkshop('all')}>重置</Button>
        </Space>
        <Table
          size="small"
          rowKey="deviceId"
          pagination={{ pageSize: 5 }}
          dataSource={filtered}
          onRow={(r) => ({ onClick: () => navigate(`/device/${r.deviceId}`), style: { cursor: 'pointer' } })}
          columns={[
            { title: '设备', dataIndex: 'name', render: (v, r) => <a onClick={e => { e.stopPropagation(); navigate(`/device/${r.deviceId}`); }}>{v}</a> },
            { title: '资产编号', dataIndex: 'assetCode' },
            { title: '型号', dataIndex: 'model' },
            { title: '车间 / 产线', render: (_, r) => `${r.workshopName || '--'} / ${r.lineName || '--'}` },
            { title: '生命周期', dataIndex: 'lifecycleStatus', width: 100, render: v => <StatusTag value={v} /> },
            {
              title: '运行状态', width: 100,
              render: (_, r) => (r.monitored
                ? <StatusTag value={r.runStatus} />
                : <StatusTag value={null} tip="停用/报废设备不参与运行监测" />),
            },
            {
              title: '通信健康', width: 110,
              render: (_, r) => (r.monitored
                ? <StatusTag value={r.healthStatus} tip={r.healthStatus === '延迟' ? `延迟 ${r.latencySec ?? '--'}s` : undefined} />
                : <StatusTag value={null} tip="停用/报废设备不参与通信监测" />),
            },
            { title: '活动报警', width: 90, render: (_, r) => r.alarmCount || (r.monitored ? 0 : '--') },
            { title: '最后样本', dataIndex: 'lastSampleAt', render: v => v || '--' },
          ]}
        />
      </Card>
    </>
  );
}
