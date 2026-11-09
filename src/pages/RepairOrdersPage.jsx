import React, { useMemo, useState } from 'react';
import { Card, Table, Tag, Button, Space, Input, Select, Tooltip, App, Modal, Form, Row, Col, Descriptions } from 'antd';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import PageHeader from '../components/PageHeader.jsx';
import DegradedBanner from '../components/DegradedBanner.jsx';
import StatusTag from '../components/StatusTag.jsx';
import EmptyState from '../components/EmptyState.jsx';
import FilterBar, { FilterField } from '../components/FilterBar.jsx';
import { useNavigate } from 'react-router-dom';
import { useDemoState, useDemoActions } from '../state/DemoStore.jsx';
import { selectAllRepairOrders, selectAllDevices } from '../state/selectors.js';
import { REPAIR_LEVELS, FAULT_TYPES, REPAIR_TYPES, REPAIR_PARTS, repairDurationHours } from '../domain/repair.js';

const levelColor = { 紧急: 'red', 严重: 'orange', 一般: 'blue' };
// 任务来源口径按原型：报修任务 / 监测异常 / 快速维修
const sourceLabel = { alarm: '监测异常', report: '报修任务', 'alarm+report': '监测异常', quick: '快速维修' };

// 维修工单列表（store 驱动）：repairOrdersById 全量（报修与维修统一对象）。
// 行操作：执行维修 / 验收 / 详情 / 取消（取消需填原因）；工具栏：新增（快速维修）/ 编辑 / 删除。
export default function RepairOrdersPage() {
  const navigate = useNavigate();
  const { message, modal } = App.useApp();
  const state = useDemoState();
  const actions = useDemoActions();
  const meta = state.meta;

  const [kw, setKw] = useState('');
  const [status, setStatus] = useState(null);
  const [source, setSource] = useState(null);
  const [selectedKeys, setSelectedKeys] = useState([]);

  const [quickOpen, setQuickOpen] = useState(false);
  const [quickForm] = Form.useForm();
  const [quickRequestId, setQuickRequestId] = useState('');
  const [editOpen, setEditOpen] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [editForm] = Form.useForm();
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelTarget, setCancelTarget] = useState(null);
  const [cancelForm] = Form.useForm();

  const orders = selectAllRepairOrders(state);
  const devices = selectAllDevices(state);
  const deviceById = useMemo(() => Object.fromEntries(devices.map(d => [d.deviceId, d])), [devices]);

  const statusOptions = useMemo(
    () => [...new Set(orders.map(o => o.status))].map(v => ({ value: v, label: v })),
    [orders],
  );

  const list = orders
    .filter(o => !status || o.status === status)
    .filter(o => !source || sourceLabel[o.source] === source)
    .filter(o => !kw || (o.code || '').includes(kw) || (o.deviceName || '').includes(kw) || (o.title || '').includes(kw) || (o.assignee || '').includes(kw));

  const canExecute = (o) => ['已派工', '维修中', '挂起'].includes(o.status);
  const canAccept = (o) => o.status === '待验收';
  const canCancel = (o) => ['待派工', '已派工'].includes(o.status);
  const isQuick = (o) => o.source === 'quick';

  // 快速维修新增（原型：直接添加的维修任务信息）
  const openQuick = () => {
    quickForm.resetFields();
    setQuickRequestId(`quick-${Date.now()}-${Math.round(Math.random() * 1e6)}`);
    setQuickOpen(true);
  };
  const submitQuick = async () => {
    const values = await quickForm.validateFields();
    const res = actions.createQuickRepairOrder({ ...values, requestId: quickRequestId });
    message[res.ok ? 'success' : 'error'](res.message);
    if (res.ok) setQuickOpen(false);
  };

  // 编辑：仅快速维修任务可编辑
  const openEdit = (record) => {
    const target = record || orders.find(o => selectedKeys.includes(o.repairOrderId));
    if (!target) { message.warning('请先勾选要编辑的维修任务'); return; }
    if (!isQuick(target)) { message.warning('仅「快速维修」的任务可以编辑'); return; }
    setEditTarget(target);
    editForm.setFieldsValue({
      title: target.title, faultType: target.faultType, level: target.level, faultDesc: target.faultDesc,
      repairType: target.repairType, repairPart: target.repairPart, remark: target.remark,
    });
    setEditOpen(true);
  };
  const submitEdit = async () => {
    const values = await editForm.validateFields();
    const res = actions.updateQuickRepairOrder(editTarget.repairOrderId, values);
    message[res.ok ? 'success' : 'error'](res.message);
    if (res.ok) setEditOpen(false);
  };

  // 删除：仅快速维修且未派工/已取消的任务可删
  const confirmDelete = (record) => {
    const target = record || orders.find(o => selectedKeys.includes(o.repairOrderId));
    if (!target) { message.warning('请先勾选要删除的维修任务'); return; }
    if (!isQuick(target)) { message.warning('仅「快速维修」的任务可以删除'); return; }
    if (!['待派工', '已取消'].includes(target.status)) { message.warning('仅未派工的快速维修任务可以删除'); return; }
    modal.confirm({
      title: '删除快速维修任务',
      content: `确定删除「${target.title}」吗？删除后不可恢复。`,
      okText: '删除', okButtonProps: { danger: true }, cancelText: '取消',
      onOk: () => {
        const res = actions.deleteQuickRepairOrder(target.repairOrderId);
        message[res.ok ? 'success' : 'error'](res.message);
      },
    });
  };

  // 取消任务（需填原因）
  const openCancel = (record) => {
    const target = record || orders.find(o => selectedKeys.includes(o.repairOrderId));
    if (!target) { message.warning('请先勾选要取消的维修任务'); return; }
    setCancelTarget(target);
    cancelForm.resetFields();
    setCancelOpen(true);
  };
  const submitCancel = async () => {
    const values = await cancelForm.validateFields();
    const res = actions.cancelRepairOrder(cancelTarget.repairOrderId, values.reason);
    message[res.ok ? 'success' : 'error'](res.message);
    if (res.ok) setCancelOpen(false);
  };

  const deviceFields = (order) => {
    const d = deviceById[order.deviceId];
    return {
      specModel: d?.model || '--',
      useDept: d?.workshopName || d?.organizationId || '--',
      storageLocation: d ? `${d.lineName || '--'} / ${d.stationName || '--'}` : '--',
      deviceType: d?.type || '--',
    };
  };

  return (
    <>
      <PageHeader
        title="维修任务"
      />
      <DegradedBanner meta={meta} />
      <FilterBar onQuery={() => setKw(kw)} onReset={() => { setKw(''); setStatus(null); setSource(null); }}>
        <FilterField label="工单查询">
          <Input.Search style={{ width: 240 }} placeholder="工单号 / 设备 / 故障名称 / 维修人" allowClear value={kw} onSearch={setKw} onChange={e => setKw(e.target.value)} />
        </FilterField>
        <FilterField label="任务来源">
          <Select style={{ width: 130 }} placeholder="全部来源" allowClear value={source} onChange={setSource}
            options={['报修任务', '监测异常', '快速维修'].map(v => ({ value: v, label: v }))} />
        </FilterField>
        <FilterField label="状态">
          <Select style={{ width: 120 }} placeholder="全部状态" allowClear options={statusOptions} value={status} onChange={setStatus} />
        </FilterField>
      </FilterBar>
      <Card size="small">
        {/* 列表区左上工具栏：新增 / 编辑 / 删除 */}
        <Space wrap style={{ marginBottom: 12 }}>
          <Button type="primary" icon={<Plus size={14} />} onClick={openQuick}>新增</Button>
          <Button icon={<Pencil size={14} />} onClick={() => openEdit(null)}>编辑</Button>
          <Button danger icon={<Trash2 size={14} />} onClick={() => confirmDelete(null)}>删除</Button>
          <span style={{ fontSize: 12, color: '#8a97a3' }}>新增为「快速维修」任务（原型：直接添加的维修任务信息）；仅快速维修的任务可编辑与删除</span>
        </Space>
        <Table
          rowKey="repairOrderId" size="small"
          rowSelection={{ columnWidth: 40, selectedRowKeys: selectedKeys, onChange: setSelectedKeys }}
          dataSource={list}
          onRow={(r) => ({ onClick: () => navigate(`/repair-orders/${r.repairOrderId}`), style: { cursor: 'pointer' } })}
          locale={{ emptyText: <EmptyState description="暂无维修工单" reason={kw || status || source ? '当前筛选条件下没有维修工单' : '尚无维修工单：报修派工、报警转维修或新增快速维修后生成'} /> }}
          columns={[
            { title: '工单号', dataIndex: 'code', width: 150, fixed: 'left' },
            { title: '故障名称', dataIndex: 'title', width: 170, render: v => v || '--' },
            { title: '任务来源', dataIndex: 'source', width: 100, render: v => sourceLabel[v] || v || '--' },
            { title: '维修负责人', dataIndex: 'assignee', width: 100, render: (v, r) => (v ? `${r.assigneeGroup ? r.assigneeGroup + ' ' : ''}${v}` : '--') },
            { title: '设备', dataIndex: 'deviceName', width: 140, render: v => v || '--' },
            { title: '设备编号', dataIndex: 'deviceCode', width: 120, render: v => v || '--' },
            { title: '规格型号', width: 120, render: (_, r) => deviceFields(r).specModel },
            { title: '使用部门', width: 110, render: (_, r) => deviceFields(r).useDept },
            { title: '存放位置', width: 150, render: (_, r) => deviceFields(r).storageLocation },
            { title: '故障类型', dataIndex: 'faultType', width: 90, render: v => v || '--' },
            { title: '故障等级', dataIndex: 'level', width: 90, render: v => <Tag color={levelColor[v] || 'default'}>{v || '--'}</Tag> },
            { title: '故障原因', dataIndex: 'faultCause', width: 150, render: v => v || '--' },
            { title: '维修部位', dataIndex: 'repairPart', width: 100, render: v => v || '--' },
            { title: '维修类型', dataIndex: 'repairType', width: 100, render: v => v || '--' },
            { title: '维修级别', dataIndex: 'repairLevel', width: 90, render: v => v || '--' },
            { title: '报修单号/报警流水号', width: 170, render: (_, r) => r.reportId || r.alarmId || '--' },
            { title: '维修开始时间', dataIndex: 'repairStartTime', width: 150, render: v => v || '--' },
            { title: '维修结束时间', dataIndex: 'repairEndTime', width: 150, render: v => v || '--' },
            {
              title: '维修总时长', width: 110,
              render: (_, r) => {
                const h = repairDurationHours(r.repairStartTime, r.repairEndTime);
                return h === null ? '--' : `${h} 小时`;
              },
            },
            { title: '状态', dataIndex: 'status', width: 100, render: v => <StatusTag value={v} /> },
            { title: 'SLA', dataIndex: 'slaHours', width: 170, render: (v, r) => (v
              ? <Tooltip title={`SLA 时限 ${r.slaDueAt}`}>{v} 小时（{r.slaDueAt} 前）</Tooltip>
              : '--'),
            },
            { title: '创建时间', dataIndex: 'createdAt', width: 150, render: v => v || '--' },
            { title: '返修次数', dataIndex: 'reworkCount', width: 80, render: v => v || 0 },
            {
              title: '操作', width: 180, fixed: 'right',
              render: (_, r) => (
                <Space size={0} onClick={(e) => e.stopPropagation()}>
                  {canExecute(r) && <Button type="link" size="small" onClick={() => navigate(`/repair-orders/${r.repairOrderId}/execute`)}>执行维修</Button>}
                  {canAccept(r) && <Button type="link" size="small" onClick={() => navigate(`/repair-orders/${r.repairOrderId}/accept`)}>验收</Button>}
                  <Button type="link" size="small" onClick={() => navigate(`/repair-orders/${r.repairOrderId}`)}>详情</Button>
                  {canCancel(r) && <Button type="link" size="small" onClick={() => openCancel(r)}>取消</Button>}
                </Space>
              ),
            },
          ]}
          scroll={{ x: 3000 }}
          pagination={{ pageSize: 10, showTotal: t => `共 ${t} 条` }}
        />
      </Card>

      {/* 新增快速维修任务（弹窗，两列布局） */}
      <Modal title="新增快速维修任务" width={720} open={quickOpen} destroyOnHidden
        onCancel={() => setQuickOpen(false)} onOk={submitQuick} okText="确认" cancelText="取消">
        <Form form={quickForm} layout="vertical" initialValues={{ level: '一般', faultType: '其他' }}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="维修任务名称" name="title" required rules={[{ required: true, message: '请输入维修任务名称' }]}>
                <Input placeholder="请输入维修任务名称" maxLength={50} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="维修设备" name="deviceId" required rules={[{ required: true, message: '请选择维修设备' }]}>
                <Select placeholder="请选择维修设备" showSearch optionFilterProp="label"
                  options={devices.map(d => ({ value: d.deviceId, label: `${d.name}（${d.assetCode || d.deviceId}）` }))} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="故障类型" name="faultType">
                <Select placeholder="请选择" options={FAULT_TYPES.map(v => ({ value: v, label: v }))} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="故障等级" name="level">
                <Select placeholder="请选择" options={REPAIR_LEVELS.map(v => ({ value: v, label: v }))} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="维修部位" name="repairPart">
                <Select allowClear placeholder="请选择" options={REPAIR_PARTS.map(v => ({ value: v, label: v }))} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="维修类型" name="repairType">
                <Select allowClear placeholder="请选择" options={REPAIR_TYPES.map(v => ({ value: v, label: v }))} />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item label="故障描述" name="faultDesc" required rules={[{ required: true, message: '请输入故障描述' }]}>
                <Input.TextArea rows={3} placeholder="请输入故障描述" maxLength={500} showCount />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item label="备注" name="remark">
                <Input.TextArea rows={2} placeholder="请输入备注" maxLength={200} showCount />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>

      {/* 编辑快速维修任务（仅快速维修来源可编辑） */}
      <Modal title="编辑快速维修任务" width={720} open={editOpen} destroyOnHidden
        onCancel={() => setEditOpen(false)} onOk={submitEdit} okText="确认" cancelText="取消">
        {editTarget && (
          <Descriptions column={2} size="small" bordered style={{ marginBottom: 12 }}>
            <Descriptions.Item label="工单号">{editTarget.code}</Descriptions.Item>
            <Descriptions.Item label="任务来源">{sourceLabel[editTarget.source] || '--'}</Descriptions.Item>
            <Descriptions.Item label="维修设备">{editTarget.deviceName || '--'}</Descriptions.Item>
            <Descriptions.Item label="当前状态"><StatusTag value={editTarget.status} /></Descriptions.Item>
          </Descriptions>
        )}
        <Form form={editForm} layout="vertical">
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="维修任务名称" name="title" required rules={[{ required: true, message: '请输入维修任务名称' }]}>
                <Input placeholder="请输入维修任务名称" maxLength={50} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="故障类型" name="faultType">
                <Select placeholder="请选择" options={FAULT_TYPES.map(v => ({ value: v, label: v }))} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="故障等级" name="level">
                <Select placeholder="请选择" options={REPAIR_LEVELS.map(v => ({ value: v, label: v }))} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="维修部位" name="repairPart">
                <Select allowClear placeholder="请选择" options={REPAIR_PARTS.map(v => ({ value: v, label: v }))} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="维修类型" name="repairType">
                <Select allowClear placeholder="请选择" options={REPAIR_TYPES.map(v => ({ value: v, label: v }))} />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item label="故障描述" name="faultDesc">
                <Input.TextArea rows={3} placeholder="请输入故障描述" maxLength={500} showCount />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item label="备注" name="remark">
                <Input.TextArea rows={2} placeholder="请输入备注" maxLength={200} showCount />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>

      {/* 取消任务（必须填写取消原因） */}
      <Modal title={`取消维修任务（${cancelTarget?.code || '--'}）`} width={520} open={cancelOpen} destroyOnHidden
        onCancel={() => setCancelOpen(false)} onOk={submitCancel} okText="确认取消" cancelText="取消">
        <Form form={cancelForm} layout="vertical">
          <Form.Item label="取消原因" name="reason" required rules={[{ required: true, message: '请填写取消原因' }]}>
            <Input.TextArea rows={3} placeholder="请填写取消任务的原因" maxLength={200} showCount />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
