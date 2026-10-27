// ============================================================
// 用户管理（/system/users · 基础配置域）
// 系统从宿主平台拆分独立后自建的用户账号管理页：
//   - 只读种子来自 src/data/systemConfig.js（sysUsers）
//   - 新增/编辑/删除/重置密码/启停用均为页面内演示交互，不写入 DemoStore（刷新恢复）
//   - 编号规则：U + 4 位序号（沿用种子前缀）；密码策略见弹窗提示
// ============================================================

import React, { useMemo, useState } from 'react';
import { App, Button, Card, Form, Input, Modal, Popconfirm, Select, Space, Table, Tag, Tooltip } from 'antd';
import { Download, KeyRound, Plus, Upload } from 'lucide-react';
import PageHeader from '../components/PageHeader.jsx';
import StatusTag from '../components/StatusTag.jsx';
import EmptyState from '../components/EmptyState.jsx';
import { useDemoState } from '../state/DemoStore.jsx';
import { sysOrgTree, sysRoles, sysUsers } from '../data/systemConfig.js';

const ROLE_OPTIONS = sysRoles.map((r) => ({ value: r.name, label: r.name }));
const STATUS_OPTIONS = ['正常', '停用'].map((v) => ({ value: v, label: v }));

// 部门下拉：组织机构树扁平化，显示完整路径（根节点排除）
const DEPT_OPTIONS = sysOrgTree
  .filter((d) => d.parent)
  .map((d) => ({ value: d.key, label: d.key.split('/').join(' / ') }));

