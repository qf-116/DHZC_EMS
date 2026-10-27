import React, { useMemo, useState } from 'react';
import { Card, Table, Button, Space, Input, Select, Tooltip, Tag, Modal, Form, App, Popconfirm, DatePicker, Alert } from 'antd';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import PageHeader from '../components/PageHeader.jsx';
import DegradedBanner from '../components/DegradedBanner.jsx';
import StatusTag from '../components/StatusTag.jsx';
import EmptyState from '../components/EmptyState.jsx';
import { useDemoState } from '../state/DemoStore.jsx';
import { maintenanceTasks, maintenancePlans } from '../data/standardData.js';
import { crosswalkByAssetCode } from '../data/demo/deviceCrosswalk.js';

// 设备展示统一经 crosswalk canonical 映射：种子 device 字段（如「数控车床 MT2024A1201」）
// 解析出资产码后由 crosswalk 解析 canonical 名称 / deviceId，不做字符串推导命名。
function deviceOf(deviceStr) {
  const m = String(deviceStr || '').match(/MT\d{4}A\d+/);
  const assetCode = m ? m[0] : null;
  const cw = assetCode ? crosswalkByAssetCode[assetCode] : null;
  return {
    assetCode,
    name: cw ? cw.name : (deviceStr || '--'),
    deviceId: cw ? cw.deviceId : null,
  };
}

const canExecute = (r) => ['未开始', '进行中'].includes(r.status);

