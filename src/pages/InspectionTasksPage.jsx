import React, { useMemo, useState } from 'react';
import { Card, Table, Button, Space, Input, Select, Modal, Form, App, Popconfirm, InputNumber, DatePicker, Alert } from 'antd';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import PageHeader from '../components/PageHeader.jsx';
import DegradedBanner from '../components/DegradedBanner.jsx';
import StatusTag from '../components/StatusTag.jsx';
import EmptyState from '../components/EmptyState.jsx';
import { useDemoState } from '../state/DemoStore.jsx';
import { inspectionTasks, inspectionPlans } from '../data/standardData.js';

// 状态展示口径：种子状态 → 展示状态（待执行/进行中/已完成/已关闭/已逾期）。
// 已逾期为派生口径：点检日期早于演示日期且任务尚未完结（未开始/进行中）时展示，种子原始值放 Tooltip。
const STATUS_LABEL = { 未开始: '待执行', 进行中: '进行中', 已完成: '已完成', 已关闭: '已关闭', 已逾期: '已逾期' };

// 点检任务（范围外演示模块，由点巡保养业务模块完整承接）：
// 任务列表读自 standardData.js 演示快照；行点击进入任务详情，可执行任务进入执行页。
// 新增（临时任务，不从计划生成）/ 编辑 / 删除为页面内演示交互（不写入 DemoStore，刷新后恢复快照）。
export default function InspectionTasksPage() {
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

  const isOverdue = (t) => t.date && meta.demoDay && t.date < meta.demoDay && ['未开始', '进行中'].includes(t.status);
  const displayStatus = (t) => (isOverdue(t) ? '已逾期' : (STATUS_LABEL[t.status] || t.status));

  const rows = useMemo(() => [
    ...extraRows,
    ...inspectionTasks.filter(r => !deletedCodes.has(r.code)).map(r => (patches[r.code] ? { ...r, ...patches[r.code] } : r)),
  ], [extraRows, deletedCodes, patches]);

  const statusOptions = [...new Set(rows.map(t => displayStatus(t)))].map(v => ({ value: v, label: v }));
  const list = rows
    .filter(t => !status || displayStatus(t) === status)
    .filter(t => !kw || (t.code || '').includes(kw) || (t.name || '').includes(kw) || (t.owner || '').includes(kw));

  const nextCode = `XJJH${(meta.demoDay || '2026-09-16').replaceAll('-', '')}-LS${String(extraRows.length + 1).padStart(3, '0')}`;

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
      message.success(`点检任务「${editing.code}」已保存`);
    } else {
      setExtraRows(prev => [{ ...base, code: values.code || nextCode, status: '未开始', createTime: `${meta.updatedAt || meta.demoDay || ''}` }, ...prev]);
      message.success(`临时点检任务「${values.name}」已创建（不从计划生成）`);
    }
    setEditorOpen(false);
  };
  const handleDelete = (record) => {
    if (extraRows.some(r => r.code === record.code)) setExtraRows(prev => prev.filter(r => r.code !== record.code));
    else setDeletedCodes(prev => new Set(prev).add(record.code));
    message.success(`已删除点检任务「${record.code}」`);
  };

  return (
    <>
      <PageHeader
        title="点检任务"
        subtitle={`数据更新于 ${meta.demoDay}`}
      />
      <DegradedBanner meta={meta} />
      <Card size="small" style={{ marginBottom: 12 }}>
        <Space wrap>
          <Input.Search style={{ width: 240 }} placeholder="任务编号 / 计划 / 执行人" allowClear
            onSearch={setKw} onChange={e => { if (!e.target.value) setKw(''); }} />
          <Select style={{ width: 120 }} placeholder="状态" allowClear options={statusOptions} value={status} onChange={setStatus} />
          <Button onClick={() => { setKw(''); setStatus(null); }}>重置</Button>
        </Space>
      </Card>
      <Card size="small">
        <Space wrap style={{ marginBottom: 12 }}>
          <Button type="primary" onClick={openCreate}>新增临时任务</Button>
        </Space>
        <Table
          rowKey="code" size="small"
          dataSource={list}
          onRow={(r) => ({ onClick: () => navigate(`/inspection-tasks/detail?code=${encodeURIComponent(r.code)}`), style: { cursor: 'pointer' } })}
          locale={{ emptyText: <EmptyState description="暂无点检任务" reason={kw || status ? '当前筛选条件下没有点检任务' : '暂无点检任务数据'} /> }}
          columns={[
            { title: '任务编号', dataIndex: 'code', width: 180, fixed: 'left' },
            { title: '所属计划', dataIndex: 'plan', width: 190, render: v => v || <span style={{ color: '#9aa7b5' }}>临时任务</span> },
            { title: '任务名称', dataIndex: 'name', width: 150, render: v => v || '--' },
            { title: '应检设备数', dataIndex: 'shouldCount', width: 100, render: v => v ?? '--' },
            { title: '点检日期', dataIndex: 'date', width: 110, render: v => v || '--' },
            { title: '班组', dataIndex: 'group', width: 110, render: v => v || '--' },
            { title: '执行人', dataIndex: 'owner', width: 100, render: v => v || '--' },
            {
              title: '状态', dataIndex: 'status', width: 100,
              render: (v, r) => <StatusTag value={displayStatus(r)} tip={`当前状态：${v} · 点检日期：${r.date || '--'}`} />,
            },
            { title: '创建时间', dataIndex: 'createTime', width: 160, render: v => v || '--' },
            { title: '备注', dataIndex: 'remark', ellipsis: true, render: v => v || '--' },
            {
              title: '操作', width: 200, fixed: 'right',
              render: (_, r) => (
                <Space size={0} onClick={(e) => e.stopPropagation()}>
                  {['未开始', '进行中'].includes(r.status) && !isOverdue(r) && (
                    <Button type="link" size="small" onClick={() => navigate(`/inspection-tasks/execute?code=${encodeURIComponent(r.code)}`)}>执行</Button>
                  )}
                  <Button type="link" size="small" onClick={() => navigate(`/inspection-tasks/detail?code=${encodeURIComponent(r.code)}`)}>详情</Button>
                  <Button type="link" size="small" onClick={() => openEdit(r)}>编辑</Button>
                  {r.status === '未开始' && (
                    <Popconfirm title="删除该任务？" okButtonProps={{ danger: true }} onConfirm={() => handleDelete(r)}>
                      <Button type="link" size="small" danger>删除</Button>
                    </Popconfirm>
                  )}
                </Space>
              ),
            },
          ]}
          scroll={{ x: 1420 }}
          pagination={{ pageSize: 10, showTotal: t => `共 ${t} 条` }}
        />
      </Card>

      <Modal
        title={editing ? `编辑点检任务（${editing.code}）` : '新增临时点检任务'}
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
          message={editing ? '编辑保存后同步更新该任务的执行信息。' : '临时任务不从点检计划生成，适用于临时安排的点检工作。'}
        />
        <Form form={form} layout="vertical">
          <Form.Item label="任务编号" name="code"><Input disabled /></Form.Item>
          <Form.Item label="任务名称" name="name" rules={[{ required: true, message: '请输入任务名称' }]}><Input placeholder="例如：数控车床开机前临时点检" /></Form.Item>
          <Form.Item label="关联计划" name="plan"><Select allowClear placeholder="临时任务可不关联计划" options={inspectionPlans.map(p => ({ value: p.name, label: `${p.name}（${p.code}）` }))} /></Form.Item>
          <Form.Item label="点检日期" name="date" rules={[{ required: true, message: '请选择点检日期' }]}><DatePicker style={{ width: '100%' }} /></Form.Item>
          <Form.Item label="应检设备数" name="shouldCount" rules={[{ required: true, message: '请输入应检设备数' }]}><InputNumber min={1} style={{ width: '100%' }} /></Form.Item>
          <Form.Item label="执行人" name="owner"><Input placeholder="例如：李四" /></Form.Item>
          <Form.Item label="备注" name="remark"><Input.TextArea rows={2} maxLength={200} /></Form.Item>
        </Form>
      </Modal>
    </>
  );
}
