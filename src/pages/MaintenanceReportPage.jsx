import React, { useMemo, useState } from 'react';
import { Card, Table, Tabs, Button, Tooltip, Typography, Modal, Space, Tag, DatePicker } from 'antd';
import dayjs from 'dayjs';
import { Download } from 'lucide-react';
import PageHeader from '../components/PageHeader.jsx';
import DegradedBanner from '../components/DegradedBanner.jsx';
import EmptyState from '../components/EmptyState.jsx';
import { useDemoState } from '../state/DemoStore.jsx';
import {
  maintenanceTasks,
  maintenanceTaskDetails,
  ledgerDevices,
} from '../data/standardData.js';
import { crosswalkByAssetCode } from '../data/demo/deviceCrosswalk.js';

const dash = (v) => (v === null || v === undefined || v === '' ? '--' : v);
const { RangePicker } = DatePicker;

function parseAssetCode(deviceStr) {
  const m = String(deviceStr || '').match(/MT\d{4}A\d+/);
  return m ? m[0] : null;
}

const pct = (done, total) => (total > 0 ? `${Math.round((done / total) * 100)}%` : '--');

// 口径说明（种子推导，不伪造）：
// - 计划完成率 = 已完成任务数 / 任务总数（不含已关闭）
// - 异常率 = 任务明细未执行保养项目数 / 保养项目总数（仅设备维度有种子明细；执行人维度种子未提供 → --）
// - 工时合计 = 种子数据未包含工时字段 → 一律显示 --（0 与无数据严格区分）
const taskCount = (tasks, status) => tasks.filter(t => t.status === status).length;

