import React, { useRef, useState } from 'react';
import { Card, Tag, Button, Space, Input, Modal, Form, Select, App } from 'antd';
import { Wrench } from 'lucide-react';
import PageHeader from '../components/PageHeader.jsx';
import DegradedBanner from '../components/DegradedBanner.jsx';
import StatusTag from '../components/StatusTag.jsx';
import EmptyState from '../components/EmptyState.jsx';
import { useDemoState, useDemoActions } from '../state/DemoStore.jsx';
import { selectAllRepairReports, selectAllRepairOrders } from '../state/selectors.js';
import { SLA_HOURS } from '../domain/repair.js';
import { users } from '../data/demo/masterData.js';

const levelColor = { 紧急: 'red', 严重: 'orange', 一般: 'blue' };
// 维修人员下拉统一取自三方主数据（在职的维修工程师/设备负责人/点检员/巡检员/备件管理员）
const repairStaff = users.filter(u => u.status === '在职' && (u.role === '维修工程师' || u.role === '设备负责人' || u.role === '点检员' || u.role === '巡检员' || u.role === '备件管理员')).map(u => u.name);
const repairPersons = repairStaff.map(v => ({ value: v, label: v }));
const groups = ['机修班', '电气班', '工艺班'].map(v => ({ value: v, label: v }));

