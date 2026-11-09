import React, { useMemo, useState } from 'react';
import dayjs from 'dayjs';
import { Card, Descriptions, Tag, Button, Space, Modal, Form, Select, Input, InputNumber, App, Alert, Table, Timeline, Radio, DatePicker, Upload, Row, Col, Divider } from 'antd';
import { ArrowLeft, Plus } from 'lucide-react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import PageHeader from '../components/PageHeader.jsx';
import DegradedBanner from '../components/DegradedBanner.jsx';
import StatusTag from '../components/StatusTag.jsx';
import EmptyState from '../components/EmptyState.jsx';
import { useDemoState, useDemoActions } from '../state/DemoStore.jsx';
import { selectRepairById, selectOutboundForRepair, selectSpareTotals, selectAllRepairKnowledge } from '../state/selectors.js';
import { SLA_HOURS, HANDLING_METHODS, HANDLING_METHOD_REPLACE, REPAIR_TYPES, REPAIR_PARTS, REPAIR_LEVELS } from '../domain/repair.js';
import { users } from '../data/demo/masterData.js';

const levelColor = { 紧急: 'red', 严重: 'orange', 一般: 'blue' };
// 维修人员下拉统一取自三方主数据（在职的维修工程师/设备负责人/点检员/巡检员/备件管理员）
const repairStaff = users.filter(u => u.status === '在职' && (u.role === '维修工程师' || u.role === '设备负责人' || u.role === '点检员' || u.role === '巡检员' || u.role === '备件管理员')).map(u => u.name);
const repairPersons = repairStaff.map(v => ({ value: v, label: v }));

// Upload 文件列表 → 图片名数组（演示口径：仅记录文件名，不上传二进制）
function fileNames(fileList = []) {
  return (fileList || []).map(f => f?.name).filter(Boolean);
}

