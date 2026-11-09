import React, { useMemo, useState } from 'react';
import { Card, Descriptions, Table, Button, Tag, Input, InputNumber, Radio, App, Space, Typography } from 'antd';
import { ArrowLeft, CheckCircle2 } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import PageHeader from '../components/PageHeader.jsx';
import DegradedBanner from '../components/DegradedBanner.jsx';
import StatusTag from '../components/StatusTag.jsx';
import EmptyState from '../components/EmptyState.jsx';
import PatrolSkipModal from '../components/PatrolSkipModal.jsx';
import { useDemoState } from '../state/DemoStore.jsx';
import { patrolTasks, patrolTaskDetails, patrolExecItems } from '../data/standardData.js';
import { crosswalkByAssetCode } from '../data/demo/deviceCrosswalk.js';

// 设备展示统一经 crosswalk canonical 映射（§3.1）：资产编码 → canonical 设备（deviceId/展示名）。
const canonDevice = (assetCode) => crosswalkByAssetCode[assetCode] || null;

// 原型「执行巡检.html」placeholder 原文：数值型「请输入数值，正常值为13~25」，文本型「请输入检查结果」。
// 正常值区间解析：支持 "13~25" / "0 ~ 25" / "22 ~ 28 ℃"；无法解析出上下限视为「未配置正常值」，不校验。
const parseRange = (text) => {
  const m = String(text || '').match(/(-?\d+(?:\.\d+)?)\s*[~～]\s*(-?\d+(?:\.\d+)?)/);
  if (!m) return null;
  const min = Number(m[1]);
  const max = Number(m[2]);
  if (Number.isNaN(min) || Number.isNaN(max)) return null;
  return min <= max ? { min, max } : { min: max, max: min };
};

// 执行判定口径（原型统一为「合格 / 不合格」）；项目模板口径（如 正常/异常、有/无）另行成列，不混用。
const EXEC_OPTIONS = [
  { value: '合格', label: '合格' },
  { value: '不合格', label: '不合格' },
];

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
  const [skipOpen, setSkipOpen] = useState(false);
  const [skipInfo, setSkipInfo] = useState({ reason: '', at: '' });
  const [savedHint, setSavedHint] = useState('');

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

  const setResult = (code, patch) => {
    setResults(prev => ({ ...prev, [code]: { ...prev[code], ...patch } }));
    // 原型规则：每输入一个项目的结果，自动保存 1 次（演示口径：页面内状态 + 提示）
    setSavedHint('已自动保存');
    window.clearTimeout(window.__patrolAutoSaveTimer);
    window.__patrolAutoSaveTimer = window.setTimeout(() => setSavedHint(''), 1500);
  };

  const handleSubmit = () => {
    const missing = patrolExecItems.filter(i => {
      const r = (results[i.code] || {}).result || '';
      return !r && r !== '跳过';
    });
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

  const handleSkip = (reason) => {
    // 跳过巡检：该设备未检项按跳过处理，任务状态进入「进行中」
    setResults(prev => {
      const next = { ...prev };
      patrolExecItems.forEach(i => {
        if (!next[i.code] || !next[i.code].result) next[i.code] = { result: '跳过', remark: next[i.code]?.remark || '' };
      });
      return next;
    });
    setSkipInfo({ reason, at: `${meta.updatedAt || meta.demoDay || ''}` });
    setExecStatus('进行中');
    setSkipOpen(false);
    message.success('已跳过该设备巡检，未检项按跳过处理，任务状态更新为进行中');
  };

  const abnormalCount = patrolExecItems.filter(i => {
    const r = (results[i.code] || {}).result || '';
    return ['异常', '不合格', '有'].includes(r);
  }).length;

  const columns = [
    { title: '项目编号', dataIndex: 'code', width: 110, fixed: 'left' },
    { title: '项目名称', dataIndex: 'name', width: 160 },
    { title: '项目类型', dataIndex: 'type', width: 120, render: v => v || '--' },
    { title: '检查内容', dataIndex: 'content', width: 220, ellipsis: true, render: v => v || '--' },
    {
      title: '结果类型', dataIndex: 'resultType', width: 90,
      render: (v) => <Tag color="processing">{v}</Tag>,
    },
    {
      title: '项目模板口径', width: 130,
      render: (_, r) => (r.options || r.normalValue || r.normalRange
        ? <Tag>{r.options || r.normalValue || r.normalRange}</Tag>
        : <span style={{ color: '#9aa7b5' }}>未配置</span>),
    },
    {
      title: '执行判定口径', width: 300,
      render: (_, r) => {
        const cur = results[r.code] || { result: '', remark: '' };
        if (cur.result === '跳过') {
          return <Tag color="orange">已跳过</Tag>;
        }
        if (r.resultType === '单选') {
          return (
            <Radio.Group
              size="small"
              value={cur.result}
              onChange={e => setResult(r.code, { result: e.target.value })}
              options={EXEC_OPTIONS}
            />
          );
        }
        if (r.resultType === '数值') {
          const rangeText = r.normalValue || r.normalRange || '';
          const range = parseRange(rangeText);
          const num = Number(cur.result);
          const outOfRange = range && cur.result !== '' && !Number.isNaN(num) && (num < range.min || num > range.max);
          return (
            <div>
              <InputNumber
                size="small"
                style={{ width: 140 }}
                status={outOfRange ? 'error' : undefined}
                placeholder={`请输入数值，正常值为${range ? `${range.min}~${range.max}` : '未配置'}`}
                value={cur.result === '' || cur.result === '跳过' ? undefined : Number(cur.result)}
                onChange={v => setResult(r.code, { result: v == null ? '' : String(v) })}
              />
              {outOfRange && (
                <div style={{ color: '#ff4d4f', fontSize: 12, marginTop: 2 }}>
                  正常值为 {range.min}~{range.max}，请输入该区间内的数值
                </div>
              )}
            </div>
          );
        }
        return (
          <Input
            size="small"
            placeholder="请输入检查结果"
            value={cur.result === '跳过' ? '' : cur.result}
            onChange={e => setResult(r.code, { result: e.target.value })}
          />
        );
      },
    },
    {
      title: '备注', width: 220,
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
          <Descriptions.Item label="跳过原因" span={3}>
            {skipInfo.reason ? <span style={{ color: '#d46b08' }}>{skipInfo.reason}{skipInfo.at ? `（${skipInfo.at}）` : ''}</span> : '--'}
          </Descriptions.Item>
        </Descriptions>
      </Card>
      <Card size="small">
        <Space style={{ marginBottom: 12 }} align="center">
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            口径说明：单选项按「执行判定口径」统一为 合格 / 不合格；「项目模板口径」列展示巡检项目档案自身的判定设置，两者不混用。
          </Typography.Text>
          {savedHint && <Tag color="success">{savedHint}</Tag>}
        </Space>
        <Table
          rowKey="code" size="small" columns={columns}
          dataSource={patrolExecItems}
          pagination={false}
          locale={{ emptyText: <EmptyState description="暂无待执行巡检项" reason="暂无该任务的巡检项" /> }}
        />
        <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <Button onClick={() => setSkipOpen(true)}>跳过巡检</Button>
          <Button type="primary" icon={<CheckCircle2 size={14} />} onClick={handleSubmit}>提交巡检结果</Button>
        </div>
      </Card>

      <PatrolSkipModal
        open={skipOpen}
        deviceLabel={targetDevice ? `${targetDevice.name}（${targetDevice.code}）` : ''}
        onCancel={() => setSkipOpen(false)}
        onConfirm={handleSkip}
      />
    </>
  );
}
