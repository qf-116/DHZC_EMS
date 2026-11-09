import React, { useMemo, useState } from 'react';
import { Card, Table, Button, Space, Input, Select, Modal, Form, App, InputNumber, DatePicker, Alert, Tooltip, Row, Col } from 'antd';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import PageHeader from '../components/PageHeader.jsx';
import FilterBar, { FilterField } from '../components/FilterBar.jsx';
import DegradedBanner from '../components/DegradedBanner.jsx';
import StatusTag from '../components/StatusTag.jsx';
import EmptyState from '../components/EmptyState.jsx';
import InspectionDeviceDetailTable from '../components/InspectionDeviceDetailTable.jsx';
import InspectionDevicePickerModal from '../components/InspectionDevicePickerModal.jsx';
import InspectionItemPickerModal from '../components/InspectionItemPickerModal.jsx';
import { useDemoState } from '../state/DemoStore.jsx';
import { inspectionTasks, inspectionPlans, inspectionStandards, inspectionItems, inspectionStandardItemCodes, ledgerDevices } from '../data/standardData.js';
import { taskCompletion } from '../domain/inspection.js';
import { useInspectionSession, resolveTaskDetails, resolveTaskPatch, writeTaskPatch } from '../domain/inspectionSession.js';

// 点检任务（范围外演示模块，由点巡保养业务模块完整承接）：
// 任务列表读自 standardData.js 演示快照；行点击进入任务详情，可执行任务进入执行页。
// 新增（临时任务，不从计划生成）/ 编辑 / 批量删除 / 调整任务为页面内演示交互（不写入 DemoStore）。
// 状态枚举对齐原型：未开始 / 进行中 / 已完成 / 已关闭（「已逾期」为设备侧卡片口径，列表页不出现）。
const SNAPSHOT_STANDARD_CODE = 'XJBZ20250301001';

