import React, { useMemo, useState, useEffect } from 'react';
import { Table, Input, Modal, Form, InputNumber, Tag, App, Card, Tooltip } from 'antd';
import { Info } from 'lucide-react';
import { useDemoState, useDemoActions } from '../state/DemoStore.jsx';
import { selectOeeRecomputeLog } from '../state/selectors.js';
import PageHeader from '../components/PageHeader.jsx';
import DegradedBanner from '../components/DegradedBanner.jsx';
import FilterBar, { FilterField } from '../components/FilterBar.jsx';

// 理论生产速度配置（2026-11-05 简化）：设备级单值，单位「秒/件」——去掉设备 × 物料维度。
// 性能率 = 产量 ÷ (理论速度 × 运行时间)；换产物料导致速度变化较大时人工调整。
// 数据来自 store（speedConfigsById）；保存走 actions.saveSpeedConfig：版本 +1 并触发 OEE 重算。

export default function SpeedConfigPage() {
  const state = useDemoState();
  const actions = useDemoActions();
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [filters, setFilters] = useState({ device: '' });
  const [editing, setEditing] = useState(null); // null | row

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
    const k = (filters.device || '').trim().toLowerCase();
    if (!k) return rows;
    return rows.filter(r => `${r.deviceName || ''} ${r.deviceId || ''}`.toLowerCase().includes(k));
  }, [rows, filters]);

  const handleSubmit = async () => {
    const v = await form.validateFields();
    const res = actions.saveSpeedConfig(editing.id, v.idealSpeedSec);
    if (res.ok) message.success(`${res.message}；保存后实时 / 日 OEE 按新理论速度重算`);
    setEditing(null);
  };

  return (
    <>
      <DegradedBanner meta={state.meta} />
      <PageHeader
        title="理论生产速度配置"
      />
      <FilterBar onQuery={() => {}} onReset={() => setFilters({ device: '' })}>
        <FilterField label="设备">
          <Input allowClear placeholder="设备名称 / 编号" style={{ width: 240 }} value={filters.device} onChange={(e) => setFilters({ device: e.target.value })} />
        </FilterField>
      </FilterBar>
      <Table
        rowKey="id" size="small" scroll={{ x: 760 }}
        dataSource={filtered}
        columns={[
          { title: '设备编号', dataIndex: 'deviceId', width: 100 },
          { title: '设备名称', dataIndex: 'deviceName', width: 180 },
          {
            title: (
              <Tooltip title="生产一件的理论耗时（秒/件）——性能率 = 理论节拍 × 产量 ÷ 运行时间；换产物料导致速度变化较大时人工调整">
                <span>理论生产速度（秒/件）<Info size={13} style={{ marginLeft: 3, verticalAlign: '-2px', color: '#8a97a3' }} /></span>
              </Tooltip>
            ),
            dataIndex: 'idealSpeedSec', width: 180, align: 'right',
            render: v => (v == null ? '--' : `${v} 秒/件`),
          },
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
        title={`编辑理论生产速度（${editing?.deviceName || ''}）`}
        open={!!editing}
        onOk={handleSubmit}
        onCancel={() => setEditing(null)}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" initialValues={editing ? { idealSpeedSec: editing.idealSpeedSec } : undefined}>
          <Form.Item label="设备">
            <Input disabled value={editing?.deviceName || '--'} />
          </Form.Item>
          <Form.Item
            name="idealSpeedSec" label="理论生产速度（秒/件）"
            rules={[{ required: true, message: '请输入理论生产速度' }]}
            extra="性能率 = 理论节拍 × 产量 ÷ 运行时间；换产物料速度变化较大时请人工调整此值。保存后版本自动 +1 并触发 OEE 重算。"
          >
            <InputNumber min={0.1} style={{ width: '100%' }} addonAfter="秒/件" />
          </Form.Item>
        </Form>
      </Modal>
      <Card title="最近 OEE 重算记录" size="small" style={{ marginTop: 12 }}>
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
