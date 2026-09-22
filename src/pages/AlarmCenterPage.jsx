// ============================================================
// 报警中心（§6.4）：全生命周期由 DemoStore 报警域驱动。
// —— 数据：useDemoState().entities.alarmEventsById + selectActiveAlarms（活动口径）
// —— 动作：useDemoActions()（确认/处置/转维修/关闭，幂等由动作层与 reducer 保证，
//    页面不重复写状态校验，失败直接提示返回的 message）
// —— 登记恢复：reducer 的 alarm/recover（验收联动内部动作，reducer 注明
//    可由页面在指标恢复后调用），经 useDemoStore().dispatch 触发
// —— 状态机按钮口径（ALARM_TRANSITIONS）：
//    已触发→[确认][处置]；已确认→[处置]；处理中→[登记恢复]；
//    已恢复待关闭→[关闭]（关闭原因必填）；已关闭只读
// ============================================================

import React, { useMemo, useState } from 'react';
import { App, Button, Card, DatePicker, Input, Modal, Select, Space, Statistic, Switch, Table, Tag, Timeline, Tooltip } from 'antd';
import dayjs from 'dayjs';
import { CheckCircle2, FilePlus2, MoreHorizontal, RotateCcw, XCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../components/PageHeader.jsx';
import StatusTag from '../components/StatusTag.jsx';
import EmptyState from '../components/EmptyState.jsx';
import DegradedBanner from '../components/DegradedBanner.jsx';
import { useDemoStore, useDemoState, useDemoActions } from '../state/DemoStore.jsx';
import { selectActiveAlarms, selectDevice, selectNotificationDeliveries } from '../state/selectors.js';
import { FAULT_TYPES } from '../domain/repair.js';
import { users } from '../data/demo/masterData.js';

// 转维修「立即派工」候选：与待维修看板派工弹窗同一份维修人员 / 班组口径
const REPAIR_STAFF = users.filter(u => u.status === '在职' && (u.role === '维修工程师' || u.role === '设备负责人' || u.role === '点检员' || u.role === '巡检员' || u.role === '备件管理员')).map(u => u.name);
const DISPATCH_GROUPS = ['机修班', '电气班', '工艺班'].map(v => ({ value: v, label: v }));

const SEVERITY_COLOR = { 紧急: 'error', 重要: 'warning', 一般: 'gold', 提示: 'default' };
const TIMELINE_COLOR = { 触发: 'red', 重复触发: 'red', 通知: 'blue', 确认: 'green', 处置: 'blue', 转维修: 'purple', 恢复: 'green', 关闭: 'gray', 重开关联: 'orange' };
const DELIVERY_COLOR = { 送达: 'success', 失败: 'error', 升级: 'orange', 重试中: 'processing' };

export default function AlarmCenterPage() {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const state = useDemoState();
  const actions = useDemoActions();
  const { dispatch } = useDemoStore();

  // ---------- UI 局部状态（仅筛选 / 弹窗 / 表单文本） ----------
  const [statusFilter, setStatusFilter] = useState('active');
  const [severityFilter, setSeverityFilter] = useState('all');
  const [recoveryFilter, setRecoveryFilter] = useState('all');
  const [keyword, setKeyword] = useState('');
  const [selectedKeys, setSelectedKeys] = useState([]);
  const [ackRows, setAckRows] = useState([]);      // 确认目标（支持批量）
  const [handleRow, setHandleRow] = useState(null); // 处置目标
  const [closeRow, setCloseRow] = useState(null);   // 关闭目标
  const [recoverRow, setRecoverRow] = useState(null); // 登记恢复目标
  const [detailId, setDetailId] = useState(null);   // 详情（按 id 读最新事实）
  // 转维修弹窗：故障类型 + 可选「立即派工」（方案 A：明确派谁时一步到位，跳过待派工队列）
  const [toRepairRow, setToRepairRow] = useState(null);
  const [toRepairFaultType, setToRepairFaultType] = useState('其他');
  const [toRepairDispatch, setToRepairDispatch] = useState(false);
  const [toRepairAssignee, setToRepairAssignee] = useState(null);
  const [toRepairGroup, setToRepairGroup] = useState(null);
  const [ackNote, setAckNote] = useState('');
  const [handleMeasure, setHandleMeasure] = useState('');
  const [handleExpectedAt, setHandleExpectedAt] = useState(null); // dayjs 对象，提交时格式化
  const [closeEvidence, setCloseEvidence] = useState('');
  const [closeReason, setCloseReason] = useState('');
  const [recoverEvidence, setRecoverEvidence] = useState('');

  // ---------- 读模型 ----------
  const allAlarms = Object.values(state.entities.alarmEventsById);
  const activeIds = useMemo(() => new Set(selectActiveAlarms(state).map(a => a.id)), [state]);

  // 去重合并：同一 dedupeKey 只展示一行，重复触发计数合并展示
  const rows = useMemo(() => {
    const sorted = [...allAlarms].sort((a, b) => (a.time < b.time ? 1 : -1));
    const byKey = {};
    const merged = [];
    sorted.forEach(a => {
      // 只合并未关闭事件；关闭后同一去重键再次触发生成新事件实例，历史不得吞掉新事件。
      if (!activeIds.has(a.id)) { merged.push({ ...a, extra: 0 }); return; }
      const key = a.dedupeKey || a.id;
      if (byKey[key]) { byKey[key].extra += 1; return; }
      const row = { ...a, extra: 0 };
      byKey[key] = row;
      merged.push(row);
    });
    return merged;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const filtered = rows.filter(r => {
    if (statusFilter === 'active' && !activeIds.has(r.id)) return false;
    if (!['all', 'active'].includes(statusFilter) && r.status !== statusFilter) return false;
    if (severityFilter !== 'all' && r.severity !== severityFilter) return false;
    if (recoveryFilter !== 'all' && r.recovery !== recoveryFilter) return false;
    if (keyword && ![r.id, r.deviceName, r.name, r.rule].some(v => (v || '').includes(keyword))) return false;
    return true;
  });

  const detailAlarm = detailId ? state.entities.alarmEventsById[detailId] : null;

  const counts = {
    active: activeIds.size,
    unacked: allAlarms.filter(a => a.status === '已触发').length,
    handling: allAlarms.filter(a => ['已确认', '处理中'].includes(a.status)).length,
    pendingClose: allAlarms.filter(a => a.status === '已恢复待关闭').length,
  };

  // ---------- 动作接线（提示动作层返回的 message；页面不重复状态校验） ----------
  const submitAck = () => {
    const results = ackRows.map(r => actions.ackAlarm(r.id, { note: ackNote }));
    const failed = results.find(x => !x.ok);
    if (failed) { message.error(failed.message); return; }
    message.success(results.length > 1 ? `已批量确认 ${results.length} 条报警` : results[0].message);
    setAckRows([]); setAckNote('');
  };

  const submitHandle = () => {
    const expectedAt = handleExpectedAt ? handleExpectedAt.format('YYYY-MM-DD HH:mm') : '';
    if (!expectedAt) { message.warning('请选择预计恢复时间'); return; }
    const res = actions.handleAlarm(handleRow.id, { measure: handleMeasure, expectedAt });
    if (!res.ok) { message.error(res.message); return; }
    message.success(res.message);
    setHandleRow(null); setHandleMeasure(''); setHandleExpectedAt(null);
  };

  // 转维修提交：直接派工时必选维修人；不派工则生成待派工工单进入待维修看板统一排程
  const submitToRepair = () => {
    if (toRepairDispatch && !toRepairAssignee) { message.warning('已开启立即派工，请选择维修人（或关闭直接派工，工单进入待维修看板统一派工）'); return; }
    const res = actions.createRepairFromAlarm(toRepairRow.id, {
      faultType: toRepairFaultType,
      dispatch: toRepairDispatch ? { assignee: toRepairAssignee, assigneeGroup: toRepairGroup } : undefined,
    });
    if (!res.ok) { message.error(res.message); return; }
    message.success(res.message);
    setToRepairRow(null);
  };

  const submitClose = () => {
    const res = actions.closeAlarm(closeRow.id, { evidence: closeEvidence, closeReason });
    if (!res.ok) { message.error(res.message); return; }
    message.success(res.message);
    setCloseRow(null); setCloseEvidence(''); setCloseReason('');
  };

  // 登记恢复：dispatch alarm/recover（自动恢复类规则恢复后由 reducer 自动关闭）
  const submitRecover = () => {
    if (!(recoverEvidence || '').trim()) { message.warning('请填写恢复证据（如指标回落值/恢复时间）'); return; }
    dispatch({ type: 'alarm/recover', payload: { alarmId: recoverRow.id, evidence: recoverEvidence.trim() } });
    message.success(recoverRow.recovery === '自动恢复'
      ? `已登记恢复 ${recoverRow.id}：自动恢复类规则已按业务关联状态进入后续流程`
      : `已登记恢复 ${recoverRow.id}：状态进入「已恢复待关闭」，请填写恢复证据与关闭原因后关闭`);
    setRecoverRow(null); setRecoverEvidence('');
  };

  const batchAck = () => {
    const targets = allAlarms.filter(r => selectedKeys.includes(r.id) && r.status === '已触发');
    if (!targets.length) { message.warning('请先勾选「已触发」状态的报警再批量确认'); return; }
    setAckNote(''); setAckRows(targets);
  };

  const openWith = (setter, row) => {
    setAckNote(''); setHandleMeasure(''); setHandleExpectedAt(''); setCloseEvidence(''); setCloseReason(''); setRecoverEvidence('');
    setter(row);
  };

  const recoveryTag = {
    自动恢复: <Tag color="success">自动恢复</Tag>,
    业务闭环: <Tag color="processing">业务闭环</Tag>,
    人工确认关闭: <Tag color="warning">人工确认关闭</Tag>,
  };

  const columns = [
    { title: '报警编号', dataIndex: 'id', fixed: 'left', width: 160 },
    { title: '设备', dataIndex: 'deviceId', width: 150, render: (v, r) => {
      const device = selectDevice(state, r.deviceId);
      if (!device) return r.deviceName || '--';
      return <Tooltip title={`资产编号 ${device.assetCode || '--'} · 监测点 ${device.monitorCode || '--'}`}>{device.name || '--'}</Tooltip>;
    } },
    { title: '报警名称', dataIndex: 'name', width: 170 },
    { title: '规则', dataIndex: 'rule', width: 120, render: (v, r) => {
      const ruleName = state.entities.alarmRulesById[v]?.name;
      return <Tooltip title={`触发规则 ${v}${ruleName ? ` · ${ruleName}` : ''} · 版本 ${r.ruleVersion || '--'} · 绑定 v${r.bindingVersion ?? '--'}`}>{v}</Tooltip>;
    } },
    { title: '级别', dataIndex: 'severity', width: 75, render: v => <Tag color={SEVERITY_COLOR[v] || 'default'}>{v || '--'}</Tag> },
    { title: '触发值', dataIndex: 'trigger', width: 120, render: v => v || '--' },
    { title: '阈值（规则）', dataIndex: 'threshold', width: 150, render: v => v || '--' },
    { title: '状态', dataIndex: 'status', width: 115, render: v => <StatusTag value={v} /> },
    { title: '触发时间', dataIndex: 'time', width: 90, render: v => v || '--' },
    { title: '持续时长', dataIndex: 'duration', width: 90, render: v => v || '--' },
    { title: '重复触发', key: 'repeat', width: 85, render: (_, r) => {
      const n = (r.repeat || 0) + (r.extra || 0);
      return (
        <Tooltip title={`去重键 ${r.dedupeKey || '--'} · 同键活动事件合并计数${r.extra ? `（另有 ${r.extra} 条同键事件）` : ''} · 重复触发 ${n} 次`}>
          <span style={{ color: n > 0 ? '#d4380d' : undefined, fontWeight: n > 0 ? 600 : undefined }}>{n}</span>
        </Tooltip>
      );
    } },
    { title: '恢复口径', dataIndex: 'recovery', width: 115, render: v => recoveryTag[v] || '--' },
    { title: '恢复情况', dataIndex: 'recovered', width: 140, render: (v, r) => v || (r.status !== '已关闭' && r.recovery !== '人工确认关闭' ? '待恢复' : '--') },
    { title: '通知', dataIndex: 'notify', width: 80, render: (v, r) => <Tooltip title={`通知策略 ${r.policy || '--'}`}><Tag color={v === '成功' ? 'success' : 'default'}>{v || '--'}</Tag></Tooltip> },
    { title: '处理人', dataIndex: 'handler', width: 80, render: v => v || '--' },
    { title: '关联维修单', dataIndex: 'relatedRepairOrderId', width: 150, render: v => (v
      ? <Tooltip title="已生成唯一主工单；派工 / 改派在「维修任务」页面进行"><a onClick={() => navigate('/repair-orders')}>{v}</a></Tooltip>
      : '--') },
    { title: '操作', fixed: 'right', width: 290, render: (_, r) => {
      const buttons = [];
      if (r.status === '已触发') {
        buttons.push(<Button key="ack" size="small" icon={<CheckCircle2 size={12} />} onClick={() => openWith(setAckRows, [r])}>确认</Button>);
        buttons.push(<Button key="handle" size="small" icon={<MoreHorizontal size={12} />} onClick={() => openWith(setHandleRow, r)}>处置</Button>);
      } else if (r.status === '已确认') {
        buttons.push(<Button key="handle" size="small" icon={<MoreHorizontal size={12} />} onClick={() => openWith(setHandleRow, r)}>处置</Button>);
      } else if (r.status === '处理中') {
        buttons.push(<Button key="recover" size="small" icon={<RotateCcw size={12} />} onClick={() => openWith(setRecoverRow, r)}>登记恢复</Button>);
      } else if (r.status === '已恢复待关闭') {
        buttons.push(<Button key="close" size="small" danger icon={<XCircle size={12} />} onClick={() => openWith(setCloseRow, r)}>关闭</Button>);
      } // 已关闭：只读，无操作按钮
      if (r.status !== '已关闭' && !r.relatedRepairOrderId) {
        buttons.push(<Tooltip key="repair" title="生成唯一维修主工单（重复点击幂等，不重复建单）；可顺手立即派工">
          <Button size="small" icon={<FilePlus2 size={12} />} onClick={() => {
            setToRepairFaultType('其他'); setToRepairDispatch(false); setToRepairAssignee(null); setToRepairGroup(null);
            setToRepairRow(r);
          }}>转维修</Button>
        </Tooltip>);
      }
      buttons.push(<Button key="detail" size="small" onClick={() => setDetailId(r.id)}>详情</Button>);
      return <div className="list-actions">{buttons}</div>;
    } },
  ];

  return (
    <>
      <PageHeader
        title="报警中心"
        subtitle={`活动 ${counts.active} 条 · 待确认 ${counts.unacked} · 确认/处理中 ${counts.handling} · 恢复待关闭 ${counts.pendingClose} · 状态机：已触发→已确认→处理中→已恢复待关闭→已关闭`}
      />
      <DegradedBanner meta={state.meta} />
      <Card size="small">
        <Space wrap style={{ marginBottom: 12 }}>
          <Select value={statusFilter} onChange={setStatusFilter} style={{ width: 140 }} options={[
            { value: 'active', label: '活动报警（未关闭）' }, { value: 'all', label: '全部状态' },
            ...['已触发', '已确认', '处理中', '已恢复待关闭', '已关闭'].map(v => ({ value: v, label: v })),
          ]} />
          <Select value={recoveryFilter} onChange={setRecoveryFilter} style={{ width: 130 }} options={[
            { value: 'all', label: '全部恢复口径' },
            ...['自动恢复', '业务闭环', '人工确认关闭'].map(v => ({ value: v, label: v })),
          ]} />
          <Select value={severityFilter} onChange={setSeverityFilter} style={{ width: 110 }} options={[
            { value: 'all', label: '全部等级' },
            ...['紧急', '重要', '一般', '提示'].map(v => ({ value: v, label: v })),
          ]} />
          <Input allowClear placeholder="设备 / 报警 / 编号 / 规则" style={{ width: 220 }} value={keyword} onChange={e => setKeyword(e.target.value)} />
          <Button onClick={batchAck}>批量确认</Button>
        </Space>
        <Table
          rowKey="id"
          size="small"
          scroll={{ x: 2120 }}
          dataSource={filtered}
          columns={columns}
          rowSelection={{ selectedRowKeys: selectedKeys, onChange: setSelectedKeys, columnWidth: 40 }}
          locale={{ emptyText: <EmptyState description="没有符合条件的报警" reason="筛选条件下暂无匹配事件，可切换到「全部状态」查看已关闭事件" /> }}
          pagination={{ pageSize: 10, showTotal: t => `共 ${t} 条` }}
        />
      </Card>

      {/* 确认弹窗（单个 / 批量共用，备注必填） */}
      <Modal
        title={ackRows.length > 1 ? `批量确认报警（${ackRows.length} 条）` : `确认报警（${ackRows[0]?.id || ''}）`}
        width={560}
        open={ackRows.length > 0}
        onOk={submitAck}
        onCancel={() => setAckRows([])}
        okText="确认" cancelText="取消"
      >
        {ackRows.length === 1 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, marginBottom: 12 }}>
            <Statistic title="报警名称" value={ackRows[0].name} valueStyle={{ fontSize: 14 }} />
            <Statistic title="设备" value={ackRows[0].deviceName || '--'} valueStyle={{ fontSize: 14 }} />
            <Statistic title="触发值 / 阈值" value={`${ackRows[0].trigger || '--'}（${ackRows[0].threshold || '--'}）`} valueStyle={{ fontSize: 14 }} />
            <Statistic title="持续 / 重复" value={`${ackRows[0].duration || '--'} · 重复 ${ackRows[0].repeat || 0} 次`} valueStyle={{ fontSize: 14 }} />
          </div>
        )}
        <div style={{ fontSize: 12, color: '#8a97a3', marginBottom: 8 }}>确认人：当前登录人 · 确认后报警进入处理流程；重复确认会被动作层幂等拦截，不产生重复履历。</div>
        <Input.TextArea rows={3} placeholder="确认说明（必填），如：已到现场查看，主轴温度持续上升，安排停机检查。" value={ackNote} onChange={e => setAckNote(e.target.value)} />
      </Modal>

      {/* 处置弹窗（措施 + 预计恢复时间必填） */}
      <Modal
        title={`处置报警（${handleRow?.id || ''}）`}
        width={560}
        open={!!handleRow}
        onOk={submitHandle}
        onCancel={() => setHandleRow(null)}
        okText="提交处置" cancelText="取消"
      >
        <Space direction="vertical" style={{ width: '100%' }} size={10}>
          <div style={{ fontSize: 12, color: '#8a97a3' }}>
            处置提交后报警进入「处理中」；如需维修请使用列表中的「转维修」生成唯一主工单（已关联工单的报警显示跳转链接），
            派工与改派统一在「维修任务」页面进行。
          </div>
          <Input.TextArea rows={3} placeholder="处置措施（必填），如：已更换冷却液并清洗管路，持续观察温度回落。" value={handleMeasure} onChange={e => setHandleMeasure(e.target.value)} />
          <DatePicker showTime style={{ width: '100%' }} placeholder="请选择预计恢复时间" value={handleExpectedAt} onChange={v => setHandleExpectedAt(v)} />
        </Space>
      </Modal>

      {/* 转维修弹窗：生成唯一主工单 + 可选「立即派工」（明确派谁时一步到位，跳过待派工队列） */}
      <Modal
        title={`转维修（${toRepairRow?.id || ''}）`}
        width={560}
        open={!!toRepairRow}
        onOk={submitToRepair}
        onCancel={() => setToRepairRow(null)}
        okText="生成维修工单" cancelText="取消"
      >
        {toRepairRow && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, marginBottom: 12 }}>
            <Statistic title="报警名称" value={toRepairRow.name} valueStyle={{ fontSize: 14 }} />
            <Statistic title="设备" value={toRepairRow.deviceName || '--'} valueStyle={{ fontSize: 14 }} />
          </div>
        )}
        <Space direction="vertical" style={{ width: '100%' }} size={10}>
          <div style={{ fontSize: 12, color: '#8a97a3' }}>
            将生成唯一维修主工单并回写至本报警（重复点击幂等，不重复建单）；工单等级按报警严重度自动映射，SLA 时限同步继承。
          </div>
          <Space wrap size={4}>
            <span style={{ fontSize: 12, color: '#5d6b78' }}>故障类型</span>
            <Select value={toRepairFaultType} onChange={setToRepairFaultType} style={{ width: 160 }}
              options={FAULT_TYPES.map(v => ({ value: v, label: v }))} />
          </Space>
          <div>
            <Space size={8}>
              <Switch size="small" checked={toRepairDispatch} onChange={setToRepairDispatch} />
              <span style={{ fontSize: 13 }}>转维修时直接派工（跳过待维修队列）</span>
            </Space>
            <div style={{ fontSize: 12, color: '#8a97a3', marginTop: 4, marginLeft: 36 }}>
              已明确维修人时勾选，一步生成「已派工」工单；不勾选则工单为「待派工」，进入待维修看板由调度统一排程派工。
            </div>
          </div>
          {toRepairDispatch && (
            <Space wrap size={4}>
              <span style={{ color: '#dc2626' }}>*</span>
              <span style={{ fontSize: 12, color: '#5d6b78' }}>维修人</span>
              <Select showSearch value={toRepairAssignee} onChange={setToRepairAssignee} style={{ width: 180 }}
                placeholder="请选择维修人" options={REPAIR_STAFF.map(v => ({ value: v, label: v }))} />
              <span style={{ fontSize: 12, color: '#5d6b78' }}>班组（选填）</span>
              <Select allowClear value={toRepairGroup} onChange={setToRepairGroup} style={{ width: 140 }}
                placeholder="请选择班组" options={DISPATCH_GROUPS} />
            </Space>
          )}
        </Space>
      </Modal>

      {/* 登记恢复弹窗（处理中 → 已恢复待关闭；自动恢复类恢复后自动关闭） */}
      <Modal
        title={`登记恢复（${recoverRow?.id || ''}）`}
        width={560}
        open={!!recoverRow}
        onOk={submitRecover}
        onCancel={() => setRecoverRow(null)}
        okText="登记恢复" cancelText="取消"
      >
        {recoverRow && (
          <div style={{ fontSize: 12, color: '#8a97a3', marginBottom: 8 }}>
            该报警恢复口径：<b>{recoverRow.recovery || '--'}</b>。
            {recoverRow.recovery === '自动恢复'
              ? (recoverRow.relatedRepairOrderId || recoverRow.relatedDowntimeId
                ? '存在关联工单或停机，恢复后进入「已恢复待关闭」；关闭仍需通过业务闭环校验。'
                : '无业务关联的自动恢复类规则登记恢复后将自动关闭。')
              : '登记恢复后进入「已恢复待关闭」，需再填写恢复证据与关闭原因完成关闭。'}
          </div>
        )}
        <Input.TextArea rows={3} placeholder="恢复证据（必填），如：主轴温度回落至 72℃，持续 30s 满足恢复条件。" value={recoverEvidence} onChange={e => setRecoverEvidence(e.target.value)} />
      </Modal>

      {/* 关闭弹窗（仅「已恢复待关闭」可关；恢复证据与关闭原因必填，人工关闭留痕用于责任认定） */}
      <Modal
        title={`关闭报警（${closeRow?.id || ''}）`}
        width={560}
        open={!!closeRow}
        onOk={submitClose}
        onCancel={() => setCloseRow(null)}
        okText="关闭" okButtonProps={{ danger: true }} cancelText="取消"
      >
        {closeRow && (
          <div style={{ fontSize: 12, color: '#8a97a3', marginBottom: 8 }}>
            该报警触发规则 <b>{closeRow.rule}</b>（恢复口径：{closeRow.recovery || '--'}）。关闭前系统将校验关闭前置条件
            （指标已恢复、关联维修工单已完成验收、关联停机已结束），不满足时拒绝关闭并提示原因。
          </div>
        )}
        <Space direction="vertical" style={{ width: '100%' }} size={10}>
          <Input.TextArea rows={2} placeholder="恢复证据（必填），如：程序比对恢复一致，持续 60s。" value={closeEvidence} onChange={e => setCloseEvidence(e.target.value)} />
          <Input.TextArea rows={3} placeholder="关闭原因（必填），如：基线已更新为 105%，比对恢复一致，经班长确认关闭。" value={closeReason} onChange={e => setCloseReason(e.target.value)} />
        </Space>
      </Modal>

      {/* 详情弹窗：基本字段 + timeline 履历 + 通知送达记录 */}
      <Modal
        title={`报警详情（${detailAlarm?.id || ''}）`}
        width={720}
        open={!!detailAlarm}
        footer={<Button type="primary" onClick={() => setDetailId(null)}>关闭</Button>}
        onCancel={() => setDetailId(null)}
      >
        {detailAlarm && (
          <>
            <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse', marginBottom: 16 }}>
              <tbody>
                {[
                  ['报警编号', detailAlarm.id],
                  ['设备', `${state.entities.devicesById[detailAlarm.deviceId]?.name || detailAlarm.deviceName || '--'}（${detailAlarm.deviceId || '--'}）`],
                  ['报警名称', detailAlarm.name || '--'],
                  ['触发规则', `${detailAlarm.rule || '--'} · ${detailAlarm.ruleVersion || '--'} · 绑定 v${detailAlarm.bindingVersion ?? '--'}`],
                  ['去重键', detailAlarm.dedupeKey || '--'],
                  ['等级 / 状态', `${detailAlarm.severity || '--'} · ${detailAlarm.status || '--'}`],
                  ['指标', detailAlarm.metric || '--'],
                  ['触发值', detailAlarm.trigger || '--'],
                  ['阈值（规则）', detailAlarm.threshold || '--'],
                  ['恢复口径', detailAlarm.recovery || '--'],
                  ['恢复情况', detailAlarm.recovered || '--'],
                  ['触发时间', detailAlarm.time || '--'],
                  ['持续时长', detailAlarm.duration || '--'],
                  ['确认时间', detailAlarm.ack || '--'],
                  ['重复触发次数', `${detailAlarm.repeat || 0} 次`],
                  ['升级次数', detailAlarm.escalation ?? '--'],
                  ['通知策略 / 结果', `${detailAlarm.policy || '--'} · ${detailAlarm.notify || '--'}`],
                  ['处理人', detailAlarm.handler || '--'],
                  ['关联维修单', detailAlarm.relatedRepairOrderId
                    ? <a onClick={() => navigate('/repair-orders')}>{detailAlarm.relatedRepairOrderId}</a>
                    : '无（使用「转维修」生成唯一主工单）'],
                ].map(([k, v]) => (
                  <tr key={k}>
                    <td style={{ padding: '6px 8px', color: '#5d6b78', width: 120, verticalAlign: 'top', borderBottom: '1px solid #eef1f4' }}>{k}</td>
                    <td style={{ padding: '6px 8px', lineHeight: 1.7, borderBottom: '1px solid #eef1f4' }}>{v}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div style={{ fontWeight: 600, marginBottom: 8 }}>履历时序（timeline）</div>
            <Timeline
              style={{ marginBottom: 16 }}
              items={(detailAlarm.timeline || []).map((t, i) => ({
                key: i,
                color: TIMELINE_COLOR[t.type] || 'gray',
                children: (
                  <div>
                    <span style={{ fontWeight: 600 }}>{t.type || '--'}</span>
                    <span style={{ color: '#8a97a3', fontSize: 12 }}> · {t.time || '--'} · {t.actor || '--'}</span>
                    <div style={{ fontSize: 12, color: '#5d6b78' }}>{t.detail || '--'}</div>
                  </div>
                ),
              }))}
            />

            <div style={{ fontWeight: 600, marginBottom: 8 }}>通知送达记录（notificationDeliveries）</div>
            <Table
              rowKey="id"
              size="small"
              pagination={false}
              dataSource={selectNotificationDeliveries(state, detailAlarm.id)}
              locale={{ emptyText: <EmptyState description="无通知送达记录" reason="该报警未命中通知策略或暂无送达记录" /> }}
              columns={[
                { title: '渠道', dataIndex: 'channel', width: 90, render: v => v || '--' },
                { title: '接收人', dataIndex: 'receiver', width: 110, render: v => v || '--' },
                { title: '状态', dataIndex: 'status', width: 80, render: v => <Tag color={DELIVERY_COLOR[v] || 'default'}>{v || '--'}</Tag> },
                { title: '发送时间', dataIndex: 'sentAt', width: 90, render: v => v || '--' },
                { title: '时延', dataIndex: 'latency', width: 70, render: v => v || '--' },
                { title: '重试', dataIndex: 'retries', width: 60 },
                { title: '备注', dataIndex: 'note', render: v => v || '--' },
              ]}
            />
          </>
        )}
      </Modal>
    </>
  );
}
