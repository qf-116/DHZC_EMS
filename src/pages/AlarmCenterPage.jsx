// ============================================================
// 报警中心（三态状态机，2026-11-04 简化）：已触发 → 处理中 → 已关闭
// —— 数据：useDemoState().entities.alarmEventsById + selectActiveAlarms（活动口径）
// —— 动作：useDemoActions()（确认 / 处置登记与更新二合一 / 转维修，幂等由动作层与 reducer 保证）
// —— 操作矩阵：
//    已触发 → [确认][详情]；处理中 → [处置（预填更新）][转维修][详情]；已关闭 → [详情]
// —— 恢复口径：自动恢复（处置时填恢复说明后关闭）/ 业务闭环（维修验收、备件入库联动关闭）/
//    人工处置关闭（处置提交即关闭，受关闭前置校验约束）
// ============================================================

import React, { useMemo, useState } from 'react';
import { App, Button, Card, DatePicker, Input, Modal, Select, Space, Statistic, Switch, Table, Tag, Timeline, Tooltip } from 'antd';
import dayjs from 'dayjs';
import { CheckCircle2, FilePlus2, MoreHorizontal } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../components/PageHeader.jsx';
import StatusTag from '../components/StatusTag.jsx';
import EmptyState from '../components/EmptyState.jsx';
import DegradedBanner from '../components/DegradedBanner.jsx';
import { useDemoState, useDemoActions } from '../state/DemoStore.jsx';
import { selectActiveAlarms, selectDevice, selectNotificationDeliveries } from '../state/selectors.js';
import { FAULT_TYPES } from '../domain/repair.js';
import FilterBar, { FilterField } from '../components/FilterBar.jsx';
import { users } from '../data/demo/masterData.js';

// 转维修「立即派工」候选：与待维修看板派工弹窗同一份维修人员 / 班组口径
const REPAIR_STAFF = users.filter(u => u.status === '在职' && (u.role === '维修工程师' || u.role === '设备负责人' || u.role === '点检员' || u.role === '巡检员' || u.role === '备件管理员')).map(u => u.name);
const DISPATCH_GROUPS = ['机修班', '电气班', '工艺班'].map(v => ({ value: v, label: v }));

const SEVERITY_COLOR = { 紧急: 'error', 重要: 'warning', 一般: 'gold', 提示: 'default' };
const TIMELINE_COLOR = { 触发: 'red', 重复触发: 'red', 通知: 'blue', 确认: 'green', 处置: 'blue', 更新处置: 'cyan', 转维修: 'purple', 恢复: 'green', 关闭: 'gray', 重开关联: 'orange' };
const DELIVERY_COLOR = { 送达: 'success', 失败: 'error', 升级: 'orange', 重试中: 'processing' };

