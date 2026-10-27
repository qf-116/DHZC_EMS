import React, { useMemo, useState } from 'react';
import { Card, Table, Button, Space, Input, Select, Tooltip, Modal, Form, App, Popconfirm, InputNumber, DatePicker, Alert } from 'antd';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import PageHeader from '../components/PageHeader.jsx';
import DegradedBanner from '../components/DegradedBanner.jsx';
import StatusTag from '../components/StatusTag.jsx';
import EmptyState from '../components/EmptyState.jsx';
import { useDemoState } from '../state/DemoStore.jsx';
import { maintenancePlans, maintenanceTasks } from '../data/standardData.js';

const dash = (v) => (v === null || v === undefined || v === '' ? '--' : v);

// 「下次执行」口径：取该计划名下「未开始」任务的最早计划日期（种子推导，不伪造日期）；
// 待执行计划取名下任意任务最早日期；无任务 / 已结束状态显示 --
function nextExecOf(plan) {
  const tasks = maintenanceTasks.filter(t => t.plan === plan.name);
  if (plan.status === '待执行' && tasks.length) {
    return tasks.map(t => t.date).sort()[0];
  }
  if (plan.status === '执行中') {
    const pending = tasks.filter(t => t.status === '未开始').map(t => t.date).sort();
    return pending[0] || '--';
  }
  return '--';
}

const cycleText = (p) => {
  const parts = [p.cycle && `${p.cycle}保养`];
  if (p.intervalDays) parts.push(`间隔 ${p.intervalDays} 天`);
  if (p.skipDays) parts.push(p.skipDays);
  return parts.filter(Boolean).join(' · ') || '--';
};

