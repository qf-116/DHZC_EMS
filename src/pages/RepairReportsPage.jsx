import React, { useMemo, useState } from 'react';
import { Card, Table, Tag, Button, Space, Input, Select, App, Modal, Form, Alert, Upload, Row, Col, Checkbox, DatePicker } from 'antd';
import { Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../components/PageHeader.jsx';
import DegradedBanner from '../components/DegradedBanner.jsx';
import StatusTag from '../components/StatusTag.jsx';
import EmptyState from '../components/EmptyState.jsx';
import FilterBar, { FilterField } from '../components/FilterBar.jsx';
import { useDemoState, useDemoActions } from '../state/DemoStore.jsx';
import { selectRepairReportRows, selectAllRepairOrders, selectAllDevices } from '../state/selectors.js';
import { REPAIR_LEVELS, FAULT_TYPES, REPORT_STATUSES } from '../domain/repair.js';
import { users } from '../data/demo/masterData.js';

const levelColor = { 紧急: 'red', 严重: 'orange', 一般: 'blue' };
// 维修人员下拉统一取自三方主数据（在职的维修工程师/设备负责人/点检员/巡检员/备件管理员）
const repairStaff = users.filter(u => u.status === '在职' && (u.role === '维修工程师' || u.role === '设备负责人' || u.role === '点检员' || u.role === '巡检员' || u.role === '备件管理员')).map(u => u.name);
const repairPersons = repairStaff.map(v => ({ value: v, label: v }));

// Upload 文件列表 → 图片名数组（演示口径：仅记录文件名）
function fileNames(fileList = []) {
  return (fileList || []).map(f => f?.name).filter(Boolean);
}

// 故障报修列表（store 驱动）：报修单全量 + 派生状态（未处理 / 进行中 / 已完成 / 已取消）。
// 新增为弹窗（createRepairReport 生成待派工报修与主工单）；指派任务为弹窗（生成工单后派工）；
// 取消 / 删除按原型规则：已派工的报修单不可删除、不可编辑，只能取消。
export default function RepairReportsPage() {
  const { message, modal } = App.useApp();
  const navigate = useNavigate();
  const state = useDemoState();
  const actions = useDemoActions();
  const meta = state.meta;

  const [kw, setKw] = useState('');
  const [status, setStatus] = useState(null);
  const [selectedKeys, setSelectedKeys] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form] = Form.useForm();
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignTarget, setAssignTarget] = useState(null); // 被指派的报修单（工具栏批量指派时为 null）
  const [assignForm] = Form.useForm();
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelTarget, setCancelTarget] = useState(null);
  const [cancelForm] = Form.useForm();
  const [requestId, setRequestId] = useState('');

  const reports = selectRepairReportRows(state);
  const orders = selectAllRepairOrders(state);
  const devices = selectAllDevices(state);
  const activeOrderByReport = useMemo(
    () => (reportId) => orders.find(o => o.reportId === reportId && !['已完成', '已取消'].includes(o.status)),
    [orders],
  );

  const statusOptions = REPORT_STATUSES.map(v => ({ value: v, label: v }));

  const list = reports
    .filter(r => !status || r.displayStatus === status)
    .filter(r => !kw || (r.code || '').includes(kw) || (r.title || '').includes(kw) || (r.deviceName || '').includes(kw));

  const openModal = () => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({ faultType: '其他', level: '一般' });
    setRequestId(`report-${Date.now()}-${Math.round(Math.random() * 1e6)}`);
    setModalOpen(true);
  };

  // 编辑报修单（已派工的不可编辑）
  const openEdit = (record) => {
    if (activeOrderByReport(record.reportId)) { message.warning('该报修已派工，不能编辑；请改用「取消」'); return; }
    setEditing(record);
    form.resetFields();
    form.setFieldsValue({
      title: record.title, deviceId: record.deviceId, faultType: record.faultType, level: record.level,
      desc: record.desc, faultTime: record.faultTime, downtimeFlag: record.downtimeFlag,
      images: (record.images || []).map(n => ({ uid: n, name: n, status: 'done' })),
    });
    setModalOpen(true);
  };

  // 新增 / 编辑报修
  const submitForm = async () => {
    const values = await form.validateFields();
    if (editing) {
      const res = actions.updateRepairReport(editing.reportId, {
        title: values.title, faultType: values.faultType, level: values.level,
        desc: values.desc, faultTime: values.faultTime, downtimeFlag: values.downtimeFlag,
        images: fileNames(values.images),
      });
      message[res.ok ? 'success' : 'error'](res.message);
      if (res.ok) setModalOpen(false);
      return;
    }
    const res = actions.createRepairReport({
      deviceId: values.deviceId,
      title: values.title,
      faultDesc: values.desc,
      level: values.level || '一般',
      faultType: values.faultType || '其他',
      faultTime: values.faultTime || null,
      downtimeFlag: values.downtimeFlag ?? false,
      images: fileNames(values.images),
    }, requestId);
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
      downtimeFlag: assignTarget.downtimeFlag,
    }, `assign-${assignTarget.reportId}`);
    if (!created.ok) { message.error(created.message); return; }
    const orderId = created.refs.repairOrderId;
    // 动作层基于最新状态快照预校验，等本批次更新提交后再派工
    setTimeout(() => {
      const res = actions.assignRepair(orderId, { assignee, assigneeGroup });
      message[res.ok ? 'success' : 'error'](res.ok ? `${created.message}；${res.message}` : res.message);
    }, 0);
    setAssignOpen(false);
  };

  // 取消报修（需填原因）
  const openCancel = (record) => {
    const target = record || reports.find(r => r.reportId === selectedKeys[0]);
    if (!target) { message.warning('请先勾选要取消的报修单'); return; }
    setCancelTarget(target);
    cancelForm.resetFields();
    setCancelOpen(true);
  };
  const submitCancel = async () => {
    const values = await cancelForm.validateFields();
    const res = actions.cancelRepairReport(cancelTarget.reportId, values.reason);
    message[res.ok ? 'success' : 'error'](res.message);
    if (res.ok) setCancelOpen(false);
  };

  // 删除报修（已派工的不可删除）
  const confirmDelete = (record) => {
    const target = record || reports.find(r => r.reportId === selectedKeys[0]);
    if (!target) { message.warning('请先勾选要删除的报修单'); return; }
    if (activeOrderByReport(target.reportId)) { message.warning('该报修已派工，不能删除；请改用「取消」'); return; }
    modal.confirm({
      title: '删除报修记录',
      content: `确定删除报修单「${target.code}」吗？删除后不可恢复。`,
      okText: '删除', okButtonProps: { danger: true }, cancelText: '取消',
      onOk: () => {
        const res = actions.deleteRepairReport(target.reportId);
        message[res.ok ? 'success' : 'error'](res.message);
      },
    });
  };

  // 故障处理：跳转到待维修看板 / 维修执行页
  const goHandle = (record) => {
    const linked = activeOrderByReport(record.reportId);
    if (linked) navigate(`/repair-orders/${linked.repairOrderId}/execute`);
    else navigate('/repair-pending');
  };

  return (
    <>
      <PageHeader
        title="故障报修"
      />
      <DegradedBanner meta={meta} />
      <FilterBar onQuery={() => setKw(kw)} onReset={() => { setKw(''); setStatus(null); }}>
        <FilterField label="报修查询">
          <Input.Search style={{ width: 240 }} placeholder="报修单号 / 报修名称 / 设备" allowClear value={kw} onSearch={setKw} onChange={e => setKw(e.target.value)} />
        </FilterField>
        <FilterField label="状态">
          <Select style={{ width: 130 }} placeholder="全部状态" allowClear options={statusOptions} value={status} onChange={setStatus} />
        </FilterField>
      </FilterBar>
      <Card size="small">
        {/* 列表区左上工具栏：新增 / 指派任务 / 取消 / 删除 */}
        <Space wrap style={{ marginBottom: 12 }}>
          <Button type="primary" icon={<Plus size={14} />} onClick={openModal}>新增</Button>
          <Button onClick={() => openAssign(null)}>指派任务</Button>
          <Button onClick={() => openCancel(null)}>取消</Button>
          <Button danger onClick={() => confirmDelete(null)}>删除</Button>
          <span style={{ fontSize: 12, color: '#8a97a3' }}>已指派人员的报修记录不能删除，只能取消</span>
        </Space>
        <Table
          rowKey="reportId" size="small" rowSelection={{ columnWidth: 40, selectedRowKeys: selectedKeys, onChange: setSelectedKeys }}
          dataSource={list}
          locale={{ emptyText: <EmptyState description="暂无报修记录" reason={kw || status ? '当前筛选条件下没有报修单' : '尚无报修，可点击「新增」提交故障报修'} /> }}
          columns={[
            { title: '报修单号', dataIndex: 'code', width: 150 },
            { title: '报修名称', dataIndex: 'title', width: 170, render: v => v || '--' },
            { title: '状态', dataIndex: 'displayStatus', width: 90, render: v => <StatusTag value={v} /> },
            { title: '报修人', dataIndex: 'reporter', width: 90, render: v => v || '--' },
            { title: '报修部门', dataIndex: 'reporterDept', width: 110, render: v => v || '--' },
            { title: '报修时间', dataIndex: 'reportTime', width: 150, render: v => v || '--' },
            { title: '故障时间', dataIndex: 'faultTime', width: 150, render: v => v || '--' },
            { title: '故障类型', dataIndex: 'faultType', width: 90, render: v => v || '--' },
            { title: '故障等级', dataIndex: 'level', width: 90, render: v => <Tag color={levelColor[v] || 'default'}>{v || '--'}</Tag> },
            { title: '是否停机', dataIndex: 'downtimeFlag', width: 90, render: v => (v === true ? '是' : '否') },
            { title: '设备名称', dataIndex: 'deviceName', width: 140, render: v => v || '--' },
            { title: '设备编号', dataIndex: 'deviceCode', width: 120, render: v => v || '--' },
            { title: '设备类型', dataIndex: 'deviceType', width: 100, render: v => v || '--' },
            { title: '故障图片', dataIndex: 'images', width: 140, render: v => ((v || []).join('、') || '--') },
            { title: '关联维修工单', dataIndex: 'orderCode', width: 150, render: (v, r) => (v
              ? <a onClick={() => navigate(`/repair-orders/${r.orderId}`)}>{v}</a>
              : '--') },
            { title: '来源', dataIndex: 'source', width: 90, render: v => v || '--' },
            { title: '创建人', dataIndex: 'creator', width: 90, render: v => v || '--' },
            { title: '报修创建时间', dataIndex: 'createTime', width: 150, render: v => v || '--' },
            {
              title: '操作', width: 230, fixed: 'right', render: (_, r) => (
                <Space size={0}>
                  <Button type="link" size="small" onClick={() => openAssign(r)}>指派任务</Button>
                  <Button type="link" size="small" onClick={() => openEdit(r)}>编辑</Button>
                  <Button type="link" size="small" onClick={() => goHandle(r)}>故障处理</Button>
                  <Button type="link" size="small" onClick={() => (r.orderId ? navigate(`/repair-orders/${r.orderId}`) : navigate('/repair-pending'))}>查看详情</Button>
                </Space>
              )
            },
          ]}
          scroll={{ x: 2400 }}
          pagination={{ pageSize: 10, showTotal: t => `共 ${t} 条` }}
        />
      </Card>

      {/* 新增 / 编辑故障报修（弹窗，两列布局） */}
      <Modal
        title={editing ? '编辑报修' : '新增报修'}
        width={720}
        open={modalOpen}
        destroyOnHidden
        onCancel={() => setModalOpen(false)}
        onOk={submitForm}
        okText="确认" cancelText="取消"
      >
        <Form form={form} layout="vertical">
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="故障名称" name="title" required rules={[{ required: true, message: '请输入故障名称' }]}>
                <Input placeholder="请输入故障名称" maxLength={50} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="维修设备" name="deviceId" required rules={[{ required: true, message: '请选择维修设备' }]}>
                <Select placeholder="请选择维修设备" showSearch optionFilterProp="label" disabled={!!editing}
                  options={devices.map(d => ({ value: d.deviceId, label: `${d.name}（${d.assetCode || d.deviceId}）` }))} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="故障类型" name="faultType" initialValue="其他">
                <Select options={FAULT_TYPES.map(v => ({ value: v, label: v }))} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="故障等级" name="level" initialValue="一般">
                <Select options={REPAIR_LEVELS.map(v => ({ value: v, label: v }))} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="故障时间" name="faultTime" help="不填则以提交时刻记录">
                <DatePicker showTime placeholder="请选择时间" valueFormat="YYYY-MM-DD HH:mm:ss" style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="是否停机" name="downtimeFlag" valuePropName="checked">
                <Checkbox>停机（设备已停止生产）</Checkbox>
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item label="故障描述" name="desc" required rules={[{ required: true, message: '请输入故障描述' }]}>
                <Input.TextArea rows={3} placeholder="请输入故障描述（故障现象、影响范围等）" maxLength={500} showCount />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item label="故障图片" name="images" valuePropName="fileList" getValueFromEvent={e => e?.fileList}>
                <Upload beforeUpload={() => false} listType="picture-card" maxCount={10} accept="image/*">
                  <Button>上传图片</Button>
                </Upload>
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>

      {/* 指派任务（弹窗）：选择维修人员后派工；未生成工单的报修单先创建主工单 */}
      <Modal
        title={assignTarget ? `指派任务（${assignTarget.code}）` : '指派任务'}
        width={560}
        open={assignOpen}
        destroyOnHidden
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

      {/* 取消报修（弹窗，必须填写取消原因） */}
      <Modal
        title={`取消报修（${cancelTarget?.code || '--'}）`}
        width={520}
        open={cancelOpen}
        destroyOnHidden
        onCancel={() => setCancelOpen(false)}
        onOk={submitCancel}
        okText="确认取消" cancelText="取消"
      >
        <Alert type="warning" showIcon style={{ marginBottom: 12 }}
          message="取消报修需填写取消原因"
          description="取消报修时，未开工的关联维修工单一并取消；工单维修中的，请先在维修任务侧处理。" />
        <Form form={cancelForm} layout="vertical">
          <Form.Item label="取消原因" name="reason" required rules={[{ required: true, message: '请填写取消原因' }]}>
            <Input.TextArea rows={3} placeholder="请填写取消原因" maxLength={200} showCount />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
