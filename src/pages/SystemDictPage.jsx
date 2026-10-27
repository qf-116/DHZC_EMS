// ============================================================
// 字典管理（/system/dict · 基础配置域）
// 左：字典类型列表；右：所选类型的字典项明细（标签 / 键值 / 排序 / 状态）：
//   - 只读种子来自 src/data/systemConfig.js（sysDictTypes + sysDictEntries）
//   - 新增/编辑/删除/启停用均为页面内演示交互，不写入 DemoStore（刷新恢复）
//   - 同一类型内 标签、键值 均唯一；已被业务引用的类型删除时给出提示
// ============================================================

import React, { useMemo, useState } from 'react';
import { App, Button, Card, Form, Input, InputNumber, Modal, Popconfirm, Select, Space, Table, Tag } from 'antd';
import { Plus } from 'lucide-react';
import PageHeader from '../components/PageHeader.jsx';
import StatusTag from '../components/StatusTag.jsx';
import EmptyState from '../components/EmptyState.jsx';
import { sysDictEntries, sysDictTypes } from '../data/systemConfig.js';

const STATUS_OPTIONS = ['已启用', '已停用'].map((v) => ({ value: v, label: v }));

export default function SystemDictPage() {
  const { message } = App.useApp();

  const [types, setTypes] = useState(sysDictTypes);
  const [entriesMap, setEntriesMap] = useState(sysDictEntries);
  const [typeKw, setTypeKw] = useState('');
  const [entryKw, setEntryKw] = useState('');
  const [selectedType, setSelectedType] = useState(sysDictTypes[0].typeCode);

  const [typeEditorOpen, setTypeEditorOpen] = useState(false);
  const [editingType, setEditingType] = useState(null);
  const [typeForm] = Form.useForm();
  const [entryEditorOpen, setEntryEditorOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);
  const [entryForm] = Form.useForm();

  const typeList = useMemo(() => types
    .filter((t) => !typeKw || [t.typeCode, t.typeName, t.remark]
      .some((v) => String(v || '').toLowerCase().includes(typeKw.trim().toLowerCase()))),
  [types, typeKw]);

  const entries = entriesMap[selectedType] || [];
  const entryList = useMemo(() => entries
    .filter((e) => !entryKw || [e.label, e.value, e.remark]
      .some((v) => String(v || '').toLowerCase().includes(entryKw.trim().toLowerCase()))),
  [entries, entryKw]);
  const currentType = types.find((t) => t.typeCode === selectedType);

  // ---------- 字典类型 ----------
  const openTypeCreate = () => {
    setEditingType(null);
    typeForm.resetFields();
    typeForm.setFieldsValue({ status: '已启用' });
    setTypeEditorOpen(true);
  };

  const openTypeEdit = (record) => {
    setEditingType(record);
    typeForm.resetFields();
    typeForm.setFieldsValue({ ...record });
    setTypeEditorOpen(true);
  };

  const handleTypeSubmit = async () => {
    const values = await typeForm.validateFields();
    if (editingType) {
      setTypes((ts) => ts.map((t) => (t.typeCode === editingType.typeCode ? { ...t, ...values } : t)));
      message.success(`字典类型「${values.typeName}」已保存`);
    } else {
      if (types.some((t) => t.typeCode === values.typeCode)) {
        message.error('字典编码已存在，请更换');
        return;
      }
      setTypes((ts) => [...ts, { ...values, updateTime: '2026-09-16 16:41:08', updater: '李明' }]);
      setEntriesMap((m) => ({ ...m, [values.typeCode]: [] }));
      setSelectedType(values.typeCode);
      setTypeEditorOpen(false);
      message.success(`字典类型「${values.typeName}」已创建，请继续在右侧添加字典项`);
      return;
    }
    setTypeEditorOpen(false);
  };

  const handleTypeDelete = (record) => {
    const cnt = (entriesMap[record.typeCode] || []).length;
    if (cnt > 0) {
      message.error(`该类型下还有 ${cnt} 个字典项，请先删除全部字典项后再删除类型`);
      return;
    }
    setTypes((ts) => ts.filter((t) => t.typeCode !== record.typeCode));
    if (selectedType === record.typeCode) setSelectedType(types[0].typeCode);
    message.success(`字典类型「${record.typeName}」已删除（演示模式：刷新页面后恢复）`);
  };

  // ---------- 字典项 ----------
  const openEntryCreate = () => {
    setEditingEntry(null);
    entryForm.resetFields();
    entryForm.setFieldsValue({ sort: entries.length + 1, status: '已启用' });
    setEntryEditorOpen(true);
  };

  const openEntryEdit = (record) => {
    setEditingEntry(record);
    entryForm.resetFields();
    entryForm.setFieldsValue({ ...record });
    setEntryEditorOpen(true);
  };

  const handleEntrySubmit = async () => {
    const values = await entryForm.validateFields();
    const dupLabel = entries.some((e) => e.label === values.label && e.entryId !== values.entryId);
    const dupValue = entries.some((e) => e.value === values.value && e.entryId !== values.entryId);
    if (dupLabel || dupValue) {
      message.error(dupLabel ? '同一类型下字典标签不能重复' : '同一类型下键值不能重复');
      return;
    }
    setEntryEditorOpen(false);
    if (editingEntry) {
      setEntriesMap((m) => ({ ...m, [selectedType]: m[selectedType].map((e) => (e.entryId === editingEntry.entryId ? { ...e, ...values } : e)) }));
      message.success(`字典项「${values.label}」已保存，业务侧下拉/标签即时按新口径显示`);
    } else {
      setEntriesMap((m) => ({ ...m, [selectedType]: [...m[selectedType], { ...values, entryId: `${selectedType.toUpperCase().slice(0, 2)}${String(m[selectedType].length + 1).padStart(2, '0')}` }] }));
      message.success(`字典项「${values.label}」已添加到「${currentType?.typeName}」`);
    }
  };

  const handleEntryDelete = (record) => {
    setEntriesMap((m) => ({ ...m, [selectedType]: m[selectedType].filter((e) => e.entryId !== record.entryId) }));
    message.success(`字典项「${record.label}」已删除；如已被业务数据引用，历史记录按原标签显示（演示模式：刷新恢复）`);
  };

  const toggleEntryStatus = (record) => {
    const next = record.status === '已启用' ? '已停用' : '已启用';
    setEntriesMap((m) => ({ ...m, [selectedType]: m[selectedType].map((e) => (e.entryId === record.entryId ? { ...e, status: next } : e)) }));
    message.success(next === '已停用'
      ? `字典项「${record.label}」已停用，业务侧新增数据时不再提供该选项，历史数据不受影响`
      : `字典项「${record.label}」已启用`);
  };

  return (
    <>
      <PageHeader
        title="字典管理"
        subtitle="数据更新于 2026-09-16"
      />

      <div style={{ display: 'flex', gap: 12, alignItems: 'stretch' }}>
        {/* 左：字典类型 */}
        <Card size="small" style={{ width: 400, flexShrink: 0 }} title="字典类型"
          extra={<Input.Search size="small" style={{ width: 160 }} placeholder="编码 / 名称" allowClear
            onSearch={setTypeKw} onChange={(e) => { if (!e.target.value) setTypeKw(''); }} />}>
          <Space wrap style={{ marginBottom: 12 }}>
            <Button type="primary" icon={<Plus size={14} />} onClick={openTypeCreate}>新增字典类型</Button>
          </Space>
          <Table
            rowKey="typeCode" size="small"
            dataSource={typeList}
            onRow={(r) => ({ onClick: () => setSelectedType(r.typeCode), style: { cursor: 'pointer', background: r.typeCode === selectedType ? '#e8f2ff' : undefined } })}
            locale={{ emptyText: <EmptyState description="暂无字典类型" reason={typeKw ? '当前搜索条件下没有字典类型' : '暂无字典类型数据'} /> }}
            columns={[
              { title: '字典编码', dataIndex: 'typeCode', width: 120 },
              { title: '字典名称', dataIndex: 'typeName', width: 110 },
              { title: '字典项', width: 70, render: (_, r) => (entriesMap[r.typeCode] || []).length || '--' },
              { title: '状态', dataIndex: 'status', width: 80, render: (v) => <StatusTag value={v} /> },
              {
                title: '操作', width: 110,
                render: (_, r) => (
                  <Space size={0}>
                    <Button type="link" size="small" onClick={(e) => { e.stopPropagation(); openTypeEdit(r); }}>编辑</Button>
                    <Popconfirm title="确认删除该字典类型？类型下存在字典项时无法删除。" onConfirm={() => handleTypeDelete(r)}>
                      <Button type="link" size="small" danger onClick={(e) => e.stopPropagation()}>删除</Button>
                    </Popconfirm>
                  </Space>
                ),
              },
            ]}
            pagination={false}
          />
        </Card>

        {/* 右：字典项 */}
        <Card size="small" style={{ flex: 1, minWidth: 0 }}
          title={`字典项 —— ${currentType?.typeName || '--'}（${selectedType}）`}
          extra={<Input.Search size="small" style={{ width: 180 }} placeholder="标签 / 键值 / 备注" allowClear
            onSearch={setEntryKw} onChange={(e) => { if (!e.target.value) setEntryKw(''); }} />}>
          <Space wrap style={{ marginBottom: 12 }}>
            <Button type="primary" icon={<Plus size={14} />} onClick={openEntryCreate} disabled={!currentType}>新增字典项</Button>
          </Space>
          <Table
            rowKey="entryId" size="small"
            dataSource={entryList}
            locale={{ emptyText: <EmptyState description="该类型暂无字典项" reason={entryKw ? '当前搜索条件下没有字典项' : '请在工具栏点击「新增字典项」'} /> }}
            columns={[
              { title: '字典标签', dataIndex: 'label', width: 140, render: (v) => <Tag>{v}</Tag> },
              { title: '键值', dataIndex: 'value', width: 140 },
              { title: '排序', dataIndex: 'sort', width: 70 },
              { title: '状态', dataIndex: 'status', width: 90, render: (v) => <StatusTag value={v} /> },
              { title: '备注', dataIndex: 'remark', ellipsis: true, render: (v) => v || '--' },
              { title: '更新时间', dataIndex: 'updateTime', width: 150, render: () => currentType?.updateTime || '--' },
              {
                title: '操作', width: 160, fixed: 'right',
                render: (_, r) => (
                  <Space size={0}>
                    <Button type="link" size="small" onClick={() => openEntryEdit(r)}>编辑</Button>
                    <Button type="link" size="small" onClick={() => toggleEntryStatus(r)}>{r.status === '已启用' ? '停用' : '启用'}</Button>
                    <Popconfirm title="确认删除该字典项？历史数据按原标签显示。" onConfirm={() => handleEntryDelete(r)}>
                      <Button type="link" size="small" danger>删除</Button>
                    </Popconfirm>
                  </Space>
                ),
              },
            ]}
            scroll={{ x: 900 }}
            pagination={false}
          />
        </Card>
      </div>

      {/* 字典类型弹窗 */}
      <Modal
        title={editingType ? `编辑字典类型（${editingType.typeCode}）` : '新增字典类型'}
        width={620}
        open={typeEditorOpen}
        onCancel={() => setTypeEditorOpen(false)}
        onOk={handleTypeSubmit}
        okText={editingType ? '保存' : '创建'}
        cancelText="取消"
      >
        <Form form={typeForm} layout="vertical">
          <Form.Item label="字典编码" name="typeCode" rules={[
            { required: true, message: '请输入字典编码' },
            { pattern: /^[a-z][a-z0-9_]{1,29}$/, message: '小写字母开头，2-30 位小写字母 / 数字 / 下划线' },
          ]}>
            <Input placeholder="如：repair_source" maxLength={30} disabled={!!editingType} />
          </Form.Item>
          <Form.Item label="字典名称" name="typeName" rules={[{ required: true, message: '请输入字典名称' }]}>
            <Input placeholder="如：报修来源" maxLength={30} />
          </Form.Item>
          <Form.Item label="状态" name="status" rules={[{ required: true, message: '请选择状态' }]}>
            <Select options={STATUS_OPTIONS} />
          </Form.Item>
          <Form.Item label="备注" name="remark">
            <Input.TextArea rows={2} placeholder="说明该字典被哪些业务字段引用" maxLength={200} showCount />
          </Form.Item>
        </Form>
      </Modal>

      {/* 字典项弹窗 */}
      <Modal
        title={editingEntry ? `编辑字典项（${editingEntry.label}）` : `新增字典项 —— ${currentType?.typeName || ''}`}
        width={620}
        open={entryEditorOpen}
        onCancel={() => setEntryEditorOpen(false)}
        onOk={handleEntrySubmit}
        okText={editingEntry ? '保存' : '创建'}
        cancelText="取消"
      >
        <Form form={entryForm} layout="vertical">
          <Form.Item label="字典标签" name="label" extra="业务侧下拉与状态标签显示的文字"
            rules={[{ required: true, message: '请输入字典标签' }]}>
            <Input placeholder="如：报警自动生成" maxLength={30} />
          </Form.Item>
          <Form.Item label="键值" name="value" extra="业务数据实际存储的编码，保存后不建议修改"
            rules={[{ required: true, message: '请输入键值' }]}>
            <Input placeholder="如：ALARM_AUTO" maxLength={50} />
          </Form.Item>
          <Form.Item label="排序" name="sort" rules={[{ required: true, message: '请输入排序' }]}>
            <InputNumber min={1} max={999} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="状态" name="status" rules={[{ required: true, message: '请选择状态' }]}>
            <Select options={STATUS_OPTIONS} />
          </Form.Item>
          <Form.Item label="备注" name="remark">
            <Input.TextArea rows={2} maxLength={200} showCount placeholder="如：严重报警触发，禁止人工撤单" />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
