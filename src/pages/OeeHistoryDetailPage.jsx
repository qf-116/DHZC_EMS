import React, { useMemo } from 'react';
import { Card, Table, Button, Select, Space, Tag, Tooltip, Empty } from 'antd';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useDemoState } from '../state/DemoStore.jsx';
import {
  selectOeeResult, selectOeeLosses, selectMttrMtbf, selectAllDevices,
} from '../state/selectors.js';
import PageHeader from '../components/PageHeader.jsx';
import DegradedBanner from '../components/DegradedBanner.jsx';

// 历史 OEE 日明细：路由 /oee-history/detail/:deviceId（兼容旧 /oee-history/detail?device=xxx）。
// 展示该设备当日输入项、三率与 OEE 计算过程、损失分解与 MTTR/MTBF；
// 全部数字由 selector 派生（selectOeeResult / selectOeeLosses / selectMttrMtbf），页面不写死数值。
// null = 不可计算：显示 '--' 并给出 blockers 原因，严禁当作 0。

const pctText = (v) => (v == null ? '--' : `${v}%`);
const minutesText = (v) => (v == null ? '--' : `${v} 分钟`);
const speedText = (v) => (v == null ? '--' : `${v} 个/小时`);

function blockersText(result) {
  const parts = [...(result?.blockers || [])];
  if (result?.eligibility?.reason && !parts.includes(result.eligibility.reason)) parts.push(result.eligibility.reason);
  return parts.length ? parts.join('；') : '不可计算';
}

