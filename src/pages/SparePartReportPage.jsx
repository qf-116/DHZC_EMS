import React, { useMemo, useState } from 'react';
import { Card, Table, Tag, Button, Space, Select, Input, DatePicker } from 'antd';
import dayjs from 'dayjs';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Download, Search } from 'lucide-react';
import { App } from 'antd';
import PageHeader from '../components/PageHeader.jsx';
import MetricTile from '../components/MetricTile.jsx';
import StatusTag from '../components/StatusTag.jsx';
import EmptyState from '../components/EmptyState.jsx';
import DegradedBanner from '../components/DegradedBanner.jsx';
import { useDemoState, useDemoActions } from '../state/DemoStore.jsx';
import { selectStockRows, selectExportTasks } from '../state/selectors.js';

const THEME = 'sparepart';

const { RangePicker } = DatePicker;

const fmt = v => (v === null || v === undefined || v === '' ? '--' : v);

// 备件管理统计报表：由 selectStockRows（库存水位）+ 出库单 / 退库单 / 入库单聚合。
// 口径：可用 = 现存 − 预留（domain/spare 统一口径）；库存水位按各仓库现存合计 vs 安全 / 最大库存判定；
// 出库 / 入库 / 退库为演示快照累计数。空值显示 '--'，不伪造 0。
export default function SparePartReportPage() {
  const { message } = App.useApp();
  const state = useDemoState();
  const actions = useDemoActions();
  const meta = state.meta;

  // UI 层筛选：备件名称 / 库存水位 / 统计日期范围
  const [keyword, setKeyword] = useState('');
  const [level, setLevel] = useState('all');
  const [range, setRange] = useState(null);

  // 日期范围过滤助手（按前 10 位日期字符串比较）
  const inRange = (d) => {
    if (!range || !range[0] || !range[1]) return true;
    if (!d) return false;
    const s = String(d).slice(0, 10);
    return s >= range[0].format('YYYY-MM-DD') && s <= range[1].format('YYYY-MM-DD');
  };

  const stockRows = useMemo(() => selectStockRows(state), [state]);
  const outbounds = useMemo(() => Object.values(state.entities.outboundsById), [state]);
  const returns = useMemo(() => Object.values(state.entities.returnsById), [state]);
  const inbounds = useMemo(() => Object.values(state.entities.inboundsById), [state]);

  // 出库 / 入库 / 退库按备件编码累计（统计日期范围：按单据日期过滤后再聚合）
  const flowBySpare = useMemo(() => {
    const acc = {};
    const ensure = code => (acc[code] = acc[code] || { outboundQty: 0, outboundCount: 0, returnQty: 0, inboundQty: 0 });
    for (const ob of outbounds) {
      if (!inRange(ob.date)) continue;
      for (const item of ob.items || []) {
        const f = ensure(item.spareCode);
        f.outboundQty += item.qty || 0;
        f.outboundCount += 1;
      }
    }
    for (const rt of returns) {
      if (!inRange(rt.date)) continue;
      ensure(rt.spareCode).returnQty += rt.qty || 0;
    }
    for (const ib of inbounds) {
      if (ib.status !== '已入库') continue;
      if (!inRange(ib.date)) continue;
      for (const item of ib.items || []) ensure(item.spareCode).inboundQty += item.qty || 0;
    }
    return acc;
  }, [outbounds, returns, inbounds, range]);

  // 按备件编码聚合各仓库库存
  const allRows = useMemo(() => {
    const bySpare = new Map();
    for (const row of stockRows) {
      const code = row.spareCode;
      if (!bySpare.has(code)) {
        const spare = row.spare || {};
        bySpare.set(code, {
          code,
          name: spare.name || code,
          spec: spare.spec || '--',
          unit: spare.unit || '--',
          safe: spare.safe ?? null,
          max: spare.max ?? null,
          warehouses: new Set(),
          onHand: 0, reserved: 0, available: 0,
        });
      }
      const agg = bySpare.get(code);
      agg.warehouses.add(row.warehouseId);
      agg.onHand += row.onHand ?? 0;
      agg.reserved += row.reserved ?? 0;
      agg.available += row.available ?? 0;
    }
    return [...bySpare.values()].map(r => {
      const flow = flowBySpare[r.code] || { outboundQty: 0, outboundCount: 0, returnQty: 0, inboundQty: 0 };
      // 库存水位（合计口径）：现存 < 安全 → 低于安全库存；现存 > 最大 → 超过最大库存
      const level = r.safe != null && r.onHand < r.safe ? '低于安全库存'
        : (r.max != null && r.onHand > r.max ? '超过最大库存' : '正常');
      return { ...r, ...flow, level, warehouseText: [...r.warehouses].join('、') || '--' };
    }).sort((a, b) => a.code.localeCompare(b.code));
  }, [stockRows, flowBySpare]);

  const levelOptions = useMemo(() => [...new Set(allRows.map(r => r.level))].map(l => ({ value: l, label: l })), [allRows]);

  const rows = useMemo(() => allRows.filter(r => {
    if (level !== 'all' && r.level !== level) return false;
    if (keyword && !`${r.name}${r.code}`.includes(keyword.trim())) return false;
    return true;
  }), [allRows, level, keyword]);

  const totals = useMemo(() => rows.reduce((a, r) => ({
    inbound: a.inbound + r.inboundQty, outbound: a.outbound + r.outboundQty,
    ret: a.ret + r.returnQty, count: a.count + r.outboundCount,
    low: a.low + (r.level === '低于安全库存' ? 1 : 0),
    over: a.over + (r.level === '超过最大库存' ? 1 : 0),
  }), { inbound: 0, outbound: 0, ret: 0, count: 0, low: 0, over: 0 }), [rows]);

  const exportTasks = useMemo(
    () => selectExportTasks(state).filter(t => t.theme === THEME),
    [state],
  );

  const currentFilters = { keyword, level: level === 'all' ? '' : level };
  const handleQuery = () => {
    const res = actions.runReport(THEME, currentFilters);
    res.ok ? message.success(res.message) : message.error(res.message);
  };
  const handleReset = () => { setKeyword(''); setLevel('all'); setRange(null); };
  const handleExport = () => {
    const res = actions.createExportTask(THEME, currentFilters);
    res.ok ? message.success(res.message) : message.error(res.message);
  };
  const handleDownload = (task) => {
    message.success(`导出任务 ${task.exportId} 已创建`);
  };

  const chartData = rows.map(r => ({ name: r.name, available: r.available, safe: r.safe ?? 0 }));

  const columns = [
    { title: '备件编码', dataIndex: 'code', width: 100 },
    { title: '备件名称', dataIndex: 'name', width: 120 },
    { title: '规格', dataIndex: 'spec', width: 100, render: fmt },
    { title: '单位', dataIndex: 'unit', width: 70, render: fmt },
    { title: '覆盖仓库', dataIndex: 'warehouseText', ellipsis: true },
    { title: '现存合计', dataIndex: 'onHand', width: 90, align: 'center', sorter: (a, b) => a.onHand - b.onHand },
    { title: '预留', dataIndex: 'reserved', width: 80, align: 'center' },
    { title: '可用', dataIndex: 'available', width: 80, align: 'center', render: v => <Tag color="processing">{v}</Tag> },
    { title: '安全库存', dataIndex: 'safe', width: 90, align: 'center', render: fmt },
    { title: '最大库存', dataIndex: 'max', width: 90, align: 'center', render: fmt },
    { title: '库存水位', dataIndex: 'level', width: 120, render: v => <StatusTag value={v} /> },
    { title: '入库累计', dataIndex: 'inboundQty', width: 90, align: 'center', render: v => (v > 0 ? <Tag color="success">+{v}</Tag> : '--') },
    { title: '出库累计', dataIndex: 'outboundQty', width: 90, align: 'center', render: v => (v > 0 ? <Tag color="orange">-{v}</Tag> : '--') },
    { title: '退库累计', dataIndex: 'returnQty', width: 90, align: 'center', render: v => (v > 0 ? <Tag color="success">+{v}</Tag> : '--') },
    { title: '出库单数', dataIndex: 'outboundCount', width: 90, align: 'center', render: v => (v > 0 ? v : '--') },
  ];

  return (
    <>
      <PageHeader
        title="备件管理统计报表"
        subtitle={`数据口径截止 ${meta.lastSampleAt || '--'}`}
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
          <Input.Search
            value={keyword}
            onChange={e => setKeyword(e.target.value)}
            onSearch={setKeyword}
            placeholder="备件名称 / 编码"
            style={{ width: 180 }}
            allowClear
          />
          <Select value={level} onChange={setLevel} style={{ width: 150 }} options={[{ value: 'all', label: '全部水位' }, ...levelOptions]} />
          <Button type="primary" icon={<Search size={14} />} onClick={handleQuery}>查询</Button>
          <Button onClick={handleReset}>重置</Button>
        </Space>
      </Card>
      <div className="metric-grid" style={{ marginBottom: 12 }}>
        <MetricTile label="备件种类" value={rows.length} unit="种" />
        <MetricTile label="低于安全库存" value={totals.low} unit="种" color="#d97706" />
        <MetricTile label="超过最大库存" value={totals.over} unit="种" color="#dc2626" />
        <MetricTile label="入库累计" value={totals.inbound} color="#16a34a" />
        <MetricTile label="出库累计" value={totals.outbound} />
        <MetricTile label="退库累计" value={totals.ret} color="#1668dc" />
        <MetricTile label="出库单数" value={totals.count} unit="单" />
      </div>
      {chartData.length > 0 && (
        <Card size="small" title="可用库存 / 安全库存对比" style={{ marginBottom: 12 }}>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData} margin={{ top: 6, right: 12, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e8ea" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} />
              <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
              <Tooltip formatter={v => `${v}`} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="available" name="可用库存" fill="#00b8d4" barSize={18} radius={[3, 3, 0, 0]} />
              <Bar dataKey="safe" name="安全库存" fill="#c2cfd8" barSize={18} radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}
      {rows.length === 0 ? (
        <EmptyState
          description="当前筛选条件下无备件统计行"
          reason="当前筛选条件下没有数据，调整筛选后重试"
          next="重置筛选"
          nextLabel="重置筛选"
          onNext={handleReset}
        />
      ) : (
        <Card size="small">
          <Table rowKey="code" size="small" scroll={{ x: 1500 }} dataSource={rows} columns={columns} pagination={false} />
        </Card>
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
