import React, { useMemo, useState } from 'react';
import { Card, Table, Button, Space, Input, Select, Progress, Modal, Form, App, Alert, Popconfirm, InputNumber, DatePicker } from 'antd';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import PageHeader from '../components/PageHeader.jsx';
import DegradedBanner from '../components/DegradedBanner.jsx';
import StatusTag from '../components/StatusTag.jsx';
import EmptyState from '../components/EmptyState.jsx';
import { useDemoState } from '../state/DemoStore.jsx';
import { inspectionPlans } from '../data/standardData.js';

// 点检计划（范围外演示模块，由点巡保养业务模块完整承接）：
// 计划列表读自 standardData.js 演示快照；新增 / 编辑 / 提前完结 / 删除为页面内演示交互
//（不写入 DemoStore，刷新后恢复快照）。口径对齐原型：未开始可删除（任务一并删除），
// 进行中可提前完结（已生成任务仍可执行，计划不再生成新任务）。
const CYCLE_OPTIONS = ['日', '周', '月', '自定义'].map(v => ({ value: v, label: v }));

export default function InspectionPlansPage() {
  const navigate = useNavigate();
  const { message } = App.useApp();
  const state = useDemoState();
  const meta = state.meta;

  const [kw, setKw] = useState('');
  const [status, setStatus] = useState(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState(null); // null=新增，对象=编辑
  const [form] = Form.useForm();
  // 演示交互的页面内落地：新增行 / 已删除编号 / 字段补丁（编辑、完结）
  const [extraRows, setExtraRows] = useState([]);
  const [deletedCodes, setDeletedCodes] = useState(() => new Set());
  const [patches, setPatches] = useState({});

  const rows = useMemo(() => [
    ...extraRows,
    ...inspectionPlans.filter(r => !deletedCodes.has(r.code)).map(r => (patches[r.code] ? { ...r, ...patches[r.code] } : r)),
  ], [extraRows, deletedCodes, patches]);

  const statusOptions = [...new Set(rows.map(p => p.status))].map(v => ({ value: v, label: v }));
  const list = rows
    .filter(p => !status || p.status === status)
    .filter(p => !kw || (p.code || '').includes(kw) || (p.name || '').includes(kw) || (p.owner || '').includes(kw));

  const nextCode = `XJJH${(meta.demoDay || '2026-09-16').replaceAll('-', '')}${String(inspectionPlans.length + extraRows.length + 1).padStart(3, '0')}`;

  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({ code: nextCode, cycle: '日', interval: 1 });
    setEditorOpen(true);
  };
  const openEdit = (record) => {
    setEditing(record);
    form.resetFields();
    form.setFieldsValue({
      ...record,
      range: record.startDate && record.endDate ? [dayjs(record.startDate), dayjs(record.endDate)] : undefined,
    });
    setEditorOpen(true);
  };
  const handleSubmit = async () => {
    const values = await form.validateFields();
    const base = {
      ...(editing || {}),
      ...values,
      startDate: values.range?.[0]?.format('YYYY-MM-DD') ?? (editing?.startDate || undefined),
      endDate: values.range?.[1]?.format('YYYY-MM-DD') ?? (editing?.endDate || undefined),
      range: undefined,
      deviceCount: editing ? editing.deviceCount : 0,
      totalTasks: editing ? editing.totalTasks : 0,
      doneTasks: editing ? editing.doneTasks : 0,
      createTime: editing ? editing.createTime : `${meta.updatedAt || meta.demoDay || ''}`,
    };
    if (editing) {
      setPatches(prev => ({ ...prev, [editing.code]: { ...prev[editing.code], ...base } }));
      message.success(`点检计划「${values.name}」已保存，变更将同步到未执行的任务及后续按周期生成的任务`);
    } else {
      setExtraRows(prev => [{ ...base, code: values.code || nextCode, status: '未开始' }, ...prev]);
      message.success(`点检计划「${values.name}」已创建，系统将按周期自动生成点检任务`);
    }
    setEditorOpen(false);
  };
  const handleFinish = (record) => {
    setPatches(prev => ({ ...prev, [record.code]: { ...prev[record.code], status: '已关闭' } }));
    message.success(`计划「${record.name}」已提前完结，已生成的任务仍可继续执行，计划不再生成新任务`);
  };
  const handleDelete = (record) => {
    if (extraRows.some(r => r.code === record.code)) setExtraRows(prev => prev.filter(r => r.code !== record.code));
    else setDeletedCodes(prev => new Set(prev).add(record.code));
    message.success(`已删除计划「${record.name}」（${record.code}），对应生成的点检任务一并删除`);
  };

  return (
    <>
      <PageHeader
        title="点检计划"
        subtitle={`数据更新于 ${meta.demoDay}`}
      />
      <DegradedBanner meta={meta} />
      <Card size="small" style={{ marginBottom: 12 }}>
        <Space wrap>
          <Input.Search style={{ width: 240 }} placeholder="计划编号 / 名称 / 负责人" allowClear
            onSearch={setKw} onChange={e => { if (!e.target.value) setKw(''); }} />
          <Select style={{ width: 120 }} placeholder="状态" allowClear options={statusOptions} value={status} onChange={setStatus} />
          <Button onClick={() => { setKw(''); setStatus(null); }}>重置</Button>
        </Space>
      </Card>
      <Card size="small">
        <Space wrap style={{ marginBottom: 12 }}>
          <Button type="primary" onClick={openCreate}>新增点检计划</Button>
        </Space>
        <Table
          rowKey="code" size="small"
          dataSource={list}
          onRow={(r) => ({ onClick: () => navigate(`/inspection-plans/detail?code=${encodeURIComponent(r.code)}`), style: { cursor: 'pointer' } })}
          locale={{ emptyText: <EmptyState description="暂无点检计划" reason={kw || status ? '当前筛选条件下没有点检计划' : '暂无点检计划数据'} /> }}
          columns={[
            { title: '计划编号', dataIndex: 'code', width: 170, fixed: 'left' },
            { title: '计划名称', dataIndex: 'name', width: 200 },
            { title: '起止日期', width: 200, render: (_, r) => `${r.startDate || '--'} ~ ${r.endDate || '--'}` },
            { title: '周期', width: 150, render: (_, r) => `${r.cycle || '--'} / ${r.interval ?? '--'} 天` },
            { title: '跳过规则', dataIndex: 'skip', width: 160, render: v => v || '--' },
            { title: '负责人', dataIndex: 'owner', width: 110, render: v => v || '--' },
            { title: '设备范围', dataIndex: 'deviceCount', width: 90, render: v => (v != null ? `${v} 台` : '--') },
            {
              title: '任务完成情况', width: 180,
              render: (_, r) => (
                <Space size={6}>
                  <Progress percent={r.totalTasks ? Math.round((r.doneTasks / r.totalTasks) * 100) : 0} size="small" style={{ width: 90 }} />
                  <span style={{ fontSize: 12, color: '#8a97a3' }}>{r.doneTasks ?? '--'}/{r.totalTasks ?? '--'}</span>
                </Space>
              ),
            },
            { title: '状态', dataIndex: 'status', width: 90, render: v => <StatusTag value={v} /> },
            { title: '备注', dataIndex: 'remark', ellipsis: true, render: v => v || '--' },
            {
              title: '操作', width: 180, fixed: 'right',
              render: (_, r) => (
                <Space size={0} onClick={(e) => e.stopPropagation()}>
                  <Button type="link" size="small" onClick={() => navigate(`/inspection-plans/detail?code=${encodeURIComponent(r.code)}`)}>详情</Button>
                  <Button type="link" size="small" onClick={() => openEdit(r)}>编辑</Button>
                  {['未开始', '进行中'].includes(r.status) && (
                    <Popconfirm title="提前完结该计划？" description="已生成的任务仍可继续执行，计划不再生成新任务" onConfirm={() => handleFinish(r)}>
                      <Button type="link" size="small">完结</Button>
                    </Popconfirm>
                  )}
                  {r.status === '未开始' && (
                    <Popconfirm title="删除该计划？" description="删除后对应生成的点检任务将一并删除" okButtonProps={{ danger: true }} onConfirm={() => handleDelete(r)}>
                      <Button type="link" size="small" danger>删除</Button>
                    </Popconfirm>
                  )}
                </Space>
              ),
            },
          ]}
          scroll={{ x: 1600 }}
          pagination={{ pageSize: 10, showTotal: t => `共 ${t} 条` }}
        />
      </Card>

      <Modal
        title={editing ? `编辑点检计划（${editing.code}）` : '新增点检计划'}
        width={680}
        open={editorOpen}
        onCancel={() => setEditorOpen(false)}
        onOk={handleSubmit}
        okText={editing ? '保存' : '创建'}
        cancelText="取消"
        destroyOnClose
      >
        <Alert
          type="info" showIcon style={{ marginBottom: 16 }}
          message={editing
            ? '编辑保存后，变更内容自动同步到没有执行的任务，以及后续按新计划生成的任务（执行周期不可修改）。'
            : '保存后系统按周期 + 间隔 + 跳过规则自动生成点检任务，无需手工逐条新建。'}
        />
        <Form form={form} layout="vertical">
          <Form.Item label="计划编号" name="code"><Input disabled /></Form.Item>
          <Form.Item label="计划名称" name="name" rules={[{ required: true, message: '请输入计划名称' }]}><Input placeholder="例如：数控车床日常点检计划" /></Form.Item>
          <Form.Item label="执行周期" name="cycle" rules={[{ required: true, message: '请选择执行周期' }]}><Select options={CYCLE_OPTIONS} /></Form.Item>
          <Form.Item label="间隔" name="interval" rules={[{ required: true, message: '请输入间隔' }]}><InputNumber min={1} style={{ width: '100%' }} addonAfter="天" /></Form.Item>
          <Form.Item label="起止日期" name="range" rules={[{ required: true, message: '请选择起止日期' }]}><DatePicker.RangePicker style={{ width: '100%' }} /></Form.Item>
          <Form.Item label="跳过规则" name="skip"><Input placeholder="例如：跳过星期日 / 跳过星期六、跳过星期天，可留空" /></Form.Item>
          <Form.Item label="负责人" name="owner"><Input placeholder="例如：李四" /></Form.Item>
          <Form.Item label="备注" name="remark"><Input.TextArea rows={2} maxLength={200} /></Form.Item>
        </Form>
      </Modal>
    </>
  );
}
