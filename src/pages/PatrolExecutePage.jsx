import React, { useMemo, useState } from 'react';
import { Card, Descriptions, Table, Button, Tag, Input, InputNumber, Radio, App } from 'antd';
import { ArrowLeft, CheckCircle2 } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import PageHeader from '../components/PageHeader.jsx';
import DegradedBanner from '../components/DegradedBanner.jsx';
import StatusTag from '../components/StatusTag.jsx';
import EmptyState from '../components/EmptyState.jsx';
import { useDemoState } from '../state/DemoStore.jsx';
import { patrolTasks, patrolTaskDetails, patrolExecItems } from '../data/standardData.js';
import { crosswalkByAssetCode } from '../data/demo/deviceCrosswalk.js';

// 设备展示统一经 crosswalk canonical 映射（§3.1）：资产编码 → canonical 设备（deviceId/展示名）。
const canonDevice = (assetCode) => crosswalkByAssetCode[assetCode] || null;

// 巡检执行页（范围外演示模块）：searchParams 读 id（兼容 code），无匹配显示「未找到对象」。
// 逐项填写巡检结果（单选/数值/文本 + 备注）；执行状态为页面 useState（演示口径，不写演示快照）；
// 提交确认弹窗注明「演示模式：完整闭环由点巡保养业务模块承接」。
export default function PatrolExecutePage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const state = useDemoState();
  const meta = state.meta;
  const { message, modal } = App.useApp();
  const id = params.get('id') || params.get('code');

  const task = useMemo(() => patrolTasks.find(t => t.code === id) || null, [id]);

  // 首台设备作为演示巡检对象（快照为单设备多项目口径）
  const targetDevice = patrolTaskDetails.find(d => d.checked > 0) || patrolTaskDetails[0] || null;
  const deviceCanon = targetDevice ? canonDevice(targetDevice.code) : null;

  // 执行结果：页面 useState（不落快照）。初始值取种子巡检项的演示结果。
  const [results, setResults] = useState(() => Object.fromEntries(patrolExecItems.map(i => [i.code, { result: i.result || '', remark: i.remark || '' }])));
  const [execStatus, setExecStatus] = useState(task ? task.status : null); // 执行状态（演示）

  if (!task) {
    return (
      <>
        <PageHeader
          title="巡检执行"
          actions={<Button icon={<ArrowLeft size={14} />} onClick={() => navigate('/patrol-tasks')}>返回列表</Button>}
        />
        <Card size="small">
          <EmptyState description={`未找到巡检任务${id ? `（${id}）` : ''}`} reason="任务编号无效或不存在该任务" />
        </Card>
      </>
    );
  }

  const setResult = (code, patch) => setResults(prev => ({ ...prev, [code]: { ...prev[code], ...patch } }));

  const handleSubmit = () => {
    const missing = patrolExecItems.filter(i => !(results[i.code] || {}).result);
    if (missing.length > 0) {
      message.warning(`尚有 ${missing.length} 项未填写巡检结果（${missing.map(i => i.name).join('、')}）`);
      return;
    }
    modal.confirm({
      title: '提交巡检结果',
      content: '确认提交巡检结果？',
      okText: '确认提交', cancelText: '取消',
      onOk: () => {
        setExecStatus('已完成');
        message.success('巡检结果已提交：任务状态更新为已完成');
      },
    });
  };

  const abnormalCount = patrolExecItems.filter(i => {
    const r = (results[i.code] || {}).result || '';
    return ['异常', '不合格', '有'].includes(r);
  }).length;

  const columns = [
    { title: '项目编号', dataIndex: 'code', width: 110, fixed: 'left' },
    { title: '项目名称', dataIndex: 'name', width: 160 },
    { title: '项目类型', dataIndex: 'type', width: 120, render: v => v || '--' },
    { title: '检查内容', dataIndex: 'content', width: 240, ellipsis: true, render: v => v || '--' },
    {
      title: '结果类型', dataIndex: 'resultType', width: 90,
      render: (v, r) => <Tag color="processing">{v}</Tag>,
    },
    {
      title: '判定依据', width: 110,
      render: (_, r) => r.options || r.normalValue || '--',
    },
    {
      title: '巡检结果', width: 260,
      render: (_, r) => {
        const cur = results[r.code] || { result: '', remark: '' };
        if (r.resultType === '单选') {
          const opts = (r.options || '').split('/').filter(Boolean);
          return (
            <Radio.Group
              size="small"
              value={cur.result}
              onChange={e => setResult(r.code, { result: e.target.value })}
              options={opts.map(v => ({ value: v, label: v }))}
            />
          );
        }
        if (r.resultType === '数值') {
          return (
            <InputNumber
              size="small" style={{ width: 120 }} placeholder="填写实测值"
              value={isNaN(Number(cur.result)) ? undefined : Number(cur.result)}
              onChange={v => setResult(r.code, { result: v == null ? '' : String(v) })}
            />
          );
        }
        return (
          <Input
            size="small" placeholder="填写巡检结果"
            value={cur.result}
            onChange={e => setResult(r.code, { result: e.target.value })}
          />
        );
      },
    },
    {
      title: '备注', width: 240,
      render: (_, r) => (
        <Input.TextArea
          size="small" rows={1} placeholder="选填"
          value={(results[r.code] || {}).remark || ''}
          onChange={e => setResult(r.code, { remark: e.target.value })}
        />
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title={`巡检执行 · ${task.code}`}
        subtitle={`巡检线路（计划）：${task.plan || '--'} · 巡检日期 ${task.date || '--'}`}
        actions={<Button icon={<ArrowLeft size={14} />} onClick={() => navigate('/patrol-tasks')}>返回列表</Button>}
      />
      <DegradedBanner meta={meta} />
      <Card size="small" style={{ marginBottom: 12 }}>
        <Descriptions column={3} size="small">
          <Descriptions.Item label="任务编号">{task.code}</Descriptions.Item>
          <Descriptions.Item label="巡检线路（计划）">{task.plan || '--'}</Descriptions.Item>
          <Descriptions.Item label="执行状态"><StatusTag value={execStatus} /></Descriptions.Item>
          <Descriptions.Item label="巡检日期">{task.date || '--'}</Descriptions.Item>
          <Descriptions.Item label="执行人">{task.owner || '--'}</Descriptions.Item>
          <Descriptions.Item label="应巡设备数">{task.shouldCount != null ? `${task.shouldCount} 台` : '--'}</Descriptions.Item>
          <Descriptions.Item label="本次巡检设备" span={2}>
            {deviceCanon ? <span>{deviceCanon.name}（{targetDevice.code} · canonical {deviceCanon.deviceId}） · {targetDevice.location || '--'}</span> : '--'}
          </Descriptions.Item>
          <Descriptions.Item label="异常发现"><Tag color={abnormalCount > 0 ? 'error' : 'default'}>{abnormalCount} 项</Tag></Descriptions.Item>
        </Descriptions>
      </Card>
      <Card size="small">
        <Table
          rowKey="code" size="small" columns={columns}
          dataSource={patrolExecItems}
          pagination={false}
          locale={{ emptyText: <EmptyState description="暂无待执行巡检项" reason="暂无该任务的巡检项" /> }}
        />
        <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end' }}>
          <Button type="primary" icon={<CheckCircle2 size={14} />} onClick={handleSubmit}>提交巡检结果</Button>
        </div>
      </Card>
    </>
  );
}
