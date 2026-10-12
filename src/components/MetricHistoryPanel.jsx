import React, { useMemo, useState } from 'react';
import { Alert, Button, Card, DatePicker, Space, Table, Tooltip } from 'antd';
import dayjs from 'dayjs';
import { DEMO_TIME } from '../data/demo/samples.js';

// ============================================================
// 指标历史数据（设备台账详情栏目）：本台设备绑定指标的历史采样明细
// 供查询与追溯：按时间范围查询（精确到分钟，默认当天 00:00 ~ 当前），
// 全部指标按采集时间对齐在同一宽表，支持导出 CSV。
// 数据来源不限于 IoT（平台后续可扩展其他采集来源），故栏目不绑定 IOT 命名。
// 拉取模型：按绑定整体拉取——一次拉取覆盖全部来源设备与全部指标，
// 同一行共享采集时间 / 接收时间，延迟按拉取批次整体发生。
// 演示数据为确定性生成（1 分钟粒度，锚定实时样本当前值）。
// ============================================================

const QUALITY_COLOR = { GOOD: 'success', DELAYED: 'processing', NO_VALUE: 'warning', OFFLINE: 'error', BAD: 'error' };
const QUALITY_LABEL = { GOOD: '正常', DELAYED: '延迟', NO_VALUE: '无值', OFFLINE: '离线', BAD: '异常' };

const seedOf = (s) => [...s].reduce((acc, c) => acc + c.charCodeAt(0), 0);

// 拉取时间线：按设备 + 日期生成确定性的拉取批次（1 分钟粒度，秒数固定偏移）；
// 约 2% 批次整体延迟（接收时间晚 32s）
function buildPulls(deviceId, dateStr, lastMinute) {
  const seed = seedOf(`${deviceId}|${dateStr}`);
  const ss = String(seed % 55).padStart(2, '0');
  const pulls = [];
  for (let m = 0; m <= lastMinute; m += 1) {
    const hh = String(Math.floor(m / 60)).padStart(2, '0');
    const mm = String(m % 60).padStart(2, '0');
    const sourceTime = `${dateStr} ${hh}:${mm}:${ss}`;
    const delayed = (m * 7 + seed) % 100 >= 98;
    pulls.push({
      sourceTime,
      receiveTime: `${dateStr} ${hh}:${mm}:${String((Number(ss) + (delayed ? 32 : 2)) % 60).padStart(2, '0')}`,
      qualityCode: delayed ? 'DELAYED' : 'GOOD',
    });
  }
  return pulls;
}

