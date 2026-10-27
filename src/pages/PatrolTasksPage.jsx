import React, { useMemo, useState } from 'react';
import { Card, Table, Button, Space, Input, Select, Modal, Form, App, Popconfirm, InputNumber, DatePicker, Alert } from 'antd';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import PageHeader from '../components/PageHeader.jsx';
import DegradedBanner from '../components/DegradedBanner.jsx';
import StatusTag from '../components/StatusTag.jsx';
import EmptyState from '../components/EmptyState.jsx';
import { useDemoState } from '../state/DemoStore.jsx';
import { patrolTasks, patrolPlans } from '../data/standardData.js';

// 巡检任务（范围外演示模块）：列表读自 standardData.js 种子快照。
// 行点击进入详情，「执行」进入执行页；新增（临时任务，不从计划生成）/ 编辑 / 删除
// 为页面内演示交互（不写入 DemoStore，刷新后恢复快照）。
// 状态枚举：未开始 / 进行中 / 已完成 / 已逾期 / 逾期完成。
export default function PatrolTasksPage() {
  const navigate = useNavigate();
  const { message } = App.useApp();
  const state = useDemoState();
  const meta = state.meta;

  const [kw, setKw] = useState('');
  const [status, setStatus] = useState(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState(null); // null=新增临时任务，对象=编辑
  const [form] = Form.useForm();
  const [extraRows, setExtraRows] = useState([]);
  const [deletedCodes, setDeletedCodes] = useState(() => new Set());
  const [patches, setPatches] = useState({});

  const rows = useMemo(() => [
    ...extraRows,
    ...patrolTasks.filter(r => !deletedCodes.has(r.code)).map(r => (patches[r.code] ? { ...r, ...patches[r.code] } : r)),
  ], [extraRows, deletedCodes, patches]);

  const canExecute = (r) => ['未开始', '进行中', '已逾期'].includes(r.status);

  const list = useMemo(() => rows
    .filter(r => !status || r.status === status)
    .filter(r => {
      const k = (kw || '').trim().toLowerCase();
      if (!k) return true;
      return [r.code, r.name, r.plan, r.owner].some(v => (v || '').toLowerCase().includes(k));
    })
    .slice()
    .sort((a, b) => (b.date || '').localeCompare(a.date || '')), [rows, kw, status]);

  const nextCode = `XJJH-P${(meta.demoDay || '2026-09-16').replaceAll('-', '')}-LS${String(extraRows.length + 1).padStart(3, '0')}`;

  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({ code: nextCode, shouldCount: 1 });
    setEditorOpen(true);
  };
  const openEdit = (record) => {
    setEditing(record);
    form.resetFields();
    form.setFieldsValue({ ...record, date: record.date ? dayjs(record.date) : undefined });
    setEditorOpen(true);
  };
  const handleSubmit = async () => {
    const values = await form.validateFields();
    const date = values.date?.format('YYYY-MM-DD') ?? editing?.date;
    const base = { ...(editing || {}), ...values, date, dateValue: undefined };
    if (editing) {
      setPatches(prev => ({ ...prev, [editing.code]: { ...prev[editing.code], ...base } }));
      message.success(`巡检任务「${editing.code}」已保存`);
    } else {
      setExtraRows(prev => [{ ...base, code: values.code || nextCode, status: '未开始', createTime: `${meta.updatedAt || meta.demoDay || ''}` }, ...prev]);
      message.success(`临时巡检任务「${values.name}」已创建（不从计划生成）`);
    }
    setEditorOpen(false);
  };
  const handleDelete = (record) => {
    if (extraRows.some(r => r.code === record.code)) setExtraRows(prev => prev.filter(r => r.code !== record.code));
    else setDeletedCodes(prev => new Set(prev).add(record.code));
    message.success(`已删除巡检任务「${record.code}」`);
  };

  const columns = [
    { title: '任务编号', dataIndex: 'code', width: 200, fixed: 'left' },
    { title: '任务名称', dataIndex: 'name', width: 170 },
    { title: '巡检线路（计划）', dataIndex: 'plan', width: 180, render: v => v || <span style={{ color: '#9aa7b5' }}>临时任务</span> },
    { title: '巡检日期', dataIndex: 'date', width: 110, render: v => v || '--' },
    { title: '应巡设备数', dataIndex: 'shouldCount', width: 100, align: 'center', render: v => (v != null ? `${v} 台` : '--') },
    { title: '执行人', dataIndex: 'owner', width: 120, render: v => v || '--' },
    {
      title: '状态', dataIndex: 'status', width: 110,
      render: (v, r) => <StatusTag value={v} tip={v === '逾期完成' ? '超过计划完成时间后完成' : undefined} />,
    },
    { title: '创建时间', dataIndex: 'createTime', width: 160, render: v => v || '--' },
    {
      title: '操作', width: 190, fixed: 'right',
      render: (_, r) => (
        <Space size={0} onClick={(e) => e.stopPropagation()}>
          {canExecute(r) && (
            <Button type="link" size="small" onClick={() => navigate(`/patrol-tasks/execute?id=${encodeURIComponent(r.code)}`)}>执行</Button>
          )}
          <Button type="link" size="small" onClick={() => navigate(`/patrol-tasks/detail?id=${encodeURIComponent(r.code)}`)}>详情</Button>
          <Button type="link" size="small" onClick={() => openEdit(r)}>编辑</Button>
          {r.status === '未开始' && (
            <Popconfirm title="删除该任务？" okButtonProps={{ danger: true }} onConfirm={() => handleDelete(r)}>
              <Button type="link" size="small" danger>删除</Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="巡检任务"
        subtitle={`数据更新于 ${meta.updatedAt}`}
      />
      <DegradedBanner meta={meta} />
      <Card size="small" style={{ marginBottom: 12 }}>
        <Space wrap>
          <Input.Search style={{ width: 240 }} placeholder="任务编号 / 线路 / 执行人" allowClear onSearch={setKw} onChange={e => { if (!e.target.value) setKw(''); }} />
          <Select style={{ width: 120 }} placeholder="状态" allowClear value={status} onChange={setStatus}
            options={[...new Set(rows.map(r => r.status))].map(v => ({ value: v, label: v }))} />
          <Button onClick={() => { setKw(''); setStatus(null); }}>重置</Button>
        </Space>
      </Card>
      <Card size="small">
        <Space wrap style={{ marginBottom: 12 }}>
          <Button type="primary" onClick={openCreate}>新增临时任务</Button>
        </Space>
        <Table
          rowKey="code" size="small" columns={columns} dataSource={list} scroll={{ x: 1440 }}
          onRow={(r) => ({ onClick: () => navigate(`/patrol-tasks/detail?id=${encodeURIComponent(r.code)}`), style: { cursor: 'pointer' } })}
          locale={{ emptyText: <EmptyState description="暂无巡检任务" reason={kw || status ? '当前筛选条件下没有巡检任务' : '暂无巡检任务数据'} /> }}
          pagination={{ pageSize: 10, showTotal: t => `共 ${t} 条` }}
        />
      </Card>

      <Modal
        title={editing ? `编辑巡检任务（${editing.code}）` : '新增临时巡检任务'}
        width={640}
        open={editorOpen}
        onCancel={() => setEditorOpen(false)}
        onOk={handleSubmit}
        okText={editing ? '保存' : '创建'}
        cancelText="取消"
        destroyOnClose
      >
        <Alert
          type="info" showIcon style={{ marginBottom: 16 }}
          message={editing ? '编辑保存后同步更新该任务的执行信息。' : '临时任务不从巡检计划生成，适用于临时安排的巡检工作。'}
        />
        <Form form={form} layout="vertical">
          <Form.Item label="任务编号" name="code"><Input disabled /></Form.Item>
          <Form.Item label="任务名称" name="name" rules={[{ required: true, message: '请输入任务名称' }]}><Input placeholder="例如：动力站夜间临时巡检" /></Form.Item>
          <Form.Item label="关联计划" name="plan"><Select allowClear placeholder="临时任务可不关联计划" options={patrolPlans.map(p => ({ value: p.name, label: `${p.name}（${p.code}）` }))} /></Form.Item>
          <Form.Item label="巡检日期" name="date" rules={[{ required: true, message: '请选择巡检日期' }]}><DatePicker style={{ width: '100%' }} /></Form.Item>
          <Form.Item label="应巡设备数" name="shouldCount" rules={[{ required: true, message: '请输入应巡设备数' }]}><InputNumber min={1} style={{ width: '100%' }} /></Form.Item>
          <Form.Item label="执行人" name="owner"><Input placeholder="例如：王强" /></Form.Item>
          <Form.Item label="备注" name="remark"><Input.TextArea rows={2} maxLength={200} /></Form.Item>
        </Form>
      </Modal>
    </>
  );
}
