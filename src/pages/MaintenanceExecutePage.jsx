import React, { useMemo, useState } from 'react';
import {
  Card, Descriptions, Table, Button, Tag, Radio, Input, InputNumber, Upload,
  Modal, Alert, App, Typography, Statistic, Space, Select, TimePicker, Tooltip,
  Row, Col,
} from 'antd';
import { ArrowLeft, CheckCircle2, Upload as UploadIcon } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import dayjs from 'dayjs';
import PageHeader from '../components/PageHeader.jsx';
import DegradedBanner from '../components/DegradedBanner.jsx';
import StatusTag from '../components/StatusTag.jsx';
import EmptyState from '../components/EmptyState.jsx';
import MaterialPickerModal from '../components/MaterialPickerModal.jsx';
import { useDemoState } from '../state/DemoStore.jsx';
import {
  maintenanceTasks,
  maintenanceExecItems,
  maintenanceItems,
  maintenancePlans,
} from '../data/standardData.js';
import { crosswalkByAssetCode } from '../data/demo/deviceCrosswalk.js';

const dash = (v) => (v === null || v === undefined || v === '' ? '--' : v);

// 原型「执行保养」数值型结果的占位提示原文：数值项的正常值范围提示
const PROTOTYPE_NUMERIC_HINT = '请输入数值，正常值为13~25';
const TEXT_HINT = '请输入检查结果';
// 保养类型取值来自保养项目类型（种子 maintenanceItems[].type）
const MAINTENANCE_TYPES = [...new Set(maintenanceItems.map(i => i.type).filter(Boolean))];
const MAX_IMAGES = 10;

// 结果登记维度（原型「执行保养任务」）：是否保养（已保养 / 未保养）与判定结果（合格 / 不合格）分列。
const DONE_OPTIONS = [
  { value: '已保养', label: '已保养' },
  { value: '未保养', label: '未保养' },
];
const JUDGE_OPTIONS = [
  { value: '合格', label: '合格' },
  { value: '不合格', label: '不合格' },
];

function parseAssetCode(deviceStr) {
  const m = String(deviceStr || '').match(/MT\d{4}A\d+/);
  return m ? m[0] : null;
}

// 保养项目口径：执行明细（maintenanceExecItems）与保养项目档案（maintenanceItems）按编号合并，
// 取得判断结果类型（单选 / 数值 / 文本）及其选项、正常值范围。
const enrichItem = (it) => {
  const meta = maintenanceItems.find(i => i.code === it.code);
  return {
    ...it,
    resultType: meta?.resultType || '单选',
    options: meta?.options || '',
    normalRange: meta?.normalRange || '',
  };
};

// 某任务的保养项目清单：
// 1) 执行明细快照 maintenanceExecItems；
// 2) 叠加该任务所属保养计划（maintenancePlans[].items）里点名的保养项目，
//    以便数值型 / 文本型判断结果在演示中可见（不新增档案数据，仅按计划点名匹配）。
function buildExecItems(task) {
  const base = maintenanceExecItems.map(enrichItem);
  if (!task) return base;
  const plan = maintenancePlans.find(p => p.name === task.plan);
  const names = String(plan?.items || '').split(/[、,，]/).map(s => s.trim()).filter(Boolean);
  const extra = maintenanceItems
    .filter(i => names.includes(i.name) && !base.some(b => b.code === i.code))
    .map(enrichItem);
  return [...base, ...extra];
}

// 数值型结果的占位提示：优先用该保养项目自身配置的正常值范围，否则沿用原型原文提示
const numericPlaceholder = (item) => (item.normalRange
  ? `请输入数值，正常值为${item.normalRange}`
  : PROTOTYPE_NUMERIC_HINT);

