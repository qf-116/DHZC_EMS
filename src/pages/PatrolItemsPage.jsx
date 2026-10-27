import React, { useMemo, useState } from 'react';
import { Card, Table, Button, Space, Input, Select, Tag, App, Modal, Form, Radio } from 'antd';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import PageHeader from '../components/PageHeader.jsx';
import DegradedBanner from '../components/DegradedBanner.jsx';
import StatusTag from '../components/StatusTag.jsx';
import EmptyState from '../components/EmptyState.jsx';
import { useDemoState } from '../state/DemoStore.jsx';
import { patrolItems } from '../data/standardData.js';

const RESULT_TYPES = ['单选', '数值', '文本'];
const ITEM_TYPES = ['外观检查', '运行状态检查', '机械部件检查', '清洁检查'];

// 巡检项目（范围外演示模块）：数据只读来自 standardData.js 种子快照；
// 新增/编辑为演示弹窗（不落快照），删除仅演示提示——完整闭环由点巡保养业务模块承接。
export default function PatrolItemsPage() {
  const state = useDemoState();
  const meta = state.meta;
  const { message, modal } = App.useApp();

  const [kw, setKw] = useState('');
  const [status, setStatus] = useState(null);
  const [resultType, setResultType] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null); // null=新增，对象=编辑
  const [form] = Form.useForm();

  const list = useMemo(() => patrolItems
    .filter(r => !status || r.status === status)
    .filter(r => !resultType || r.resultType === resultType)
    .filter(r => {
      const k = (kw || '').trim().toLowerCase();
      if (!k) return true;
      return [r.code, r.name, r.type, r.content].some(v => (v || '').toLowerCase().includes(k));
    }), [kw, status, resultType]);

  const openModal = (record) => {
    setEditing(record || null);
    form.setFieldsValue(record || {
      name: '', type: '外观检查', content: '', resultType: '单选', options: '正常/异常', normalRange: '', remark: '', status: '已启用',
    });
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    try { await form.validateFields(); } catch { return; }
    message.success(`巡检项目${editing ? '编辑' : '新增'}完成`);
    setModalOpen(false);
  };

  const confirmDelete = (record) => modal.confirm({
    title: '删除巡检项目',
    content: `确定删除巡检项目「${record.name}（${record.code}）」吗？`,
    okText: '删除', okButtonProps: { danger: true }, cancelText: '取消',
    onOk: () => message.success('已删除'),
  });

  const columns = [
    { title: '项目编号', dataIndex: 'code', width: 180, fixed: 'left' },
    { title: '项目名称', dataIndex: 'name', width: 150 },
    { title: '项目类型', dataIndex: 'type', width: 130, render: v => v || '--' },
    { title: '检查内容', dataIndex: 'content', ellipsis: true, render: v => v || '--' },
    {
      title: '判断结果类型', dataIndex: 'resultType', width: 110,
      render: (v, r) => <Tag color="processing">{v}{v === '单选' && r.options ? `：${r.options}` : ''}</Tag>,
    },
    { title: '正常范围', dataIndex: 'normalRange', width: 100, render: v => v || '--' },
    { title: '备注', dataIndex: 'remark', width: 140, ellipsis: true, render: v => v || '--' },
    { title: '状态', dataIndex: 'status', width: 90, render: v => <StatusTag value={v} /> },
    { title: '创建时间', dataIndex: 'createTime', width: 150, render: v => v || '--' },
    {
      title: '操作', width: 120, fixed: 'right',
      render: (_, r) => (
        <Space size={0}>
          <Button type="link" size="small" icon={<Pencil size={12} />} onClick={() => openModal(r)}>编辑</Button>
          <Button type="link" size="small" danger icon={<Trash2 size={12} />} onClick={() => confirmDelete(r)}>删除</Button>
        </Space>
      ),
    },
  ];

  return (
    <>
      <PageHeader title="巡检项目" />
      <DegradedBanner meta={meta} />
      <Card size="small" style={{ marginBottom: 12 }}>
        <Space wrap>
          <Input.Search style={{ width: 240 }} placeholder="项目编号 / 名称 / 内容" allowClear onSearch={setKw} onChange={e => { if (!e.target.value) setKw(''); }} />
          <Select style={{ width: 120 }} placeholder="状态" allowClear value={status} onChange={setStatus}
            options={[...new Set(patrolItems.map(r => r.status))].map(v => ({ value: v, label: v }))} />
          <Select style={{ width: 140 }} placeholder="判断结果类型" allowClear value={resultType} onChange={setResultType}
            options={RESULT_TYPES.map(v => ({ value: v, label: v }))} />
          <Button onClick={() => { setKw(''); setStatus(null); setResultType(null); }}>重置</Button>
        </Space>
      </Card>
      <Card size="small">
        <Space wrap style={{ marginBottom: 12 }}>
          <Button type="primary" icon={<Plus size={14} />} onClick={() => openModal(null)}>新增巡检项目</Button>
        </Space>
        <Table
          rowKey="code" size="small" columns={columns} dataSource={list} scroll={{ x: 1500 }}
          locale={{ emptyText: <EmptyState description="暂无巡检项目" reason={kw || status || resultType ? '当前筛选条件下没有巡检项目' : '暂无巡检项目数据'} /> }}
          pagination={{ pageSize: 10, showTotal: t => `共 ${t} 条` }}
        />
      </Card>
      <Modal
        title={editing ? `编辑巡检项目 · ${editing.code}` : '新增巡检项目'}
        open={modalOpen}
        onOk={handleSubmit}
        onCancel={() => setModalOpen(false)}
        okText="保存" cancelText="取消"
        width={640}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" size="small">
          <Space style={{ display: 'flex', gap: 12 }} align="start">
            <Form.Item name="name" label="项目名称" rules={[{ required: true, message: '请输入项目名称' }]} style={{ flex: 1, minWidth: 200 }}>
              <Input placeholder="如：设备外观检查" />
            </Form.Item>
            <Form.Item name="type" label="项目类型" style={{ minWidth: 160 }}>
              <Select options={ITEM_TYPES.map(v => ({ value: v, label: v }))} />
            </Form.Item>
          </Space>
          <Form.Item name="content" label="检查内容" rules={[{ required: true, message: '请输入检查内容' }]}>
            <Input.TextArea rows={2} placeholder="检查内容与方法描述" />
          </Form.Item>
          <Form.Item name="resultType" label="判断结果类型" rules={[{ required: true }]}>
            <Radio.Group options={RESULT_TYPES.map(v => ({ value: v, label: v }))} />
          </Form.Item>
          <Form.Item noStyle shouldUpdate={(a, b) => a.resultType !== b.resultType}>
            {({ getFieldValue }) => getFieldValue('resultType') === '单选' && (
              <Form.Item name="options" label="单选选项（以 / 分隔）">
                <Input placeholder="正常/异常" />
              </Form.Item>
            )}
          </Form.Item>
          <Form.Item noStyle shouldUpdate={(a, b) => a.resultType !== b.resultType}>
            {({ getFieldValue }) => getFieldValue('resultType') === '数值' && (
              <Form.Item name="normalRange" label="正常范围">
                <Input placeholder="如：0 ~ 25（mm/s）" />
              </Form.Item>
            )}
          </Form.Item>
          <Form.Item name="remark" label="备注">
            <Input.TextArea rows={2} placeholder="选填" />
          </Form.Item>
          <Form.Item name="status" label="状态">
            <Radio.Group options={['已启用', '已停用'].map(v => ({ value: v, label: v }))} />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