export default function InspectionTasksPage() {
  const navigate = useNavigate();
  const { message, modal } = App.useApp();
  const state = useDemoState();
  const meta = state.meta;
  const session = useInspectionSession();

  const [kw, setKw] = useState('');
  const [kwDraft, setKwDraft] = useState('');
  const [status, setStatus] = useState(null);
  const [dateRange, setDateRange] = useState(null);
  const [dateRangeDraft, setDateRangeDraft] = useState(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState(null); // null=新增临时任务，对象=编辑
  const [form] = Form.useForm();
  const [extraRows, setExtraRows] = useState([]);
  const [deletedCodes, setDeletedCodes] = useState(() => new Set());
  const [patches, setPatches] = useState({});
  const [selectedKeys, setSelectedKeys] = useState([]);
  // 点检明细（设备）按任务编号存放：{ [taskCode]: rows }
  const [detailRows, setDetailRows] = useState({});
  const [devicePickerOpen, setDevicePickerOpen] = useState(false);
  const [itemPickerOpen, setItemPickerOpen] = useState(false);
  const [itemPickerRow, setItemPickerRow] = useState(null);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [adjustForm] = Form.useForm();

  const rows = useMemo(() => [
    ...extraRows,
    ...inspectionTasks.filter(r => !deletedCodes.has(r.code)).map(r => (patches[r.code] ? { ...r, ...patches[r.code] } : r)),
  ], [extraRows, deletedCodes, patches]);

  // 叠加演示会话中的任务补丁（跳过点检 / 任务完成 / 调整任务写入）
  // 会话补丁优先：状态流转（进行中 / 已完成）与执行信息以会话为准
  const merged = useMemo(() => rows.map(r => ({ ...r, ...resolveTaskPatch(r.code, session) })), [rows, session]);

  const statusOptions = [...new Set(merged.map(t => t.status))].map(v => ({ value: v, label: v }));
  const list = useMemo(() => merged
    .filter(t => !status || t.status === status)
    .filter(t => {
      if (!dateRange || !dateRange[0] || !dateRange[1]) return true;
      if (!t.date) return false;
      const d = dayjs(t.date);
      return !d.isBefore(dateRange[0], 'day') && !d.isAfter(dateRange[1], 'day');
    })
    .filter(t => {
      const k = (kw || '').trim().toLowerCase();
      if (!k) return true;
      return [t.code, t.name, t.plan, t.owner].some(v => (v || '').toLowerCase().includes(k));
    }), [merged, kw, status, dateRange]);

  const nextCode = `XJJH${(meta.demoDay || '2026-09-16').replaceAll('-', '')}-LS${String(extraRows.length + 1).padStart(3, '0')}`;

  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({ code: nextCode, shouldCount: 1 });
    setDetailRows(prev => ({ ...prev, [nextCode]: [] }));
    setEditorOpen(true);
  };
  const openEdit = (record) => {
    setEditing(record);
    form.resetFields();
    form.setFieldsValue({ ...record, date: record.date ? dayjs(record.date) : undefined });
    if (!detailRows[record.code]) {
      const derived = ledgerDevices.slice(0, record.shouldCount ?? 0).map(d => ({
        code: d.code, name: d.name, model: d.model, type: d.type, dept: d.dept, station: d.station,
        standard: undefined, items: [], itemCount: 0,
      }));
      setDetailRows(prev => ({ ...prev, [record.code]: derived }));
    }
    setEditorOpen(true);
  };
  const handleSubmit = async () => {
    const values = await form.validateFields();
    const date = values.date?.format('YYYY-MM-DD') ?? editing?.date;
    const code = values.code || nextCode;
    const details = detailRows[code] || [];
    const base = { ...(editing || {}), ...values, date, dateValue: undefined, shouldCount: details.length || values.shouldCount };
    if (editing) {
      setPatches(prev => ({ ...prev, [editing.code]: { ...prev[editing.code], ...base } }));
      message.success(`点检任务「${editing.code}」已保存`);
    } else {
      setExtraRows(prev => [{ ...base, code, status: '未开始', createTime: `${meta.updatedAt || meta.demoDay || ''}` }, ...prev]);
      message.success(`临时点检任务「${values.name}」已创建（不从计划生成）`);
    }
    setEditorOpen(false);
  };

  const removeRows = (codes) => {
    const set = new Set(codes);
    setExtraRows(prev => prev.filter(r => !set.has(r.code)));
    setDeletedCodes(prev => new Set([...prev, ...codes]));
  };

  const handleBatchDelete = () => {
    if (selectedKeys.length === 0) {
      message.warning('请先勾选要删除的点检任务');
      return;
    }
    modal.confirm({
      title: '删除',
      content: '确认删除该条数据吗？',
      okText: '确定',
      cancelText: '取消',
      okButtonProps: { danger: true },
      onOk: () => {
        removeRows(selectedKeys);
        setSelectedKeys([]);
        message.success(`已删除 ${selectedKeys.length} 条点检任务`);
      },
    });
  };

  // 「调整任务」：对勾选的任务批量改任务日期 / 负责人 / 班组
  const handleAdjustOpen = () => {
    if (selectedKeys.length === 0) {
      message.warning('请先勾选要调整的点检任务');
      return;
    }
    adjustForm.resetFields();
    setAdjustOpen(true);
  };
  const handleAdjustSubmit = async () => {
    const values = await adjustForm.validateFields();
    const date = values.date?.format('YYYY-MM-DD');
    const patch = {};
    if (date) patch.date = date;
    if (values.owner) patch.owner = values.owner;
    if (values.group) patch.group = values.group;
    selectedKeys.forEach(code => {
      setPatches(prev => ({ ...prev, [code]: { ...prev[code], ...patch } }));
      writeTaskPatch(code, patch);
    });
    setAdjustOpen(false);
    message.success(`已调整 ${selectedKeys.length} 条点检任务`);
  };

  // 「任务完成」：按原型规则实时判定可用性
  const completionOf = (r) => {
    const details = resolveTaskDetails(r, session);
    return taskCompletion(details);
  };
  const handleComplete = (r) => {
    const { canComplete, reason } = completionOf(r);
    if (!canComplete) {
      message.warning(reason);
      return;
    }
    setPatches(prev => ({ ...prev, [r.code]: { ...prev[r.code], status: '已完成' } }));
    writeTaskPatch(r.code, { status: '已完成' });
    message.success(`点检任务「${r.code}」已置为「已完成」`);
  };

  const currentTaskCode = editing ? editing.code : nextCode;
  const currentDetails = detailRows[currentTaskCode] || [];
  const setCurrentDetails = (next) => setDetailRows(prev => ({ ...prev, [currentTaskCode]: next }));

  const columns = [
    { title: '点检任务编号', dataIndex: 'code', width: 180, fixed: 'left' },
    { title: '点检任务名称', dataIndex: 'name', width: 170, render: v => v || '--' },
    { title: '应检设备数', dataIndex: 'shouldCount', width: 100, render: v => v ?? '--' },
    { title: '任务日期', dataIndex: 'date', width: 110, render: v => v || '--' },
    { title: '点检计划名称', dataIndex: 'plan', width: 190, render: v => v || <span style={{ color: '#9aa7b5' }}>临时任务</span> },
    { title: '点检班组', dataIndex: 'group', width: 110, render: v => v || '--' },
    { title: '负责人', dataIndex: 'owner', width: 100, render: v => v || '--' },
    { title: '任务状态', dataIndex: 'status', width: 100, render: v => <StatusTag value={v} /> },
    { title: '任务创建时间', dataIndex: 'createTime', width: 160, render: v => v || '--' },
    { title: '备注', dataIndex: 'remark', ellipsis: true, render: v => v || '--' },
    {
      title: '操作', width: 250, fixed: 'right',
      render: (_, r) => {
        const { canComplete, reason } = completionOf(r);
        return (
          <Space size={0} onClick={(e) => e.stopPropagation()}>
            {['未开始', '进行中'].includes(r.status) && (
              <Button type="link" size="small" onClick={() => navigate(`/inspection-tasks/execute?code=${encodeURIComponent(r.code)}`)}>开始执行</Button>
            )}
            <Button type="link" size="small" onClick={() => navigate(`/inspection-tasks/detail?code=${encodeURIComponent(r.code)}`)}>详情</Button>
            <Tooltip title={canComplete ? reason : `不可点击：${reason}`}>
              <Button type="link" size="small" disabled={!canComplete || r.status === '已完成'} onClick={() => handleComplete(r)}>任务完成</Button>
            </Tooltip>
            <Button type="link" size="small" onClick={() => openEdit(r)}>编辑</Button>
          </Space>
        );
      },
    },
  ];

  return (
    <>
      <PageHeader
        title="点检任务"
        subtitle={`数据更新于 ${meta.demoDay}`}
      />
      <DegradedBanner meta={meta} />
      <FilterBar
        onQuery={() => { setKw(kwDraft); setDateRange(dateRangeDraft); }}
        onReset={() => { setKw(''); setKwDraft(''); setStatus(null); setDateRange(null); setDateRangeDraft(null); }}
      >
        <FilterField label="任务名称">
          <Input style={{ width: 240 }} placeholder="任务编号 / 计划 / 负责人" allowClear value={kwDraft}
            onChange={e => { setKwDraft(e.target.value); if (!e.target.value) setKw(''); }} onPressEnter={() => { setKw(kwDraft); setDateRange(dateRangeDraft); }} />
        </FilterField>
        <FilterField label="任务日期">
          <DatePicker.RangePicker
            style={{ width: 240 }}
            value={dateRangeDraft}
            onChange={setDateRangeDraft}
            placeholder={['请选择开始结束日期', '请选择开始结束日期']}
          />
        </FilterField>
        <FilterField label="状态">
          <Select style={{ width: 120 }} allowClear options={statusOptions} value={status} onChange={setStatus} />
        </FilterField>
      </FilterBar>
      <Card size="small">
        <Space wrap style={{ marginBottom: 12 }}>
          <Button type="primary" onClick={openCreate}>新增点检任务</Button>
          <Button onClick={handleAdjustOpen} disabled={selectedKeys.length === 0}>调整任务</Button>
          <Button danger onClick={handleBatchDelete} disabled={selectedKeys.length === 0}>删除</Button>
          <span style={{ color: '#8a97a5', fontSize: 12 }}>已选 {selectedKeys.length} 条</span>
        </Space>
        <Table
          rowKey="code" size="small"
          dataSource={list}
          columns={columns}
          rowSelection={{ columnWidth: 40, selectedRowKeys: selectedKeys, onChange: setSelectedKeys }}
          onRow={(r) => ({ onClick: () => navigate(`/inspection-tasks/detail?code=${encodeURIComponent(r.code)}`), style: { cursor: 'pointer' } })}
          locale={{ emptyText: <EmptyState description="暂无点检任务" reason={kw || status || dateRange ? '当前筛选条件下没有点检任务' : '暂无点检任务数据'} /> }}
          scroll={{ x: 1750 }}
          pagination={{ pageSize: 10, showTotal: t => `共 ${t} 条` }}
        />
      </Card>

      <Modal
        title={editing ? `编辑点检任务（${editing.code}）` : '新增点检任务'}
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
          message={editing ? '保存后同步更新执行信息' : '临时任务不从点检计划生成'}
        />
        <Form form={form} layout="vertical">
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="任务编号" name="code"><Input disabled /></Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="任务名称" name="name" rules={[{ required: true, message: '请输入任务名称' }]}><Input placeholder="例如：数控车床开机前临时点检" /></Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="关联计划" name="plan"><Select allowClear placeholder="临时任务可不关联计划" options={inspectionPlans.map(p => ({ value: p.name, label: `${p.name}（${p.code}）` }))} /></Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="任务日期" name="date" rules={[{ required: true, message: '请选择任务日期' }]}><DatePicker style={{ width: '100%' }} placeholder="请选择日期" /></Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="应检设备数" name="shouldCount" rules={[{ required: true, message: '请输入应检设备数' }]}><InputNumber min={1} style={{ width: '100%' }} /></Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="负责人" name="owner"><Input placeholder="例如：李四" /></Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item label="备注" name="remark"><Input.TextArea rows={2} maxLength={200} /></Form.Item>
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

      <Modal
        title="调整任务"
        width={560}
        open={adjustOpen}
        onCancel={() => setAdjustOpen(false)}
        onOk={handleAdjustSubmit}
        okText="确定"
        cancelText="取消"
        destroyOnClose
      >
        <Alert
          type="info" showIcon style={{ marginBottom: 16 }}
          message={`将调整已勾选的 ${selectedKeys.length} 条任务的执行信息；未填写的字段保持不变。`}
        />
        <Form form={adjustForm} layout="vertical">
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="任务日期" name="date"><DatePicker style={{ width: '100%' }} placeholder="请选择日期" /></Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="负责人" name="owner"><Input placeholder="例如：李四" /></Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="点检班组" name="group"><Input placeholder="例如：设备组" /></Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>

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
