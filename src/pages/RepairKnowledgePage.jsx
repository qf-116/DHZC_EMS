import React, { useState } from 'react';
import { Card, Table, Tag, Button, Space, Input, Select, App, Modal, Form, Row, Col } from 'antd';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import PageHeader from '../components/PageHeader.jsx';
import FilterBar, { FilterField } from '../components/FilterBar.jsx';
import { useDemoState, useDemoActions } from '../state/DemoStore.jsx';
import { selectAllRepairKnowledge } from '../state/selectors.js';

const FAULT_TYPES = ['过热', '磨损', '异响', '短路', '漏水', '压力不足', '响应故障', '其他'];
const DEVICE_TYPES = ['电机', '液压系统', '剪板机', '控制面板', '传动系统', '机械系统', '冷却系统', '电路板', '传感器', '轴承', '电源模块', '加工中心', '动力设备'];
const DEVICE_PARTS = ['电机', '液压泵', '刀片', '轴承', '控制面板', '机械系统', '润滑系统', '冷却系统', '电路板', '传感器', '电源模块', '传动系统'];

// 维修经验库（store 驱动）：新增/编辑/删除/启用/停用均落 state（repair/knowledge* 动作）；
// 查询条件/列表字段/按钮严格按原型；按创建时间倒序
export default function RepairKnowledgePage() {
  const { message, modal } = App.useApp();
  const state = useDemoState();
  const actions = useDemoActions();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form] = Form.useForm();
  const [filters, setFilters] = useState({ faultType: undefined, deviceType: undefined, devicePart: undefined, status: undefined, name: '' });
  const [appliedFilters, setAppliedFilters] = useState({ faultType: undefined, deviceType: undefined, devicePart: undefined, status: undefined, name: '' });

  const knowledge = selectAllRepairKnowledge(state);

  const openModal = (record) => {
    setEditing(record || null);
    setModalOpen(true);
  };
  const filteredKnowledge = knowledge.filter(record =>
    (!appliedFilters.faultType || record.faultType === appliedFilters.faultType) &&
    (!appliedFilters.deviceType || record.deviceType === appliedFilters.deviceType) &&
    (!appliedFilters.devicePart || record.devicePart === appliedFilters.devicePart) &&
    (!appliedFilters.status || record.status === appliedFilters.status) &&
    (!appliedFilters.name || (record.name || '').includes(appliedFilters.name.trim())),
  );
  const setFilter = key => value => setFilters(current => ({ ...current, [key]: value?.target ? value.target.value : value }));
  const resetFilters = () => {
    const empty = { faultType: undefined, deviceType: undefined, devicePart: undefined, status: undefined, name: '' };
    setFilters(empty);
    setAppliedFilters(empty);
  };

  // 保存（新增 / 编辑）
  const submit = async () => {
    const values = await form.validateFields();
    const res = editing
      ? actions.updateRepairKnowledge(editing.knowledgeId, values)
      : actions.createRepairKnowledge({ ...values, requestId: `rk-ui-${Date.now()}` });
    message[res.ok ? 'success' : 'error'](res.message);
    if (res.ok) { setModalOpen(false); form.resetFields(); }
  };

  // 删除维修经验：二次确认（工具栏批量 / 行内单个共用）
  const confirmDelete = (record) => {
    modal.confirm({
      title: '删除维修经验',
      content: record
        ? `确定删除维修经验「${record.name}」吗？删除后数据不可恢复。`
        : '确定删除选中的维修经验吗？删除后数据不可恢复。',
      okText: '删除', okButtonProps: { danger: true }, cancelText: '取消',
      onOk: () => {
        const res = actions.deleteRepairKnowledge(record.knowledgeId);
        message[res.ok ? 'success' : 'error'](res.message);
      },
    });
  };

  // 启用 / 停用（工具栏与行内共用）
  const toggleStatus = (record, status) => {
    const res = actions.toggleRepairKnowledgeStatus(record.knowledgeId, status);
    message[res.ok ? 'success' : 'error'](res.message);
  };

  return (
    <>
      <PageHeader title="维修经验库" />
      <FilterBar onQuery={() => setAppliedFilters({ ...filters, name: filters.name.trim() })} onReset={resetFilters}>
        <FilterField label="故障类型">
          <Select style={{ width: 130 }} placeholder="全部类型" allowClear value={filters.faultType} onChange={setFilter('faultType')} options={FAULT_TYPES.map(v => ({ value: v, label: v }))} />
        </FilterField>
        <FilterField label="设备类型">
          <Select style={{ width: 130 }} placeholder="全部类型" allowClear value={filters.deviceType} onChange={setFilter('deviceType')} options={DEVICE_TYPES.map(v => ({ value: v, label: v }))} />
        </FilterField>
        <FilterField label="设备部位">
          <Select style={{ width: 130 }} placeholder="全部部位" allowClear value={filters.devicePart} onChange={setFilter('devicePart')} options={DEVICE_PARTS.map(v => ({ value: v, label: v }))} />
        </FilterField>
        <FilterField label="状态">
          <Select style={{ width: 100 }} placeholder="全部状态" allowClear value={filters.status} onChange={setFilter('status')} options={['启用', '停用'].map(v => ({ value: v, label: v }))} />
        </FilterField>
        <FilterField label="故障名称">
          <Input style={{ width: 150 }} placeholder="请输入名称" allowClear value={filters.name} onChange={setFilter('name')} />
        </FilterField>
      </FilterBar>
      <Card size="small">
        {/* 列表区左上工具栏：新增 / 编辑 / 删除 / 启用 / 停用 */}
        <Space wrap style={{ marginBottom: 12 }}>
          <Button type="primary" icon={<Plus size={14} />} onClick={() => { form.resetFields(); openModal(null); }}>新增</Button>
          <Button icon={<Pencil size={14} />} onClick={() => { form.resetFields(); openModal(filteredKnowledge[0]); }}>编辑</Button>
          <Button danger icon={<Trash2 size={14} />} onClick={() => confirmDelete(filteredKnowledge[0])}>删除</Button>
          <Button onClick={() => filteredKnowledge[0] && toggleStatus(filteredKnowledge[0], '启用')}>启用</Button>
          <Button onClick={() => filteredKnowledge[0] && toggleStatus(filteredKnowledge[0], '停用')}>停用</Button>
          <span style={{ fontSize: 12, color: '#8a97a3' }}>工具栏操作作用于列表首条记录，行内可逐条操作</span>
        </Space>
        <Table
          rowKey="knowledgeId" size="small"
          dataSource={filteredKnowledge}
          columns={[
            { title: '序号', dataIndex: 'code', width: 100 },
            { title: '维修经验名称', dataIndex: 'name', width: 170 },
            { title: '维修内容', dataIndex: 'repairContent', width: 200, render: v => v || '--' },
            { title: '设备类型', dataIndex: 'deviceType', width: 100, render: v => v || '--' },
            { title: '故障描述', dataIndex: 'faultDesc', width: 180, render: v => v || '--' },
            { title: '故障类型', dataIndex: 'faultType', width: 100, render: v => v || '--' },
            { title: '设备部位', dataIndex: 'devicePart', width: 100, render: v => v || '--' },
            { title: '故障原因', dataIndex: 'faultReason', width: 140, render: v => v || '--' },
            { title: '图片', width: 60, render: (_, r) => ((r.images || []).join('、') || '--') },
            { title: '状态', dataIndex: 'status', width: 70, render: v => <Tag color={v === '启用' ? 'success' : 'default'}>{v || '--'}</Tag> },
            { title: '创建人', dataIndex: 'creator', width: 80, render: v => v || '--' },
            { title: '创建时间', dataIndex: 'createTime', width: 140, render: v => v || '--' },
            {
              title: '操作', width: 190, fixed: 'right', render: (_, r) => (
                <Space size={0}>
                  <Button type="link" size="small" onClick={() => { form.resetFields(); openModal(r); }}>编辑</Button>
                  <Button type="link" size="small" onClick={() => toggleStatus(r, r.status === '启用' ? '停用' : '启用')}>{r.status === '启用' ? '停用' : '启用'}</Button>
                  <Button type="link" size="small" danger onClick={() => confirmDelete(r)}>删除</Button>
                </Space>
              )
            },
          ]}
          scroll={{ x: 1600 }}
          pagination={{ pageSize: 10, showTotal: t => `共 ${t} 条` }}
        />
      </Card>

      {/* 新增/编辑维修经验（弹窗，字段严格按原型，两列布局） */}
      <Modal
        title={editing ? '编辑维修经验' : '新增维修经验'}
        width={720}
        open={modalOpen}
        destroyOnHidden
        onCancel={() => setModalOpen(false)}
        onOk={submit}
        okText="确认" cancelText="取消"
      >
        <Form form={form} layout="vertical" initialValues={editing || {}}>
          <Row gutter={16}>
            <Col span={24}>
              <Form.Item label="维修经验名称" name="name" required rules={[{ required: true, message: '请输入维修经验名称' }]}>
                <Input placeholder="请输入维修经验名称" maxLength={50} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="故障类型" name="faultType" required rules={[{ required: true, message: '请选择故障类型' }]}>
                <Select placeholder="请选择" options={FAULT_TYPES.map(v => ({ value: v, label: v }))} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="设备类型" name="deviceType" required rules={[{ required: true, message: '请选择设备类型' }]}>
                <Select placeholder="请选择" options={DEVICE_TYPES.map(v => ({ value: v, label: v }))} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="设备部位" name="devicePart" required rules={[{ required: true, message: '请选择维修部位' }]}>
                <Select placeholder="请选择" options={DEVICE_PARTS.map(v => ({ value: v, label: v }))} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="故障原因" name="faultReason">
                <Input.TextArea rows={2} placeholder="请输入故障原因" maxLength={500} />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item label="故障描述" name="faultDesc">
                <Input.TextArea rows={3} placeholder="请输入故障描述" maxLength={500} />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item label="维修内容" name="repairContent">
                <Input.TextArea rows={3} placeholder="请输入维修内容" maxLength={500} />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item label="备注" name="remark">
                <Input.TextArea rows={2} placeholder="请输入备注" maxLength={200} />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>
    </>
  );
}
