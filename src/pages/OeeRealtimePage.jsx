import React, { useMemo, useState } from 'react';
import { Table, Tag, Button, Input, Select, Space, Tooltip } from 'antd';
import { Link } from 'react-router-dom';
import { Search } from 'lucide-react';
import { useDemoState } from '../state/DemoStore.jsx';
import {
  selectOeeRealtimeRows, selectOeeResult, selectAllDevices,
} from '../state/selectors.js';
import PageHeader from '../components/PageHeader.jsx';
import MetricTile from '../components/MetricTile.jsx';
import DegradedBanner from '../components/DegradedBanner.jsx';

// 实时 OEE：全部数字由 selectOeeRealtimeRows 派生，页面不写死任何 OEE 值。
// null = 不可计算（显示 '--'，悬停显示 blockers 原因），严格区别于 0。
// OEE = 可用率 × 性能率 × 合格率；统计窗口：最近 1 小时（meta.demoDay 演示日）。

const pctText = (v) => (v == null ? '--' : `${v}%`);
const minutesText = (v) => (v == null ? '--' : `${v} 分钟`);
const speedText = (v) => (v == null ? '--' : `${v} 个/小时`);

// 不可计算原因：selector blockers + 资格矩阵原因（如 DEV-005 未配置理想速度 / DEV-006 不参与 OEE）
function blockersText(row) {
  const parts = [...(row.blockers || [])];
  if (row.eligibility?.reason && !parts.includes(row.eligibility.reason)) parts.push(row.eligibility.reason);
  return parts.length ? parts.join('；') : '不可计算';
}

export default function OeeRealtimePage() {
  const state = useDemoState();
  const [dept, setDept] = useState('all');
  const [kw, setKw] = useState('');

  const devices = useMemo(() => selectAllDevices(state), [state]);

  const rows = useMemo(() => {
    // 1) selector 派生：realtime 输入的设备（DEV-001..005，DEV-005 无生产数据 → 不可计算）
    const base = selectOeeRealtimeRows(state).map(r => ({
      ...r,
      device: devices.find(d => d.deviceId === r.deviceId) || null,
    }));
    // 2) 未纳入实时窗口且不参与 OEE 的设备（DEV-006..008）：整行 '--' 并给出来由
    const extra = devices
      .filter(d => !base.some(r => r.deviceId === d.deviceId))
      .filter(d => d.oeeEligible === false)
      .map(d => ({
        ...selectOeeResult(state, d.deviceId, { window: 'realtime' }),
        blockers: [d.deviceId === 'DEV-006'
          ? '动力设备不参与 OEE 统计（无班次日历与生产口径）'
          : `${d.lifecycleStatus}设备不参与 OEE 统计`],
        dataStatus: '不参与',
        device: d,
      }));
    const all = [...base, ...extra];
    const k = kw.trim().toLowerCase();
    return all
      .filter(r => dept === 'all' || r.device?.workshopName === dept)
      .filter(r => !k
        || (r.device?.name || '').toLowerCase().includes(k)
        || (r.device?.assetCode || '').toLowerCase().includes(k));
  }, [state, devices, dept, kw]);

  // 汇总卡：只对可计算的行求均值（null 不计入，也不当作 0）
  const avgOf = (key) => {
    const vals = rows.map(r => r[key]).filter(v => v != null);
    return vals.length ? (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1) : null;
  };

  const oeeCell = (r) => {
    const v = r.oee;
    if (v == null) {
      return (
        <Tooltip title={blockersText(r)}>
          <Tag>不可计算</Tag>
        </Tooltip>
      );
    }
    const target = r.target != null ? r.target : 75;
    const color = v >= target ? 'success' : v >= 60 ? 'warning' : 'error';
    return (
      <Tooltip title={`目标 ${target}%：${v >= target ? '达标' : '未达标'} · 可用率 ${pctText(r.availability)} × 性能率 ${pctText(r.performance)} × 合格率 ${pctText(r.quality)}`}>
        <Tag color={color}>{v}%</Tag>
      </Tooltip>
    );
  };

  const rateCell = (v, r) => (v == null
    ? <Tooltip title={blockersText(r)}><span style={{ color: '#8a97a3' }}>--</span></Tooltip>
    : <span style={{ fontVariantNumeric: 'tabular-nums' }}>{v}%</span>);

  return (
    <>
      <DegradedBanner meta={state.meta} />
      <PageHeader
        title="实时 OEE"
        subtitle={`统计窗口：最近 1 小时（统计日 ${state.meta.demoDay}）`}
      />
      <div className="metric-grid" style={{ marginBottom: 12 }}>
        <MetricTile label="平均 OEE（可计算设备）" value={avgOf('oee')} unit="%" color="#1668dc" />
        <MetricTile label="平均可用率" value={avgOf('availability')} unit="%" color="#389e0d" />
        <MetricTile label="平均性能率" value={avgOf('performance')} unit="%" color="#d46b08" />
        <MetricTile label="平均合格率" value={avgOf('quality')} unit="%" color="#5d6b78" />
      </div>
      <Space wrap style={{ marginBottom: 12 }}>
        <Select
          value={dept} onChange={setDept} style={{ width: 140 }}
          options={[
            { value: 'all', label: '全部部门' },
            ...[...new Set(devices.map(d => d.workshopName))].filter(Boolean).map(w => ({ value: w, label: w })),
          ]}
        />
        <Input allowClear prefix={<Search size={13} />} placeholder="设备名称 / 编号" style={{ width: 200 }} value={kw} onChange={e => setKw(e.target.value)} />
        <Button onClick={() => { setDept('all'); setKw(''); }}>重置</Button>
      </Space>
      <Table
        rowKey="deviceId" size="small" scroll={{ x: 1250 }}
        dataSource={rows}
        columns={[
          { title: '设备编号', dataIndex: 'assetCode', width: 110, render: (_, r) => r.device?.assetCode || '--' },
          {
            title: '设备名称', dataIndex: 'name', width: 140, fixed: 'left',
            render: (_, r) => <Link to={`/device/${r.deviceId}`}>{r.device?.name || r.deviceId}</Link>,
          },
          { title: '规格型号', width: 100, render: (_, r) => r.device?.model || '--' },
          { title: '设备类型', width: 100, render: (_, r) => r.device?.type || '--' },
          { title: '使用部门', width: 100, render: (_, r) => r.device?.workshopName || '--' },
          { title: 'OEE', width: 100, render: (_, r) => oeeCell(r) },
          { title: '负荷时间', width: 100, render: (_, r) => minutesText(r.loadMinutes) },
          { title: '计划停机时间', width: 120, render: (_, r) => minutesText(r.plannedDowntimeMinutes) },
          { title: '运行时间', width: 100, render: (_, r) => minutesText(r.runMinutes) },
          { title: '可用率', width: 90, render: (_, r) => rateCell(r.availability, r) },
          { title: '理想生产速度', width: 120, render: (_, r) => speedText(r.idealSpeed) },
          { title: '实际生产速度', width: 120, render: (_, r) => speedText(r.actualSpeed) },
          { title: '性能率', width: 90, render: (_, r) => rateCell(r.performance, r) },
          { title: '合格率', width: 90, render: (_, r) => rateCell(r.quality, r) },
          { title: '数据状态', dataIndex: 'dataStatus', width: 100, render: v => (v === '正常' ? <Tag color="success">正常</Tag> : <Tag>{v || '--'}</Tag>) },
        ]}
      />
    </>
  );
}
