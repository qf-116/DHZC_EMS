import React, { useMemo, useState } from 'react';
import { App, Button, Card, DatePicker, Descriptions, Form, Input, InputNumber, Modal, Select, Space, Table, Tabs } from 'antd';
import { ArrowRightLeft, Archive, CirclePause, FilePlus2, ShieldCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import PageHeader from '../components/PageHeader.jsx';
import StatusTag from '../components/StatusTag.jsx';
import EmptyState from '../components/EmptyState.jsx';
import { useDemoActions, useDemoState } from '../state/DemoStore.jsx';
import { selectAllDevices, selectAssetChanges, selectIdleApplications, selectScrapApplications } from '../state/selectors.js';
import { users, workshops } from '../data/demo/masterData.js';

const CONFIG = {
  change: { title: '资产变更', icon: <ArrowRightLeft size={16} />, tabs: [{ key: 'change', label: '调拨 / 改造 / 借用 / 外送' }] },
  idle: { title: '闲置与再启用', icon: <CirclePause size={16} />, tabs: [{ key: 'idle', label: '闲置申请与复核' }] },
  scrap: { title: '报废与归档', icon: <Archive size={16} />, tabs: [{ key: 'scrap', label: '报废 / 鉴定 / 核销 / 归档' }] },
};

export default function LifecycleGovernancePage({ kind = 'change' }) {
  const state = useDemoState();
  const actions = useDemoActions();
  const navigate = useNavigate();
  const { message } = App.useApp();
  const cfg = CONFIG[kind];
  const devices = useMemo(() => selectAllDevices(state), [state]);
  const changes = useMemo(() => selectAssetChanges(state), [state]);
  const idle = useMemo(() => selectIdleApplications(state), [state]);
  const scraps = useMemo(() => selectScrapApplications(state), [state]);
  const [modalOpen, setModalOpen] = useState(false);
  const [reviewing, setReviewing] = useState(null);
  const [form] = Form.useForm();
  const [kw, setKw] = useState('');
  const [statusFilter, setStatusFilter] = useState(null);

  const closeModal = () => { setModalOpen(false); setReviewing(null); form.resetFields(); };
  const submit = async () => {
    const values = await form.validateFields();
    let result;
    if (kind === 'change') {
      result = reviewing
        ? actions.completeAssetChange(reviewing.changeId, values)
        : actions.createAssetChange({ ...values, plannedAt: values.plannedAt?.format('YYYY-MM-DD') });
    } else if (kind === 'idle') {
      result = reviewing
        ? actions.reviewIdleApplication(reviewing.idleId, values.result, values.opinion)
        : actions.createIdleApplication({ ...values, startDate: values.startDate?.format('YYYY-MM-DD'), reviewDate: values.reviewDate?.format('YYYY-MM-DD') });
    } else {
      if (reviewing?.status === '技术鉴定中') result = actions.appraiseScrap(reviewing.scrapId, values.result, values.opinion);
      else if (reviewing?.status === '待财务核销') result = actions.confirmScrapWriteOff(reviewing.scrapId, values);
      else if (reviewing?.status === '已报废') result = actions.archiveScrap(reviewing.scrapId);
      else result = actions.createScrapApplication(values);
    }
    if (!result?.ok) { message.error(result?.message || '操作失败'); return; }
    message.success(result.message);
    closeModal();
  };

  const openCreate = () => { setReviewing(null); form.resetFields(); setModalOpen(true); };
  const openAction = (record) => {
    setReviewing(record);
    form.resetFields();
    if (kind === 'change' && record.status === '审批通过') {
      form.setFieldsValue({ actualAt: dayjs() });
    }
    setModalOpen(true);
  };

  const deviceName = (deviceId) => devices.find(d => d.deviceId === deviceId)?.name || deviceId || '--';

  const kindRows = kind === 'change' ? changes : kind === 'idle' ? idle : scraps;
  const statusOptions = useMemo(
    () => [...new Set(kindRows.map((r) => r.status).filter(Boolean))].map((v) => ({ value: v, label: v })),
    [kindRows],
  );
  const filtered = useMemo(() => {
    const k = kw.trim().toLowerCase();
    return kindRows
      .filter((r) => !k || [r.changeNo, r.idleNo, r.scrapNo, r.reason, r.appraisal, deviceName(r.deviceId)]
        .some((v) => String(v || '').toLowerCase().includes(k)))
      .filter((r) => !statusFilter || r.status === statusFilter);
  }, [kindRows, kw, statusFilter]); // eslint-disable-line react-hooks/exhaustive-deps
  const changeColumns = [
    { title: '变更单号', dataIndex: 'changeNo', width: 160 },
    { title: '设备', render: (_, r) => deviceName(r.deviceId), width: 150 },
    { title: '类型', dataIndex: 'type', width: 90 },
    { title: '原因', dataIndex: 'reason', ellipsis: true },
    { title: '状态', dataIndex: 'status', width: 100, render: v => <StatusTag value={v} /> },
    { title: '申请人', dataIndex: 'applicant', width: 90, render: v => v || '--' },
    {
      title: '操作', width: 160,
      render: (_, r) => <Space size={4}>
        {r.status === '待审批' && <Button type="link" size="small" onClick={() => { const result = actions.approveAssetChange(r.changeId, true, '符合变更要求'); if (result.ok) message.success(result.message); }}>通过</Button>}
        {r.status === '审批通过' && <Button type="link" size="small" onClick={() => openAction(r)}>执行</Button>}
      </Space>,
    },
  ];
  const idleColumns = [
    { title: '闲置单号', dataIndex: 'idleNo', width: 160 },
    { title: '设备', render: (_, r) => deviceName(r.deviceId), width: 150 },
    { title: '闲置原因', dataIndex: 'reason', ellipsis: true },
    { title: '开始时间', dataIndex: 'startDate', width: 110 },
    { title: '复核日期', dataIndex: 'reviewDate', width: 110 },
    { title: '状态', dataIndex: 'status', width: 100, render: v => <StatusTag value={v} /> },
    { title: '操作', width: 120, render: (_, r) => ['复核中', '待审批'].includes(r.status) && <Button type="link" size="small" onClick={() => openAction(r)}>去复核</Button> },
  ];
  const scrapColumns = [
    { title: '报废单号', dataIndex: 'scrapNo', width: 160 },
    { title: '设备', render: (_, r) => deviceName(r.deviceId), width: 150 },
    { title: '报废原因', dataIndex: 'reason', ellipsis: true },
    { title: '鉴定意见', dataIndex: 'appraisal', ellipsis: true },
    { title: '状态', dataIndex: 'status', width: 110, render: v => <StatusTag value={v} /> },
    { title: '操作', width: 180, render: (_, r) => {
      if (r.status === '技术鉴定中') return <Button type="link" size="small" onClick={() => openAction(r)}>技术鉴定</Button>;
      if (r.status === '待财务核销') return <Button type="link" size="small" onClick={() => openAction(r)}>财务核销</Button>;
      if (r.status === '已报废') return <Button type="link" size="small" onClick={() => openAction(r)}>归档</Button>;
      return null;
    } },
  ];

  const renderForm = () => {
    if (kind === 'change') {
      if (reviewing) return <><Form.Item label="执行说明" name="actualNote" rules={[{ required: true, message: '请填写执行说明' }]}><Input.TextArea rows={3} /></Form.Item><Form.Item label="实际完成日期" name="actualAt" rules={[{ required: true, message: '请选择完成日期' }]}><DatePicker style={{ width: '100%' }} /></Form.Item></>;
      return <>
        <Form.Item label="设备" name="deviceId" rules={[{ required: true, message: '请选择设备' }]}><Select showSearch optionFilterProp="label" options={devices.filter(d => !['报废/归档'].includes(d.lifecycleStatus)).map(d => ({ value: d.deviceId, label: `${d.name}（${d.assetCode}）` }))} /></Form.Item>
        <Form.Item label="变更类型" name="type" rules={[{ required: true, message: '请选择变更类型' }]}><Select options={['调拨', '改造', '借用', '外送'].map(v => ({ value: v, label: v }))} /></Form.Item>
        <Form.Item label="变更原因" name="reason" rules={[{ required: true, message: '请输入变更原因' }]}><Input.TextArea rows={3} /></Form.Item>
        <Form.Item label="目标部门/借用方" name={['to', 'dept']}><Input /></Form.Item>
        <Form.Item label="目标责任人" name={['to', 'owner']}><Select allowClear options={users.filter(u => u.status === '在职').map(u => ({ value: u.name, label: u.name }))} /></Form.Item>
        <Form.Item label="计划日期" name="plannedAt"><DatePicker style={{ width: '100%' }} /></Form.Item>
      </>;
    }
    if (kind === 'idle') {
      if (reviewing) return <><Form.Item label="复核结论" name="result" rules={[{ required: true, message: '请选择复核结论' }]}><Select options={['继续闲置', '再启用', '转报废'].map(v => ({ value: v, label: v }))} /></Form.Item><Form.Item label="复核意见" name="opinion" rules={[{ required: true, message: '请填写复核意见' }]}><Input.TextArea rows={3} /></Form.Item></>;
      return <><Form.Item label="设备" name="deviceId" rules={[{ required: true, message: '请选择设备' }]}><Select showSearch optionFilterProp="label" options={devices.filter(d => d.lifecycleStatus === '在用').map(d => ({ value: d.deviceId, label: `${d.name}（${d.assetCode}）` }))} /></Form.Item><Form.Item label="闲置原因" name="reason" rules={[{ required: true, message: '请输入闲置原因' }]}><Input.TextArea rows={3} /></Form.Item><Form.Item label="开始时间" name="startDate" rules={[{ required: true, message: '请选择开始时间' }]}><DatePicker style={{ width: '100%' }} /></Form.Item><Form.Item label="复核日期" name="reviewDate" rules={[{ required: true, message: '请选择复核日期' }]}><DatePicker style={{ width: '100%' }} /></Form.Item><Form.Item label="盘活建议" name="reusePlan"><Input /></Form.Item></>;
    }
    if (reviewing?.status === '技术鉴定中') return <><Form.Item label="鉴定结论" name="result" rules={[{ required: true, message: '请选择鉴定结论' }]}><Select options={['同意报废', '不建议报废'].map(v => ({ value: v, label: v }))} /></Form.Item><Form.Item label="鉴定意见" name="opinion" rules={[{ required: true, message: '请填写鉴定意见' }]}><Input.TextArea rows={3} /></Form.Item></>;
    if (reviewing?.status === '待财务核销') return <><Form.Item label="财务核销单号" name="writeOffNo" rules={[{ required: true, message: '请输入核销单号' }]}><Input /></Form.Item><Form.Item label="核销备注" name="note"><Input.TextArea rows={2} /></Form.Item></>;
    if (reviewing?.status === '已报废') return <div style={{ color: '#5f6e80' }}>确认归档后，设备将保持只读，保留历史履历。</div>;
    return <><Form.Item label="设备" name="deviceId" rules={[{ required: true, message: '请选择设备' }]}><Select showSearch optionFilterProp="label" options={devices.filter(d => !['报废/归档'].includes(d.lifecycleStatus)).map(d => ({ value: d.deviceId, label: `${d.name}（${d.assetCode}）` }))} /></Form.Item><Form.Item label="报废原因" name="reason" rules={[{ required: true, message: '请输入报废原因' }]}><Input.TextArea rows={3} /></Form.Item><Form.Item label="原值" name="originalValue"><InputNumber min={0} style={{ width: '100%' }} /></Form.Item></>;
  };

  return (
    <>
      <PageHeader title={cfg.title} />
      <Tabs items={cfg.tabs} />
      <Card size="small" style={{ marginBottom: 12 }}>
        <Space wrap>
          <Input.Search allowClear style={{ width: 240 }} placeholder="单号 / 设备 / 原因" value={kw} onChange={(e) => setKw(e.target.value)} />
          <Select allowClear style={{ width: 160 }} placeholder="状态" value={statusFilter} onChange={setStatusFilter} options={statusOptions} />
          <Button onClick={() => { setKw(''); setStatusFilter(null); }}>重置</Button>
        </Space>
      </Card>
      <Card size="small">
        <Space wrap style={{ marginBottom: 12 }}>
          <Button type="primary" icon={<FilePlus2 size={14} />} onClick={openCreate}>{kind === 'change' ? '新建变更' : kind === 'idle' ? '新建闲置申请' : '新建报废申请'}</Button>
        </Space>
        {kind === 'change' && <Table rowKey="changeId" size="small" dataSource={filtered} columns={changeColumns} pagination={false} locale={{ emptyText: <EmptyState description="暂无资产变更" reason="可提交调拨、改造、借用或外送申请" /> }} />}
        {kind === 'idle' && <Table rowKey="idleId" size="small" dataSource={filtered} columns={idleColumns} pagination={false} locale={{ emptyText: <EmptyState description="暂无闲置申请" reason="可提交闲置申请并设置复核日期" /> }} />}
        {kind === 'scrap' && <Table rowKey="scrapId" size="small" dataSource={filtered} columns={scrapColumns} pagination={false} locale={{ emptyText: <EmptyState description="暂无报废记录" reason="报废申请需经过技术鉴定和财务核销" /> }} />}
      </Card>
      <Modal title={reviewing ? `${cfg.title} · ${reviewing.changeNo || reviewing.idleNo || reviewing.scrapNo}` : `新建${kind === 'change' ? '资产变更' : kind === 'idle' ? '闲置申请' : '报废申请'}`} open={modalOpen} width={620} destroyOnClose onCancel={closeModal} onOk={submit} okText={reviewing?.status === '已报废' ? '确认归档' : '提交'}>
        {reviewing && <Descriptions size="small" column={2} style={{ marginBottom: 12 }} items={[{ key: 'device', label: '设备', children: deviceName(reviewing.deviceId) }, { key: 'status', label: '状态', children: <StatusTag value={reviewing.status} /> }]} />}
        <Form form={form} layout="vertical">{renderForm()}</Form>
      </Modal>
    </>
  );
}