// 保养执行统计报表（范围外演示模块）：按设备 / 执行人聚合只读种子 maintenanceTasks。
// 导出为演示占位，不生成真实文件。
export default function MaintenanceReportPage() {
  const state = useDemoState();
  const meta = state.meta;
  const [exportOpen, setExportOpen] = useState(false);

  // 统计日期范围筛选：未选范围时不过滤；选了范围后缺日期的行排除
  const [range, setRange] = useState(null);
  const inRange = (d) => {
    if (!range || !range[0] || !range[1]) return true;
    if (!d) return false;
    const s = String(d).slice(0, 10);
    return s >= range[0].format('YYYY-MM-DD') && s <= range[1].format('YYYY-MM-DD');
  };
  // 任务行按计划日期 date 过滤；设备明细行按执行时间 execTime 过滤
  const tasks = useMemo(() => maintenanceTasks.filter(t => inRange(t.date)), [range]); // eslint-disable-line react-hooks/exhaustive-deps
  const details = useMemo(() => maintenanceTaskDetails.filter(d => inRange(d.execTime)), [range]); // eslint-disable-line react-hooks/exhaustive-deps

  const deviceRows = useMemo(() => {
    const byDevice = new Map();
    tasks.forEach((t) => {
      const assetCode = parseAssetCode(t.device);
      const key = assetCode || t.device || '--';
      if (!byDevice.has(key)) byDevice.set(key, []);
      byDevice.get(key).push(t);
    });
    return [...byDevice.entries()].map(([assetCode, tasks]) => {
      const cw = crosswalkByAssetCode[assetCode];
      const ledger = ledgerDevices.find(d => d.code === assetCode);
      const detailRows = details.filter(d => d.code === assetCode);
      const itemTotal = detailRows.reduce((s, d) => {
        const n = typeof d.itemCount === 'string' ? parseInt(d.itemCount, 10) : d.itemCount;
        return s + (Number.isFinite(n) ? n : 0);
      }, 0);
      const unchecked = detailRows.reduce((s, d) => s + (d.unchecked || 0), 0);
      const total = tasks.length;
      const closed = taskCount(tasks, '已关闭');
      const done = taskCount(tasks, '已完成');
      return {
        key: assetCode,
        assetCode,
        deviceName: cw ? cw.name : assetCode,
        deviceId: cw ? cw.deviceId : null,
        dept: ledger?.dept || '--',
        total,
        done,
        closed,
        rate: pct(done, total - closed),
        abnormalRate: itemTotal > 0 ? pct(unchecked, itemTotal) : '--',
        abnormalTip: itemTotal > 0
          ? `未执行 ${unchecked} 项 / 共 ${itemTotal} 项`
          : '暂无该设备的保养项目明细数据',
        hours: '--',
      };
    }).sort((a, b) => b.total - a.total);
  }, [tasks, details]);

  const ownerRows = useMemo(() => {
    const byOwner = new Map();
    tasks.forEach((t) => {
      const key = t.owner || '--';
      if (!byOwner.has(key)) byOwner.set(key, []);
      byOwner.get(key).push(t);
    });
    return [...byOwner.entries()].map(([owner, tasks]) => {
      const total = tasks.length;
      const closed = taskCount(tasks, '已关闭');
      const done = taskCount(tasks, '已完成');
      return {
        key: owner,
        owner,
        total,
        done,
        closed,
        rate: pct(done, total - closed),
        abnormalRate: '--',
        hours: '--',
      };
    }).sort((a, b) => b.total - a.total);
  }, [tasks]);

  const totals = useMemo(() => {
    const total = tasks.length;
    const done = taskCount(tasks, '已完成');
    const closed = taskCount(tasks, '已关闭');
    return { total, done, closed, rate: pct(done, total - closed) };
  }, [tasks]);

  const deviceColumns = [
    { title: '设备编号', dataIndex: 'assetCode', width: 130 },
    {
      title: '设备名称（canonical）', dataIndex: 'deviceName', width: 200,
      render: (v, r) => (
        <span>{v}{r.deviceId ? <Tag style={{ marginLeft: 6 }}>{r.deviceId}</Tag> : null}</span>
      ),
    },
    { title: '所属部门', dataIndex: 'dept', width: 160, render: v => dash(v) },
    { title: '任务总数', dataIndex: 'total', width: 90 },
    { title: '已完成', dataIndex: 'done', width: 80 },
    { title: '已关闭', dataIndex: 'closed', width: 80 },
    {
      title: '计划完成率', dataIndex: 'rate', width: 100,
      render: (v) => <Typography.Text strong={v !== '--'}>{v}</Typography.Text>,
    },
    {
      title: '异常率', dataIndex: 'abnormalRate', width: 100,
      render: (v, r) => (v === '--' ? <Tooltip title={r.abnormalTip}>--</Tooltip> : <Tooltip title={r.abnormalTip}><Typography.Text type="warning">{v}</Typography.Text></Tooltip>),
    },
    {
      title: '工时合计（小时）', dataIndex: 'hours', width: 120,
      render: (v) => <Tooltip title="暂无工时数据">--</Tooltip>,
    },
  ];

  const ownerColumns = [
    { title: '执行人', dataIndex: 'owner', width: 160 },
    { title: '任务总数', dataIndex: 'total', width: 90 },
    { title: '已完成', dataIndex: 'done', width: 80 },
    { title: '已关闭', dataIndex: 'closed', width: 80 },
    { title: '计划完成率', dataIndex: 'rate', width: 100, render: v => <Typography.Text strong={v !== '--'}>{v}</Typography.Text> },
    {
      title: '异常率', dataIndex: 'abnormalRate', width: 100,
      render: (v) => <Tooltip title="暂无该执行人的保养项目明细数据，无法计算异常率">--</Tooltip>,
    },
    {
      title: '工时合计（小时）', dataIndex: 'hours', width: 120,
      render: (v) => <Tooltip title="暂无工时数据">--</Tooltip>,
    },
  ];

  return (
    <>
      <PageHeader
        title="保养执行统计"
        subtitle={`共 ${maintenanceTasks.length} 条保养任务 · 数据基准 ${meta.updatedAt || '--'}`}
      />
      <DegradedBanner meta={meta} />

      <Card size="small" style={{ marginBottom: 12 }}>
        <Space size={32} wrap>
          <RangePicker
            style={{ width: 250 }} allowClear
            value={range} onChange={setRange}
            presets={[
              { label: '最近7天', value: [dayjs().subtract(6, 'day'), dayjs()] },
              { label: '最近30天', value: [dayjs().subtract(29, 'day'), dayjs()] },
            ]}
            placeholder={['开始日期', '结束日期']}
          />
          <Typography.Text>任务总数：<strong>{totals.total}</strong></Typography.Text>
          <Typography.Text>已完成：<strong>{totals.done}</strong></Typography.Text>
          <Typography.Text>已关闭：<strong>{totals.closed}</strong></Typography.Text>
          <Typography.Text>整体计划完成率：<strong>{totals.rate}</strong></Typography.Text>
          <Button onClick={() => setRange(null)}>重置</Button>
        </Space>
      </Card>

      <Card size="small">
        <Space wrap style={{ marginBottom: 12 }}>
          <Button icon={<Download size={14} />} onClick={() => setExportOpen(true)}>导出</Button>
        </Space>
        <Tabs
          defaultActiveKey="device"
          size="small"
          items={[
            {
              key: 'device',
              label: '按设备聚合',
              children: (
                <Table
                  rowKey="key" size="small"
                  dataSource={deviceRows}
                  columns={deviceColumns}
                  pagination={false}
                  locale={{ emptyText: <EmptyState description="暂无保养任务" reason="暂无保养任务数据" /> }}
                />
              ),
            },
            {
              key: 'owner',
              label: '按执行人聚合',
              children: (
                <Table
                  rowKey="key" size="small"
                  dataSource={ownerRows}
                  columns={ownerColumns}
                  pagination={false}
                  locale={{ emptyText: <EmptyState description="暂无保养任务" reason="暂无保养任务数据" /> }}
                />
              ),
            },
          ]}
        />
      </Card>

      <Modal
        title="导出保养执行统计"
        width={480}
        open={exportOpen}
        onCancel={() => setExportOpen(false)}
        footer={<Button type="primary" onClick={() => setExportOpen(false)}>知道了</Button>}
      >
        <Space direction="vertical" size={8}>
          <Typography.Text>
            导出内容：按设备 / 执行人聚合的保养执行统计报表（含计划完成率与异常率明细）。
          </Typography.Text>
        </Space>
      </Modal>
    </>
  );
}
