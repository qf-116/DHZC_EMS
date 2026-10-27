import React, { useMemo, useState } from 'react';
import { Card, Table, Button, Space, Input, Select, Modal, Form, App, Popconfirm } from 'antd';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../components/PageHeader.jsx';
import DegradedBanner from '../components/DegradedBanner.jsx';
import StatusTag from '../components/StatusTag.jsx';
import EmptyState from '../components/EmptyState.jsx';
import { useDemoState } from '../state/DemoStore.jsx';
import { maintenanceStandards, maintenanceStandardItemCodes } from '../data/standardData.js';

// 周期类型从标准名称推导（种子数据无独立周期字段，不伪造）：
// 月度 → 月 / 季度 → 季 / 半年度 → 半年；其余显示 --
const cycleFromName = (name = '') => {
  if (name.includes('半年度')) return '半年';
  if (name.includes('季度')) return '季';
  if (name.includes('月度')) return '月';
  if (name.includes('周')) return '周';
  if (name.includes('日')) return '日';
  return '--';
};

// 保养标准列表（范围外演示模块）：列表读自种子 maintenanceStandards；
// 新增 / 编辑 / 启用停用 / 删除为页面内演示交互（不写入 DemoStore，刷新后恢复快照）。
export default function MaintenanceStandardsPage() {
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
    ...maintenanceStandards.filter(r => !deletedCodes.has(r.code)).map(r => (patches[r.code] ? { ...r, ...patches[r.code] } : r)),
  ], [extraRows, deletedCodes, patches]);

  const list = rows
    .filter(r => !status || r.status === status)
    .filter(r => !kw || (r.code || '').includes(kw) || (r.name || '').includes(kw));

  const statusOptions = useMemo(
    () => [...new Set(rows.map(r => r.status))].map(v => ({ value: v, label: v })),
    [rows],
  );

  const nextCode = `BYBZ${(meta.demoDay || '2026-09-16').replaceAll('-', '')}${String(maintenanceStandards.length + extraRows.length + 1).padStart(3, '0')}`;

  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({ code: nextCode, status: '已启用' });
    setEditorOpen(true);
  };
  const openEdit = (record) => {
    setEditing(record);
    form.resetFields();
    form.setFieldsValue(record);
    setEditorOpen(true);
  };
  const handleSubmit = async () => {
    const values = await form.validateFields();
    const base = { ...(editing || {}), ...values, updateTime: `${meta.updatedAt || meta.demoDay || ''}` };
    if (editing) {
      setPatches(prev => ({ ...prev, [editing.code]: { ...prev[editing.code], ...base } }));
      message.success(`保养标准「${values.name}」已保存`);
    } else {
      setExtraRows(prev => [{ ...base, code: values.code || nextCode }, ...prev]);
      message.success(`保养标准「${values.name}」已创建，可在标准详情中关联设备与保养项目`);
    }
    setEditorOpen(false);
  };
  const toggleStatus = (record) => {
    const next = record.status === '已启用' ? '已停用' : '已启用';
    setPatches(prev => ({ ...prev, [record.code]: { ...prev[record.code], status: next } }));
    message.success(`标准「${record.name}」已${next === '已启用' ? '启用' : '停用'}`);
  };
  const handleDelete = (record) => {
    if (extraRows.some(r => r.code === record.code)) setExtraRows(prev => prev.filter(r => r.code !== record.code));
    else setDeletedCodes(prev => new Set(prev).add(record.code));
    message.success(`已删除保养标准「${record.name}」（${record.code}）`);
  };

  return (
    <>
      <PageHeader
        title="保养标准"
        subtitle={`数据更新于 ${meta.demoDay}`}
      />
      <DegradedBanner meta={meta} />
      <Card size="small" style={{ marginBottom: 12 }}>
        <Space wrap>
          <Input.Search style={{ width: 240 }} placeholder="标准编号 / 名称" allowClear
            onSearch={setKw} onChange={e => { if (!e.target.value) setKw(''); }} />
          <Select style={{ width: 120 }} placeholder="状态" allowClear options={statusOptions} value={status} onChange={setStatus} />
          <Button onClick={() => { setKw(''); setStatus(null); }}>重置</Button>
        </Space>
      </Card>
      <Card size="small">
        <Space wrap style={{ marginBottom: 12 }}>
          <Button type="primary" onClick={openCreate}>新增保养标准</Button>
        </Space>
        <Table
          rowKey="code" size="small"
          dataSource={list}
          onRow={(r) => ({ onClick: () => navigate(`/maintenance-standards/detail?code=${encodeURIComponent(r.code)}`), style: { cursor: 'pointer' } })}
          locale={{
            emptyText: (
              <EmptyState
                description="暂无保养标准"
                reason={kw || status ? '当前筛选条件下没有保养标准' : '暂无保养标准数据'}
              />
            ),
          }}
          columns={[
            { title: '标准编号', dataIndex: 'code', width: 160, fixed: 'left' },
            { title: '标准名称', dataIndex: 'name', width: 200 },
            { title: '周期类型', width: 90, render: (_, r) => cycleFromName(r.name) },
            { title: '关联设备', dataIndex: 'devices', width: 100, render: (v) => (typeof v === 'number' ? `${v} 台` : '--') },
            {
              title: '项目数', width: 90, render: (_, r) => {
                // 种子仅提供「数控车床月度保养标准」的关联项目编号清单，其余标准不伪造
                if (r.code === 'BYBZ20250301001') return `${maintenanceStandardItemCodes.length} 项`;
                return '--';
              },
            },
            { title: '状态', dataIndex: 'status', width: 90, render: v => <StatusTag value={v} /> },
            { title: '更新时间', dataIndex: 'updateTime', width: 160, render: v => v || '--' },
            { title: '备注', dataIndex: 'remark', width: 200, ellipsis: true, render: v => v || '--' },
            {
              title: '操作', width: 190, fixed: 'right',
              render: (_, r) => (
                <Space size={0} onClick={(e) => e.stopPropagation()}>
                  <Button type="link" size="small" onClick={() => navigate(`/maintenance-standards/detail?code=${encodeURIComponent(r.code)}`)}>详情</Button>
                  <Button type="link" size="small" onClick={() => openEdit(r)}>编辑</Button>
                  <Button type="link" size="small" onClick={() => toggleStatus(r)}>{r.status === '已启用' ? '停用' : '启用'}</Button>
                  <Popconfirm title="删除该标准？" okButtonProps={{ danger: true }} onConfirm={() => handleDelete(r)}>
                    <Button type="link" size="small" danger>删除</Button>
                  </Popconfirm>
                </Space>
              ),
            },
          ]}
          scroll={{ x: 1220 }}
          pagination={{ pageSize: 10, showTotal: t => `共 ${t} 条` }}
        />
      </Card>

      <Modal
        title={editing ? `编辑保养标准（${editing.code}）` : '新增保养标准'}
        width={640}
        open={editorOpen}
        onCancel={() => setEditorOpen(false)}
        onOk={handleSubmit}
        okText={editing ? '保存' : '创建'}
        cancelText="取消"
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Form.Item label="标准编号" name="code"><Input disabled /></Form.Item>
          <Form.Item label="标准名称" name="name" rules={[{ required: true, message: '请输入标准名称' }]}><Input placeholder="例如：激光焊接机季度保养标准" /></Form.Item>
          <Form.Item label="状态" name="status" rules={[{ required: true, message: '请选择状态' }]}><Select options={['已启用', '已停用'].map(v => ({ value: v, label: v }))} /></Form.Item>
          <Form.Item label="备注" name="remark"><Input.TextArea rows={2} maxLength={200} /></Form.Item>
        </Form>
      </Modal>
    </>
  );
}
