import React, { useMemo } from 'react';
import { Card, Button, Space } from 'antd';
import { useNavigate } from 'react-router-dom';
import {
  Activity, AlarmClock, Gauge, ListChecks,
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
  selectWorkbench, selectAllDevices, selectDevice, selectRealtime,
  selectOeeRealtimeRows,
} from '../state/selectors.js';
import { inspectionTasks, patrolTasks, maintenanceTasks } from '../data/standardData.js';

// 工作台（2026-10-27 重构，2026-10-29 图表调整）：经营概览仪表盘 —— 只呈现全局数据统计与图表分析，
// 不再承载待办 / 异常明细列表（明细到各模块列表页查看，卡片右上角提供跳转入口）。
// 图表四块：报警趋势 / 设备运行状态 / 实时 OEE 对比 / 点检·巡检·保养·维修任务执行。
// 所有统计均由 DemoStore 事实与演示种子派生，不使用页面自造数据；
// 停用 / 报废设备不参与统计口径（与监测总览一致）。

// 状态色板（已过色盲与明度校验；灰 = 中性「无数据 / 参考」属有意中性，配图例文字二次编码）
const RUN_STATUS_COLORS = { 运行: '#16a34a', 待机: '#0ea5e9', 故障: '#dc2626', 无数据: '#94a3b8' };
// 报警级别为有序尺度（一般 → 紧急）：单色红、由浅到深编码严重度（顺序尺度 → 顺序色板）
const SEVERITY_RAMP = [
  { key: '一般', fill: '#fca5a5' },
  { key: '重要', fill: '#ef4444' },
  { key: '紧急', fill: '#991b1b' },
];
const OEE_BAR_COLOR = '#1668dc';
// 任务执行四状态（点检 / 巡检 / 保养 / 维修统一归并口径）
const TASK_STATUS_META = [
  { key: '已完成', fill: '#16a34a' },
  { key: '进行中', fill: '#0ea5e9' },
  { key: '待开始', fill: '#94a3b8' },
  { key: '已逾期', fill: '#dc2626' },
];
// 种子任务状态 → 四状态归并（已关闭视为已完成，逾期完成计入已完成）
function bucketTaskStatus(status) {
  if (['已完成', '逾期完成', '已关闭'].includes(status)) return '已完成';
  if (status === '已逾期') return '已逾期';
  if (status === '进行中') return '进行中';
  return '待开始';
}

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

  // ④ 任务执行数据：点检 / 巡检 / 保养（演示种子）+ 维修工单（DemoStore），
  //    统一归并为 已完成 / 进行中 / 待开始 / 已逾期 四状态堆叠
  const taskChart = useMemo(() => {
    const seedStat = (tasks) => {
      const c = { 已完成: 0, 进行中: 0, 待开始: 0, 已逾期: 0 };
      tasks.forEach((t) => { c[bucketTaskStatus(t.status)] += 1; });
      return c;
    };
    const repairStat = { 已完成: 0, 进行中: 0, 待开始: 0, 已逾期: 0 };
    Object.values(state.entities.repairOrdersById).forEach((o) => {
      if (o.status === '已完成') repairStat.已完成 += 1;
      else if (['已派工', '维修中', '挂起', '待验收'].includes(o.status)) repairStat.进行中 += 1;
      else if (o.status === '待派工') repairStat.待开始 += 1;
    });
    return [
      { name: '点检任务', ...seedStat(inspectionTasks) },
      { name: '巡检任务', ...seedStat(patrolTasks) },
      { name: '保养任务', ...seedStat(maintenanceTasks) },
      { name: '维修工单', ...repairStat },
    ];
  }, [state]);

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
                    barSize={26} stroke="#fff" strokeWidth={1} isAnimationActive={false}
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
                <Bar dataKey="oee" fill={OEE_BAR_COLOR} barSize={14} radius={[0, 4, 4, 0]} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>

        <Card
          size="small"
          title={<Space><ListChecks size={15} /> 任务执行（点检 / 巡检 / 保养 / 维修）</Space>}
          extra={<Button type="link" size="small" onClick={() => navigate('/repair-orders')}>维修任务</Button>}
        >
          <ResponsiveContainer width="100%" height={210}>
            <BarChart data={taskChart} margin={{ top: 6, right: 12, left: -22, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e8ea" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} />
              <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 12 }} iconSize={10} />
              {TASK_STATUS_META.map((s) => (
                <Bar key={s.key} dataKey={s.key} stackId="task" fill={s.fill} barSize={26} stroke="#fff" strokeWidth={1} isAnimationActive={false} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>
    </>
  );
}
