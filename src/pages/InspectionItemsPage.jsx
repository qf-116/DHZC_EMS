import React, { useMemo, useState } from 'react';
import { Card, Table, Button, Space, Input, Select, Modal, Form, Tag, App } from 'antd';
import PageHeader from '../components/PageHeader.jsx';
import DegradedBanner from '../components/DegradedBanner.jsx';
import StatusTag from '../components/StatusTag.jsx';
import EmptyState from '../components/EmptyState.jsx';
import { useDemoState } from '../state/DemoStore.jsx';
import { inspectionItems } from '../data/standardData.js';

const TYPE_OPTIONS = ['运行状态检查', '清洁检查', '机械部件检查', '外观检查'].map(v => ({ value: v, label: v }));
const RESULT_TYPE_OPTIONS = ['单选', '数值', '文本'].map(v => ({ value: v, label: v }));
const STATUS_OPTIONS = ['已启用', '已停用'].map(v => ({ value: v, label: v }));

// 点检项目（范围外演示模块，由点巡保养业务模块完整承接）：
// 数据只读来自 standardData.js 演示快照；新增/编辑/删除均为演示交互，不写入 DemoStore。
export default function InspectionItemsPage() {
  const { message } = App.useApp();
  const state = useDemoState();
  const meta = state.meta;

  const [kw, setKw] = useState('');
  const [type, setType] = useState(null);
  const [status, setStatus] = useState(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState(null); // null=新增，对象=编辑
  const [form] = Form.useForm();

  const list = useMemo(() => inspectionItems
    .filter(r => !type || r.type === type)
    .filter(r => !status || r.status === status)
    .filter(r => !kw || (r.code || '').includes(kw) || (r.name || '').includes(kw) || (r.content || '').includes(kw)),
  [kw, type, status]);

  // 项目编号自动生成：XJXM + 演示日期 + 序号（禁用 Date.now，取 meta.demoDay）
  const nextCode = `XJXM${(meta.demoDay || '2026-09-16').replaceAll('-', '')}00${inspectionItems.length + 1}`;

  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({ code: nextCode, resultType: '单选', options: '正常/异常' });
    setEditorOpen(true);
  };
  const openEdit = (record) => {
    setEditing(record);
    form.resetFields();
    form.setFieldsValue(record);
    setEditorOpen(true);
  };

  const handleSubmit = async () => {
    await form.validateFields();
    setEditorOpen(false);
    message.success(`点检项目${editing ? '编辑' : '新增'}完成`);
  };

  const handleDelete = (record) => {
    message.success(`已删除点检项目「${record.name}」（${record.code}）`);
  };

  return (
    <>
      <PageHeader
        title="点检项目"
        subtitle={`数据更新于 ${meta.demoDay}`}
      />
      <DegradedBanner meta={meta} />
      <Card size="small" style={{ marginBottom: 12 }}>
        <Space wrap>
          <Input.Search style={{ width: 240 }} placeholder="项目编号 / 名称 / 内容" allowClear
            onSearch={setKw} onChange={e => { if (!e.target.value) setKw(''); }} />
          <Select style={{ width: 150 }} placeholder="检查类型" allowClear options={TYPE_OPTIONS} value={type} onChange={setType} />
          <Select style={{ width: 120 }} placeholder="状态" allowClear options={STATUS_OPTIONS} value={status} onChange={setStatus} />
          <Button onClick={() => { setKw(''); setType(null); setStatus(null); }}>重置</Button>
        </Space>
      </Card>
      <Card size="small">
        <Space wrap style={{ marginBottom: 12 }}>
          <Button type="primary" onClick={openCreate}>新增点检项目</Button>
        </Space>
        <Table
          rowKey="code" size="small"
          dataSource={list}
          locale={{ emptyText: <EmptyState description="暂无点检项目" reason={kw || type || status ? '当前筛选条件下没有点检项目' : '暂无点检项目数据'} /> }}
          columns={[
            { title: '项目编号', dataIndex: 'code', width: 170, fixed: 'left' },
            { title: '项目名称', dataIndex: 'name', width: 170 },
            { title: '检查类型', dataIndex: 'type', width: 130 },
            { title: '设备类别', dataIndex: 'category', width: 100, render: v => v || '--' },
            { title: '项目内容', dataIndex: 'content', ellipsis: true },
            { title: '判断结果', dataIndex: 'resultType', width: 90, render: (v, r) => (
              <Space size={4}><Tag>{v || '--'}</Tag>{v === '单选' && r.options ? <span style={{ fontSize: 12, color: '#8a97a3' }}>{r.options}</span> : null}</Space>
            ) },
            { title: '正常基准', dataIndex: 'normalValue', width: 130, render: v => v || '--' },
            { title: '状态', dataIndex: 'status', width: 90, render: v => <StatusTag value={v} /> },
            { title: '创建时间', dataIndex: 'createTime', width: 160, render: v => v || '--' },
            {
              title: '操作', width: 130, fixed: 'right',
              render: (_, r) => (
                <Space size={0}>
                  <Button type="link" size="small" onClick={() => openEdit(r)}>编辑</Button>
                  <Button type="link" size="small" danger onClick={() => handleDelete(r)}>删除</Button>
                </Space>
              ),
            },
          ]}
          scroll={{ x: 1400 }}
          pagination={{ pageSize: 10, showTotal: t => `共 ${t} 条` }}
        />
      </Card>

      <Modal
        title={editing ? `编辑点检项目（${editing.code}）` : '新增点检项目'}
        width={620}
        open={editorOpen}
        onCancel={() => setEditorOpen(false)}
        onOk={handleSubmit}
        okText={editing ? '保存' : '创建'}
        cancelText="取消"
      >
        <Form form={form} layout="vertical">
          <Form.Item label="项目编号（自动生成）" name="code" required rules={[{ required: true, message: '请输入项目编号' }]}>
            <Input disabled placeholder="保存时自动生成" />
          </Form.Item>
          <Form.Item label="项目名称" name="name" required rules={[{ required: true, message: '请输入项目名称' }]}>
            <Input placeholder="如：主轴径向跳动检查" maxLength={50} />
          </Form.Item>
          <Space size={12} style={{ display: 'flex' }}>
            <Form.Item label="检查类型" name="type" style={{ width: 180 }} required rules={[{ required: true, message: '请选择检查类型' }]}>
              <Select placeholder="请选择" options={TYPE_OPTIONS} />
            </Form.Item>
            <Form.Item label="判断结果类型" name="resultType" style={{ width: 140 }} required rules={[{ required: true, message: '请选择判断结果类型' }]}>
              <Select placeholder="请选择" options={RESULT_TYPE_OPTIONS} />
            </Form.Item>
            <Form.Item label="状态" name="status" style={{ width: 140 }} initialValue="已启用" rules={[{ required: true, message: '请选择状态' }]}>
              <Select options={STATUS_OPTIONS} />
            </Form.Item>
          </Space>
          <Form.Item label="项目内容（检查方法）" name="content">
            <Input.TextArea rows={2} placeholder="描述检查方法与判定依据" maxLength={200} showCount />
          </Form.Item>
          <Space size={12} style={{ display: 'flex' }} align="start">
            <Form.Item label="单位" name="unit" style={{ width: 120 }}>
              <Input placeholder="如：mm" maxLength={10} />
            </Form.Item>
            <Form.Item label="下限" name="lowerLimit" style={{ width: 130 }}>
              <Input placeholder="如：0.6" />
            </Form.Item>
            <Form.Item label="基准值" name="normalValue" style={{ width: 150 }}>
              <Input placeholder="如：0.6 ~ 0.8 MPa" />
            </Form.Item>
            <Form.Item label="上限" name="upperLimit" style={{ width: 130 }}>
              <Input placeholder="如：0.8" />
            </Form.Item>
          </Space>
          <Form.Item label="备注" name="remark">
            <Input.TextArea rows={2} placeholder="如：联锁失效须立即报修" maxLength={200} showCount />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
