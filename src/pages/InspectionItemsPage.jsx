import React, { useMemo, useState } from 'react';
import { Card, Table, Button, Space, Input, Select, Modal, Form, Tag, App, Alert, Upload, Descriptions, Row, Col } from 'antd';
import { Upload as UploadIcon } from 'lucide-react';
import PageHeader from '../components/PageHeader.jsx';
import FilterBar, { FilterField } from '../components/FilterBar.jsx';
import DegradedBanner from '../components/DegradedBanner.jsx';
import StatusTag from '../components/StatusTag.jsx';
import EmptyState from '../components/EmptyState.jsx';
import { useDemoState } from '../state/DemoStore.jsx';
import { inspectionItems } from '../data/standardData.js';

const TYPE_OPTIONS = ['运行状态检查', '清洁检查', '机械部件检查', '外观检查'].map(v => ({ value: v, label: v }));
const RESULT_TYPE_OPTIONS = ['单选', '数值', '文本'].map(v => ({ value: v, label: v }));
const STATUS_OPTIONS = ['已启用', '已停用'].map(v => ({ value: v, label: v }));
// 点检分类（原型筛选：全部 / 生产设备 / 老化设备 / 测试设备）
const CATEGORY_OPTIONS = ['生产设备', '老化设备', '测试设备'].map(v => ({ value: v, label: v }));

