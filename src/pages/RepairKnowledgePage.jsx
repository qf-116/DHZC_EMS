import React, { useState } from 'react';
import { Card, Table, Tag, Button, Space, Input, Select, App, Modal, Form } from 'antd';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import PageHeader from '../components/PageHeader.jsx';
import { repairKnowledge } from '../data/standardData.js';

// 维修经验库（新增/编辑为弹窗；查询条件/列表字段/按钮严格按原型；按创建时间倒序）
export default function RepairKnowledgePage() {
  const { message, modal } = App.useApp();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  const openModal = (record) => { setEditing(record || null); setModalOpen(true); };

  // 删除维修经验：二次确认（工具栏批量 / 行内单个共用）
  const confirmDelete = (record) => {
    modal.confirm({
      title: '删除维修经验',
      content: record
        ? `确定删除维修经验「${record.name}」吗？删除后数据不可恢复。`
        : '确定删除选中的维修经验吗？删除后数据不可恢复。',
      okText: '删除', okButtonProps: { danger: true }, cancelText: '取消',
      onOk: () => message.success('已删除选中维修经验'),
    });
  };

  return (
    <>
      <PageHeader title="维修经验库" />
      <Card size="small" style={{ marginBottom: 12 }}>
        <Space wrap>
          <Select style={{ width: 110 }} placeholder="故障类型" allowClear options={['过热', '磨损', '异响', '短路', '漏水', '压力不足', '响应故障'].map(v => ({ value: v, label: v }))} />
          <Select style={{ width: 110 }} placeholder="设备类型" allowClear options={['电机', '液压系统', '剪板机', '控制面板', '传动系统'].map(v => ({ value: v, label: v }))} />
          <Select style={{ width: 110 }} placeholder="设备部位" allowClear options={['电机', '液压泵', '刀片', '轴承', '控制面板'].map(v => ({ value: v, label: v }))} />
          <Select style={{ width: 100 }} placeholder="状态" allowClear options={['启用', '停用'].map(v => ({ value: v, label: v }))} />
          <Input style={{ width: 130 }} placeholder="故障名称" allowClear />
          <Button type="primary">查询</Button>
          <Button>重置</Button>
        </Space>
      </Card>
      <Card size="small">
        <Space wrap style={{ marginBottom: 12 }}>
          <Button type="primary" icon={<Plus size={14} />} onClick={() => openModal(null)}>新增</Button>
          <Button icon={<Pencil size={14} />} onClick={() => openModal(repairKnowledge[0])}>编辑</Button>
          <Button danger icon={<Trash2 size={14} />} onClick={() => confirmDelete(null)}>删除</Button>
          <Button onClick={() => message.success('已启用选中项')}>启用</Button>
          <Button onClick={() => message.info('已停用选中项')}>停用</Button>
        </Space>
        <Table
          rowKey="code" size="small" rowSelection={{ columnWidth: 40 }}
          dataSource={repairKnowledge}
          columns={[
            { title: '序号', dataIndex: 'code', width: 60 },
            { title: '维修经验名称', dataIndex: 'name', width: 170 },
            { title: '故障类型', dataIndex: 'faultType', width: 90 },
            { title: '设备类型', dataIndex: 'deviceType', width: 100 },
            { title: '设备部位', dataIndex: 'devicePart', width: 100 },
            { title: '故障描述', dataIndex: 'faultDesc' },
            { title: '故障原因', dataIndex: 'faultReason', width: 120 },
            { title: '维修内容', dataIndex: 'repairContent', width: 180 },
            { title: '图片', width: 60, render: () => '--' },
            { title: '状态', dataIndex: 'status', width: 70, render: v => <Tag color={v === '启用' ? 'success' : 'default'}>{v}</Tag> },
            { title: '创建人', dataIndex: 'creator', width: 70 },
            { title: '创建时间', dataIndex: 'createTime', width: 140 },
            { title: '操作', width: 120, fixed: 'right', render: (_, r) => (
              <Space size={0}>
                <Button type="link" size="small" onClick={() => openModal(r)}>编辑</Button>
                <Button type="link" size="small" danger onClick={() => confirmDelete(r)}>删除</Button>
              </Space>
            ) },
          ]}
          pagination={{ pageSize: 10, showTotal: t => `共 ${t} 条` }}
        />
      </Card>

      {/* 新增/编辑维修经验（弹窗，字段严格按原型） */}
      <Modal
        title={editing ? '编辑维修经验' : '新增维修经验'}
        width={640}
        open={modalOpen}
        destroyOnClose
        onCancel={() => setModalOpen(false)}
        onOk={() => { setModalOpen(false); message.success('保存成功'); }}
        okText="确认" cancelText="取消"
      >
        <Form labelCol={{ span: 6 }} wrapperCol={{ span: 16 }} initialValues={editing || {}}>
          <Form.Item label="维修经验名称" name="name" required><Input placeholder="请输入维修经验名称" /></Form.Item>
          <Form.Item label="故障类型" name="faultType" required>
            <Select placeholder="请选择" options={['过热', '磨损', '异响', '短路', '漏水', '压力不足', '响应故障'].map(v => ({ value: v, label: v }))} />
          </Form.Item>
          <Form.Item label="设备类型" name="deviceType" required>
            <Select placeholder="请选择" options={['电机', '液压系统', '剪板机', '控制面板', '传动系统'].map(v => ({ value: v, label: v }))} />
          </Form.Item>
          <Form.Item label="维修部位" name="devicePart" required>
            <Select placeholder="请选择" options={['电机', '液压泵', '刀片', '轴承', '控制面板'].map(v => ({ value: v, label: v }))} />
          </Form.Item>
          <Form.Item label="故障描述" name="faultDesc"><Input.TextArea rows={3} placeholder="请输入故障描述" /></Form.Item>
          <Form.Item label="故障原因" name="faultReason"><Input.TextArea rows={2} placeholder="请输入故障原因" /></Form.Item>
          <Form.Item label="维修内容" name="repairContent"><Input.TextArea rows={3} placeholder="请输入维修内容" /></Form.Item>
          <Form.Item label="备注"><Input.TextArea rows={2} placeholder="请输入备注" /></Form.Item>
        </Form>
      </Modal>
    </>
  );
}
