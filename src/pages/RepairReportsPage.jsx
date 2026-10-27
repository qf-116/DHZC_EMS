import React, { useMemo, useState } from 'react';
import { Card, Table, Tag, Button, Space, Input, Select, App, Modal, Form, Alert } from 'antd';
import { Plus } from 'lucide-react';
import PageHeader from '../components/PageHeader.jsx';
import DegradedBanner from '../components/DegradedBanner.jsx';
import StatusTag from '../components/StatusTag.jsx';
import EmptyState from '../components/EmptyState.jsx';
import { useDemoState, useDemoActions } from '../state/DemoStore.jsx';
import { selectAllRepairReports, selectAllRepairOrders, selectAllDevices } from '../state/selectors.js';
import { REPAIR_LEVELS, FAULT_TYPES } from '../domain/repair.js';
import { users } from '../data/demo/masterData.js';

const levelColor = { 紧急: 'red', 严重: 'orange', 一般: 'blue' };
// 维修人员下拉统一取自三方主数据（在职的维修工程师/设备负责人/点检员/巡检员/备件管理员）
const repairStaff = users.filter(u => u.status === '在职' && (u.role === '维修工程师' || u.role === '设备负责人' || u.role === '点检员' || u.role === '巡检员' || u.role === '备件管理员')).map(u => u.name);
const repairPersons = repairStaff.map(v => ({ value: v, label: v }));

