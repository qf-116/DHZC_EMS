import React, { useEffect, useMemo, useState } from 'react';
import { Card, Descriptions, Table, Button, Space, Radio, Input, InputNumber, Select, Modal, Alert, Tag, App } from 'antd';
import { ArrowLeft } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import PageHeader from '../components/PageHeader.jsx';
import DegradedBanner from '../components/DegradedBanner.jsx';
import StatusTag from '../components/StatusTag.jsx';
import EmptyState from '../components/EmptyState.jsx';
import UserPickerModal from '../components/UserPickerModal.jsx';
import SkipInspectionModal from '../components/SkipInspectionModal.jsx';
import { useDemoState } from '../state/DemoStore.jsx';
import { inspectionTasks, inspectionTaskDetails, inspectionItems, inspectionExecItems } from '../data/standardData.js';
import { crosswalkByAssetCode } from '../data/demo/deviceCrosswalk.js';
import { parseNormalRange, parseNormalBound } from '../domain/inspection.js';
import { useInspectionSession, resolveTaskDetails, resolveTaskPatch, skipDevice, submitDeviceResult } from '../domain/inspectionSession.js';

const canonOf = (assetCode) => crosswalkByAssetCode[assetCode] || null;

// 存放位置：原型口径是设备档案存放位置；演示快照的点检明细已给 location 时优先使用
const locationOf = (assetCode) => {
  const inspectionDevice = inspectionTaskDetails.find(d => d.code === assetCode);
  return inspectionDevice?.location || '--';
};

// 数值型项目的正常值提示：优先按「下限~上限」拼，解析不到则回落到原始正常基准文案
const numericPlaceholder = (item) => {
  const range = parseNormalRange(item.normalValue);
  if (range) return `请输入数值，正常值为${range.min}~${range.max}`;
  const bound = parseNormalBound(item.normalValue);
  if (bound) {
    const word = bound.op === '≤' ? '上限为' : bound.op === '≥' ? '下限为' : '约为';
    return `请输入数值，正常值${word}${bound.value}`;
  }
  if (item.normalValue) return `请输入数值，正常值${item.normalValue}`;
  return '请输入数值';
};