// 保养执行页（范围外演示模块）：/maintenance-tasks/execute?code=（兼容 ?id=）。
// 逐项登记保养结果（是否保养 + 按 resultType 的判定/取值）+ 耗材登记 + 工时；
// 执行状态用页面 useState，不写 DemoStore / 不派发 action。
export default function MaintenanceExecutePage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { message } = App.useApp();
  const state = useDemoState();
  const meta = state.meta;

  const code = params.get('code') || params.get('id');
  const task = code ? maintenanceTasks.find(r => r.code === code) : null;

  // 页面本地执行状态（不落演示快照）
  const [doneState, setDoneState] = useState({});          // 项目编号 → 已保养 / 未保养
  const [judge, setJudge] = useState({});                   // 项目编号 → 合格 / 不合格
  const [values, setValues] = useState({});                 // 项目编号 → 数值 / 文本取值
  const [fileList, setFileList] = useState([]);             // 上传图片（最多 10 张）
  const [sparePart, setSparePart] = useState(null);        // 更换备件：是 / 否（必填）
  const [maintainType, setMaintainType] = useState(null);   // 保养类型
  const [startTime, setStartTime] = useState(null);         // 开始时间
  const [endTime, setEndTime] = useState(null);             // 结束时间
  const [consumable, setConsumable] = useState(null);      // 耗材 { code, name, spec, unit, qty }（物料主数据选取）
  const [materialPickerOpen, setMaterialPickerOpen] = useState(false);
  const [laborHours, setLaborHours] = useState(null);      // 工时（小时）
  const [remark, setRemark] = useState('');                 // 总备注
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [draftSaved, setDraftSaved] = useState(false);

  const assetCode = task ? parseAssetCode(task.device) : null;
  const cw = assetCode ? crosswalkByAssetCode[assetCode] : null;

  // 本次执行的保养项目清单（按任务所属计划的保养项目补充）
  const execItems = useMemo(() => buildExecItems(task), [task]);

  const doneCount = useMemo(
    () => execItems.filter(i => doneState[i.code] === '已保养').length,
    [execItems, doneState],
  );
  const notDoneCount = useMemo(
    () => execItems.filter(i => doneState[i.code] === '未保养').length,
    [execItems, doneState],
  );
  const unqualifiedCount = useMemo(
    () => execItems.filter(i => judge[i.code] === '不合格').length,
    [execItems, judge],
  );
  const allDecided = execItems.every(i => doneState[i.code]);

  if (!task) {
    return (
      <>
        <PageHeader
          title="执行保养任务"
          actions={<Button icon={<ArrowLeft size={14} />} onClick={() => navigate('/maintenance-tasks')}>返回列表</Button>}
        />
        <Card size="small">
          <EmptyState
            description={`未找到保养任务${code ? `（${code}）` : ''}`}
            reason="任务编号无效或该任务不存在（不回退展示其他任务）"
            next
            onNext={() => navigate('/maintenance-tasks')}
            nextLabel="返回保养任务列表"
          />
        </Card>
      </>
    );
  }

  // 由选中的耗材对象生成等价的耗材描述字符串（提交确认弹窗展示用）
  const consumableText = consumable
    ? `${[consumable.name, consumable.spec].filter(Boolean).join(' ')} ×${consumable.qty || 1}`
    : '';

  const doSubmit = () => {
    if (!sparePart) {
      message.error('请选择「更换备件」');
      setConfirmOpen(false);
      return;
    }
    setSubmitted(true);
    setConfirmOpen(false);
    setDraftSaved(false);
    message.success(`保养任务 ${task.code} 执行结果已提交，任务状态更新为已完成`);
  };

  // 暂存：保存草稿，不提交
  const doSaveDraft = () => {
    setDraftSaved(true);
    message.success('执行内容已暂存为草稿，尚未提交');
  };

  return (
    <>
      <PageHeader
        title="执行保养任务"
        subtitle={`${task.code} · ${task.name}`}
        actions={<Button icon={<ArrowLeft size={14} />} onClick={() => navigate('/maintenance-tasks')}>返回列表</Button>}
      />
      <DegradedBanner meta={meta} />
      {submitted && (
        <Alert
          type="success" showIcon style={{ marginBottom: 12 }}
          message={`执行结果已提交：已保养 ${doneCount} / 未保养 ${notDoneCount} / 不合格 ${unqualifiedCount}（共 ${execItems.length} 项）`}
        />
      )}
      {draftSaved && !submitted && (
        <Alert
          type="warning" showIcon style={{ marginBottom: 12 }}
          message="执行内容已暂存为草稿，尚未提交"
        />
      )}

      <Card size="small" style={{ marginBottom: 12 }}>
        <Descriptions column={3} size="small" bordered>
          <Descriptions.Item label="任务编号">{task.code}</Descriptions.Item>
          <Descriptions.Item label="所属计划">{dash(task.plan)}</Descriptions.Item>
          <Descriptions.Item label="状态"><StatusTag value={task.status} /></Descriptions.Item>
          <Descriptions.Item label="保养设备">
            {cw ? `${cw.name}（${assetCode}）` : dash(task.device)}
            {cw ? <Tag style={{ marginLeft: 6 }}>{cw.deviceId}</Tag> : null}
          </Descriptions.Item>
          <Descriptions.Item label="所属部门">{dash(task.dept)}</Descriptions.Item>
          <Descriptions.Item label="任务日期">{dash(task.date)}</Descriptions.Item>
          <Descriptions.Item label="保养负责人">{dash(task.owner)}</Descriptions.Item>
          <Descriptions.Item label="备注" span={2}>{dash(task.remark)}</Descriptions.Item>
        </Descriptions>
      </Card>

      <Card size="small" title="基础信息" style={{ marginBottom: 12 }}>
        <Row gutter={16}>
          <Col span={12}>
            <div className="filter-bar-label" style={{ marginBottom: 4 }}>保养类型</div>
            <Select
              style={{ width: '100%' }} allowClear placeholder="请选择保养类型"
              options={MAINTENANCE_TYPES.map(v => ({ value: v, label: v }))}
              value={maintainType} onChange={setMaintainType} disabled={submitted}
            />
          </Col>
          <Col span={12}>
            <div className="filter-bar-label" style={{ marginBottom: 4 }}>
              <span style={{ color: '#ff4d4f', marginRight: 4 }}>*</span>更换备件
            </div>
            <Radio.Group
              optionType="button" buttonStyle="solid"
              options={[{ value: '是', label: '是' }, { value: '否', label: '否' }]}
              value={sparePart} onChange={(e) => setSparePart(e.target.value)} disabled={submitted}
            />
          </Col>
          <Col span={12}>
            <div className="filter-bar-label" style={{ marginBottom: 4 }}>开始时间</div>
            <TimePicker
              style={{ width: '100%' }} placeholder="请选择时间"
              value={startTime} onChange={setStartTime} disabled={submitted}
            />
          </Col>
          <Col span={12}>
            <div className="filter-bar-label" style={{ marginBottom: 4 }}>结束时间</div>
            <TimePicker
              style={{ width: '100%' }} placeholder="请选择时间"
              value={endTime} onChange={setEndTime} disabled={submitted}
            />
          </Col>
        </Row>

        <div style={{ marginTop: 16 }}>
          <div className="filter-bar-label" style={{ marginBottom: 4 }}>上传图片（最多 10 张）</div>
          <Upload
            listType="picture-card"
            fileList={fileList}
            maxCount={MAX_IMAGES}
            beforeUpload={() => false}
            onChange={({ fileList: fl }) => setFileList(fl.slice(-MAX_IMAGES))}
            disabled={submitted}
          >
            <div style={{ padding: '4px 8px' }}>
              <UploadIcon />
              <div style={{ marginTop: 6, fontSize: 12 }}>+上传</div>
            </div>
          </Upload>
          <div style={{ marginTop: 4, fontSize: 12, color: '#8a97a3' }}>
            点击或者将图片拖拽到这里上传，最多上传 {MAX_IMAGES} 张图片（当前 {fileList.length} 张）
          </div>
        </div>
      </Card>

      <Card size="small" title="逐项保养结果登记" style={{ marginBottom: 12 }} extra={
        <Space size={16}>
          <Statistic title="已保养" value={doneCount} valueStyle={{ fontSize: 16, color: '#52c41a' }} />
          <Statistic title="未保养" value={notDoneCount} valueStyle={{ fontSize: 16, color: '#8a97a3' }} />
          <Statistic title="不合格" value={unqualifiedCount} valueStyle={{ fontSize: 16, color: '#ff4d4f' }} />
        </Space>
      }>
        <Table
          rowKey="code" size="small" pagination={false}
          dataSource={execItems}
          locale={{
            emptyText: <EmptyState description="暂无保养项目" reason="暂无该任务的保养项目数据" />,
          }}
          columns={[
            { title: '序号', width: 60, render: (_, __, i) => i + 1 },
            { title: '项目编号', dataIndex: 'code', width: 160 },
            { title: '项目名称', dataIndex: 'name', width: 170 },
            { title: '保养部位', dataIndex: 'part', width: 100, render: v => dash(v) },
            { title: '保养级别', dataIndex: 'level', width: 90, render: v => <Tag>{dash(v)}</Tag> },
            { title: '保养要求', dataIndex: 'require', width: 220, render: v => dash(v) },
            {
              // 维度一：是否保养（已保养 / 未保养）
              title: '是否保养', width: 150,
              render: (_, r) => (
                <Radio.Group
                  size="small"
                  options={DONE_OPTIONS}
                  optionType="button"
                  buttonStyle="solid"
                  value={doneState[r.code] || null}
                  onChange={(e) => setDoneState(prev => ({ ...prev, [r.code]: e.target.value }))}
                  disabled={submitted}
                />
              ),
            },
            {
              // 维度二：判定结果（合格 / 不合格）
              title: '判定结果', width: 170,
              render: (_, r) => (
                <Radio.Group
                  size="small"
                  options={JUDGE_OPTIONS}
                  optionType="button"
                  buttonStyle="solid"
                  value={judge[r.code] || null}
                  onChange={(e) => setJudge(prev => ({ ...prev, [r.code]: e.target.value }))}
                  disabled={submitted}
                />
              ),
            },
            {
              // 维度三：登记取值（按保养项目的判断结果类型驱动；单选型无需填写取值）
              title: '登记取值', width: 230,
              render: (_, r) => {
                if (r.resultType === '数值') {
                  return (
                    <InputNumber
                      style={{ width: 170 }}
                      placeholder={numericPlaceholder(r)}
                      value={values[r.code]}
                      onChange={(v) => setValues(prev => ({ ...prev, [r.code]: v }))}
                      disabled={submitted}
                    />
                  );
                }
                if (r.resultType === '文本') {
                  return (
                    <Input
                      style={{ width: 190 }}
                      placeholder={TEXT_HINT}
                      value={values[r.code] || ''}
                      onChange={(e) => setValues(prev => ({ ...prev, [r.code]: e.target.value }))}
                      disabled={submitted}
                    />
                  );
                }
                return <span style={{ color: '#9aa7b5' }}>--</span>;
              },
            },
            {
              title: '结果标记', width: 110,
              render: (_, r) => {
                if (!doneState[r.code]) return <Tag>待登记</Tag>;
                const v = values[r.code];
                const hasValue = v !== undefined && v !== null && v !== '';
                return (
                  <Space size={4}>
                    <Tag color={doneState[r.code] === '已保养' ? 'success' : 'default'}>{doneState[r.code]}</Tag>
                    {judge[r.code]
                      ? <Tag color={judge[r.code] === '合格' ? 'success' : 'error'}>{judge[r.code]}</Tag>
                      : null}
                    {hasValue
                      ? <Tooltip title={String(v)}><Tag color="processing">{String(v)}</Tag></Tooltip>
                      : null}
                  </Space>
                );
              },
            },
          ]}
          scroll={{ x: 1400 }}
        />
      </Card>

      <Card size="small" title="耗材与工时登记" style={{ marginBottom: 12 }}>
        <Space wrap size={24} align="start">
          <div>
            <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 4 }}>耗材登记</Typography.Text>
            {consumable ? (
              <Space wrap size={8} align="center">
                <Input
                  style={{ width: 160 }} readOnly
                  placeholder="物料名称"
                  value={consumable.name}
                  disabled={submitted}
                />
                <Input
                  style={{ width: 140 }} readOnly
                  placeholder="规格型号"
                  value={consumable.spec}
                  disabled={submitted}
                />
                <Input
                  style={{ width: 70 }} readOnly
                  placeholder="单位"
                  value={consumable.unit}
                  disabled={submitted}
                />
                <InputNumber
                  min={1} style={{ width: 90 }}
                  placeholder="数量"
                  value={consumable.qty}
                  onChange={v => setConsumable(prev => ({ ...prev, qty: v }))}
                  disabled={submitted}
                />
                <Button
                  size="small"
                  disabled={submitted}
                  onClick={() => setConsumable(null)}
                >
                  清空
                </Button>
              </Space>
            ) : (
              <Button disabled={submitted} onClick={() => setMaterialPickerOpen(true)}>
                选择耗材
              </Button>
            )}
          </div>
          <div>
            <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 4 }}>工时（小时）</Typography.Text>
            <InputNumber
              min={0} step={0.5} style={{ width: 160 }}
              placeholder="如 1.5"
              value={laborHours}
              onChange={v => setLaborHours(v)}
              disabled={submitted}
            />
          </div>
          <div>
            <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 4 }}>总备注</Typography.Text>
            <Input.TextArea
              rows={2} style={{ width: 360 }} maxLength={200} showCount
              placeholder="请输入"
              value={remark}
              onChange={e => setRemark(e.target.value)}
              disabled={submitted}
            />
          </div>
        </Space>
      </Card>

      <Card size="small">
        <Space style={{ width: '100%', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 12, color: '#8a97a3' }}>
            {allDecided ? '全部项目已登记是否保养，可提交。' : `尚有 ${execItems.filter(i => !doneState[i.code]).length} 项未登记是否保养（允许带未登记项提交，不合格项建议填写备注）。`}
          </span>
          <Space>
            <Button onClick={() => navigate(`/maintenance-tasks/detail?code=${encodeURIComponent(task.code)}`)}>查看详情</Button>
            <Button onClick={doSaveDraft} disabled={submitted}>暂存</Button>
            <Button
              type="primary"
              icon={<CheckCircle2 size={14} />}
              disabled={submitted}
              onClick={() => setConfirmOpen(true)}
            >
              提交
            </Button>
          </Space>
        </Space>
      </Card>

      <Modal
        title={`提交执行结果（${task.code}）`}
        width={560}
        open={confirmOpen}
        onCancel={() => setConfirmOpen(false)}
        onOk={doSubmit}
        okText="确认提交"
        cancelText="取消"
      >
        <Descriptions column={1} size="small" bordered>
          <Descriptions.Item label="保养结果">
            已保养 {doneCount} / 未保养 {notDoneCount} / 不合格 {unqualifiedCount}（共 {execItems.length} 项）
          </Descriptions.Item>
          <Descriptions.Item label="保养类型">{dash(maintainType)}</Descriptions.Item>
          <Descriptions.Item label="更换备件">{dash(sparePart)}</Descriptions.Item>
          <Descriptions.Item label="开始时间">{startTime ? dayjs(startTime).format('YYYY-MM-DD HH:mm:ss') : '--'}</Descriptions.Item>
          <Descriptions.Item label="结束时间">{endTime ? dayjs(endTime).format('YYYY-MM-DD HH:mm:ss') : '--'}</Descriptions.Item>
          <Descriptions.Item label="上传图片">{fileList.length} 张</Descriptions.Item>
          <Descriptions.Item label="耗材登记">{dash(consumableText)}</Descriptions.Item>
          <Descriptions.Item label="工时（小时）">{laborHours ?? '--'}</Descriptions.Item>
          <Descriptions.Item label="总备注">{dash(remark)}</Descriptions.Item>
        </Descriptions>
      </Modal>

      <MaterialPickerModal
        open={materialPickerOpen}
        title="选择耗材"
        onCancel={() => setMaterialPickerOpen(false)}
        onSelect={(m) => {
          setConsumable({ code: m.code, name: m.name, spec: m.spec, unit: m.unit, qty: 1 });
          setMaterialPickerOpen(false);
        }}
      />
    </>
  );
}