// 点检项目（范围外演示模块，由点巡保养业务模块完整承接）：
// 数据只读来自 standardData.js 演示快照；新增/编辑/删除/导入/批量启禁用均为演示交互，不写入 DemoStore。
export default function InspectionItemsPage() {
  const { message } = App.useApp();
  const state = useDemoState();
  const meta = state.meta;

  const [kw, setKw] = useState('');
  const [kwDraft, setKwDraft] = useState('');
  const [type, setType] = useState(null);
  const [category, setCategory] = useState(null);
  const [status, setStatus] = useState(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState(null); // null=新增，对象=编辑
  const [form] = Form.useForm();
  const [importOpen, setImportOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailRow, setDetailRow] = useState(null);
  const [selectedKeys, setSelectedKeys] = useState([]);
  const [patches, setPatches] = useState({});

  const rows = useMemo(() => inspectionItems.map(r => (patches[r.code] ? { ...r, ...patches[r.code] } : r)), [patches]);

  const list = useMemo(() => rows
    .filter(r => !type || r.type === type)
    .filter(r => !category || r.category === category)
    .filter(r => !status || r.status === status)
    .filter(r => !kw || (r.code || '').includes(kw) || (r.name || '').includes(kw) || (r.content || '').includes(kw)),
  [rows, kw, type, category, status]);

  // 项目编号自动生成：XJXM + 演示日期 + 序号（禁用 Date.now，取 meta.demoDay）
  const nextCode = `XJXM${(meta.demoDay || '2026-09-16').replaceAll('-', '')}00${inspectionItems.length + 1}`;

  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({ code: nextCode, resultType: '单选', options: '正常/异常', category: '生产设备' });
    setEditorOpen(true);
  };
  const openEdit = (record) => {
    setEditing(record);
    form.resetFields();
    form.setFieldsValue(record);
    setEditorOpen(true);
  };
  const openDetail = (record) => {
    setDetailRow(record);
    setDetailOpen(true);
  };

  const handleSubmit = async () => {
    await form.validateFields();
    setEditorOpen(false);
    message.success(`点检项目${editing ? '编辑' : '新增'}完成`);
  };

  const handleDelete = (record) => {
    message.success(`已删除点检项目「${record.name}」（${record.code}）`);
  };

  // 批量启用 / 禁用（原型工具栏）
  const handleBatchStatus = (next) => {
    if (selectedKeys.length === 0) {
      message.warning('请先勾选要点检项目');
      return;
    }
    selectedKeys.forEach(code => {
      setPatches(prev => ({ ...prev, [code]: { ...prev[code], status: next } }));
    });
    message.success(`已${next === '已启用' ? '启用' : '禁用'} ${selectedKeys.length} 条点检项目`);
    setSelectedKeys([]);
  };

  return (
    <>
      <PageHeader
        title="点检项目"
        subtitle={`数据更新于 ${meta.demoDay}`}
      />
      <DegradedBanner meta={meta} />
      <FilterBar onQuery={() => setKw(kwDraft)} onReset={() => { setKw(''); setKwDraft(''); setType(null); setCategory(null); setStatus(null); }}>
        <FilterField label="点检项目名称">
          <Input style={{ width: 240 }} placeholder="项目编号 / 名称 / 内容" allowClear value={kwDraft}
            onChange={e => { setKwDraft(e.target.value); if (!e.target.value) setKw(''); }} onPressEnter={() => setKw(kwDraft)} />
        </FilterField>
        <FilterField label="点检分类">
          <Select style={{ width: 140 }} allowClear options={CATEGORY_OPTIONS} value={category} onChange={setCategory} />
        </FilterField>
        <FilterField label="检查类型">
          <Select style={{ width: 150 }} allowClear options={TYPE_OPTIONS} value={type} onChange={setType} />
        </FilterField>
        <FilterField label="状态">
          <Select style={{ width: 120 }} allowClear options={STATUS_OPTIONS} value={status} onChange={setStatus} />
        </FilterField>
      </FilterBar>
      <Card size="small">
        <Space wrap style={{ marginBottom: 12 }}>
          <Button type="primary" onClick={openCreate}>新增点检项目</Button>
          <Button icon={<UploadIcon size={14} />} onClick={() => setImportOpen(true)}>导入</Button>
          <Button onClick={() => handleBatchStatus('已启用')} disabled={selectedKeys.length === 0}>启用</Button>
          <Button onClick={() => handleBatchStatus('已停用')} disabled={selectedKeys.length === 0}>禁用</Button>
          <span style={{ color: '#8a97a5', fontSize: 12 }}>已选 {selectedKeys.length} 条</span>
        </Space>
        <Table
          rowKey="code" size="small"
          dataSource={list}
          rowSelection={{ columnWidth: 40, selectedRowKeys: selectedKeys, onChange: setSelectedKeys }}
          locale={{ emptyText: <EmptyState description="暂无点检项目" reason={kw || type || category || status ? '当前筛选条件下没有点检项目' : '暂无点检项目数据'} /> }}
          columns={[
            { title: '点检项目编号', dataIndex: 'code', width: 170, fixed: 'left' },
            { title: '点检项目名称', dataIndex: 'name', width: 170 },
            { title: '点检项目类型', dataIndex: 'type', width: 130 },
            { title: '点检分类', dataIndex: 'category', width: 100, render: v => v || '--' },
            { title: '点检内容', dataIndex: 'content', ellipsis: true },
            { title: '判断结果', dataIndex: 'resultType', width: 90, render: (v, r) => (
              <Space size={4}><Tag>{v || '--'}</Tag>{v === '单选' && r.options ? <span style={{ fontSize: 12, color: '#8a97a3' }}>{r.options}</span> : null}</Space>
            ) },
            { title: '正常基准', dataIndex: 'normalValue', width: 130, render: v => v || '--' },
            { title: '状态', dataIndex: 'status', width: 90, render: v => <StatusTag value={v} /> },
            { title: '创建时间', dataIndex: 'createTime', width: 160, render: v => v || '--' },
            {
              title: '操作', width: 170, fixed: 'right',
              render: (_, r) => (
                <Space size={0}>
                  <Button type="link" size="small" onClick={() => openDetail(r)}>详情</Button>
                  <Button type="link" size="small" onClick={() => openEdit(r)}>编辑</Button>
                  <Button type="link" size="small" danger onClick={() => handleDelete(r)}>删除</Button>
                </Space>
              ),
            },
          ]}
          scroll={{ x: 1500 }}
          pagination={{ pageSize: 10, showTotal: t => `共 ${t} 条` }}
        />
      </Card>

      {/* 导入点检项目（演示弹窗：给出模板口径与逐行校验规则，不写入演示快照） */}
      <Modal
        title="导入点检项目"
        width={680}
        open={importOpen}
        destroyOnClose
        onCancel={() => setImportOpen(false)}
        footer={[
          <Button key="cancel" onClick={() => setImportOpen(false)}>取消</Button>,
          <Button key="ok" type="primary" onClick={() => { setImportOpen(false); message.info('演示版：导入仅演示流程与校验提示，不写入点检项目库'); }}>开始导入</Button>,
        ]}
      >
        <Alert
          type="info" showIcon style={{ marginBottom: 12 }}
          message="导入按模板逐行校验，成功行提交、失败行不提交；演示版本不写入点检项目库，仅演示流程与提示。"
        />
        <ul style={{ paddingLeft: 18, margin: '0 0 12px', color: '#5d6b78', fontSize: 13, lineHeight: 1.9 }}>
          <li>模板列：点检项目编号、点检项目名称、点检项目类型、点检内容、判断结果类型、选项1、选项2、文本内容、下限值、上限值、状态。</li>
          <li>必填列：点检项目名称、点检项目类型、判断结果类型；缺失按行提示「缺少必填字段」。</li>
          <li>点检项目编号在系统内唯一，重复行提示「点检项目编号已存在」，不覆盖已有项目。</li>
          <li>点检项目名称在系统内唯一，重复行提示「点检项目名称已存在」，不覆盖已有项目。</li>
          <li>判断结果类型为「单选」时，选项1、选项2 均不可为空；为「数值」时，下限值不得大于上限值（无下限 / 无上限的留空）。</li>
          <li>校验结果按行返回：行号、字段、原因；错误行不提交，导入完成后给出成功 / 失败行数汇总。</li>
        </ul>
        <Upload beforeUpload={() => false} maxCount={1}>
          <Button icon={<UploadIcon size={14} />}>选择导入文件</Button>
        </Upload>
      </Modal>

      {/* 点检项目详情（只读） */}
      <Modal
        title={detailRow ? `点检项目详情（${detailRow.code}）` : '点检项目详情'}
        width={760}
        open={detailOpen}
        destroyOnClose
        onCancel={() => setDetailOpen(false)}
        footer={[<Button key="close" type="primary" onClick={() => setDetailOpen(false)}>关闭</Button>]}
      >
        {detailRow && (
          <Descriptions column={2} size="small" bordered>
            <Descriptions.Item label="点检项目编号">{detailRow.code || '--'}</Descriptions.Item>
            <Descriptions.Item label="点检项目名称">{detailRow.name || '--'}</Descriptions.Item>
            <Descriptions.Item label="点检项目类型">{detailRow.type || '--'}</Descriptions.Item>
            <Descriptions.Item label="点检分类">{detailRow.category || '--'}</Descriptions.Item>
            <Descriptions.Item label="判断结果类型">{detailRow.resultType || '--'}</Descriptions.Item>
            <Descriptions.Item label="单选选项">{detailRow.options || '--'}</Descriptions.Item>
            <Descriptions.Item label="正常基准">{detailRow.normalValue || '--'}</Descriptions.Item>
            <Descriptions.Item label="状态"><StatusTag value={detailRow.status} /></Descriptions.Item>
            <Descriptions.Item label="点检内容" span={2}>{detailRow.content || '--'}</Descriptions.Item>
            <Descriptions.Item label="备注" span={2}>{detailRow.remark || '--'}</Descriptions.Item>
            <Descriptions.Item label="创建时间" span={2}>{detailRow.createTime || '--'}</Descriptions.Item>
          </Descriptions>
        )}
      </Modal>

      <Modal
        title={editing ? `编辑点检项目（${editing.code}）` : '新增点检项目'}
        width={620}
        open={editorOpen}
        onCancel={() => setEditorOpen(false)}
        onOk={handleSubmit}
        okText={editing ? '保存' : '创建'}
        cancelText="取消"
      >
        <Form form={form} layout="vertical">
          <Form.Item label="项目编号（自动生成）" name="code" required rules={[{ required: true, message: '请输入项目编号' }]}>
            <Input disabled placeholder="保存时自动生成" />
          </Form.Item>
          <Form.Item label="项目名称" name="name" required rules={[{ required: true, message: '请输入项目名称' }]}>
            <Input placeholder="如：主轴径向跳动检查" maxLength={50} />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="检查类型" name="type" required rules={[{ required: true, message: '请选择检查类型' }]}>
                <Select placeholder="请选择" options={TYPE_OPTIONS} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="点检分类" name="category" required rules={[{ required: true, message: '请选择点检分类' }]}>
                <Select placeholder="请选择" options={CATEGORY_OPTIONS} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="判断结果类型" name="resultType" required rules={[{ required: true, message: '请选择判断结果类型' }]}>
                <Select placeholder="请选择" options={RESULT_TYPE_OPTIONS} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="状态" name="status" required rules={[{ required: true, message: '请选择状态' }]}>
                <Select options={STATUS_OPTIONS} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="单选选项" name="options" extra="判断结果类型为「单选」时填写">
                <Input placeholder="如：合格/不合格" maxLength={40} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="单位" name="unit">
                <Input placeholder="如：mm" maxLength={10} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="下限" name="lowerLimit">
                <Input placeholder="如：0.6" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="正常基准" name="normalValue" extra="判断结果类型为「数值」时填写">
                <Input placeholder="如：0.6 ~ 0.8 MPa" maxLength={40} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="上限" name="upperLimit">
                <Input placeholder="如：0.8" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item label="项目内容（检查方法）" name="content">
            <Input.TextArea rows={2} placeholder="描述检查方法与判定依据" maxLength={200} showCount />
          </Form.Item>
          <Form.Item label="备注" name="remark">
            <Input.TextArea rows={2} placeholder="如：联锁失效须立即报修" maxLength={200} showCount />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
