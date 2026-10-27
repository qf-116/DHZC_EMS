import React from 'react';
import { Card, Descriptions, Table, Button, Space, Alert, App } from 'antd';
import { ArrowLeft } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import PageHeader from '../components/PageHeader.jsx';
import DegradedBanner from '../components/DegradedBanner.jsx';
import StatusTag from '../components/StatusTag.jsx';
import EmptyState from '../components/EmptyState.jsx';
import { useDemoState } from '../state/DemoStore.jsx';
import { inspectionTasks, inspectionTaskDetails } from '../data/standardData.js';
import { crosswalkByAssetCode } from '../data/demo/deviceCrosswalk.js';

// 设备展示统一经 canonical 设备映射（crosswalk）：名称 + MT 资产编号；种子里的旧编码仅作关联键。
const canonOf = (assetCode) => crosswalkByAssetCode[assetCode] || null;

// 点检任务详情（范围外演示模块）：/inspection-tasks/detail（query 兼容 id/code）。
// 展示任务信息 + 检查项结果表（已检/未检/跳过，经 crosswalk 显示 canonical 设备）+ 异常项关联处理入口。
// 任务明细为共享演示快照（inspectionTaskDetails），适用于快照内任意任务的详情展示。
export default function InspectionTaskDetailPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { message } = App.useApp();
  const state = useDemoState();
  const meta = state.meta;

  const codeOrId = params.get('code') || params.get('id');
  const task = codeOrId
    ? inspectionTasks.find(t => t.code === codeOrId || t.code === decodeURIComponent(codeOrId))
    : null;

  if (!codeOrId || !task) {
    return (
      <>
        <PageHeader title="点检任务详情" subtitle={codeOrId ? `任务：${codeOrId}` : '未指定任务'}
          actions={<Space><Button icon={<ArrowLeft size={14} />} onClick={() => navigate('/inspection-tasks')}>返回列表</Button></Space>} />
        <DegradedBanner meta={meta} />
        <Card size="small">
          <EmptyState
            description={`未找到点检任务${codeOrId ? `「${codeOrId}」` : ''}`}
            reason="单号无效或系统中不存在该任务"
            next
            onNext={() => navigate('/inspection-tasks')}
            nextLabel="返回点检任务列表"
          />
        </Card>
      </>
    );
  }

  const details = inspectionTaskDetails;
  const overdue = task.date && meta.demoDay && task.date < meta.demoDay && ['未开始', '进行中'].includes(task.status);
  const abnormalRows = details.filter(d => d.skipReason || d.unchecked > 0);

  const handleReport = (row) => {
    const c = canonOf(row.code);
    message.success(`异常项报修已提交：${c ? c.name : row.code} ${c ? c.assetCode : ''}`);
  };

  return (
    <>
      <PageHeader
        title="点检任务详情"
        subtitle={`任务：${task.code} · ${task.plan} · 点检日期：${task.date} · 数据更新于 ${meta.demoDay}`}
        actions={<Space>
          {['未开始', '进行中'].includes(task.status) && !overdue && (
            <Button type="primary" onClick={() => navigate(`/inspection-tasks/execute?code=${encodeURIComponent(task.code)}`)}>执行点检</Button>
          )}
          <Button icon={<ArrowLeft size={14} />} onClick={() => navigate('/inspection-tasks')}>返回列表</Button>
        </Space>}
      />
      <DegradedBanner meta={meta} />

      <Card size="small" style={{ marginBottom: 12 }}>
        <div style={{ fontWeight: 600, marginBottom: 12 }}>任务信息</div>
        <Descriptions column={2} size="small" bordered>
          <Descriptions.Item label="任务编号">{task.code}</Descriptions.Item>
          <Descriptions.Item label="所属计划">{task.plan || '--'}</Descriptions.Item>
          <Descriptions.Item label="点检日期">{task.date || '--'}</Descriptions.Item>
          <Descriptions.Item label="状态">
            <StatusTag value={overdue ? '已逾期' : ({ 未开始: '待执行', 进行中: '进行中', 已完成: '已完成', 已关闭: '已关闭' }[task.status] || task.status)}
              tip={`当前状态：${task.status}`} />
          </Descriptions.Item>
          <Descriptions.Item label="应检设备数">{task.shouldCount ?? '--'}</Descriptions.Item>
          <Descriptions.Item label="班组">{task.group || '--'}</Descriptions.Item>
          <Descriptions.Item label="执行人">{task.owner || '--'}</Descriptions.Item>
          <Descriptions.Item label="创建时间">{task.createTime || '--'}</Descriptions.Item>
          <Descriptions.Item label="备注" span={2}>{task.remark || '--'}</Descriptions.Item>
        </Descriptions>
      </Card>

      {abnormalRows.length > 0 && (
        <Alert
          type="warning" showIcon style={{ marginBottom: 12 }}
          message={`存在 ${abnormalRows.length} 台设备未完成点检或被跳过`}
          description="未检/跳过设备行可在下方「异常处理」发起报修。"
        />
      )}

      <Card size="small" style={{ marginBottom: 12 }}>
        <div style={{ fontWeight: 600, marginBottom: 12 }}>检查项结果（{details.length} 台设备）</div>
        <Table
          rowKey="code" size="small" pagination={false}
          dataSource={details}
          locale={{ emptyText: <EmptyState description="暂无检查明细" reason="暂无该任务的设备明细数据" /> }}
          columns={[
            { title: '设备（canonical）', dataIndex: 'code', width: 220, render: (code) => {
              const c = canonOf(code);
              return c ? <Space size={6}>{c.name}</Space> : (code || '--');
            } },
            { title: '资产编号', dataIndex: 'code', width: 130 },
            { title: '规格型号', dataIndex: 'model', width: 110, render: v => v || '--' },
            { title: '部门/工位', width: 200, render: (_, r) => `${r.dept || '--'} / ${r.station || '--'}` },
            { title: '点检项目', dataIndex: 'itemNames', ellipsis: true, render: v => v || '--' },
            { title: '项目数', dataIndex: 'itemTotal', width: 80, render: v => v ?? '--' },
            { title: '已检', dataIndex: 'checked', width: 70, render: v => v ?? '--' },
            { title: '未检', dataIndex: 'unchecked', width: 70, render: v => v ?? '--' },
            { title: '执行时间', dataIndex: 'execTime', width: 150, render: v => v || '--' },
            { title: '跳过原因', dataIndex: 'skipReason', width: 220, render: v => v || '--' },
            {
              title: '异常处理', width: 110,
              render: (_, r) => (r.skipReason || r.unchecked > 0
                ? <Button type="link" size="small" danger onClick={() => handleReport(r)}>报修</Button>
                : <span style={{ fontSize: 12, color: '#8a97a3' }}>无</span>),
            },
          ]}
          scroll={{ x: 1450 }}
        />
      </Card>
    </>
  );
}
