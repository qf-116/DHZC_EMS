import React, { useMemo, useState } from 'react';
import { Card, Table, Button, Space, Input, Select, Tabs, Modal, Form, Tag, App } from 'antd';
import { Plus } from 'lucide-react';
import PageHeader from '../components/PageHeader.jsx';
import DegradedBanner from '../components/DegradedBanner.jsx';
import StatusTag from '../components/StatusTag.jsx';
import EmptyState from '../components/EmptyState.jsx';
import { useDemoState } from '../state/DemoStore.jsx';
import {
  maintenanceItemGroups,
  maintenanceItems,
} from '../data/standardData.js';

const levelColor = { 一级: 'blue', 二级: 'gold', 三级: 'volcano' };
const resultTypeLabel = { 单选: '单选（正常/异常）', 数值: '数值', 文本: '文本' };

// 保养项目基础档案（范围外演示模块）：只读种子 maintenanceItems + maintenanceItemGroups。
// 分组页签展示（对齐原型「选择项目」左侧分组树口径）；新增/编辑仅页面内存演示，
// 删除仅提示不落库——完整闭环由点巡保养业务模块承接，禁止写 DemoStore。
export default function MaintenanceItemsPage() {
  const { message } = App.useApp();
  const state = useDemoState();
  const meta = state.meta;

  const [rows, setRows] = useState(maintenanceItems);
  const [kw, setKw] = useState('');
  const [activeGroup, setActiveGroup] = useState('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form] = Form.useForm();

  const list = useMemo(() => rows
    .filter(r => activeGroup === 'all' || r.group === activeGroup)
    .filter(r => !kw
      || (r.code || '').includes(kw)
      || (r.name || '').includes(kw)
      || (r.part || '').includes(kw)
      || (r.require || '').includes(kw)), [rows, kw, activeGroup]);

  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    setModalOpen(true);
  };
  const openEdit = (record) => {
    setEditing(record);
    form.setFieldsValue(record);
    setModalOpen(true);
  };
  const handleOk = async () => {
    const values = await form.validateFields();
    if (editing) {
      setRows(prev => prev.map(r => (r.code === editing.code ? { ...r, ...values } : r)));
      message.success(`保养项目 ${values.name} 已更新`);
    } else {
      const code = values.code || `BYXM-${String(rows.length + 1).padStart(3, '0')}`;
      if (rows.some(r => r.code === code)) {
        message.error(`保养项目编号 ${code} 已存在`);
        return;
      }
      setRows(prev => [...prev, {
        ...values,
        code,
        group: values.group,
        status: values.status || '已启用',
        createTime: meta.updatedAt,
      }]);
      message.success(`保养项目 ${values.name} 已新增`);
    }
    setModalOpen(false);
  };
  const handleDelete = (record) => {
    // 删除仅演示提示：不修改种子数据、不写 DemoStore
    message.success(`已删除「${record.name}」`);
  };

  const columns = [
    { title: '项目编号', dataIndex: 'code', width: 160, fixed: 'left' },
    { title: '项目名称', dataIndex: 'name', width: 180 },
    { title: '保养类型', dataIndex: 'type', width: 110, render: v => v || '--' },
    { title: '分组', dataIndex: 'group', width: 110, render: v => <Tag>{v || '--'}</Tag> },
    { title: '保养部位', dataIndex: 'part', width: 100, render: v => v || '--' },
    { title: '保养级别', dataIndex: 'level', width: 90, render: v => <Tag color={levelColor[v] || 'default'}>{v || '--'}</Tag> },
    { title: '保养要求', dataIndex: 'require', width: 240, ellipsis: true, render: v => v || '--' },
    { title: '结果类型', dataIndex: 'resultType', width: 140, render: (v, r) => (v
      ? <span>{resultTypeLabel[v] || v}{v === '单选' && r.options ? `：${r.options}` : ''}</span>
      : '--') },
    { title: '备注', dataIndex: 'remark', width: 140, ellipsis: true, render: v => v || '--' },
    { title: '状态', dataIndex: 'status', width: 90, render: v => <StatusTag value={v} /> },
    { title: '创建时间', dataIndex: 'createTime', width: 150, render: v => v || '--' },
    {
      title: '操作', width: 110, fixed: 'right',
      render: (_, r) => (
        <Space size={0}>
          <Button type="link" size="small" onClick={() => openEdit(r)}>编辑</Button>
          <Button type="link" size="small" danger onClick={() => handleDelete(r)}>删除</Button>
        </Space>
      ),
    },
  ];

  const tabItems = [
    { key: 'all', label: `全部（${rows.length}）`, children: null },
    ...maintenanceItemGroups.map(g => ({
      key: g, label: `${g}（${rows.filter(r => r.group === g).length}）`, children: null,
    })),
  ];

  return (
    <>
      <PageHeader
        title="保养项目"
        subtitle={`数据更新于 ${meta.demoDay}`}
      />
      <DegradedBanner meta={meta} />
      <Card size="small" style={{ marginBottom: 12 }}>
        <Space wrap>
          <Input.Search style={{ width: 240 }} placeholder="项目编号 / 名称 / 部位 / 要求" allowClear
            onSearch={setKw} onChange={e => { if (!e.target.value) setKw(''); }} />
          <Button onClick={() => { setKw(''); setActiveGroup('all'); }}>重置</Button>
        </Space>
      </Card>
      <Card size="small">
        <Tabs
          activeKey={activeGroup}
          onChange={setActiveGroup}
          items={tabItems}
          size="small"
        />
        <Space wrap style={{ marginBottom: 12 }}>
          <Button type="primary" icon={<Plus size={14} />} onClick={openCreate}>新增保养项目</Button>
        </Space>
        <Table
          rowKey="code" size="small"
          dataSource={list}
          columns={columns}
          scroll={{ x: 1560 }}
          pagination={{ pageSize: 10, showTotal: t => `共 ${t} 条` }}
          locale={{
            emptyText: (
              <EmptyState
                description="暂无保养项目"
                reason={kw || activeGroup !== 'all' ? '当前筛选 / 分组条件下没有保养项目' : '暂无保养项目数据'}
              />
            ),
          }}
        />
      </Card>

      <Modal
        title={editing ? `编辑保养项目（${editing.code}）` : '新增保养项目'}
        width={640}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={handleOk}
        okText={editing ? '保存' : '新增'}
        cancelText="取消"
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Space wrap style={{ display: 'flex' }}>
            <Form.Item label="项目编号" name="code" style={{ width: 280 }}
              extra={editing ? '编号不可修改' : '留空自动生成编号'}>
              <Input placeholder="如 BYXM20250301001" disabled={!!editing} />
            </Form.Item>
            <Form.Item label="项目名称" name="name" style={{ width: 280 }} rules={[{ required: true, message: '请填写项目名称' }]}>
              <Input placeholder="如 主轴轴承润滑脂更换" maxLength={50} />
            </Form.Item>
          </Space>
          <Space wrap style={{ display: 'flex' }}>
            <Form.Item label="分组" name="group" style={{ width: 180 }} rules={[{ required: true, message: '请选择分组' }]}>
              <Select placeholder="请选择" options={maintenanceItemGroups.map(v => ({ value: v, label: v }))} />
            </Form.Item>
            <Form.Item label="保养类型" name="type" style={{ width: 180 }}>
              <Select placeholder="请选择" allowClear
                options={[...new Set([...maintenanceItemGroups, '其他保养'])].map(v => ({ value: v, label: v }))} />
            </Form.Item>
            <Form.Item label="保养部位" name="part" style={{ width: 180 }}>
              <Input placeholder="如 主轴" maxLength={20} />
            </Form.Item>
            <Form.Item label="保养级别" name="level" style={{ width: 180 }}>
              <Select placeholder="请选择" allowClear options={['一级', '二级', '三级'].map(v => ({ value: v, label: v }))} />
            </Form.Item>
          </Space>
          <Form.Item label="保养要求" name="require">
            <Input.TextArea rows={2} placeholder="如 清理旧脂、加注新脂 200g（SKF LGMT2）" maxLength={200} showCount />
          </Form.Item>
          <Space wrap style={{ display: 'flex' }}>
            <Form.Item label="结果类型" name="resultType" style={{ width: 180 }} initialValue="单选">
              <Select options={['单选', '数值', '文本'].map(v => ({ value: v, label: v }))} />
            </Form.Item>
            <Form.Item label="选项（结果类型为单选时）" name="options" style={{ width: 280 }}>
              <Input placeholder="如 正常/异常" />
            </Form.Item>
            <Form.Item label="状态" name="status" style={{ width: 180 }} initialValue="已启用">
              <Select options={['已启用', '已停用'].map(v => ({ value: v, label: v }))} />
            </Form.Item>
          </Space>
          <Form.Item label="备注" name="remark">
            <Input.TextArea rows={2} maxLength={200} />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
