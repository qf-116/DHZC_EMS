import React, { useMemo, useState } from 'react';
import { Card, Table, Button, Space, Input, Select, Tag, App, Modal, Form, Radio, Descriptions, Alert, Upload, Tooltip } from 'antd';
import { Plus, Pencil, Trash2, Upload as UploadIcon } from 'lucide-react';
import PageHeader from '../components/PageHeader.jsx';
import FilterBar, { FilterField } from '../components/FilterBar.jsx';
import DegradedBanner from '../components/DegradedBanner.jsx';
import StatusTag from '../components/StatusTag.jsx';
import EmptyState from '../components/EmptyState.jsx';
import { useDemoState } from '../state/DemoStore.jsx';
import { patrolItems } from '../data/standardData.js';

const RESULT_TYPES = ['单选', '数值', '文本'];
const ITEM_TYPES = ['外观检查', '运行状态检查', '机械部件检查', '清洁检查'];
// 原型「巡检分类」下拉选项：生产设备 / 老化设备 / 测试设备
const CATEGORIES = ['生产设备', '老化设备', '测试设备'];
// 演示口径：巡检项目档案尚无 category 字段，按同档案库的「点检项目」项目类型↔分类配对推导
const CATEGORY_BY_TYPE = {
  外观检查: '生产设备',
  运行状态检查: '生产设备',
  机械部件检查: '测试设备',
  清洁检查: '老化设备',
};
const categoryOf = (r) => r.category || CATEGORY_BY_TYPE[r.type] || '';

