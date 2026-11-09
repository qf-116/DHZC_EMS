import React, { useMemo, useState } from 'react';
import {
  Card, Table, Button, Space, Input, Select, Tooltip, Modal, Form, App, Popconfirm,
  InputNumber, DatePicker, Alert, Checkbox, Row, Col, Tag,
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
  maintenancePlans,
  maintenanceTasks,
  maintenancePlanDetails,
  maintenanceItems,
  ledgerDevices,
} from '../data/standardData.js';

const dash = (v) => (v === null || v === undefined || v === '' ? '--' : v);

// 保养方式口径：原型「保养计划」A 套为 单次保养 / 循环保养
const METHOD_OPTIONS = ['单次保养', '循环保养'].map(v => ({ value: v, label: v }));
// 计划状态枚举（原型）：待执行 / 执行中 / 已停止 / 已完成 / 异常
const PLAN_STATUS = ['待执行', '执行中', '已停止', '已完成', '异常'];
// 执行周期（原型 B 套 + 自定义；保留当前实现的月/季度/半年/年口径并补「自定义」）
const CYCLE_OPTIONS = ['日', '周', '月', '季度', '半年', '年', '自定义']
  .map(v => ({ value: v, label: v === '自定义' ? '自定义' : `${v}保养` }));

// 计划 → 关联保养标准（种子 maintenancePlanDetails.standard）
const PLAN_STANDARD_MAP = {
  数控车床一级保养计划: '数控车床月度保养标准',
  激光焊接机二级保养计划: '激光焊接机半年度保养标准',
  空压机三级保养计划: '空压机月度保养标准',
  油压机年度保养计划: '油压机年度保养标准',
};

// 「下次执行」口径：取该计划名下「未开始」任务的最早计划日期（种子推导，不伪造日期）；
// 待执行计划取名下任意任务最早日期；无任务 / 已结束状态显示 --
function nextExecOf(plan) {
  const tasks = maintenanceTasks.filter(t => t.plan === plan.name);
  if (plan.status === '待执行' && tasks.length) {
    return tasks.map(t => t.date).sort()[0];
  }
  if (plan.status === '执行中') {
    const pending = tasks.filter(t => t.status === '未开始').map(t => t.date).sort();
    return pending[0] || '--';
  }
  return '--';
}

const cycleText = (p) => {
  const parts = [p.cycle && `${p.cycle}保养`];
  if (p.intervalDays) parts.push(`间隔 ${p.intervalDays} 天`);
  if (p.skipDays) parts.push(p.skipDays);
  return parts.filter(Boolean).join(' · ') || '--';
};

// 跳过星期六 / 星期天 → 结构化字段（skipSat / skipSun），展示时合成为 skipDays 文案
const skipTextOf = (v = {}) => [
  v.skipSat ? '跳过星期六' : null,
  v.skipSun ? '跳过星期天' : null,
].filter(Boolean).join('、');

const detailMapOf = (list = []) => Object.fromEntries(list.map(d => [d.code, d]));

