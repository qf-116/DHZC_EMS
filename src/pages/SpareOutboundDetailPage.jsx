import React from 'react';
import { Card, Descriptions, Table, Button, Empty } from 'antd';
import { ArrowLeft } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import PageHeader from '../components/PageHeader.jsx';
import DegradedBanner from '../components/DegradedBanner.jsx';
import EmptyState from '../components/EmptyState.jsx';
import { useDemoState } from '../state/DemoStore.jsx';

const dash = (v) => (v === null || v === undefined || v === '' ? '--' : v);

// 出库详情（只读，按单据编号查询 store 出库单 + 关联退库记录 + 库存流水；
// 无效单号显示「未找到对象」，不回退第一条）
export default function SpareOutboundDetailPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const state = useDemoState();
  const code = params.get('code');
  const detail = Object.values(state.entities.outboundsById).find(r => r.code === code) || null;

  if (!detail) {
    return (
      <>
        <PageHeader
          title="出库详情"
          actions={<Button icon={<ArrowLeft size={14} />} onClick={() => navigate('/spare-parts-outbound')}>返回列表</Button>}
        />
        <Card size="small">
          <EmptyState description={`未找到出库单${code ? `（${code}）` : ''}`} reason="单据编号无效或该出库单不存在" />
        </Card>
      </>
    );
  }

  // 关联退库记录与库存流水（ref = 出库单号 / 退库单号）
  const relatedReturns = Object.values(state.entities.returnsById)
    .filter(r => r.outboundId === detail.outboundId)
    .sort((a, b) => (a.createTime < b.createTime ? 1 : -1));
  const returnIds = new Set(relatedReturns.map(r => r.returnId));
  const flows = Object.values(state.entities.stockFlowsById)
    .filter(f => f.ref === detail.outboundId || returnIds.has(f.ref))
    .sort((a, b) => (a.time < b.time ? 1 : -1));

  return (
    <>
      <PageHeader
        title={`出库详情 · ${detail.code}`}
        actions={<Button icon={<ArrowLeft size={14} />} onClick={() => navigate('/spare-parts-outbound')}>返回列表</Button>}
      />
      <DegradedBanner meta={state.meta} />
      <Card size="small" style={{ marginBottom: 12 }}>
        <Descriptions column={3} size="small">
          <Descriptions.Item label="出库单据编号">{detail.code}</Descriptions.Item>
          <Descriptions.Item label="出库类型">{dash(detail.type)}</Descriptions.Item>
          <Descriptions.Item label="关联维修工单">{dash(detail.repairOrderId)}</Descriptions.Item>
          <Descriptions.Item label="出库仓库">{dash(detail.warehouseId)}</Descriptions.Item>
          <Descriptions.Item label="出库人">{dash(detail.person)}</Descriptions.Item>
          <Descriptions.Item label="出库日期">{dash(detail.date)}</Descriptions.Item>
          <Descriptions.Item label="创建人">{dash(detail.creator)}</Descriptions.Item>
          <Descriptions.Item label="创建时间">{dash(detail.createTime)}</Descriptions.Item>
        </Descriptions>
      </Card>
      <Card type="inner" size="small" title="出库备品备件" style={{ marginBottom: 12 }}>
        <Table
          rowKey={(r, i) => `${r.spareCode}-${i}`} size="small" pagination={false}
          dataSource={detail.items}
          columns={[
            { title: '备件编码', dataIndex: 'spareCode', width: 110 },
            { title: '备件名称', dataIndex: 'spareName', width: 140 },
            { title: '单位', dataIndex: 'unit', width: 70, render: v => dash(v) },
            { title: '出库数量', dataIndex: 'qty', width: 90 },
          ]}
        />
      </Card>
      <Card type="inner" size="small" title={detail.type === '维修出库' ? '出库说明' : '领用出库说明'} style={{ marginBottom: 12 }}>
        <div style={{ background: '#fafafa', border: '1px solid #f0f0f0', borderRadius: 4, padding: '8px 12px', minHeight: 56 }}>
          {dash(detail.remark)}
        </div>
      </Card>
      <Card type="inner" size="small" title="退库记录" style={{ marginBottom: 12 }}>
        {relatedReturns.length === 0 ? (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无退库记录" />
        ) : (
          <Table
            rowKey="returnId" size="small" pagination={false}
            dataSource={relatedReturns}
            columns={[
              { title: '退库单据编号', dataIndex: 'code', width: 160 },
              { title: '退库数量', dataIndex: 'qty', width: 90 },
              { title: '单位', dataIndex: 'unit', width: 70, render: v => dash(v) },
              { title: '退库原因', dataIndex: 'reason', width: 180, render: v => dash(v) },
              { title: '经办人', dataIndex: 'person', width: 90, render: v => dash(v) },
              { title: '退库时间', dataIndex: 'createTime', width: 170 },
            ]}
          />
        )}
      </Card>
      <Card type="inner" size="small" title="库存流水" style={{ marginBottom: 12 }}>
        {flows.length === 0 ? (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无关联库存流水" />
        ) : (
          <Table
            rowKey="flowId" size="small" pagination={false}
            dataSource={flows}
            columns={[
              { title: '时间', dataIndex: 'time', width: 170 },
              { title: '类型', dataIndex: 'type', width: 110 },
              { title: '数量变动', dataIndex: 'qty', width: 100, render: v => (v > 0 ? `+${v}` : `${v}`) },
              { title: '变动后结存', dataIndex: 'balanceAfter', width: 110, render: v => dash(v) },
              { title: '关联单据', dataIndex: 'ref', width: 160 },
              { title: '备注', dataIndex: 'note', ellipsis: true, render: v => dash(v) },
            ]}
          />
        )}
      </Card>
      <div style={{ textAlign: 'right' }}>
        <Button type="primary" onClick={() => navigate('/spare-parts-outbound')}>关闭</Button>
      </div>
    </>
  );
}