// 巡检项目（范围外演示模块）：数据只读来自 standardData.js 种子快照；
// 新增/编辑为演示弹窗（不落快照），启用/禁用/导入/详情为页面内演示交互。
export default function PatrolItemsPage() {
  const state = useDemoState();
  const meta = state.meta;
  const { message, modal } = App.useApp();

  const [kw, setKw] = useState('');
  const [kwDraft, setKwDraft] = useState('');
  const [status, setStatus] = useState(null);
  const [resultType, setResultType] = useState(null);
  const [category, setCategory] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null); // null=新增，对象=编辑
  const [form] = Form.useForm();
  const [importOpen, setImportOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailRow, setDetailRow] = useState(null);
  const [overrides, setOverrides] = useState({}); // 批量启用/禁用的页面内状态
  const [selectedKeys, setSelectedKeys] = useState([]);

  const rows = useMemo(() => patrolItems.map(r => ({ ...r, ...(overrides[r.code] || {}) })), [overrides]);

  const list = useMemo(() => rows
    .filter(r => !status || r.status === status)
    .filter(r => !resultType || r.resultType === resultType)
    .filter(r => !category || categoryOf(r) === category)
    .filter(r => {
      const k = (kw || '').trim().toLowerCase();
      if (!k) return true;
      return [r.code, r.name, r.type, r.content].some(v => (v || '').toLowerCase().includes(k));
    }), [rows, kw, status, resultType, category]);

  const openModal = (record) => {
    setEditing(record || null);
    form.setFieldsValue(record || {
      name: '', type: '外观检查', content: '', resultType: '单选', options: '正常/异常', normalRange: '', remark: '', status: '已启用',
    });
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    try { await form.validateFields(); } catch { return; }
    message.success(`巡检项目${editing ? '编辑' : '新增'}完成`);
    setModalOpen(false);
  };

  const confirmDelete = (record) => modal.confirm({
    title: '删除巡检项目',
    content: `确定删除巡检项目「${record.name}（${record.code}）」吗？`,
    okText: '删除', okButtonProps: { danger: true }, cancelText: '取消',
    onOk: () => message.success('已删除'),
  });

  // 批量启用 / 禁用（原型工具栏按钮，配合列表勾选）
  const batchStatus = (nextStatus) => {
    if (selectedKeys.length === 0) {
      message.warning('请先勾选要操作的巡检项目');
      return;
    }
    setOverrides(prev => {
      const next = { ...prev };
      selectedKeys.forEach(k => { next[k] = { ...(next[k] || {}), status: nextStatus }; });
      return next;
    });
    message.success(`已${nextStatus === '已启用' ? '启用' : '禁用'} ${selectedKeys.length} 条巡检项目`);
    setSelectedKeys([]);
  };

  const columns = [
    { title: '项目编号', dataIndex: 'code', width: 180, fixed: 'left' },
    { title: '项目名称', dataIndex: 'name', width: 150 },
    { title: '项目类型', dataIndex: 'type', width: 130, render: v => v || '--' },
    {
      title: '巡检分类', width: 110,
      render: (_, r) => (categoryOf(r)
        ? <Tooltip title="演示口径：巡检项目档案暂无分类字段，按同档案库点检项目的类型↔分类配对推导"><Tag>{categoryOf(r)}</Tag></Tooltip>
        : '--'),
    },
    { title: '检查内容', dataIndex: 'content', ellipsis: true, render: v => v || '--' },
    {
      title: '判断结果类型', dataIndex: 'resultType', width: 110,
      render: (v, r) => <Tag color="processing">{v}{v === '单选' && r.options ? `：${r.options}` : ''}</Tag>,
    },
    { title: '正常范围', dataIndex: 'normalRange', width: 100, render: v => v || '--' },
    { title: '备注', dataIndex: 'remark', width: 140, ellipsis: true, render: v => v || '--' },
    { title: '状态', dataIndex: 'status', width: 90, render: v => <StatusTag value={v} /> },
    { title: '创建时间', dataIndex: 'createTime', width: 150, render: v => v || '--' },
    {
      title: '操作', width: 190, fixed: 'right',
      render: (_, r) => (
        <Space size={0}>
          <Button type="link" size="small" onClick={() => { setDetailRow(r); setDetailOpen(true); }}>详情</Button>
          <Button type="link" size="small" icon={<Pencil size={12} />} onClick={() => openModal(r)}>编辑</Button>
          <Button type="link" size="small" danger icon={<Trash2 size={12} />} onClick={() => confirmDelete(r)}>删除</Button>
        </Space>
      ),
    },
  ];

  return (
    <>
      <PageHeader title="巡检项目" />
      <DegradedBanner meta={meta} />
      <FilterBar onQuery={() => setKw(kwDraft)} onReset={() => { setKw(''); setKwDraft(''); setStatus(null); setResultType(null); setCategory(null); }}>
        <FilterField label="项目名称">
          <Input style={{ width: 220 }} placeholder="请输入" allowClear value={kwDraft}
            onChange={e => { setKwDraft(e.target.value); if (!e.target.value) setKw(''); }} onPressEnter={() => setKw(kwDraft)} />
        </FilterField>
        <FilterField label="巡检分类">
          <Select style={{ width: 140 }} allowClear placeholder="全部" value={category} onChange={setCategory}
            options={CATEGORIES.map(v => ({ value: v, label: v }))} />
        </FilterField>
        <FilterField label="状态">
          <Select style={{ width: 120 }} allowClear value={status} onChange={setStatus}
            options={[...new Set(rows.map(r => r.status))].map(v => ({ value: v, label: v }))} />
        </FilterField>
        <FilterField label="判断结果类型">
          <Select style={{ width: 140 }} allowClear value={resultType} onChange={setResultType}
            options={RESULT_TYPES.map(v => ({ value: v, label: v }))} />
        </FilterField>
      </FilterBar>
      <Card size="small">
        <Space wrap style={{ marginBottom: 12 }}>
          <Button type="primary" icon={<Plus size={14} />} onClick={() => openModal(null)}>新增巡检项目</Button>
          <Button icon={<UploadIcon size={14} />} onClick={() => setImportOpen(true)}>导入</Button>
          <Button onClick={() => batchStatus('已启用')} disabled={selectedKeys.length === 0}>启用</Button>
          <Button onClick={() => batchStatus('已停用')} disabled={selectedKeys.length === 0}>禁用</Button>
          <span style={{ color: '#8a97a5', fontSize: 12 }}>已选 {selectedKeys.length} 条</span>
        </Space>
        <Table
          rowKey="code" size="small" columns={columns} dataSource={list} scroll={{ x: 1620 }}
          rowSelection={{ columnWidth: 40, selectedRowKeys: selectedKeys, onChange: setSelectedKeys }}
          locale={{ emptyText: <EmptyState description="暂无巡检项目" reason={kw || status || resultType || category ? '当前筛选条件下没有巡检项目' : '暂无巡检项目数据'} /> }}
          pagination={{ pageSize: 10, showTotal: t => `共 ${t} 条` }}
        />
      </Card>

      {/* 导入巡检项目（演示弹窗：给出模板列与逐行校验规则，不写入项目档案） */}
      <Modal
        title="导入巡检项目"
        width={680}
        open={importOpen}
        destroyOnClose
        onCancel={() => setImportOpen(false)}
        footer={[
          <Button key="cancel" onClick={() => setImportOpen(false)}>取消</Button>,
          <Button key="ok" type="primary" onClick={() => { setImportOpen(false); message.info('演示版：导入仅演示流程与校验提示，不写入巡检项目档案'); }}>开始导入</Button>,
        ]}
      >
        <Alert
          type="info" showIcon style={{ marginBottom: 12 }}
          message="导入按模板逐行校验，成功行提交、失败行不提交；演示版本不写入巡检项目档案，仅演示流程与提示。"
        />
        <ul style={{ paddingLeft: 18, margin: '0 0 12px', color: '#5d6b78', fontSize: 13, lineHeight: 1.9 }}>
          <li>模板列：巡检项目编号、巡检项目名称、巡检项目类型、巡检分类、检查内容、判断结果类型、单选选项、正常范围、备注、状态。</li>
          <li>必填列：巡检项目名称、巡检项目类型、检查内容、判断结果类型；缺失按行提示「缺少必填字段」。</li>
          <li>巡检项目编号在系统内唯一，重复行提示「巡检项目编号已存在」，不覆盖已有档案。</li>
          <li>判断结果类型为「单选」时必须填写单选选项（以 / 分隔）；为「数值」时必须填写正常范围（如 13~25），否则提示「判定依据缺失」。</li>
          <li>巡检分类只能取 生产设备 / 老化设备 / 测试设备；状态只能取 已启用 / 已停用，非法值按行提示取值范围。</li>
          <li>校验结果按行返回：行号、字段、原因；错误行不提交，导入完成后给出成功 / 失败行数汇总。</li>
        </ul>
        <Upload beforeUpload={() => false} maxCount={1}>
          <Button icon={<UploadIcon size={14} />}>选择导入文件</Button>
        </Upload>
      </Modal>

      {/* 巡检项目详情（只读） */}
      <Modal
        title={detailRow ? `巡检项目详情 · ${detailRow.code}` : '巡检项目详情'}
        width={640}
        open={detailOpen}
        footer={[<Button key="close" onClick={() => setDetailOpen(false)}>关闭</Button>]}
        onCancel={() => setDetailOpen(false)}
        destroyOnClose
      >
        {detailRow && (
          <Descriptions column={2} size="small" bordered>
            <Descriptions.Item label="项目编号">{detailRow.code}</Descriptions.Item>
            <Descriptions.Item label="项目名称">{detailRow.name}</Descriptions.Item>
            <Descriptions.Item label="项目类型">{detailRow.type || '--'}</Descriptions.Item>
            <Descriptions.Item label="巡检分类">{categoryOf(detailRow) || '--'}</Descriptions.Item>
            <Descriptions.Item label="检查内容" span={2}>{detailRow.content || '--'}</Descriptions.Item>
            <Descriptions.Item label="判断结果类型">{detailRow.resultType || '--'}</Descriptions.Item>
            <Descriptions.Item label="判定依据">{detailRow.options || detailRow.normalRange || '--'}</Descriptions.Item>
            <Descriptions.Item label="备注" span={2}>{detailRow.remark || '--'}</Descriptions.Item>
            <Descriptions.Item label="状态">{detailRow.status || '--'}</Descriptions.Item>
            <Descriptions.Item label="创建时间">{detailRow.createTime || '--'}</Descriptions.Item>
          </Descriptions>
        )}
      </Modal>

      <Modal
        title={editing ? `编辑巡检项目 · ${editing.code}` : '新增巡检项目'}
        open={modalOpen}
        onOk={handleSubmit}
        onCancel={() => setModalOpen(false)}
        okText="保存" cancelText="取消"
        width={640}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" size="small">
          <Space style={{ display: 'flex', gap: 12 }} align="start">
            <Form.Item name="name" label="项目名称" rules={[{ required: true, message: '请输入项目名称' }]} style={{ flex: 1, minWidth: 200 }}>
              <Input placeholder="如：设备外观检查" />
            </Form.Item>
            <Form.Item name="type" label="项目类型" style={{ minWidth: 160 }}>
              <Select options={ITEM_TYPES.map(v => ({ value: v, label: v }))} />
            </Form.Item>
          </Space>
          <Form.Item name="content" label="检查内容" rules={[{ required: true, message: '请输入检查内容' }]}>
            <Input.TextArea rows={2} placeholder="检查内容与方法描述" />
          </Form.Item>
          <Form.Item name="resultType" label="判断结果类型" rules={[{ required: true }]}>
            <Radio.Group options={RESULT_TYPES.map(v => ({ value: v, label: v }))} />
          </Form.Item>
          <Form.Item noStyle shouldUpdate={(a, b) => a.resultType !== b.resultType}>
            {({ getFieldValue }) => getFieldValue('resultType') === '单选' && (
              <Form.Item name="options" label="单选选项（以 / 分隔）">
                <Input placeholder="正常/异常" />
              </Form.Item>
            )}
          </Form.Item>
          <Form.Item noStyle shouldUpdate={(a, b) => a.resultType !== b.resultType}>
            {({ getFieldValue }) => getFieldValue('resultType') === '数值' && (
              <Form.Item name="normalRange" label="正常范围">
                <Input placeholder="如：0 ~ 25（mm/s）" />
              </Form.Item>
            )}
          </Form.Item>
          <Form.Item name="remark" label="备注">
            <Input.TextArea rows={2} placeholder="选填" />
          </Form.Item>
          <Form.Item name="status" label="状态">
            <Radio.Group options={['已启用', '已停用'].map(v => ({ value: v, label: v }))} />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