// 故障报修列表（store 驱动）：repairReports 全量 + 状态。
// 新增为弹窗（createRepairReport 生成待派工报修与主工单）；指派任务为弹窗（生成工单后派工）。
// 取消 / 删除：本演示未提供对应动作（维修统一对象的状态推进在工单/执行页完成），按钮保留原型入口并明确提示。
export default function RepairReportsPage() {
  const { message } = App.useApp();
  const state = useDemoState();
  const actions = useDemoActions();
  const meta = state.meta;

  const [kw, setKw] = useState('');
  const [status, setStatus] = useState(null);
  const [selectedKeys, setSelectedKeys] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [form] = Form.useForm();
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignTarget, setAssignTarget] = useState(null); // 被指派的报修单（工具栏批量指派时为 null）
  const [assignForm] = Form.useForm();
  const [cancelOpen, setCancelOpen] = useState(false);

  const reports = selectAllRepairReports(state);
  const orders = selectAllRepairOrders(state);
  const devices = selectAllDevices(state);
  const activeOrderByReport = useMemo(
    () => (reportId) => orders.find(o => o.reportId === reportId && !['已完成', '已取消'].includes(o.status)),
    [orders],
  );

  const statusOptions = useMemo(
    () => [...new Set(reports.map(r => r.status))].map(v => ({ value: v, label: v })),
    [reports],
  );

  const list = reports
    .filter(r => !status || r.status === status)
    .filter(r => !kw || (r.code || '').includes(kw) || (r.title || '').includes(kw) || (r.deviceName || '').includes(kw));

  const openModal = () => { form.resetFields(); setModalOpen(true); };

  // 新增报修：提交后生成待派工报修单与主工单（状态由 store 驱动刷新）
  const submitCreate = async () => {
    const values = await form.validateFields();
    const res = actions.createRepairReport({
      deviceId: values.deviceId,
      title: values.title,
      faultDesc: values.desc,
      level: values.level || '一般',
      faultType: values.faultType || '其他',
    });
    message[res.ok ? 'success' : 'error'](res.message);
    if (res.ok) setModalOpen(false);
  };

  const openAssign = (record) => {
    if (!record && !selectedKeys.length) { message.warning('请先勾选或从列表选择要指派的报修单'); return; }
    setAssignTarget(record || reports.find(r => r.reportId === selectedKeys[0]) || null);
    assignForm.resetFields();
    setAssignOpen(true);
  };

  // 指派任务：已有关联工单 → 直接派工；尚未生成工单 → 生成主工单后派工
  const submitAssign = async () => {
    const values = await assignForm.validateFields();
    if (!assignTarget) { message.warning('请先选择要指派的报修单'); return; }
    const assignee = values.assignee;
    const assigneeGroup = values.assigneeGroup || null;
    const linked = activeOrderByReport(assignTarget.reportId);
    if (linked) {
      const res = actions.assignRepair(linked.repairOrderId, { assignee, assigneeGroup });
      message[res.ok ? 'success' : 'error'](res.message);
      if (res.ok) setAssignOpen(false);
      return;
    }
    const created = actions.createRepairReport({
      deviceId: assignTarget.deviceId, title: assignTarget.title,
      faultDesc: assignTarget.desc, level: assignTarget.level, faultType: assignTarget.faultType,
    });
    if (!created.ok) { message.error(created.message); return; }
    const orderId = created.refs.repairOrderId;
    // 动作层基于最新状态快照预校验，等本批次更新提交后再派工
    setTimeout(() => {
      const res = actions.assignRepair(orderId, { assignee, assigneeGroup });
      message[res.ok ? 'success' : 'error'](res.ok ? `${created.message}；${res.message}` : res.message);
    }, 0);
    setAssignOpen(false);
  };

  const confirmCancel = () => {
    message.info('报修单随主工单状态机推进（待派工 → 已派工 → 维修中 → 待验收 → 已完成），取消场景在维修工单侧处理');
  };
  const confirmDelete = () => {
    message.info('报修记录为业务履历，不支持删除');
  };

  return (
    <>
      <PageHeader
        title="故障报修"
      />
      <DegradedBanner meta={meta} />
      <Card size="small" style={{ marginBottom: 12 }}>
        <Space wrap>
          <Input.Search style={{ width: 240 }} placeholder="报修单号 / 报修名称 / 设备" allowClear onSearch={setKw} onChange={e => { if (!e.target.value) setKw(''); }} />
          <Select style={{ width: 130 }} placeholder="状态" allowClear options={statusOptions} value={status} onChange={setStatus} />
          <Button type="primary" onClick={() => setKw(kw)}>查询</Button>
          <Button onClick={() => { setKw(''); setStatus(null); }}>重置</Button>
        </Space>
      </Card>
      <Card size="small">
        <Space wrap style={{ marginBottom: 12 }}>
          <Button type="primary" icon={<Plus size={14} />} onClick={openModal}>新增</Button>
          <Button onClick={() => openAssign(null)}>指派任务</Button>
          <Button onClick={() => setCancelOpen(true)}>取消</Button>
          <Button danger onClick={confirmDelete}>删除</Button>
        </Space>
        <Table
          rowKey="reportId" size="small" rowSelection={{ columnWidth: 40, selectedRowKeys: selectedKeys, onChange: setSelectedKeys }}
          dataSource={list}
          locale={{ emptyText: <EmptyState description="暂无报修记录" reason={kw || status ? '当前筛选条件下没有报修单' : '尚无报修，可点击「新增」提交故障报修'} /> }}
          columns={[
            { title: '报修单号', dataIndex: 'code', width: 150 },
            { title: '故障名称', dataIndex: 'title', width: 180, render: v => v || '--' },
            { title: '设备名称', dataIndex: 'deviceName', width: 150, render: v => v || '--' },
            { title: '设备编号', dataIndex: 'deviceCode', width: 120, render: v => v || '--' },
            { title: '故障类型', dataIndex: 'faultType', width: 90, render: v => v || '--' },
            { title: '故障等级', dataIndex: 'level', width: 90, render: v => <Tag color={levelColor[v] || 'default'}>{v || '--'}</Tag> },
            { title: '故障时间', dataIndex: 'faultTime', width: 150, render: v => v || '--' },
            { title: '状态', dataIndex: 'status', width: 100, render: v => <StatusTag value={v} /> },
            { title: '关联维修工单', dataIndex: 'linkedRepairOrderId', width: 150, render: v => v || '--' },
            { title: '来源', dataIndex: 'source', width: 90, render: v => v || '--' },
            { title: '创建人', dataIndex: 'creator', width: 90, render: v => v || '--' },
            { title: '报修创建时间', dataIndex: 'createTime', width: 150, render: v => v || '--' },
            { title: '操作', width: 130, fixed: 'right', render: (_, r) => (
              <Space size={0}>
                <Button type="link" size="small" onClick={() => openAssign(r)}>指派任务</Button>
              </Space>
            ) },
          ]}
          scroll={{ x: 1600 }}
          pagination={{ pageSize: 10, showTotal: t => `共 ${t} 条` }}
        />
      </Card>

      {/* 新增故障报修（弹窗）：提交后生成待派工报修单与主工单 */}
      <Modal
        title="新增报修"
        width={640}
        open={modalOpen}
        destroyOnClose
        onCancel={() => setModalOpen(false)}
        onOk={submitCreate}
        okText="确认" cancelText="取消"
      >
        <Form form={form} labelCol={{ span: 6 }} wrapperCol={{ span: 16 }}>
          <Form.Item label="故障名称" name="title" required rules={[{ required: true, message: '请输入故障名称' }]}>
            <Input placeholder="请输入故障名称" maxLength={50} />
          </Form.Item>
          <Form.Item label="维修设备" name="deviceId" required rules={[{ required: true, message: '请选择维修设备' }]}>
            <Select placeholder="请选择维修设备" showSearch optionFilterProp="label"
              options={devices.map(d => ({ value: d.deviceId, label: `${d.name}（${d.assetCode || d.deviceId}）` }))} />
          </Form.Item>
          <Form.Item label="故障类型" name="faultType" initialValue="其他">
            <Select options={FAULT_TYPES.map(v => ({ value: v, label: v }))} />
          </Form.Item>
          <Form.Item label="故障等级" name="level" initialValue="一般">
            <Select options={REPAIR_LEVELS.map(v => ({ value: v, label: v }))} />
          </Form.Item>
          <Form.Item label="故障描述" name="desc" required rules={[{ required: true, message: '请输入故障描述' }]}>
            <Input.TextArea rows={3} placeholder="请输入故障描述（故障现象、影响范围等）" maxLength={500} showCount />
          </Form.Item>
          <Form.Item label="故障时间" help="报修时间以提交时刻为准">
            <Input disabled value="提交时自动记录" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 指派任务（弹窗）：选择维修人员后派工；未生成工单的报修单先创建主工单 */}
      <Modal
        title={assignTarget ? `指派任务（${assignTarget.code}）` : '指派任务'}
        width={560}
        open={assignOpen}
        destroyOnClose
        onCancel={() => setAssignOpen(false)}
        onOk={submitAssign}
        okText="确认指派" cancelText="取消"
      >
        {assignTarget && (
          <div style={{ lineHeight: 1.9, fontSize: 13, background: '#f6f9fb', border: '1px solid #e8eef2', borderRadius: 8, padding: '8px 12px', marginBottom: 14 }}>
            <div>故障名称：{assignTarget.title || '--'}　<Tag color={levelColor[assignTarget.level] || 'default'}>{assignTarget.level || '--'}</Tag></div>
            <div>设备名称：{assignTarget.deviceName || '--'}　故障类型：{assignTarget.faultType || '--'}</div>
            <div>故障时间：{assignTarget.faultTime || '--'}</div>
            {activeOrderByReport(assignTarget.reportId)
              ? <div>关联工单：{activeOrderByReport(assignTarget.reportId).repairOrderId}</div>
              : <div style={{ color: '#8a6d3b' }}>该报修单尚未生成工单，确认后自动创建主工单并派工</div>}
          </div>
        )}
        {!assignTarget && <Alert type="info" showIcon style={{ marginBottom: 14 }} message="未选择报修单：请先在列表勾选一条报修单再指派。" />}
        <Form form={assignForm} layout="vertical" initialValues={{ assigneeGroup: '机修班' }}>
          <Form.Item label="维修人员" name="assignee" required rules={[{ required: true, message: '派工必须指定维修人' }]}>
            <Select placeholder="请选择维修人员" options={repairPersons} />
          </Form.Item>
          <Form.Item label="维修班组" name="assigneeGroup">
            <Select placeholder="请选择" options={['机修班', '电气班', '工艺班'].map(v => ({ value: v, label: v }))} allowClear />
          </Form.Item>
          <Form.Item label="指派说明" help="SLA 按故障等级自动计算">
            <Input.TextArea rows={2} placeholder="故障处理建议、备件领用、安全注意事项等" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 取消报修（弹窗） */}
      <Modal
        title="取消报修"
        width={480}
        open={cancelOpen}
        onCancel={() => setCancelOpen(false)}
        footer={<Button type="primary" onClick={() => setCancelOpen(false)}>知道了</Button>}
      >
        <Alert type="warning" showIcon
          message="报修单不支持直接取消"
          description="报修单随维修主工单状态机推进（待派工 → 已派工 → 维修中 → 待验收 → 已完成 / 已取消）。如需终止维修，请在维修工单侧按状态机处理。" />
      </Modal>
    </>
  );
}
