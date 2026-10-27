import React from 'react';
import { Card, Descriptions, Table, Button } from 'antd';
import { ArrowLeft } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import PageHeader from '../components/PageHeader.jsx';
import DegradedBanner from '../components/DegradedBanner.jsx';
import EmptyState from '../components/EmptyState.jsx';
import { useDemoState } from '../state/DemoStore.jsx';

const dash = (v) => (v === null || v === undefined || v === '' ? '--' : v);

// 入库详情（只读，按单据编号查询 store 入库记录；无效单号显示「未找到对象」，不回退第一条）
export default function SpareInboundDetailPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const state = useDemoState();
  const code = params.get('code');
  const detail = Object.values(state.entities.inboundsById).find(r => r.code === code) || null;

  if (!detail) {
    return (
      <>
        <PageHeader
          title="入库详情"
          actions={<Button icon={<ArrowLeft size={14} />} onClick={() => navigate('/spare-parts-inbound')}>返回列表</Button>}
        />
        <Card size="small">
          <EmptyState description={`未找到入库单${code ? `（${code}）` : ''}`} reason="单据编号无效或该入库单不存在" />
        </Card>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title={`入库详情 · ${detail.code}`}
        actions={<Button icon={<ArrowLeft size={14} />} onClick={() => navigate('/spare-parts-inbound')}>返回列表</Button>}
      />
      <DegradedBanner meta={state.meta} />
      <Card size="small" style={{ marginBottom: 12 }}>
        <Descriptions column={3} size="small">
          <Descriptions.Item label="入库单据编号">{detail.code}</Descriptions.Item>
          <Descriptions.Item label="供应商">{dash(detail.supplier)}</Descriptions.Item>
          <Descriptions.Item label="采购人">{dash(detail.buyer)}</Descriptions.Item>
          <Descriptions.Item label="入库日期">{dash(detail.date)}</Descriptions.Item>
          <Descriptions.Item label="创建人">{dash(detail.creator)}</Descriptions.Item>
          <Descriptions.Item label="创建时间">{dash(detail.createTime)}</Descriptions.Item>
        </Descriptions>
      </Card>
      <Card type="inner" size="small" title="入库备品备件" style={{ marginBottom: 12 }}>
        <Table
          rowKey={(r, i) => `${r.spareCode}-${r.warehouseId}-${i}`} size="small" pagination={false}
          dataSource={detail.items}
          columns={[
            { title: '备件编码', dataIndex: 'spareCode', width: 110 },
            { title: '备件名称', dataIndex: 'spareName', width: 140 },
            { title: '单位', dataIndex: 'unit', width: 70, render: v => dash(v) },
            { title: '入库仓库', dataIndex: 'warehouseId', width: 130 },
            { title: '入库数量', dataIndex: 'qty', width: 90 },
          ]}
        />
      </Card>
      <Card type="inner" size="small" title="入库说明" style={{ marginBottom: 12 }}>
        <div style={{ background: '#fafafa', border: '1px solid #f0f0f0', borderRadius: 4, padding: '8px 12px', minHeight: 56 }}>
          {dash(detail.remark)}
        </div>
      </Card>
      <div style={{ textAlign: 'right' }}>
        <Button type="primary" onClick={() => navigate('/spare-parts-inbound')}>关闭</Button>
      </div>
    </>
  );
}