// 执行点检页（范围外演示模块）：/inspection-tasks/execute（query 兼容 id/code）。
// 逐项填写：结果（合格/不合格）+ 数值/文本 + 备注；提交前需签名（从人员主数据选取）。
// 原型未提供签名控件，签名块为实现侧增强（保留）；原型无跳过入口，跳过点检按原型弹窗补齐。
// 执行状态用页面 useState + 点检演示会话（不写入 DemoStore），完整闭环由点巡保养业务模块承接。
export default function InspectionExecutePage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { message } = App.useApp();
  const state = useDemoState();
  const meta = state.meta;
  const session = useInspectionSession();

  const codeOrId = params.get('code') || params.get('id');
  const seedTask = codeOrId
    ? inspectionTasks.find(t => t.code === codeOrId || t.code === decodeURIComponent(codeOrId))
    : null;

  // 叠加演示会话中的任务补丁（跳过点检 / 任务完成写入）
  const task = seedTask ? { ...seedTask, ...resolveTaskPatch(seedTask.code, session) } : null;

  const details = useMemo(() => resolveTaskDetails(task, session), [task, session]);
  const devices = useMemo(() => details.filter(d => !d.skipReason), [details]);
  const [deviceCode, setDeviceCode] = useState(null);
  const activeCode = deviceCode && devices.some(d => d.code === deviceCode) ? deviceCode : (devices[0]?.code || null);

  // 局部执行状态：{ [itemCode]: { result, value, remark } }；签名；提交后的本地确认结果
  const [results, setResults] = useState({});
  const [signName, setSignName] = useState('');
  const [signPickerOpen, setSignPickerOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [summary, setSummary] = useState(null); // { device, normal, abnormal, items, signName }
  const [skipOpen, setSkipOpen] = useState(false);

  const currentDevice = devices.find(d => d.code === activeCode) || null;
  const canon = currentDevice ? canonOf(currentDevice.code) : null;

  // 当前设备的点检项目：优先按设备明细的点检项目名称在点检项目主数据里取（含结果类型 / 正常基准）
  const execItems = useMemo(() => {
    const names = String(currentDevice?.itemNames || '').split('、').map(s => s.trim()).filter(Boolean);
    if (names.length === 0) return inspectionExecItems;
    const picked = names
      .map(n => inspectionItems.find(i => i.name === n))
      .filter(Boolean)
      .map(i => ({
        code: i.code, name: i.name, type: i.type, content: i.content,
        resultType: i.resultType, options: i.options, normalValue: i.normalValue,
      }));
    return picked.length ? picked : inspectionExecItems;
  }, [currentDevice]);

  // 切换执行设备时清空上一台设备的填写结果（避免同一项目在不同设备间串值）
  useEffect(() => {
    setResults({});
  }, [activeCode]);

  if (!codeOrId || !task) {
    return (
      <>
        <PageHeader title="执行点检" subtitle={codeOrId ? `任务：${codeOrId}` : '未指定点检任务'}
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

  const setItem = (code, patch) => {
    setResults(prev => ({ ...prev, [code]: { ...prev[code], ...patch } }));
  };

  const filled = execItems.filter(i => results[i.code]?.result);
  const abnormalCount = filled.filter(i => results[i.code].result === '不合格').length;
  const allFilled = filled.length === execItems.length;

  const trySubmit = () => {
    if (!allFilled) { message.warning('请逐项填写点检结果（合格/不合格）后再提交'); return; }
    if (!signName.trim()) { message.warning('提交前请填写签名（姓名）'); return; }
    setConfirmOpen(true);
  };

  const doConfirm = () => {
    // 写入演示会话：该设备已检项数推进，任务状态按原型规则进入「进行中」
    submitDeviceResult(task, currentDevice?.code, filled.length, new Date().toLocaleString('zh-CN', { hour12: false }).replaceAll('/', '-'));
    setSummary({
      device: canon ? `${canon.name}（${canon.assetCode}）` : (activeCode || '--'),
      normal: filled.length - abnormalCount,
      abnormal: abnormalCount,
      items: filled.length,
      signName: signName.trim(),
    });
    setConfirmOpen(false);
    message.success('执行结果已提交');
  };

  const handleSkipConfirm = (reason) => {
    skipDevice(task, currentDevice?.code, reason);
    setSkipOpen(false);
    message.success(`设备「${canon ? canon.name : currentDevice?.name || '--'}」已跳过点检，跳过原因：${reason}`);
  };

  return (
    <>
      <PageHeader
        title="执行点检"
        subtitle={`任务：${task.code} · ${task.plan} · 任务日期：${task.date} · 数据更新于 ${meta.demoDay}`}
        actions={<Space><Button icon={<ArrowLeft size={14} />} onClick={() => navigate('/inspection-tasks')}>返回列表</Button></Space>}
      />
      <DegradedBanner meta={meta} />

      <Card size="small" style={{ marginBottom: 12 }}>
        <div style={{ fontWeight: 600, marginBottom: 12 }}>任务信息</div>
        <Descriptions column={2} size="small" bordered>
          <Descriptions.Item label="任务编号">{task.code}</Descriptions.Item>
          <Descriptions.Item label="所属计划">{task.plan || '--'}</Descriptions.Item>
          <Descriptions.Item label="任务日期">{task.date || '--'}</Descriptions.Item>
          <Descriptions.Item label="存放位置">{currentDevice ? locationOf(currentDevice.code) : '--'}</Descriptions.Item>
          <Descriptions.Item label="负责人">{task.owner || '--'}</Descriptions.Item>
          <Descriptions.Item label="状态">
            <StatusTag value={task.status} tip={`当前状态：${task.status}`} />
          </Descriptions.Item>
          <Descriptions.Item label="执行设备" span={2}>
            <Select
              style={{ width: 320 }}
              value={activeCode || undefined}
              onChange={setDeviceCode}
              placeholder="请选择执行设备"
              options={devices.map(d => {
                const c = canonOf(d.code);
                return { value: d.code, label: c ? `${c.name}（${c.assetCode}）` : d.code };
              })}
            />
          </Descriptions.Item>
        </Descriptions>
      </Card>

      <Card size="small" style={{ marginBottom: 12 }}>
        <div style={{ fontWeight: 600, marginBottom: 12 }}>执行设备明细（{details.length} 台）</div>
        <Table
          rowKey="code" size="small" pagination={false}
          dataSource={details}
          columns={[
            { title: '设备编号', dataIndex: 'code', width: 150 },
            { title: '设备名称', dataIndex: 'name', width: 160, render: (v, r) => canonOf(r.code)?.name || v || '--' },
            { title: '设备类型', dataIndex: 'type', width: 100, render: v => v || '--' },
            { title: '点检项目数', dataIndex: 'itemTotal', width: 110, render: v => v ?? '--' },
            { title: '已检', dataIndex: 'checked', width: 70, render: v => v ?? '--' },
            { title: '未检', dataIndex: 'unchecked', width: 70, render: v => v ?? '--' },
            { title: '跳过原因', dataIndex: 'skipReason', width: 220, render: v => v || '--' },
            {
              title: '操作', width: 150,
              render: (_, r) => (
                <Space size={0}>
                  {!r.skipReason && <Button type="link" size="small" onClick={() => setDeviceCode(r.code)}>执行</Button>}
                  {!r.skipReason && <Button type="link" size="small" onClick={() => { setDeviceCode(r.code); setSkipOpen(true); }}>跳过点检</Button>}
                </Space>
              ),
            },
          ]}
          scroll={{ x: 1150 }}
          locale={{ emptyText: '暂无设备明细' }}
        />
      </Card>

      <Card size="small" style={{ marginBottom: 12 }}>
        <div style={{ fontWeight: 600, marginBottom: 4 }}>
          点检项目（{execItems.length} 项）
          {canon && <span style={{ fontWeight: 400, fontSize: 13, color: '#8a97a3', marginLeft: 8 }}>执行设备：{canon.name}（{canon.assetCode}）</span>}
        </div>
        <div style={{ fontSize: 12, color: '#8a97a3', marginBottom: 12 }}>单选选项按项目定义，数值项请对照正常基准填写实测值。</div>
        <Table
          rowKey="code" size="small" pagination={false}
          dataSource={execItems}
          columns={[
            { title: '项目', width: 240, render: (_, r) => (
              <div>
                <div style={{ fontWeight: 600 }}>{r.name}</div>
                <div style={{ fontSize: 12, color: '#8a97a3' }}>{r.code} · {r.type}</div>
              </div>
            ) },
            { title: '检查内容', dataIndex: 'content', ellipsis: true, render: (v, r) => (
              <div>
                <div>{v || '--'}</div>
                {r.normalValue ? <div style={{ fontSize: 12, color: '#8a97a3' }}>正常基准：{r.normalValue}</div> : null}
                {r.resultType === '单选' && r.options ? <div style={{ fontSize: 12, color: '#8a97a3' }}>项目判定选项：{r.options}</div> : null}
              </div>
            ) },
            { title: '结果', width: 170, render: (_, r) => (
              <Radio.Group
                value={results[r.code]?.result}
                onChange={(e) => setItem(r.code, { result: e.target.value })}
                options={['合格', '不合格'].map(v => ({ value: v, label: v }))}
              />
            ) },
            {
              title: '数值 / 记录', width: 230,
              render: (_, r) => (r.resultType === '数值'
                ? <InputNumber style={{ width: 200 }} placeholder={numericPlaceholder(r)} value={results[r.code]?.value} onChange={v => setItem(r.code, { value: v })} />
                : r.resultType === '文本'
                  ? <Input style={{ width: 200 }} placeholder="请输入检查结果" maxLength={100} value={results[r.code]?.value} onChange={e => setItem(r.code, { value: e.target.value })} />
                  : <span style={{ fontSize: 12, color: '#8a97a3' }}>--</span>),
            },
            { title: '备注', width: 220, render: (_, r) => (
              <Input.TextArea rows={1} placeholder="备注（可选）" maxLength={100}
                value={results[r.code]?.remark} onChange={e => setItem(r.code, { remark: e.target.value })} />
            ) },
          ]}
        />
      </Card>

      <Card size="small" style={{ marginBottom: 12 }}>
        <div style={{ fontWeight: 600, marginBottom: 12 }}>签名确认</div>
        <Space wrap size={16} align="center">
          <span>签名（姓名）：</span>
          <Input
            style={{ width: 280 }}
            placeholder="点击「选择」从人员主数据选取"
            maxLength={20}
            value={signName}
            readOnly
            addonAfter={<a onClick={() => setSignPickerOpen(true)}>选择</a>}
          />
          <Tag color={allFilled ? 'success' : 'warning'}>已填结果 {filled.length}/{execItems.length} · 不合格 {abnormalCount}</Tag>
          <Button type="primary" onClick={trySubmit}>提交</Button>
        </Space>
      </Card>

      {summary && (
        <Card size="small">
          <Alert
            type="success" showIcon
            message="执行结果已提交"
            description={`设备：${summary.device} · 共 ${summary.items} 项：合格 ${summary.normal} 项 / 不合格 ${summary.abnormal} 项 · 签名：${summary.signName}`}
          />
        </Card>
      )}

      <Modal
        title="确认提交执行结果"
        open={confirmOpen}
        onOk={doConfirm}
        onCancel={() => setConfirmOpen(false)}
        okText="确认提交"
        cancelText="返回修改"
      >
        <Alert
          type="info" showIcon
          message="提交后更新该设备的点检结果；任务有点检结果时状态进入「进行中」，全部设备完成后可在任务列表执行「任务完成」"
          description={`本次提交：${canon ? `${canon.name}（${canon.assetCode}）` : activeCode} · ${filled.length} 项（合格 ${filled.length - abnormalCount} / 不合格 ${abnormalCount}）· 签名：${signName.trim()}`}
        />
      </Modal>

      <UserPickerModal
        open={signPickerOpen}
        title="选择点检执行人"
        onCancel={() => setSignPickerOpen(false)}
        onSelect={(u) => { setSignName(u.name); setSignPickerOpen(false); }}
      />

      <SkipInspectionModal
        open={skipOpen}
        title="跳过点检"
        onCancel={() => setSkipOpen(false)}
        onConfirm={handleSkipConfirm}
      />
    </>
  );
}
