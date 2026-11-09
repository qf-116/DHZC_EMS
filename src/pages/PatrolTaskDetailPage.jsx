import React, { useMemo, useState } from 'react';
import { Card, Descriptions, Table, Button, Tag, Tooltip, Space, App } from 'antd';
import { ArrowLeft } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import PageHeader from '../components/PageHeader.jsx';
import DegradedBanner from '../components/DegradedBanner.jsx';
import StatusTag from '../components/StatusTag.jsx';
import EmptyState from '../components/EmptyState.jsx';
import PatrolSkipModal from '../components/PatrolSkipModal.jsx';
import { useDemoState } from '../state/DemoStore.jsx';
import { patrolTasks, patrolTaskDetails, patrolExecItems } from '../data/standardData.js';
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

// 巡检任务详情（范围外演示模块）：searchParams 读 id（兼容 code），无匹配显示「未找到对象」。
// 设备巡检明细来自 patrolTaskDetails 快照；巡检项结果表为 patrolExecItems 演示快照（首台已执行设备口径）。
export default function PatrolTaskDetailPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const state = useDemoState();
  const meta = state.meta;
  const id = params.get('id') || params.get('code');

  const task = useMemo(() => patrolTasks.find(t => t.code === id) || null, [id]);

  // 跳过巡检（页面内演示状态，不写入演示快照）：{ 设备编码: { reason, at } }
  const [skips, setSkips] = useState({});
  const [taskStatus, setTaskStatus] = useState(null);
  const [skipTarget, setSkipTarget] = useState(null);
  const { message } = App.useApp();

  const currentStatus = taskStatus || task?.status;
  const canExecute = task && ['未开始', '进行中', '已逾期'].includes(currentStatus);

  const handleSkip = (reason) => {
    if (!skipTarget) return;
    setSkips(prev => ({ ...prev, [skipTarget.code]: { reason, at: '' } }));
    // 原型规则：跳过巡检后该设备未检项按跳过处理，任务状态进入「进行中」
    if (currentStatus === '未开始') setTaskStatus('进行中');
    setSkipTarget(null);
    message.success(`设备「${skipTarget.name}」已跳过巡检，未检项按跳过处理`);
  };

  if (!task) {
    return (
      <>
        <PageHeader
          title="巡检任务详情"
          actions={<Button icon={<ArrowLeft size={14} />} onClick={() => navigate('/patrol-tasks')}>返回列表</Button>}
        />
        <Card size="small">
          <EmptyState description={`未找到巡检任务${id ? `（${id}）` : ''}`} reason="任务编号无效或不存在该任务" />
        </Card>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title={`巡检任务详情 · ${task.code}`}
        subtitle={`巡检线路（计划）：${task.plan || '--'} · 巡检日期 ${task.date || '--'} · 数据更新于 ${meta.updatedAt}`}
        actions={<>
          {canExecute && <Button type="primary" onClick={() => navigate(`/patrol-tasks/execute?id=${encodeURIComponent(task.code)}`)}>前往执行</Button>}
          <Button icon={<ArrowLeft size={14} />} onClick={() => navigate('/patrol-tasks')}>返回列表</Button>
        </>}
      />
      <DegradedBanner meta={meta} />
      <Card size="small" style={{ marginBottom: 12 }}>
        <Descriptions column={3} size="small">
          <Descriptions.Item label="任务编号">{task.code}</Descriptions.Item>
          <Descriptions.Item label="任务名称">{task.name}</Descriptions.Item>
          <Descriptions.Item label="状态"><StatusTag value={currentStatus} tip={task.status === '逾期完成' ? '超过计划完成时间后完成' : undefined} /></Descriptions.Item>
          <Descriptions.Item label="巡检线路（计划）">{task.plan || '--'}</Descriptions.Item>
          <Descriptions.Item label="巡检日期">{task.date || '--'}</Descriptions.Item>
          <Descriptions.Item label="应巡设备数">{task.shouldCount != null ? `${task.shouldCount} 台` : '--'}</Descriptions.Item>
          <Descriptions.Item label="执行人">{task.owner || '--'}</Descriptions.Item>
          <Descriptions.Item label="创建时间">{task.createTime || '--'}</Descriptions.Item>
        </Descriptions>
      </Card>
      <Card type="inner" size="small" title="设备巡检明细（canonical 映射）" style={{ marginBottom: 12 }}>
        <Table
          rowKey="code" size="small"
          dataSource={patrolTaskDetails}
          locale={{ emptyText: <EmptyState description="暂无设备巡检明细" reason="暂无对应的明细行数据" /> }}
          pagination={false}
          columns={[
            { title: '设备编号', dataIndex: 'code', width: 130, fixed: 'left' },
            { title: '设备名称', width: 200, render: (_, r) => <CanonicalDeviceCell code={r.code} seedName={r.name} /> },
            { title: '规格型号', dataIndex: 'model', width: 100, render: v => v || '--' },
            { title: '设备类型', dataIndex: 'type', width: 110, render: v => v || '--' },
            { title: '所属部门', dataIndex: 'dept', width: 150, render: v => v || '--' },
            { title: '工位', dataIndex: 'station', width: 100, render: v => v || '--' },
            { title: '巡检位置', dataIndex: 'location', width: 100, render: v => v || '--' },
            { title: '巡检项目数', dataIndex: 'itemCount', width: 100, align: 'center', render: v => (v != null ? `${v} 项` : '--') },
            { title: '巡检项目（示例）', dataIndex: 'itemNames', ellipsis: true, render: v => v || '--' },
            {
              title: '已检 / 未检', width: 110, align: 'center',
              render: (_, r) => (
                <span>
                  <Tag color={r.checked ? 'success' : 'default'}>{r.checked ?? 0}</Tag>
                  /
                  <Tag color={r.unchecked ? 'warning' : 'default'}>{r.unchecked ?? 0}</Tag>
                </span>
              ),
            },
            { title: '执行时间', dataIndex: 'execTime', width: 150, render: v => v || '--' },
            {
              title: '跳过原因', width: 220, ellipsis: true,
              render: (v, r) => {
                const reason = skips[r.code]?.reason || v;
                return reason
                  ? <Tooltip title={reason}><Tag color="orange">跳过</Tag></Tooltip>
                  : '--';
              },
            },
            {
              title: '操作', width: 110, fixed: 'right',
              render: (_, r) => (
                <Button type="link" size="small" onClick={() => setSkipTarget(r)}>跳过巡检</Button>
              ),
            },
          ]}
          scroll={{ x: 1540 }}
        />
      </Card>
      <Card type="inner" size="small" title={<span>巡检项结果表</span>}>
        <Table
          rowKey="code" size="small"
          dataSource={patrolExecItems}
          locale={{ emptyText: <EmptyState description="暂无巡检项结果" reason="暂无该任务的巡检项结果" /> }}
          pagination={false}
          columns={[
            { title: '项目编号', dataIndex: 'code', width: 120 },
            { title: '项目名称', dataIndex: 'name', width: 180 },
            { title: '项目类型', dataIndex: 'type', width: 130, render: v => v || '--' },
            { title: '检查内容', dataIndex: 'content', ellipsis: true, render: v => v || '--' },
            { title: '结果类型', dataIndex: 'resultType', width: 90, render: v => <Tag color="processing">{v}</Tag> },
            {
              title: '判定依据', width: 110,
              render: (_, r) => r.options || r.normalValue || '--',
            },
            { title: '结果', dataIndex: 'result', width: 150, render: v => (v ? <Tag color="success">{v}</Tag> : '--') },
            { title: '备注', dataIndex: 'remark', ellipsis: true, render: v => v || '--' },
          ]}
          scroll={{ x: 1100 }}
        />
      </Card>

      <PatrolSkipModal
        open={!!skipTarget}
        deviceLabel={skipTarget ? `${skipTarget.name}（${skipTarget.code}）` : ''}
        onCancel={() => setSkipTarget(null)}
        onConfirm={handleSkip}
      />
    </>
  );
}
