import React, { useMemo, useState } from 'react';
import { Table, Button, Input, Select, Space, Tooltip, Tag } from 'antd';
import { useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import { useDemoState } from '../state/DemoStore.jsx';
import { selectOeeDailyRows, selectAllDevices } from '../state/selectors.js';
import PageHeader from '../components/PageHeader.jsx';
import DegradedBanner from '../components/DegradedBanner.jsx';

// 历史（日）OEE：数字全部来自 selectOeeDailyRows（window='daily'，默认 meta.demoDay = 2026-09-16）。
// null = 不可计算（'--'，悬停显示原因），严禁用 0 或月度平均替代某天 OEE。
// 点击行进入该设备当日明细 /oee-history/detail/:deviceId。

const pctText = (v) => (v == null ? '--' : `${v}%`);

function blockersText(row) {
  const parts = [...(row.blockers || [])];
  if (row.eligibility?.reason && !parts.includes(row.eligibility.reason)) parts.push(row.eligibility.reason);
  return parts.length ? parts.join('；') : '不可计算';
}

export default function OeeHistoryPage() {
  const state = useDemoState();
  const navigate = useNavigate();
  const [dept, setDept] = useState('all');
  const [kw, setKw] = useState('');
  const [day, setDay] = useState(state.meta.demoDay);

  const devices = useMemo(() => selectAllDevices(state), [state]);

  // 可选日期：演示输入中实际存在统计口径的日期（不虚构其他日期）
  const dayOptions = useMemo(() => {
    const set = new Set([state.meta.demoDay]);
    Object.values(state.entities.oeeInputs.daily || {}).forEach(days => Object.keys(days || {}).forEach(d => set.add(d)));
    return [...set].sort();
  }, [state]);

  const rows = useMemo(() => {
    const k = kw.trim().toLowerCase();
    return selectOeeDailyRows(state, day)
      .map(r => ({ ...r, device: devices.find(d => d.deviceId === r.deviceId) || null }))
      .filter(r => dept === 'all' || r.device?.workshopName === dept)
      .filter(r => !k
        || (r.device?.name || '').toLowerCase().includes(k)
        || (r.device?.assetCode || '').toLowerCase().includes(k));
  }, [state, devices, day, dept, kw]);

  const oeeCell = (r) => {
    const v = r.oee;
    if (v == null) {
      return <Tooltip title={blockersText(r)}><Tag>不可计算</Tag></Tooltip>;
    }
    const target = r.target != null ? r.target : 75;
    const color = v >= target ? 'success' : v >= 60 ? 'warning' : 'error';
    return (
      <Tooltip title={`目标 ${target}%：${v >= target ? '达标' : '未达标'} · 可用率 ${pctText(r.availability)} × 性能率 ${pctText(r.performance)} × 合格率 ${pctText(r.quality)}`}>
        <span style={{ color: color === 'success' ? '#16a34a' : color === 'warning' ? '#d97706' : '#dc2626', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{v}%</span>
      </Tooltip>
    );
  };

  return (
    <>
      <DegradedBanner meta={state.meta} />
      <PageHeader
        title="历史 OEE"
        subtitle={`统计日期：${day}`}
      />
      <Space wrap style={{ marginBottom: 12 }}>
        <Select value={day} onChange={setDay} style={{ width: 140 }} options={dayOptions.map(d => ({ value: d, label: d }))} />
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
        rowKey="deviceId" size="small"
        dataSource={rows}
        onRow={(r) => ({ style: { cursor: 'pointer' }, onClick: () => navigate(`/oee-history/detail/${r.deviceId}`) })}
        columns={[
          { title: '设备编号', width: 110, render: (_, r) => r.device?.assetCode || '--' },
          { title: '设备名称', dataIndex: 'name', width: 150, render: (_, r) => r.device?.name || r.deviceId },
          { title: '规格型号', width: 110, render: (_, r) => r.device?.model || '--' },
          { title: '分类', width: 110, render: (_, r) => r.device?.type || '--' },
          { title: '使用部门', width: 110, render: (_, r) => r.device?.workshopName || '--' },
          { title: '统计日期', dataIndex: 'day', width: 110 },
          { title: '负荷时间(分钟)', width: 120, align: 'right', render: (_, r) => r.loadMinutes ?? '--' },
          { title: '运行时间(分钟)', width: 120, align: 'right', render: (_, r) => r.runMinutes ?? '--' },
          { title: '可用率', width: 90, align: 'right', render: (_, r) => pctText(r.availability) },
          { title: '性能率', width: 90, align: 'right', render: (_, r) => pctText(r.performance) },
          { title: '合格率', width: 90, align: 'right', render: (_, r) => pctText(r.quality) },
          { title: '当日 OEE', width: 100, align: 'right', render: (_, r) => oeeCell(r) },
          { title: '目标', width: 80, align: 'right', render: (_, r) => (r.target != null ? `${r.target}%` : '--') },
          { title: '操作', width: 110, render: (_, r) => <a onClick={(e) => { e.stopPropagation(); navigate(`/oee-history/detail/${r.deviceId}`); }}>查看当日明细</a> },
        ]}
      />
    </>
  );
}
