// ============================================================
// 角色管理（/system/roles · 基础配置域）
// 角色列表 + 新增/编辑 + 分配权限（功能权限树勾选）+ 数据权限范围：
//   - 只读种子来自 src/data/systemConfig.js（sysRoles + sysPermissionTree）
//   - 新增/编辑/删除/分配权限均为页面内演示交互，不写入 DemoStore（刷新恢复）
//   - 角色编码唯一；已分配用户的角色不允许删除（弹窗说明）
// ============================================================

import React, { useMemo, useState } from 'react';
import { App, Alert, Button, Card, Form, Input, Modal, Popconfirm, Select, Space, Table, Tag, Tree, Typography } from 'antd';
import { Plus, ShieldCheck } from 'lucide-react';
import PageHeader from '../components/PageHeader.jsx';
import StatusTag from '../components/StatusTag.jsx';
import EmptyState from '../components/EmptyState.jsx';
import { useDemoState } from '../state/DemoStore.jsx';
import { sysPermissionTree, sysRoles } from '../data/systemConfig.js';

const SCOPE_OPTIONS = ['全部数据权限', '本部门及以下', '本部门', '仅本人数据'].map((v) => ({ value: v, label: v }));
const STATUS_OPTIONS = ['已启用', '已停用'].map((v) => ({ value: v, label: v }));

