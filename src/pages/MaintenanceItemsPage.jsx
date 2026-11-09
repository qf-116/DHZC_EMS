import React, { useMemo, useState } from 'react';
import { Card, Table, Button, Space, Input, Select, Tabs, Modal, Form, Tag, App, Radio, InputNumber, Row, Col } from 'antd';
import { Plus } from 'lucide-react';
import PageHeader from '../components/PageHeader.jsx';
import FilterBar, { FilterField } from '../components/FilterBar.jsx';
import DegradedBanner from '../components/DegradedBanner.jsx';
import StatusTag from '../components/StatusTag.jsx';
import EmptyState from '../components/EmptyState.jsx';
import { useDemoState } from '../state/DemoStore.jsx';
import {
  maintenanceItemGroups,
  maintenanceItems,
} from '../data/standardData.js';

const levelColor = { 一级: 'blue', 二级: 'gold', 三级: 'volcano' };
const resultTypeLabel = { 单选: '单选', 数值: '数值', 文本: '文本' };
const STATUS_OPTIONS = ['已启用', '已停用'];

// 保养项目基础档案（范围外演示模块）：只读种子 maintenanceItems + maintenanceItemGroups。
// 分组页签展示（当前实现增强项，原型无分组树）；新增/编辑/启用停用/删除仅页面内存演示，
// 不写 DemoStore——完整闭环由点巡保养业务模块承接，禁止写 DemoStore。
export default function MaintenanceItemsPage() {
  const { message } = App.useApp();
  const state = useDemoState();
  const meta = state.meta;

  const [rows, setRows] = useState(maintenanceItems);
  const [kw, setKw] = useState('');
  const [kwDraft, setKwDraft] = useState('');
  const [activeGroup, setActiveGroup] = useState('all');
  const [status, setStatus] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form] = Form.useForm();
  const [selectedKeys, setSelectedKeys] = useState([]);

  const list = useMemo(() => rows
    .filter(r => activeGroup === 'all' || r.group === activeGroup)
    .filter(r => !status || r.status === status)
    .filter(r => !kw
      || (r.code || '').includes(kw)
      || (r.name || '').includes(kw)
      || (r.part || '').includes(kw)
      || (r.require || '').includes(kw)), [rows, kw, activeGroup, status]);

  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({ resultType: '单选', status: '已启用', option1: '正常', option2: '异常' });
    setModalOpen(true);
  };
  const openEdit = (record) => {
    setEditing(record);
    form.resetFields();
    // 编辑时把「选项1/选项2」还原到结构化输入（原型：选项1=正常，选项2=异常）
    const opts = String(record.options || '').split('/').map(s => s.trim());
    form.setFieldsValue({
      ...record,
      option1: opts[0] || '',
      option2: opts[1] || '',
      rangeMin: record.normalRange ? String(record.normalRange).split(/[~-]/)[0]?.trim() : undefined,
      rangeMax: record.normalRange ? String(record.normalRange).split(/[~-]/)[1]?.trim() : undefined,
    });
    setModalOpen(true);
  };
  const handleOk = async () => {
    const values = await form.validateFields();
    const { option1, option2, rangeMin, rangeMax, ...rest } = values;
    const payload = {
      ...rest,
      options: values.resultType === '单选' ? [option1, option2].filter(Boolean).join('/') : '',
      normalRange: values.resultType === '数值'
        ? (rangeMin !== undefined && rangeMax !== undefined ? `${rangeMin}~${rangeMax}` : '')
        : '',
    };
    if (editing) {
      setRows(prev => prev.map(r => (r.code === editing.code ? { ...r, ...payload } : r)));
      message.success(`保养项目 ${values.name} 已更新`);
    } else {
      const code = values.code || `BYXM-${String(rows.length + 1).padStart(3, '0')}`;
      if (rows.some(r => r.code === code)) {
        message.error(`保养项目编号 ${code} 已存在`);
        return;
      }
      setRows(prev => [...prev, {
        ...payload,
        code,
        group: values.group,
        status: values.status || '已启用',
        createTime: meta.updatedAt,
      }]);
      message.success(`保养项目 ${values.name} 已新增`);
    }
    setModalOpen(false);
  };
  const handleDelete = (record) => {
    // 删除仅演示提示：不修改种子数据、不写 DemoStore
    message.success(`已删除「${record.name}」`);
  };
  // 启用 / 停用：页面内存演示，不写 DemoStore
  const toggleStatus = (record) => {
    const next = record.status === '已启用' ? '已停用' : '已启用';
    setRows(prev => prev.map(r => (r.code === record.code ? { ...r, status: next } : r)));
    message.success(`保养项目「${record.name}」已${next === '已启用' ? '启用' : '停用'}`);
  };

  const columns = [
    { title: '项目编号', dataIndex: 'code', width: 160, fixed: 'left' },
    { title: '项目名称', dataIndex: 'name', width: 180 },
    { title: '保养类型', dataIndex: 'type', width: 110, render: v => v || '--' },
    { title: '分组', dataIndex: 'group', width: 110, render: v => <Tag>{v || '--'}</Tag> },
    { title: '保养部位', dataIndex: 'part', width: 100, render: v => v || '--' },
    { title: '保养级别', dataIndex: 'level', width: 90, render: v => <Tag color={levelColor[v] || 'default'}>{v || '--'}</Tag> },
    { title: '保养要求', dataIndex: 'require', width: 240, ellipsis: true, render: v => v || '--' },
    { title: '结果类型', dataIndex: 'resultType', width: 140, render: (v, r) => (v
      ? <span>{resultTypeLabel[v] || v}{v === '单选' && r.options ? `：${r.options}` : ''}{v === '数值' && r.normalRange ? `：${r.normalRange}` : ''}</span>
      : '--') },
    { title: '备注', dataIndex: 'remark', width: 140, ellipsis: true, render: v => v || '--' },
    { title: '状态', dataIndex: 'status', width: 90, render: v => <StatusTag value={v} /> },
    { title: '创建时间', dataIndex: 'createTime', width: 150, render: v => v || '--' },
    {
      title: '操作', width: 160, fixed: 'right',
      render: (_, r) => (
        <Space size={0}>
          <Button type="link" size="small" onClick={() => openEdit(r)}>编辑</Button>
          <Button type="link" size="small" onClick={() => toggleStatus(r)}>{r.status === '已启用' ? '停用' : '启用'}</Button>
          <Button type="link" size="small" danger onClick={() => handleDelete(r)}>删除</Button>
        </Space>
      ),
    },
  ];

  const tabItems = [
    { key: 'all', label: `全部（${rows.length}）`, children: null },
    ...maintenanceItemGroups.map(g => ({
      key: g, label: `${g}（${rows.filter(r => r.group === g).length}）`, children: null,
    })),
  ];

  return (
    <>
      <PageHeader
        title="保养项目"
        subtitle={`数据更新于 ${meta.demoDay}`}
      />
      <DegradedBanner meta={meta} />
      <FilterBar onQuery={() => setKw(kwDraft)} onReset={() => { setKw(''); setKwDraft(''); setActiveGroup('all'); setStatus(null); }}>
        <FilterField label="项目名称">
          <Input style={{ width: 240 }} placeholder="项目编号 / 名称 / 部位 / 要求" allowClear value={kwDraft}
            onChange={e => { setKwDraft(e.target.value); if (!e.target.value) setKw(''); }} onPressEnter={() => setKw(kwDraft)} />
        </FilterField>
        <FilterField label="分组">
          <Select style={{ width: 150 }} value={activeGroup === 'all' ? undefined : activeGroup} allowClear placeholder="全部"
            options={maintenanceItemGroups.map(v => ({ value: v, label: v }))} onChange={value => setActiveGroup(value || 'all')} />
        </FilterField>
        <FilterField label="状态">
          <Select style={{ width: 120 }} allowClear placeholder="全部"
            options={STATUS_OPTIONS.map(v => ({ value: v, label: v }))} value={status} onChange={setStatus} />
        </FilterField>
      </FilterBar>
      <Card size="small">
        <Tabs
          activeKey={activeGroup}
          onChange={setActiveGroup}
          items={tabItems}
          size="small"
        />
        <Space wrap style={{ marginBottom: 12 }}>
          <Button type="primary" icon={<Plus size={14} />} onClick={openCreate}>新增保养项目</Button>
          <Button
            disabled={!selectedKeys.length}
            onClick={() => {
              setRows(prev => prev.map(r => (selectedKeys.includes(r.code) ? { ...r, status: '已启用' } : r)));
              message.success(`已启用 ${selectedKeys.length} 个保养项目`);
              setSelectedKeys([]);
            }}
          >
            启用
          </Button>
          <Button
            disabled={!selectedKeys.length}
            onClick={() => {
              setRows(prev => prev.map(r => (selectedKeys.includes(r.code) ? { ...r, status: '已停用' } : r)));
              message.success(`已停用 ${selectedKeys.length} 个保养项目`);
              setSelectedKeys([]);
            }}
          >
            停用
          </Button>
        </Space>
        <Table
          rowKey="code" size="small"
          dataSource={list}
          rowSelection={{ columnWidth: 40, selectedRowKeys: selectedKeys, onChange: setSelectedKeys }}
          columns={columns}
          scroll={{ x: 1620 }}
          pagination={{ pageSize: 10, showTotal: t => `共 ${t} 条` }}
          locale={{
            emptyText: (
              <EmptyState
                description="暂无保养项目"
                reason={kw || activeGroup !== 'all' || status ? '当前筛选 / 分组条件下没有保养项目' : '暂无保养项目数据'}
              />
            ),
          }}
        />
      </Card>

      <Modal
        title={editing ? `编辑保养项目（${editing.code}）` : '新增保养项目'}
        width={720}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={handleOk}
        okText={editing ? '保存' : '新增'}
        cancelText="取消"
        destroyOnHidden
      >
        <Form form={form} layout="vertical">
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="项目编号" name="code" extra={editing ? '编号不可修改' : '留空自动生成编号'}>
                <Input placeholder="如 BYXM20250301001" disabled={!!editing} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="项目名称" name="name" rules={[{ required: true, message: '请填写项目名称' }]}>
                <Input placeholder="如 主轴轴承润滑脂更换" maxLength={50} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="分组" name="group" rules={[{ required: true, message: '请选择分组' }]}>
                <Select placeholder="请选择" options={maintenanceItemGroups.map(v => ({ value: v, label: v }))} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="保养类型" name="type">
                <Select placeholder="请选择" allowClear
                  options={[...new Set([...maintenanceItemGroups, '其他保养'])].map(v => ({ value: v, label: v }))} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="保养部位" name="part">
                <Input placeholder="如 主轴" maxLength={20} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="保养级别" name="level">
                <Select placeholder="请选择" allowClear options={['一级', '二级', '三级'].map(v => ({ value: v, label: v }))} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item label="保养要求" name="require">
            <Input.TextArea rows={2} placeholder="如 清理旧脂、加注新脂 200g（SKF LGMT2）" maxLength={200} showCount />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="判断结果类型" name="resultType" rules={[{ required: true, message: '请选择判断结果类型' }]}>
                <Radio.Group optionType="button" buttonStyle="solid"
                  options={['单选', '数值', '文本'].map(v => ({ value: v, label: v }))} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="状态" name="status" rules={[{ required: true, message: '请选择状态' }]}>
                <Select options={STATUS_OPTIONS.map(v => ({ value: v, label: v }))} />
              </Form.Item>
            </Col>
          </Row>
          {/* 单选型：选项1 / 选项2（原型预置 正常 / 异常） */}
          <Form.Item noStyle shouldUpdate={(a, b) => a.resultType !== b.resultType}>
            {({ getFieldValue }) => (getFieldValue('resultType') === '单选' ? (
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item label="选项1" name="option1" rules={[{ required: true, message: '请填写选项1' }]}>
                    <Input placeholder="如 正常" maxLength={20} />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item label="选项2" name="option2" rules={[{ required: true, message: '请填写选项2' }]}>
                    <Input placeholder="如 异常" maxLength={20} />
                  </Form.Item>
                </Col>
              </Row>
            ) : null)}
          </Form.Item>
          {/* 数值型：正常值范围（下限 / 上限） */}
          <Form.Item noStyle shouldUpdate={(a, b) => a.resultType !== b.resultType}>
            {({ getFieldValue }) => (getFieldValue('resultType') === '数值' ? (
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item label="正常值下限" name="rangeMin" rules={[{ required: true, message: '请填写正常值下限' }]}>
                    <InputNumber style={{ width: '100%' }} placeholder="如 13" />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item label="正常值上限" name="rangeMax" rules={[{ required: true, message: '请填写正常值上限' }]}>
                    <InputNumber style={{ width: '100%' }} placeholder="如 25" />
                  </Form.Item>
                </Col>
              </Row>
            ) : null)}
          </Form.Item>
          <Form.Item label="备注" name="remark">
            <Input.TextArea rows={2} maxLength={200} />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
