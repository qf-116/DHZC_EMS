import React, { useMemo, useState } from 'react';
import { Card, Descriptions, Table, Button, Space, Alert, App, Tooltip } from 'antd';
import { ArrowLeft } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import PageHeader from '../components/PageHeader.jsx';
import DegradedBanner from '../components/DegradedBanner.jsx';
import StatusTag from '../components/StatusTag.jsx';
import EmptyState from '../components/EmptyState.jsx';
import SkipInspectionModal from '../components/SkipInspectionModal.jsx';
import { useDemoState } from '../state/DemoStore.jsx';
import { inspectionTasks } from '../data/standardData.js';
import { crosswalkByAssetCode } from '../data/demo/deviceCrosswalk.js';
import { useInspectionSession, resolveTaskDetails, resolveTaskPatch, skipDevice } from '../domain/inspectionSession.js';

// 设备展示统一经 canonical 设备映射（crosswalk）：名称 + MT 资产编号；种子里的旧编码仅作关联键。
const canonOf = (assetCode) => crosswalkByAssetCode[assetCode] || null;

// 点检任务详情（范围外演示模块）：/inspection-tasks/detail（query 兼容 id/code）。
// 展示任务信息 + 点检明细表（已检/未检/跳过）+ 异常项关联处理入口（报修为演示增强，原型未出现）。
// 明细支持「跳过点检」（原型 跳过点检.html），确认后写入跳过原因，任务状态按规则进入「进行中」。
export default function InspectionTaskDetailPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { message } = App.useApp();
  const state = useDemoState();
  const meta = state.meta;
  const session = useInspectionSession();

  const [skipTarget, setSkipTarget] = useState(null);

  const codeOrId = params.get('code') || params.get('id');
  const seedTask = codeOrId
    ? inspectionTasks.find(t => t.code === codeOrId || t.code === decodeURIComponent(codeOrId))
    : null;
  const task = seedTask ? { ...seedTask, ...resolveTaskPatch(seedTask.code, session) } : null;
  const details = useMemo(() => resolveTaskDetails(task, session), [task, session]);

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

  const abnormalRows = details.filter(d => d.skipReason || d.unchecked > 0);

  const handleReport = (row) => {
    const c = canonOf(row.code);
    message.success(`异常项报修已提交：${c ? c.name : row.code} ${c ? c.assetCode : ''}`);
  };

  const handleSkipConfirm = (reason) => {
    skipDevice(task, skipTarget?.code, reason);
    message.success(`设备「${skipTarget?.name || '--'}」已跳过点检，跳过原因：${reason}`);
    setSkipTarget(null);
  };

  return (
    <>
      <PageHeader
        title="点检任务详情"
        subtitle={`任务：${task.code} · ${task.plan} · 任务日期：${task.date} · 数据更新于 ${meta.demoDay}`}
        actions={<Space>
          {['未开始', '进行中'].includes(task.status) && (
            <Button type="primary" onClick={() => navigate(`/inspection-tasks/execute?code=${encodeURIComponent(task.code)}`)}>开始执行</Button>
          )}
          <Button icon={<ArrowLeft size={14} />} onClick={() => navigate('/inspection-tasks')}>返回列表</Button>
        </Space>}
      />
      <DegradedBanner meta={meta} />

      <Card size="small" style={{ marginBottom: 12 }}>
        <div style={{ fontWeight: 600, marginBottom: 12 }}>任务信息</div>
        <Descriptions column={2} size="small" bordered>
          <Descriptions.Item label="任务编号">{task.code}</Descriptions.Item>
          <Descriptions.Item label="点检计划名称">{task.plan || '--'}</Descriptions.Item>
          <Descriptions.Item label="任务日期">{task.date || '--'}</Descriptions.Item>
          <Descriptions.Item label="任务状态">
            <StatusTag value={task.status} tip={`当前状态：${task.status}`} />
          </Descriptions.Item>
          <Descriptions.Item label="应检设备数">{task.shouldCount ?? '--'}</Descriptions.Item>
          <Descriptions.Item label="点检班组">{task.group || '--'}</Descriptions.Item>
          <Descriptions.Item label="负责人">{task.owner || '--'}</Descriptions.Item>
          <Descriptions.Item label="任务创建时间">{task.createTime || '--'}</Descriptions.Item>
          <Descriptions.Item label="备注" span={2}>{task.remark || '--'}</Descriptions.Item>
        </Descriptions>
      </Card>

      {abnormalRows.length > 0 && (
        <Alert
          type="warning" showIcon style={{ marginBottom: 12 }}
          message={`存在 ${abnormalRows.length} 台设备未完成点检或被跳过`}
          description="未检设备可在「操作」列点「跳过点检」填写跳过原因；「异常处理」为演示增强入口，原型未出现。"
        />
      )}

      <Card size="small" style={{ marginBottom: 12 }}>
        <div style={{ fontWeight: 600, marginBottom: 12 }}>点检明细（{details.length} 台设备）</div>
        <Table
          rowKey="code" size="small" pagination={false}
          dataSource={details}
          locale={{ emptyText: <EmptyState description="暂无检查明细" reason="暂无该任务的设备明细数据" /> }}
          columns={[
            { title: '设备编号', dataIndex: 'code', width: 140 },
            { title: '设备名称', dataIndex: 'name', width: 160, render: (v, r) => {
              const c = canonOf(r.code);
              return c ? c.name : (v || '--');
            } },
            { title: '规格型号', dataIndex: 'model', width: 110, render: v => v || '--' },
            { title: '设备类型', dataIndex: 'type', width: 100, render: v => v || '--' },
            { title: '工位', dataIndex: 'station', width: 110, render: v => v || '--' },
            { title: '使用部门', dataIndex: 'dept', width: 170, render: v => v || '--' },
            { title: '点检项目', dataIndex: 'itemNames', ellipsis: true, render: (v, r) => (v ? `${v}（${r.itemTotal ?? '--'}项）` : '--') },
            { title: '已检', dataIndex: 'checked', width: 70, render: v => v ?? '--' },
            { title: '未检', dataIndex: 'unchecked', width: 70, render: v => v ?? '--' },
            { title: '执行时间', dataIndex: 'execTime', width: 150, render: v => v || '--' },
            { title: '跳过原因', dataIndex: 'skipReason', width: 200, render: v => v || '--' },
            {
              title: '操作', width: 180,
              render: (_, r) => (
                <Space size={0}>
                  {!r.skipReason && (
                    <Button type="link" size="small" onClick={() => setSkipTarget(r)}>跳过点检</Button>
                  )}
                  <Tooltip title="报修为演示增强入口，原型未出现">
                    <Button type="link" size="small" danger disabled={!(r.skipReason || r.unchecked > 0)} onClick={() => handleReport(r)}>报修</Button>
                  </Tooltip>
                </Space>
              ),
            },
          ]}
          scroll={{ x: 1700 }}
        />
      </Card>

      <SkipInspectionModal
        open={!!skipTarget}
        title="跳过点检"
        onCancel={() => setSkipTarget(null)}
        onConfirm={handleSkipConfirm}
      />
    </>
  );
}
