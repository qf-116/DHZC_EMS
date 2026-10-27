import React, { useMemo, useRef, useState } from 'react';
import { Card, Table, Button, Space, DatePicker, App, Modal, Form, Select, InputNumber, Input, Typography, Alert } from 'antd';
import { PackageOpen, Undo2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../components/PageHeader.jsx';
import DegradedBanner from '../components/DegradedBanner.jsx';
import EmptyState from '../components/EmptyState.jsx';
import UserPickerModal from '../components/UserPickerModal.jsx';
import { useDemoState, useDemoActions } from '../state/DemoStore.jsx';

const { RangePicker } = DatePicker;
const dash = (v) => (v === null || v === undefined || v === '' ? '--' : v);

// 出库记录（核心）：维修领料出库必选「未完成的维修工单」（已派工 / 维修中）+ 备件 + 数量；
// 每次出库由页面生成一个 requestId（useRef 计数）作为幂等键 outbound:{工单}:{备件}:{requestId}，
// 重复点击同 requestId 不会重复扣库存；提交成功后页面才推进 requestId。
// 归还（余料退库）从出库记录发起，数量不得超过「已出库未归还」余量（actions.returnSpare 也会校验）。
export default function SparePartsOutboundPage() {
  const navigate = useNavigate();
  const { message } = App.useApp();
  const state = useDemoState();
  const actions = useDemoActions();
  const [range, setRange] = useState(null);
  const [typeKw, setTypeKw] = useState(null);
  const [outOpen, setOutOpen] = useState(false);
  const [retTarget, setRetTarget] = useState(null);
  const [personPickerOpen, setPersonPickerOpen] = useState(false);
  const [outForm] = Form.useForm();
  const [retForm] = Form.useForm();
  // 幂等 requestId（useRef 计数）：提交成功后才推进，失败/重复提交沿用同一 requestId
  const outReqNo = useRef(1);
  const retReqNo = useRef(1);

  const { repairOrdersById, sparesByCode, warehousesById, stockByKey, returnsById } = state.entities;

  const list = useMemo(() => Object.values(state.entities.outboundsById)
    .sort((a, b) => (a.createTime < b.createTime ? 1 : -1)), [state]);

  // 已出库未归还余量：退库数量以此为上限（validateReturn 口径）
  const returnedQtyOf = (outboundId) => Object.values(returnsById)
    .filter(r => r.outboundId === outboundId)
    .reduce((s, r) => s + r.qty, 0);

  const filtered = list.filter(r => {
    if (typeKw && r.type !== typeKw) return false;
    if (range && range[0] && range[1]) {
      const from = range[0].format('YYYY-MM-DD');
      const to = range[1].format('YYYY-MM-DD');
      if (r.date < from || r.date > to) return false;
    }
    return true;
  });

  // ---------- 出库 ----------
  const openOutbound = () => {
    outForm.resetFields();
    setOutOpen(true);
  };

  const spareCode = Form.useWatch('spareCode', outForm);
  const warehouseId = Form.useWatch('warehouseId', outForm);
  const outQty = Form.useWatch('qty', outForm);
  const pickedStock = spareCode && warehouseId ? stockByKey[`${warehouseId}|${spareCode}`] : null;
  const pickedAvailable = pickedStock ? pickedStock.onHand - pickedStock.reserved : null;

  const submitOutbound = (values) => {
    // 前置提示：超可用量直接拦截（actions.consumeSpare 内部也会再校验一次）
    if (pickedAvailable !== null && values.qty > pickedAvailable) {
      message.warning(`出库数量 ${values.qty} 超过该仓库可用库存 ${pickedAvailable}，请调整数量`);
      return;
    }
    const requestId = `req-outbound-${String(outReqNo.current).padStart(4, '0')}`;
    const res = actions.consumeSpare({
      repairOrderId: values.repairOrderId,
      spareCode: values.spareCode,
      warehouseId: values.warehouseId,
      qty: values.qty,
      person: values.person,
      requestId,
    });
    message[res.ok ? 'success' : 'error'](res.message);
    if (res.ok) {
      outReqNo.current += 1; // 提交成功后更新 requestId
      setOutOpen(false);
    }
    // 失败不推进 requestId：修正后重试仍携带同一幂等键
  };

  // ---------- 归还（余料退库） ----------
  const openReturn = (record) => {
    retForm.resetFields();
    setRetTarget(record);
  };

  const retRemaining = retTarget ? retTarget.items[0].qty - returnedQtyOf(retTarget.outboundId) : 0;

  const submitReturn = (values) => {
    if (values.qty > retRemaining) {
      message.warning(`退库数量超过该工单可退余量 ${retRemaining}`);
      return;
    }
    const requestId = `req-return-${String(retReqNo.current).padStart(4, '0')}`;
    const res = actions.returnSpare({
      outboundId: retTarget.outboundId,
      qty: values.qty,
      reason: values.reason,
      requestId,
    });
    message[res.ok ? 'success' : 'error'](res.message);
    if (res.ok) {
      retReqNo.current += 1;
      setRetTarget(null);
    }
  };

  const repairOptions = Object.values(repairOrdersById)
    .filter(o => ['已派工', '维修中'].includes(o.status)) // 未完成且允许领料的工单（actions 同口径校验）
    .map(o => ({ value: o.repairOrderId, label: `${o.code} · ${o.deviceName}（${o.status}）` }));
  const spareOptions = Object.values(sparesByCode).map(s => ({ value: s.code, label: `${s.code} ${s.name}（${s.unit}）` }));
  const warehouseOptions = Object.values(warehousesById).map(w => ({ value: w.warehouseId, label: w.name }));

  return (
    <>
      <PageHeader title="出库记录" />
      <DegradedBanner meta={state.meta} />
      <Card size="small" style={{ marginBottom: 12 }}>
        <Space wrap>
          <RangePicker
            style={{ width: 240 }}
            placeholder={['请选择开始结束日期', '请选择开始结束日期']}
            value={range}
            onChange={setRange}
          />
          <Select
            style={{ width: 140 }}
            placeholder="出库类型"
            allowClear
            value={typeKw}
            onChange={setTypeKw}
            options={['领用出库', '维修出库'].map(v => ({ value: v, label: v }))}
          />
          <Button onClick={() => { setRange(null); setTypeKw(null); }}>重置</Button>
        </Space>
      </Card>
      <Card size="small">
        <Space wrap style={{ marginBottom: 12 }}>
          <Button type="primary" icon={<PackageOpen size={14} />} onClick={openOutbound}>维修领料出库</Button>
        </Space>
        {filtered.length === 0 ? (
          <EmptyState description="暂无出库记录" reason="筛选条件下没有匹配的出库单，或尚未执行出库" />
        ) : (
          <Table
            rowKey="outboundId" size="small"
            dataSource={filtered}
            columns={[
              { title: '出库单据编号', dataIndex: 'code', width: 160 },
              { title: '出库类型', dataIndex: 'type', width: 100 },
              { title: '关联维修工单', dataIndex: 'repairOrderId', width: 150, render: v => v || '--' },
              { title: '出库备件', width: 180, render: (_, r) => {
                const item = (r.items || [])[0];
                return item ? `${dash(item.spareName)} ×${item.qty}${item.unit || ''}` : '--';
              } },
              { title: '出库仓库', dataIndex: 'warehouseId', width: 120 },
              { title: '出库人', dataIndex: 'person', width: 90, render: v => v || '--' },
              { title: '出库日期', dataIndex: 'date', width: 110 },
              { title: '创建时间', dataIndex: 'createTime', width: 170 },
              { title: '操作', width: 130, render: (_, r) => {
                const remaining = (r.items?.[0]?.qty || 0) - returnedQtyOf(r.outboundId);
                return (
                  <Space size={0}>
                    <Button type="link" size="small" onClick={() => navigate(`/spare-parts-outbound/detail?code=${r.code}`)}>详情</Button>
                    <Button type="link" size="small" icon={<Undo2 size={13} />} disabled={remaining <= 0} onClick={() => openReturn(r)}>归还</Button>
                  </Space>
                );
              } },
            ]}
            pagination={{ pageSize: 10, showTotal: t => `共 ${t} 条数据` }}
          />
        )}
      </Card>

      {/* 维修领料出库（每次出库一个 requestId；超可用量前置提示，actions 内部仍会校验） */}
      <Modal
        title="维修领料出库"
        width={640}
        open={outOpen}
        destroyOnClose
        onCancel={() => setOutOpen(false)}
        onOk={() => outForm.validateFields().then(submitOutbound).catch(() => {})}
        okText="确认出库" cancelText="取消"
      >
        <Alert
          type="info" showIcon style={{ marginBottom: 14 }}
          message={`当前出库幂等键：outbound:{工单}:{备件}:req-outbound-${String(outReqNo.current).padStart(4, '0')}`}
          description="重复点击确认不会重复扣库存（幂等）；出库成功后自动更换下一次的幂等键。"
        />
        <Form form={outForm} labelCol={{ span: 6 }} wrapperCol={{ span: 16 }}>
          <Form.Item label="关联维修工单" name="repairOrderId" rules={[{ required: true, message: '请选择关联维修工单' }]}>
            <Select showSearch optionFilterProp="label" placeholder="仅未完成工单（已派工/维修中）可领料" options={repairOptions} notFoundContent="暂无可领料的维修工单" />
          </Form.Item>
          <Form.Item label="备件" name="spareCode" rules={[{ required: true, message: '请选择备件' }]}>
            <Select showSearch optionFilterProp="label" placeholder="请选择备件" options={spareOptions} />
          </Form.Item>
          <Form.Item label="出库仓库" name="warehouseId" rules={[{ required: true, message: '请选择出库仓库' }]}>
            <Select placeholder="请选择仓库" options={warehouseOptions} />
          </Form.Item>
          <Form.Item label="领料人" name="person" rules={[{ required: true, message: '请选择领料人' }]}>
            <Input
              readOnly placeholder="点击「选择」从人员主数据选取"
              addonAfter={<Button type="link" size="small" style={{ margin: -7 }} onClick={() => setPersonPickerOpen(true)}>选择</Button>}
            />
          </Form.Item>
          <Form.Item label="出库数量" name="qty" rules={[{ required: true, message: '请输入出库数量' }]}>
            <InputNumber style={{ width: '100%' }} min={0.01} placeholder="必须为正数且不超过可用库存" />
          </Form.Item>
          <Typography.Text type="secondary" style={{ display: 'block', margin: '-8px 0 12px 88px', fontSize: 12 }}>
            该仓库可用量：{pickedAvailable === null ? '--（该仓库未配置此备件库存）' : pickedAvailable}
            {pickedAvailable !== null && outQty > pickedAvailable && (
              <Typography.Text type="danger">　出库数量超过可用量 {pickedAvailable}</Typography.Text>
            )}
          </Typography.Text>
        </Form>
      </Modal>

      {/* 领料人：人员主数据（三方系统来源）弹窗选择，选中后回填 */}
      <UserPickerModal
        open={personPickerOpen}
        title="选择领料人"
        onCancel={() => setPersonPickerOpen(false)}
        onSelect={(u) => { outForm.setFieldsValue({ person: u.name }); setPersonPickerOpen(false); }}
      />

      {/* 归还（余料退库）：从出库记录发起，数量 ≤ 已出库未归还 */}
      <Modal
        title={`余料退库 · ${retTarget ? retTarget.code : ''}`}
        width={520}
        open={!!retTarget}
        destroyOnClose
        onCancel={() => setRetTarget(null)}
        onOk={() => retForm.validateFields().then(submitReturn).catch(() => {})}
        okText="确认退库" cancelText="取消"
      >
        {retTarget && (
          <Alert
            type="info" showIcon style={{ marginBottom: 14 }}
            message={`${dash(retTarget.items?.[0]?.spareName)} · 出库 ${retTarget.items?.[0]?.qty} · 已退库 ${returnedQtyOf(retTarget.outboundId)} · 可退余量 ${retRemaining}`}
            description={`退库后按原出库仓库「${retTarget.warehouseId}」回冲在库量；幂等键 return:{出库单}:{requestId}。`}
          />
        )}
        <Form form={retForm} labelCol={{ span: 6 }} wrapperCol={{ span: 16 }}>
          <Form.Item label="退库数量" name="qty" rules={[{ required: true, message: '请输入退库数量' }]}>
            <InputNumber style={{ width: '100%' }} min={0.01} max={retRemaining || undefined} placeholder={`不超过可退余量 ${retRemaining}`} />
          </Form.Item>
          <Form.Item label="退库原因" name="reason">
            <Input.TextArea rows={2} maxLength={200} placeholder="如：领用余料退库" />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
