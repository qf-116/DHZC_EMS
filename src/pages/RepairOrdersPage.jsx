import React, { useMemo, useState } from 'react';
import { Card, Table, Tag, Button, Space, Input, Select, Tooltip } from 'antd';
import PageHeader from '../components/PageHeader.jsx';
import DegradedBanner from '../components/DegradedBanner.jsx';
import StatusTag from '../components/StatusTag.jsx';
import EmptyState from '../components/EmptyState.jsx';
import { useNavigate } from 'react-router-dom';
import { useDemoState } from '../state/DemoStore.jsx';
import { selectAllRepairOrders } from '../state/selectors.js';

const levelColor = { 紧急: 'red', 严重: 'orange', 一般: 'blue' };
const sourceLabel = { alarm: '报警转维修', report: '人工报修', 'alarm+report': '报警+报修' };

// 维修工单列表（store 驱动）：repairOrdersById 全量（报修与维修统一对象）。
// 行点击进入详情/验收页；「执行」进入执行页；「验收」进入验收页；来源报警链接到报警中心。
export default function RepairOrdersPage() {
  const navigate = useNavigate();
  const state = useDemoState();
  const meta = state.meta;

  const [kw, setKw] = useState('');
  const [status, setStatus] = useState(null);

  const orders = selectAllRepairOrders(state);
  const statusOptions = useMemo(
    () => [...new Set(orders.map(o => o.status))].map(v => ({ value: v, label: v })),
    [orders],
  );

  const list = orders
    .filter(o => !status || o.status === status)
    .filter(o => !kw || (o.code || '').includes(kw) || (o.deviceName || '').includes(kw) || (o.title || '').includes(kw) || (o.assignee || '').includes(kw));

  const canExecute = (o) => ['已派工', '维修中', '挂起'].includes(o.status);
  const canAccept = (o) => o.status === '待验收';

  return (
    <>
      <PageHeader
        title="维修任务"
      />
      <DegradedBanner meta={meta} />
      <Card size="small" style={{ marginBottom: 12 }}>
        <Space wrap>
          <Input.Search style={{ width: 240 }} placeholder="工单号 / 设备 / 故障名称 / 维修人" allowClear onSearch={setKw} onChange={e => { if (!e.target.value) setKw(''); }} />
          <Select style={{ width: 120 }} placeholder="状态" allowClear options={statusOptions} value={status} onChange={setStatus} />
          <Button type="primary" onClick={() => setKw(kw)}>查询</Button>
          <Button onClick={() => { setKw(''); setStatus(null); }}>重置</Button>
        </Space>
      </Card>
      <Card size="small">
        <Table
          rowKey="repairOrderId" size="small"
          dataSource={list}
          onRow={(r) => ({ onClick: () => navigate(`/repair-orders/${r.repairOrderId}`), style: { cursor: 'pointer' } })}
          locale={{ emptyText: <EmptyState description="暂无维修工单" reason={kw || status ? '当前筛选条件下没有维修工单' : '尚无维修工单：报修派工或报警转维修后生成'} /> }}
          columns={[
            { title: '工单号', dataIndex: 'code', width: 150, fixed: 'left' },
            { title: '设备', dataIndex: 'deviceName', width: 140, render: (v, r) => v || '--' },
            { title: '设备编号', dataIndex: 'deviceCode', width: 120, render: v => v || '--' },
            { title: '故障名称', dataIndex: 'title', width: 170, render: v => v || '--' },
            { title: '来源', dataIndex: 'source', width: 110, render: v => sourceLabel[v] || v || '--' },
            {
              title: '来源报警', dataIndex: 'alarmId', width: 150, render: (v) => (v
                ? <Tooltip title="点击前往报警中心查看该报警的完整处置链">
                    <a onClick={(e) => { e.stopPropagation(); navigate('/alarm-center'); }}>{v}</a>
                  </Tooltip>
                : '--'),
            },
            { title: '故障等级', dataIndex: 'level', width: 90, render: v => <Tag color={levelColor[v] || 'default'}>{v || '--'}</Tag> },
            { title: '状态', dataIndex: 'status', width: 100, render: v => <StatusTag value={v} /> },
            { title: '维修人', dataIndex: 'assignee', width: 90, render: (v, r) => (v ? `${r.assigneeGroup ? r.assigneeGroup + ' ' : ''}${v}` : '--') },
            {
              title: 'SLA', dataIndex: 'slaHours', width: 170, render: (v, r) => (v
                ? <Tooltip title={`SLA 时限 ${r.slaDueAt}`}>{v} 小时（{r.slaDueAt} 前）</Tooltip>
                : '--'),
            },
            { title: '创建时间', dataIndex: 'createdAt', width: 150, render: v => v || '--' },
            { title: '返修次数', dataIndex: 'reworkCount', width: 80, render: v => v || 0 },
            {
              title: '操作', width: 140, fixed: 'right',
              render: (_, r) => (
                <Space size={0} onClick={(e) => e.stopPropagation()}>
                  {canExecute(r) && <Button type="link" size="small" onClick={() => navigate(`/repair-orders/${r.repairOrderId}/execute`)}>执行</Button>}
                  {canAccept(r) && <Button type="link" size="small" onClick={() => navigate(`/repair-orders/${r.repairOrderId}/accept`)}>验收</Button>}
                  <Button type="link" size="small" onClick={() => navigate(`/repair-orders/${r.repairOrderId}`)}>详情</Button>
                </Space>
              ),
            },
          ]}
          scroll={{ x: 1700 }}
          pagination={{ pageSize: 10, showTotal: t => `共 ${t} 条` }}
        />
      </Card>
    </>
  );
}