export default function AlarmCenterPage() {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const state = useDemoState();
  const actions = useDemoActions();

  // ---------- UI 局部状态（仅筛选 / 弹窗 / 表单文本） ----------
  const [statusFilter, setStatusFilter] = useState('active');
  const [severityFilter, setSeverityFilter] = useState('all');
  const [recoveryFilter, setRecoveryFilter] = useState('all');
  const [keyword, setKeyword] = useState('');
  const [selectedKeys, setSelectedKeys] = useState([]);
  const [ackRows, setAckRows] = useState([]);      // 确认目标（支持批量）
  const [handleRow, setHandleRow] = useState(null); // 处置目标（登记 / 更新二合一，弹窗预填）
  // 转维修弹窗：故障类型 + 可选「立即派工」（方案 A：明确派谁时一步到位，跳过待派工队列）
  const [toRepairRow, setToRepairRow] = useState(null);
  const [toRepairFaultType, setToRepairFaultType] = useState('其他');
  const [toRepairDispatch, setToRepairDispatch] = useState(false);
  const [toRepairAssignee, setToRepairAssignee] = useState(null);
  const [toRepairGroup, setToRepairGroup] = useState(null);
  const [ackNote, setAckNote] = useState('');
  const [handleMeasure, setHandleMeasure] = useState('');
  const [handleExpectedAt, setHandleExpectedAt] = useState(null); // dayjs 对象，提交时格式化
  const [recoverNote, setRecoverNote] = useState('');             // 处置弹窗内的恢复说明（选填）
  const [detailId, setDetailId] = useState(null);   // 详情（按 id 读最新事实）

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

  // ---------- 动作接线（提示动作层返回的 message；页面不重复状态校验） ----------
  const submitAck = () => {
    const results = ackRows.map(r => actions.ackAlarm(r.id, { note: ackNote }));
    const failed = results.find(x => !x.ok);
    if (failed) { message.error(failed.message); return; }
    message.success(results.length > 1 ? `已批量确认 ${results.length} 条报警，均进入处理中` : results[0].message);
    setAckRows([]); setAckNote('');
  };

  // 处置提交：登记 / 更新二合一；填写恢复说明或恢复口径为「人工处置关闭」时提交即关闭
  const submitHandle = () => {
    const expectedAt = handleExpectedAt ? handleExpectedAt.format('YYYY-MM-DD HH:mm') : '';
    if (!expectedAt) { message.warning('请选择预计完成时间'); return; }
    const res = actions.handleAlarm(handleRow.id, { measure: handleMeasure, expectedAt, recoveryNote: recoverNote.trim() || undefined });
    if (!res.ok) { message.error(res.message); return; }
    // 关闭被前置校验阻塞时以 warning 提示阻塞原因，其余成功结果正常提示
    if (res.refs?.closed) message.success(res.message);
    else if ((res.refs?.blockers || []).length) message.warning(res.message, 5);
    else message.success(res.message);
    setHandleRow(null); setHandleMeasure(''); setHandleExpectedAt(null); setRecoverNote('');
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

  const batchAck = () => {
    const targets = allAlarms.filter(r => selectedKeys.includes(r.id) && r.status === '已触发');
    if (!targets.length) { message.warning('请先勾选「已触发」状态的报警再批量确认'); return; }
    setAckNote(''); setAckRows(targets);
  };

  const openHandle = (row) => {
    setHandleMeasure(row.handleMeasure || '');
    setHandleExpectedAt(row.expectedAt ? dayjs(row.expectedAt) : null);
    setRecoverNote('');
    setHandleRow(row);
  };

  const recoveryTag = {
    自动恢复: <Tag color="success">自动恢复</Tag>,
    业务闭环: <Tag color="processing">业务闭环</Tag>,
    人工处置关闭: <Tag color="warning">人工处置关闭</Tag>,
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
      return <Tooltip title={`触发规则 ${v}${ruleName ? ` · ${ruleName}` : ''}`}>{v}</Tooltip>;
    } },
    { title: '级别', dataIndex: 'severity', width: 75, render: v => <Tag color={SEVERITY_COLOR[v] || 'default'}>{v || '--'}</Tag> },
    { title: '触发值', dataIndex: 'trigger', width: 120, render: v => v || '--' },
    { title: '阈值（规则）', dataIndex: 'threshold', width: 150, render: v => v || '--' },
    { title: '状态', dataIndex: 'status', width: 90, render: v => <StatusTag value={v} /> },
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
    { title: '恢复口径', dataIndex: 'recovery', width: 120, render: v => recoveryTag[v] || '--' },
    { title: '恢复情况', dataIndex: 'recovered', width: 140, render: (v, r) => v || (r.status !== '已关闭' ? '待恢复' : '--') },
    { title: '通知', dataIndex: 'notify', width: 80, render: (v, r) => <Tooltip title={`通知策略 ${r.policy || '--'}`}><Tag color={v === '成功' ? 'success' : 'default'}>{v || '--'}</Tag></Tooltip> },
    { title: '处理人', dataIndex: 'handler', width: 80, render: v => v || '--' },
    { title: '关联维修单', dataIndex: 'relatedRepairOrderId', width: 150, render: v => (v
      ? <Tooltip title="派工 / 改派在「维修任务」页面进行"><a onClick={() => navigate('/repair-orders')}>{v}</a></Tooltip>
      : '--') },
    { title: '操作', fixed: 'right', width: 220, render: (_, r) => {
      const buttons = [];
      if (r.status === '已触发') {
        buttons.push(<Button key="ack" size="small" icon={<CheckCircle2 size={12} />} onClick={() => { setAckNote(''); setAckRows([r]); }}>确认</Button>);
      } else if (r.status === '处理中') {
        buttons.push(<Button key="handle" size="small" icon={<MoreHorizontal size={12} />} onClick={() => openHandle(r)}>处置</Button>);
        if (!r.relatedRepairOrderId) {
          buttons.push(<Tooltip key="repair" title="生成唯一维修主工单，可立即派工">
            <Button size="small" icon={<FilePlus2 size={12} />} onClick={() => {
              setToRepairFaultType('其他'); setToRepairDispatch(false); setToRepairAssignee(null); setToRepairGroup(null);
              setToRepairRow(r);
            }}>转维修</Button>
          </Tooltip>);
        }
      } // 已关闭：只读，无操作按钮
      buttons.push(<Button key="detail" size="small" onClick={() => setDetailId(r.id)}>详情</Button>);
      return <div className="list-actions">{buttons}</div>;
    } },
  ];

  // 详情弹窗按 id 读最新事实
  const detailAlarm = detailId ? state.entities.alarmEventsById[detailId] : null;

  return (
    <>
      <PageHeader title="报警中心" />
      <DegradedBanner meta={state.meta} />
      {/* 筛选卡：查询条件独立在列表卡上方 */}
      <FilterBar onQuery={() => {}} onReset={() => { setStatusFilter('active'); setRecoveryFilter('all'); setSeverityFilter('all'); setKeyword(''); }}>
        <FilterField label="状态">
          <Select value={statusFilter} onChange={setStatusFilter} style={{ width: 180 }} options={[
            { value: 'active', label: '活动报警（未关闭）' }, { value: 'all', label: '全部状态' },
            ...['已触发', '处理中', '已关闭'].map(v => ({ value: v, label: v })),
          ]} />
        </FilterField>
        <FilterField label="恢复口径">
          <Select value={recoveryFilter} onChange={setRecoveryFilter} style={{ width: 150 }} options={[
            { value: 'all', label: '全部恢复口径' },
            ...['自动恢复', '业务闭环', '人工处置关闭'].map(v => ({ value: v, label: v })),
          ]} />
        </FilterField>
        <FilterField label="等级">
          <Select value={severityFilter} onChange={setSeverityFilter} style={{ width: 120 }} options={[
            { value: 'all', label: '全部等级' },
            ...['紧急', '重要', '一般', '提示'].map(v => ({ value: v, label: v })),
          ]} />
        </FilterField>
        <FilterField label="关键词">
          <Input allowClear placeholder="设备 / 报警 / 编号 / 规则" style={{ width: 220 }} value={keyword} onChange={e => setKeyword(e.target.value)} />
        </FilterField>
      </FilterBar>
      {/* 列表卡：操作工具栏（需勾选的批量操作默认禁用）→ 表格 */}
      <Card size="small">
        <Space wrap style={{ marginBottom: 12 }}>
          <Tooltip title={selectedKeys.length ? `批量确认已勾选的 ${selectedKeys.length} 条已触发报警` : '请先勾选要批量确认的报警（仅已触发可确认）'}>
            <Button onClick={batchAck} disabled={!selectedKeys.length}>批量确认</Button>
          </Tooltip>
        </Space>
        <Table
          rowKey="id"
          size="small"
          scroll={{ x: 2000 }}
          dataSource={filtered}
          columns={columns}
          rowSelection={{ selectedRowKeys: selectedKeys, onChange: setSelectedKeys, columnWidth: 40 }}
          locale={{ emptyText: <EmptyState description="没有符合条件的报警" reason="筛选条件下暂无匹配事件，可切换到「全部状态」查看已关闭事件" /> }}
          pagination={{ pageSize: 10, showTotal: t => `共 ${t} 条` }}
        />
      </Card>

      {/* 确认弹窗（单个 / 批量共用，备注必填；确认后进入处理中） */}
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
        <div style={{ fontSize: 12, color: '#8a97a3', marginBottom: 8 }}>确认人：当前登录人，确认后进入「处理中」</div>
        <Input.TextArea rows={3} placeholder="确认说明（必填），如：已到现场查看，主轴温度持续上升，安排停机检查。" value={ackNote} onChange={e => setAckNote(e.target.value)} />
      </Modal>

      {/* 处置弹窗：登记 / 更新二合一（预填上次内容）；恢复口径为「人工处置关闭」或填写恢复说明时提交即关闭 */}
      <Modal
        title={`处置报警（${handleRow?.id || ''}）`}
        width={560}
        open={!!handleRow}
        onOk={submitHandle}
        onCancel={() => setHandleRow(null)}
        okText="提交处置" cancelText="取消"
      >
        {handleRow && (
          <div style={{ fontSize: 12, color: '#8a97a3', marginBottom: 8 }}>
            恢复口径：<b>{handleRow.recovery || '--'}</b>
            {handleRow.recovery === '人工处置关闭' ? '，提交处置后本条报警即关闭' : '；填写恢复说明后提交即关闭'}
            {handleRow.handleMeasure ? '；已登记过处置，本次提交为更新' : ''}
          </div>
        )}
        <Space direction="vertical" style={{ width: '100%' }} size={10}>
          <Input.TextArea rows={3} placeholder="处置措施（必填），如：已更换冷却液并清洗管路，持续观察温度回落。" value={handleMeasure} onChange={e => setHandleMeasure(e.target.value)} />
          <DatePicker showTime style={{ width: '100%' }} placeholder="请选择预计完成时间" value={handleExpectedAt} onChange={v => setHandleExpectedAt(v)} />
          <Input.TextArea rows={2} placeholder="恢复说明（选填），如：主轴温度回落至 72℃，持续 30s 满足恢复条件。填写后提交即关闭本条报警。" value={recoverNote} onChange={e => setRecoverNote(e.target.value)} />
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
            将生成唯一维修主工单并回写本报警
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
              勾选后生成「已派工」工单；不勾选进入待派工。
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
                  ['触发规则', `${detailAlarm.rule || '--'} · ${detailAlarm.ruleVersion || '--'}`],
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
                  ['预计完成时间', detailAlarm.expectedAt || '--'],
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
