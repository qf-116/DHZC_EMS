import React, { useState } from 'react';
import { Card, Descriptions, Tag, Button, Space, App, Table, Timeline, Radio, Input, Select, Form, Modal } from 'antd';
import { ArrowLeft } from 'lucide-react';
import { useNavigate, useParams, useSearchParams, useLocation } from 'react-router-dom';
import PageHeader from '../components/PageHeader.jsx';
import DegradedBanner from '../components/DegradedBanner.jsx';
import StatusTag from '../components/StatusTag.jsx';
import EmptyState from '../components/EmptyState.jsx';
import { useDemoState, useDemoActions } from '../state/DemoStore.jsx';
import { selectRepairById, selectOutboundForRepair } from '../state/selectors.js';
import { users } from '../data/demo/masterData.js';

const levelColor = { 紧急: 'red', 严重: 'orange', 一般: 'blue' };
// 维修人员下拉统一取自三方主数据（在职的维修工程师/设备负责人/点检员/巡检员/备件管理员）
const repairStaff = users.filter(u => u.status === '在职' && (u.role === '维修工程师' || u.role === '设备负责人' || u.role === '点检员' || u.role === '巡检员' || u.role === '备件管理员')).map(u => u.name);
const repairPersons = repairStaff.map(v => ({ value: v, label: v }));