export default function SystemRolesPage() {
  const { message } = App.useApp();
  const state = useDemoState();
  const meta = state.meta;

  const [rows, setRows] = useState(sysRoles);
  const [kw, setKw] = useState('');
  const [status, setStatus] = useState(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [permOpen, setPermOpen] = useState(false);
  const [permRole, setPermRole] = useState(null);
  const [permChecked, setPermChecked] = useState([]);
  const [form] = Form.useForm();

  const nextRoleId = `R${String(rows.length + 1).padStart(3, '0')}`;

  const list = useMemo(() => rows
    .filter((r) => !status || r.status === status)
    .filter((r) => !kw || [r.roleId, r.code, r.name, r.remark]
      .some((v) => String(v || '').toLowerCase().includes(kw.trim().toLowerCase()))),
  [rows, kw, status]);

  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({ roleId: nextRoleId, status: '已启用', dataScope: '本部门及以下' });
    setEditorOpen(true);
  };

  const openEdit = (record) => {
    setEditing(record);
    form.resetFields();
    form.setFieldsValue({ ...record });
    setEditorOpen(true);
  };

  const handleSubmit = async () => {
    const values = await form.validateFields();
    setEditorOpen(false);
    if (editing) {
      setRows((rs) => rs.map((r) => (r.roleId === editing.roleId ? { ...r, ...values, menuKeys: r.menuKeys } : r)));
      message.success(`角色「${values.name}」已保存，调整即时对已分配用户生效`);
    } else {
      setRows((rs) => [...rs, {
        ...values,
        userCount: 0,
        menuKeys: [],
        createTime: `${meta.demoDay || '2026-09-16'} ${meta.demoClock || '16:41:08'}`,
      }]);
      message.success(`角色「${values.name}」已创建，默认未勾选任何功能权限，请进入「分配权限」配置`);
    }
  };

  const openPerm = (record) => {
    setPermRole(record);
    setPermChecked(record.menuKeys || []);
    setPermOpen(true);
  };

  const handlePermSave = () => {
    setRows((rs) => rs.map((r) => (r.roleId === permRole.roleId ? { ...r, menuKeys: permChecked } : r)));
    setPermOpen(false);
    message.success(`角色「${permRole.name}」功能权限已保存，权限在用户下次进入页面时刷新生效`);
  };

  const handleDelete = (record) => {
    if (record.userCount > 0) {
      message.error(`角色「${record.name}」已分配 ${record.userCount} 个用户，请先在用户管理中移除该角色再删除`);
      return;
    }
    setRows((rs) => rs.filter((r) => r.roleId !== record.roleId));
    message.success(`角色「${record.name}」已删除（演示模式：刷新页面后恢复）`);
  };

  const toggleStatus = (record) => {
    const next = record.status === '已启用' ? '已停用' : '已启用';
    setRows((rs) => rs.map((r) => (r.roleId === record.roleId ? { ...r, status: next } : r)));
    message.success(next === '已停用'
      ? `角色「${record.name}」已停用，已分配用户保留角色但对应功能权限不再生效`
      : `角色「${record.name}」已启用`);
  };

  return (
    <>
      <PageHeader
        title="角色管理"
        subtitle="数据更新于 2026-09-16"
      />
      <Card size="small" style={{ marginBottom: 12 }}>
        <Space wrap>
          <Input.Search style={{ width: 240 }} placeholder="角色编号 / 编码 / 名称" allowClear
            onSearch={setKw} onChange={(e) => { if (!e.target.value) setKw(''); }} />
          <Select style={{ width: 120 }} placeholder="状态" allowClear options={STATUS_OPTIONS} value={status} onChange={setStatus} />
          <Button onClick={() => { setKw(''); setStatus(null); }}>重置</Button>
        </Space>
      </Card>

      <Card size="small">
        <Space wrap style={{ marginBottom: 12 }}>
          <Button type="primary" icon={<Plus size={14} />} onClick={openCreate}>新增角色</Button>
        </Space>
        <Table
          rowKey="roleId" size="small"
          dataSource={list}
          locale={{ emptyText: <EmptyState description="暂无角色" reason={kw || status ? '当前筛选条件下没有角色' : '暂无角色数据'} /> }}
          columns={[
            { title: '角色编号', dataIndex: 'roleId', width: 100, fixed: 'left' },
            { title: '角色名称', dataIndex: 'name', width: 140 },
            { title: '角色编码', dataIndex: 'code', width: 140, render: (v) => <Tag>{v}</Tag> },
            { title: '数据权限范围', dataIndex: 'dataScope', width: 130 },
            { title: '已分配用户', dataIndex: 'userCount', width: 100, render: (v) => (v ? `${v} 人` : '--') },
            { title: '功能权限', width: 140, render: (_, r) => (
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                {r.menuKeys?.includes('perm:system:all') ? '全部权限' : `已配置 ${r.menuKeys?.length || 0} 项`}
              </Typography.Text>
            ) },
            { title: '状态', dataIndex: 'status', width: 90, render: (v) => <StatusTag value={v} /> },
            { title: '备注', dataIndex: 'remark', ellipsis: true, render: (v) => v || '--' },
            { title: '创建时间', dataIndex: 'createTime', width: 150 },
            {
              title: '操作', width: 200, fixed: 'right',
              render: (_, r) => (
                <Space size={0}>
                  <Button type="link" size="small" onClick={() => openEdit(r)}>编辑</Button>
                  <Button type="link" size="small" icon={<ShieldCheck size={12} />} onClick={() => openPerm(r)}>分配权限</Button>
                  <Popconfirm title={r.status === '已启用' ? '确认停用该角色？已分配用户的对应功能权限将不再生效。' : '确认启用该角色？'} onConfirm={() => toggleStatus(r)}>
                    <Button type="link" size="small">{r.status === '已启用' ? '停用' : '启用'}</Button>
                  </Popconfirm>
                  <Popconfirm title="确认删除该角色？删除后不可恢复。" onConfirm={() => handleDelete(r)}>
                    <Button type="link" size="small" danger disabled={r.roleId === 'R001'}>删除</Button>
                  </Popconfirm>
                </Space>
              ),
            },
          ]}
          scroll={{ x: 1400 }}
          pagination={{ pageSize: 10, showTotal: (t) => `共 ${t} 条` }}
        />
      </Card>

      <Modal
        title={editing ? `编辑角色（${editing.roleId}）` : '新增角色'}
        width={680}
        open={editorOpen}
        onCancel={() => setEditorOpen(false)}
        onOk={handleSubmit}
        okText={editing ? '保存' : '创建'}
        cancelText="取消"
      >
        <Alert type="info" showIcon style={{ marginBottom: 16 }}
          message="角色编码创建后不可修改；功能权限请通过「分配权限」单独配置" />
        <Form form={form} layout="vertical">
          <Form.Item label="角色编号（自动生成，不可编辑）" name="roleId" rules={[{ required: true, message: '请输入角色编号' }]}>
            <Input disabled placeholder="保存时自动生成" />
          </Form.Item>
          <Form.Item label="角色名称" name="name" rules={[{ required: true, message: '请输入角色名称' }]}>
            <Input placeholder="如：维修工程师" maxLength={20} />
          </Form.Item>
          <Form.Item label="角色编码" name="code" rules={[
            { required: true, message: '请输入角色编码' },
            { pattern: /^[A-Z][A-Z0-9_]{2,29}$/, message: '大写字母开头，3-30 位大写字母 / 数字 / 下划线' },
          ]}>
            <Input placeholder="如：REPAIR_ENG" maxLength={30} disabled={!!editing} />
          </Form.Item>
          <Form.Item label="数据权限范围" name="dataScope" extra="控制角色内用户能看到的业务数据范围（按组织机构树过滤）"
            rules={[{ required: true, message: '请选择数据权限范围' }]}>
            <Select options={SCOPE_OPTIONS} />
          </Form.Item>
          <Form.Item label="状态" name="status" rules={[{ required: true, message: '请选择状态' }]}>
            <Select options={STATUS_OPTIONS} />
          </Form.Item>
          <Form.Item label="备注" name="remark">
            <Input.TextArea rows={2} placeholder="如：接单/执行/验收，只读台账" maxLength={200} showCount />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={`分配权限 —— ${permRole?.name || ''}（${permRole?.roleId || ''}）`}
        width={620}
        open={permOpen}
        onCancel={() => setPermOpen(false)}
        onOk={handlePermSave}
        okText="保存权限"
        cancelText="取消"
      >
        <Alert type="info" showIcon style={{ marginBottom: 12 }}
          message="勾选菜单/页面即授予访问权；基础配置节点为操作级权限。保存后权限在用户下次进入页面时刷新生效。" />
        <div style={{ maxHeight: 420, overflow: 'auto', border: '1px solid #e5e9f0', borderRadius: 8, padding: 8 }}>
          <Tree
            checkable
            defaultExpandAll
            selectable={false}
            treeData={sysPermissionTree}
            checkedKeys={permChecked}
            onCheck={(keys) => setPermChecked(keys)}
          />
        </div>
      </Modal>
    </>
  );
}
