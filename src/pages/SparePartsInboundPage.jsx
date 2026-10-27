import React, { useMemo, useRef, useState } from 'react';
import { Card, Table, Button, Space, Input, DatePicker, App, Modal, Form, Select, InputNumber } from 'antd';
import { Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../components/PageHeader.jsx';
import DegradedBanner from '../components/DegradedBanner.jsx';
import EmptyState from '../components/EmptyState.jsx';
import { useDemoState, useDemoActions } from '../state/DemoStore.jsx';
import UserPickerModal from '../components/UserPickerModal.jsx';
import { suppliers } from '../data/demo/masterData.js';

const { RangePicker } = DatePicker;

// 入库记录列表：数据来自 store 入库记录（inboundsById）；
// 「到货入库」表单经 actions.inboundSpare 入库（备件/数量/仓库/批次/经办人必填），
// 幂等键 inbound:{仓库}:{备件}:{requestId}，重复提交由 store 返回同一结果
export default function SparePartsInboundPage() {
  const navigate = useNavigate();
  const { message } = App.useApp();
  const state = useDemoState();
  const actions = useDemoActions();
  const [range, setRange] = useState(null);
  const [supplierKw, setSupplierKw] = useState('');
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm();
  const [handlerPickerOpen, setHandlerPickerOpen] = useState(false);
  // 幂等 requestId：仅页面局部用途（useRef 计数），提交成功后才推进
  const reqNo = useRef(1);

  const list = useMemo(() => Object.values(state.entities.inboundsById)
    .sort((a, b) => (a.createTime < b.createTime ? 1 : -1)), [state]);

  const filtered = list.filter(r => {
    if (supplierKw && !(r.supplier || '').includes(supplierKw.trim())) return false;
    if (range && range[0] && range[1]) {
      const from = range[0].format('YYYY-MM-DD');
      const to = range[1].format('YYYY-MM-DD');
      if (r.date < from || r.date > to) return false;
    }
    return true;
  });

  const openForm = () => {
    form.resetFields();
    form.setFieldsValue({ handler: state.meta.actorContext?.userName || '--' });
    setOpen(true);
  };

  const submit = (values) => {
    const requestId = `req-inbound-${String(reqNo.current).padStart(4, '0')}`;
    const res = actions.inboundSpare({
      spareCode: values.spareCode,
      warehouseId: values.warehouseId,
      qty: values.qty,
      requestId,
      supplier: values.supplier,
    });
    message[res.ok ? 'success' : 'error'](res.message);
    if (res.ok) {
      reqNo.current += 1; // 提交成功后更新 requestId，下一次入库使用新幂等键
      setOpen(false);
    }
  };

  const spareOptions = Object.values(state.entities.sparesByCode).map(s => ({ value: s.code, label: `${s.code} ${s.name}（${s.unit}）` }));
  const warehouseOptions = Object.values(state.entities.warehousesById).map(w => ({ value: w.warehouseId, label: w.name }));
  // 供应商来自三方主数据，不允许手输
  const supplierOptions = suppliers.map(s => ({ value: s.name, label: s.name }));

  return (
    <>
      <PageHeader title="入库记录" />
      <DegradedBanner meta={state.meta} />
      <Card size="small" style={{ marginBottom: 12 }}>
        <Space wrap>
          <RangePicker
            style={{ width: 240 }}
            placeholder={['请选择开始结束日期', '请选择开始结束日期']}
            value={range}
            onChange={setRange}
          />
          <Input style={{ width: 240 }} placeholder="供应商名称" allowClear value={supplierKw} onChange={e => setSupplierKw(e.target.value)} />
          <Button onClick={() => { setRange(null); setSupplierKw(''); }}>重置</Button>
        </Space>
      </Card>
      <Card size="small">
        <Space wrap style={{ marginBottom: 12 }}>
          <Button type="primary" icon={<Plus size={14} />} onClick={openForm}>到货入库</Button>
        </Space>
        {filtered.length === 0 ? (
          <EmptyState description="暂无入库记录" reason="筛选条件下没有匹配的入库单，或尚未执行入库" />
        ) : (
          <Table
            rowKey="inboundId" size="small"
            dataSource={filtered}
            columns={[
              { title: '入库单据编号', dataIndex: 'code', width: 160 },
              { title: '供应商', dataIndex: 'supplier', width: 120, render: v => v || '--' },
              { title: '采购人', dataIndex: 'buyer', width: 100, render: v => v || '--' },
              { title: '入库日期', dataIndex: 'date', width: 110 },
              { title: '创建人', dataIndex: 'creator', width: 100, render: v => v || '--' },
              { title: '创建时间', dataIndex: 'createTime', width: 170 },
              { title: '备注', dataIndex: 'remark', width: 220, ellipsis: true, render: v => v || '--' },
              { title: '操作', width: 90, render: (_, r) => (
                <Button type="link" size="small" onClick={() => navigate(`/spare-parts-inbound/detail?code=${r.code}`)}>详情</Button>
              ) },
            ]}
            pagination={{ pageSize: 10, showTotal: t => `共 ${t} 条数据` }}
          />
        )}
      </Card>

      {/* 到货入库（表单经 actions 入库；备件/数量/仓库/批次/经办人必填） */}
      <Modal
        title="到货入库"
        width={640}
        open={open}
        destroyOnClose
        onCancel={() => setOpen(false)}
        onOk={() => form.validateFields().then(submit).catch(() => {})}
        okText="确认入库" cancelText="取消"
      >
        <Form form={form} labelCol={{ span: 6 }} wrapperCol={{ span: 16 }}>
          <Form.Item label="备件" name="spareCode" rules={[{ required: true, message: '请选择备件' }]}>
            <Select showSearch optionFilterProp="label" placeholder="请选择备件" options={spareOptions} />
          </Form.Item>
          <Form.Item label="入库数量" name="qty" rules={[{ required: true, message: '请输入入库数量' }]}>
            <InputNumber style={{ width: '100%' }} min={0.01} placeholder="必须为正数" />
          </Form.Item>
          <Form.Item label="入库仓库" name="warehouseId" rules={[{ required: true, message: '请选择入库仓库' }]}>
            <Select placeholder="请选择仓库" options={warehouseOptions} />
          </Form.Item>
          <Form.Item label="批次" name="batch" rules={[{ required: true, message: '请输入批次' }]}>
            <Input maxLength={30} placeholder="请输入批次（如 B2026-0916-01）" />
          </Form.Item>
          <Form.Item label="经办人" name="handler" rules={[{ required: true, message: '请选择经办人' }]}>
            <Input
              readOnly placeholder="点击「选择」从人员主数据选取"
              addonAfter={<Button type="link" size="small" style={{ margin: -7 }} onClick={() => setHandlerPickerOpen(true)}>选择</Button>}
            />
          </Form.Item>
          <Form.Item label="供应商" name="supplier">
            <Select allowClear placeholder="请选择供应商" options={supplierOptions} />
          </Form.Item>
        </Form>
      </Modal>

      {/* 人员主数据选择（三方系统来源，选中后回填经办人） */}
      <UserPickerModal
        open={handlerPickerOpen}
        title="选择经办人"
        onCancel={() => setHandlerPickerOpen(false)}
        onSelect={(u) => { form.setFieldsValue({ handler: u.name }); setHandlerPickerOpen(false); }}
      />
    </>
  );
}