export default function OeeHistoryDetailPage() {
  const state = useDemoState();
  const navigate = useNavigate();
  const params = useParams();
  const [searchParams] = useSearchParams();
  // 兼容旧 query：/oee-history/detail?device=DEV-001&day=16
  const deviceId = params.deviceId || searchParams.get('device') || 'DEV-001';
  const queryDay = searchParams.get('day');

  const devices = useMemo(() => selectAllDevices(state), [state]);

  const dayOptions = useMemo(() => {
    const set = new Set([state.meta.demoDay]);
    Object.values(state.entities.oeeInputs.daily || {}).forEach(days => Object.keys(days || {}).forEach(d => set.add(d)));
    return [...set].sort();
  }, [state]);

  // 旧 query 传的是「几号」：映射到演示月份的完整日期
  const day = useMemo(() => {
    if (queryDay && /^\d{1,2}$/.test(queryDay)) return `${state.meta.demoDay.slice(0, 8)}${String(queryDay).padStart(2, '0')}`;
    return state.meta.demoDay;
  }, [queryDay, state.meta.demoDay]);

  const device = devices.find(d => d.deviceId === deviceId) || null;
  const result = useMemo(() => selectOeeResult(state, deviceId, { window: 'daily', day }), [state, deviceId, day]);
  const losses = useMemo(() => selectOeeLosses(state, deviceId, { window: 'daily', day }), [state, deviceId, day]);
  const mttrMtbf = useMemo(() => selectMttrMtbf(state, deviceId), [state, deviceId]);

  if (!device) {
    return (
      <>
        <PageHeader title="历史 OEE 详情" actions={<Button onClick={() => navigate('/oee-history')}>返回历史 OEE</Button>} />
        <Empty description={`未找到设备 ${deviceId}`} />
      </>
    );
  }

  const calc = [
    {
      key: 'availability', name: '可用率', value: result.availability,
      formula: `可用率 = 运行时间 / (负荷时间 − 计划停机时间) = ${result.runMinutes ?? '--'} / (${result.loadMinutes ?? '--'} − ${result.plannedDowntimeMinutes ?? '--'})`,
    },
    {
      key: 'performance', name: '性能率', value: result.performance,
      formula: `性能率 = 实际速度 / 理想速度 = ${speedText(result.actualSpeed)} / ${speedText(result.idealSpeed)}`,
    },
    {
      key: 'quality', name: '合格率', value: result.quality,
      formula: `合格率 = 良品 / 总产量 = ${result.qualified ?? '--'} / ${result.output ?? '--'}`,
    },
    {
      key: 'oee', name: 'OEE', value: result.oee,
      formula: `OEE = 可用率 × 性能率 × 合格率 = ${pctText(result.availability)} × ${pctText(result.performance)} × ${pctText(result.quality)}`,
    },
  ];

  const inputRows = [
    { key: 'load', label: '负荷时间', value: minutesText(result.loadMinutes) },
    { key: 'planned', label: '计划停机时间（计划停机 + 换模，已结束/进行中）', value: minutesText(result.plannedDowntimeMinutes) },
    { key: 'run', label: '运行时间', value: minutesText(result.runMinutes) },
    { key: 'material', label: '生产物料', value: result.materialCode || '--' },
    { key: 'idealSpeed', label: '理想生产速度（速度配置 SC）', value: speedText(result.idealSpeed) },
    { key: 'actualSpeed', label: '实际生产速度（产出 / 运行时间折算）', value: speedText(result.actualSpeed) },
    { key: 'output', label: '总产量', value: result.output ?? '--' },
    { key: 'qualified', label: '良品数量', value: result.qualified ?? '--' },
    { key: 'complete', label: '数据完整率', value: result.dataComplete || '--' },
  ];

  return (
    <>
      <DegradedBanner meta={state.meta} />
      <PageHeader
        title="历史 OEE 详情"
        subtitle={`${device.name}（${device.assetCode}）· ${day} · OEE = 可用率 × 性能率 × 合格率 · 计划停机只影响可用率分母`}
        actions={<Button onClick={() => navigate('/oee-history')}>返回历史 OEE</Button>}
      />
      {/* 筛选卡：设备 / 日期切换（规范 §1/§4） */}
      <Card size="small" style={{ marginBottom: 12 }}>
        <Space wrap>
          <Select
            value={deviceId} style={{ width: 220 }}
            onChange={(v) => navigate(`/oee-history/detail/${v}`)}
            options={devices.map(d => ({ value: d.deviceId, label: `${d.name}（${d.assetCode}）` }))}
          />
          <Select value={day} style={{ width: 140 }} onChange={(d) => navigate(`/oee-history/detail/${deviceId}`)} disabled={dayOptions.length <= 1} options={dayOptions.map(d => ({ value: d, label: d }))} />
          {result.dataStatus === '不可计算' && (
            <Tooltip title={blockersText(result)}>
              <Tag color="error">当日不可计算：{blockersText(result)}</Tag>
            </Tooltip>
          )}
        </Space>
      </Card>

      <Card size="small" title="当日输入项" style={{ marginBottom: 12 }}>
        <Table
          rowKey="key" size="small" pagination={false}
          dataSource={inputRows}
          columns={[
            { title: '输入项', dataIndex: 'label', width: 340 },
            { title: '数值', dataIndex: 'value', align: 'right' },
          ]}
        />
      </Card>

      <Card size="small" title="计算过程" style={{ marginBottom: 12 }}>
        <Table
          rowKey="key" size="small" pagination={false}
          dataSource={calc}
          columns={[
            { title: '指标', dataIndex: 'name', width: 110 },
            { title: '计算式', dataIndex: 'formula' },
            {
              title: '结果', dataIndex: 'value', width: 110, align: 'right',
              render: (v) => (v == null
                ? <Tooltip title={blockersText(result)}><span style={{ color: '#8a97a3' }}>--（不可计算）</span></Tooltip>
                : <span style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{v}%</span>),
            },
          ]}
        />
        {result.target != null && result.oee != null && (
          <div style={{ marginTop: 8 }}>
            目标对比：当日 OEE {result.oee}% / 目标 {result.target}% →
            <Tag color={result.oee >= result.target ? 'success' : 'warning'} style={{ marginLeft: 6 }}>
              {result.oee >= result.target ? '达标' : '未达标'}
            </Tag>
          </div>
        )}
      </Card>

      <Card size="small" title="损失分解（OEE 下钻）" style={{ marginBottom: 12 }}>
        {losses.length ? (
          <Table
            rowKey="rate" size="small" pagination={false}
            dataSource={losses}
            columns={[
              { title: '损失类别', dataIndex: 'rate', width: 110 },
              {
                title: '损失量', width: 140, align: 'right',
                render: (_, l) => (l.lossMinutes != null
                  ? `${l.lossMinutes} 分钟`
                  : l.lossPct != null ? `${l.lossPct}%` : '--'),
              },
              {
                title: '损失来源',
                render: (_, l) => (l.sources || []).map(s => `${s.type}：${s.category}`).join('；') || '--',
              },
            ]}
          />
        ) : (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="当日无可用率/性能率/合格率结果，无损失可分解（不可计算 ≠ 0 损失）" />
        )}
      </Card>

      <Card size="small" title="维修口径指标（MTTR / MTBF）">
        <Table
          rowKey="key" size="small" pagination={false}
          dataSource={[
            { key: 'mttr', label: 'MTTR（平均恢复时间：已完成维修工单 开始→验收 的均值）', value: minutesText(mttrMtbf.mttr) },
            { key: 'mtbf', label: 'MTBF（平均故障间隔：累计运行时间 / 已关闭故障事件数）', value: minutesText(mttrMtbf.mtbf) },
          ]}
          columns={[
            { title: '指标', dataIndex: 'label' },
            { title: '数值', dataIndex: 'value', width: 140, align: 'right' },
          ]}
        />
      </Card>
    </>
  );
}
