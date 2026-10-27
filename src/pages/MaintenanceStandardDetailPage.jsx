import React from 'react';
import { Card, Descriptions, Table, Button, Tag } from 'antd';
import { ArrowLeft } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import PageHeader from '../components/PageHeader.jsx';
import DegradedBanner from '../components/DegradedBanner.jsx';
import StatusTag from '../components/StatusTag.jsx';
import EmptyState from '../components/EmptyState.jsx';
import { useDemoState } from '../state/DemoStore.jsx';
import {
  maintenanceStandards,
  maintenanceStandardDevices,
  maintenanceStandardItemCodes,
  maintenanceItems,
} from '../data/standardData.js';
import { crosswalkByAssetCode } from '../data/demo/deviceCrosswalk.js';

const dash = (v) => (v === null || v === undefined || v === '' ? '--' : v);

// 设备展示统一经 crosswalk canonical 映射：assetCode → 展示名 / deviceId
function deviceOf(assetCode) {
  const cw = crosswalkByAssetCode[assetCode];
  return {
    code: assetCode,
    name: cw ? cw.name : assetCode,
    deviceId: cw ? cw.deviceId : null,
  };
}

// 标准关联的保养项目（种子仅提供「数控车床月度保养标准」的项目编号清单）
const CANONICAL_STANDARD_CODE = 'BYBZ20250301001';

// 保养标准详情（范围外演示模块，只读）：/maintenance-standards/detail?code=（兼容 ?id=）。
// 展示标准基本信息 + 关联设备（crosswalk canonical 映射）+ 关联保养项目。
export default function MaintenanceStandardDetailPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const state = useDemoState();
  const meta = state.meta;

  const code = params.get('code') || params.get('id');
  const standard = code ? maintenanceStandards.find(r => r.code === code) : null;

  if (!standard) {
    return (
      <>
        <PageHeader
          title="保养标准详情"
          actions={<Button icon={<ArrowLeft size={14} />} onClick={() => navigate('/maintenance-standards')}>返回列表</Button>}
        />
        <Card size="small">
          <EmptyState
            description={`未找到保养标准${code ? `（${code}）` : ''}`}
            reason="标准编号无效或该标准不存在（不回退展示其他标准）"
            next
            onNext={() => navigate('/maintenance-standards')}
            nextLabel="返回保养标准列表"
          />
        </Card>
      </>
    );
  }

  const isCanonical = standard.code === CANONICAL_STANDARD_CODE;
  const devices = isCanonical ? maintenanceStandardDevices : [];
  const items = isCanonical
    ? maintenanceStandardItemCodes.map(c => maintenanceItems.find(i => i.code === c)).filter(Boolean)
    : [];

  return (
    <>
      <PageHeader
        title={`保养标准详情 · ${standard.code}`}
        subtitle={`${standard.name}`}
        actions={<Button icon={<ArrowLeft size={14} />} onClick={() => navigate('/maintenance-standards')}>返回列表</Button>}
      />
      <DegradedBanner meta={meta} />
      <Card size="small" style={{ marginBottom: 12 }}>
        <Descriptions column={3} size="small" bordered>
          <Descriptions.Item label="标准编号">{standard.code}</Descriptions.Item>
          <Descriptions.Item label="标准名称">{dash(standard.name)}</Descriptions.Item>
          <Descriptions.Item label="状态"><StatusTag value={standard.status} /></Descriptions.Item>
          <Descriptions.Item label="关联设备数">{typeof standard.devices === 'number' ? `${standard.devices} 台` : '--'}</Descriptions.Item>
          <Descriptions.Item label="更新时间">{dash(standard.updateTime)}</Descriptions.Item>
          <Descriptions.Item label="数据基准">{meta.updatedAt}</Descriptions.Item>
          <Descriptions.Item label="备注" span={3}>{dash(standard.remark)}</Descriptions.Item>
        </Descriptions>
      </Card>

      <Card type="inner" size="small" title="关联设备" style={{ marginBottom: 12 }}>
        {devices.length ? (
          <Table
            rowKey="code" size="small" pagination={false}
            dataSource={devices}
            columns={[
              { title: '设备编号', dataIndex: 'code', width: 130, render: v => v || '--' },
              {
                title: '设备名称（canonical）', dataIndex: 'name', width: 220,
                render: (_, r) => {
                  const d = deviceOf(r.code);
                  return (
                    <span>
                      {d.name}（{d.code}）
                      {d.deviceId ? <Tag style={{ marginLeft: 6 }}>{d.deviceId}</Tag> : null}
                    </span>
                  );
                },
              },
              { title: '型号', dataIndex: 'model', width: 110, render: v => dash(v) },
              { title: '设备类型', dataIndex: 'type', width: 100, render: v => dash(v) },
              { title: '所属部门', dataIndex: 'dept', width: 170, render: v => dash(v) },
              { title: '工位', dataIndex: 'station', width: 100, render: v => dash(v) },
              { title: '台账状态', dataIndex: 'state', width: 100, render: v => <StatusTag value={v} tip="台账生命周期状态" /> },
            ]}
          />
        ) : (
          <EmptyState
            description="该标准暂无关联设备明细"
            reason="暂无关联设备数据"
          />
        )}
      </Card>

      <Card type="inner" size="small" title="关联保养项目" style={{ marginBottom: 12 }}>
        {items.length ? (
          <Table
            rowKey="code" size="small" pagination={false}
            dataSource={items}
            columns={[
              { title: '项目编号', dataIndex: 'code', width: 160 },
              { title: '项目名称', dataIndex: 'name', width: 180 },
              { title: '保养部位', dataIndex: 'part', width: 100, render: v => dash(v) },
              { title: '保养级别', dataIndex: 'level', width: 90, render: v => <Tag>{dash(v)}</Tag> },
              { title: '保养要求', dataIndex: 'require', width: 280, render: v => dash(v) },
              { title: '结果类型', dataIndex: 'resultType', width: 90, render: v => dash(v) },
            ]}
          />
        ) : (
          <EmptyState
            description="该标准暂无关联保养项目明细"
            reason="暂无关联保养项目数据"
          />
        )}
      </Card>
    </>
  );
}