export default function MetricHistoryPanel({ device, realtime, metricsByKey, referenceTime = DEMO_TIME }) {
  const reference = dayjs(referenceTime);
  const cutoff = reference.isValid() ? reference : dayjs(DEMO_TIME);
  const cutoffDay = cutoff.format('YYYY-MM-DD');
  const cutoffMinute = cutoff.hour() * 60 + cutoff.minute();
  const metricOptions = realtime.metrics || [];
  const [range, setRange] = useState(() => [cutoff.startOf('day'), cutoff]);
  const [applied, setApplied] = useState(() => ({ range: [cutoff.startOf('day'), cutoff] }));

  const precisionOf = (metricCode) => metricsByKey?.[metricCode]?.precision ?? 0.1;
  // 纳入宽表的指标：只有存在采样数据的指标才生成/展示（无数据不存储、不显示占位）；
  // 数据中断（OFFLINE/BAD）或当前无值（NO_VALUE）的指标无样本记录，直接排除
  const targets = metricOptions.filter(m =>
    m.value !== null && m.value !== undefined
    && m.qualityCode !== 'OFFLINE' && m.qualityCode !== 'BAD');
  const excludedCount = metricOptions.length - targets.length;

  // 宽表行：每个拉取时间点一行，一次拉取覆盖该绑定的全部来源设备与全部指标——
  // 时间线按设备（绑定）统一生成，所有指标在同一行对齐（与平台按绑定整体拉取的模型一致）；
  // 按查询范围（精确到分钟）截取批次
  const rows = useMemo(() => {
    if (!applied.range?.[0] || !applied.range?.[1] || targets.length === 0) return [];
    const start = applied.range[0];
    const end = applied.range[1];
    const out = [];
    let cur = start.startOf('day').valueOf();
    const endDay = end.startOf('day').valueOf();
    let guard = 0;
    while (cur <= endDay && guard < 31) {
      const dateStr = dayjs(cur).format('YYYY-MM-DD');
      const lastMinute = dateStr > cutoffDay ? -1 : dateStr === cutoffDay ? cutoffMinute : 24 * 60 - 1;
      for (const pull of buildPulls(device.deviceId, dateStr, lastMinute)) {
        if (pull.sourceTime >= start.format('YYYY-MM-DD HH:mm:ss') && pull.sourceTime <= `${end.format('YYYY-MM-DD HH:mm')}:59`) {
          const row = { key: pull.sourceTime, sourceTime: pull.sourceTime, qualityCode: pull.qualityCode, receiveTime: pull.receiveTime };
          for (const metricRow of targets) {
            const precision = precisionOf(metricRow.metricCode);
            const decimals = precision >= 1 ? 0 : (precision === 0.1 ? 1 : 2);
            if (typeof metricRow.value === 'number') {
              const minute = Number(pull.sourceTime.slice(11, 13)) * 60 + Number(pull.sourceTime.slice(14, 16));
              const seed = seedOf(`${metricRow.iotDeviceCode || ''}${metricRow.metricCode}`);
              const wobble = Math.sin((minute + seed % 13) / 9) * 0.012 + Math.sin((minute + seed % 29) / 33) * 0.02;
              row[metricRow.metricCode] = (metricRow.value * (1 + wobble)).toFixed(decimals);
            } else {
              row[metricRow.metricCode] = metricRow.value; // 状态/事件类指标（S.*）原样展示
            }
          }
          out.push(row);
        }
      }
      cur = dayjs(cur).add(1, 'day').valueOf();
      guard += 1;
    }
    return out;
  }, [applied, targets, device.deviceId, cutoffDay, cutoffMinute]);

  const handleQuery = () => setApplied({ range: range && range.length === 2 ? [range[0], range[1]] : null });
  const handleReset = () => {
    setRange([cutoff.startOf('day'), cutoff]);
    setApplied({ range: [cutoff.startOf('day'), cutoff] });
  };

  const handleExport = () => {
    const header = ['采集时间', ...targets.map(m => `${m.name}（${m.unit}）`)];
    const lines = rows.map(r => [r.sourceTime, ...targets.map(m => r[m.metricCode] ?? '')].join(','));
    const csv = '﻿' + [header.join(','), ...lines].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${device.assetCode}-指标历史数据_${applied.range[0].format('YYYYMMDD_HHmm')}_${applied.range[1].format('YYYYMMDD_HHmm')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (metricOptions.length === 0) {
    return (
      <Alert
        type="info" showIcon
        message="该设备绑定的来源中没有启用的监测指标，暂无指标历史数据。"
      />
    );
  }

  // 指标列：表头两行（指标名 + 编码/单位），单元格按质量码着色，悬停看质量码与接收时间
  // 注意：dataIndex 不用指标编码原文（含 `.` 会被 antd 当嵌套路径解析导致取值失败），改由 render 直接读行数据
  const metricColumns = targets.map((m) => ({
    key: m.metricCode,
    title: (
      <div style={{ textAlign: 'right', lineHeight: 1.3 }}>
        <div>{m.name}</div>
        <div style={{ fontWeight: 400, color: '#8a97a3', fontSize: 11 }}>{m.metricCode} · {m.unit}</div>
      </div>
    ),
    width: 130,
    align: 'right',
    render: (_, r) => {
      const v = r[m.metricCode];
      const q = r.qualityCode;
      const label = QUALITY_LABEL[q] || q;
      if (v === null || v === undefined) {
        return <Tooltip title={`质量码：${label}；接收时间：${r.receiveTime}`}><span style={{ color: '#b8c2cc' }}>--</span></Tooltip>;
      }
      const content = <strong style={q === 'DELAYED' ? { color: '#d97706' } : undefined}>{v}</strong>;
      return q === 'GOOD'
        ? content
        : <Tooltip title={`质量码：${label}；接收时间：${r.receiveTime}`}>{content}</Tooltip>;
    },
  }));

  return (
    <Card
      size="small"
      title="指标历史数据"
      extra={<Button size="small" disabled={!rows.length} onClick={handleExport}>导出</Button>}
    >
      <Space wrap style={{ marginBottom: 12 }}>
        <span>时间范围：</span>
        <DatePicker.RangePicker
          value={range}
          onChange={setRange}
          allowClear={false}
          showTime={{ format: 'HH:mm' }}
          format="YYYY-MM-DD HH:mm"
        />
        <Button type="primary" onClick={handleQuery}>查询</Button>
        <Button onClick={handleReset}>重置</Button>
      </Space>
      <Alert
        type="info" showIcon
        message={targets.length === 0
          ? '该设备绑定的指标当前无采样数据（设备离线或未上报）：无数据不存储、不生成空记录；恢复上报后历史数据将在此展示。'
          : `查询范围：${applied.range[0].format('YYYY-MM-DD HH:mm')} 至 ${applied.range[1].format('YYYY-MM-DD HH:mm')}，共 ${rows.length} 个拉取时间点，按采集时间升序排列。按绑定整体拉取：一次拉取覆盖全部来源设备的全部指标，同行采集时间一致；约 2% 批次延迟（橙色，悬停看接收时间）。${excludedCount > 0 ? `另有 ${excludedCount} 个指标无采样数据（离线 / 无值），未存储记录、不列入展示。` : ''}`}
      />
      <Table
        rowKey="key" size="small" style={{ marginTop: 12 }}
        dataSource={rows}
        locale={{ emptyText: '所选时间范围内无采样记录（无数据不存储、不生成空记录）' }}
        pagination={{ pageSize: 20, showSizeChanger: true, pageSizeOptions: [20, 50, 100], showTotal: t => `共 ${t} 条` }}
        scroll={targets.length > 4 ? { x: 150 + targets.length * 130 } : undefined}
        columns={[
          { title: '采集时间', dataIndex: 'sourceTime', width: 150, fixed: targets.length > 4 ? 'left' : undefined, sorter: (a, b) => a.sourceTime.localeCompare(b.sourceTime) },
          ...metricColumns,
        ]}
      />
    </Card>
  );
}
