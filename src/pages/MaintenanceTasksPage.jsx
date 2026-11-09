import React, { useMemo, useState } from 'react';
import {
  Card, Table, Button, Space, Input, Select, Tooltip, Tag, Modal, Form, App, Popconfirm,
  DatePicker, Alert, Row, Col,
} from 'antd';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import PageHeader from '../components/PageHeader.jsx';
import FilterBar, { FilterField } from '../components/FilterBar.jsx';
import DegradedBanner from '../components/DegradedBanner.jsx';
import StatusTag from '../components/StatusTag.jsx';
import EmptyState from '../components/EmptyState.jsx';
import MaintenanceDevicePickerModal from '../components/MaintenanceDevicePickerModal.jsx';
import { useDemoState } from '../state/DemoStore.jsx';
import {
  maintenanceTasks,
  maintenancePlans,
  maintenanceItems,
  ledgerDevices,
} from '../data/standardData.js';
import { crosswalkByAssetCode } from '../data/demo/deviceCrosswalk.js';

// 设备展示统一经 crosswalk canonical 映射：种子 device 字段（如「数控车床 MT2024A1201」）
// 解析出资产码后由 crosswalk 解析 canonical 名称 / deviceId，不做字符串推导命名。
function deviceOf(deviceStr) {
  const m = String(deviceStr || '').match(/MT\d{4}A\d+/);
  const assetCode = m ? m[0] : null;
  const cw = assetCode ? crosswalkByAssetCode[assetCode] : null;
  return {
    assetCode,
    name: cw ? cw.name : (deviceStr || '--'),
    deviceId: cw ? cw.deviceId : null,
  };
}

const canExecute = (r) => ['未开始', '进行中'].includes(r.status);

// 从设备字符串（如「数控车床 MT2024A1201」）解析资产编码
const parseAssetCodeOf = (deviceStr) => {
  const m = String(deviceStr || '').match(/MT\d{4}A\d+/);
  return m ? m[0] : null;
};

