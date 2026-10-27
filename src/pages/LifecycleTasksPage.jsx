import React, { useEffect, useMemo, useState } from 'react';
import { App, Alert, Button, Card, DatePicker, Form, Input, InputNumber, Modal, Select, Space, Table, Tag, Tabs, Upload, Descriptions } from 'antd';
import { ClipboardCheck, FilePlus2, CheckCircle2, RotateCcw, Search } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import PageHeader from '../components/PageHeader.jsx';
import StatusTag from '../components/StatusTag.jsx';
import EmptyState from '../components/EmptyState.jsx';
import { useDemoActions, useDemoState } from '../state/DemoStore.jsx';
import { selectLifecycleTasks, selectLifecycleTask } from '../state/selectors.js';
import { suppliers, users, workshops } from '../data/demo/masterData.js';

const MODES = {
  procurement: { title: '采购入账', status: null },
  trial: { title: '使用部门试用确认', status: '使用部门试用确认中' },
  registration: { title: '设备办理手续入账', status: '待设备手续入账' },
};

// 来源口径：采购到货信息统一由采购系统（SRM/WMS 同一来源）同步生成任务，直接入列表、
// 无需人工新建；「新建」入口仅用于设备系统自主发起的手工补录（sourceType = MANUAL）
const SOURCE_LABEL = {
  PROCUREMENT: '采购系统同步（SRM/WMS）',
  MANUAL: '手工新增',
};
const sourceTag = (v) => (v === 'MANUAL' ? <Tag>手工新增</Tag> : <Tag color="processing">采购系统同步</Tag>);

function filesFromUpload(fileList = []) {
  return fileList.map(f => ({ name: f.name, type: '附件' }));
}

