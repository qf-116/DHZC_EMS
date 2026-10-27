import React, { useMemo } from 'react';
import { Card, Descriptions, Table, Button, Tag, Tooltip } from 'antd';
import { ArrowLeft } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import PageHeader from '../components/PageHeader.jsx';
import DegradedBanner from '../components/DegradedBanner.jsx';
import StatusTag from '../components/StatusTag.jsx';
import EmptyState from '../components/EmptyState.jsx';
import { useDemoState } from '../state/DemoStore.jsx';
import { patrolStandards, patrolPlanDevices, patrolItems } from '../data/standardData.js';
import { crosswalkByAssetCode } from '../data/demo/deviceCrosswalk.js';

// 设备展示统一经 crosswalk canonical 映射（§3.1）：资产编码 → canonical 设备（deviceId/展示名）。
const canonDevice = (assetCode) => crosswalkByAssetCode[assetCode] || null;

function CanonicalDeviceCell({ code, seedName }) {
  const c = canonDevice(code);
  if (!c) return code || '--';
  return (
    <Tooltip title={`canonical 设备映射：${c.deviceId} · 台账设备名称：${seedName || '--'}`}>
      <span>{c.name}（{code}）</span>
    </Tooltip>
  );
}

// 巡检标准详情（范围外演示模块）：searchParams 读 id（兼容 code），无匹配显示「未找到对象」。
// 线路设备来自巡检线路设备快照并经 crosswalk canonical 映射；项目清单为巡检项目基础档案演示口径。
export default function PatrolStandardDetailPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const state = useDemoState();
  const meta = state.meta;
  const id = params.get('id') || params.get('code');

  const standard = useMemo(
    () => patrolStandards.find(s => s.code === id) || null,
    [id],
  );

  const lineDevices = useMemo(
    () => (standard ? patrolPlanDevices.filter(d => d.standard === standard.name) : []),
    [standard],
  );

  const items = useMemo(() => patrolItems.filter(i => i.status === '已启用'), []);

  if (!standard) {
    return (
      <>
        <PageHeader
          title="巡检标准详情"
          actions={<Button icon={<ArrowLeft size={14} />} onClick={() => navigate('/patrol-standards')}>返回列表</Button>}
        />
        <Card size="small">
          <EmptyState description={`未找到巡检标准${id ? `（${id}）` : ''}`} reason="标准编号无效或不存在该标准" />
        </Card>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title={`巡检标准详情 · ${standard.name}`}
        subtitle={`标准编号 ${standard.code} · 数据更新于 ${standard.updateTime || meta.updatedAt}`}
        actions={<Button icon={<ArrowLeft size={14} />} onClick={() => navigate('/patrol-standards')}>返回列表</Button>}
      />
      <DegradedBanner meta={meta} />
      <Card size="small" style={{ marginBottom: 12 }}>
        <Descriptions column={3} size="small">
          <Descriptions.Item label="标准编号">{standard.code}</Descriptions.Item>
          <Descriptions.Item label="标准名称">{standard.name}</Descriptions.Item>
          <Descriptions.Item label="巡检线路">{(standard.name || '').replace(/巡检标准$/, '')}</Descriptions.Item>
          <Descriptions.Item label="状态"><StatusTag value={standard.status} /></Descriptions.Item>
          <Descriptions.Item label="档案设备数">{standard.devices} 台</Descriptions.Item>
          <Descriptions.Item label="更新时间">{standard.updateTime || '--'}</Descriptions.Item>
          <Descriptions.Item label="备注" span={3}>{standard.remark || '--'}</Descriptions.Item>
        </Descriptions>
      </Card>
      <Card type="inner" size="small" title="巡检线路设备（canonical 映射）" style={{ marginBottom: 12 }}>
        <Table
          rowKey="code" size="small" pagination={false}
          dataSource={lineDevices}
          locale={{ emptyText: <EmptyState description="该标准暂无巡检线路设备" reason="暂无对应的设备行数据" /> }}
          columns={[
            { title: '设备编号', dataIndex: 'code', width: 130 },
            {
              title: '设备名称', width: 200,
              render: (_, r) => <CanonicalDeviceCell code={r.code} seedName={r.name} />,
            },
            { title: '规格型号', dataIndex: 'model', width: 100, render: v => v || '--' },
            { title: '设备类型', dataIndex: 'type', width: 110, render: v => v || '--' },
            { title: '所属部门', dataIndex: 'dept', width: 150, render: v => v || '--' },
            { title: '工位', dataIndex: 'station', width: 100, render: v => v || '--' },
            { title: '巡检项目数', dataIndex: 'itemCount', width: 100, align: 'center', render: v => (v != null ? `${v} 项` : '--') },
          ]}
        />
      </Card>
      <Card
        type="inner" size="small"
        title={<span>巡检项目清单</span>}
      >
        <Table
          rowKey="code" size="small" pagination={false}
          dataSource={items}
          locale={{ emptyText: <EmptyState description="暂无巡检项目" reason="暂无已启用的巡检项目" /> }}
          columns={[
            { title: '项目编号', dataIndex: 'code', width: 180 },
            { title: '项目名称', dataIndex: 'name', width: 150 },
            { title: '项目类型', dataIndex: 'type', width: 130, render: v => v || '--' },
            { title: '检查内容', dataIndex: 'content', ellipsis: true, render: v => v || '--' },
            {
              title: '判断结果类型', dataIndex: 'resultType', width: 120,
              render: (v, r) => <Tag color="processing">{v}{v === '单选' && r.options ? `：${r.options}` : ''}</Tag>,
            },
            { title: '正常范围', dataIndex: 'normalRange', width: 100, render: v => v || '--' },
            { title: '状态', dataIndex: 'status', width: 90, render: v => <StatusTag value={v} /> },
          ]}
        />
      </Card>
    </>
  );
}
