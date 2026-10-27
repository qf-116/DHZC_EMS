// ============================================================
// 组织机构（/system/org · 基础配置域）
// 左：部门树（新增/编辑/停用/删除部门，根节点不允许删除）
// 右：部门人员列表（按部门及以下过滤用户，支持「含子部门」切换与人员新增）：
//   - 只读种子来自 src/data/systemConfig.js（sysOrgTree + sysUsers）
//   - 部门与人员的增删改均为页面内演示交互，不写入 DemoStore（刷新恢复）
//   - 部门有下级部门或人员时禁止删除（弹窗说明）
// ============================================================

import React, { useMemo, useState } from 'react';
import { App, Alert, Button, Card, Empty, Form, Input, InputNumber, Modal, Popconfirm, Select, Space, Switch, Table, Tag, Tree, Typography } from 'antd';
import { Building2, Plus } from 'lucide-react';
import PageHeader from '../components/PageHeader.jsx';
import StatusTag from '../components/StatusTag.jsx';
import EmptyState from '../components/EmptyState.jsx';
import { useDemoState } from '../state/DemoStore.jsx';
import { sysOrgTree, sysUsers } from '../data/systemConfig.js';

const STATUS_OPTIONS = ['启用', '停用'].map((v) => ({ value: v, label: v }));

// 把扁平部门表构建成 antd Tree 数据（key = 完整路径）
function buildTreeData(nodes) {
  const childrenMap = new Map();
  nodes.forEach((n) => {
    const parent = n.parent || '__root__';
    if (!childrenMap.has(parent)) childrenMap.set(parent, []);
    childrenMap.get(parent).push(n);
  });
  const toNode = (n) => ({
    key: n.key,
    title: n.status === '停用' ? <span style={{ color: '#8a97a3' }}>{n.title}（已停用）</span> : n.title,
    children: (childrenMap.get(n.key) || []).map(toNode),
  });
  return (childrenMap.get('__root__') || []).map(toNode);
}

// 一个部门路径是否是另一个的子孙部门
const isDescendant = (path, ancestor) => path !== ancestor && path.startsWith(`${ancestor}/`);

