import React, { useState } from 'react';
import { Card, Descriptions, Tag, Button, Space, Modal, Form, Select, Input, InputNumber, App, Alert, Table, Timeline } from 'antd';
import { ArrowLeft } from 'lucide-react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import PageHeader from '../components/PageHeader.jsx';
import DegradedBanner from '../components/DegradedBanner.jsx';
import StatusTag from '../components/StatusTag.jsx';
import EmptyState from '../components/EmptyState.jsx';
import { useDemoState, useDemoActions } from '../state/DemoStore.jsx';
import { selectRepairById, selectOutboundForRepair } from '../state/selectors.js';
import { SLA_HOURS } from '../domain/repair.js';
import { users } from '../data/demo/masterData.js';

const levelColor = { 紧急: 'red', 严重: 'orange', 一般: 'blue' };
// 维修人员下拉统一取自三方主数据（在职的维修工程师/设备负责人/点检员/巡检员/备件管理员）
const repairStaff = users.filter(u => u.status === '在职' && (u.role === '维修工程师' || u.role === '设备负责人' || u.role === '点检员' || u.role === '巡检员' || u.role === '备件管理员')).map(u => u.name);
const repairPersons = repairStaff.map(v => ({ value: v, label: v }));

// 执行维修页（store 驱动）：/repair-orders/:repairOrderId/execute（兼容旧 query ?code=）。
// 按 REPAIR_TRANSITIONS 渲染可执行操作：
// 待派工 → 派工；已派工 → 开始维修（自动创建「维修中」停机事实并联动 OEE）；
// 维修中 → 挂起（必填原因）/ 恢复 / 提交验收（必填处理措施+验证结果）；待验收 → 跳验收页。
// 展示工单 timeline 与领用备件（parts + 维修出库记录）。
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
  const doSubmit = async () => {
    const values = await submitForm.validateFields();
    if (run(() => actions.submitRepair(order.repairOrderId, {
      measures: values.measures, verification: values.verification, laborHours: values.laborHours ?? order.laborHours,
    }))) {
      setSubmitOpen(false);
    }
  };

  const slaHours = order.slaHours || SLA_HOURS[order.level] || null;

  return (
    <>
      <PageHeader
        title="执行故障维修"
        subtitle={`维修工单：${order.code} · 来源：${order.source === 'alarm' ? '报警转维修' : order.source === 'report' ? '人工报修' : '报警+报修'} · 当前状态：${order.status}`}
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

      {/* 维修信息 */}
      <Card size="small" style={{ marginBottom: 12 }}>
        <div style={{ fontWeight: 600, marginBottom: 12 }}>维修信息</div>
        <Descriptions column={2} size="small" bordered>
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
          <div style={{ fontSize: 13, color: '#8a97a3' }}>--（本工单暂无领用备件；领料出库在执行过程中通过备件出库完成）</div>
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
      <Modal title={`派工（${order.code}）`} width={520} open={assignOpen} destroyOnClose
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
      <Modal title={`挂起工单（${order.code}）`} width={480} open={pauseOpen} destroyOnClose
        onCancel={() => setPauseOpen(false)} onOk={doPause} okText="确认挂起" cancelText="取消">
        <Form form={pauseForm} layout="vertical">
          <Form.Item label="挂起原因" name="reason" required rules={[{ required: true, message: '请填写挂起原因' }]}>
            <Input.TextArea rows={3} placeholder="如：等待备件到货、需外协支持等" maxLength={200} showCount />
          </Form.Item>
        </Form>
      </Modal>

      {/* 提交验收弹窗（必填处理措施 + 验证结果；更换备件若有则一并列示） */}
      <Modal title={`提交验收（${order.code}）`} width={620} open={submitOpen} destroyOnClose
        onCancel={() => setSubmitOpen(false)} onOk={doSubmit} okText="提交验收" cancelText="取消">
        <Alert type="info" showIcon style={{ marginBottom: 12 }}
          message="提交后工单进入「待验收」" />
        {order.parts?.length > 0 && (
          <div style={{ fontSize: 13, background: '#f6f9fb', border: '1px solid #e8eef2', borderRadius: 8, padding: '6px 10px', marginBottom: 12 }}>
            本次更换备件：{order.parts.map(p => `${p.spareName || p.spareCode || '--'} ×${p.qty ?? '--'}`).join('；')}
          </div>
        )}
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
    </>
  );
}