// 保养计划列表（范围外演示模块）：列表读自种子 maintenancePlans；
// 新增 / 编辑 / 停止 / 删除为页面内演示交互（不写入 DemoStore，刷新后恢复快照）。
export default function MaintenancePlansPage() {
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

  // 新增/编辑弹窗内的「保养明细」行（设备维度）
  const [detailRows, setDetailRows] = useState([]);
  const [devicePickerOpen, setDevicePickerOpen] = useState(false);
  const [itemPickerOpen, setItemPickerOpen] = useState(false);
  const [itemPickerRow, setItemPickerRow] = useState(null);
  const [detailSelectedKeys, setDetailSelectedKeys] = useState([]);
  const [selectedKeys, setSelectedKeys] = useState([]);

  const rows = useMemo(() => [
    ...extraRows,
    ...maintenancePlans.filter(r => !deletedCodes.has(r.code)).map(r => (patches[r.code] ? { ...r, ...patches[r.code] } : r)),
  ], [extraRows, deletedCodes, patches]);

  const statusOptions = useMemo(
    () => PLAN_STATUS.map(v => ({ value: v, label: v })),
    [],
  );

  const list = useMemo(() => rows
    .filter(r => !status || r.status === status)
    .filter(r => !kw || (r.code || '').includes(kw) || (r.name || '').includes(kw) || (r.executor || '').includes(kw)), [rows, kw, status]);

  const nextCode = `BYJH${(meta.demoDay || '2026-09-16').replaceAll('-', '')}${String(maintenancePlans.length + extraRows.length + 1).padStart(3, '0')}`;

  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({
      code: nextCode,
      cycle: '月',
      year: String((meta.demoDay || '2026-09-16')).slice(0, 4),
      status: '待执行',
      skipSat: false,
      skipSun: false,
    });
    setDetailRows([]);
    setEditorOpen(true);
  };
  const openEdit = (record) => {
    setEditing(record);
    form.resetFields();
    const skipDays = record.skipDays || '';
    form.setFieldsValue({
      ...record,
      status: record.status,
      skipSat: skipDays.includes('星期六'),
      skipSun: skipDays.includes('星期天'),
      intervalDays: record.intervalDays === '' || record.intervalDays === undefined
        ? undefined : Number(record.intervalDays),
      planDate: record.planDate && /^\d{4}-\d{2}-\d{2}$/.test(record.planDate) ? dayjs(record.planDate) : undefined,
      range: record.startDate && record.endDate ? [dayjs(record.startDate), dayjs(record.endDate)] : undefined,
    });
    // 明细：取该计划关联标准的设备明细（种子无「计划 ↔ 明细」直接关系，按标准匹配）
    const std = PLAN_STANDARD_MAP[record.name];
    setDetailRows(std
      ? maintenancePlanDetails.filter(d => d.standard === std).map(d => ({ ...d, items: [] }))
      : []);
    setEditorOpen(true);
  };
  const handleSubmit = async () => {
    const values = await form.validateFields();
    const { range, skipSat, skipSun, ...rest } = values;
    // 列表列「保养设备 / 保养项目」由保养明细回写（明细为空时保持原值，不清空）
    const devicesSummary = detailRows.length
      ? [...new Set(detailRows.map(d => d.name))].join('、')
      : (editing?.devices || '');
    const itemsSummary = detailRows.length
      ? ([...new Set(detailRows.flatMap(d => (d.items || []).map(i => i.name)))].join('、') || editing?.items || '')
      : (editing?.items || '');
    const base = {
      ...(editing || {}),
      ...rest,
      devices: devicesSummary,
      items: itemsSummary,
      skipSat: !!skipSat,
      skipSun: !!skipSun,
      skipDays: skipTextOf({ skipSat, skipSun }),
      planDate: values.planDate?.format('YYYY-MM-DD') ?? (editing?.planDate || undefined),
      startDate: range?.[0]?.format('YYYY-MM-DD') ?? (editing?.startDate || undefined),
      endDate: range?.[1]?.format('YYYY-MM-DD') ?? (editing?.endDate || undefined),
      details: detailRows,
    };
    if (editing) {
      setPatches(prev => ({ ...prev, [editing.code]: { ...prev[editing.code], ...base } }));
      message.success(`保养计划「${values.name}」已保存，变更将同步到未执行的保养任务及后续按计划生成的任务`);
    } else {
      setExtraRows(prev => [{ ...base, code: values.code || nextCode, status: values.status || '待执行' }, ...prev]);
      message.success(`保养计划「${values.name}」已创建，系统将按周期自动生成保养任务`);
    }
    setEditorOpen(false);
  };
  // 原型语义：执行中 → 停止（计划不再生成新任务，已生成任务仍可执行）
  const handleStop = (record) => {
    setPatches(prev => ({ ...prev, [record.code]: { ...prev[record.code], status: '已停止' } }));
    message.success(`计划「${record.name}」已停止，已生成的保养任务仍可继续执行，计划不再生成新任务`);
  };
  const handleDelete = (record) => {
    if (extraRows.some(r => r.code === record.code)) setExtraRows(prev => prev.filter(r => r.code !== record.code));
    else setDeletedCodes(prev => new Set(prev).add(record.code));
    message.success(`已删除计划「${record.name}」（${record.code}），对应生成的保养任务一并删除`);
  };

  // 明细：选择设备（原型「选择设备」按钮）
  const handlePickDevices = (devices) => {
    setDetailRows(prev => {
      const exist = new Set(prev.map(d => d.code));
      const add = devices
        .filter(d => !exist.has(d.code))
        .map(d => {
          const detail = maintenancePlanDetails.find(x => x.code === d.code);
          return {
            code: d.code,
            name: d.name,
            type: d.type,
            dept: d.dept,
            station: d.station,
            standard: detail?.standard || '',
            itemCount: detail?.itemCount || '',
            items: [],
          };
        });
      return [...prev, ...add];
    });
    setDevicePickerOpen(false);
    message.success(`已添加 ${devices.length} 台设备`);
  };
  const removeDetailRow = (code) => {
    setDetailRows(prev => prev.filter(d => d.code !== code));
  };
  const openItemPicker = (row) => {
    setItemPickerRow(row);
    setItemPickerOpen(true);
  };
  const handlePickItems = (items) => {
    setDetailRows(prev => prev.map(d => (d.code === itemPickerRow.code
      ? { ...d, items, itemCount: `${items.length}项` }
      : d)));
    setItemPickerOpen(false);
  };

  return (
    <>
      <PageHeader
        title="保养计划"
        subtitle={`数据更新于 ${meta.demoDay}`}
      />
      <DegradedBanner meta={meta} />
      <FilterBar onQuery={() => setKw(kwDraft)} onReset={() => { setKw(''); setKwDraft(''); setStatus(null); }}>
        <FilterField label="计划名称">
          <Input style={{ width: 240 }} placeholder="计划编号 / 名称 / 执行人" allowClear value={kwDraft}
            onChange={e => { setKwDraft(e.target.value); if (!e.target.value) setKw(''); }} onPressEnter={() => setKw(kwDraft)} />
        </FilterField>
        <FilterField label="状态">
          <Select style={{ width: 120 }} allowClear options={statusOptions} value={status} onChange={setStatus} />
        </FilterField>
      </FilterBar>
      <Card size="small">
        <Space wrap style={{ marginBottom: 12 }}>
          <Button type="primary" onClick={openCreate}>新增保养计划</Button>
          <Button onClick={() => message.info('演示模式：导出功能待业务模块承接')}>导出</Button>
          <Button
            disabled={!selectedKeys.length}
            onClick={() => {
              setDeletedCodes(prev => {
                const next = new Set(prev);
                selectedKeys.forEach(code => next.add(code));
                return next;
              });
              setExtraRows(prev => prev.filter(r => !selectedKeys.includes(r.code)));
              message.success(`已删除 ${selectedKeys.length} 个保养计划`);
              setSelectedKeys([]);
            }}
          >
            删除
          </Button>
        </Space>
        <Table
          rowKey="code" size="small"
          dataSource={list}
          rowSelection={{ columnWidth: 40, selectedRowKeys: selectedKeys, onChange: setSelectedKeys }}
          onRow={(r) => ({ onClick: () => navigate(`/maintenance-plans/detail?code=${encodeURIComponent(r.code)}`), style: { cursor: 'pointer' } })}
          locale={{
            emptyText: (
              <EmptyState
                description="暂无保养计划"
                reason={kw || status ? '当前筛选条件下没有保养计划' : '暂无保养计划数据'}
              />
            ),
          }}
          columns={[
            { title: '计划编号', dataIndex: 'code', width: 160, fixed: 'left' },
            { title: '计划名称', dataIndex: 'name', width: 190 },
            { title: '年度', dataIndex: 'year', width: 70 },
            { title: '保养层级', dataIndex: 'tier', width: 90, render: v => v || '--' },
            { title: '保养级别', dataIndex: 'level', width: 90, render: v => v || '--' },
            { title: '保养方式', dataIndex: 'method', width: 100, render: v => v || '--' },
            { title: '周期', width: 200, render: (_, r) => cycleText(r) },
            { title: '计划日期', dataIndex: 'planDate', width: 170, render: v => dash(v) },
            {
              title: '下次执行', width: 110, render: (_, r) => {
                const v = nextExecOf(r);
                return v === '--'
                  ? <Tooltip title="该计划暂无待执行任务">--</Tooltip>
                  : v;
              },
            },
            { title: '保养设备', dataIndex: 'devices', width: 120, render: v => dash(v) },
            { title: '保养项目', dataIndex: 'items', width: 200, ellipsis: true, render: v => dash(v) },
            { title: '备注', dataIndex: 'remark', width: 160, ellipsis: true, render: v => dash(v) },
            { title: '执行人', dataIndex: 'executor', width: 110, render: v => dash(v) },
            { title: '创建人', dataIndex: 'creator', width: 100, render: v => dash(v) },
            { title: '创建时间', dataIndex: 'createTime', width: 150, render: v => dash(v) },
            { title: '状态', dataIndex: 'status', width: 90, render: v => <StatusTag value={v} /> },
            {
              title: '操作', width: 190, fixed: 'right',
              render: (_, r) => (
                <Space size={0} onClick={(e) => e.stopPropagation()}>
                  <Button type="link" size="small" onClick={() => navigate(`/maintenance-plans/detail?code=${encodeURIComponent(r.code)}`)}>详情</Button>
                  {r.status === '待执行' && (
                    <Button type="link" size="small" onClick={() => openEdit(r)}>编辑</Button>
                  )}
                  {r.status === '执行中' && (
                    <Popconfirm title="停止该计划？" description="已生成的保养任务仍可继续执行，计划不再生成新任务" onConfirm={() => handleStop(r)}>
                      <Button type="link" size="small">停止</Button>
                    </Popconfirm>
                  )}
                  {['待执行', '已停止'].includes(r.status) && (
                    <Popconfirm title="删除该计划？" description="删除后对应生成的保养任务将一并删除" okButtonProps={{ danger: true }} onConfirm={() => handleDelete(r)}>
                      <Button type="link" size="small" danger>删除</Button>
                    </Popconfirm>
                  )}
                </Space>
              ),
            },
          ]}
          scroll={{ x: 2000 }}
          pagination={{ pageSize: 10, showTotal: t => `共 ${t} 条` }}
        />
      </Card>

      <Modal
        title={editing ? `编辑保养计划（${editing.code}）` : '新增保养计划'}
        width={960}
        open={editorOpen}
        onCancel={() => setEditorOpen(false)}
        onOk={handleSubmit}
        okText={editing ? '保存' : '创建'}
        cancelText="取消"
        destroyOnHidden
      >
        <Alert
          type="info" showIcon style={{ marginBottom: 16 }}
          message={editing
            ? '保存后同步到未执行及后续任务'
            : '保存后按周期自动生成保养任务'}
        />
        <Form form={form} layout="vertical">
          <div style={{ fontWeight: 600, marginBottom: 8 }}>基础信息</div>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="计划编号" name="code"><Input disabled /></Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="计划名称" name="name" rules={[{ required: true, message: '请输入计划名称' }]}>
                <Input placeholder="例如：数控车床一级保养计划" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="年度" name="year" rules={[{ required: true, message: '请输入年度' }]}>
                <Input placeholder="例如：2026" />
              </Form.Item>
            </Col>
            <Col span={12}>
              {/* 保养层级与保养级别是两个独立字段：层级来自计划本身，级别来自保养项目 */}
              <Form.Item label="保养层级" name="tier" extra="计划自身的保养层级，与保养级别相互独立">
                <Input placeholder="例如：日常保养" maxLength={20} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="保养级别" name="level" rules={[{ required: true, message: '请选择保养级别' }]}>
                <Select options={['一级保养', '二级保养', '三级保养', '一级', '二级', '三级'].map(v => ({ value: v, label: v }))} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="保养方式" name="method">
                <Select allowClear placeholder="请选择保养方式" options={METHOD_OPTIONS} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="计划状态" name="status" rules={[{ required: true, message: '请选择计划状态' }]}>
                <Select options={PLAN_STATUS.map(v => ({ value: v, label: v }))} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="保养周期" name="cycle" rules={[{ required: true, message: '请选择保养周期' }]}>
                <Select options={CYCLE_OPTIONS} />
              </Form.Item>
            </Col>
            <Col span={12}>
              {/* 间隔天数：仅在保养周期为「自定义」时显示 */}
              <Form.Item noStyle shouldUpdate={(a, b) => a.cycle !== b.cycle}>
                {({ getFieldValue }) => (getFieldValue('cycle') === '自定义' ? (
                  <Form.Item label="间隔天数" name="intervalDays" rules={[{ required: true, message: '请输入间隔天数' }]}>
                    <InputNumber min={1} style={{ width: '100%' }} addonAfter="天" />
                  </Form.Item>
                ) : null)}
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="计划日期" name="planDate">
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="起止日期" name="range">
                <DatePicker.RangePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="执行人" name="executor"><Input placeholder="例如：王强" /></Form.Item>
            </Col>
            <Col span={12}>
              {/* 跳过星期六 / 跳过星期天（原型：两个复选） */}
              <Form.Item label="跳过规则">
                <Space size={16}>
                  <Form.Item name="skipSat" valuePropName="checked" noStyle>
                    <Checkbox>跳过星期六</Checkbox>
                  </Form.Item>
                  <Form.Item name="skipSun" valuePropName="checked" noStyle>
                    <Checkbox>跳过星期天</Checkbox>
                  </Form.Item>
                </Space>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="备注" name="remark"><Input.TextArea rows={2} maxLength={200} /></Form.Item>
            </Col>
          </Row>

          <div style={{ fontWeight: 600, margin: '8px 0' }}>保养明细</div>
          <Space wrap style={{ marginBottom: 8 }}>
            <Button onClick={() => setDevicePickerOpen(true)}>选择设备</Button>
            <Button
              danger
              disabled={!detailSelectedKeys.length}
              onClick={() => {
                setDetailRows(prev => prev.filter(d => !detailSelectedKeys.includes(d.code)));
                setDetailSelectedKeys([]);
              }}
            >
              删除
            </Button>
          </Space>
          <Table
            rowKey="code" size="small" pagination={false}
            rowSelection={{ columnWidth: 40, selectedRowKeys: detailSelectedKeys, onChange: setDetailSelectedKeys }}
            dataSource={detailRows}
            locale={{ emptyText: <EmptyState description="暂无保养明细" reason="请通过「选择设备」添加保养设备" /> }}
            columns={[
              { title: '序号', width: 60, render: (_, __, i) => i + 1 },
              { title: '设备名称', dataIndex: 'name', width: 140, render: v => dash(v) },
              { title: '设备编码', dataIndex: 'code', width: 150, render: v => dash(v) },
              { title: '设备类型', dataIndex: 'type', width: 110, render: v => dash(v) },
              { title: '使用部门', dataIndex: 'dept', width: 170, render: v => dash(v) },
              { title: '工位', dataIndex: 'station', width: 100, render: v => dash(v) },
              {
                title: '保养标准名称', dataIndex: 'standard', width: 190,
                render: v => (v ? v : <span style={{ color: '#9aa7b5' }}>未配置</span>),
              },
              {
                title: '保养项目数', dataIndex: 'itemCount', width: 100, align: 'center',
                render: v => (v ? v : <span style={{ color: '#9aa7b5' }}>未配置</span>),
              },
              {
                title: '操作', width: 180,
                render: (_, r) => (
                  <Space size={0}>
                    <Button type="link" size="small" onClick={() => openItemPicker(r)}>设置保养项目</Button>
                    <Button type="link" size="small" danger onClick={() => removeDetailRow(r.code)}>删除</Button>
                  </Space>
                ),
              },
            ]}
            scroll={{ x: 1200 }}
          />
        </Form>
      </Modal>

      <MaintenanceDevicePickerModal
        open={devicePickerOpen}
        title="选择设备"
        devices={ledgerDevices}
        detailMap={detailMapOf(maintenancePlanDetails)}
        selectedCodes={detailRows.map(d => d.code)}
        onCancel={() => setDevicePickerOpen(false)}
        onConfirm={handlePickDevices}
      />

      <Modal
        title="设置保养项目"
        open={itemPickerOpen}
        width={860}
        onCancel={() => setItemPickerOpen(false)}
        footer={null}
        destroyOnHidden
      >
        <MaintenanceItemPicker
          value={itemPickerRow?.items || []}
          onCancel={() => setItemPickerOpen(false)}
          onConfirm={handlePickItems}
        />
      </Modal>
    </>
  );
}

