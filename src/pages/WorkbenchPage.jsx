import React, { useMemo } from 'react';
import { Card, Table, Button, Space } from 'antd';
import { useNavigate } from 'react-router-dom';
import { CalendarCheck, Wrench, Package, AlertTriangle, Wifi, Unplug } from 'lucide-react';
import PageHeader from '../components/PageHeader.jsx';
import MetricTile from '../components/MetricTile.jsx';
import StatusTag from '../components/StatusTag.jsx';
import EmptyState from '../components/EmptyState.jsx';
import DegradedBanner from '../components/DegradedBanner.jsx';
import { useDemoState } from '../state/DemoStore.jsx';
import { selectWorkbench, selectAllDevices } from '../state/selectors.js';

// 工作台（§7.1）：行动入口读模型 selectWorkbench —— 只列待办事实与跳转，不复制完整 KPI
export default function WorkbenchPage() {
  const navigate = useNavigate();
  const state = useDemoState();
  const wb = useMemo(() => selectWorkbench(state), [state]);
  const devices = useMemo(() => selectAllDevices(state), [state]);
  const meta = state.meta;

  const repairTodoCount = wb.pendingDispatch.length + wb.pendingAccept.length;
  const lifecycleTodoCount = (wb.lifecycle?.pendingProcurement?.length || 0)
    + (wb.lifecycle?.pendingTrial?.length || 0)
    + (wb.lifecycle?.pendingRegistration?.length || 0);

  const goDevice = (deviceId) => navigate(`/device/${deviceId}`);

  const renderEmpty = (description, reason, next, onNext) => (
    <EmptyState description={description} reason={reason} next={next} onNext={onNext} />
  );

  return (
    <>
      <PageHeader
        title="工作台"
        subtitle={`数据更新于 ${meta.updatedAt || '--'} · 最后样本 ${meta.lastSampleAt || '--'}`}
        actions={<Button type="primary" onClick={() => window.open('设备监测大屏演示.html', '_blank')}>进入监测大屏</Button>}
      />
      <DegradedBanner meta={meta} />
      <div className="metric-grid" style={{ marginBottom: 12 }}>
        <MetricTile label="设备总数" value={devices.length} unit="台" color="#1668dc" />
        <MetricTile label="待处理报警" value={wb.unacked.length} unit="条" color="#dc2626" />
        <MetricTile label="维修待办（派工/验收）" value={repairTodoCount} unit="单" color="#d46b08" />
        <MetricTile label="生命周期待办" value={lifecycleTodoCount} unit="单" color="#7c3aed" />
        <MetricTile label="低库存备件" value={wb.lowStock.length} unit="项" color="#d97706" />
        <MetricTile label="接入任务异常" value={wb.ingestionIssues.length} unit="个" color="#8d6e63" />
        <MetricTile label="降级设备" value={wb.degradedDevices.length} unit="台" color="#dc2626" />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 12 }}>
        <Card size="small" title={<Space><CalendarCheck size={15} /> 设备入账流程</Space>} extra={<Button type="link" size="small" onClick={() => navigate('/lifecycle/tasks')}>查看全部</Button>}>
          {lifecycleTodoCount === 0 ? (
            renderEmpty('暂无生命周期待办', '采购入账、试用确认或设备手续入账任务会出现在此处', '新建采购入账', () => navigate('/lifecycle/tasks/procurement-entry'))
          ) : (
            <Table
              rowKey="taskId" size="small" pagination={false}
              dataSource={[...(wb.lifecycle?.pendingProcurement || []), ...(wb.lifecycle?.pendingTrial || []), ...(wb.lifecycle?.pendingRegistration || [])].slice(0, 6)}
              columns={[
                { title: '任务号', dataIndex: 'taskNo', width: 150 },
                { title: '设备', dataIndex: 'equipmentName', ellipsis: true, render: v => v || '待填写' },
                { title: '当前节点', dataIndex: 'status', width: 150, render: v => <StatusTag value={v} /> },
                {
                  title: '操作', width: 90,
                  render: (_, r) => <Button type="link" size="small" onClick={() => navigate(r.status === '使用部门试用确认中' ? '/lifecycle/tasks/trial-confirmation' : r.status === '待设备手续入账' ? '/lifecycle/tasks/device-registration' : '/lifecycle/tasks')}>去处理</Button>,
                },
              ]}
            />
          )}
        </Card>
        <Card size="small" title={<Space><AlertTriangle size={15} /> 待处理报警（已触发）</Space>} extra={<Button type="link" size="small" onClick={() => navigate('/alarm-center')}>报警中心</Button>}>
          {wb.unacked.length === 0 ? (
            renderEmpty('暂无待确认报警', '所有报警均已确认或关闭', '查看报警中心', () => navigate('/alarm-center'))
          ) : (
            <Table
              rowKey="id" size="small" pagination={false}
              dataSource={wb.unacked}
              columns={[
                { title: '设备', dataIndex: 'deviceName' },
                { title: '报警', dataIndex: 'name', ellipsis: true },
                { title: '级别', dataIndex: 'severity', width: 70, render: v => <StatusTag value={v} /> },
                { title: '触发', dataIndex: 'time', width: 80 },
                {
                  title: '操作', width: 80,
                  render: (_, r) => <Button type="link" size="small" onClick={() => navigate('/alarm-center')}>去处理</Button>,
                },
              ]}
            />
          )}
        </Card>
        <Card size="small" title={<Space><Wrench size={15} /> 维修待派工</Space>} extra={<Button type="link" size="small" onClick={() => navigate('/repair-orders')}>维修任务</Button>}>
          {wb.pendingDispatch.length === 0 ? (
            renderEmpty('暂无待派工维修单', '所有报修/报警转维修单均已派工', '查看维修任务', () => navigate('/repair-orders'))
          ) : (
            <Table
              rowKey="repairOrderId" size="small" pagination={false}
              dataSource={wb.pendingDispatch}
              columns={[
                { title: '单号', dataIndex: 'repairOrderId', width: 150 },
                { title: '设备', dataIndex: 'deviceName', ellipsis: true },
                { title: '状态', dataIndex: 'status', width: 80, render: v => <StatusTag value={v} /> },
                {
                  title: '操作', width: 80,
                  render: (_, r) => <Button type="link" size="small" onClick={() => navigate(`/repair-orders/${r.repairOrderId}`)}>去处理</Button>,
                },
              ]}
            />
          )}
        </Card>
        <Card size="small" title={<Space><CalendarCheck size={15} /> 维修待验收</Space>} extra={<Button type="link" size="small" onClick={() => navigate('/repair-orders')}>维修任务</Button>}>
          {wb.pendingAccept.length === 0 ? (
            renderEmpty('暂无待验收维修单', '已提交验收的工单会出现在此处', '查看维修任务', () => navigate('/repair-orders'))
          ) : (
            <Table
              rowKey="repairOrderId" size="small" pagination={false}
              dataSource={wb.pendingAccept}
              columns={[
                { title: '单号', dataIndex: 'repairOrderId', width: 150 },
                { title: '设备', dataIndex: 'deviceName', ellipsis: true },
                { title: '维修人', dataIndex: 'assignee', width: 80, render: v => v || '--' },
                { title: '状态', dataIndex: 'status', width: 80, render: v => <StatusTag value={v} /> },
                {
                  title: '操作', width: 80,
                  render: (_, r) => <Button type="link" size="small" onClick={() => navigate(`/repair-orders/${r.repairOrderId}/accept`)}>去验收</Button>,
                },
              ]}
            />
          )}
        </Card>
        <Card size="small" title={<Space><Package size={15} /> 低库存备件</Space>} extra={<Button type="link" size="small" onClick={() => navigate('/spare-parts-stock')}>备品备件</Button>}>
          {wb.lowStock.length === 0 ? (
            renderEmpty('所有备件库存均高于安全库存', '库存低于安全库存的备件会出现在此处', '查看备件库存', () => navigate('/spare-parts-stock'))
          ) : (
            <Table
              rowKey="stockKey" size="small" pagination={false}
              dataSource={wb.lowStock}
              columns={[
                { title: '备件', render: (_, r) => r.spare?.name || r.spareCode },
                { title: '仓库', dataIndex: 'warehouseId', ellipsis: true },
                { title: '现存量', dataIndex: 'onHand', width: 70 },
                { title: '安全库存', render: (_, r) => r.spare?.safe ?? '--', width: 80 },
                {
                  title: '操作', width: 80,
                  render: () => <Button type="link" size="small" onClick={() => navigate('/spare-parts-stock')}>去处理</Button>,
                },
              ]}
            />
          )}
        </Card>
        <Card size="small" title={<Space><Unplug size={15} /> 接入任务异常</Space>} extra={<Button type="link" size="small" onClick={() => navigate('/binding-overview')}>物联网接入配置</Button>}>
          {wb.ingestionIssues.length === 0 ? (
            renderEmpty('接入任务均正常', '失败/重试中/部分成功的接入任务会出现在此处', '查看物联网接入配置', () => navigate('/binding-overview'))
          ) : (
            <Table
              rowKey="taskId" size="small" pagination={false}
              dataSource={wb.ingestionIssues}
              columns={[
                { title: '任务', dataIndex: 'taskId', width: 140 },
                { title: '设备', dataIndex: 'deviceName', ellipsis: true },
                { title: '状态', dataIndex: 'status', width: 90, render: v => <StatusTag value={v} /> },
                {
                  title: '操作', width: 80,
                  render: (_, r) => <Button type="link" size="small" onClick={() => goDevice(r.deviceId)}>去处理</Button>,
                },
              ]}
            />
          )}
        </Card>
        <Card size="small" title={<Space><Wifi size={15} /> 降级设备（延迟 / 中断）</Space>}>
          {wb.degradedDevices.length === 0 ? (
            renderEmpty('所有设备通信健康正常', '通信状态为延迟 / 部分中断 / 数据中断的设备会出现在此处')
          ) : (
            <Table
              rowKey="deviceId" size="small" pagination={false}
              dataSource={wb.degradedDevices}
              columns={[
                { title: '设备ID', dataIndex: 'deviceId', width: 100 },
                { title: '通信状态', dataIndex: 'status', width: 100, render: v => <StatusTag value={v} /> },
                { title: '最后样本', dataIndex: 'lastSampleAt', width: 100, render: v => v || '--' },
                {
                  title: '操作', width: 80,
                  render: (_, r) => <Button type="link" size="small" onClick={() => goDevice(r.deviceId)}>去查看</Button>,
                },
              ]}
            />
          )}
        </Card>
      </div>
    </>
  );
}