// 待维修看板（store 驱动）：显示所有「待派工」的维修主工单与尚未生成工单的待派工报修单，
// 按紧急>严重>一般、故障发生时间降序；派工弹窗确认后调 actions 派工/生成维修单，
// 列表由 DemoStore 状态驱动自动刷新，不做本地副本。
export default function RepairPendingPage() {
  const { message } = App.useApp();
  const state = useDemoState();
  const actions = useDemoActions();
  const meta = state.meta;
  // 动作层基于状态快照做入参预校验：连续两个动作需取最新 actions（ref 始终指向当前渲染的 actions）
  const actionsRef = useRef(actions);
  actionsRef.current = actions;

  const [level, setLevel] = useState(null);
  const [kw, setKw] = useState('');
  const [dispatchItem, setDispatchItem] = useState(null); // 当前派工对象（工单或报修单）
  const [form] = Form.useForm();

  const reports = selectAllRepairReports(state);
  const orders = selectAllRepairOrders(state);

  // 待派工条目 = 待派工主工单（报警转维修/报修已生成）∪ 无关联工单的待派工报修单
  const activeOrderByReport = (reportId) => orders.find(o => o.reportId === reportId && !['已完成', '已取消'].includes(o.status));
  const items = [
    ...orders.filter(o => o.status === '待派工').map(o => ({
      key: o.repairOrderId, kind: 'order', orderRef: o.repairOrderId,
      code: o.code, title: o.title, deviceId: o.deviceId,
      device: o.deviceName, deviceCode: o.deviceCode,
      level: o.level, faultType: o.faultType, faultTime: o.createdAt,
      desc: o.faultDesc, status: o.status,
    })),
    ...reports.filter(r => r.status === '待派工' && !activeOrderByReport(r.reportId)).map(r => ({
      key: r.reportId, kind: 'report', orderRef: null,
      code: r.code, title: r.title, deviceId: r.deviceId,
      device: r.deviceName, deviceCode: r.deviceCode,
      level: r.level, faultType: r.faultType, faultTime: r.faultTime,
      desc: r.desc, status: r.status,
    })),
  ];
  const levelRank = { 紧急: 0, 严重: 1, 一般: 2 };
  items.sort((a, b) => (levelRank[a.level] ?? 3) - (levelRank[b.level] ?? 3) || (a.faultTime < b.faultTime ? 1 : -1));

  const counts = {
    紧急: items.filter(r => r.level === '紧急').length,
    严重: items.filter(r => r.level === '严重').length,
    一般: items.filter(r => r.level === '一般').length,
  };
  const list = items
    .filter(r => (!level || r.level === level))
    .filter(r => !kw || (r.device || '').includes(kw) || (r.title || '').includes(kw) || (r.code || '').includes(kw));

  const slaHours = dispatchItem ? (SLA_HOURS[dispatchItem.level] ?? '--') : '--';

  const openDispatch = (r) => { setDispatchItem(r); form.resetFields(); };

  // 确认派工：
  // - 已有主工单（kind=order）→ 直接 assignRepair
  // - 报修单尚未生成工单（kind=report）→ createRepairReport 生成主工单后派工（动作层按最新状态校验）
  const confirmDispatch = async () => {
    const values = await form.validateFields();
    const assignee = values.assignee;
    const assigneeGroup = values.assigneeGroup || null;
    const item = dispatchItem;
    if (item.kind === 'order') {
      const res = actionsRef.current.assignRepair(item.orderRef, { assignee, assigneeGroup });
      message[res.ok ? 'success' : 'error'](res.message);
      if (res.ok) setDispatchItem(null);
      return;
    }
    const created = actionsRef.current.createRepairReport({
      deviceId: item.deviceId, title: item.title, faultDesc: item.desc, level: item.level, faultType: item.faultType,
    });
    if (!created.ok) { message.error(created.message); return; }
    const orderId = created.refs.repairOrderId;
    // 等本批次状态更新提交后（actions 基于最新快照预校验）再派工
    setTimeout(() => {
      const res = actionsRef.current.assignRepair(orderId, { assignee, assigneeGroup });
      message[res.ok ? 'success' : 'error'](res.ok ? `${created.message}；${res.message}` : res.message);
    }, 0);
    setDispatchItem(null);
  };

  return (
    <>
      <PageHeader
        title="待维修"
      />
      <DegradedBanner meta={meta} />
      <Card size="small" style={{ marginBottom: 12 }}>
        <Space size={24} align="center">
          <Space>
            <Button type={level === '紧急' ? 'primary' : 'default'} danger={level === '紧急'} onClick={() => setLevel(level === '紧急' ? null : '紧急')}>紧急（{counts.紧急}）</Button>
            <Button type={level === '严重' ? 'primary' : 'default'} onClick={() => setLevel(level === '严重' ? null : '严重')} style={level === '严重' ? { background: '#fa8c16', borderColor: '#fa8c16' } : {}}>严重（{counts.严重}）</Button>
            <Button type={level === '一般' ? 'primary' : 'default'} onClick={() => setLevel(level === '一般' ? null : '一般')}>一般（{counts.一般}）</Button>
          </Space>
          <Input.Search style={{ width: 280 }} placeholder="设备名称 / 报修名称 / 单号" onSearch={setKw} allowClear />
        </Space>
      </Card>
      {list.length === 0 ? (
        <Card size="small">
          <EmptyState
            description="暂无待派工任务"
            reason={kw || level ? '筛选/搜索条件下没有待派工的报修单或维修工单' : '当前没有待派工的报修单与维修工单'}
            next={kw || level}
            onNext={() => { setKw(''); setLevel(null); }}
            nextLabel="清空筛选"
          />
        </Card>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(420px, 1fr))', gap: 12 }}>
          {list.map(r => (
            <Card size="small" key={r.key}
              title={<Space><span>{r.kind === 'order' ? '维修工单' : '报修单号'}：{r.code}</span><Tag color={levelColor[r.level]}>{r.level}</Tag><StatusTag value={r.status} /></Space>}
              extra={<Button type="primary" size="small" icon={<Wrench size={13} />} onClick={() => openDispatch(r)}>去处理</Button>}>
              <div style={{ lineHeight: 1.9, fontSize: 13 }}>
                <div>报修名称：{r.title || '--'}</div>
                <div>设备名称：{r.device || '--'}</div>
                <div>设备编号：{r.deviceCode || '--'}</div>
                <div>故障类型：{r.faultType || '--'}</div>
                <div>故障发生时间：{r.faultTime || '--'}</div>
                <div>故障描述：{r.desc || '--'}</div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* 去处理（派工弹窗）：选择维修人后生成/推进维修工单；SLA 按故障等级自动带出 */}
      <Modal
        title={dispatchItem ? `派工处理（${dispatchItem.code}）` : '派工处理'}
        width={640}
        open={!!dispatchItem}
        destroyOnClose
        confirmLoading={false}
        onCancel={() => setDispatchItem(null)}
        onOk={confirmDispatch}
        okText="确认派工" cancelText="取消"
      >
        {dispatchItem && (
          <>
            <div style={{ fontWeight: 600, margin: '4px 0 8px' }}>故障信息</div>
            <div style={{ lineHeight: 1.9, fontSize: 13, background: '#f6f9fb', border: '1px solid #e8eef2', borderRadius: 8, padding: '8px 12px', marginBottom: 14 }}>
              <div>{dispatchItem.kind === 'order' ? '工单名称' : '报修名称'}：{dispatchItem.title || '--'}　<Tag color={levelColor[dispatchItem.level]}>{dispatchItem.level}</Tag></div>
              <div>设备名称：{dispatchItem.device || '--'}　设备编号：{dispatchItem.deviceCode || '--'}</div>
              <div>故障类型：{dispatchItem.faultType || '--'}　故障发生时间：{dispatchItem.faultTime || '--'}</div>
              <div>故障描述：{dispatchItem.desc || '--'}</div>
            </div>
            {dispatchItem.kind === 'report' && (
              <div style={{ fontSize: 12, color: '#8a6d3b', background: '#fffbe6', border: '1px solid #ffe58f', borderRadius: 6, padding: '6px 10px', marginBottom: 12 }}>
                该报修单尚未生成维修工单，确认派工后将自动创建主工单并完成派工。
              </div>
            )}
            <Form form={form} layout="vertical" initialValues={{ assigneeGroup: '机修班' }}>
              <Form.Item label="维修人员" name="assignee" required rules={[{ required: true, message: '派工必须指定维修人' }]} style={{ marginBottom: 12 }}>
                <Select placeholder="请选择维修人员" options={repairPersons} />
              </Form.Item>
              <Space wrap size={16} style={{ display: 'flex' }}>
                <Form.Item label="维修班组" name="assigneeGroup" style={{ marginBottom: 12, minWidth: 160 }}>
                  <Select placeholder="请选择" options={groups} allowClear />
                </Form.Item>
                <Form.Item label="SLA 响应时限" required style={{ marginBottom: 12, minWidth: 180 }}>
                  <Select value={slaHours === '--' ? undefined : slaHours} disabled
                    options={[{ value: slaHours, label: `${slaHours} 小时（按「${dispatchItem.level}」等级自动带出）` }]} />
                </Form.Item>
              </Space>
              <Form.Item label="备注" name="note" style={{ marginBottom: 0 }}>
                <Input.TextArea rows={2} placeholder="故障处理建议、备件领用、安全注意事项等" maxLength={200} />
              </Form.Item>
            </Form>
          </>
        )}
      </Modal>

    </>
  );
}
