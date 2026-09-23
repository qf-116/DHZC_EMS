// ============================================================
// 比对处理记录（/program-handle-record · 数据接入域）
// programHandles 只读列表（PCR-001 关联报警 ALM-20260916-003 与维修单 RO-20260916-001），
// 展示 impactScope（影响范围/处置依据）。处理记录不可删除、不可修改。
// 详情为弹窗；关联报警跳转 /alarm-center，关联维修单跳转维修详情。
// ============================================================

import React, { useMemo, useState } from 'react';
import { App, Button, Card, Input, Modal, Select, Space, Table, Tag, Typography } from 'antd';
import { Download } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../components/PageHeader.jsx';
import { useDemoState } from '../state/DemoStore.jsx';
import { selectProgramHandles } from '../state/selectors.js';

export default function ProgramHandleRecordPage() {
  const state = useDemoState();
  const navigate = useNavigate();
  const { message } = App.useApp();
  const [detail, setDetail] = useState(null); // UI 局部状态：详情弹窗

  const rows = useMemo(() => selectProgramHandles(state), [state]);
  // 查询条件（前端过滤）：设备 / 关键字（记录号/程序/处理人/结论）
  const [qDevice, setQDevice] = useState(null);
  const [qKw, setQKw] = useState('');
  const deviceOptions = useMemo(() => [...new Map(rows.map((r) => [r.deviceId, { value: r.deviceId, label: `${r.deviceName}（${r.deviceId}）` }])).values()], [rows]);
  const kw = qKw.trim();
  const filteredRows = useMemo(() => rows.filter((r) => (!qDevice || r.deviceId === qDevice)
    && (!kw || [r.recordId, r.program, r.handler, r.conclusion, r.action].some((v) => String(v || '').includes(kw)))), [rows, qDevice, kw]);

  const fieldRows = (r) => [
    ['处理记录', r.recordId],
    ['设备', `${r.deviceName || '--'}（${r.deviceId}）`],
    ['程序 / 版本', r.program || '--'],
    ['处理人', r.handler || '--'],
    ['处理时间', r.time || '--'],
    ['处理结论', r.conclusion || '--'],
    ['处理措施', r.action || '--'],
    ['影响范围 / 处置依据', r.impactScope || '--'],
    ['关联报警', r.relatedAlarmId || '--'],
    ['关联维修单', r.relatedRepairOrderId || '--'],
    ['附件', r.attachment || '--'],
  ];

  return (
    <>
      <PageHeader
        title="比对处理记录"
        subtitle="程序参数比对的处理留痕 · 记录不可删除、不可修改（只读）"
      />
      {/* 筛选卡：查询条件独立在列表卡上方 */}
      <Card size="small" style={{ marginBottom: 12 }}>
        <Space wrap>
          <Select style={{ width: 220 }} placeholder="设备" allowClear showSearch optionFilterProp="label"
            value={qDevice} onChange={setQDevice} options={deviceOptions} />
          <Input style={{ width: 240 }} allowClear placeholder="搜索：记录号 / 程序 / 处理人 / 结论"
            value={qKw} onChange={(e) => setQKw(e.target.value)} />
          <Button onClick={() => { setQDevice(null); setQKw(''); }}>重置</Button>
          <span style={{ fontSize: 12, color: '#8a97a3' }}>共 {filteredRows.length} 条</span>
        </Space>
      </Card>
      {/* 列表卡：操作工具栏 → 表格 */}
      <Card size="small">
        <Space wrap style={{ marginBottom: 12 }}>
          <Button icon={<Download size={14} />} onClick={() => message.success('已导出比对处理记录')}>导出</Button>
        </Space>
        <Table
          rowKey="recordId" size="small"
          scroll={{ x: 1350 }}
          dataSource={filteredRows}
          columns={[
            { title: '处理记录', dataIndex: 'recordId', width: 160, fixed: 'left' },
            { title: '设备', width: 170, render: (_, r) => `${r.deviceName || '--'}（${r.deviceId}）` },
            { title: '程序 / 版本', dataIndex: 'program', width: 130, render: (v) => v || '--' },
            { title: '处理人', dataIndex: 'handler', width: 90, render: (v) => v || '--' },
            { title: '处理时间', dataIndex: 'time', width: 100, render: (v) => v || '--' },
            { title: '处理结论', dataIndex: 'conclusion', width: 170, render: (v) => v || '--' },
            { title: '处理措施', dataIndex: 'action', width: 240, render: (v) => v || '--' },
            {
              title: '影响范围 / 处置依据', dataIndex: 'impactScope', width: 260,
              render: (v) => (v && v !== '--'
                ? <Typography.Paragraph style={{ marginBottom: 0, fontSize: 12 }} ellipsis={{ rows: 2, expandable: true }}>{v}</Typography.Paragraph>
                : '--'),
            },
            {
              title: '关联报警', dataIndex: 'relatedAlarmId', width: 170,
              render: (v) => (v
                ? <a onClick={() => navigate('/alarm-center')}><Space size={4}><Tag color="orange" style={{ marginRight: 0 }}>{v}</Tag></Space></a>
                : '--'),
            },
            {
              title: '关联维修单', dataIndex: 'relatedRepairOrderId', width: 170,
              render: (v) => (v
                ? <a onClick={() => navigate(`/repair-orders/${v}`)}>{v}</a>
                : '--'),
            },
            { title: '附件', dataIndex: 'attachment', width: 130, render: (v) => v || '--' },
            { title: '操作', width: 80, fixed: 'right', render: (_, r) => <a onClick={() => setDetail(r)}>详情</a> },
          ]}
          pagination={false}
        />
        <div style={{ color: '#5d6b78', fontSize: 12, marginTop: 8 }}>
          说明：处理记录由处置动作自动生成（如 PCR-20260916-001：ALM-20260916-003 的处置依据，关联维修单 RO-20260916-001），
          不可删除、不可修改；比对结果恢复一致后可关闭关联报警。
        </div>
      </Card>

      {/* 详情（弹窗）：只读展示处理记录全部字段 */}
      <Modal
        title={`处理记录详情（${detail?.recordId || ''}）`}
        width={640}
        open={!!detail}
        footer={<Button type="primary" onClick={() => setDetail(null)}>关闭</Button>}
        onCancel={() => setDetail(null)}
      >
        {detail && (
          <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
            <tbody>
              {fieldRows(detail).map(([k, v]) => (
                <tr key={k}>
                  <td style={{ padding: '6px 8px', color: '#5d6b78', width: 150, verticalAlign: 'top', borderBottom: '1px solid #eef1f4' }}>{k}</td>
                  <td style={{ padding: '6px 8px', lineHeight: 1.7, borderBottom: '1px solid #eef1f4' }}>{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Modal>
    </>
  );
}
