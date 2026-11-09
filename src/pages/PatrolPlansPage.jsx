import React, { useMemo, useState } from 'react';
import { Card, Table, Button, Space, Input, Select, Modal, Form, App, Popconfirm, InputNumber, DatePicker, Alert, Checkbox, Row, Col } from 'antd';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import PageHeader from '../components/PageHeader.jsx';
import FilterBar, { FilterField } from '../components/FilterBar.jsx';
import DegradedBanner from '../components/DegradedBanner.jsx';
import StatusTag from '../components/StatusTag.jsx';
import EmptyState from '../components/EmptyState.jsx';
import UserPickerModal from '../components/UserPickerModal.jsx';
import PatrolDeviceDetailTable from '../components/PatrolDeviceDetailTable.jsx';
import PatrolDevicePickerModal from '../components/PatrolDevicePickerModal.jsx';
import PatrolItemPickerModal from '../components/PatrolItemPickerModal.jsx';
import { useDemoState } from '../state/DemoStore.jsx';
import { patrolPlans, patrolStandards, patrolPlanDevices, patrolItems } from '../data/standardData.js';
import { users } from '../data/demo/masterData.js';

// 执行周期（原型原文）：日、周、月、季度、半年、年、自定义
const CYCLE_OPTIONS = ['日', '周', '月', '季度', '半年', '年', '自定义'].map(v => ({ value: v, label: v }));
const OWNER_OPTIONS = users.filter(u => u.status === '在职').map(u => ({ value: u.name, label: `${u.name}（${u.dept}·${u.role}）` }));

// 负责人存储形态：结构化数组 owners[]；兼容历史快照的 owner 字符串（以「、」分隔）
export const ownersOf = (r) => {
  if (Array.isArray(r?.owners)) return r.owners;
  const s = r?.owner || '';
  return s ? String(s).split(/[、,，]/).map(x => x.trim()).filter(Boolean) : [];
};

// 跳过星期六/星期天：结构化存储 skipSat / skipSun；兼容历史快照的 skip 文本
export const skipFlagsOf = (r) => ({
  sat: r?.skipSat != null ? !!r.skipSat : /星期六/.test(r?.skip || ''),
  sun: r?.skipSun != null ? !!r.skipSun : /星期天|星期日/.test(r?.skip || ''),
});

export const cycleText = (r) => {
  if (!r || !r.cycle) return '--';
  const base = r.cycle === '自定义' && r.interval ? `自定义 · 每 ${r.interval} 天` : r.cycle;
  const { sat, sun } = skipFlagsOf(r);
  const skips = [sat && '跳过星期六', sun && '跳过星期天'].filter(Boolean);
  return skips.length ? `${base} · ${skips.join('、')}` : base;
};

