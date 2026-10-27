import React from 'react';
import { Card, Descriptions, Table, Button, Tag, Tooltip, Space } from 'antd';
import { ArrowLeft } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import PageHeader from '../components/PageHeader.jsx';
import DegradedBanner from '../components/DegradedBanner.jsx';
import StatusTag from '../components/StatusTag.jsx';
import EmptyState from '../components/EmptyState.jsx';
import { useDemoState } from '../state/DemoStore.jsx';
import {
  maintenanceTasks,
  maintenanceExecItems,
  maintenanceTaskDetails,
  maintenancePlans,
  ledgerDevices,
} from '../data/standardData.js';
import { crosswalkByAssetCode } from '../data/demo/deviceCrosswalk.js';

const dash = (v) => (v === null || v === undefined || v === '' ? '--' : v);

function parseAssetCode(deviceStr) {
  const m = String(deviceStr || '').match(/MT\d{4}A\d+/);
  return m ? m[0] : null;
}

// 保养项结果口径（种子推导，不伪造执行记录）：
// 任务明细行有 skipReason → 已跳过；checked ≥ 项目序位 → 已完成（执行时间取明细行 execTime）；否则未执行。
function resultOfItem(itemIndex, detailRow) {
  if (!detailRow) return { label: '--', tip: '暂无该任务的保养明细' };
  if (detailRow.skipReason) return { label: '已跳过', tip: detailRow.skipReason };
  if ((detailRow.checked || 0) >= itemIndex + 1) return { label: '已完成', tip: `执行时间：${detailRow.execTime || '--'}` };
  return { label: '未执行', tip: '保养项未执行' };
}

// 保养任务详情（范围外演示模块，只读）：/maintenance-tasks/detail?code=（兼容 ?id=）。
// 展示任务信息 + 保养设备（crosswalk canonical）+ 保养项结果表。
export default function MaintenanceTaskDetailPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const state = useDemoState();
  const meta = state.meta;

  const code = params.get('code') || params.get('id');
  const task = code ? maintenanceTasks.find(r => r.code === code) : null;

  if (!task) {
    return (
      <>
        <PageHeader
          title="保养任务详情"
          actions={<Button icon={<ArrowLeft size={14} />} onClick={() => navigate('/maintenance-tasks')}>返回列表</Button>}
        />
        <Card size="small">
          <EmptyState
            description={`未找到保养任务${code ? `（${code}）` : ''}`}
            reason="任务编号无效或该任务不存在（不回退展示其他任务）"
            next
            onNext={() => navigate('/maintenance-tasks')}
            nextLabel="返回保养任务列表"
          />
        </Card>
      </>
    );
  }

  const assetCode = parseAssetCode(task.device);
  const cw = assetCode ? crosswalkByAssetCode[assetCode] : null;
  const ledger = assetCode ? ledgerDevices.find(d => d.code === assetCode) : null;
  const detailRow = assetCode ? maintenanceTaskDetails.find(d => d.code === assetCode) : null;
  // 名下计划：按种子计划名称精确匹配（不做字符串推导）
  const plan = maintenancePlans.find(p => p.name === task.plan) || null;
  const canExecute = ['未开始', '进行中'].includes(task.status);

  const resultRows = maintenanceExecItems.map((item, idx) => {
    const res = resultOfItem(idx, detailRow);
    return { ...item, key: item.code, result: res.label, resultTip: res.tip };
  });

  return (
    <>
      <PageHeader
        title={`保养任务详情 · ${task.code}`}
        subtitle={`${task.name}`}
        actions={(
          <Space>
            {canExecute && (
              <Button type="primary" onClick={() => navigate(`/maintenance-tasks/execute?code=${encodeURIComponent(task.code)}`)}>前往执行</Button>
            )}
            <Button icon={<ArrowLeft size={14} />} onClick={() => navigate('/maintenance-tasks')}>返回列表</Button>
          </Space>
        )}
      />
      <DegradedBanner meta={meta} />
      <Card size="small" style={{ marginBottom: 12 }}>
        <Descriptions column={3} size="small" bordered>
          <Descriptions.Item label="任务编号">{task.code}</Descriptions.Item>
          <Descriptions.Item label="所属计划">
            {plan
              ? <a onClick={() => navigate(`/maintenance-plans/detail?code=${encodeURIComponent(plan.code)}`)}>{dash(task.plan)}</a>
              : dash(task.plan)}
          </Descriptions.Item>
          <Descriptions.Item label="状态"><StatusTag value={task.status} /></Descriptions.Item>
          <Descriptions.Item label="保养设备">
            {cw ? `${cw.name}（${assetCode}）` : dash(task.device)}
            {cw ? <Tag style={{ marginLeft: 6 }}>{cw.deviceId}</Tag> : null}
          </Descriptions.Item>
          <Descriptions.Item label="设备型号">{dash(ledger?.model)}</Descriptions.Item>
          <Descriptions.Item label="设备类型">{dash(ledger?.type)}</Descriptions.Item>
          <Descriptions.Item label="所属部门">{dash(task.dept)}</Descriptions.Item>
          <Descriptions.Item label="计划时间">{dash(task.date)}</Descriptions.Item>
          <Descriptions.Item label="执行人">{dash(task.owner)}</Descriptions.Item>
          <Descriptions.Item label="创建时间">{dash(task.createTime)}</Descriptions.Item>
          <Descriptions.Item label="数据基准">{meta.updatedAt}</Descriptions.Item>
          <Descriptions.Item label="备注">{dash(task.remark)}</Descriptions.Item>
        </Descriptions>
      </Card>

      {detailRow && (
        <Card type="inner" size="small" title="任务执行汇总" style={{ marginBottom: 12 }}>
          <Descriptions column={3} size="small">
            <Descriptions.Item label="保养项目数">{dash(detailRow.itemCount)}</Descriptions.Item>
            <Descriptions.Item label="已执行">{dash(detailRow.checked)}</Descriptions.Item>
            <Descriptions.Item label="未执行">{dash(detailRow.unchecked)}</Descriptions.Item>
            <Descriptions.Item label="执行时间">{dash(detailRow.execTime)}</Descriptions.Item>
            <Descriptions.Item label="跳过原因" span={2}>{dash(detailRow.skipReason)}</Descriptions.Item>
          </Descriptions>
        </Card>
      )}

      <Card type="inner" size="small" title="保养项结果表" style={{ marginBottom: 12 }}>
        <Table
          rowKey="key" size="small" pagination={false}
          dataSource={resultRows}
          locale={{
            emptyText: <EmptyState description="暂无保养项目" reason="暂无该任务的保养项目数据" />,
          }}
          columns={[
            { title: '项目编号', dataIndex: 'code', width: 160 },
            { title: '项目名称', dataIndex: 'name', width: 180 },
            { title: '保养类型', dataIndex: 'type', width: 110, render: v => dash(v) },
            { title: '保养部位', dataIndex: 'part', width: 100, render: v => dash(v) },
            { title: '保养级别', dataIndex: 'level', width: 90, render: v => <Tag>{dash(v)}</Tag> },
            { title: '保养要求', dataIndex: 'require', width: 260, render: v => dash(v) },
            {
              title: '结果', dataIndex: 'result', width: 100,
              render: (v, r) => (
                <Tooltip title={r.resultTip}>
                  <StatusTag value={v} />
                </Tooltip>
              ),
            },
          ]}
        />
      </Card>
    </>
  );
}
