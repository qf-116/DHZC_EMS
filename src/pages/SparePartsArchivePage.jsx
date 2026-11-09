import React, { useMemo, useState } from 'react';
import { App, Button, Card, Descriptions, Form, Input, InputNumber, Modal, Select, Space, Table } from 'antd';
import { Download, Inbox, PackageOpen, Pencil, Plus, Trash2, Upload as UploadIcon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../components/PageHeader.jsx';
import StatusTag from '../components/StatusTag.jsx';
import EmptyState from '../components/EmptyState.jsx';
import FilterBar, { FilterField } from '../components/FilterBar.jsx';
import { useDemoActions, useDemoState } from '../state/DemoStore.jsx';
import { selectSpareTotals } from '../state/selectors.js';
import { nextSpareCode } from '../domain/spare.js';

// 备件档案（原型「备品备件管理」档案维度列表）：
// 安全库存数量 / 最高库存上限 / 寿命时长（天）/ 用途 是档案级配置，现存量为所有仓库合计，
// 库存水位据此判定（低于安全库存 / 超过最高库存 / 正常）；
// 编号规则 BPBJ + YYYYMMDD + 3 位流水，新增时系统生成，编辑时不可修改。
const UNIT_OPTIONS = ['个', '千克', '米', '套', '件', '卷', '只', '片'].map(u => ({ value: u, label: u }));

const dash = (v) => (v === null || v === undefined || v === '' ? '--' : v);

export default function SparePartsArchivePage() {
  const navigate = useNavigate();
  const { message, modal } = App.useApp();
  const state = useDemoState();
  const actions = useDemoActions();
  const [keyword, setKeyword] = useState('');
  const [brand, setBrand] = useState(null);
  const [editing, setEditing] = useState(null); // null=新增，对象=编辑
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState(null);
  const [selectedKeys, setSelectedKeys] = useState([]);
  const [form] = Form.useForm();

  const totals = useMemo(() => selectSpareTotals(state), [state]);
  const rows = useMemo(() => Object.values(state.entities.sparesByCode).map((s) => {
    const t = totals[s.code] || { onHand: 0, reserved: 0, available: 0 };
    const level = s.safe === null || s.safe === undefined ? '未配置安全库存'
      : (t.onHand < s.safe ? '低于安全库存' : (s.max !== null && s.max !== undefined && t.onHand > s.max ? '超过最大库存' : '正常'));
    return { ...s, onHand: t.onHand, reserved: t.reserved, available: t.available, level };
  }).sort((a, b) => (a.createTime < b.createTime ? 1 : -1)), [state, totals]);

  const brands = useMemo(() => [...new Set(rows.map(r => r.brand).filter(v => v && v !== '--'))], [rows]);

  const filtered = rows.filter((r) => {
    if (brand && r.brand !== brand) return false;
    const kw = keyword.trim();
    if (!kw) return true;
    return [r.code, r.name, r.brand].some(v => (v || '').includes(kw));
  });

  const openCreate = () => {
    const code = nextSpareCode(Object.keys(state.entities.sparesByCode), state.meta.demoDay || '2026-09-16');
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({ code, unit: '个' });
    setOpen(true);
  };

  const openEdit = (record) => {
    setEditing(record);
    form.resetFields();
    form.setFieldsValue({
      code: record.code, name: record.name, spec: record.spec, brand: record.brand, unit: record.unit,
      life: record.life, safe: record.safe, max: record.max, supplier: record.supplier, contact: record.contact,
      phone: record.phone, leadTime: record.leadTime, usage: record.usage, remark: record.remark,
    });
    setOpen(true);
  };

  const submit = async () => {
    const values = await form.validateFields();
    const res = actions.upsertSpare(values, editing ? 'edit' : 'create');
    if (!res.ok) { message.error(res.message); return; }
    message.success(res.message);
    setOpen(false);
  };

  const removeOne = (record) => modal.confirm({
    title: '删除备件档案',
    content: `确定删除备件档案「${record.name}（${record.code}）」吗？现存量为 0 才能删除，已存在的出入库历史记录保留。`,
    okText: '删除', okButtonProps: { danger: true }, cancelText: '取消',
    onOk: () => {
      const res = actions.deleteSpare(record.code);
      if (!res.ok) { message.error(res.message); return; }
      message.success(res.message);
    },
  });

  const removeSelected = () => {
    if (!selectedKeys.length) { message.warning('请先勾选要删除的备件档案'); return; }
    const targets = rows.filter(r => selectedKeys.includes(r.code));
    const blocked = targets.filter(r => r.onHand > 0);
    if (blocked.length) {
      modal.confirm({
        title: '删除备件档案',
        content: `勾选的 ${targets.length} 条中有 ${blocked.length} 条现存量不为 0（${blocked.map(r => r.name).join('、')}），无法删除。`,
        okText: '知道了', cancelText: '取消', onOk: () => {},
      });
      return;
    }
    modal.confirm({
      title: '批量删除备件档案',
      content: `确定删除勾选的 ${targets.length} 条备件档案吗？历史出入库记录保留。`,
      okText: '删除', okButtonProps: { danger: true }, cancelText: '取消',
      onOk: () => {
        let ok = 0;
        targets.forEach((r) => { if (actions.deleteSpare(r.code).ok) ok += 1; });
        message.success(`已删除 ${ok} 条备件档案`);
      },
    });
  };

  const columns = [
    { title: '备品备件名称', dataIndex: 'name', width: 130 },
    { title: '备品备件编号', dataIndex: 'code', width: 150 },
    { title: '规格型号', dataIndex: 'spec', width: 110, render: v => dash(v) },
    { title: '品牌', dataIndex: 'brand', width: 90, render: v => dash(v) },
    { title: '供应商', dataIndex: 'supplier', width: 100, render: v => dash(v) },
    { title: '供应商联系人', dataIndex: 'contact', width: 100, render: v => dash(v) },
    { title: '供应商联系电话', dataIndex: 'phone', width: 120, render: v => dash(v) },
    { title: '现存量', dataIndex: 'onHand', width: 90, render: (v, r) => <span style={r.level === '低于安全库存' ? { color: '#cf1322', fontWeight: 600 } : undefined}>{v}</span> },
    { title: '寿命时长（天）', dataIndex: 'life', width: 110, render: v => dash(v) },
    { title: '安全库存数量', dataIndex: 'safe', width: 110, render: v => dash(v) },
    { title: '最高库存上限', dataIndex: 'max', width: 110, render: v => dash(v) },
    { title: '单位', dataIndex: 'unit', width: 70, render: v => dash(v) },
    { title: '货期（天）', dataIndex: 'leadTime', width: 90, render: v => dash(v) },
    { title: '用途', dataIndex: 'usage', width: 130, ellipsis: true, render: v => dash(v) },
    { title: '备注', dataIndex: 'remark', width: 160, ellipsis: true, render: v => dash(v) },
    { title: '库存水位', dataIndex: 'level', width: 120, render: v => <StatusTag value={v} /> },
    { title: '创建时间', dataIndex: 'createTime', width: 160, render: v => dash(v) },
    { title: '更新时间', dataIndex: 'updateTime', width: 160, render: v => dash(v) },
    { title: '更新人', dataIndex: 'updater', width: 90, render: v => dash(v) },
    {
      title: '操作', width: 160, fixed: 'right',
      render: (_, r) => (
        <Space size={4} onClick={e => e.stopPropagation()}>
          <Button type="link" size="small" onClick={() => setDetail(r)}>查看详情</Button>
          <Button type="link" size="small" onClick={() => openEdit(r)}>编辑</Button>
          <Button type="link" size="small" danger onClick={() => removeOne(r)}>删除</Button>
        </Space>
      ),
    },
  ];

  return (
    <>
      <PageHeader title="备件档案" subtitle={`数据更新于 ${state.meta.updatedAt || '--'}`} />
      <FilterBar onQuery={() => {}} onReset={() => { setKeyword(''); setBrand(null); }}>
        <FilterField label="名称/编号/品牌">
          <Input style={{ width: 240 }} placeholder="备品备件名称 / 编号 / 品牌" allowClear value={keyword} onChange={e => setKeyword(e.target.value)} />
        </FilterField>
        <FilterField label="品牌">
          <Select style={{ width: 160 }} placeholder="全部品牌" allowClear value={brand} onChange={setBrand} options={brands.map(b => ({ value: b, label: b }))} />
        </FilterField>
      </FilterBar>
      <Card size="small">
        <Space wrap style={{ marginBottom: 12 }}>
          <Button type="primary" icon={<Plus size={14} />} onClick={openCreate}>新增</Button>
          <Button icon={<Trash2 size={14} />} onClick={removeSelected}>删除</Button>
          <Button icon={<Inbox size={14} />} onClick={() => navigate('/spare-parts-inbound')}>到货入库</Button>
          <Button icon={<PackageOpen size={14} />} onClick={() => navigate('/spare-parts-outbound')}>领用出库</Button>
          <Button icon={<UploadIcon size={14} />} onClick={() => message.info('演示版：导入模板字段与新增表单一致（编号系统自动生成），此处不写入备件档案')}>导入</Button>
          <Button icon={<Download size={14} />} onClick={() => message.info('演示版：导出请在浏览器端导出当前列表数据')}>导出</Button>
        </Space>
        <Table
          rowKey="code" size="small" scroll={{ x: 2600 }}
          rowSelection={{ columnWidth: 40, selectedRowKeys: selectedKeys, onChange: setSelectedKeys }}
          dataSource={filtered}
          onRow={(r) => ({ onClick: () => setDetail(r), style: { cursor: 'pointer' } })}
          locale={{ emptyText: <EmptyState description="没有匹配的备件档案" reason="请调整名称/编号/品牌筛选，或新增备件档案" /> }}
          columns={columns}
          pagination={{ pageSize: 10, showTotal: t => `共 ${t} 条数据` }}
        />
      </Card>

      {/* 新增/编辑备件档案（原型「新增/编辑备品备件」表单；编号系统生成且编辑不可改） */}
      <Modal
        title={editing ? `编辑备品备件（${editing.code}）` : '新增备品备件'}
        width={880}
        open={open}
        destroyOnClose
        onCancel={() => setOpen(false)}
        onOk={submit}
        okText="确认" cancelText="取消"
      >
        <Form form={form} layout="vertical" style={{ maxHeight: '60vh', overflowY: 'auto', paddingRight: 8 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', columnGap: 16 }}>
            <Form.Item label="名称" name="name" rules={[{ required: true, message: '请输入备品备件名称' }, { max: 30, message: '名称不超过 30 个字符' }]}>
              <Input placeholder="请输入备品备件名称" maxLength={30} />
            </Form.Item>
            <Form.Item label="编号" name="code" rules={[{ required: true, message: '请输入备品备件编号' }]}>
              <Input placeholder="BPBJ + 日期 + 3 位流水" disabled />
            </Form.Item>
            <Form.Item label="规格型号" name="spec" rules={[{ required: true, message: '请输入规格型号' }, { max: 30, message: '规格型号不超过 30 个字符' }]}>
              <Input placeholder="请输入规格型号" maxLength={30} />
            </Form.Item>
            <Form.Item label="单位" name="unit" rules={[{ required: true, message: '请选择单位' }]}>
              <Select placeholder="请选择单位" options={UNIT_OPTIONS} />
            </Form.Item>
            <Form.Item label="品牌" name="brand" rules={[{ max: 30, message: '不超过 30 个字符' }]}>
              <Input placeholder="请输入品牌" maxLength={30} />
            </Form.Item>
            <Form.Item label="寿命时长（天）" name="life">
              <InputNumber style={{ width: '100%' }} min={0} step={1} placeholder="可为小数" />
            </Form.Item>
            <Form.Item label="安全库存数量" name="safe">
              <InputNumber style={{ width: '100%' }} min={0} step={0.5} placeholder="可为小数" />
            </Form.Item>
            <Form.Item label="最高库存数量" name="max">
              <InputNumber style={{ width: '100%' }} min={0} step={0.5} placeholder="可为小数" />
            </Form.Item>
            <Form.Item label="供应商" name="supplier" rules={[{ max: 30, message: '不超过 30 个字符' }]}>
              <Input placeholder="请输入供应商" maxLength={30} />
            </Form.Item>
            <Form.Item label="供应商联系人" name="contact" rules={[{ max: 30, message: '不超过 30 个字符' }]}>
              <Input placeholder="请输入供应商联系人" maxLength={30} />
            </Form.Item>
            <Form.Item label="供应商联系电话" name="phone" rules={[{ max: 30, message: '不超过 30 个字符' }]}>
              <Input placeholder="请输入联系电话" maxLength={30} />
            </Form.Item>
            <Form.Item label="货期（天）" name="leadTime">
              <InputNumber style={{ width: '100%' }} min={0} step={1} placeholder="请输入货期" />
            </Form.Item>
            <Form.Item label="用途" name="usage" rules={[{ max: 30, message: '不超过 30 个字符' }]}>
              <Input placeholder="例如：空压机三级保养用" maxLength={30} />
            </Form.Item>
            <Form.Item label="备注" name="remark" rules={[{ max: 300, message: '备注不超过 300 个字符' }]}>
              <Input.TextArea rows={2} maxLength={300} showCount placeholder="请输入备注" />
            </Form.Item>
          </div>
        </Form>
      </Modal>

      {/* 查看详情 */}
      <Modal title={`备件详情 · ${detail?.code || ''}`} open={!!detail} footer={null} width={760} onCancel={() => setDetail(null)}>
        {detail && (
          <Descriptions bordered size="small" column={2} items={[
            { key: 'name', label: '备品备件名称', children: detail.name },
            { key: 'code', label: '备品备件编号', children: detail.code },
            { key: 'spec', label: '规格型号', children: dash(detail.spec) },
            { key: 'brand', label: '品牌', children: dash(detail.brand) },
            { key: 'unit', label: '单位', children: dash(detail.unit) },
            { key: 'onHand', label: '现存量（所有仓库合计）', children: `${detail.onHand}` },
            { key: 'safe', label: '安全库存数量', children: dash(detail.safe) },
            { key: 'max', label: '最高库存上限', children: dash(detail.max) },
            { key: 'life', label: '寿命时长（天）', children: dash(detail.life) },
            { key: 'leadTime', label: '货期（天）', children: dash(detail.leadTime) },
            { key: 'level', label: '库存水位', children: <StatusTag value={detail.level} /> },
            { key: 'supplier', label: '供应商', children: dash(detail.supplier) },
            { key: 'contact', label: '供应商联系人', children: dash(detail.contact) },
            { key: 'phone', label: '供应商联系电话', children: dash(detail.phone) },
            { key: 'usage', label: '用途', children: dash(detail.usage) },
            { key: 'remark', label: '备注', children: dash(detail.remark) },
            { key: 'createTime', label: '创建时间', children: dash(detail.createTime) },
            { key: 'updateTime', label: '更新时间', children: dash(detail.updateTime) },
            { key: 'updater', label: '更新人', children: dash(detail.updater) },
          ]} />
        )}
      </Modal>

    </>
  );
}