// 设置保养项目弹窗内容：勾选该设备的保养项目（原型「设置保养项目」）
function MaintenanceItemPicker({ value, onCancel, onConfirm }) {
  const [selectedKeys, setSelectedKeys] = useState(value);
  const items = maintenanceItems.filter(i => i.status === '已启用');
  return (
    <>
      <Table
        rowKey="code" size="small" pagination={false}
        rowSelection={{ columnWidth: 40, selectedRowKeys: selectedKeys, onChange: setSelectedKeys }}
        dataSource={items}
        locale={{ emptyText: '暂无已启用的保养项目' }}
        columns={[
          { title: '保养项目编号', dataIndex: 'code', width: 160 },
          { title: '保养项目名称', dataIndex: 'name', width: 180 },
          { title: '保养部位', dataIndex: 'part', width: 110, render: v => dash(v) },
          { title: '保养级别', dataIndex: 'level', width: 100, render: v => (v ? <Tag>{v}</Tag> : '--') },
          { title: '保养要求', dataIndex: 'require', ellipsis: true, render: v => dash(v) },
        ]}
        scroll={{ x: 800 }}
      />
      <Space style={{ marginTop: 12 }}>
        <Button type="primary" onClick={() => onConfirm(items.filter(i => selectedKeys.includes(i.code)))}>确定</Button>
        <Button onClick={onCancel}>取消</Button>
      </Space>
    </>
  );
}