// 执行维修页（store 驱动）：/repair-orders/:repairOrderId/execute（兼容旧 query ?code=）。
// 按 REPAIR_TRANSITIONS 渲染可执行操作：
// 待派工 → 派工；已派工 → 开始维修（自动创建「维修中」停机事实并联动 OEE）；
// 维修中 → 挂起（必填原因）/ 恢复 / 提交验收（必填处理措施+验证结果）；待验收 → 跳验收页。
// 本页按原型「查看.html」「去维修.html」补齐：处理方式（单选）、更换备件表（领料闭环）、
// 故障原因/维修说明/维修类型/维修部位/维修级别/起止时间/维修人员（多选）/维修图片/备注、
// 选用维修经验与加入经验库。
export default function RepairExecutePage() {
  const navigate = useNavigate();
  const { repairOrderId } = useParams();
  const [params] = useSearchParams();
  // 兼容旧路由 /repair-orders/execute?code=RO-xxx
  const orderId = repairOrderId || params.get('code') || params.get('repairOrderId');

  const { message } = App.useApp();
  const state = useDemoState();
  const actions = useDemoActions();
  const meta = state.meta;

  const order = orderId ? selectRepairById(state, orderId) : null;
  const outbounds = order ? selectOutboundForRepair(state, order.repairOrderId) : [];

  const [assignOpen, setAssignOpen] = useState(false);
  const [assignForm] = Form.useForm();
  const [pauseOpen, setPauseOpen] = useState(false);
  const [pauseForm] = Form.useForm();
  const [submitOpen, setSubmitOpen] = useState(false);
  const [submitForm] = Form.useForm();
  const [execForm] = Form.useForm();
  const handlingMethod = Form.useWatch('handlingMethod', execForm);

  // 备件选择弹窗（原型「查看.html」：搜索 / 选择备件 / 确认）
  const [sparePickOpen, setSparePickOpen] = useState(false);
  const [spareKw, setSpareKw] = useState('');
  const [sparePickRows, setSparePickRows] = useState([]);
  // 待确认的备件更换明细（确认后才调用 actions.consumeSpare 扣库存）
  const [pendingParts, setPendingParts] = useState([]);
  const [rowSeq, setRowSeq] = useState(0);

  // 维修经验：选用 / 加入经验库
  const [knowledgeOpen, setKnowledgeOpen] = useState(false);
  const [knowledgeAddOpen, setKnowledgeAddOpen] = useState(false);
  const [knowledgeKw, setKnowledgeKw] = useState('');
  const [knowledgeForm] = Form.useForm();

  const spares = Object.values(state.entities.sparesByCode || {});
  const totals = selectSpareTotals(state);
  const knowledgeList = selectAllRepairKnowledge(state);

  // 该备件可用库存最大的仓库（领料出库落库口径；无库存配置则返回 null）
  const bestWarehouseOf = (spareCode) => {
    const rows = Object.values(state.entities.stockByKey || {}).filter(r => r.spareCode === spareCode);
    if (!rows.length) return null;
    const sorted = [...rows].sort((a, b) => (b.onHand - b.reserved) - (a.onHand - a.reserved));
    return sorted[0].warehouseId;
  };

  // 已领用备件（原型更换备件表数据源：order.parts）
  const consumedParts = useMemo(() => (order?.parts || []).map(p => ({
    ...p,
    spec: state.entities.sparesByCode?.[p.spareCode]?.spec || '--',
    stock: totals[p.spareCode]?.onHand ?? null,
  })), [order?.parts, state.entities.sparesByCode, totals]);

  if (!orderId || !order) {
    return (
      <>
        <PageHeader title="执行故障维修" subtitle={orderId ? `维修工单：${orderId}` : '未指定维修工单'}
          actions={<Button icon={<ArrowLeft size={14} />} onClick={() => navigate('/repair-orders')}>返回列表</Button>} />
        <Card size="small">
          <EmptyState
            description={`未找到维修工单${orderId ? `「${orderId}」` : ''}`}
            reason="单号无效或工单不存在（不回退展示其他工单）"
            next
            onNext={() => navigate('/repair-orders')}
            nextLabel="返回维修任务列表"
          />
        </Card>
      </>
    );
  }

  const run = (fn) => {
    const res = fn();
    message[res.ok ? 'success' : 'error'](res.message);
    return res.ok;
  };

  const doStart = () => run(() => actions.startRepair(order.repairOrderId));
  const doResume = () => run(() => actions.resumeRepair(order.repairOrderId));

  const doAssign = async () => {
    const values = await assignForm.validateFields();
    if (run(() => actions.assignRepair(order.repairOrderId, { assignee: values.assignee, assigneeGroup: values.assigneeGroup || null }))) {
      setAssignOpen(false);
    }
  };
  const doPause = async () => {
    const values = await pauseForm.validateFields();
    if (run(() => actions.pauseRepair(order.repairOrderId, values.reason))) {
      setPauseOpen(false);
    }
  };

  // 执行表单 → 工单执行字段（图片只存文件名）
  const execValues = (values) => ({
    handlingMethod: values.handlingMethod || null,
    faultCause: values.faultCause || '',
    repairDesc: values.repairDesc || '',
    repairType: values.repairType || null,
    repairPart: values.repairPart || null,
    repairLevel: values.repairLevel || null,
    repairStartTime: values.repairStartTime || null,
    repairEndTime: values.repairEndTime || null,
    repairPersonIds: values.repairPersonIds || [],
    repairTime: values.repairTime || null,
    images: fileNames(values.images),
    remark: values.remark || '',
  });

  // 保存维修结果（不改工单状态；处理方式等字段即时落库）
  const doSaveExecution = async () => {
    const values = await execForm.validateFields();
    run(() => actions.saveRepairExecution(order.repairOrderId, execValues(values)));
  };

  // 提交验收：执行表单字段 + 处理措施/验证结果 一并写回工单
  const doSubmit = async () => {
    const exec = await execForm.validateFields();
    const values = await submitForm.validateFields();
    if (run(() => actions.submitRepair(order.repairOrderId, {
      ...execValues(exec),
      measures: values.measures, verification: values.verification, laborHours: values.laborHours ?? order.laborHours,
    }))) {
      setSubmitOpen(false);
    }
  };

  // 备件：加入待确认明细（原型「选择备件」）
  const addPendingPart = (spareCode) => {
    const spare = state.entities.sparesByCode?.[spareCode];
    if (!spare) return;
    if (pendingParts.some(p => p.spareCode === spareCode)) { message.warning(`${spare.name} 已在待确认明细中`); return; }
    const seq = rowSeq + 1;
    setRowSeq(seq);
    setPendingParts([...pendingParts, {
      rowKey: `row-${seq}`,
      // 幂等键 requestId 在「加入明细」时生成：重复点击「确认」不重复扣库存，重新添加则为新键
      requestId: `req-${Date.now()}-${seq}-${spareCode}`,
      spareCode, spareName: spare.name, spec: spare.spec || '--',
      stock: totals[spareCode]?.onHand ?? null, qty: 1, warehouseId: bestWarehouseOf(spareCode),
    }]);
    setSparePickRows(sparePickRows.filter(r => r !== spareCode));
  };
  const removePendingPart = (rowKey) => setPendingParts(pendingParts.filter(p => p.rowKey !== rowKey));
  const setPendingQty = (rowKey, qty) => setPendingParts(pendingParts.map(p => (p.rowKey === rowKey ? { ...p, qty } : p)));

  // 确认更换备件：逐行调用 actions.consumeSpare（幂等键 outbound:{orderId}:{spareCode}:{requestId}）
  const confirmParts = () => {
    if (!pendingParts.length) { message.warning('请先选择备件'); return; }
    let okCount = 0;
    pendingParts.forEach(p => {
      const res = actions.consumeSpare({
        repairOrderId: order.repairOrderId, spareCode: p.spareCode, warehouseId: p.warehouseId,
        qty: p.qty, requestId: p.requestId, person: order.assignee || undefined,
        remark: `维修任务 ${order.code} 更换备件。`,
      });
      if (res.ok) okCount += 1; else message.error(res.message);
    });
    if (okCount > 0) {
      message.success(`已确认更换备件 ${okCount} 项，库存已扣减并生成出库单`);
      setPendingParts([]);
    }
  };

  // 移除已领用备件：调用 actions.returnSpare 做余料退库（幂等键 return:{outboundId}:{requestId}）
  const removeConsumedPart = (part) => {
    const res = actions.returnSpare({
      outboundId: part.outboundId, qty: part.qty, reason: '维修执行页移除该备件，余料退库',
      requestId: `${part.outboundId}-remove`,
    });
    message[res.ok ? 'success' : 'error'](res.message);
  };

  // 选用维修经验：回填故障原因 / 维修说明
  const applyKnowledge = (k) => {
    execForm.setFieldsValue({ faultCause: k.faultReason || '', repairDesc: k.repairContent || '' });
    message.success(`已选用维修经验「${k.name}」`);
  };

  // 加入经验库：把本次录入的故障原因 / 维修说明写入经验库
  const doAddKnowledge = async () => {
    const values = await knowledgeForm.validateFields();
    const res = actions.createRepairKnowledge({
      ...values, requestId: `rk-${order.repairOrderId}-${(order.timeline || []).length}-${Date.now()}`,
    });
    message[res.ok ? 'success' : 'error'](res.message);
    if (res.ok) { knowledgeForm.resetFields(); setKnowledgeAddOpen(false); }
  };

  const slaHours = order.slaHours || SLA_HOURS[order.level] || null;
  const executable = ['已派工', '维修中', '挂起'].includes(order.status);
  const sourceLabel = { alarm: '监测异常', report: '报修任务', 'alarm+report': '监测异常', quick: '快速维修' }[order.source] || '--';

  const execInitial = {
    handlingMethod: order.handlingMethod || undefined,
    faultCause: order.faultCause || '',
    repairDesc: order.repairDesc || '',
    repairType: order.repairType || undefined,
    repairPart: order.repairPart || undefined,
    repairLevel: order.repairLevel || undefined,
    repairStartTime: order.repairStartTime ? dayjs(order.repairStartTime) : undefined,
    repairEndTime: order.repairEndTime ? dayjs(order.repairEndTime) : undefined,
    repairPersonIds: order.repairPersonIds || [],
    repairTime: order.repairTime ? dayjs(order.repairTime) : undefined,
    images: (order.images || []).map(n => ({ uid: n, name: n, status: 'done' })),
    remark: order.remark || '',
  };

  const sparePickList = spares
    .filter(s => !spareKw || (s.name || '').includes(spareKw) || (s.code || '').includes(spareKw) || (s.spec || '').includes(spareKw));

  return (
    <>
      <PageHeader
        title="执行故障维修"
        subtitle={`维修工单：${order.code} · 来源：${sourceLabel} · 当前状态：${order.status}`}
        actions={<Button icon={<ArrowLeft size={14} />} onClick={() => navigate('/repair-orders')}>返回列表</Button>}
      />
      <DegradedBanner meta={meta} />

      {/* 状态机操作区 */}
      <Card size="small" style={{ marginBottom: 12 }}>
        <Space wrap align="center">
          <span style={{ fontWeight: 600 }}>下一步操作：</span>
          <StatusTag value={order.status} />
          {order.status === '待派工' && (
            <Button type="primary" onClick={() => { assignForm.resetFields(); setAssignOpen(true); }}>派工</Button>
          )}
          {order.status === '已派工' && (
            <>
              <Button type="primary" onClick={doStart}>开始维修</Button>
              <span style={{ fontSize: 12, color: '#8a97a3' }}>开始维修将自动创建「维修中」停机事实并联动 OEE 可用率</span>
            </>
          )}
          {order.status === '维修中' && (
            <>
              <Button onClick={() => { pauseForm.resetFields(); setPauseOpen(true); }}>挂起</Button>
              <Button type="primary" onClick={() => { submitForm.resetFields(); setSubmitOpen(true); }}>提交验收</Button>
              <span style={{ fontSize: 12, color: '#8a97a3' }}>挂起需填写原因；提交验收必填处理措施与验证结果，提交后进入「待验收」</span>
            </>
          )}
          {order.status === '挂起' && (
            <>
              <Button type="primary" onClick={doResume}>恢复维修</Button>
              <span style={{ fontSize: 12, color: '#8a97a3' }}>挂起原因：{order.pauseReason || '--'}</span>
            </>
          )}
          {order.status === '待验收' && (
            <>
              <Button type="primary" onClick={() => navigate(`/repair-orders/${order.repairOrderId}/accept`)}>前往验收</Button>
              <span style={{ fontSize: 12, color: '#8a97a3' }}>工单已提交验收，验收通过后设备才恢复</span>
            </>
          )}
          {order.status === '已完成' && (
            <span style={{ fontSize: 12, color: '#8a97a3' }}>工单已完成，可在详情页查看验收记录</span>
          )}
          {order.status === '已取消' && (
            <span style={{ fontSize: 12, color: '#8a97a3' }}>工单已取消</span>
          )}
        </Space>
      </Card>

      {/* 故障信息 */}
      <Card size="small" style={{ marginBottom: 12 }}>
        <div style={{ fontWeight: 600, marginBottom: 12 }}>故障信息</div>
        <Descriptions column={2} size="small" bordered>
          <Descriptions.Item label="故障名称">{order.title || '--'}</Descriptions.Item>
          <Descriptions.Item label="维修设备">{order.deviceName || '--'}（{order.deviceCode || '--'}）</Descriptions.Item>
          <Descriptions.Item label="故障等级"><Tag color={levelColor[order.level] || 'default'}>{order.level || '--'}</Tag></Descriptions.Item>
          <Descriptions.Item label="故障类型">{order.faultType || '--'}</Descriptions.Item>
          <Descriptions.Item label="来源报警">{order.alarmId
            ? <a onClick={() => navigate('/alarm-center')}>{order.alarmId}</a>
            : '--'}</Descriptions.Item>
          <Descriptions.Item label="来源报修单">{order.reportId || '--'}</Descriptions.Item>
          <Descriptions.Item label="SLA">{slaHours ? `${slaHours} 小时（${order.slaDueAt || '--'} 前）` : '--'}</Descriptions.Item>
          <Descriptions.Item label="报修人">{order.reporter || '--'}</Descriptions.Item>
          <Descriptions.Item label="故障描述" span={2}>{order.faultDesc || '--'}</Descriptions.Item>
        </Descriptions>
      </Card>

      {/* 维修执行录入（原型「查看.html」录入表单） */}
      <Card size="small" style={{ marginBottom: 12 }}>
        <div style={{ fontWeight: 600, marginBottom: 12 }}>维修执行录入</div>
        {!executable && (
          <Alert type="info" showIcon style={{ marginBottom: 12 }}
            message={`当前状态「${order.status}」不可录入维修结果`} />
        )}
        <Form
          form={execForm}
          layout="vertical"
          disabled={!executable}
          initialValues={execInitial}
        >
          <Row gutter={16}>
            <Col span={24}>
              <Form.Item label="处理方式" name="handlingMethod" extra="选择「更换备件」时才出现更换备件的操作表格">
                <Radio.Group options={HANDLING_METHODS.map(v => ({ value: v, label: v }))} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="故障原因" name="faultCause">
                <Input.TextArea rows={3} placeholder="请输入故障原因（不超过500字符）" maxLength={500} showCount />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="维修说明" name="repairDesc">
                <Input.TextArea rows={3} placeholder="请输入维修说明（不超过500字符）" maxLength={500} showCount />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="维修类型" name="repairType">
                <Select allowClear placeholder="请选择" options={REPAIR_TYPES.map(v => ({ value: v, label: v }))} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="维修部位" name="repairPart">
                <Select allowClear placeholder="请选择" options={REPAIR_PARTS.map(v => ({ value: v, label: v }))} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="维修级别" name="repairLevel">
                <Select allowClear placeholder="请选择" options={REPAIR_LEVELS.map(v => ({ value: v, label: v }))} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="维修开始时间" name="repairStartTime">
                <DatePicker showTime placeholder="请选择" valueFormat="YYYY-MM-DD HH:mm" style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="维修结束时间" name="repairEndTime">
                <DatePicker showTime placeholder="请选择" valueFormat="YYYY-MM-DD HH:mm" style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="维修时间" name="repairTime">
                <DatePicker showTime placeholder="请选择" valueFormat="YYYY-MM-DD HH:mm" style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="维修人员" name="repairPersonIds">
                <Select mode="multiple" allowClear placeholder="请选择维修人员（可多选）" options={repairPersons} />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item label="维修图片" name="images" valuePropName="fileList" getValueFromEvent={e => e?.fileList}>
                <Upload beforeUpload={() => false} listType="picture-card" maxCount={10} accept="image/*">
                  <Button icon={<Plus size={14} />}>上传图片</Button>
                </Upload>
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item label="备注" name="remark">
                <Input.TextArea rows={2} placeholder="请输入备注" maxLength={200} showCount />
              </Form.Item>
            </Col>
          </Row>
          <Space wrap>
            <Button onClick={() => setKnowledgeOpen(true)} disabled={!executable}>选用维修经验</Button>
            <Button onClick={() => { knowledgeForm.setFieldsValue({ name: order.title, faultReason: execForm.getFieldValue('faultCause'), repairContent: execForm.getFieldValue('repairDesc') }); setKnowledgeAddOpen(true); }} disabled={!executable}>加入经验库</Button>
            <Button type="primary" onClick={doSaveExecution} disabled={!executable}>保存</Button>
          </Space>
        </Form>

        {/* 更换备件表（仅处理方式 = 更换备件时出现；原型「查看.html」列口径） */}
        {handlingMethod === HANDLING_METHOD_REPLACE && (
          <>
            <Divider style={{ margin: '12px 0' }} />
            <div style={{ fontWeight: 600, marginBottom: 8 }}>更换备件</div>
            <Space wrap style={{ marginBottom: 8 }}>
              <Button onClick={() => { setSpareKw(''); setSparePickOpen(true); }}>选择备件</Button>
              <Button type="primary" onClick={confirmParts} disabled={!pendingParts.length}>确认</Button>
              <span style={{ fontSize: 12, color: '#8a97a3' }}>备件库存为该物料在所有仓库的现存量之和；确认后按仓库出库并扣减库存</span>
            </Space>
            <Table
              rowKey="rowKey" size="small" pagination={false}
              dataSource={[...consumedParts.map(p => ({ ...p, rowKey: p.outboundId, state: '已出库' })), ...pendingParts.map(p => ({ ...p, state: '待确认' }))]}
              locale={{ emptyText: <span style={{ fontSize: 13, color: '#8a97a3' }}>--（暂无更换备件，点击「选择备件」添加）</span> }}
              columns={[
                { title: '备件名称', dataIndex: 'spareName', width: 150, render: v => v || '--' },
                { title: '规格型号', dataIndex: 'spec', width: 130, render: v => v || '--' },
                { title: '备件库存', dataIndex: 'stock', width: 100, render: v => (v === null || v === undefined ? '--' : v) },
                {
                  title: '更换数量', dataIndex: 'qty', width: 120,
                  render: (v, r) => (r.state === '待确认'
                    ? <InputNumber size="small" min={1} value={v} onChange={q => setPendingQty(r.rowKey, q || 1)} />
                    : (v ?? '--')),
                },
                {
                  title: '操作', width: 90, fixed: 'right',
                  render: (_, r) => (r.state === '待确认'
                    ? <Button type="link" size="small" onClick={() => removePendingPart(r.rowKey)}>移除</Button>
                    : <Button type="link" size="small" onClick={() => removeConsumedPart(r)}>移除</Button>),
                },
              ]}
            />
          </>
        )}
      </Card>

      {/* 维修信息 */}
      <Card size="small" style={{ marginBottom: 12 }}>
        <div style={{ fontWeight: 600, marginBottom: 12 }}>维修信息</div>
        <Descriptions column={2} size="small" bordered>
          <Descriptions.Item label="处理方式">{order.handlingMethod || '--'}</Descriptions.Item>
          <Descriptions.Item label="故障原因">{order.faultCause || '--'}</Descriptions.Item>
          <Descriptions.Item label="维修说明" span={2}>{order.repairDesc || '--'}</Descriptions.Item>
          <Descriptions.Item label="维修类型">{order.repairType || '--'}</Descriptions.Item>
          <Descriptions.Item label="维修部位">{order.repairPart || '--'}</Descriptions.Item>
          <Descriptions.Item label="维修级别">{order.repairLevel || '--'}</Descriptions.Item>
          <Descriptions.Item label="维修开始时间">{order.repairStartTime || '--'}</Descriptions.Item>
          <Descriptions.Item label="维修结束时间">{order.repairEndTime || '--'}</Descriptions.Item>
          <Descriptions.Item label="维修人员">{(order.repairPersonIds || []).join('、') || '--'}</Descriptions.Item>
          <Descriptions.Item label="维修时间">{order.repairTime || '--'}</Descriptions.Item>
          <Descriptions.Item label="维修图片">{(order.images || []).join('、') || '--'}</Descriptions.Item>
          <Descriptions.Item label="备注">{order.remark || '--'}</Descriptions.Item>
          <Descriptions.Item label="维修人">{order.assignee ? `${order.assigneeGroup ? order.assigneeGroup + ' ' : ''}${order.assignee}` : '--'}</Descriptions.Item>
          <Descriptions.Item label="派工时间">{order.assignedAt || '--'}</Descriptions.Item>
          <Descriptions.Item label="开工时间">{order.startedAt || '--'}</Descriptions.Item>
          <Descriptions.Item label="提交验收时间">{order.submittedAt || '--'}</Descriptions.Item>
          <Descriptions.Item label="处理措施" span={2}>{order.measures || '--'}</Descriptions.Item>
          <Descriptions.Item label="验证结果" span={2}>{order.verification || '--'}</Descriptions.Item>
          <Descriptions.Item label="工时（小时）">{order.laborHours ?? '--'}</Descriptions.Item>
          <Descriptions.Item label="关联停机事实">{order.downtimeFactId || '--'}</Descriptions.Item>
        </Descriptions>
      </Card>

      {/* 领用备件（含维修出库记录） */}
      <Card size="small" style={{ marginBottom: 12 }}>
        <div style={{ fontWeight: 600, marginBottom: 12 }}>领用备件</div>
        {order.parts?.length ? (
          <Table
            rowKey="outboundId" size="small" pagination={false}
            dataSource={order.parts}
            columns={[
              { title: '备件编码', dataIndex: 'spareCode', width: 110, render: v => v || '--' },
              { title: '备件名称', dataIndex: 'spareName', width: 140, render: v => v || '--' },
              { title: '数量', dataIndex: 'qty', width: 70, render: v => v ?? '--' },
              { title: '仓库', dataIndex: 'warehouseId', width: 130, render: v => v || '--' },
              { title: '出库单', dataIndex: 'outboundId', width: 160, render: v => v || '--' },
            ]}
          />
        ) : (
          <div style={{ fontSize: 13, color: '#8a97a3' }}>--（本工单暂无领用备件；处理方式选择「更换备件」后可在上方「更换备件」表中领料）</div>
        )}
        {outbounds.length > 0 && (
          <>
            <div style={{ fontWeight: 600, margin: '12px 0 8px' }}>维修出库记录</div>
            <Table
              rowKey="outboundId" size="small" pagination={false}
              dataSource={outbounds}
              columns={[
                { title: '出库单号', dataIndex: 'outboundId', width: 160, render: v => v || '--' },
                { title: '仓库', dataIndex: 'warehouseId', width: 130, render: v => v || '--' },
                { title: '备件', width: 180, render: (_, r) => (r.items?.[0] ? `${r.items[0].spareName || '--'} ×${r.items[0].qty ?? '--'}` : '--') },
                { title: '创建时间', dataIndex: 'createTime', width: 160, render: v => v || '--' },
                { title: '状态', dataIndex: 'status', width: 90, render: v => v || '--' },
              ]}
            />
          </>
        )}
      </Card>

      {/* 工单 timeline */}
      <Card size="small">
        <div style={{ fontWeight: 600, marginBottom: 12 }}>处理时间线</div>
        {order.timeline?.length ? (
          <Timeline
            items={order.timeline.map((t, i) => ({
              key: i,
              color: ['验收通过'].includes(t.type) ? 'green' : ['退回返修', '挂起', '取消'].includes(t.type) ? 'red' : 'blue',
              children: (
                <div style={{ fontSize: 13 }}>
                  <Tag>{t.type || '--'}</Tag>
                  <span style={{ color: '#8a97a3', marginRight: 8 }}>{t.time || '--'}</span>
                  <span>{t.actor || '--'}：{t.detail || '--'}</span>
                </div>
              ),
            }))}
          />
        ) : (
          <div style={{ fontSize: 13, color: '#8a97a3' }}>--（暂无处理记录）</div>
        )}
      </Card>

      {/* 派工弹窗 */}
      <Modal title={`派工（${order.code}）`} width={520} open={assignOpen} destroyOnHidden
        onCancel={() => setAssignOpen(false)} onOk={doAssign} okText="确认派工" cancelText="取消">
        <Form form={assignForm} layout="vertical" initialValues={{ assigneeGroup: order.assigneeGroup || '机修班' }}>
          <Form.Item label="维修人员" name="assignee" required rules={[{ required: true, message: '派工必须指定维修人' }]}>
            <Select placeholder="请选择维修人员" options={repairPersons} />
          </Form.Item>
          <Form.Item label="维修班组" name="assigneeGroup">
            <Select placeholder="请选择" allowClear options={['机修班', '电气班', '工艺班'].map(v => ({ value: v, label: v }))} />
          </Form.Item>
        </Form>
      </Modal>

      {/* 挂起弹窗（必填原因） */}
      <Modal title={`挂起工单（${order.code}）`} width={480} open={pauseOpen} destroyOnHidden
        onCancel={() => setPauseOpen(false)} onOk={doPause} okText="确认挂起" cancelText="取消">
        <Form form={pauseForm} layout="vertical">
          <Form.Item label="挂起原因" name="reason" required rules={[{ required: true, message: '请填写挂起原因' }]}>
            <Input.TextArea rows={3} placeholder="如：等待备件到货、需外协支持等" maxLength={200} showCount />
          </Form.Item>
        </Form>
      </Modal>

      {/* 提交验收弹窗（必填处理措施 + 验证结果；执行表单字段一并写回工单） */}
      <Modal title={`提交验收（${order.code}）`} width={620} open={submitOpen} destroyOnHidden
        onCancel={() => setSubmitOpen(false)} onOk={doSubmit} okText="提交验收" cancelText="取消">
        <Alert type="info" showIcon style={{ marginBottom: 12 }}
          message="提交后工单进入「待验收」" />
        <div style={{ fontSize: 13, background: '#f6f9fb', border: '1px solid #e8eef2', borderRadius: 8, padding: '6px 10px', marginBottom: 12 }}>
          处理方式：{execForm.getFieldValue('handlingMethod') || '--'}
          {order.parts?.length > 0 && `；本次更换备件：${order.parts.map(p => `${p.spareName || p.spareCode || '--'} ×${p.qty ?? '--'}`).join('；')}`}
        </div>
        <Form form={submitForm} layout="vertical">
          <Form.Item label="处理措施" name="measures" required rules={[{ required: true, message: '必须填写处理措施' }]}>
            <Input.TextArea rows={3} placeholder="本次维修采取的处理措施（不超过500字符）" maxLength={500} showCount />
          </Form.Item>
          <Form.Item label="验证结果" name="verification" required rules={[{ required: true, message: '必须填写验证结果' }]}>
            <Input.TextArea rows={3} placeholder="修复后的验证方式与结果（如试机时长、参数恢复情况）" maxLength={500} showCount />
          </Form.Item>
          <Form.Item label="工时（小时）" name="laborHours" initialValue={order.laborHours ?? undefined}>
            <InputNumber style={{ width: 160 }} min={0} step={0.5} placeholder="默认沿用已登记工时" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 选择备件弹窗（原型「查看.html」：搜索 / 选择 / 确认） */}
      <Modal title="选择备件" width={720} open={sparePickOpen} destroyOnHidden
        onCancel={() => { setSparePickOpen(false); setSparePickRows([]); }}
        onOk={() => setSparePickOpen(false)}
        okText="确认" cancelText="取消">
        <Input.Search style={{ width: 260, marginBottom: 12 }} placeholder="搜索备件名称 / 编号 / 规格型号"
          allowClear value={spareKw} onChange={e => setSpareKw(e.target.value)} />
        <Table
          rowKey="code" size="small" pagination={false}
          dataSource={sparePickList}
          columns={[
            { title: '备件名称', dataIndex: 'name', width: 150, render: v => v || '--' },
            { title: '规格型号', dataIndex: 'spec', width: 130, render: v => v || '--' },
            { title: '备件库存', width: 100, render: (_, r) => (totals[r.code]?.onHand ?? '--') },
            {
              title: '操作', width: 90,
              render: (_, r) => (sparePickRows.includes(r.code)
                ? <Tag color="green">已选择</Tag>
                : <Button type="link" size="small" onClick={() => { setSparePickRows([...sparePickRows, r.code]); addPendingPart(r.code); }}>选择</Button>),
            },
          ]}
        />
      </Modal>

      {/* 选用维修经验弹窗（原型「选择维修经验.html」） */}
      <Modal title="选择维修经验" width={860} open={knowledgeOpen} destroyOnHidden
        onCancel={() => setKnowledgeOpen(false)} onOk={() => setKnowledgeOpen(false)} okText="确认" cancelText="取消">
        <Input.Search style={{ width: 260, marginBottom: 12 }} placeholder="维修经验名称 / 故障原因"
          allowClear value={knowledgeKw} onChange={e => setKnowledgeKw(e.target.value)} />
        <Table
          rowKey="knowledgeId" size="small" pagination={{ pageSize: 5 }}
          dataSource={knowledgeList.filter(k => k.status === '启用'
            && (!knowledgeKw || (k.name || '').includes(knowledgeKw) || (k.faultReason || '').includes(knowledgeKw)))}
          locale={{ emptyText: <EmptyState description="暂无启用的维修经验" reason="可在「维修经验库」新增后在此选用" /> }}
          columns={[
            { title: '维修经验名称', dataIndex: 'name', width: 170, render: v => v || '--' },
            { title: '维修内容', dataIndex: 'repairContent', width: 200, render: v => v || '--' },
            { title: '设备类型', dataIndex: 'deviceType', width: 100, render: v => v || '--' },
            { title: '故障类型', dataIndex: 'faultType', width: 100, render: v => v || '--' },
            { title: '设备部位', dataIndex: 'devicePart', width: 100, render: v => v || '--' },
            { title: '故障原因', dataIndex: 'faultReason', width: 160, render: v => v || '--' },
            { title: '操作', width: 90, fixed: 'right', render: (_, r) => <Button type="link" size="small" onClick={() => applyKnowledge(r)}>选用</Button> },
          ]}
        />
      </Modal>

      {/* 加入经验库弹窗 */}
      <Modal title="加入经验库" width={640} open={knowledgeAddOpen} destroyOnHidden
        onCancel={() => setKnowledgeAddOpen(false)} onOk={doAddKnowledge} okText="确认" cancelText="取消">
        <Form form={knowledgeForm} layout="vertical">
          <Row gutter={16}>
            <Col span={24}>
              <Form.Item label="维修经验名称" name="name" required rules={[{ required: true, message: '请输入维修经验名称' }]}>
                <Input placeholder="请输入维修经验名称" maxLength={50} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="故障类型" name="faultType" required rules={[{ required: true, message: '请选择故障类型' }]}>
                <Select placeholder="请选择" options={['过热', '磨损', '异响', '短路', '漏水', '压力不足', '响应故障', '其他'].map(v => ({ value: v, label: v }))} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="设备类型" name="deviceType" required rules={[{ required: true, message: '请选择设备类型' }]}>
                <Select placeholder="请选择" options={['电机', '液压系统', '剪板机', '控制面板', '传动系统', '加工中心', '动力设备', '其他'].map(v => ({ value: v, label: v }))} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="设备部位" name="devicePart" required rules={[{ required: true, message: '请选择设备部位' }]}>
                <Select placeholder="请选择" options={['电机', '液压泵', '刀片', '轴承', '控制面板', '机械系统', '润滑系统', '其他'].map(v => ({ value: v, label: v }))} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="故障原因" name="faultReason">
                <Input.TextArea rows={2} placeholder="请输入故障原因" maxLength={500} />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item label="维修内容" name="repairContent">
                <Input.TextArea rows={3} placeholder="请输入维修内容" maxLength={500} />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>
    </>
  );
}
