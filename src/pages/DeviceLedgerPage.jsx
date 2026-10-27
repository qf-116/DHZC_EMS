import React, { useEffect, useMemo, useState } from 'react';
import { Card, Table, Button, Space, Input, Select, Tree, App, Modal, Form, DatePicker, Upload, Tag, Row, Col } from 'antd';
import { Upload as UploadIcon, Plus, Download, Printer, Pencil, Trash2 } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import dayjs from 'dayjs';
import PageHeader from '../components/PageHeader.jsx';
import StatusTag from '../components/StatusTag.jsx';
import EmptyState from '../components/EmptyState.jsx';
import { useDemoState } from '../state/DemoStore.jsx';
import { selectDevice, selectRealtime, selectHealth, selectBinding } from '../state/selectors.js';
import UserPickerModal from '../components/UserPickerModal.jsx';
import { workshops as orgWorkshops } from '../data/demo/masterData.js';

// 设备台账列表：数据来自 devicesById + crosswalk（§3.1 唯一映射）。
// 行点击进入 /device-ledger/detail/:deviceId；新增/编辑为演示弹窗（不落快照）。
export default function DeviceLedgerPage() {
  const navigate = useNavigate();
  const state = useDemoState();
  const { message, modal } = App.useApp();
  const [searchParams] = useSearchParams();
  const meta = state.meta;

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null); // null=新增，对象=编辑
  const [kw, setKw] = useState('');
  const [lifecycle, setLifecycle] = useState(null);
  const [workshop, setWorkshop] = useState(null);
  const [form] = Form.useForm();
  const [ownerPickerOpen, setOwnerPickerOpen] = useState(false);
  const selWorkshop = Form.useWatch('workshopName', form);
  const selLine = Form.useWatch('lineName', form);

  // 组织级联数据源：车间 → 产线 → 工位（来自三方主数据）
  const workshopOptions = useMemo(() => orgWorkshops.map(w => ({ value: w.workshopName, label: w.workshopName })), []);
  const lineOptions = useMemo(() => {
    const w = orgWorkshops.find(x => x.workshopName === selWorkshop);
    return (w?.lines || []).map(l => ({ value: l.lineName, label: l.lineName }));
  }, [selWorkshop]);
  const stationOptions = useMemo(() => {
    const w = orgWorkshops.find(x => x.workshopName === selWorkshop);
    const l = (w?.lines || []).find(x => x.lineName === selLine);
    return (l?.stations || []).map(s => ({ value: s, label: s }));
  }, [selWorkshop, selLine]);

  const rows = useMemo(() => Object.values(state.entities.devicesById).map((d) => {
    const device = selectDevice(state, d.deviceId);
    const binding = selectBinding(state, d.deviceId);
    const health = selectHealth(state, d.deviceId);
    const realtime = selectRealtime(state, d.deviceId);
    const lifecycleOnly = device.lifecycleStatus !== '在用';
    return {
      deviceId: d.deviceId,
      assetCode: device.assetCode,
      name: device.name,
      model: device.model,
      type: device.type,
      brand: device.brand,
      organizationId: device.organizationId,
      workshopName: device.workshopName,
      lineName: device.lineName,
      stationName: device.stationName,
      lifecycleStatus: device.lifecycleStatus,
      owner: device.owner,
      enableDate: device.enableDate,
      buyDate: device.buyDate,
      assetNo: device.assetNo,
      oeeEligible: device.oeeEligible,
      networked: binding?.configStatus && binding.configStatus !== '未配置' ? '是' : '否',
      bindingStatus: binding?.configStatus || '未配置',
      healthStatus: lifecycleOnly ? null : health.status,
      runStatus: lifecycleOnly ? null : realtime.runStatus,
    };
  }), [state]);

  // 旧入口兼容：?code=资产编码 或 ?deviceId= 打开编辑弹窗
  useEffect(() => {
    const code = searchParams.get('code');
    const qDeviceId = searchParams.get('deviceId');
    if (!code && !qDeviceId) return;
    const hit = rows.find(r => r.assetCode === code || r.deviceId === qDeviceId);
    if (hit) { setEditing(hit); setModalOpen(true); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const workshops = useMemo(() => [...new Set(rows.map(r => r.workshopName).filter(Boolean))], [rows]);
  const lifecycles = useMemo(() => [...new Set(rows.map(r => r.lifecycleStatus).filter(Boolean))], [rows]);

  const filtered = rows
    .filter(r => !lifecycle || r.lifecycleStatus === lifecycle)
    .filter(r => !workshop || r.workshopName === workshop)
    .filter(r => {
      const k = kw.trim().toLowerCase();
      if (!k) return true;
      return [r.assetCode, r.name, r.model, r.owner].some(v => (v || '').toLowerCase().includes(k));
    });

  // 设备类型树：由台账数据派生，不使用静态业务数组
  const typeTree = useMemo(() => {
    const types = [...new Set(rows.map(r => r.type).filter(Boolean))];
    return [
      { title: '全部设备', key: 'all' },
      ...types.map(t => ({ title: t, key: t })),
    ];
  }, [rows]);

  const openModal = (record) => { setEditing(record || null); setModalOpen(true); };

  const confirmDelete = (record) => modal.confirm({
    title: '删除设备档案',
    content: record
      ? `确定删除设备档案「${record.name}（${record.assetCode}）」吗？删除后数据不可恢复。`
      : '确定删除选中的设备档案吗？删除后数据不可恢复。',
    okText: '删除', okButtonProps: { danger: true }, cancelText: '取消',
    onOk: () => message.success('设备档案已删除'),
  });

  const columns = [
    { title: '资产编号', dataIndex: 'assetCode', width: 130 },
    { title: '设备名称', dataIndex: 'name', width: 130 },
    { title: '规格型号', dataIndex: 'model', width: 100, render: v => v || '--' },
    { title: '车间', dataIndex: 'workshopName', width: 100, render: v => v || '--' },
    { title: '产线', dataIndex: 'lineName', width: 100, render: v => v || '--' },
    { title: '生命周期', dataIndex: 'lifecycleStatus', width: 100, render: v => <StatusTag value={v} /> },
    {
      title: '运行状态', dataIndex: 'runStatus', width: 100,
      render: (v, r) => (r.lifecycleStatus === '在用'
        ? <StatusTag value={v} />
        : <StatusTag value={null} tip="停用/报废设备不参与运行监测" />),
    },
    { title: '通信健康', dataIndex: 'healthStatus', width: 100, render: (v, r) => (r.lifecycleStatus === '在用' ? <StatusTag value={v} /> : <StatusTag value={null} />) },
    { title: '绑定状态', dataIndex: 'bindingStatus', width: 100, render: v => <StatusTag value={v} /> },
    { title: 'OEE统计', width: 90, render: (_, r) => <Tag color={r.oeeEligible ? 'success' : 'default'}>{r.oeeEligible ? '是' : '否'}</Tag> },
    { title: '工位', dataIndex: 'stationName', width: 90, render: v => v || '--' },
    { title: '设备负责人', dataIndex: 'owner', width: 100, render: v => v || '--' },
    { title: '启用日期', dataIndex: 'enableDate', width: 100, render: v => v || '--' },
    {
      title: '操作', width: 150, fixed: 'right',
      render: (_, r) => (
        <Space size={4} onClick={e => e.stopPropagation()}>
          <Button type="link" size="small" onClick={() => navigate(`/device-ledger/detail/${r.deviceId}`)}>详情</Button>
          <Button type="link" size="small" onClick={() => openModal(r)}>编辑</Button>
          <Button type="link" size="small" danger onClick={() => confirmDelete(r)}>删除</Button>
        </Space>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="设备台账"
        subtitle={`数据更新于 ${meta.updatedAt || '--'}`}
      />
      <div style={{ display: 'flex', gap: 12 }}>
        <Card size="small" title="设备类型" style={{ width: 200, flexShrink: 0 }}>
          <Tree
            defaultExpandAll
            defaultSelectedKeys={['all']}
            treeData={typeTree}
            onSelect={(keys) => setKw(keys[0] && keys[0] !== 'all' ? keys[0] : '')}
          />
        </Card>
        <div style={{ flex: 1, minWidth: 0 }}>
          <Card size="small" style={{ marginBottom: 12 }}>
            <Space wrap>
              <Select style={{ width: 130 }} placeholder="生命周期" allowClear value={lifecycle} onChange={setLifecycle} options={lifecycles.map(v => ({ value: v, label: v }))} />
              <Select style={{ width: 130 }} placeholder="车间" allowClear value={workshop} onChange={setWorkshop} options={workshops.map(v => ({ value: v, label: v }))} />
              <Input style={{ width: 200 }} placeholder="资产编号 / 名称 / 型号 / 负责人" allowClear value={kw} onChange={e => setKw(e.target.value)} />
              <Button onClick={() => { setLifecycle(null); setWorkshop(null); setKw(''); }}>重置</Button>
            </Space>
          </Card>
          <Card size="small">
            <Space wrap style={{ marginBottom: 12 }}>
              <Button type="primary" icon={<Plus size={14} />} onClick={() => openModal(null)}>新增</Button>
              <Button icon={<Printer size={14} />}>打印二维码</Button>
              <Button icon={<UploadIcon size={14} />}>导入</Button>
              <Button icon={<Download size={14} />}>导出</Button>
              <Button icon={<Pencil size={14} />} onClick={() => openModal(rows[0] || null)}>编辑</Button>
              <Button danger icon={<Trash2 size={14} />} onClick={() => confirmDelete(null)}>删除</Button>
            </Space>
            <Table
              rowKey="deviceId" size="small" scroll={{ x: 1500 }}
              rowSelection={{ columnWidth: 40 }}
              dataSource={filtered}
              onRow={(r) => ({ onClick: () => navigate(`/device-ledger/detail/${r.deviceId}`), style: { cursor: 'pointer' } })}
              locale={{ emptyText: <EmptyState description="没有匹配筛选条件的设备" reason="请调整生命周期 / 车间 / 关键字筛选" next="重置筛选" onNext={() => { setLifecycle(null); setWorkshop(null); setKw(''); }} nextLabel="重置筛选" /> }}
              columns={columns}
              pagination={{ pageSize: 10, showTotal: t => `共 ${t} 条` }}
            />
          </Card>
        </div>
      </div>

      {/* 新增/编辑设备档案（演示弹窗：不修改演示快照中的台账事实；字段对齐已上线原型，双列布局） */}
      <Modal
        title={editing ? `编辑设备档案（${editing.assetCode}）` : '新增设备档案'}
        width={920}
        open={modalOpen}
        destroyOnClose
        onCancel={() => setModalOpen(false)}
        footer={[
          <Button key="cancel" onClick={() => setModalOpen(false)}>取消</Button>,
          <Button key="ok" type="primary" onClick={() => { setModalOpen(false); message.success('设备档案已保存'); }}>确认</Button>,
        ]}
      >
        {/* 编辑时日期字段须转 dayjs 对象（直接传字符串会让 DatePicker 崩溃白屏） */}
        <Form
          form={form}
          labelCol={{ span: 9 }} wrapperCol={{ span: 15 }} labelWrap
          initialValues={(() => {
            if (!editing) return {};
            const toDay = (v) => (v ? dayjs(v) : undefined);
            return {
              ...editing,
              enableDate: toDay(editing.enableDate),
              buyDate: toDay(editing.buyDate),
              oeeFlag: editing.oeeEligible ? '是' : '否',
            };
          })()}
          style={{ maxHeight: '62vh', overflowY: 'auto', paddingRight: 8 }}
        >
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="资产编号" required><Input value={editing ? editing.assetCode : '新增由平台生成'} disabled /></Form.Item>
              <Form.Item label="设备名称" name="name" rules={[{ required: true, message: '请输入设备名称' }]}><Input placeholder="请输入设备名称" /></Form.Item>
              <Form.Item label="设备类型" name="type">
                <Select placeholder="请选择设备类型" options={[...new Set(rows.map(r => r.type).filter(Boolean))].map(v => ({ value: v, label: v }))} />
              </Form.Item>
              <Form.Item label="规格型号" name="model"><Input placeholder="请输入规格型号" /></Form.Item>
              <Form.Item label="品牌" name="brand"><Input placeholder="请输入品牌" /></Form.Item>
              <Form.Item label="车间" name="workshopName">
                <Select
                  placeholder="请选择车间" showSearch optionFilterProp="label"
                  options={workshopOptions}
                  onChange={() => form.setFieldsValue({ lineName: undefined, stationName: undefined })}
                />
              </Form.Item>
              <Form.Item label="产线" name="lineName">
                <Select
                  placeholder="请先选择车间" showSearch optionFilterProp="label"
                  options={lineOptions} disabled={!selWorkshop}
                  onChange={() => form.setFieldsValue({ stationName: undefined })}
                />
              </Form.Item>
              <Form.Item label="工位" name="stationName">
                <Select placeholder="请先选择产线" showSearch optionFilterProp="label" options={stationOptions} disabled={!selWorkshop} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="状态" name="lifecycleStatus">
                <Select placeholder="请选择状态" options={['在用', '闲置', '停用', '报废/归档'].map(v => ({ value: v, label: v }))} />
              </Form.Item>
              <Form.Item label="设备负责人" name="owner">
                <Input
                  readOnly placeholder="点击「选择」从人员主数据选取"
                  addonAfter={<Button type="link" size="small" style={{ margin: -7 }} onClick={() => setOwnerPickerOpen(true)}>选择</Button>}
                />
              </Form.Item>
              <Form.Item label="资产编号（档案）" name="assetNo"><Input placeholder="请输入资产编号（档案）" /></Form.Item>
              <Form.Item label="是否联网" name="networked" tooltip={editing ? '由绑定状态推导，不可修改' : undefined}>
                <Select disabled={!!editing} options={['是', '否'].map(v => ({ value: v, label: v }))} placeholder="请选择是否联网" />
              </Form.Item>
              <Form.Item label="OEE统计" name="oeeFlag" tooltip={editing ? '由理想速度与绑定配置推导，不可修改' : undefined}>
                <Select disabled={!!editing} options={['是', '否'].map(v => ({ value: v, label: v }))} placeholder="请选择是否纳入 OEE 统计" />
              </Form.Item>
              <Form.Item label="启用日期" name="enableDate"><DatePicker style={{ width: '100%' }} placeholder="请选择启用日期" /></Form.Item>
              <Form.Item label="采购日期" name="buyDate"><DatePicker style={{ width: '100%' }} placeholder="请选择采购日期" /></Form.Item>
              <Form.Item label="停用日期" name="disableDate"><DatePicker style={{ width: '100%' }} placeholder="请选择停用日期" /></Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="设备图片" labelCol={{ span: 9 }} wrapperCol={{ span: 15 }}><Upload maxCount={5}><Button>上传图片</Button></Upload></Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="备注" labelCol={{ span: 9 }} wrapperCol={{ span: 15 }}><Input.TextArea rows={2} placeholder="请输入备注" /></Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>

      {/* 人员主数据选择（三方系统来源，选中后回填设备负责人） */}
      <UserPickerModal
        open={ownerPickerOpen}
        title="选择设备负责人"
        onCancel={() => setOwnerPickerOpen(false)}
        onSelect={(u) => { form.setFieldsValue({ owner: u.name }); setOwnerPickerOpen(false); }}
      />
    </>
  );
}
