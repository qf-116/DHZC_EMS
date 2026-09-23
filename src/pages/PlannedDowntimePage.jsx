import React, { useMemo, useState, useEffect } from 'react';
import { Table, Button, Input, Space, Modal, Form, DatePicker, Select, Tag, App, Card } from 'antd';
import { Search } from 'lucide-react';
import dayjs from 'dayjs';
import { useDemoState, useDemoActions } from '../state/DemoStore.jsx';
import { selectOeeRecomputeLog, selectDowntime } from '../state/selectors.js';
import { fmtMinutes } from '../domain/downtime.js';
import PageHeader from '../components/PageHeader.jsx';
import DegradedBanner from '../components/DegradedBanner.jsx';

// 计划停机管理：统一停机事实中类别为「计划停机 / 换模」的单据。
// 口径：可用率 = 运行时间 / (负荷时间 − 计划停机时间)，本页登记直接参与 OEE 可用率分母。
// 开始<结束、与同设备未取消单据不重叠等校验由 actions/reducer（domain/downtime.validateDowntime）执行，
// 页面表单只做必填校验；每次保存/取消后触发 OEE 重算（oeeRecomputeLog 留痕）。

const PLANNED_CATEGORIES = ['计划停机', '换模'];

const statusTag = (s) => {
  const map = { 待执行: 'warning', 进行中: 'processing', 已结束: 'success', 已取消: 'default' };
  return <Tag color={map[s] || 'default'}>{s}</Tag>;
};

