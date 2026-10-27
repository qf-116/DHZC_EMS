import React from 'react';
import { Card, Descriptions, Table, Button, Space, Tag } from 'antd';
import { ArrowLeft } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import PageHeader from '../components/PageHeader.jsx';
import DegradedBanner from '../components/DegradedBanner.jsx';
import StatusTag from '../components/StatusTag.jsx';
import EmptyState from '../components/EmptyState.jsx';
import { useDemoState } from '../state/DemoStore.jsx';
import {
  inspectionStandards, inspectionStandardDevices, inspectionStandardItemCodes, inspectionItems,
} from '../data/standardData.js';
import { crosswalkByAssetCode } from '../data/demo/deviceCrosswalk.js';

// 设备展示统一经 canonical 设备映射（crosswalk）：名称 + MT 资产编号；种子里的旧编码仅作关联键。
const canonOf = (assetCode) => crosswalkByAssetCode[assetCode] || null;
const deviceLabel = (assetCode) => {
  const c = canonOf(assetCode);
  return c ? `${c.name}（${c.assetCode}）` : (assetCode || '--');
};

// 点检标准详情（范围外演示模块）：/inspection-standards/detail（query 兼容 id/code）。
// 展示标准基本信息 + 关联设备（经 crosswalk 显示 canonical 名称/资产编号）+ 关联项目表。
export default function InspectionStandardDetailPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const state = useDemoState();
  const meta = state.meta;

  const codeOrId = params.get('code') || params.get('id');
  const standard = codeOrId
    ? inspectionStandards.find(s => s.code === codeOrId || s.code === decodeURIComponent(codeOrId) || s.name === codeOrId)
    : null;

  if (!codeOrId || !standard) {
    return (
      <>
        <PageHeader title="点检标准详情" subtitle={codeOrId ? `标准：${codeOrId}` : '未指定标准'}
          actions={<Space><Button icon={<ArrowLeft size={14} />} onClick={() => navigate('/inspection-standards')}>返回列表</Button></Space>} />
        <DegradedBanner meta={meta} />
        <Card size="small">
          <EmptyState
            description={`未找到点检标准${codeOrId ? `「${codeOrId}」` : ''}`}
            reason="编号无效或系统中不存在该标准"
            next
            onNext={() => navigate('/inspection-standards')}
            nextLabel="返回点检标准列表"
          />
        </Card>
      </>
    );
  }

  const items = inspectionItems.filter(i => inspectionStandardItemCodes.includes(i.code));

  return (
    <>
      <PageHeader
        title="点检标准详情"
        subtitle={`标准：${standard.code} · ${standard.name} · 数据更新于 ${meta.demoDay}`}
        actions={<Space><Button icon={<ArrowLeft size={14} />} onClick={() => navigate('/inspection-standards')}>返回列表</Button></Space>}
      />
      <DegradedBanner meta={meta} />

      <Card size="small" style={{ marginBottom: 12 }}>
        <div style={{ fontWeight: 600, marginBottom: 12 }}>标准信息</div>
        <Descriptions column={2} size="small" bordered>
          <Descriptions.Item label="标准编号">{standard.code}</Descriptions.Item>
          <Descriptions.Item label="标准名称">{standard.name}</Descriptions.Item>
          <Descriptions.Item label="状态"><StatusTag value={standard.status} /></Descriptions.Item>
          <Descriptions.Item label="更新时间">{standard.updateTime || '--'}</Descriptions.Item>
          <Descriptions.Item label="备注" span={2}>{standard.remark || '--'}</Descriptions.Item>
        </Descriptions>
      </Card>

      <Card size="small" style={{ marginBottom: 12 }}>
        <div style={{ fontWeight: 600, marginBottom: 12 }}>关联设备（{inspectionStandardDevices.length} 台）</div>
        <Table
          rowKey="code" size="small" pagination={false}
          dataSource={inspectionStandardDevices}
          locale={{ emptyText: <EmptyState description="暂无关联设备" reason="该标准尚未关联设备" /> }}
          columns={[
            { title: '设备名称（canonical）', dataIndex: 'code', width: 220, render: (code) => {
              const c = canonOf(code);
              return c ? <Space size={6}>{c.name}<Tag>{c.assetCode}</Tag></Space> : (code || '--');
            } },
            { title: '资产编号', dataIndex: 'code', width: 130 },
            { title: '规格型号', dataIndex: 'model', width: 110, render: v => v || '--' },
            { title: '设备类型', dataIndex: 'type', width: 110, render: v => v || '--' },
            { title: '部门/产线', dataIndex: 'dept', width: 170, render: v => v || '--' },
            { title: '工位', dataIndex: 'station', width: 100, render: v => v || '--' },
          ]}
        />
      </Card>

      <Card size="small">
        <div style={{ fontWeight: 600, marginBottom: 12 }}>关联点检项目（{items.length} 项）</div>
        <Table
          rowKey="code" size="small" pagination={false}
          dataSource={items}
          locale={{ emptyText: <EmptyState description="暂无关联点检项目" reason="该标准尚未关联点检项目" /> }}
          columns={[
            { title: '项目编号', dataIndex: 'code', width: 170 },
            { title: '项目名称', dataIndex: 'name', width: 180 },
            { title: '检查类型', dataIndex: 'type', width: 130 },
            { title: '项目内容', dataIndex: 'content', ellipsis: true },
            { title: '判断结果', dataIndex: 'resultType', width: 90, render: (v, r) => (
              <Space size={4}><Tag>{v || '--'}</Tag>{v === '单选' && r.options ? <span style={{ fontSize: 12, color: '#8a97a3' }}>{r.options}</span> : null}</Space>
            ) },
            { title: '正常基准', dataIndex: 'normalValue', width: 130, render: v => v || '--' },
            { title: '状态', dataIndex: 'status', width: 90, render: v => <StatusTag value={v} /> },
          ]}
        />
      </Card>
    </>
  );
}
