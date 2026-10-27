import React, { useMemo } from 'react';
import { Card, Button, Space } from 'antd';
import { useNavigate } from 'react-router-dom';
import {
  Activity, AlarmClock, Package, Wifi, Wrench, Gauge,
} from 'lucide-react';
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import PageHeader from '../components/PageHeader.jsx';
import MetricTile from '../components/MetricTile.jsx';
import EmptyState from '../components/EmptyState.jsx';
import DegradedBanner from '../components/DegradedBanner.jsx';
import { useDemoState } from '../state/DemoStore.jsx';
import {
  selectWorkbench, selectAllDevices, selectDevice, selectRealtime, selectHealth,
  selectOeeRealtimeRows,
} from '../state/selectors.js';

// 工作台（2026-10-27 重构）：经营概览仪表盘 —— 只呈现全局数据统计与图表分析，
// 不再承载待办 / 异常明细列表（明细到各模块列表页查看，卡片右上角提供跳转入口）。
// 所有统计均由 DemoStore 事实派生（selectWorkbench / selectOeeRealtimeRows / realtime / health），
// 不使用页面自造数据；停用 / 报废设备不参与统计口径（与监测总览一致）。

// 状态色板（已过色盲与明度校验；灰 = 中性「无数据 / 参考」属有意中性，配图例文字二次编码）
const RUN_STATUS_COLORS = { 运行: '#16a34a', 待机: '#0ea5e9', 故障: '#dc2626', 无数据: '#94a3b8' };
const COMM_COLORS = { 正常: '#16a34a', 延迟: '#0ea5e9', 部分中断: '#d97706', 数据中断: '#b91c1c' };
const REPAIR_COLORS = {
  待派工: '#d97706', 已派工: '#0ea5e9', 维修中: '#6366f1', 挂起: '#94a3b8',
  待验收: '#ec4899', 已完成: '#16a34a', 已取消: '#cbd5e1',
};
// 报警级别为有序尺度（一般 → 紧急）：单色红、由浅到深编码严重度（顺序尺度 → 顺序色板）
const SEVERITY_RAMP = [
  { key: '一般', fill: '#fca5a5' },
  { key: '重要', fill: '#ef4444' },
  { key: '紧急', fill: '#991b1b' },
];
const OEE_BAR_COLOR = '#1668dc';

// 环形分布图（状态类）：2px 白色分隔 + 图例带数量（数量即图上直接标注，不依赖颜色alone）
function StatusDonut({ data, unit, height = 210 }) {
  if (!data.length) {
    return <EmptyState description="暂无可统计的数据" reason="当前没有可纳入统计的记录" />;
  }
  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie
          data={data} dataKey="value" nameKey="name"
          innerRadius="52%" outerRadius="78%"
          paddingAngle={2} stroke="#fff" strokeWidth={2}
          isAnimationActive={false}
        >
          {data.map((d) => <Cell key={d.name} fill={d.fill} />)}
        </Pie>
        <Tooltip formatter={(v, n) => [`${v} ${unit}`, n]} separator="" />
        <Legend wrapperStyle={{ fontSize: 12 }} iconSize={10} />
      </PieChart>
    </ResponsiveContainer>
  );
}

// 状态计数 → 环形图数据：按固定状态序取非 0 项，颜色跟随状态本体（不随排序变化）
function countToDonut(counts, colorMap, order, unitSuffix) {
  return order
    .filter((s) => (counts[s] || 0) > 0)
    .map((s) => ({ name: `${s} · ${counts[s]}`, value: counts[s], fill: colorMap[s] }));
}