// 保养任务列表（范围外演示模块）：列表读自种子 maintenanceTasks；状态轴统一 StatusTag；
// 行点击进入任务详情（query ?code=），未开始 / 进行中任务提供「开始保养」入口。
// 新增 / 编辑 / 删除 / 调整任务为页面内演示交互（不写入 DemoStore，刷新后恢复快照）。
export default function MaintenanceTasksPage() {
  const navigate = useNavigate();
  const { message } = App.useApp();
  const state = useDemoState();
  const meta = state.meta;

  const [kw, setKw] = useState('');
  const [kwDraft, setKwDraft] = useState('');
  const [status, setStatus] = useState(null);
  const [owner, setOwner] = useState(null);
  const [planName, setPlanName] = useState(null);
  const [deviceKw, setDeviceKw] = useState('');
  const [dateRange, setDateRange] = useState(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState(null); // null=新增，对象=编辑
  const [form] = Form.useForm();
  const [extraRows, setExtraRows] = useState([]);
  const [deletedCodes, setDeletedCodes] = useState(() => new Set());
  const [patches, setPatches] = useState({});
  const [selectedKeys, setSelectedKeys] = useState([]);

  // 新增任务弹窗：保养项目 / 保养设备 / 任务日期
  const [itemCodes, setItemCodes] = useState([]);
  const [taskDevices, setTaskDevices] = useState([]);
  const [devicePickerOpen, setDevicePickerOpen] = useState(false);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [adjustForm] = Form.useForm();

  const rows = useMemo(() => [
    ...extraRows,
    ...maintenanceTasks.filter(r => !deletedCodes.has(r.code)).map(r => (patches[r.code] ? { ...r, ...patches[r.code] } : r)),
  ], [extraRows, deletedCodes, patches]);

  const statusOptions = useMemo(
    () => [...new Set(rows.map(r => r.status))].map(v => ({ value: v, label: v })),
    [rows],
  );
  const ownerOptions = useMemo(
    () => [...new Set(rows.map(r => r.owner).filter(Boolean))].map(v => ({ value: v, label: v })),
    [rows],
  );
  const planOptions = useMemo(
    () => [...new Set(rows.map(r => r.plan).filter(Boolean))].map(v => ({ value: v, label: v })),
    [rows],
  );

  const list = useMemo(() => rows
    .filter(r => !status || r.status === status)
    .filter(r => !owner || r.owner === owner)
    .filter(r => !planName || r.plan === planName)
    .filter(r => !deviceKw || (r.device || '').includes(deviceKw))
    .filter(r => {
      if (!dateRange || !dateRange[0] || !dateRange[1]) return true;
      const d = r.date;
      if (!d) return false;
      return d >= dateRange[0].format('YYYY-MM-DD') && d <= dateRange[1].format('YYYY-MM-DD');
    })
    .filter(r => !kw || (r.code || '').includes(kw) || (r.name || '').includes(kw)
      || (r.device || '').includes(kw) || (r.owner || '').includes(kw)), [rows, kw, status, owner, planName, deviceKw, dateRange]);

  const nextCode = `BYRW${(meta.demoDay || '2026-09-16').replaceAll('-', '')}${String(maintenanceTasks.length + extraRows.length + 1).padStart(3, '0')}`;

  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({ code: nextCode });
    setItemCodes([]);
    setTaskDevices([]);
    setEditorOpen(true);
  };
  const openEdit = (record) => {
    setEditing(record);
    form.resetFields();
    form.setFieldsValue({
      ...record,
      date: record.date ? dayjs(record.date) : undefined,
    });
    setItemCodes(record.itemCodes || []);
    // 编辑既有任务：以设备编码回填保养设备清单（设备名称经 crosswalk canonical 映射）
    const assetCode = parseAssetCodeOf(record.device);
    const ledger = ledgerDevices.find(d => d.code === assetCode);
    setTaskDevices(ledger ? [{ code: ledger.code, name: ledger.name }] : []);
    setEditorOpen(true);
  };
  const handleSubmit = async () => {
    const values = await form.validateFields();
    const deviceText = taskDevices.map(d => d.name).join('、');
    if (!deviceText) {
      message.error('请添加保养设备');
      return;
    }
    const base = {
      ...(editing || {}),
      ...values,
      device: deviceText,
      devices: taskDevices.map(d => d.code).join('、'),
      itemCodes,
      items: itemCodes.map(c => maintenanceItems.find(i => i.code === c)?.name).filter(Boolean).join('、'),
      date: values.date?.format('YYYY-MM-DD') ?? (editing?.date || undefined),
      dateValue: undefined,
    };
    if (editing) {
      setPatches(prev => ({ ...prev, [editing.code]: { ...prev[editing.code], ...base } }));
      message.success(`保养任务「${editing.code}」已保存`);
    } else {
      setExtraRows(prev => [{ ...base, code: values.code || nextCode, status: '未开始', createTime: `${meta.updatedAt || meta.demoDay || ''}` }, ...prev]);
      message.success(`保养任务「${values.name}」已创建`);
    }
    setEditorOpen(false);
  };
  const handleDelete = (record) => {
    if (extraRows.some(r => r.code === record.code)) setExtraRows(prev => prev.filter(r => r.code !== record.code));
    else setDeletedCodes(prev => new Set(prev).add(record.code));
    message.success(`已删除保养任务「${record.code}」`);
  };

  // 调整任务：批量改期 / 改负责人
  const openAdjust = () => {
    if (!selectedKeys.length) {
      message.warning('请先勾选要调整的保养任务');
      return;
    }
    adjustForm.resetFields();
    setAdjustOpen(true);
  };
  const handleAdjust = async () => {
    const values = await adjustForm.validateFields();
    const newDate = values.date?.format('YYYY-MM-DD');
    const newOwner = values.owner;
    if (!newDate && !newOwner) {
      message.warning('请至少填写任务日期或保养负责人');
      return;
    }
    setPatches(prev => {
      const next = { ...prev };
      selectedKeys.forEach(code => {
        next[code] = {
          ...next[code],
          ...(newDate ? { date: newDate } : {}),
          ...(newOwner ? { owner: newOwner } : {}),
        };
      });
      return next;
    });
    setAdjustOpen(false);
    setSelectedKeys([]);
    message.success(`已调整 ${selectedKeys.length} 项保养任务`);
  };

  const addTaskDevices = (devices) => {
    setTaskDevices(prev => {
      const exist = new Set(prev.map(d => d.code));
      return [...prev, ...devices.filter(d => !exist.has(d.code))];
    });
    setDevicePickerOpen(false);
  };

  return (
    <>
      <PageHeader
        title="保养任务"
        subtitle={`数据更新于 ${meta.demoDay}`}
      />
      <DegradedBanner meta={meta} />
      <FilterBar
        onQuery={() => setKw(kwDraft)}
        onReset={() => { setKw(''); setKwDraft(''); setStatus(null); setOwner(null); setPlanName(null); setDeviceKw(''); setDateRange(null); }}
      >
        <FilterField label="任务名称">
          <Input style={{ width: 200 }} placeholder="任务编号 / 名称 / 执行人" allowClear value={kwDraft}
            onChange={e => { setKwDraft(e.target.value); if (!e.target.value) setKw(''); }} onPressEnter={() => setKw(kwDraft)} />
        </FilterField>
        <FilterField label="任务状态">
          <Select style={{ width: 120 }} allowClear options={statusOptions} value={status} onChange={setStatus} />
        </FilterField>
        <FilterField label="保养负责人">
          <Select style={{ width: 150 }} allowClear options={ownerOptions} value={owner} onChange={setOwner} />
        </FilterField>
        <FilterField label="保养计划名称">
          <Select style={{ width: 200 }} allowClear options={planOptions} value={planName} onChange={setPlanName} />
        </FilterField>
        <FilterField label="设备名称">
          <Input style={{ width: 180 }} placeholder="请输入设备名称" allowClear value={deviceKw}
            onChange={e => setDeviceKw(e.target.value)} />
        </FilterField>
        <FilterField label="任务日期">
          <DatePicker.RangePicker style={{ width: 240 }} value={dateRange} onChange={setDateRange} placeholder={['开始日期', '结束日期']} />
        </FilterField>
      </FilterBar>
      <Card size="small">
        <Space wrap style={{ marginBottom: 12 }}>
          <Button type="primary" onClick={openCreate}>新增保养任务</Button>
          <Button onClick={openAdjust}>调整任务</Button>
          <Button onClick={() => message.info('演示模式：导出功能待业务模块承接')}>导出</Button>
          {selectedKeys.length > 0 && (
            <Popconfirm
              title={`删除选中的 ${selectedKeys.length} 项保养任务？`}
              okButtonProps={{ danger: true }}
              onConfirm={() => {
                setDeletedCodes(prev => {
                  const next = new Set(prev);
                  selectedKeys.forEach(code => next.add(code));
                  return next;
                });
                setExtraRows(prev => prev.filter(r => !selectedKeys.includes(r.code)));
                setSelectedKeys([]);
                message.success('已删除选中的保养任务');
              }}
            >
              <Button danger>删除</Button>
            </Popconfirm>
          )}
        </Space>
        <Table
          rowKey="code" size="small"
          dataSource={list}
          rowSelection={{ columnWidth: 40, selectedRowKeys: selectedKeys, onChange: setSelectedKeys }}
          onRow={(r) => ({ onClick: () => navigate(`/maintenance-tasks/detail?code=${encodeURIComponent(r.code)}`), style: { cursor: 'pointer' } })}
          locale={{
            emptyText: (
              <EmptyState
                description="暂无保养任务"
                reason={kw || status || owner || planName || deviceKw || dateRange ? '当前筛选条件下没有保养任务' : '暂无保养任务数据'}
              />
            ),
          }}
          columns={[
            { title: '任务编号', dataIndex: 'code', width: 160, fixed: 'left' },
            {
              title: '保养任务名称', dataIndex: 'name', width: 190,
              render: (v, r) => (v
                ? <Tooltip title={v === r.plan ? '当前种子数据的任务名称与保养计划名称一致，待数据层拆分后展示真实任务名' : undefined}>{v}</Tooltip>
                : '--'),
            },
            { title: '保养计划名称', dataIndex: 'plan', width: 190, render: v => v || '--' },
            {
              title: '设备名称', dataIndex: 'device', width: 210,
              render: (v) => {
                const d = deviceOf(v);
                return (
                  <span>
                    {d.name}{d.assetCode ? `（${d.assetCode}）` : ''}
                    {d.deviceId ? <Tag style={{ marginLeft: 6 }}>{d.deviceId}</Tag> : null}
                  </span>
                );
              },
            },
            { title: '使用部门', dataIndex: 'dept', width: 150, render: v => v || '--' },
            { title: '任务日期', dataIndex: 'date', width: 110, render: v => v || '--' },
            { title: '保养负责人', dataIndex: 'owner', width: 110, render: v => v || '--' },
            { title: '任务状态', dataIndex: 'status', width: 90, render: v => <StatusTag value={v} /> },
            {
              title: '备注', dataIndex: 'remark', width: 160, ellipsis: true,
              render: v => (v ? <Tooltip title={v}>{v}</Tooltip> : '--'),
            },
            { title: '创建时间', dataIndex: 'createTime', width: 150, render: v => v || '--' },
            {
              title: '操作', width: 190, fixed: 'right',
              render: (_, r) => (
                <Space size={0} onClick={(e) => e.stopPropagation()}>
                  {canExecute(r) && (
                    <Button type="link" size="small" onClick={() => navigate(`/maintenance-tasks/execute?code=${encodeURIComponent(r.code)}`)}>开始保养</Button>
                  )}
                  <Button type="link" size="small" onClick={() => navigate(`/maintenance-tasks/detail?code=${encodeURIComponent(r.code)}`)}>详情</Button>
                  <Button type="link" size="small" onClick={() => openEdit(r)}>编辑</Button>
                  {r.status === '未开始' && (
                    <Popconfirm title="删除该任务？" okButtonProps={{ danger: true }} onConfirm={() => handleDelete(r)}>
                      <Button type="link" size="small" danger>删除</Button>
                    </Popconfirm>
                  )}
                </Space>
              ),
            },
          ]}
          scroll={{ x: 1760 }}
          pagination={{ pageSize: 10, showTotal: t => `共 ${t} 条` }}
        />
      </Card>

      <Modal
        title={editing ? `编辑保养任务（${editing.code}）` : '新增保养任务'}
        width={900}
        open={editorOpen}
        onCancel={() => setEditorOpen(false)}
        onOk={handleSubmit}
        okText={editing ? '保存' : '创建'}
        cancelText="取消"
        destroyOnHidden
      >
        <Alert
          type="info" showIcon style={{ marginBottom: 16 }}
          message={editing ? '保存后同步更新执行信息' : '临时任务；计划类任务由计划生成'}
        />
        <Form form={form} layout="vertical">
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="任务编号" name="code"><Input disabled /></Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="保养任务名称" name="name" rules={[{ required: true, message: '请输入保养任务名称' }]}>
                <Input placeholder="例如：润滑油更换" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="保养计划名称" name="plan">
                <Select allowClear placeholder="可留空（临时任务）"
                  options={maintenancePlans.map(p => ({ value: p.name, label: p.name }))} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="任务日期" name="date" rules={[{ required: true, message: '请选择任务日期' }]}>
                <DatePicker style={{ width: '100%' }} placeholder="请选择日期" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="保养负责人" name="owner"><Input placeholder="例如：王强" /></Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="备注" name="remark"><Input.TextArea rows={2} maxLength={200} /></Form.Item>
            </Col>
          </Row>

          <div style={{ fontWeight: 600, marginBottom: 8 }}>保养项目</div>
          <Space wrap style={{ marginBottom: 8 }}>
            <Select
              mode="multiple" allowClear showSearch style={{ minWidth: 320 }}
              placeholder="选择要执行的保养项目"
              value={itemCodes}
              onChange={setItemCodes}
              optionFilterProp="label"
              options={maintenanceItems.map(i => ({ value: i.code, label: `${i.name}（${i.code}）` }))}
            />
          </Space>
          <Table
            rowKey="code" size="small" pagination={false}
            dataSource={maintenanceItems.filter(i => itemCodes.includes(i.code))}
            locale={{ emptyText: <EmptyState description="暂无保养项目" reason="请在上方选择要执行的保养项目" /> }}
            columns={[
              { title: '保养项目编号', dataIndex: 'code', width: 170 },
              { title: '保养项目名称', dataIndex: 'name', width: 180 },
              { title: '保养部位', dataIndex: 'part', width: 110, render: v => v || '--' },
              { title: '保养级别', dataIndex: 'level', width: 100, render: v => (v ? <Tag>{v}</Tag> : '--') },
              { title: '保养内容', dataIndex: 'require', ellipsis: true, render: v => v || '--' },
              {
                title: '操作', width: 80,
                render: (_, r) => (
                  <Button type="link" size="small" danger onClick={() => setItemCodes(prev => prev.filter(c => c !== r.code))}>
                    删除
                  </Button>
                ),
              },
            ]}
            scroll={{ x: 800 }}
          />

          <div style={{ fontWeight: 600, margin: '16px 0 8px' }}>
            <span style={{ color: '#ff4d4f', marginRight: 4 }}>*</span>保养设备
          </div>
          <Space wrap style={{ marginBottom: 8 }}>
            <Button onClick={() => setDevicePickerOpen(true)}>添加</Button>
            <Button danger onClick={() => setTaskDevices(prev => prev.slice(0, -1))} disabled={!taskDevices.length}>删除</Button>
          </Space>
          <Table
            rowKey="code" size="small" pagination={false}
            dataSource={taskDevices}
            locale={{ emptyText: <EmptyState description="暂无保养设备" reason="请点击「添加」选择保养设备" /> }}
            columns={[
              { title: '设备', dataIndex: 'name', render: v => v || '--' },
              {
                title: '操作', width: 80,
                render: (_, r) => (
                  <Button type="link" size="small" danger onClick={() => setTaskDevices(prev => prev.filter(d => d.code !== r.code))}>
                    删除
                  </Button>
                ),
              },
            ]}
          />
        </Form>
      </Modal>

      <MaintenanceDevicePickerModal
        open={devicePickerOpen}
        title="添加保养设备"
        devices={ledgerDevices}
        selectedCodes={taskDevices.map(d => d.code)}
        onCancel={() => setDevicePickerOpen(false)}
        onConfirm={addTaskDevices}
      />

      <Modal
        title="调整任务"
        width={560}
        open={adjustOpen}
        onCancel={() => setAdjustOpen(false)}
        onOk={handleAdjust}
        okText="确定"
        cancelText="取消"
        destroyOnHidden
      >
        <Form form={adjustForm} layout="vertical">
          <Form.Item label="任务日期" name="date">
            <DatePicker style={{ width: '100%' }} placeholder="请选择日期" />
          </Form.Item>
          <Form.Item label="保养负责人" name="owner">
            <Select allowClear placeholder="请选择保养负责人" options={ownerOptions} />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
