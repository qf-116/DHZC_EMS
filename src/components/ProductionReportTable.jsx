import React, { useMemo } from 'react';
import { Table, Tag } from 'antd';

// 报工事件明细表（OEE 源数据）：逐条展示报工时间、物料、数量、是否合格与工单/来源。
// 数量默认 1 件/条；不合格由报工时的质量判定写入，不另行汇总。
export default function ProductionReportTable({ state, reports = [], pageSize = 10 }) {
  const materialNameOf = useMemo(
    () => Object.fromEntries((state.entities.materialPool || []).map((m) => [m.code, m.name])),
    [state],
  );
  const rows = useMemo(
    () => [...reports].sort((a, b) => (a.reportTime < b.reportTime ? 1 : -1)),
    [reports],
  );
  return (
    <Table
      rowKey="reportId"
      size="small"
      dataSource={rows}
      scroll={{ x: 1100 }}
      pagination={rows.length > pageSize ? { pageSize, size: 'small' } : false}
      locale={{ emptyText: '统计窗口内无报工记录' }}
      columns={[
        { title: '报工时间', dataIndex: 'reportTime', width: 170 },
        {
          title: '报工物料', dataIndex: 'materialCode', width: 220,
          render: (v) => `${materialNameOf[v] || '--'}（${v || '--'}）`,
        },
        { title: '数量', dataIndex: 'quantity', width: 80, align: 'center', render: (v) => `${v ?? '--'} 件` },
        {
          title: '是否合格', dataIndex: 'qualified', width: 90, align: 'center',
          render: (v) => <Tag color={v ? 'success' : 'error'}>{v ? '合格' : '不合格'}</Tag>,
        },
        { title: '报工工单', dataIndex: 'workOrderNo', width: 150, render: (v) => v || '--' },
        { title: '批次', dataIndex: 'batchNo', width: 120, render: (v) => v || '--' },
        { title: '物联网平台设备标识码', dataIndex: 'iotDeviceCode', width: 170 },
        { title: '接收时间', dataIndex: 'receivedAt', width: 170, render: (v) => v || '--' },
      ]}
    />
  );
}