export default function SystemUsersPage() {
  const { message } = App.useApp();
  const state = useDemoState();
  const meta = state.meta;

  const [rows, setRows] = useState(sysUsers); // 演示交互三态中的最终视图（新增/修改/删除页面内生效）
  const [kw, setKw] = useState('');
  const [dept, setDept] = useState(null);
  const [role, setRole] = useState(null);
  const [status, setStatus] = useState(null);
  const [selectedKeys, setSelectedKeys] = useState([]);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState(null); // null=新增，对象=编辑
  const [form] = Form.useForm();

  const nextUserId = `U${String(rows.length + 1).padStart(4, '0')}`;

  const list = useMemo(() => rows
    .filter((r) => !dept || r.deptPath.join('/').startsWith(dept.split('/').slice(-1)[0]))
    .filter((r) => !role || (r.roles || []).includes(role))
    .filter((r) => !status || r.status === status)
    .filter((r) => !kw || [r.userId, r.account, r.name, r.phone, (r.roles || []).join('/')]
      .some((v) => String(v || '').toLowerCase().includes(kw.trim().toLowerCase()))),
  [rows, kw, dept, role, status]);

  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({ userId: nextUserId, status: '正常' });
    setEditorOpen(true);
  };

  const openEdit = (record) => {
    setEditing(record);
    form.resetFields();
    form.setFieldsValue({ ...record, dept: record.deptPath.join('/'), roles: record.roles });
    setEditorOpen(true);
  };

  const handleSubmit = async () => {
    const values = await form.validateFields();
    setEditorOpen(false);
    if (editing) {
      setRows((rs) => rs.map((r) => (r.userId === editing.userId
        ? { ...r, ...values, deptPath: values.dept.split('/'), roles: values.roles }
        : r)));
      message.success(`用户「${values.name}」已保存，角色与部门即时生效`);
    } else {
      setRows((rs) => [...rs, {
        ...values,
        deptPath: values.dept.split('/'),
        lastLoginTime: null,
        createTime: `${meta.demoDay || '2026-09-16'} ${meta.demoClock || '16:41:08'}`,
        remark: values.remark || null,
      }]);
      message.success(`用户「${values.name}」已创建，初始密码为 Dh@2026，首次登录须修改密码`);
    }
  };

  const handleResetPwd = (record) => {
    message.success(`已重置「${record.name}」的登录密码为初始密码 Dh@2026，旧密码立即失效`);
  };

  const toggleStatus = (record) => {
    const next = record.status === '正常' ? '停用' : '正常';
    setRows((rs) => rs.map((r) => (r.userId === record.userId ? { ...r, status: next } : r)));
    message.success(next === '停用'
      ? `用户「${record.name}」已停用，停用后立即无法登录，其历史操作日志保留`
      : `用户「${record.name}」已启用，可正常登录`);
  };

  const handleDelete = (record) => {
    setRows((rs) => rs.filter((r) => r.userId !== record.userId));
    setSelectedKeys((ks) => ks.filter((k) => k !== record.userId));
    message.success(`用户「${record.name}」已删除（演示模式：刷新页面后恢复）`);
  };

  const batchToggle = (target) => {
    if (!selectedKeys.length) { message.warning('请先勾选要操作的用户'); return; }
    setRows((rs) => rs.map((r) => (selectedKeys.includes(r.userId) ? { ...r, status: target } : r)));
    message.success(`已批量${target === '停用' ? '停用' : '启用'} ${selectedKeys.length} 个用户`);
    setSelectedKeys([]);
  };

  return (
    <>
      <PageHeader
        title="用户管理"
        subtitle={`数据更新于 ${meta.demoDay}`}
      />
      <Card size="small" style={{ marginBottom: 12 }}>
        <Space wrap>
          <Input.Search style={{ width: 240 }} placeholder="工号 / 姓名 / 账号 / 手机号" allowClear
            onSearch={setKw} onChange={(e) => { if (!e.target.value) setKw(''); }} />
          <Select style={{ width: 200 }} placeholder="所属部门" allowClear options={DEPT_OPTIONS} value={dept} onChange={setDept} />
          <Select style={{ width: 150 }} placeholder="角色" allowClear options={ROLE_OPTIONS} value={role} onChange={setRole} />
          <Select style={{ width: 120 }} placeholder="状态" allowClear options={STATUS_OPTIONS} value={status} onChange={setStatus} />
          <Button onClick={() => { setKw(''); setDept(null); setRole(null); setStatus(null); }}>重置</Button>
        </Space>
      </Card>

      <Card size="small">
        <Space wrap style={{ marginBottom: 12 }}>
          <Button type="primary" icon={<Plus size={14} />} onClick={openCreate}>新增用户</Button>
          <Button disabled={!selectedKeys.length} onClick={() => batchToggle('正常')}>批量启用</Button>
          <Button disabled={!selectedKeys.length} onClick={() => batchToggle('停用')}>批量停用</Button>
          <Button icon={<Upload size={14} />}>导入</Button>
          <Button icon={<Download size={14} />}>导出</Button>
          {!selectedKeys.length && <span style={{ fontSize: 12, color: '#8a97a3' }}>批量操作需先勾选数据</span>}
        </Space>
        <Table
          rowKey="userId" size="small"
          dataSource={list}
          rowSelection={{ selectedRowKeys: selectedKeys, onChange: setSelectedKeys }}
          locale={{ emptyText: <EmptyState description="暂无用户" reason={kw || dept || role || status ? '当前筛选条件下没有用户' : '暂无用户数据'} /> }}
          columns={[
            { title: '工号', dataIndex: 'userId', width: 100, fixed: 'left' },
            { title: '姓名', dataIndex: 'name', width: 90 },
            { title: '登录账号', dataIndex: 'account', width: 120 },
            { title: '所属部门', width: 200, render: (_, r) => r.deptPath.join(' / ') },
            { title: '角色', width: 180, render: (_, r) => (
              <Space size={4} wrap>
                {(r.roles || []).length
                  ? r.roles.map((x) => <Tag key={x} color="blue">{x}</Tag>)
                  : <Tag>--</Tag>}
              </Space>
            ) },
            { title: '手机号', dataIndex: 'phone', width: 120 },
            { title: '状态', dataIndex: 'status', width: 90, render: (v) => <StatusTag value={v === '正常' ? '在用' : '停用'} /> },
            { title: '最近登录', dataIndex: 'lastLoginTime', width: 160, render: (v) => v || '--' },
            {
              title: '操作', width: 220, fixed: 'right',
              render: (_, r) => (
                <Space size={0}>
                  <Button type="link" size="small" onClick={() => openEdit(r)}>编辑</Button>
                  <Popconfirm title="重置后该账号旧密码立即失效" onConfirm={() => handleResetPwd(r)}>
                    <Button type="link" size="small" icon={<KeyRound size={12} />}>重置密码</Button>
                  </Popconfirm>
                  <Popconfirm
                    title={r.status === '正常' ? '确认停用该用户？停用后立即无法登录。' : '确认启用该用户？'}
                    onConfirm={() => toggleStatus(r)}
                  >
                    <Button type="link" size="small">{r.status === '正常' ? '停用' : '启用'}</Button>
                  </Popconfirm>
                  <Popconfirm
                    title="删除后该用户的历史操作日志保留（按账号归档），确认删除？"
                    disabled={r.userId === 'U0001'}
                    onConfirm={() => handleDelete(r)}
                  >
                    <Button type="link" size="small" danger disabled={r.userId === 'U0001'}>删除</Button>
                  </Popconfirm>
                </Space>
              ),
            },
          ]}
          scroll={{ x: 1280 }}
          pagination={{ pageSize: 10, showTotal: (t) => `共 ${t} 条` }}
        />
      </Card>

      <Modal
        title={editing ? `编辑用户（${editing.userId}）` : '新增用户'}
        width={680}
        open={editorOpen}
        onCancel={() => setEditorOpen(false)}
        onOk={handleSubmit}
        okText={editing ? '保存' : '创建'}
        cancelText="取消"
      >
        <Form form={form} layout="vertical">
          <Form.Item label="工号（自动生成，不可编辑）" name="userId" rules={[{ required: true, message: '请输入工号' }]}>
            <Input disabled placeholder="保存时自动生成" />
          </Form.Item>
          <Form.Item label="姓名" name="name" rules={[{ required: true, message: '请输入姓名' }]}>
            <Input placeholder="如：李明" maxLength={20} />
          </Form.Item>
          <Form.Item label="登录账号" name="account" rules={[
            { required: true, message: '请输入登录账号' },
            { pattern: /^[a-zA-Z][a-zA-Z0-9_]{2,19}$/, message: '字母开头，3-20 位字母 / 数字 / 下划线' },
          ]}>
            <Input placeholder="如：liming" maxLength={20} disabled={!!editing} />
          </Form.Item>
          <Form.Item label="所属部门" name="dept" rules={[{ required: true, message: '请选择所属部门' }]}>
            <Select placeholder="请选择部门（含子部门路径）" options={DEPT_OPTIONS} showSearch optionFilterProp="label" />
          </Form.Item>
          <Form.Item label="角色（可多选）" name="roles" rules={[{ required: true, message: '请至少选择一个角色' }]}>
            <Select mode="multiple" placeholder="请选择角色，功能权限随角色生效" options={ROLE_OPTIONS} />
          </Form.Item>
          <Form.Item label="手机号" name="phone" rules={[
            { required: true, message: '请输入手机号' },
            { pattern: /^1[3-9]\d{9}$/, message: '请输入正确的手机号' },
          ]}>
            <Input placeholder="用于登录异常通知" maxLength={11} />
          </Form.Item>
          <Form.Item label="邮箱" name="email" rules={[{ type: 'email', message: '请输入正确的邮箱' }]}>
            <Input placeholder="name@dhzc.com" maxLength={50} />
          </Form.Item>
          <Form.Item label="状态" name="status" rules={[{ required: true, message: '请选择状态' }]}>
            <Select options={STATUS_OPTIONS} />
          </Form.Item>
          <Form.Item label="备注" name="remark">
            <Input.TextArea rows={2} placeholder="如：车间看板账号" maxLength={200} showCount />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