// 巡检计划（范围外演示模块）：列表读自 standardData.js 种子快照。
// 新增 / 编辑 / 提前完结 / 删除为页面内演示交互（不写入 DemoStore，刷新后恢复快照），
// 口径对齐原型：未开始可删除（任务一并删除），进行中可提前完结（已生成任务仍可执行）。
export default function PatrolPlansPage() {
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
  const [extraRows, setExtraRows] = useState([]);
  const [deletedCodes, setDeletedCodes] = useState(() => new Set());
  const [patches, setPatches] = useState({});
  // 巡检明细（设备）按计划编号存放：{ [planCode]: rows }
  const [detailRows, setDetailRows] = useState({});
  const [devicePickerOpen, setDevicePickerOpen] = useState(false);
  const [itemPickerOpen, setItemPickerOpen] = useState(false);
  const [itemPickerRow, setItemPickerRow] = useState(null);
  const [userPickerOpen, setUserPickerOpen] = useState(false);

  const rows = useMemo(() => [
    ...extraRows,
    ...patrolPlans.filter(r => !deletedCodes.has(r.code)).map(r => (patches[r.code] ? { ...r, ...patches[r.code] } : r)),
  ], [extraRows, deletedCodes, patches]);

  const list = useMemo(() => rows
    .filter(r => !status || r.status === status)
    .filter(r => {
      const k = (kw || '').trim().toLowerCase();
      if (!k) return true;
      return [r.code, r.name, ...ownersOf(r)].some(v => (v || '').toLowerCase().includes(k));
    }), [rows, kw, status]);

  const nextCode = `XJJH-P${(meta.demoDay || '2026-09-16').replaceAll('-', '')}${String(patrolPlans.length + extraRows.length + 1).padStart(3, '0')}`;

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
      startDate: record.startDate ? dayjs(record.startDate) : undefined,
      endDate: record.endDate ? dayjs(record.endDate) : undefined,
      owners: ownersOf(record),
      skipSat: skipFlagsOf(record).sat,
      skipSun: skipFlagsOf(record).sun,
    });
    if (!detailRows[record.code]) {
      const derived = patrolPlanDevices.filter(d => d.standard === record.name.replace(/巡检计划$/, '巡检标准'));
      setDetailRows(prev => ({ ...prev, [record.code]: derived.map(d => ({ ...d, items: [], itemCount: d.itemCount })) }));
    }
    setEditorOpen(true);
  };
  const handleSubmit = async () => {
    const values = await form.validateFields();
    const owners = values.owners || [];
    const base = {
      ...(editing || {}),
      code: values.code || nextCode,
      name: values.name,
      cycle: values.cycle,
      interval: values.cycle === '自定义' ? values.interval : undefined,
      startDate: values.startDate?.format('YYYY-MM-DD') ?? editing?.startDate,
      endDate: values.endDate?.format('YYYY-MM-DD') ?? editing?.endDate,
      skipSat: !!values.skipSat,
      skipSun: !!values.skipSun,
      skip: [values.skipSat && '跳过星期六', values.skipSun && '跳过星期天'].filter(Boolean).join('、'),
      owners,
      owner: owners.join('、'),
      remark: values.remark,
      deviceCount: (detailRows[values.code || nextCode] || []).length,
      totalTasks: editing ? editing.totalTasks : 0,
      doneTasks: editing ? editing.doneTasks : 0,
      createTime: editing ? editing.createTime : `${meta.updatedAt || meta.demoDay || ''}`,
      updateTime: `${meta.updatedAt || meta.demoDay || ''}`,
    };
    if (editing) {
      setPatches(prev => ({ ...prev, [editing.code]: { ...prev[editing.code], ...base } }));
      message.success(`巡检计划「${values.name}」已保存，变更将直接更新到今天及后续按计划生成的巡检任务`);
    } else {
      setExtraRows(prev => [{ ...base, code: values.code || nextCode, status: '未开始' }, ...prev]);
      message.success(`巡检计划「${values.name}」已创建，系统将按巡检线路与周期自动生成巡检任务（提前生成今天后 7 天内的任务）`);
    }
    setEditorOpen(false);
  };
  const handleFinish = (record) => {
    setPatches(prev => ({ ...prev, [record.code]: { ...prev[record.code], status: '已完成', remark: '提前完结' } }));
    message.success(`计划「${record.name}」已提前完结，已生成的任务仍可继续执行，计划不再生成新任务`);
  };
  const handleDelete = (record) => {
    if (extraRows.some(r => r.code === record.code)) setExtraRows(prev => prev.filter(r => r.code !== record.code));
    else setDeletedCodes(prev => new Set(prev).add(record.code));
    message.success(`已删除计划「${record.name}」（${record.code}），对应生成的巡检任务一并删除`);
  };

  const currentPlanCode = editing ? editing.code : nextCode;
  const currentDetails = detailRows[currentPlanCode] || [];
  const setCurrentDetails = (next) => setDetailRows(prev => ({ ...prev, [currentPlanCode]: next }));

  const columns = [
    { title: '计划编号', dataIndex: 'code', width: 180, fixed: 'left' },
    { title: '计划名称（巡检线路）', dataIndex: 'name', width: 190 },
    { title: '计划开始日期', dataIndex: 'startDate', width: 120, render: v => v || '--' },
    { title: '计划结束日期', dataIndex: 'endDate', width: 120, render: v => v || '--' },
    { title: '执行周期', width: 220, render: (_, r) => cycleText(r) },
    { title: '设备数量', dataIndex: 'deviceCount', width: 100, align: 'center', render: v => (v != null ? `${v} 台` : '--') },
    { title: '已有任务', dataIndex: 'totalTasks', width: 100, align: 'center', render: v => (v != null ? `${v} 条` : '--') },
    { title: '完成任务', dataIndex: 'doneTasks', width: 100, align: 'center', render: v => (v != null ? `${v} 条` : '--') },
    { title: '巡检负责人', width: 130, render: (_, r) => { const o = ownersOf(r); return o.length ? o.join('、') : '--'; } },
    { title: '状态', dataIndex: 'status', width: 90, render: (v, r) => <StatusTag value={v} tip={r.remark} /> },
    { title: '最近修改时间', dataIndex: 'updateTime', width: 160, render: (v, r) => v || r.createTime || '--' },
    {
      title: '操作', width: 210, fixed: 'right',
      render: (_, r) => (
        <Space size={0} onClick={(e) => e.stopPropagation()}>
          <Button type="link" size="small" onClick={() => navigate(`/patrol-tasks?plan=${encodeURIComponent(r.name)}`)}>任务</Button>
          <Button type="link" size="small" onClick={() => navigate(`/patrol-plans/detail?id=${encodeURIComponent(r.code)}`)}>详情</Button>
          <Button type="link" size="small" onClick={() => openEdit(r)}>编辑</Button>
          {['未开始', '进行中'].includes(r.status) && (
            <Popconfirm title="提前完结该计划？" description="已生成的任务仍可继续执行，计划不再生成新任务" onConfirm={() => handleFinish(r)}>
              <Button type="link" size="small">完结</Button>
            </Popconfirm>
          )}
          {r.status === '未开始' && (
            <Popconfirm title="删除该计划？" description="删除后对应生成的巡检任务将一并删除" okButtonProps={{ danger: true }} onConfirm={() => handleDelete(r)}>
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
        title="巡检计划"
        subtitle={`数据更新于 ${meta.updatedAt}`}
      />
      <DegradedBanner meta={meta} />
      <FilterBar onQuery={() => setKw(kwDraft)} onReset={() => { setKw(''); setKwDraft(''); setStatus(null); }}>
        <FilterField label="计划名称">
          <Input style={{ width: 240 }} placeholder="计划编号 / 名称 / 负责人" allowClear value={kwDraft}
            onChange={e => { setKwDraft(e.target.value); if (!e.target.value) setKw(''); }} onPressEnter={() => setKw(kwDraft)} />
        </FilterField>
        <FilterField label="状态">
          <Select style={{ width: 120 }} allowClear value={status} onChange={setStatus}
            options={[...new Set(rows.map(r => r.status))].map(v => ({ value: v, label: v }))} />
        </FilterField>
      </FilterBar>
      <Card size="small">
        <Space wrap style={{ marginBottom: 12 }}>
          <Button type="primary" onClick={openCreate}>新增巡检计划</Button>
        </Space>
        <Table
          rowKey="code" size="small" columns={columns} dataSource={list} scroll={{ x: 1980 }}
          onRow={(r) => ({ onClick: () => navigate(`/patrol-plans/detail?id=${encodeURIComponent(r.code)}`), style: { cursor: 'pointer' } })}
          locale={{ emptyText: <EmptyState description="暂无巡检计划" reason={kw || status ? '当前筛选条件下没有巡检计划' : '暂无巡检计划数据'} /> }}
          pagination={{ pageSize: 10, showTotal: t => `共 ${t} 条` }}
        />
      </Card>

      <Modal
        title={editing ? `编辑巡检计划（${editing.code}）` : '新增巡检计划'}
        width={920}
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
            ? '保存后同步到今天及后续任务，周期不可修改'
            : '保存后按周期自动生成巡检任务'}
          description={(
            <ul style={{ paddingLeft: 18, margin: 0, fontSize: 12, lineHeight: 1.9 }}>
              <li>以计划开始日期为第一天，在计划开始-结束周期内按执行周期生成任务；提前生成今天后 7 天内需要执行的任务，直到巡检计划结束日期。</li>
              <li>执行周期：日（每天）、周（每周）、月（按月）、季度（按 3 个月）、半年（按 6 个月）、年（按一年）；自定义时填写间隔天数，其余周期隐藏「间隔天数」。</li>
              <li>月 / 季度 / 半年遇 30 日、31 日而下个周期无该日时，任务日期自动落到当月最后一天。</li>
              <li>勾选跳过星期六 / 星期天：生成的任务落在被跳过的星期则自动往后顺延一天；顺延后超过计划结束日期则不生成该任务。</li>
              <li>计划编号自动生成、计划名称唯一；开始时间作为巡检任务循环生成的第一天。</li>
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
                <Input placeholder="例如：一号车间日常巡检计划" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="计划开始时间" name="startDate" rules={[{ required: true, message: '请选择计划开始时间' }]}>
                <DatePicker style={{ width: '100%' }} placeholder="请选择日期" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="计划结束时间" name="endDate" rules={[{ required: true, message: '请选择计划结束时间' }]}>
                <DatePicker style={{ width: '100%' }} placeholder="请选择日期" />
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
              <Form.Item label="跳过星期六" name="skipSat" valuePropName="checked">
                <Checkbox>勾选后落在星期六的任务顺延一天</Checkbox>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="跳过星期天" name="skipSun" valuePropName="checked">
                <Checkbox>勾选后落在星期天的任务顺延一天</Checkbox>
              </Form.Item>
            </Col>
            <Col span={18}>
              <Form.Item label="巡检负责人" name="owners" extra="执行巡检任务的人，支持多选">
                <Select
                  mode="multiple"
                  allowClear
                  placeholder="请选择巡检负责人（支持多选）"
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
            <Col span={24}>
              <Form.Item label="备注" name="remark">
                <Input.TextArea rows={2} maxLength={200} placeholder="选填" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item label="巡检明细" style={{ marginBottom: 0 }}>
            <PatrolDeviceDetailTable
              rows={currentDetails}
              onChange={setCurrentDetails}
              standards={patrolStandards}
              onPickDevices={() => setDevicePickerOpen(true)}
              onPickItems={(r) => { setItemPickerRow(r); setItemPickerOpen(true); }}
            />
          </Form.Item>
        </Form>
      </Modal>

      <UserPickerModal
        open={userPickerOpen}
        title="选择巡检负责人"
        onCancel={() => setUserPickerOpen(false)}
        onSelect={(u) => {
          const cur = form.getFieldValue('owners') || [];
          if (!cur.includes(u.name)) form.setFieldValue('owners', [...cur, u.name]);
          setUserPickerOpen(false);
          message.success(`已添加负责人「${u.name}」`);
        }}
      />

      <PatrolDevicePickerModal
        open={devicePickerOpen}
        devices={patrolPlanDevices}
        excludeCodes={currentDetails.map(r => r.code)}
        onCancel={() => setDevicePickerOpen(false)}
        onConfirm={(picked) => {
          setCurrentDetails([...currentDetails, ...picked.map(d => ({ ...d, items: [], itemCount: 0 }))]);
          setDevicePickerOpen(false);
          message.success(`已添加 ${picked.length} 台设备到巡检明细`);
        }}
      />

      <PatrolItemPickerModal
        open={itemPickerOpen}
        standards={patrolStandards}
        items={patrolItems}
        defaultStandard={itemPickerRow?.standard}
        assignedCodes={itemPickerRow?.items || []}
        onCancel={() => setItemPickerOpen(false)}
        onConfirm={(pickedItems, standard) => {
          setCurrentDetails(currentDetails.map(r => (r.code === itemPickerRow?.code
            ? { ...r, standard: standard || r.standard, items: pickedItems.map(i => i.code), itemCount: pickedItems.length }
            : r)));
          setItemPickerOpen(false);
          message.success(`已为设备「${itemPickerRow?.name}」设置 ${pickedItems.length} 个巡检项目`);
        }}
      />
    </>
  );
}