// 保养任务列表（范围外演示模块）：列表读自种子 maintenanceTasks；状态轴统一 StatusTag；
// 行点击进入任务详情（query ?code=），未开始 / 进行中任务提供「执行」入口。
// 新增 / 编辑 / 删除为页面内演示交互（不写入 DemoStore，刷新后恢复快照）。
export default function MaintenanceTasksPage() {
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
    ...maintenanceTasks.filter(r => !deletedCodes.has(r.code)).map(r => (patches[r.code] ? { ...r, ...patches[r.code] } : r)),
  ], [extraRows, deletedCodes, patches]);

  const statusOptions = useMemo(
    () => [...new Set(rows.map(r => r.status))].map(v => ({ value: v, label: v })),
    [rows],
  );

  const list = useMemo(() => rows
    .filter(r => !status || r.status === status)
    .filter(r => !kw || (r.code || '').includes(kw) || (r.name || '').includes(kw)
      || (r.device || '').includes(kw) || (r.owner || '').includes(kw)), [rows, kw, status]);

  const nextCode = `BYRW${(meta.demoDay || '2026-09-16').replaceAll('-', '')}${String(maintenanceTasks.length + extraRows.length + 1).padStart(3, '0')}`;

  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({ code: nextCode });
    setEditorOpen(true);
  };
  const openEdit = (record) => {
    setEditing(record);
    form.resetFields();
    form.setFieldsValue({
      ...record,
      date: record.date ? dayjs(record.date) : undefined,
    });
    setEditorOpen(true);
  };
  const handleSubmit = async () => {
    const values = await form.validateFields();
    const base = {
      ...(editing || {}),
      ...values,
      date: values.date?.format('YYYY-MM-DD') ?? (editing?.date || undefined),
      dateValue: undefined,
    };
    if (editing) {
      setPatches(prev => ({ ...prev, [editing.code]: { ...prev[editing.code], ...base } }));
      message.success(`保养任务「${editing.code}」已保存`);
    } else {
      setExtraRows(prev => [{ ...base, code: values.code || nextCode, status: '未开始', createTime: `${meta.updatedAt || meta.demoDay || ''}` }, ...prev]);
      message.success(`保养任务「${values.name}」已创建`);
    }
    setEditorOpen(false);
  };
  const handleDelete = (record) => {
    if (extraRows.some(r => r.code === record.code)) setExtraRows(prev => prev.filter(r => r.code !== record.code));
    else setDeletedCodes(prev => new Set(prev).add(record.code));
    message.success(`已删除保养任务「${record.code}」`);
  };

  return (
    <>
      <PageHeader
        title="保养任务"
        subtitle={`数据更新于 ${meta.demoDay}`}
      />
      <DegradedBanner meta={meta} />
      <Card size="small" style={{ marginBottom: 12 }}>
        <Space wrap>
          <Input.Search style={{ width: 240 }} placeholder="任务编号 / 计划 / 设备 / 执行人" allowClear
            onSearch={setKw} onChange={e => { if (!e.target.value) setKw(''); }} />
          <Select style={{ width: 120 }} placeholder="状态" allowClear options={statusOptions} value={status} onChange={setStatus} />
          <Button onClick={() => { setKw(''); setStatus(null); }}>重置</Button>
        </Space>
      </Card>
      <Card size="small">
        <Space wrap style={{ marginBottom: 12 }}>
          <Button type="primary" onClick={openCreate}>新增保养任务</Button>
        </Space>
        <Table
          rowKey="code" size="small"
          dataSource={list}
          onRow={(r) => ({ onClick: () => navigate(`/maintenance-tasks/detail?code=${encodeURIComponent(r.code)}`), style: { cursor: 'pointer' } })}
          locale={{
            emptyText: (
              <EmptyState
                description="暂无保养任务"
                reason={kw || status ? '当前筛选条件下没有保养任务' : '暂无保养任务数据'}
              />
            ),
          }}
          columns={[
            { title: '任务编号', dataIndex: 'code', width: 160, fixed: 'left' },
            { title: '所属计划', dataIndex: 'name', width: 190, render: v => v || '--' },
            {
              title: '保养设备', dataIndex: 'device', width: 210,
              render: (v, r) => {
                const d = deviceOf(v);
                return (
                  <span>
                    {d.name}{d.assetCode ? `（${d.assetCode}）` : ''}
                    {d.deviceId ? <Tag style={{ marginLeft: 6 }}>{d.deviceId}</Tag> : null}
                  </span>
                );
              },
            },
            { title: '所属部门', dataIndex: 'dept', width: 150, render: v => v || '--' },
            { title: '计划时间', dataIndex: 'date', width: 110, render: v => v || '--' },
            { title: '执行人', dataIndex: 'owner', width: 110, render: v => v || '--' },
            { title: '状态', dataIndex: 'status', width: 90, render: v => <StatusTag value={v} /> },
            {
              title: '备注', dataIndex: 'remark', width: 180, ellipsis: true,
              render: v => (v ? <Tooltip title={v}>{v}</Tooltip> : '--'),
            },
            { title: '创建时间', dataIndex: 'createTime', width: 150, render: v => v || '--' },
            {
              title: '操作', width: 180, fixed: 'right',
              render: (_, r) => (
                <Space size={0} onClick={(e) => e.stopPropagation()}>
                  {canExecute(r) && (
                    <Button type="link" size="small" onClick={() => navigate(`/maintenance-tasks/execute?code=${encodeURIComponent(r.code)}`)}>执行</Button>
                  )}
                  <Button type="link" size="small" onClick={() => navigate(`/maintenance-tasks/detail?code=${encodeURIComponent(r.code)}`)}>详情</Button>
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
          scroll={{ x: 1500 }}
          pagination={{ pageSize: 10, showTotal: t => `共 ${t} 条` }}
        />
      </Card>

      <Modal
        title={editing ? `编辑保养任务（${editing.code}）` : '新增保养任务'}
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
          message={editing ? '编辑保存后同步更新该任务的执行信息。' : '适用于临时安排的保养工作；计划类保养任务由保养计划按周期自动生成。'}
        />
        <Form form={form} layout="vertical">
          <Form.Item label="任务编号" name="code"><Input disabled /></Form.Item>
          <Form.Item label="任务名称（所属计划）" name="name" rules={[{ required: true, message: '请输入任务名称' }]}><Input placeholder="例如：数控车床一级保养" /></Form.Item>
          <Form.Item label="保养设备" name="device" rules={[{ required: true, message: '请输入保养设备' }]}><Input placeholder="例如：数控车床 MT2024A1201" /></Form.Item>
          <Form.Item label="计划时间" name="date" rules={[{ required: true, message: '请选择计划时间' }]}><DatePicker style={{ width: '100%' }} /></Form.Item>
          <Form.Item label="执行人" name="owner"><Input placeholder="例如：王强" /></Form.Item>
          <Form.Item label="备注" name="remark"><Input.TextArea rows={2} maxLength={200} /></Form.Item>
        </Form>
      </Modal>
    </>
  );
}
