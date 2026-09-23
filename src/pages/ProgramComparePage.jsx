// ============================================================
// 程序参数比对（/program-compare · 数据接入域）
// 比对行来自 store（selectProgramCompare，PC-001..004）；
// 行展开展示基线 vs 实际参数（programBaselines，超容差 match=false 标红）。
// 参数不一致行（PC-001 / DEV-002）关联报警 ALM-20260916-003：可跳转报警中心与比对处理记录。
// 只读演示：比对由接入服务下发程序后自动执行，本页不修改比对事实。
// ============================================================

import React, { useMemo, useState } from 'react';
import { Button, Card, Select, Space, Table, Tag, Typography, Input } from 'antd';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, FileSearch } from 'lucide-react';
import PageHeader from '../components/PageHeader.jsx';
import { useDemoState } from '../state/DemoStore.jsx';
import { selectProgramCompare } from '../state/selectors.js';

const resultColor = { '一致': 'success', '参数不一致': 'warning', '比对失败': 'error', '不适用': 'default' };
const handledColor = { '无需处理': 'default', '处理中': 'processing', '待确认': 'warning' };

export default function ProgramComparePage() {
  const state = useDemoState();
  const navigate = useNavigate();

  const rows = useMemo(() => selectProgramCompare(state), [state]);
  // 查询条件（前端过滤）：设备 / 比对结果
  const [qDevice, setQDevice] = useState(null);
  const [qResult, setQResult] = useState(null);
  const deviceOptions = useMemo(() => [...new Map(rows.map((r) => [r.deviceId, { value: r.deviceId, label: `${r.deviceName}（${r.deviceId}）` }])).values()], [rows]);
  const filteredRows = useMemo(() => rows.filter((r) => (!qDevice || r.deviceId === qDevice) && (!qResult || r.result === qResult)), [rows, qDevice, qResult]);
  // UI 局部状态：展开行（详情 = 行展开查看基线 vs 实际参数）
  const [expandedKeys, setExpandedKeys] = useState([]);

  const renderBaselineDetail = (record) => {
    const key = `${record.program}|${record.version}`;
    const params = state.entities.programBaselines[key];
    if (!params || !params.length) {
      return <Typography.Text type="secondary" style={{ fontSize: 12 }}>无程序下发基线（{key} 不存在基线参数明细）</Typography.Text>;
    }
    const mismatch = params.filter((p) => !p.match).length;
    return (
      <div style={{ padding: '4px 0' }}>
        <Space size={8} style={{ marginBottom: 6 }}>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>基线参数明细（基线 vs 实际，容差 {record.tolerance || '--'}）</Typography.Text>
          {mismatch > 0 ? <Tag color="error">{mismatch} 项超容差</Tag> : <Tag color="success">全部在容差内</Tag>}
        </Space>
        <Table
          rowKey="param" size="small" pagination={false}
          dataSource={params}
          columns={[
            { title: '参数', dataIndex: 'param', width: 140 },
            { title: '基线值', dataIndex: 'baseline', width: 120, render: (v) => v || '--' },
            {
              title: '实际值', dataIndex: 'actual', width: 160,
              render: (v, p) => (p.match ? (v || '--') : <span style={{ color: '#cf1322', fontWeight: 600 }}>{v || '--'}</span>),
            },
            {
              title: '容差', dataIndex: 'tolerance', width: 90,
              render: (v, p) => (p.match ? (v || '--') : <span style={{ color: '#cf1322' }}>{v || '--'}</span>),
            },
            { title: '比对', width: 100, render: (_, p) => (p.match ? <Tag color="success">一致</Tag> : <Tag color="error">超容差</Tag>) },
          ]}
        />
      </div>
    );
  };

  return (
    <>
      <PageHeader
        title="程序参数比对"
        subtitle="程序下发后自动比对基线参数与设备实际参数（超容差标红）· 比对由接入服务执行，本页只读"
      />
      <Card size="small">
        <Space wrap style={{ marginBottom: 12 }}>
          <Select style={{ width: 220 }} placeholder="设备" allowClear showSearch optionFilterProp="label"
            value={qDevice} onChange={setQDevice} options={deviceOptions} />
          <Select style={{ width: 140 }} placeholder="比对结果" allowClear value={qResult} onChange={setQResult}
            options={['一致', '参数不一致', '比对失败', '不适用'].map((v) => ({ value: v, label: v }))} />
          <Button onClick={() => { setQDevice(null); setQResult(null); }}>重置</Button>
          <span style={{ fontSize: 12, color: '#8a97a3' }}>共 {filteredRows.length} 条</span>
        </Space>
        <Table
          rowKey="recordId" size="small"
          scroll={{ x: 1350 }}
          dataSource={filteredRows}
          pagination={false}
          expandable={{
            expandedRowKeys: expandedKeys,
            onExpandedRowsChange: (keys) => setExpandedKeys(keys),
            expandedRowRender: renderBaselineDetail,
            rowExpandable: (r) => ['参数不一致', '一致', '比对失败'].includes(r.result),
          }}
          columns={[
            { title: '比对记录', dataIndex: 'recordId', width: 150, fixed: 'left' },
            { title: '设备', width: 160, render: (_, r) => `${r.deviceName || '--'}（${r.deviceId}）` },
            { title: '程序', dataIndex: 'program', width: 90 },
            { title: '版本', dataIndex: 'version', width: 80 },
            { title: '基线编号', dataIndex: 'baseline', width: 90, render: (v) => (v ?? '--') },
            {
              title: '比对结果', dataIndex: 'result', width: 110,
              render: (v) => <Tag color={resultColor[v] || 'default'}>{v}</Tag>,
            },
            { title: '差异 / 失败原因', dataIndex: 'diff', width: 260, render: (v) => v || '--' },
            { title: '容差', dataIndex: 'tolerance', width: 80, render: (v) => v || '--' },
            {
              title: '处理状态', dataIndex: 'handled', width: 100,
              render: (v) => <Tag color={handledColor[v] || 'default'}>{v}</Tag>,
            },
            { title: '处理人', dataIndex: 'user', width: 90, render: (v) => v || '--' },
            { title: '时间', dataIndex: 'time', width: 90, render: (v) => v || '--' },
            {
              title: '关联报警', dataIndex: 'relatedAlarmId', width: 160,
              render: (v) => (v
                ? (
                  <a onClick={() => navigate('/alarm-center')}>
                    <Space size={4}>{v} <ArrowRight size={12} /></Space>
                  </a>
                )
                : '--'),
            },
            {
              title: '操作', width: 150, fixed: 'right',
              render: (_, r) => (
                <Space size={10}>
                  <a onClick={() => setExpandedKeys((keys) => (keys.includes(r.recordId) ? keys.filter((k) => k !== r.recordId) : [...keys, r.recordId]))}>
                    <Space size={4}><FileSearch size={12} />{expandedKeys.includes(r.recordId) ? '收起' : '详情'}</Space>
                  </a>
                  {r.result === '参数不一致' && (
                    <a onClick={() => navigate('/program-handle-record')}>处理记录</a>
                  )}
                </Space>
              ),
            },
          ]}
        />
        <div style={{ color: '#5d6b78', fontSize: 12, marginTop: 8 }}>
          说明：行展开可查看「基线 vs 实际」逐项参数（超容差项标红）。PC-20260916-001（CNC加工中心-02）参数不一致，关联报警
          {' '}ALM-20260916-003，处置依据见「比对处理记录」PCR-20260916-001（关联维修工单 RO-20260916-001）。
        </div>
      </Card>
    </>
  );
}