export default function LifecycleTasksPage({ mode = null }) {
  const location = useLocation();
  const navigate = useNavigate();
  const state = useDemoState();
  const actions = useDemoActions();
  const { message } = App.useApp();
  const [keyword, setKeyword] = useState('');
  const [status, setStatus] = useState(MODES[mode]?.status || undefined);
  const [selected, setSelected] = useState(null);
  const [modalOpen, setModalOpen] = useState(Boolean(mode));
  const [form] = Form.useForm();
  const [detailOpen, setDetailOpen] = useState(false);

  const tasks = useMemo(() => selectLifecycleTasks(state, { keyword, status }), [state, keyword, status]);
  const currentMode = MODES[mode] || null;

  useEffect(() => {
    if (!mode || selected) return;
    const candidate = tasks.find(task => !currentMode?.status || task.status === currentMode.status);
    if (candidate) openTask(candidate, mode);
  }, [mode, tasks]); // eslint-disable-line react-hooks/exhaustive-deps

  const openCreate = () => {
    form.resetFields();
    setSelected(null);
    setModalOpen(true);
  };
  const openTask = (record, nextMode = mode) => {
    setSelected(record);
    form.resetFields();
    if (nextMode === 'procurement') {
      form.setFieldsValue({
        sourceNote: record.sourceNote,
        equipmentName: record.equipmentName,
        model: record.model,
        quantity: record.quantity,
        brand: record.brand,
        supplier: record.supplier,
        purchaseOrderNo: record.purchaseOrderNo,
        contractNo: record.contractNo,
        shipDate: record.shipDate ? dayjs(record.shipDate) : undefined,
        useDept: record.useDept,
        trialOwner: record.trialOwner,
      });
    }
    setModalOpen(true);
  };

  const submit = async () => {
    const values = await form.validateFields();
    let result;
    if (mode === 'trial') {
      result = actions.confirmLifecycleTrial(selected.taskId, values);
    } else if (mode === 'registration') {
      result = actions.registerLifecycleDevice(selected.taskId, {
        ...values,
        acceptanceFile: values.acceptanceFile?.fileList?.[0]?.name || values.acceptanceFile || '',
        archiveFile: values.archiveFile?.fileList?.[0]?.name || values.archiveFile || '',
      });
    } else if (selected) {
      result = actions.submitLifecycleProcurement(selected.taskId, { ...values, shipDate: values.shipDate?.format('YYYY-MM-DD') || values.shipDate });
    } else {
      // 手工新增（仅设备系统自主发起）：填完采购入账信息一步提交，直接进入使用部门试用确认
      result = actions.createLifecycleTask({
        ...values,
        sourceType: 'MANUAL',
        shipDate: values.shipDate?.format('YYYY-MM-DD') || values.shipDate,
        attachments: filesFromUpload(values.attachments?.fileList),
      });
      if (result.ok) {
        const submitted = actions.submitLifecycleProcurement(result.refs.taskId, { ...values, shipDate: values.shipDate?.format('YYYY-MM-DD') || values.shipDate });
        if (submitted.ok) result = { ...result, message: `采购入账任务 ${result.refs.taskNo} 已创建并提交使用部门试用确认` };
      }
    }
    if (!result.ok) {
      message.error(result.message);
      return;
    }
    message.success(result.message);
    setModalOpen(false);
    navigate('/lifecycle/tasks');
  };

  const openForMode = () => {
    if (mode === 'procurement') {
      openCreate();
      return;
    }
    const candidate = tasks[0];
    if (candidate) openTask(candidate, mode);
    else message.info(`当前没有${currentMode?.title || ''}待办`);
  };

  const columns = [
    { title: '任务号', dataIndex: 'taskNo', width: 165 },
    { title: '设备名称', dataIndex: 'equipmentName', width: 150, render: v => v || <span style={{ color: '#9aa7b5' }}>待填写</span> },
    { title: '型号', dataIndex: 'model', width: 110, render: v => v || '--' },
    { title: '品牌', dataIndex: 'brand', width: 100, render: v => v || '--' },
    { title: '数量', dataIndex: 'quantity', width: 70, render: v => v ?? '--' },
    { title: '使用部门', dataIndex: 'useDept', width: 110, render: v => v || '--' },
    { title: '当前节点', dataIndex: 'status', width: 150, render: v => <StatusTag value={v} /> },
    { title: '来源', dataIndex: 'sourceType', width: 120, render: v => sourceTag(v) },
    {
      title: '操作', fixed: 'right', width: 180,
      render: (_, record) => (
        <Space size={4}>
          {['采购入账待提交', '采购入账待修改', '试用不合格退回'].includes(record.status) && <Button type="link" size="small" onClick={() => openTask(record, 'procurement')}>采购入账</Button>}
          {record.status === '使用部门试用确认中' && <Button type="link" size="small" onClick={() => openTask(record, 'trial')}>去确认</Button>}
          {record.status === '待设备手续入账' && <Button type="link" size="small" onClick={() => openTask(record, 'registration')}>办理入账</Button>}
          <Button type="link" size="small" onClick={() => { setSelected(record); setDetailOpen(true); }}>详情</Button>
        </Space>
      ),
    },
  ];

  const procurementFields = (
    <>
      <Alert
        type="info" showIcon style={{ marginBottom: 16 }}
        message="本表单无需填写设备编号：设备编码在「设备办理手续入账」节点由系统按采购数量自动批量生成，并自动与本任务建立关联（任务 ↔ 设备台账）。"
      />
      {!selected && (
        <Form.Item label="来源说明" name="sourceNote" rules={[{ required: true, message: '手工新增时请填写来源说明' }]}><Input.TextArea rows={2} placeholder="手工新增仅用于直送现场补录 / 历史设备补录 / 接口未覆盖；采购到货信息由采购系统（SRM/WMS）同步生成，无需手工新建" /></Form.Item>
      )}
      <Form.Item label="设备名称" name="equipmentName" rules={[{ required: true, message: '请输入设备名称' }]}><Input placeholder="例如：自动装配机" /></Form.Item>
      <Form.Item label="型号/规格" name="model" rules={[{ required: true, message: '请输入型号/规格' }]}><Input /></Form.Item>
      <Form.Item label="数量" name="quantity" rules={[{ required: true, message: '请输入数量' }]}><InputNumber min={1} style={{ width: '100%' }} /></Form.Item>
      <Form.Item label="品牌" name="brand" rules={[{ required: true, message: '请输入品牌' }]}><Input /></Form.Item>
      <Form.Item label="供应商" name="supplier"><Select allowClear options={suppliers.map(s => ({ value: s.name, label: s.name }))} /></Form.Item>
      <Form.Item label="采购订单号" name="purchaseOrderNo"><Input placeholder="可关联采购系统订单" /></Form.Item>
      <Form.Item label="合同号" name="contractNo" rules={[{ required: true, message: '请输入合同号' }]}><Input /></Form.Item>
      <Form.Item label="发货时间" name="shipDate" rules={[{ required: true, message: '请选择发货时间' }]}><DatePicker style={{ width: '100%' }} /></Form.Item>
      <Form.Item label="使用部门" name="useDept" rules={[{ required: true, message: '请选择使用部门' }]}><Select options={workshops.map(w => ({ value: w.workshopName, label: w.workshopName }))} /></Form.Item>
      <Form.Item label="试用负责人" name="trialOwner"><Select options={users.filter(u => u.status === '在职').map(u => ({ value: u.name, label: `${u.name}（${u.dept}）` }))} /></Form.Item>
      <Form.Item label="合同/发货凭证" name="attachments"><Upload beforeUpload={() => false} maxCount={5}><Button icon={<FilePlus2 size={14} />}>选择附件</Button></Upload></Form.Item>
    </>
  );

  const trialFields = (
    <>
      <Form.Item label="试用结论" name="result" rules={[{ required: true, message: '请选择试用结论' }]}><Select options={[{ value: '合格', label: '合格' }, { value: '不合格', label: '不合格' }]} /></Form.Item>
      <Form.Item label="使用部门意见" name="opinion" rules={[{ required: true, message: '请填写试用意见' }]}><Input.TextArea rows={3} maxLength={200} showCount /></Form.Item>
      <Form.Item noStyle shouldUpdate={(prev, cur) => prev.result !== cur.result}>
        {({ getFieldValue }) => getFieldValue('result') === '不合格' ? <Form.Item label="主要问题" name="problem" rules={[{ required: true, message: '不合格时请填写主要问题' }]}><Input.TextArea rows={3} maxLength={200} showCount /></Form.Item> : null}
      </Form.Item>
    </>
  );

  const registrationFields = (
    <>
      <Form.Item label="设备名称" name="name" rules={[{ required: true, message: '请输入设备名称' }]}><Input /></Form.Item>
      <Form.Item label="设备类型" name="type" rules={[{ required: true, message: '请输入设备类型' }]}><Input placeholder="例如：加工中心、动力设备" /></Form.Item>
      <Form.Item label="车间" name="workshopName" rules={[{ required: true, message: '请选择车间' }]}><Select options={workshops.map(w => ({ value: w.workshopName, label: w.workshopName }))} /></Form.Item>
      <Form.Item label="产线" name="lineName"><Input placeholder="没有产线可填 --" /></Form.Item>
      <Form.Item label="工位" name="stationName"><Input placeholder="没有工位可填 --" /></Form.Item>
      <Form.Item label="设备负责人" name="owner" rules={[{ required: true, message: '请选择负责人' }]}><Select options={users.filter(u => u.status === '在职').map(u => ({ value: u.name, label: `${u.name}（${u.dept}）` }))} /></Form.Item>
      <Form.Item label="资产编号" name="assetNo"><Input placeholder="无财务编号可先填待财务" /></Form.Item>
      <Form.Item label="质保期" name="warranty"><Input placeholder="例如：2026-09-18 至 2028-09-17" /></Form.Item>
      <Form.Item label="验收单" name="acceptanceFile" rules={[{ required: true, message: '请上传验收单' }]}><Upload beforeUpload={() => false} maxCount={1}><Button icon={<FilePlus2 size={14} />}>选择验收单</Button></Upload></Form.Item>
      <Form.Item label="设备档案" name="archiveFile" rules={[{ required: true, message: '请上传设备档案' }]}><Upload beforeUpload={() => false} maxCount={1}><Button icon={<FilePlus2 size={14} />}>选择档案文件</Button></Upload></Form.Item>
    </>
  );

  const modalTitle = mode === 'trial' ? '使用部门试用确认' : mode === 'registration' ? '设备办理手续入账' : selected ? '补充采购入账信息' : '手工新增采购入账';

  // 入账预览：按采购数量预览将要生成的设备编码（正式编码在提交时由系统生成并写入台账）
  const registrationPreview = mode === 'registration' && selected ? (() => {
    const base = Object.keys(state.entities.devicesById || {}).length;
    const count = Number(selected.quantity) || 1;
    return Array.from({ length: count }, (_, i) => `DEV-${String(base + i + 1).padStart(3, '0')}`);
  })() : null;

  return (
    <>
      <PageHeader
        title={currentMode?.title || '设备入账流程'}
      />
      {!mode && (
        <Tabs
          activeKey={location.pathname.includes('procurement-entry') ? 'procurement' : location.pathname.includes('trial-confirmation') ? 'trial' : location.pathname.includes('device-registration') ? 'registration' : 'all'}
          onChange={(key) => {
            if (key === 'all') navigate('/lifecycle/tasks');
            else navigate(`/lifecycle/tasks/${key === 'procurement' ? 'procurement-entry' : key === 'trial' ? 'trial-confirmation' : 'device-registration'}`);
          }}
          items={[
            { key: 'all', label: '全部任务' },
            { key: 'procurement', label: '采购入账' },
            { key: 'trial', label: '试用确认' },
            { key: 'registration', label: '设备手续入账' },
          ]}
        />
      )}
      <Card size="small" style={{ marginBottom: 12 }}>
        <Space wrap>
          <Input prefix={<Search size={14} />} placeholder="任务号 / 设备名称 / 型号 / 部门" value={keyword} onChange={e => setKeyword(e.target.value)} allowClear style={{ width: 260 }} />
          <Select placeholder="当前节点" allowClear value={status} onChange={setStatus} style={{ width: 180 }} options={Object.values(MODES).map(m => m.status).filter(Boolean).map(v => ({ value: v, label: v })).concat([{ value: '试用不合格退回', label: '试用不合格退回' }, { value: '设备已入账', label: '设备已入账' }])} />
          <Button onClick={() => { setKeyword(''); setStatus(undefined); }}>重置</Button>
        </Space>
      </Card>
      <Card size="small">
        <Space wrap style={{ marginBottom: 12 }}>
          <Button type="primary" icon={<FilePlus2 size={14} />} onClick={mode ? openForMode : openCreate}>手工新增采购入账</Button>
        </Space>
        {tasks.length ? <Table rowKey="taskId" size="small" scroll={{ x: 1100 }} dataSource={tasks} columns={columns} pagination={{ pageSize: 8, showTotal: t => `共 ${t} 条` }} /> : <EmptyState description="暂无设备入账流程任务" reason="采购到货任务由采购系统（SRM/WMS）同步生成；直送现场 / 历史设备等补录场景可手工新增" next="手工新增采购入账" onNext={openCreate} />}
      </Card>

      <Modal title={modalTitle} open={modalOpen} width={680} destroyOnClose onCancel={() => { setModalOpen(false); if (mode) navigate('/lifecycle/tasks'); }} onOk={submit} okText={mode === 'trial' ? '提交试用结论' : mode === 'registration' ? '完成设备入账' : '提交'}>
        {selected && <Descriptions size="small" column={2} style={{ marginBottom: 16 }} items={[{ key: 'task', label: '任务号', children: selected.taskNo }, { key: 'device', label: '设备', children: `${selected.equipmentName || '--'} / ${selected.model || '--'}` }, { key: 'dept', label: '使用部门', children: selected.useDept || '--' }, { key: 'status', label: '当前节点', children: <StatusTag value={selected.status} /> }]} />}
        {registrationPreview && (
          <Alert
            type="info" showIcon style={{ marginBottom: 16 }}
            message={`按采购数量 ${registrationPreview.length} 台批量生成设备台账：${registrationPreview.join('、')}。设备编码由系统自动生成，提交后自动写入台账并与本任务建立双向关联（设备档案「入账来源」↔ 本任务）。`}
          />
        )}
        <Form form={form} layout="vertical">
          {mode === 'trial' ? trialFields : mode === 'registration' ? registrationFields : procurementFields}
        </Form>
      </Modal>

      <Modal title={`流程详情 · ${selected?.taskNo || ''}`} open={detailOpen} footer={null} width={760} onCancel={() => setDetailOpen(false)}>
        {selected && (
          <>
            <Descriptions bordered size="small" column={2} items={[
              { key: 'taskNo', label: '任务号', children: selected.taskNo },
              { key: 'status', label: '状态', children: <StatusTag value={selected.status} /> },
              { key: 'equipment', label: '设备', children: `${selected.equipmentName || '--'} / ${selected.model || '--'}` },
              { key: 'source', label: '来源', children: SOURCE_LABEL[selected.sourceType] || selected.sourceType },
              { key: 'trial', label: '试用结论', children: selected.trial?.result || '--' },
              { key: 'registration', label: '入账状态', children: selected.registration?.status || '--' },
              {
                key: 'devices', label: '入账设备', span: 2,
                children: (selected.registration?.deviceIds || []).length
                  ? (
                    <Space size={8} wrap>
                      {selected.registration.deviceIds.map(id => (
                        <a key={id} onClick={() => { setDetailOpen(false); navigate(`/device-ledger/detail/${id}`); }}>{id}</a>
                      ))}
                    </Space>
                  )
                  : <span style={{ color: '#8a97a3' }}>尚未办理设备手续入账（入账时由系统按采购数量生成设备编码）</span>,
              },
            ]} />
            <div style={{ marginTop: 16, fontWeight: 600 }}>流程履历</div>
            <Table size="small" rowKey={(r, i) => `${r.type}-${i}`} pagination={false} dataSource={selected.timeline || []} columns={[{ title: '节点', dataIndex: 'type', width: 130 }, { title: '时间', dataIndex: 'time', width: 170 }, { title: '处理人', dataIndex: 'actor', width: 90 }, { title: '说明', dataIndex: 'detail' }]} />
          </>
        )}
      </Modal>
    </>
  );
}
