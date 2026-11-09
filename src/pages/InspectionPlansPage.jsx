import React, { useMemo, useState } from 'react';
import { Card, Table, Button, Space, Input, Select, Progress, Modal, Form, App, Alert, Popconfirm, InputNumber, DatePicker, Checkbox, Row, Col } from 'antd';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import PageHeader from '../components/PageHeader.jsx';
import FilterBar, { FilterField } from '../components/FilterBar.jsx';
import DegradedBanner from '../components/DegradedBanner.jsx';
import StatusTag from '../components/StatusTag.jsx';
import EmptyState from '../components/EmptyState.jsx';
import UserPickerModal from '../components/UserPickerModal.jsx';
import InspectionDeviceDetailTable from '../components/InspectionDeviceDetailTable.jsx';
import InspectionDevicePickerModal from '../components/InspectionDevicePickerModal.jsx';
import InspectionItemPickerModal from '../components/InspectionItemPickerModal.jsx';
import { useDemoState } from '../state/DemoStore.jsx';
import { inspectionPlans, inspectionStandards, inspectionItems, inspectionStandardItemCodes, ledgerDevices } from '../data/standardData.js';
import { users } from '../data/demo/masterData.js';
import { INSPECTION_CYCLE_OPTIONS, ownersOf, skipFlagsOf, cycleText } from '../domain/inspection.js';

// 执行周期（原型「添加_编辑点检计划.html」原文）：日 / 周 / 月 / 季度 / 半年 / 年 / 自定义
const CYCLE_OPTIONS = INSPECTION_CYCLE_OPTIONS.map(v => ({ value: v, label: v }));
const OWNER_OPTIONS = users.filter(u => u.status === '在职').map(u => ({ value: u.name, label: `${u.name}（${u.dept}·${u.role}）` }));

const SNAPSHOT_STANDARD_CODE = 'XJBZ20250301001';

