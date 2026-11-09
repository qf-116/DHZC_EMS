import React, { useMemo, useState } from 'react';
import { Card, Descriptions, Table, Button, Space, Modal, Form, Input, Select, App } from 'antd';
import { ArrowLeft } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import PageHeader from '../components/PageHeader.jsx';
import DegradedBanner from '../components/DegradedBanner.jsx';
import StatusTag from '../components/StatusTag.jsx';
import EmptyState from '../components/EmptyState.jsx';
import InspectionDeviceDetailTable from '../components/InspectionDeviceDetailTable.jsx';
import InspectionItemPickerModal from '../components/InspectionItemPickerModal.jsx';
import { useDemoState } from '../state/DemoStore.jsx';
import { inspectionPlans, inspectionTasks, inspectionStandards, inspectionItems, inspectionStandardItemCodes, ledgerDevices } from '../data/standardData.js';
import { cycleText, ownersOf } from '../domain/inspection.js';
import { users } from '../data/demo/masterData.js';

const OWNER_OPTIONS = users.filter(u => u.status === '在职').map(u => ({ value: u.name, label: `${u.name}（${u.dept}·${u.role}）` }));

const SNAPSHOT_STANDARD_CODE = 'XJBZ20250301001';

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
  const [detailRows, setDetailRows] = useState(null);
  const [itemPickerOpen, setItemPickerOpen] = useState(false);
  const [itemPickerRow, setItemPickerRow] = useState(null);

  const codeOrId = params.get('code') || params.get('id');
  const plan = codeOrId
    ? inspectionPlans.find(p => p.code === codeOrId || p.code === decodeURIComponent(codeOrId) || p.name === codeOrId)
    : null;
  const planView = plan ? { ...plan, ...patch } : null;

  // 点检明细（设备）：快照未给出「计划 ↔ 设备明细」关联表，按设备数从台账快照派生
  const deviceRows = useMemo(() => {
    if (detailRows) return detailRows;
    if (!plan) return [];
    return ledgerDevices.slice(0, plan.deviceCount ?? 0).map(d => ({
      code: d.code, name: d.name, model: d.model, type: d.type, dept: d.dept, station: d.station,
      standard: undefined, items: [], itemCount: 0,
    }));
  }, [detailRows, plan]);

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
    form.setFieldsValue({ name: planView.name, owners: ownersOf(planView), remark: planView.remark });
    setEditOpen(true);
  };
  const handleEdit = async () => {
    const values = await form.validateFields();
    const owners = values.owners || [];
    setPatch(prev => ({ ...prev, ...values, owners, owner: owners.join('、') }));
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
          <Descriptions.Item label="点检计划名称">{planView.name}</Descriptions.Item>
          <Descriptions.Item label="计划开始日期">{plan.startDate || '--'}</Descriptions.Item>
          <Descriptions.Item label="计划结束日期">{plan.endDate || '--'}</Descriptions.Item>
          <Descriptions.Item label="状态"><StatusTag value={plan.status} /></Descriptions.Item>
          <Descriptions.Item label="执行周期">{cycleText(planView)}</Descriptions.Item>
          <Descriptions.Item label="点检负责人">{ownersOf(planView).join('、') || '--'}</Descriptions.Item>
          <Descriptions.Item label="设备数量">{plan.deviceCount != null ? `${plan.deviceCount} 台` : '--'}</Descriptions.Item>
          <Descriptions.Item label="现有任务">{plan.totalTasks ?? '--'}</Descriptions.Item>
          <Descriptions.Item label="已完成任务">{plan.doneTasks ?? '--'}</Descriptions.Item>
          <Descriptions.Item label="创建时间">{plan.createTime || '--'}</Descriptions.Item>
          <Descriptions.Item label="备注">{planView.remark || '--'}</Descriptions.Item>
        </Descriptions>
      </Card>

      <Card size="small" style={{ marginBottom: 12 }}>
        <div style={{ fontWeight: 600, marginBottom: 12 }}>点检明细（{deviceRows.length} 台设备）</div>
        <InspectionDeviceDetailTable
          rows={deviceRows}
          onChange={setDetailRows}
          standards={inspectionStandards}
          onPickItems={(r) => { setItemPickerRow(r); setItemPickerOpen(true); }}
        />
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
          <Form.Item label="点检计划名称" name="name" rules={[{ required: true, message: '请输入计划名称' }]}><Input /></Form.Item>
          <Form.Item label="点检负责人" name="owners" extra="支持多选">
            <Select mode="multiple" allowClear placeholder="请选择点检负责人" options={OWNER_OPTIONS} optionFilterProp="label" />
          </Form.Item>
          <Form.Item label="备注" name="remark"><Input.TextArea rows={2} maxLength={200} /></Form.Item>
        </Form>
      </Modal>

      <InspectionItemPickerModal
        open={itemPickerOpen}
        standards={inspectionStandards}
        items={inspectionItems}
        standardItemCodes={inspectionStandardItemCodes}
        snapshotStandardCode={SNAPSHOT_STANDARD_CODE}
        defaultStandard={itemPickerRow?.standard}
        assignedCodes={itemPickerRow?.items || []}
        onCancel={() => setItemPickerOpen(false)}
        onConfirm={(pickedItems, standard) => {
          setDetailRows(deviceRows.map(r => (r.code === itemPickerRow?.code
            ? { ...r, standard: standard || r.standard, items: pickedItems.map(i => i.code), itemCount: pickedItems.length }
            : r)));
          setItemPickerOpen(false);
          message.success(`已为设备「${itemPickerRow?.name}」设置 ${pickedItems.length} 个点检项目`);
        }}
      />
    </>
  );
}
