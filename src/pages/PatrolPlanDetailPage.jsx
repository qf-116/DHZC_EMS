import React, { useMemo, useState } from 'react';
import { Card, Descriptions, Table, Button, Tooltip, Space, Modal, Form, Input, App } from 'antd';
import { ArrowLeft } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import PageHeader from '../components/PageHeader.jsx';
import DegradedBanner from '../components/DegradedBanner.jsx';
import StatusTag from '../components/StatusTag.jsx';
import EmptyState from '../components/EmptyState.jsx';
import { useDemoState } from '../state/DemoStore.jsx';
import { patrolPlans, patrolPlanDevices, patrolTasks } from '../data/standardData.js';
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

// 巡检计划详情（范围外演示模块）：searchParams 读 id（兼容 code），无匹配显示「未找到对象」。
// 上半部分为计划信息与巡检线路设备（patrolPlanDevices 快照），下半部分为该计划的关联巡检任务。
export default function PatrolPlanDetailPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { message } = App.useApp();
  const state = useDemoState();
  const meta = state.meta;
  const id = params.get('id') || params.get('code');

  // 「编辑」为页面内演示交互（不写入 DemoStore，刷新后恢复快照）
  const [editOpen, setEditOpen] = useState(false);
  const [form] = Form.useForm();
  const [patch, setPatch] = useState({});

  const plan = useMemo(() => patrolPlans.find(p => p.code === id) || null, [id]);
  const planView = plan ? { ...plan, ...patch } : null;

  const lineDevices = useMemo(
    () => (plan ? patrolPlanDevices.filter(d => d.standard === plan.name.replace(/巡检计划$/, '巡检标准')) : []),
    [plan],
  );

  const tasks = useMemo(
    () => (plan
      ? patrolTasks
        .filter(t => t.plan === plan.name)
        .slice()
        .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
      : []),
    [plan],
  );

  if (!plan) {
    return (
      <>
        <PageHeader
          title="巡检计划详情"
          actions={<Button icon={<ArrowLeft size={14} />} onClick={() => navigate('/patrol-plans')}>返回列表</Button>}
        />
        <Card size="small">
          <EmptyState description={`未找到巡检计划${id ? `（${id}）` : ''}`} reason="计划编号无效或不存在该计划" />
        </Card>
      </>
    );
  }

  const progress = plan.totalTasks ? Math.round((plan.doneTasks || 0) / plan.totalTasks * 100) : 0;

  const openEdit = () => {
    form.resetFields();
    form.setFieldsValue({ name: planView.name, owner: planView.owner, remark: planView.remark });
    setEditOpen(true);
  };
  const handleEdit = async () => {
    const values = await form.validateFields();
    setPatch(prev => ({ ...prev, ...values }));
    setEditOpen(false);
    message.success('计划信息已保存，变更将直接更新到今天及后续按计划生成的巡检任务');
  };

  return (
    <>
      <PageHeader
        title={`巡检计划详情 · ${planView.name}`}
        subtitle={`计划编号 ${plan.code} · 数据更新于 ${meta.updatedAt}`}
        actions={(
          <Space>
            <Button icon={<ArrowLeft size={14} />} onClick={() => navigate('/patrol-plans')}>返回列表</Button>
            <Button type="primary" onClick={openEdit}>编辑</Button>
          </Space>
        )}
      />
      <DegradedBanner meta={meta} />
      <Card size="small" style={{ marginBottom: 12 }}>
        <Descriptions column={3} size="small">
          <Descriptions.Item label="计划编号">{plan.code}</Descriptions.Item>
          <Descriptions.Item label="计划名称（巡检线路）">{planView.name}</Descriptions.Item>
          <Descriptions.Item label="状态"><StatusTag value={plan.status} tip={planView.remark} /></Descriptions.Item>
          <Descriptions.Item label="巡检周期">
            {plan.cycle || '--'}{plan.interval ? ` · 每 ${plan.interval} 个周期` : ''}{plan.skip ? ` · ${plan.skip}` : ''}
          </Descriptions.Item>
          <Descriptions.Item label="起止时间">{plan.startDate || '--'} ~ {plan.endDate || '--'}</Descriptions.Item>
          <Descriptions.Item label="负责人">{planView.owner || '--'}</Descriptions.Item>
          <Descriptions.Item label="线路设备数">{plan.deviceCount} 台</Descriptions.Item>
          <Descriptions.Item label="执行进度">{plan.doneTasks ?? '--'} / {plan.totalTasks ?? '--'}（{progress}%）</Descriptions.Item>
          <Descriptions.Item label="创建时间">{plan.createTime || '--'}</Descriptions.Item>
          <Descriptions.Item label="备注" span={3}>{planView.remark || '--'}</Descriptions.Item>
        </Descriptions>
      </Card>
      <Card type="inner" size="small" title="巡检线路设备（canonical 映射）" style={{ marginBottom: 12 }}>
        <Table
          rowKey="code" size="small" pagination={false}
          dataSource={lineDevices}
          locale={{ emptyText: <EmptyState description="该计划暂无巡检线路设备" reason="暂无对应的设备行数据" /> }}
          columns={[
            { title: '设备编号', dataIndex: 'code', width: 130 },
            { title: '设备名称', width: 200, render: (_, r) => <CanonicalDeviceCell code={r.code} seedName={r.name} /> },
            { title: '规格型号', dataIndex: 'model', width: 100, render: v => v || '--' },
            { title: '设备类型', dataIndex: 'type', width: 110, render: v => v || '--' },
            { title: '所属部门', dataIndex: 'dept', width: 160, render: v => v || '--' },
            { title: '工位', dataIndex: 'station', width: 100, render: v => v || '--' },
            { title: '巡检标准', dataIndex: 'standard', width: 190, render: v => v || '--' },
            { title: '巡检项目数', dataIndex: 'itemCount', width: 100, align: 'center', render: v => (v != null ? `${v} 项` : '--') },
          ]}
        />
      </Card>
      <Card type="inner" size="small" title={`关联巡检任务（${tasks.length}）`}>
        <Table
          rowKey="code" size="small"
          dataSource={tasks}
          locale={{ emptyText: <EmptyState description="该计划暂无关联巡检任务" reason="暂无该计划的巡检任务" /> }}
          onRow={(r) => ({ onClick: () => navigate(`/patrol-tasks/detail?id=${encodeURIComponent(r.code)}`), style: { cursor: 'pointer' } })}
          pagination={{ pageSize: 5, showTotal: t => `共 ${t} 条` }}
          columns={[
            { title: '任务编号', dataIndex: 'code', width: 200 },
            { title: '巡检日期', dataIndex: 'date', width: 110 },
            { title: '应巡设备数', dataIndex: 'shouldCount', width: 100, align: 'center', render: v => (v != null ? `${v} 台` : '--') },
            { title: '负责人', dataIndex: 'owner', width: 120, render: v => v || '--' },
            { title: '状态', dataIndex: 'status', width: 100, render: v => <StatusTag value={v} /> },
            { title: '创建时间', dataIndex: 'createTime', width: 160, render: v => v || '--' },
            {
              title: '操作', width: 140, fixed: 'right',
              render: (_, r) => (
                <span onClick={e => e.stopPropagation()}>
                  {['未开始', '进行中', '已逾期'].includes(r.status) && (
                    <Button type="link" size="small" onClick={() => navigate(`/patrol-tasks/execute?id=${encodeURIComponent(r.code)}`)}>执行</Button>
                  )}
                  <Button type="link" size="small" onClick={() => navigate(`/patrol-tasks/detail?id=${encodeURIComponent(r.code)}`)}>详情</Button>
                </span>
              ),
            },
          ]}
        />
      </Card>

      <Modal
        title={`编辑巡检计划（${plan.code}）`}
        width={640}
        open={editOpen}
        onCancel={() => setEditOpen(false)}
        onOk={handleEdit}
        okText="保存"
        cancelText="取消"
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Form.Item label="计划名称（巡检线路）" name="name" rules={[{ required: true, message: '请输入计划名称' }]}><Input /></Form.Item>
          <Form.Item label="负责人" name="owner"><Input /></Form.Item>
          <Form.Item label="备注" name="remark"><Input.TextArea rows={2} maxLength={200} /></Form.Item>
        </Form>
      </Modal>
    </>
  );
}
