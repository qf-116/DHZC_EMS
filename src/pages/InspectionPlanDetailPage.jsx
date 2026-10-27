import React, { useState } from 'react';
import { Card, Descriptions, Table, Button, Space, Modal, Form, Input, App } from 'antd';
import { ArrowLeft } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import PageHeader from '../components/PageHeader.jsx';
import DegradedBanner from '../components/DegradedBanner.jsx';
import StatusTag from '../components/StatusTag.jsx';
import EmptyState from '../components/EmptyState.jsx';
import { useDemoState } from '../state/DemoStore.jsx';
import { inspectionPlans, inspectionTasks } from '../data/standardData.js';

// 点检计划详情（范围外演示模块）：/inspection-plans/detail（query 兼容 id/code）。
// 展示计划基本信息 + 周期规则 + 关联任务完成情况（按计划名称匹配演示快照中的任务）。
// 「编辑」为页面内演示交互（不写入 DemoStore，刷新后恢复快照）。
export default function InspectionPlanDetailPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { message } = App.useApp();
  const state = useDemoState();
  const meta = state.meta;

  const [editOpen, setEditOpen] = useState(false);
  const [form] = Form.useForm();
  const [patch, setPatch] = useState({});

  const codeOrId = params.get('code') || params.get('id');
  const plan = codeOrId
    ? inspectionPlans.find(p => p.code === codeOrId || p.code === decodeURIComponent(codeOrId) || p.name === codeOrId)
    : null;
  const planView = plan ? { ...plan, ...patch } : null;

  if (!codeOrId || !plan) {
    return (
      <>
        <PageHeader title="点检计划详情" subtitle={codeOrId ? `计划：${codeOrId}` : '未指定计划'}
          actions={<Space><Button icon={<ArrowLeft size={14} />} onClick={() => navigate('/inspection-plans')}>返回列表</Button></Space>} />
        <DegradedBanner meta={meta} />
        <Card size="small">
          <EmptyState
            description={`未找到点检计划${codeOrId ? `「${codeOrId}」` : ''}`}
            reason="编号无效或系统中不存在该计划"
            next
            onNext={() => navigate('/inspection-plans')}
            nextLabel="返回点检计划列表"
          />
        </Card>
      </>
    );
  }

  const tasks = inspectionTasks.filter(t => t.plan === plan.name);
  const doneCount = tasks.filter(t => t.status === '已完成').length;

  const openEdit = () => {
    form.resetFields();
    form.setFieldsValue({ name: planView.name, owner: planView.owner, remark: planView.remark });
    setEditOpen(true);
  };
  const handleEdit = async () => {
    const values = await form.validateFields();
    setPatch(prev => ({ ...prev, ...values }));
    setEditOpen(false);
    message.success('计划信息已保存，变更将同步到未执行的任务及后续按周期生成的任务');
  };

  return (
    <>
      <PageHeader
        title="点检计划详情"
        subtitle={`计划：${plan.code} · ${planView.name} · 数据更新于 ${meta.demoDay}`}
        actions={(
          <Space>
            <Button icon={<ArrowLeft size={14} />} onClick={() => navigate('/inspection-plans')}>返回列表</Button>
            <Button type="primary" onClick={openEdit}>编辑</Button>
          </Space>
        )}
      />
      <DegradedBanner meta={meta} />

      <Card size="small" style={{ marginBottom: 12 }}>
        <div style={{ fontWeight: 600, marginBottom: 12 }}>计划信息</div>
        <Descriptions column={2} size="small" bordered>
          <Descriptions.Item label="计划编号">{plan.code}</Descriptions.Item>
          <Descriptions.Item label="计划名称">{planView.name}</Descriptions.Item>
          <Descriptions.Item label="起止日期">{plan.startDate || '--'} ~ {plan.endDate || '--'}</Descriptions.Item>
          <Descriptions.Item label="状态"><StatusTag value={plan.status} /></Descriptions.Item>
          <Descriptions.Item label="周期">{plan.cycle || '--'} / {plan.interval ?? '--'} 天</Descriptions.Item>
          <Descriptions.Item label="跳过规则">{plan.skip || '--'}</Descriptions.Item>
          <Descriptions.Item label="负责人">{planView.owner || '--'}</Descriptions.Item>
          <Descriptions.Item label="设备范围">{plan.deviceCount != null ? `${plan.deviceCount} 台` : '--'}</Descriptions.Item>
          <Descriptions.Item label="计划任务数">{plan.totalTasks ?? '--'}</Descriptions.Item>
          <Descriptions.Item label="已完成任务数">{plan.doneTasks ?? '--'}</Descriptions.Item>
          <Descriptions.Item label="创建时间">{plan.createTime || '--'}</Descriptions.Item>
          <Descriptions.Item label="备注">{planView.remark || '--'}</Descriptions.Item>
        </Descriptions>
      </Card>

      <Card size="small">
        <div style={{ fontWeight: 600, marginBottom: 12 }}>关联任务完成情况（共 {tasks.length} 条，已完成 {doneCount} 条）</div>
        <Table
          rowKey="code" size="small"
          dataSource={tasks}
          onRow={(r) => ({ onClick: () => navigate(`/inspection-tasks/detail?code=${encodeURIComponent(r.code)}`), style: { cursor: 'pointer' } })}
          locale={{ emptyText: <EmptyState description="暂无关联任务" reason="该计划尚未生成点检任务" /> }}
          columns={[
            { title: '任务编号', dataIndex: 'code', width: 180 },
            { title: '点检日期', dataIndex: 'date', width: 120, render: v => v || '--' },
            { title: '应检设备数', dataIndex: 'shouldCount', width: 100, render: v => v ?? '--' },
            { title: '班组', dataIndex: 'group', width: 110, render: v => v || '--' },
            { title: '执行人', dataIndex: 'owner', width: 110, render: v => v || '--' },
            { title: '状态', dataIndex: 'status', width: 100, render: v => <StatusTag value={v} /> },
            { title: '备注', dataIndex: 'remark', ellipsis: true, render: v => v || '--' },
            {
              title: '操作', width: 130,
              render: (_, r) => (
                <Space size={0} onClick={(e) => e.stopPropagation()}>
                  <Button type="link" size="small" onClick={() => navigate(`/inspection-tasks/detail?code=${encodeURIComponent(r.code)}`)}>详情</Button>
                  {['未开始', '进行中'].includes(r.status) && (
                    <Button type="link" size="small" onClick={() => navigate(`/inspection-tasks/execute?code=${encodeURIComponent(r.code)}`)}>执行</Button>
                  )}
                </Space>
              ),
            },
          ]}
          pagination={false}
        />
      </Card>

      <Modal
        title={`编辑点检计划（${plan.code}）`}
        width={640}
        open={editOpen}
        onCancel={() => setEditOpen(false)}
        onOk={handleEdit}
        okText="保存"
        cancelText="取消"
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Form.Item label="计划名称" name="name" rules={[{ required: true, message: '请输入计划名称' }]}><Input /></Form.Item>
          <Form.Item label="负责人" name="owner"><Input /></Form.Item>
          <Form.Item label="备注" name="remark"><Input.TextArea rows={2} maxLength={200} /></Form.Item>
        </Form>
      </Modal>
    </>
  );
}