export default function PlannedDowntimePage() {
  const state = useDemoState();
  const actions = useDemoActions();
  const { message, modal } = App.useApp();
  const [form] = Form.useForm();
  const [kw, setKw] = useState('');
  const [status, setStatus] = useState('all');
  const [editing, setEditing] = useState(null);        // null | {} 新增 | fact 编辑
  const [canceling, setCanceling] = useState(null);    // 待执行单据取消（填原因）
  const [cancelForm] = Form.useForm();

  // actions 层不预判 reducer 校验结果，这里统一反馈失败原因（开始<结束、重叠、取消原因等）
  const lastAction = state.meta.lastAction;
  useEffect(() => {
    if (lastAction && lastAction.ok === false) message.error(lastAction.message);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastAction?.actionId]);

  // 只看计划停机 / 换模
  const rows = useMemo(() => selectDowntime(state, null).filter(f => PLANNED_CATEGORIES.includes(f.category)), [state]);

  const recomputeLogs = useMemo(() => selectOeeRecomputeLog(state).slice(0, 5), [state]);

  const filtered = useMemo(() => {
    const k = kw.trim().toLowerCase();
    return rows
      .filter(r => status === 'all' || r.status === status)
      .filter(r => !k
        || (r.deviceName || '').toLowerCase().includes(k)
        || (r.reason || '').toLowerCase().includes(k)
        || (r.downtimeId || '').toLowerCase().includes(k));
  }, [rows, kw, status]);

  const openNew = () => { setEditing({}); form.resetFields(); };
  const openEdit = (fact) => {
    setEditing(fact);
    form.setFieldsValue({
      deviceId: fact.deviceId,
      category: fact.category,
      range: [dayjs(fact.start.replace(' ', 'T')), fact.end ? dayjs(fact.end.replace(' ', 'T')) : null],
      reason: fact.reason || '',
    });
  };

  const handleSubmit = async () => {
    const v = await form.validateFields(); // 页面只做必填；开始<结束/重叠交给 actions 内校验
    const fact = {
      ...(editing?.downtimeId ? { downtimeId: editing.downtimeId } : {}),
      deviceId: v.deviceId,
      category: v.category,
      start: v.range[0].format('YYYY-MM-DD HH:mm'),
      end: v.range[1].format('YYYY-MM-DD HH:mm'),
      reason: v.reason,
      source: '人工登记',
    };
    const res = actions.saveDowntime(fact);
    if (res.ok) message.success(res.message); // 计划停机/换模保存即触发 OEE 重算
    setEditing(null);
  };

  const handleDelete = (fact) => modal.confirm({
    title: '删除待执行停机',
    content: `确定删除 ${fact.deviceName} ${fact.start} ~ ${fact.end || '--'} 的待执行停机吗？待执行单据可物理删除；已发生的停机只能取消留痕。`,
    okText: '删除', okButtonProps: { danger: true }, cancelText: '取消',
    onOk: () => {
      const res = actions.deleteDowntime(fact.downtimeId);
      if (res.ok) message.success(res.message);
    },
  });

  const handleCancel = async () => {
    const v = await cancelForm.validateFields();
    const res = actions.deleteDowntime(canceling.downtimeId, v.reason);
    // 待执行单据为物理删除（尚未影响 OEE 分母）；已发生的停机取消才触发重算
    if (res.ok) message.success(canceling.status === '待执行' ? res.message : `${res.message}；已触发 OEE 重算`);
    setCanceling(null);
  };

  return (
    <>
      <DegradedBanner meta={state.meta} />
      <PageHeader
        title="计划停机时间管理"
        subtitle="计划内停机登记（计划停机 / 换模）· OEE 可用率扣除：可用率 = 运行时间 / (负荷时间 − 计划停机时间) · 保存后已触发 OEE 重算，重算记录见下方日志"
      />
      {/* 筛选卡：查询条件独立在列表卡上方 */}
      <Card size="small" style={{ marginBottom: 12 }}>
        <Space wrap>
          <Input allowClear prefix={<Search size={13} />} placeholder="设备名称 / 停机原因 / 单号" style={{ width: 240 }} value={kw} onChange={e => setKw(e.target.value)} />
          <Select value={status} onChange={setStatus} style={{ width: 120 }} options={[{ value: 'all', label: '全部状态' }, ...['待执行', '进行中', '已结束', '已取消'].map(s => ({ value: s, label: s }))]} />
          <Button onClick={() => { setKw(''); setStatus('all'); }}>重置</Button>
        </Space>
      </Card>
      {/* 列表卡：操作工具栏 → 表格 */}
      <Card size="small">
        <Space wrap style={{ marginBottom: 12 }}>
          <Button type="primary" onClick={openNew}>添加</Button>
        </Space>
        <Table
        rowKey="downtimeId" size="small" scroll={{ x: 1050 }}
        dataSource={filtered}
        columns={[
          { title: '停机单号', dataIndex: 'downtimeId', width: 160 },
          { title: '设备', dataIndex: 'deviceName', width: 140 },
          { title: '类别', dataIndex: 'category', width: 100 },
          { title: '开始时间', dataIndex: 'start', width: 150 },
          {
            title: '结束时间', dataIndex: 'end', width: 150,
            render: v => v || '--（进行中）',
          },
          {
            title: '时长', dataIndex: 'minutes', width: 100, align: 'right',
            render: (v, r) => (r.status === '进行中' ? '进行中' : fmtMinutes(v)),
          },
          {
            title: '原因 / 取消原因', dataIndex: 'reason',
            render: (v, r) => (r.status === '已取消'
              ? <span style={{ color: '#8a97a3' }}>{v || '--'}</span>
              : v || '--'),
          },
          { title: '来源', dataIndex: 'source', width: 100 },
          { title: '状态', dataIndex: 'status', width: 90, render: v => statusTag(v) },
          {
            title: '操作', width: 180, fixed: 'right',
            render: (_, r) => {
              if (r.status === '待执行') {
                return (
                  <Space size={10}>
                    <a onClick={() => openEdit(r)}>编辑</a>
                    <a style={{ color: '#dc2626' }} onClick={() => handleDelete(r)}>删除</a>
                    <a onClick={() => { setCanceling(r); cancelForm.resetFields(); }}>取消</a>
                  </Space>
                );
              }
              // 进行中 / 已结束：只读；已取消：原因已在列内展示
              return <span style={{ color: '#8a97a3' }}>只读</span>;
            },
          },
        ]}
      />
      </Card>

      <Card size="small" title="最近 OEE 重算记录（保存 / 取消计划停机后自动追加）" style={{ marginTop: 12 }}>
        {recomputeLogs.length ? (
          <Table
            rowKey="recomputeId" size="small" pagination={false}
            dataSource={recomputeLogs}
            columns={[
              { title: '重算单号', dataIndex: 'recomputeId', width: 180 },
              { title: '设备', dataIndex: 'deviceId', width: 100 },
              { title: '范围', dataIndex: 'range', width: 160 },
              { title: '原因', dataIndex: 'reason' },
              { title: '时间', dataIndex: 'at', width: 170 },
            ]}
          />
        ) : (
          <span style={{ color: '#8a97a3' }}>尚无重算记录</span>
        )}
      </Card>

      <Modal
        title={editing?.downtimeId ? '编辑计划停机' : '添加计划停机'}
        open={!!editing}
        onOk={handleSubmit}
        onCancel={() => setEditing(null)}
        destroyOnHidden
      >
        <Form form={form} layout="vertical">
          <Form.Item name="deviceId" label="设备" rules={[{ required: true, message: '请选择设备' }]}>
            <Select
              placeholder="请选择设备"
              showSearch optionFilterProp="label"
              options={Object.values(state.entities.devicesById).map(d => ({ value: d.deviceId, label: `${d.name}（${d.deviceId}）` }))}
            />
          </Form.Item>
          <Form.Item name="category" label="停机类别" rules={[{ required: true, message: '请选择停机类别' }]}>
            <Select placeholder="计划停机 / 换模" options={PLANNED_CATEGORIES.map(c => ({ value: c, label: c }))} />
          </Form.Item>
          <Form.Item
            name="range" label="起止时间"
            rules={[{ required: true, message: '请选择开始与结束时间' }]}
            extra="开始时间必须早于结束时间；保存时校验与该设备未取消单据不重叠（校验由系统执行）"
          >
            <DatePicker.RangePicker
              showTime={{ format: 'HH:mm' }}
              format="YYYY-MM-DD HH:mm"
              minuteStep={5}
              style={{ width: '100%' }}
            />
          </Form.Item>
          <Form.Item name="reason" label="停机原因" rules={[{ required: true, message: '请输入停机原因' }]}>
            <Input.TextArea rows={2} placeholder="如：月度计划保养 / 换模换线 / 计划检修" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={`取消待执行停机（${canceling?.downtimeId || ''}）`}
        open={!!canceling}
        onOk={handleCancel}
        onCancel={() => setCanceling(null)}
        destroyOnHidden
      >
        <Form form={cancelForm} layout="vertical">
          <Form.Item
            name="reason" label="取消原因（留痕）"
            rules={[{ required: true, message: '取消必须填写原因' }]}
            extra="待执行单据取消后按登记原因处理并记录；已发生的停机（进行中/已结束）不可删除"
          >
            <Input.TextArea rows={2} placeholder="请填写取消原因" />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