// 点检计划（范围外演示模块，由点巡保养业务模块完整承接）：
// 计划列表读自 standardData.js 演示快照；新增 / 编辑 / 提前完结 / 删除为页面内演示交互
//（不写入 DemoStore，刷新后恢复快照）。口径对齐原型：未开始可删除（任务一并删除），
// 进行中可提前完结（已生成任务仍可执行，计划不再生成新任务）。
export default function InspectionPlansPage() {
  const navigate = useNavigate();
  const { message } = App.useApp();
  const state = useDemoState();
  const meta = state.meta;

  const [kw, setKw] = useState('');
  const [kwDraft, setKwDraft] = useState('');
  const [status, setStatus] = useState(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState(null); // null=新增，对象=编辑
  const [form] = Form.useForm();
  // 演示交互的页面内落地：新增行 / 已删除编号 / 字段补丁（编辑、完结）
  const [extraRows, setExtraRows] = useState([]);
  const [deletedCodes, setDeletedCodes] = useState(() => new Set());
  const [patches, setPatches] = useState({});
  // 点检明细（设备）按计划编号存放：{ [planCode]: rows }
  const [detailRows, setDetailRows] = useState({});
  const [devicePickerOpen, setDevicePickerOpen] = useState(false);
  const [itemPickerOpen, setItemPickerOpen] = useState(false);
  const [itemPickerRow, setItemPickerRow] = useState(null);
  const [userPickerOpen, setUserPickerOpen] = useState(false);

  const rows = useMemo(() => [
    ...extraRows,
    ...inspectionPlans.filter(r => !deletedCodes.has(r.code)).map(r => (patches[r.code] ? { ...r, ...patches[r.code] } : r)),
  ], [extraRows, deletedCodes, patches]);

  const statusOptions = [...new Set(rows.map(p => p.status))].map(v => ({ value: v, label: v }));
  const list = useMemo(() => rows
    .filter(p => !status || p.status === status)
    .filter(p => {
      const k = (kw || '').trim().toLowerCase();
      if (!k) return true;
      return [p.code, p.name, ...ownersOf(p)].some(v => (v || '').toLowerCase().includes(k));
    }), [rows, kw, status]);

  const nextCode = `XJJH${(meta.demoDay || '2026-09-16').replaceAll('-', '')}${String(inspectionPlans.length + extraRows.length + 1).padStart(3, '0')}`;

  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({ code: nextCode, cycle: '日', interval: 1, owners: [] });
    setDetailRows(prev => ({ ...prev, [nextCode]: [] }));
    setEditorOpen(true);
  };
  const openEdit = (record) => {
    setEditing(record);
    form.resetFields();
    form.setFieldsValue({
      ...record,
      range: record.startDate && record.endDate ? [dayjs(record.startDate), dayjs(record.endDate)] : undefined,
      owners: ownersOf(record),
      skipSat: skipFlagsOf(record).sat,
      skipSun: skipFlagsOf(record).sun,
    });
    if (!detailRows[record.code]) {
      // 编辑既有计划时，按快照里的关联设备数初始化明细（演示数据无标准↔设备明细表）
      const derived = ledgerDevices.slice(0, record.deviceCount ?? 0).map(d => ({
        code: d.code, name: d.name, model: d.model, type: d.type, dept: d.dept, station: d.station,
        standard: undefined, items: [], itemCount: 0,
      }));
      setDetailRows(prev => ({ ...prev, [record.code]: derived }));
    }
    setEditorOpen(true);
  };
  const handleSubmit = async () => {
    const values = await form.validateFields();
    const owners = values.owners || [];
    const details = detailRows[values.code || nextCode] || [];
    const base = {
      ...(editing || {}),
      code: values.code || nextCode,
      name: values.name,
      cycle: values.cycle,
      interval: values.cycle === '自定义' ? values.interval : undefined,
      startDate: values.range?.[0]?.format('YYYY-MM-DD') ?? (editing?.startDate || undefined),
      endDate: values.range?.[1]?.format('YYYY-MM-DD') ?? (editing?.endDate || undefined),
      skipSat: !!values.skipSat,
      skipSun: !!values.skipSun,
      skip: [values.skipSat && '跳过星期六', values.skipSun && '跳过星期天'].filter(Boolean).join('、'),
      owners,
      owner: owners.join('、'),
      range: undefined,
      remark: values.remark,
      deviceCount: details.length || (editing ? editing.deviceCount : 0),
      totalTasks: editing ? editing.totalTasks : 0,
      doneTasks: editing ? editing.doneTasks : 0,
      createTime: editing ? editing.createTime : `${meta.updatedAt || meta.demoDay || ''}`,
    };
    if (editing) {
      setPatches(prev => ({ ...prev, [editing.code]: { ...prev[editing.code], ...base } }));
      message.success(`点检计划「${values.name}」已保存，变更将同步到未执行的任务及后续按周期生成的任务`);
    } else {
      setExtraRows(prev => [{ ...base, status: '未开始' }, ...prev]);
      message.success(`点检计划「${values.name}」已创建，系统将按周期自动生成点检任务（提前生成今天后 7 天内的任务）`);
    }
    setEditorOpen(false);
  };
  const handleFinish = (record) => {
    setPatches(prev => ({ ...prev, [record.code]: { ...prev[record.code], status: '已关闭' } }));
    message.success(`计划「${record.name}」已提前完结，已生成的任务仍可继续执行，计划不再生成新任务`);
  };
  const handleDelete = (record) => {
    if (extraRows.some(r => r.code === record.code)) setExtraRows(prev => prev.filter(r => r.code !== record.code));
    else setDeletedCodes(prev => new Set(prev).add(record.code));
    message.success(`已删除计划「${record.name}」（${record.code}），对应生成的点检任务一并删除`);
  };

  const currentPlanCode = editing ? editing.code : nextCode;
  const currentDetails = detailRows[currentPlanCode] || [];
  const setCurrentDetails = (next) => setDetailRows(prev => ({ ...prev, [currentPlanCode]: next }));

  const columns = [
    { title: '序号', width: 60, align: 'center', render: (_, __, i) => i + 1 },
    { title: '点检计划编号', dataIndex: 'code', width: 170, fixed: 'left' },
    { title: '点检计划名称', dataIndex: 'name', width: 200 },
    { title: '计划开始日期', dataIndex: 'startDate', width: 120, render: v => v || '--' },
    { title: '计划结束日期', dataIndex: 'endDate', width: 120, render: v => v || '--' },
    { title: '执行周期', width: 230, render: (_, r) => cycleText(r) },
    { title: '设备数量', dataIndex: 'deviceCount', width: 90, align: 'center', render: v => (v != null ? `${v} 台` : '--') },
    { title: '现有任务', dataIndex: 'totalTasks', width: 90, align: 'center', render: v => (v != null ? `${v} 条` : '--') },
    { title: '已完成任务', dataIndex: 'doneTasks', width: 100, align: 'center', render: v => (v != null ? `${v} 条` : '--') },
    {
      title: '任务完成情况', width: 160,
      render: (_, r) => (
        <Space size={6}>
          <Progress percent={r.totalTasks ? Math.round((r.doneTasks / r.totalTasks) * 100) : 0} size="small" style={{ width: 80 }} />
          <span style={{ fontSize: 12, color: '#8a97a3' }}>{r.doneTasks ?? '--'}/{r.totalTasks ?? '--'}</span>
        </Space>
      ),
    },
    { title: '点检负责人', width: 140, render: (_, r) => { const o = ownersOf(r); return o.length ? o.join('、') : '--'; } },
    { title: '点检计划状态', dataIndex: 'status', width: 100, render: v => <StatusTag value={v} /> },
    { title: '创建时间', dataIndex: 'createTime', width: 160, render: v => v || '--' },
    { title: '备注', dataIndex: 'remark', ellipsis: true, render: v => v || '--' },
    {
      title: '操作', width: 180, fixed: 'right',
      render: (_, r) => (
        <Space size={0} onClick={(e) => e.stopPropagation()}>
          <Button type="link" size="small" onClick={() => navigate(`/inspection-plans/detail?code=${encodeURIComponent(r.code)}`)}>详情</Button>
          <Button type="link" size="small" onClick={() => openEdit(r)}>编辑</Button>
          {['未开始', '进行中'].includes(r.status) && (
            <Popconfirm title="提前完结该计划？" description="已生成的任务仍可继续执行，计划不再生成新任务" onConfirm={() => handleFinish(r)}>
              <Button type="link" size="small">完结</Button>
            </Popconfirm>
          )}
          {r.status === '未开始' && (
            <Popconfirm title="删除该计划？" description="删除后对应生成的点检任务将一并删除" okButtonProps={{ danger: true }} onConfirm={() => handleDelete(r)}>
              <Button type="link" size="small" danger>删除</Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="点检计划"
        subtitle={`数据更新于 ${meta.demoDay}`}
      />
      <DegradedBanner meta={meta} />
      <FilterBar onQuery={() => setKw(kwDraft)} onReset={() => { setKw(''); setKwDraft(''); setStatus(null); }}>
        <FilterField label="计划名称">
          <Input style={{ width: 240 }} placeholder="计划编号 / 名称 / 负责人" allowClear value={kwDraft}
            onChange={e => { setKwDraft(e.target.value); if (!e.target.value) setKw(''); }} onPressEnter={() => setKw(kwDraft)} />
        </FilterField>
        <FilterField label="状态">
          <Select style={{ width: 120 }} allowClear options={statusOptions} value={status} onChange={setStatus} />
        </FilterField>
      </FilterBar>
      <Card size="small">
        <Space wrap style={{ marginBottom: 12 }}>
          <Button type="primary" onClick={openCreate}>新增点检计划</Button>
        </Space>
        <Table
          rowKey="code" size="small"
          dataSource={list}
          columns={columns}
          onRow={(r) => ({ onClick: () => navigate(`/inspection-plans/detail?code=${encodeURIComponent(r.code)}`), style: { cursor: 'pointer' } })}
          locale={{ emptyText: <EmptyState description="暂无点检计划" reason={kw || status ? '当前筛选条件下没有点检计划' : '暂无点检计划数据'} /> }}
          scroll={{ x: 2300 }}
          pagination={{ pageSize: 10, showTotal: t => `共 ${t} 条` }}
        />
      </Card>

      <Modal
        title={editing ? `编辑点检计划（${editing.code}）` : '新增点检计划'}
        width={960}
        open={editorOpen}
        onCancel={() => setEditorOpen(false)}
        onOk={handleSubmit}
        okText={editing ? '保存' : '创建'}
        cancelText="取消"
        destroyOnClose
      >
        <Alert
          type="info" showIcon style={{ marginBottom: 16 }}
          message={editing
            ? '保存后同步到未执行及后续任务，周期不可修改'
            : '保存后按周期自动生成点检任务'}
          description={(
            <ul style={{ paddingLeft: 18, margin: 0, fontSize: 12, lineHeight: 1.9 }}>
              <li>以计划开始日期作为循环生成任务的第一天，在计划开始-结束周期内按执行周期生成任务；提前生成今天后 7 天内的任务。</li>
              <li>执行周期：日（每天）、周（每周）、月（按月）、季度（按 3 个月）、半年（按 6 个月）、年（按一年）；选择「自定义」时需输入间隔天数。</li>
              <li>勾选跳过星期六 / 跳过星期天：生成的任务若落在被跳过的星期，则自动往后调整一天；若调整后超过计划结束日期，则不生成该任务。</li>
              <li>负责人可以多选；计划可编辑，保存后自动同步到未执行的任务及后续按新计划生成的任务。</li>
            </ul>
          )}
        />
        <Form form={form} layout="vertical">
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="计划编号" name="code"><Input disabled /></Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="计划名称" name="name" rules={[{ required: true, message: '请输入计划名称' }]}>
                <Input placeholder="例如：数控车床日常点检计划" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="执行周期" name="cycle" rules={[{ required: true, message: '请选择执行周期' }]}>
                <Select options={CYCLE_OPTIONS} placeholder="请选择执行周期" />
              </Form.Item>
            </Col>
            <Col span={12}>
              {/* 间隔天数：仅在执行周期为「自定义」时显示（原型规则） */}
              <Form.Item noStyle shouldUpdate={(a, b) => a.cycle !== b.cycle}>
                {({ getFieldValue }) => (getFieldValue('cycle') === '自定义' ? (
                  <Form.Item label="间隔天数" name="interval" rules={[{ required: true, message: '请输入间隔天数' }]}>
                    <InputNumber min={1} style={{ width: '100%' }} addonAfter="天" placeholder="请输入间隔天数" />
                  </Form.Item>
                ) : null)}
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="计划开始日期" name="range" rules={[{ required: true, message: '请选择计划起止日期' }]}>
                <DatePicker.RangePicker style={{ width: '100%' }} placeholder={['请选择日期', '请选择日期']} />
              </Form.Item>
            </Col>
            <Col span={18}>
              <Form.Item label="点检负责人" name="owners" extra="执行点检任务的人，支持多选">
                <Select
                  mode="multiple"
                  allowClear
                  placeholder="请选择点检负责人（支持多选）"
                  options={OWNER_OPTIONS}
                  optionFilterProp="label"
                />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item label="人员主数据" style={{ marginTop: 30 }}>
                <Button onClick={() => setUserPickerOpen(true)}>从人员主数据选择</Button>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="跳过星期六" name="skipSat" valuePropName="checked">
                <Checkbox>勾选后落在星期六的任务顺延一天</Checkbox>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="跳过星期天" name="skipSun" valuePropName="checked">
                <Checkbox>勾选后落在星期天的任务顺延一天</Checkbox>
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item label="备注" name="remark">
                <Input.TextArea rows={2} maxLength={200} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item label="点检明细" style={{ marginBottom: 0 }}>
            <InspectionDeviceDetailTable
              rows={currentDetails}
              onChange={setCurrentDetails}
              standards={inspectionStandards}
              onPickDevices={() => setDevicePickerOpen(true)}
              onPickItems={(r) => { setItemPickerRow(r); setItemPickerOpen(true); }}
            />
          </Form.Item>
        </Form>
      </Modal>

      <UserPickerModal
        open={userPickerOpen}
        title="选择点检负责人"
        onCancel={() => setUserPickerOpen(false)}
        onSelect={(u) => {
          const cur = form.getFieldValue('owners') || [];
          if (!cur.includes(u.name)) form.setFieldValue('owners', [...cur, u.name]);
          setUserPickerOpen(false);
          message.success(`已添加负责人「${u.name}」`);
        }}
      />

      <InspectionDevicePickerModal
        open={devicePickerOpen}
        devices={ledgerDevices}
        excludeCodes={currentDetails.map(r => r.code)}
        onCancel={() => setDevicePickerOpen(false)}
        onConfirm={(picked) => {
          setCurrentDetails([...currentDetails, ...picked.map(d => ({ ...d, items: [], itemCount: 0 }))]);
          setDevicePickerOpen(false);
          message.success(`已添加 ${picked.length} 台设备到点检明细`);
        }}
      />

      <InspectionItemPickerModal
        open={itemPickerOpen}
        standards={inspectionStandards}
        items={inspectionItems}
        standardItemCodes={inspectionStandardItemCodes}
        snapshotStandardCode={SNAPSHOT_STANDARD_CODE}
        defaultStandard={itemPickerRow?.standard}
        assignedCodes={itemPickerRow?.items || []}
        onCancel={() => setItemPickerOpen(false)}
        onConfirm={(pickedItems, standard) => {
          setCurrentDetails(currentDetails.map(r => (r.code === itemPickerRow?.code
            ? { ...r, standard: standard || r.standard, items: pickedItems.map(i => i.code), itemCount: pickedItems.length }
            : r)));
          setItemPickerOpen(false);
          message.success(`已为设备「${itemPickerRow?.name}」设置 ${pickedItems.length} 个点检项目`);
        }}
      />
    </>
  );
}