export default function SystemOrgPage() {
  const { message } = App.useApp();
  const state = useDemoState();
  const meta = state.meta;

  const [deptRows, setDeptRows] = useState(sysOrgTree);
  const [userRows, setUserRows] = useState(sysUsers);
  const [selectedDept, setSelectedDept] = useState('DHZC');
  const [includeChild, setIncludeChild] = useState(true);
  const [memberKw, setMemberKw] = useState('');
  const [deptEditorOpen, setDeptEditorOpen] = useState(false);
  const [editingDept, setEditingDept] = useState(null); // null=新增
  const [deptForm] = Form.useForm();
  const [memberEditorOpen, setMemberEditorOpen] = useState(false);
  const [memberForm] = Form.useForm();

  const treeData = useMemo(() => buildTreeData(deptRows), [deptRows]);
  const currentDept = deptRows.find((d) => d.key === selectedDept);

  // 部门人员：按 deptPath 前缀匹配（含子部门开关）
  const members = useMemo(() => {
    const target = selectedDept === 'DHZC' ? null : selectedDept;
    return userRows
      .filter((u) => {
        if (!target) return true;
        const path = u.deptPath.join('/');
        return includeChild ? (path === target || isDescendant(path, target)) : path === target;
      })
      .filter((u) => !memberKw || [u.name, u.account, (u.roles || []).join('/')]
        .some((v) => String(v || '').includes(memberKw.trim())));
  }, [userRows, selectedDept, includeChild, memberKw]);

  const deptDescendantCount = (key) => ({
    subDept: deptRows.filter((d) => isDescendant(d.key, key)).length,
    member: userRows.filter((u) => {
      const p = u.deptPath.join('/');
      return p === key || isDescendant(p, key);
    }).length,
  });

  // ---------- 部门弹窗 ----------
  const openDeptCreate = () => {
    setEditingDept(null);
    deptForm.resetFields();
    deptForm.setFieldsValue({ parent: selectedDept === 'DHZC' ? 'DHZC' : selectedDept, sort: deptRows.length + 1, status: '启用' });
    setDeptEditorOpen(true);
  };

  const openDeptEdit = () => {
    if (!currentDept || currentDept.key === 'DHZC') return;
    setEditingDept(currentDept);
    deptForm.resetFields();
    deptForm.setFieldsValue({
      parent: currentDept.parent, name: currentDept.title, leader: currentDept.leader,
      phone: currentDept.phone, sort: currentDept.sort, status: currentDept.status, remark: currentDept.remark,
    });
    setDeptEditorOpen(true);
  };

  const handleDeptSubmit = async () => {
    const values = await deptForm.validateFields();
    setDeptEditorOpen(false);
    if (editingDept) {
      // 演示交互：重命名部门时同步刷新其子孙路径与人员 deptPath 前缀
      const oldKey = editingDept.key;
      const parentKey = values.parent || 'DHZC';
      const newKey = parentKey === 'DHZC' ? values.name : `${parentKey}/${values.name}`;
      setDeptRows((rs) => rs.map((d) => {
        if (d.key === oldKey) return { ...d, ...values, title: values.name, key: newKey };
        if (isDescendant(d.key, oldKey)) return { ...d, key: d.key.replace(oldKey, newKey) };
        return d;
      }));
      setUserRows((us) => us.map((u) => {
        const p = u.deptPath.join('/');
        if (p === oldKey || isDescendant(p, oldKey)) return { ...u, deptPath: p.replace(oldKey, newKey).split('/') };
        return u;
      }));
      setSelectedDept(newKey);
      message.success(`部门「${values.name}」已保存，组织机构树即时更新`);
    } else {
      const parentKey = values.parent || 'DHZC';
      const newKey = parentKey === 'DHZC' ? values.name : `${parentKey}/${values.name}`;
      if (deptRows.some((d) => d.key === newKey)) {
        message.error('同级部门下已存在同名部门，请修改部门名称');
        return;
      }
      setDeptRows((rs) => [...rs, { key: newKey, parent: parentKey, title: values.name, leader: values.leader, phone: values.phone, sort: values.sort, status: values.status, remark: values.remark || null }]);
      message.success(`部门「${values.name}」已创建，可在右侧为其添加人员`);
    }
  };

  const handleDeptDelete = (dept) => {
    const { subDept, member } = deptDescendantCount(dept.key);
    if (subDept > 0 || member > 0) {
      message.error(`该部门下还有 ${subDept} 个子部门 / ${member} 名人员，请先转移或删除后再删除部门`);
      return;
    }
    setDeptRows((rs) => rs.filter((d) => d.key !== dept.key));
    if (selectedDept === dept.key) setSelectedDept(dept.parent || 'DHZC');
    message.success(`部门「${dept.title}」已删除（演示模式：刷新页面后恢复）`);
  };

  // ---------- 人员弹窗（快捷新增到当前部门） ----------
  const openMemberCreate = () => {
    memberForm.resetFields();
    memberForm.setFieldsValue({ userId: `U${String(userRows.length + 1).padStart(4, '0')}`, dept: selectedDept === 'DHZC' ? undefined : selectedDept, status: '正常' });
    setMemberEditorOpen(true);
  };

  const handleMemberSubmit = async () => {
    const values = await memberForm.validateFields();
    setMemberEditorOpen(false);
    setUserRows((us) => [...us, {
      ...values,
      deptPath: (values.dept || 'DHZC').split('/'),
      roles: values.roles || [],
      lastLoginTime: null,
      createTime: `${meta.demoDay || '2026-09-16'} ${meta.demoClock || '16:41:08'}`,
      remark: '组织机构页快捷新增',
    }]);
    message.success(`人员「${values.name}」已加入当前部门，完整账号管理请在用户管理页维护`);
  };

  return (
    <>
      <PageHeader
        title="组织机构"
        subtitle="数据更新于 2026-09-16"
      />

      <div style={{ display: 'flex', gap: 12, alignItems: 'stretch' }}>
        {/* 左：部门树 */}
        <Card size="small" style={{ width: 320, flexShrink: 0 }} title={<Space><Building2 size={14} /> 部门树</Space>}>
          <Space wrap style={{ marginBottom: 12 }}>
            <Button type="primary" size="small" icon={<Plus size={12} />} onClick={openDeptCreate}>新增部门</Button>
            {currentDept && currentDept.key !== 'DHZC' && (
              <>
                <Button size="small" onClick={openDeptEdit}>编辑</Button>
                <Popconfirm title={`确认删除部门「${currentDept.title}」？存在子部门或人员时无法删除。`} onConfirm={() => handleDeptDelete(currentDept)}>
                  <Button size="small" danger>删除</Button>
                </Popconfirm>
                <Popconfirm title={currentDept.status === '启用' ? '确认停用该部门？停用后不可新增人员。' : '确认启用该部门？'}
                  onConfirm={() => {
                    const next = currentDept.status === '启用' ? '停用' : '启用';
                    setDeptRows((rs) => rs.map((d) => (d.key === currentDept.key ? { ...d, status: next } : d)));
                    message.success(`部门「${currentDept.title}」已${next === '停用' ? '停用' : '启用'}`);
                  }}>
                  <Button size="small">{currentDept.status === '启用' ? '停用' : '启用'}</Button>
                </Popconfirm>
              </>
            )}
          </Space>
          <div style={{ maxHeight: 520, overflow: 'auto' }}>
            <Tree
              blockNode
              defaultExpandAll
              treeData={treeData}
              selectedKeys={[selectedDept]}
              onSelect={(keys) => setSelectedDept(keys[0] || 'DHZC')}
            />
          </div>
        </Card>

        {/* 右：部门人员 */}
        <Card size="small" style={{ flex: 1, minWidth: 0 }}
          title={`部门人员 —— ${selectedDept === 'DHZC' ? '全部部门' : currentDept?.title || '--'}`}
          extra={<Space size={12}>
            <Space size={6}>
              <Switch size="small" checked={includeChild} onChange={setIncludeChild} />
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>含子部门</Typography.Text>
            </Space>
            <Input.Search size="small" style={{ width: 180 }} placeholder="姓名 / 账号 / 角色" allowClear
              onSearch={setMemberKw} onChange={(e) => { if (!e.target.value) setMemberKw(''); }} />
          </Space>}>
          <Space wrap style={{ marginBottom: 12 }}>
            <Button type="primary" icon={<Plus size={14} />} onClick={openMemberCreate} disabled={currentDept?.status === '停用'}>新增人员</Button>
            {currentDept?.status === '停用' && <span style={{ fontSize: 12, color: '#8a97a3' }}>部门已停用，不能新增人员</span>}
          </Space>
          <Table
            rowKey="userId" size="small"
            dataSource={members}
            locale={{ emptyText: <EmptyState description="该部门暂无人员" reason={memberKw ? '当前搜索条件下没有匹配人员' : '请从左侧选择其他部门，或在工具栏新增人员'} /> }}
            columns={[
              { title: '工号', dataIndex: 'userId', width: 100, fixed: 'left' },
              { title: '姓名', dataIndex: 'name', width: 100 },
              { title: '登录账号', dataIndex: 'account', width: 120 },
              { title: '所属部门', width: 180, render: (_, r) => r.deptPath.join(' / ') },
              { title: '角色', width: 180, render: (_, r) => (
                <Space size={4} wrap>
                  {(r.roles || []).length ? r.roles.map((x) => <Tag key={x} color="blue">{x}</Tag>) : <Tag>--</Tag>}
                </Space>
              ) },
              { title: '手机号', dataIndex: 'phone', width: 120 },
              { title: '账号状态', dataIndex: 'status', width: 90, render: (v) => <StatusTag value={v === '正常' ? '在用' : '停用'} /> },
              { title: '备注', dataIndex: 'remark', ellipsis: true, render: (v) => v || '--' },
            ]}
            scroll={{ x: 1000 }}
            pagination={{ pageSize: 10, showTotal: (t) => `共 ${t} 人` }}
          />
        </Card>
      </div>

      {/* 部门新增 / 编辑弹窗 */}
      <Modal
        title={editingDept ? `编辑部门（${editingDept.title}）` : '新增部门'}
        width={620}
        open={deptEditorOpen}
        onCancel={() => setDeptEditorOpen(false)}
        onOk={handleDeptSubmit}
        okText={editingDept ? '保存' : '创建'}
        cancelText="取消"
      >
        <Alert type="info" showIcon style={{ marginBottom: 16 }}
          message="部门删除前必须先转移其子部门与人员；根组织不允许删除或停用" />
        <Form form={deptForm} layout="vertical">
          <Form.Item label="上级部门" name="parent" rules={[{ required: true, message: '请选择上级部门' }]}>
            <Select placeholder="请选择上级部门（根组织 = 东浩智创制造有限公司）" showSearch optionFilterProp="label"
              options={deptRows.map((d) => ({ value: d.key, label: d.key === 'DHZC' ? d.title : d.key.split('/').join(' / '), disabled: !!editingDept && (d.key === editingDept.key || isDescendant(d.key, editingDept.key)) }))} />
          </Form.Item>
          <Form.Item label="部门名称" name="name" rules={[{ required: true, message: '请输入部门名称' }]}>
            <Input placeholder="如：维修科" maxLength={30} />
          </Form.Item>
          <Form.Item label="部门负责人" name="leader">
            <Input placeholder="如：张伟" maxLength={20} />
          </Form.Item>
          <Form.Item label="联系电话" name="phone" rules={[{ pattern: /^[\d\-+ ]{5,20}$/, message: '请输入正确的联系电话' }]}>
            <Input placeholder="如：0512-6688 0203" maxLength={20} />
          </Form.Item>
          <Form.Item label="显示排序" name="sort" extra="同层级按序号升序展示" rules={[{ required: true, message: '请输入显示排序' }]}>
            <InputNumber min={1} max={999} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="状态" name="status" rules={[{ required: true, message: '请选择状态' }]}>
            <Select options={STATUS_OPTIONS} />
          </Form.Item>
          <Form.Item label="备注" name="remark">
            <Input.TextArea rows={2} placeholder="如：设备管理主责部门" maxLength={200} showCount />
          </Form.Item>
        </Form>
      </Modal>

      {/* 人员快捷新增弹窗 */}
      <Modal
        title="新增人员（组织机构快捷入口）"
        width={620}
        open={memberEditorOpen}
        onCancel={() => setMemberEditorOpen(false)}
        onOk={handleMemberSubmit}
        okText="创建"
        cancelText="取消"
      >
        <Alert type="info" showIcon style={{ marginBottom: 16 }}
          message="此处仅录入基础信息并挂到部门下；角色、密码等完整账号管理在「用户管理」页维护" />
        <Form form={memberForm} layout="vertical">
          <Form.Item label="工号（自动生成，不可编辑）" name="userId" rules={[{ required: true, message: '请输入工号' }]}>
            <Input disabled />
          </Form.Item>
          <Form.Item label="姓名" name="name" rules={[{ required: true, message: '请输入姓名' }]}>
            <Input placeholder="如：李明" maxLength={20} />
          </Form.Item>
          <Form.Item label="登录账号" name="account" rules={[
            { required: true, message: '请输入登录账号' },
            { pattern: /^[a-zA-Z][a-zA-Z0-9_]{2,19}$/, message: '字母开头，3-20 位字母 / 数字 / 下划线' },
          ]}>
            <Input placeholder="如：liming" maxLength={20} />
          </Form.Item>
          <Form.Item label="所属部门" name="dept" rules={[{ required: true, message: '请选择所属部门' }]}>
            <Select placeholder="请选择部门" showSearch optionFilterProp="label"
              options={deptRows.filter((d) => d.key !== 'DHZC' && d.status === '启用').map((d) => ({ value: d.key, label: d.key.split('/').join(' / ') }))} />
          </Form.Item>
          <Form.Item label="手机号" name="phone" rules={[
            { required: true, message: '请输入手机号' },
            { pattern: /^1[3-9]\d{9}$/, message: '请输入正确的手机号' },
          ]}>
            <Input placeholder="用于登录异常通知" maxLength={11} />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