// 维修详情 / 验收页（store 驱动）：/repair-orders/:repairOrderId 与 /repair-orders/:repairOrderId/accept
// 均渲染本页（兼容旧 query ?code=）。
// - 已派工：本页可「开始维修」（自动创建维修停机事实并联动 OEE）；维修中提供执行页入口。
// - 待验收：验收区 → 通过（必填验收意见，自动结束关联停机 + 关联报警恢复）/ 返修（必填返修原因，回「维修中」reworkCount+1）。
// - 已完成：验收记录只读展示（未验收字段显示 '--'，不用 0 占位）。
export default function RepairDetailPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { repairOrderId } = useParams();
  const [params] = useSearchParams();
  // 兼容旧路由 /repair-orders/detail?code=RO-xxx
  const orderId = repairOrderId || params.get('code') || params.get('repairOrderId');

  const { message } = App.useApp();
  const state = useDemoState();
  const actions = useDemoActions();
  const meta = state.meta;

  const order = orderId ? selectRepairById(state, orderId) : null;
  const outbounds = order ? selectOutboundForRepair(state, order.repairOrderId) : [];

  const [acceptResult, setAcceptResult] = useState('通过');
  const [opinion, setOpinion] = useState('');
  const [startFormOpen, setStartFormOpen] = useState(false);
  const [startForm] = Form.useForm();

  if (!orderId || !order) {
    return (
      <>
        <PageHeader title="故障维修 · 详情" subtitle={orderId ? `维修工单：${orderId}` : '未指定维修工单'}
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

  const acceptance = order.acceptance || null;
  const isAcceptRoute = location.pathname.endsWith('/accept'); // 仅用于提示文案，不影响数据

  const doStartHere = async () => {
    const values = await startForm.validateFields();
    const res = actions.assignRepair(order.repairOrderId, { assignee: values.assignee, assigneeGroup: values.assigneeGroup || order.assigneeGroup });
    if (!res.ok) { message.error(res.message); return; }
    setStartFormOpen(false);
    const started = actions.startRepair(order.repairOrderId);
    message[started.ok ? 'success' : 'error'](
      started.ok ? `${res.message}；${started.message}` : started.message,
    );
  };

  const doStart = () => {
    const res = actions.startRepair(order.repairOrderId);
    message[res.ok ? 'success' : 'error'](res.message);
  };

  // 验收：通过必填验收意见；返修必填返修原因（复用同一意见字段，按结果校验）
  const submitAcceptance = () => {
    const text = (opinion || '').trim();
    if (!text) {
      message.warning(acceptResult === '通过' ? '验收通过必须填写验收意见' : '返修必须填写返修原因');
      return;
    }
    const res = actions.acceptRepair(order.repairOrderId, { result: acceptResult, opinion: text });
    message[res.ok ? 'success' : 'error'](res.message);
    if (res.ok) {
      setOpinion('');
      if (acceptResult === '通过') message.success('设备已恢复，关联停机已结束，关联报警进入恢复流程');
    }
  };

  const slaHours = order.slaHours;

  return (
    <>
      <PageHeader
        title="故障维修 · 详情"
        subtitle={`维修工单：${order.code} · 当前状态：${order.status}${isAcceptRoute && order.status === '待验收' ? ' · 验收模式' : ''}`}
        actions={<Button icon={<ArrowLeft size={14} />} onClick={() => navigate('/repair-orders')}>返回列表</Button>}
      />
      <DegradedBanner meta={meta} />

      {/* 操作区（按状态机） */}
      {(order.status === '已派工' || order.status === '维修中' || order.status === '待验收') && (
        <Card size="small" style={{ marginBottom: 12 }}>
          <Space wrap align="center">
            <span style={{ fontWeight: 600 }}>可执行操作：</span>
            <StatusTag value={order.status} />
            {order.status === '已派工' && (
              <>
                <Button type="primary" onClick={doStart}>开始维修</Button>
                <Button onClick={() => { startForm.setFieldsValue({ assignee: order.assignee, assigneeGroup: order.assigneeGroup || '机修班' }); setStartFormOpen(true); }}>改派后开工</Button>
                <span style={{ fontSize: 12, color: '#8a97a3' }}>开始维修将自动创建「维修中」停机事实并联动 OEE 可用率</span>
              </>
            )}
            {order.status === '维修中' && (
              <>
                <Button type="primary" onClick={() => navigate(`/repair-orders/${order.repairOrderId}/execute`)}>前往执行页录入维修结果</Button>
                <span style={{ fontSize: 12, color: '#8a97a3' }}>挂起 / 恢复 / 提交验收在执行页操作</span>
              </>
            )}
            {order.status === '待验收' && (
              <span style={{ fontSize: 12, color: '#8a97a3' }}>请在下方验收区完成验收：通过 → 设备恢复；返修 → 回「维修中」</span>
            )}
          </Space>
        </Card>
      )}

      {/* 故障信息 */}
      <Card size="small" style={{ marginBottom: 12 }}>
        <div style={{ fontWeight: 600, marginBottom: 12 }}>故障信息</div>
        <Descriptions column={2} size="small" bordered>
          <Descriptions.Item label="故障名称">{order.title || '--'}</Descriptions.Item>
          <Descriptions.Item label="维修设备">{order.deviceName || '--'}（{order.deviceCode || '--'}）</Descriptions.Item>
          <Descriptions.Item label="故障等级"><Tag color={levelColor[order.level] || 'default'}>{order.level || '--'}</Tag></Descriptions.Item>
          <Descriptions.Item label="故障类型">{order.faultType || '--'}</Descriptions.Item>
          <Descriptions.Item label="工单状态"><StatusTag value={order.status} /></Descriptions.Item>
          <Descriptions.Item label="返修次数">{order.reworkCount ?? 0}</Descriptions.Item>
          <Descriptions.Item label="来源报警">{order.alarmId
            ? <a onClick={() => navigate('/alarm-center')}>{order.alarmId}</a>
            : '--'}</Descriptions.Item>
          <Descriptions.Item label="来源报修单">{order.reportId || '--'}</Descriptions.Item>
          <Descriptions.Item label="报修人">{order.reporter || '--'}</Descriptions.Item>
          <Descriptions.Item label="创建时间">{order.createdAt || '--'}</Descriptions.Item>
          <Descriptions.Item label="SLA">{slaHours ? `${slaHours} 小时（${order.slaDueAt || '--'} 前）` : '--'}</Descriptions.Item>
          <Descriptions.Item label="关联停机事实">{order.downtimeFactId || '--'}</Descriptions.Item>
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
          <Descriptions.Item label="验收完成时间">{order.acceptedAt || '--'}</Descriptions.Item>
          <Descriptions.Item label="工时（小时）">{order.laborHours ?? '--'}</Descriptions.Item>
          <Descriptions.Item label="处理措施" span={2}>{order.measures || '--'}</Descriptions.Item>
          <Descriptions.Item label="验证结果" span={2}>{order.verification || '--'}</Descriptions.Item>
        </Descriptions>
        <div style={{ fontWeight: 600, margin: '12px 0 8px' }}>领用备件</div>
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
          <div style={{ fontSize: 13, color: '#8a97a3' }}>--（本工单暂无领用备件{outbounds.length ? '' : '，也无维修出库记录'}）</div>
        )}
      </Card>

      {/* 验收区 */}
      <Card size="small" style={{ marginBottom: 12 }}>
        <div style={{ fontWeight: 600, marginBottom: 12 }}>验收</div>
        {order.status === '待验收' && (
          <>
            <Form layout="vertical" style={{ maxWidth: 640 }}>
              <Form.Item label="验收结论" required>
                <Radio.Group value={acceptResult} onChange={e => setAcceptResult(e.target.value)}>
                  <Radio value="通过">通过</Radio>
                  <Radio value="返修">返修</Radio>
                </Radio.Group>
              </Form.Item>
              <Form.Item label={acceptResult === '通过' ? '验收意见（必填）' : '返修原因（必填）'} required>
                <Input.TextArea rows={3} value={opinion} onChange={e => setOpinion(e.target.value)}
                  placeholder={acceptResult === '通过' ? '如：试机稳定，参数恢复基线，同意验收' : '如：异响未消除，需进一步检查主轴轴承'} maxLength={200} showCount />
              </Form.Item>
              <Space>
                <Button type="primary" onClick={submitAcceptance}>
                  {acceptResult === '通过' ? '验收通过' : '退回返修'}
                </Button>
                <Button onClick={() => navigate(`/repair-orders/${order.repairOrderId}/execute`)}>查看执行记录</Button>
              </Space>
            </Form>
          </>
        )}
        {order.status === '已完成' && (
          acceptance ? (
            <Descriptions column={2} size="small" bordered>
              <Descriptions.Item label="验收结论"><Tag color="success">{acceptance.result || '--'}</Tag></Descriptions.Item>
              <Descriptions.Item label="验收人">{acceptance.acceptor || '--'}</Descriptions.Item>
              <Descriptions.Item label="验收时间">{acceptance.acceptanceTime || '--'}</Descriptions.Item>
              <Descriptions.Item label="设备恢复">{acceptance.deviceRestored ? '是' : '否'}</Descriptions.Item>
              <Descriptions.Item label="验收意见" span={2}>{acceptance.opinion || '--'}</Descriptions.Item>
              <Descriptions.Item label="关联报警处理" span={2}>{acceptance.alarmClosedBy || '--'}</Descriptions.Item>
            </Descriptions>
          ) : (
            <div style={{ fontSize: 13, color: '#8a97a3' }}>--（未找到验收记录）</div>
          )
        )}
        {order.status !== '待验收' && order.status !== '已完成' && (
          <div style={{ fontSize: 13, color: '#8a97a3' }}>--（未验收：工单当前状态「{order.status}」，进入「待验收」后在此完成验收）</div>
        )}
      </Card>

      {/* 处理时间线 */}
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

      {/* 改派后开工弹窗：已派工状态下先改派维修人再开工 */}
      <Modal title={`改派并开工（${order.code}）`} width={480} open={startFormOpen} destroyOnClose
        onCancel={() => setStartFormOpen(false)} onOk={doStartHere} okText="改派并开工" cancelText="取消">
        <Form form={startForm} layout="vertical">
          <Form.Item label="维修人员" name="assignee" required rules={[{ required: true, message: '派工必须指定维修人' }]}>
            <Select placeholder="请选择维修人员" options={repairPersons} />
          </Form.Item>
          <Form.Item label="维修班组" name="assigneeGroup">
            <Select placeholder="请选择" allowClear options={['机修班', '电气班', '工艺班'].map(v => ({ value: v, label: v }))} />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
