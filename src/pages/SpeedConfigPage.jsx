import React, { useMemo, useState, useEffect } from 'react';
import { Table, Button, Input, Space, Modal, Form, InputNumber, DatePicker, Tag, App, Card } from 'antd';
import { useDemoState, useDemoActions } from '../state/DemoStore.jsx';
import { selectOeeRecomputeLog } from '../state/selectors.js';
import PageHeader from '../components/PageHeader.jsx';
import DegradedBanner from '../components/DegradedBanner.jsx';

// 理想生产速度配置：设备 × 物料的性能率基准（性能率 = 实际速度 / 理想速度）。
// 数据来自 store（speedConfigsById）；保存走 actions.saveSpeedConfig：版本 +1、
// 生效日期必填（演示环境生效日期以演示时钟记录），保存后 selector 按新理想速度重算实时/日 OEE。

export default function SpeedConfigPage() {
  const state = useDemoState();
  const actions = useDemoActions();
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [filters, setFilters] = useState({ deviceCode: '', materialCode: '', materialName: '' });
  const [editing, setEditing] = useState(null); // null | row

  // reducer 校验不通过时（actions 层不预判），统一在此反馈
  const lastAction = state.meta.lastAction;
  useEffect(() => {
    if (lastAction && lastAction.ok === false) message.error(lastAction.message);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastAction?.actionId]);

  const rows = useMemo(() => Object.values(state.entities.speedConfigsById), [state]);

  const recomputeLogs = useMemo(
    () => selectOeeRecomputeLog(state).slice(0, 3),
    [state],
  );

  const filtered = useMemo(() => {
    const f = Object.fromEntries(Object.entries(filters).map(([k, v]) => [k, v.trim().toLowerCase()]));
    return rows.filter(r =>
      (!f.deviceCode || (r.deviceName || '').toLowerCase().includes(f.deviceCode) || (r.deviceId || '').toLowerCase().includes(f.deviceCode)) &&
      (!f.materialCode || (r.materialCode || '').toLowerCase().includes(f.materialCode)) &&
      (!f.materialName || (r.materialName || '').toLowerCase().includes(f.materialName)));
  }, [rows, filters]);

  const setF = (k) => (e) => setFilters(s => ({ ...s, [k]: e?.target ? e.target.value : e }));

  const handleSubmit = async () => {
    const v = await form.validateFields(); // 页面只做必填/数值校验；版本与重算交给 actions/reducer
    const res = actions.saveSpeedConfig(editing.id, v.idealSpeed);
    if (res.ok) message.success(`${res.message}；保存后实时 OEE 按新理想速度重算`);
    setEditing(null);
  };

  return (
    <>
      <DegradedBanner meta={state.meta} />
      <PageHeader title="理想生产速度配置" />
      <Card size="small" style={{ marginBottom: 12 }}>
        <Space wrap size={8}>
          <Input.Search allowClear placeholder="设备名称 / 编号" style={{ width: 240 }} value={filters.deviceCode} onChange={setF('deviceCode')} />
          <Input.Search allowClear placeholder="物料编码" style={{ width: 180 }} value={filters.materialCode} onChange={setF('materialCode')} />
          <Input.Search allowClear placeholder="物料名称" style={{ width: 180 }} value={filters.materialName} onChange={setF('materialName')} />
          <Button onClick={() => setFilters({ deviceCode: '', materialCode: '', materialName: '' })}>重置</Button>
        </Space>
      </Card>
      <Table
        rowKey="id" size="small" scroll={{ x: 1100 }}
        dataSource={filtered}
        columns={[
          { title: '设备编号', dataIndex: 'deviceId', width: 100 },
          { title: '设备名称', dataIndex: 'deviceName', width: 150 },
          { title: '物料编码', dataIndex: 'materialCode', width: 180 },
          { title: '物料名称', dataIndex: 'materialName' },
          { title: '理想生产速度（个/小时）', dataIndex: 'idealSpeed', width: 170, align: 'right', render: v => (v == null ? '--' : v) },
          { title: '版本', dataIndex: 'version', width: 80, align: 'center', render: v => `v${v ?? '--'}` },
          { title: '生效日期', dataIndex: 'effectiveFrom', width: 150 },
          {
            title: '状态', dataIndex: 'status', width: 90,
            render: v => (v === '生效' ? <Tag color="success">生效</Tag> : <Tag>{v || '--'}</Tag>),
          },
          {
            title: '操作', width: 90,
            render: (_, r) => <a onClick={() => { setEditing(r); form.resetFields(); }}>编辑</a>,
          },
        ]}
      />
      <Modal
        title={`编辑理想生产速度（${editing?.deviceName || ''} / ${editing?.materialName || ''}）`}
        open={!!editing}
        onOk={handleSubmit}
        onCancel={() => setEditing(null)}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" initialValues={editing ? { idealSpeed: editing.idealSpeed } : undefined}>
          <Form.Item label="设备 / 物料">
            <Input disabled value={`${editing?.deviceName || '--'} / ${editing?.materialName || '--'}`} />
          </Form.Item>
          <Form.Item
            name="idealSpeed" label="理想生产速度（个/小时）"
            rules={[{ required: true, message: '请输入理想生产速度' }]}
          >
            <InputNumber min={0.1} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item
            name="effectiveFrom" label="生效日期"
            rules={[{ required: true, message: '请选择生效日期' }]}
            extra="保存后版本自动 +1"
          >
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>
      <Card title="最近 OEE 重算记录" size="small">
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
    </>
  );
}