// 保养计划列表（范围外演示模块）：列表读自种子 maintenancePlans；
// 新增 / 编辑 / 提前完结 / 删除为页面内演示交互（不写入 DemoStore，刷新后恢复快照）。
export default function MaintenancePlansPage() {
  const navigate = useNavigate();
  const { message } = App.useApp();
  const state = useDemoState();
  const meta = state.meta;

  const [kw, setKw] = useState('');
  const [status, setStatus] = useState(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState(null); // null=新增，对象=编辑
  const [form] = Form.useForm();
  const [extraRows, setExtraRows] = useState([]);
  const [deletedCodes, setDeletedCodes] = useState(() => new Set());
  const [patches, setPatches] = useState({});

  const rows = useMemo(() => [
    ...extraRows,
    ...maintenancePlans.filter(r => !deletedCodes.has(r.code)).map(r => (patches[r.code] ? { ...r, ...patches[r.code] } : r)),
  ], [extraRows, deletedCodes, patches]);

  const statusOptions = useMemo(
    () => [...new Set(rows.map(r => r.status))].map(v => ({ value: v, label: v })),
    [rows],
  );

  const list = useMemo(() => rows
    .filter(r => !status || r.status === status)
    .filter(r => !kw || (r.code || '').includes(kw) || (r.name || '').includes(kw) || (r.executor || '').includes(kw)), [rows, kw, status]);

  const nextCode = `BYJH${(meta.demoDay || '2026-09-16').replaceAll('-', '')}${String(maintenancePlans.length + extraRows.length + 1).padStart(3, '0')}`;

  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({ code: nextCode, cycle: '月', year: String((meta.demoDay || '2026-09-16')).slice(0, 4) });
    setEditorOpen(true);
  };
  const openEdit = (record) => {
    setEditing(record);
    form.resetFields();
    form.setFieldsValue({
      ...record,
      planDate: record.planDate ? dayjs(record.planDate) : undefined,
      range: record.startDate && record.endDate ? [dayjs(record.startDate), dayjs(record.endDate)] : undefined,
    });
    setEditorOpen(true);
  };
  const handleSubmit = async () => {
    const values = await form.validateFields();
    const base = {
      ...(editing || {}),
      ...values,
      planDate: values.planDate?.format('YYYY-MM-DD') ?? (editing?.planDate || undefined),
      planDateValue: undefined,
      startDate: values.range?.[0]?.format('YYYY-MM-DD') ?? (editing?.startDate || undefined),
      endDate: values.range?.[1]?.format('YYYY-MM-DD') ?? (editing?.endDate || undefined),
      range: undefined,
    };
    if (editing) {
      setPatches(prev => ({ ...prev, [editing.code]: { ...prev[editing.code], ...base } }));
      message.success(`保养计划「${values.name}」已保存，变更将同步到未执行的保养任务及后续按计划生成的任务`);
    } else {
      setExtraRows(prev => [{ ...base, code: values.code || nextCode, status: '待执行' }, ...prev]);
      message.success(`保养计划「${values.name}」已创建，系统将按周期自动生成保养任务`);
    }
    setEditorOpen(false);
  };
  const handleFinish = (record) => {
    setPatches(prev => ({ ...prev, [record.code]: { ...prev[record.code], status: '已停止' } }));
    message.success(`计划「${record.name}」已提前完结，已生成的保养任务仍可继续执行，计划不再生成新任务`);
  };
  const handleDelete = (record) => {
    if (extraRows.some(r => r.code === record.code)) setExtraRows(prev => prev.filter(r => r.code !== record.code));
    else setDeletedCodes(prev => new Set(prev).add(record.code));
    message.success(`已删除计划「${record.name}」（${record.code}），对应生成的保养任务一并删除`);
  };

  return (
    <>
      <PageHeader
        title="保养计划"
        subtitle={`数据更新于 ${meta.demoDay}`}
      />
      <DegradedBanner meta={meta} />
      <Card size="small" style={{ marginBottom: 12 }}>
        <Space wrap>
          <Input.Search style={{ width: 240 }} placeholder="计划编号 / 名称 / 执行人" allowClear
            onSearch={setKw} onChange={e => { if (!e.target.value) setKw(''); }} />
          <Select style={{ width: 120 }} placeholder="状态" allowClear options={statusOptions} value={status} onChange={setStatus} />
          <Button onClick={() => { setKw(''); setStatus(null); }}>重置</Button>
        </Space>
      </Card>
      <Card size="small">
        <Space wrap style={{ marginBottom: 12 }}>
          <Button type="primary" onClick={openCreate}>新增保养计划</Button>
        </Space>
        <Table
          rowKey="code" size="small"
          dataSource={list}
          onRow={(r) => ({ onClick: () => navigate(`/maintenance-plans/detail?code=${encodeURIComponent(r.code)}`), style: { cursor: 'pointer' } })}
          locale={{
            emptyText: (
              <EmptyState
                description="暂无保养计划"
                reason={kw || status ? '当前筛选条件下没有保养计划' : '暂无保养计划数据'}
              />
            ),
          }}
          columns={[
            { title: '计划编号', dataIndex: 'code', width: 160, fixed: 'left' },
            { title: '计划名称', dataIndex: 'name', width: 190 },
            { title: '年度', dataIndex: 'year', width: 70 },
            { title: '保养级别', dataIndex: 'level', width: 90, render: v => v || '--' },
            { title: '保养方式', dataIndex: 'method', width: 100, render: v => v || '--' },
            { title: '周期', width: 200, render: (_, r) => cycleText(r) },
            { title: '计划日期', dataIndex: 'planDate', width: 170, render: v => dash(v) },
            {
              title: '下次执行', width: 110, render: (_, r) => {
                const v = nextExecOf(r);
                return v === '--'
                  ? <Tooltip title="该计划暂无待执行任务">--</Tooltip>
                  : v;
              },
            },
            { title: '关联设备', dataIndex: 'devices', width: 120, render: v => dash(v) },
            { title: '执行人', dataIndex: 'executor', width: 110, render: v => dash(v) },
            { title: '状态', dataIndex: 'status', width: 90, render: v => <StatusTag value={v} /> },
            {
              title: '操作', width: 180, fixed: 'right',
              render: (_, r) => (
                <Space size={0} onClick={(e) => e.stopPropagation()}>
                  <Button type="link" size="small" onClick={() => navigate(`/maintenance-plans/detail?code=${encodeURIComponent(r.code)}`)}>详情</Button>
                  <Button type="link" size="small" onClick={() => openEdit(r)}>编辑</Button>
                  {['待执行', '执行中'].includes(r.status) && (
                    <Popconfirm title="提前完结该计划？" description="已生成的保养任务仍可继续执行，计划不再生成新任务" onConfirm={() => handleFinish(r)}>
                      <Button type="link" size="small">完结</Button>
                    </Popconfirm>
                  )}
                  {r.status === '待执行' && (
                    <Popconfirm title="删除该计划？" description="删除后对应生成的保养任务将一并删除" okButtonProps={{ danger: true }} onConfirm={() => handleDelete(r)}>
                      <Button type="link" size="small" danger>删除</Button>
                    </Popconfirm>
                  )}
                </Space>
              ),
            },
          ]}
          scroll={{ x: 1620 }}
          pagination={{ pageSize: 10, showTotal: t => `共 ${t} 条` }}
        />
      </Card>

      <Modal
        title={editing ? `编辑保养计划（${editing.code}）` : '新增保养计划'}
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
            ? '编辑保存后，变更内容自动同步到未执行的保养任务，以及后续按计划生成的任务。'
            : '保存后系统按周期 + 间隔自动生成保养任务，无需手工逐条新建。'}
        />
        <Form form={form} layout="vertical">
          <Form.Item label="计划编号" name="code"><Input disabled /></Form.Item>
          <Form.Item label="计划名称" name="name" rules={[{ required: true, message: '请输入计划名称' }]}><Input placeholder="例如：数控车床一级保养计划" /></Form.Item>
          <Form.Item label="年度" name="year" rules={[{ required: true, message: '请输入年度' }]}><Input placeholder="例如：2026" /></Form.Item>
          <Form.Item label="保养级别" name="level" rules={[{ required: true, message: '请选择保养级别' }]}><Select options={['一级', '二级', '三级'].map(v => ({ value: v, label: v }))} /></Form.Item>
          <Form.Item label="保养方式" name="method"><Select allowClear placeholder="可留空" options={['现场保养', '返厂保养'].map(v => ({ value: v, label: v }))} /></Form.Item>
          <Form.Item label="保养周期" name="cycle" rules={[{ required: true, message: '请选择保养周期' }]}><Select options={['月', '季度', '半年', '年'].map(v => ({ value: v, label: `${v}保养` }))} /></Form.Item>
          <Form.Item label="间隔天数" name="intervalDays"><InputNumber min={1} style={{ width: '100%' }} addonAfter="天" /></Form.Item>
          <Form.Item label="计划日期" name="planDate"><DatePicker style={{ width: '100%' }} /></Form.Item>
          <Form.Item label="起止日期" name="range"><DatePicker.RangePicker style={{ width: '100%' }} /></Form.Item>
          <Form.Item label="执行人" name="executor"><Input placeholder="例如：王强" /></Form.Item>
          <Form.Item label="备注" name="remark"><Input.TextArea rows={2} maxLength={200} /></Form.Item>
        </Form>
      </Modal>
    </>
  );
}