export default function WorkbenchPage() {
  const navigate = useNavigate();
  const state = useDemoState();
  const meta = state.meta;
  const wb = useMemo(() => selectWorkbench(state), [state]);
  const devices = useMemo(() => selectAllDevices(state), [state]);

  // 监测口径：仅「在用」设备参与运行 / 通信 / OEE 统计（停用、报废/归档除外）
  const monitored = useMemo(
    () => devices.filter((d) => selectDevice(state, d.deviceId).lifecycleStatus === '在用'),
    [state, devices],
  );

  // ---- KPI 统计 ----
  const repairInHand = Object.values(state.entities.repairOrdersById)
    .filter((o) => ['待派工', '已派工', '维修中', '待验收'].includes(o.status)).length;
  const oeeRows = useMemo(() => selectOeeRealtimeRows(state), [state]);
  const oeeComputable = oeeRows.filter((r) => r.oee != null);
  const oeeAvg = oeeComputable.length
    ? Math.round((oeeComputable.reduce((s, r) => s + r.oee, 0) / oeeComputable.length) * 10) / 10
    : null;

  // ---- 图表数据 ----
  // ① 报警趋势：当日事件按触发时间（小时）分桶 × 级别堆叠
  const alarmTrend = useMemo(() => {
    const allAlarms = Object.values(state.entities.alarmEventsById);
    const buckets = {};
    allAlarms.forEach((a) => {
      const hour = (a.time || '').slice(0, 2);
      if (!/^\d{2}$/.test(hour)) return;
      buckets[hour] = buckets[hour] || { hour: `${hour}时`, 一般: 0, 重要: 0, 紧急: 0 };
      buckets[hour][a.severity] = (buckets[hour][a.severity] || 0) + 1;
    });
    return Object.values(buckets).sort((a, b) => (a.hour < b.hour ? -1 : 1));
  }, [state]);
  const alarmTotal = Object.values(state.entities.alarmEventsById).length;

  // ② 设备运行状态分布（监测中设备）
  const runCounts = useMemo(() => {
    const counts = {};
    monitored.forEach((d) => {
      const s = selectRealtime(state, d.deviceId).runStatus || '无数据';
      counts[s] = (counts[s] || 0) + 1;
    });
    return counts;
  }, [state, monitored]);
  const runDonut = countToDonut(runCounts, RUN_STATUS_COLORS, ['运行', '待机', '故障', '无数据']);

  // ③ 设备实时 OEE 对比（可计算设备；不可计算台数在卡片副注明示）
  const oeeChart = useMemo(() => oeeComputable
    .map((r) => {
      const d = state.entities.devicesById[r.deviceId];
      return { name: d ? d.name : r.deviceId, oee: r.oee, target: r.target };
    })
    .sort((a, b) => b.oee - a.oee), [oeeComputable, state]);

  // ④ 设备通信健康分布（监测中设备）
  const commCounts = useMemo(() => {
    const counts = {};
    monitored.forEach((d) => {
      const s = selectHealth(state, d.deviceId).status || '未知';
      counts[s] = (counts[s] || 0) + 1;
    });
    return counts;
  }, [state, monitored]);
  const commDonut = countToDonut(commCounts, COMM_COLORS, ['正常', '延迟', '部分中断', '数据中断']);

  // ⑤ 维修工单状态分布（当前在案工单，按流程序取非 0 状态）
  const repairCounts = useMemo(() => {
    const counts = {};
    Object.values(state.entities.repairOrdersById).forEach((o) => {
      counts[o.status] = (counts[o.status] || 0) + 1;
    });
    return counts;
  }, [state]);
  const repairDonut = countToDonut(
    repairCounts, REPAIR_COLORS,
    ['待派工', '已派工', '维修中', '挂起', '待验收', '已完成', '已取消'],
  );

  // ⑥ 备件库存水位（低于安全库存 Top5：现存 vs 安全库存，按缺口降序）
  // 注：selectWorkbench 的 lowStock 为原始库存行，备件档案在此按 spareCode 关联
  const stockChart = useMemo(() => wb.lowStock
    .map((r) => {
      const spare = state.entities.sparesByCode[r.spareCode];
      const safe = spare?.safe ?? null;
      return {
        name: `${spare?.name || r.spareCode}（${r.warehouseId || '--'}）`,
        现存: r.onHand,
        安全库存: safe,
        gap: safe != null ? safe - r.onHand : -1,
      };
    })
    .sort((a, b) => b.gap - a.gap)
    .slice(0, 5), [wb.lowStock, state]);

  return (
    <>
      <PageHeader
        title="工作台"
        subtitle={`数据更新于 ${meta.updatedAt || '--'} · 最后样本 ${meta.lastSampleAt || '--'} · 统计口径：${devices.length} 台设备（${monitored.length} 台监测中）`}
        actions={<Button type="primary" onClick={() => window.open('装备智能运营中枢大屏.html', '_blank')}>进入监测大屏</Button>}
      />
      <DegradedBanner meta={meta} />

      {/* KPI 指标带：全局核心统计 */}
      <div className="metric-grid" style={{ marginBottom: 12 }}>
        <MetricTile label="设备总数" value={devices.length} unit="台" color="#1668dc" />
        <MetricTile label="实时 OEE 均值" value={oeeAvg == null ? '--' : oeeAvg} unit={oeeAvg == null ? '' : '%'} color="#0e7490" />
        <MetricTile label="活动报警（已触发）" value={wb.unacked.length} unit="条" color="#dc2626" />
        <MetricTile label="维修在办工单" value={repairInHand} unit="单" color="#d46b08" />
        <MetricTile label="低库存备件" value={wb.lowStock.length} unit="项" color="#d97706" />
        <MetricTile label="通信异常设备" value={wb.degradedDevices.length} unit="台" color="#8d6e63" />
      </div>

      {/* 图表分析区：3 列网格，明细一律去模块列表页查看 */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 12 }}>
        <Card
          size="small" style={{ gridColumn: 'span 2' }}
          title={<Space><AlarmClock size={15} /> 报警趋势（当日 · 按级别）</Space>}
          extra={<Button type="link" size="small" onClick={() => navigate('/alarm-center')}>报警中心</Button>}
        >
          {alarmTrend.length === 0 ? (
            <EmptyState description="暂无报警事件" reason="当日没有报警触发记录" />
          ) : (
            <ResponsiveContainer width="100%" height={210}>
              <BarChart data={alarmTrend} margin={{ top: 6, right: 12, left: -22, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e8ea" vertical={false} />
                <XAxis dataKey="hour" tick={{ fontSize: 11 }} interval={0} />
                <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                <Tooltip />
                {/* 图例按严重度固定排序（一般 → 重要 → 紧急），与色阶由浅到深一致 */}
                <Legend
                  wrapperStyle={{ fontSize: 12 }} iconSize={10}
                  payload={SEVERITY_RAMP.map((s) => ({ value: s.key, type: 'rect', color: s.fill, id: s.key }))}
                />
                {SEVERITY_RAMP.map((s) => (
                  <Bar
                    key={s.key} dataKey={s.key} stackId="sev" fill={s.fill}
                    barSize={26} stroke="#fff" strokeWidth={1}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>

        <Card
          size="small"
          title={<Space><Activity size={15} /> 设备运行状态</Space>}
          extra={<Button type="link" size="small" onClick={() => navigate('/monitor-overview')}>监测总览</Button>}
        >
          <StatusDonut data={runDonut} unit="台" />
        </Card>

        <Card
          size="small" style={{ gridColumn: 'span 2' }}
          title={<Space><Gauge size={15} /> 设备实时 OEE 对比</Space>}
          extra={
            <Button type="link" size="small" onClick={() => navigate('/oee-realtime')}>
              实时 OEE（{oeeComputable.length}/{monitored.length} 台可计算）
            </Button>
          }
        >
          {oeeChart.length === 0 ? (
            <EmptyState
              description="暂无可计算的 OEE"
              reason="设备无生产数据、绑定未启用或处于数据中断状态时 OEE 不可计算"
              next="查看实时 OEE" onNext={() => navigate('/oee-realtime')}
            />
          ) : (
            <ResponsiveContainer width="100%" height={210}>
              <BarChart data={oeeChart} layout="vertical" margin={{ top: 6, right: 24, left: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e8ea" horizontal={false} />
                <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10 }} unit="%" />
                <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v) => [`${v}%`, 'OEE']} separator="" />
                <Bar dataKey="oee" fill={OEE_BAR_COLOR} barSize={14} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>

        <Card
          size="small"
          title={<Space><Wifi size={15} /> 通信健康分布</Space>}
          extra={<Button type="link" size="small" onClick={() => navigate('/binding-overview')}>接入配置</Button>}
        >
          <StatusDonut data={commDonut} unit="台" />
        </Card>

        <Card
          size="small"
          title={<Space><Wrench size={15} /> 维修工单状态</Space>}
          extra={<Button type="link" size="small" onClick={() => navigate('/repair-orders')}>维修任务</Button>}
        >
          <StatusDonut data={repairDonut} unit="单" />
        </Card>

        <Card
          size="small" style={{ gridColumn: 'span 2' }}
          title={<Space><Package size={15} /> 低库存备件水位（缺口 Top5）</Space>}
          extra={<Button type="link" size="small" onClick={() => navigate('/spare-parts-stock')}>备件台账</Button>}
        >
          {stockChart.length === 0 ? (
            <EmptyState
              description="所有备件库存均高于安全库存"
              reason="库存低于安全库存的备件会出现在此处"
              next="查看备件台账" onNext={() => navigate('/spare-parts-stock')}
            />
          ) : (
            <ResponsiveContainer width="100%" height={210}>
              <BarChart data={stockChart} layout="vertical" margin={{ top: 6, right: 24, left: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e8ea" horizontal={false} />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 10 }} />
                <YAxis type="category" dataKey="name" width={150} tick={{ fontSize: 10 }} />
                <Tooltip separator="" />
                <Legend wrapperStyle={{ fontSize: 12 }} iconSize={10} />
                <Bar dataKey="安全库存" fill="#94a3b8" barSize={10} radius={[0, 3, 3, 0]} />
                <Bar dataKey="现存" fill="#0ea5e9" barSize={10} radius={[0, 3, 3, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>
    </>
  );
}
