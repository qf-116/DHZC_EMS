// ============================================================
// 物联网接入配置（/binding-overview · 数据接入域核心交互页）
// 2026-10 口径：绑定与监控指标两步分离，页面按双 Tab 管理——
//   Tab 1 设备绑定管理：设备 ↔ IoT 来源设备绑定（crosswalk + bindingsByDeviceId + 绑定草稿）。
//     绑定即接入：保存启用后，平台拉取该来源上报的全部指标并存储（指标自动发现，无需人工勾选）；
//     未勾选监控的指标照常存储，可在设备台账「数据指标历史」中查看。
//   Tab 2 监控指标配置：从已接入指标中按需勾选纳入监控（曲线/实时监测呈现）的子集，可以不选；
//     勾选直通正式绑定（binding/setMonitored，即时生效不产生新版本），支持「存为监控指标模板」批量复用。
// 状态轴：未配置 → 草稿 → 校验 → 待生效 → 已启用 → 已停用/换绑中（domain/binding.js）。
// DEV-008 故意未配置，用于演示「首次绑定」全流程（首绑后监控指标默认全部不勾选）。
// ============================================================

import React, { useEffect, useMemo, useState } from 'react';
import {
  App, Alert, Button, Card, Checkbox, Col, Input, Modal, Row, Select, Space, Statistic, Steps, Table, Tabs, Tag, Tooltip, Typography,
} from 'antd';
import { Plus, Save, Play, PauseCircle, Settings2, LayoutTemplate, Activity, ArrowRight, ArrowLeft, MonitorCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../components/PageHeader.jsx';
import StatusTag from '../components/StatusTag.jsx';
import ApplyTemplateModal from '../components/ApplyTemplateModal.jsx';
import { useDemoState, useDemoActions } from '../state/DemoStore.jsx';
import { selectAllDevices, selectBindingDraft } from '../state/selectors.js';
import { validateBindingDraft } from '../domain/binding.js';

// ---------- 绑定草稿弹窗（两步向导：① 选设备管理系统的设备 → ② 勾选 IoT 来源设备即完成）。
// 指标不在绑定时勾选：勾选来源即自动发现其上报的全部指标（reducer binding/addSource 自动带出），
// 保存启用后全量接入存储；是否纳入曲线监控由「监控指标配置」Tab 决定。
// 草稿状态全部来自 store，不经页面 useState。从列表行进入时预选设备、直接到第 2 步。 ----------
function BindingDraftModal({ deviceId: presetDeviceId, deviceName, open, onClose }) {
  const state = useDemoState();
  const actions = useDemoActions();
  const { message } = App.useApp();
  const [step, setStep] = useState(0);                        // 向导步骤：0=选设备，1=选 IoT 来源
  const [deviceId, setDeviceId] = useState(null);             // 向导内选定的设备管理台账设备
  const [devKw, setDevKw] = useState('');                     // 第 1 步查询条件：编号/名称/资产编码
  const [devBound, setDevBound] = useState('all');            // 第 1 步查询条件：是否已绑定
  const [devType, setDevType] = useState('all');              // 第 1 步查询条件：设备类型
  const [sourceKw, setSourceKw] = useState('');               // 来源列表搜索（设备多时缓解弹窗拥挤）

  const allDevices = useMemo(() => selectAllDevices(state), [state]);
  const draft = deviceId ? selectBindingDraft(state, deviceId) : null;
  const sourceDevicesAll = Object.values(state.entities.sourceDevicesById);
  const sourceDevices = useMemo(() => {
    const k = sourceKw.trim().toLowerCase();
    if (!k) return sourceDevicesAll;
    return sourceDevicesAll.filter((s) => `${s.iotDeviceCode} ${s.name}`.toLowerCase().includes(k));
  }, [sourceDevicesAll, sourceKw]);
  const currentVersion = state.entities.bindingsByDeviceId[deviceId]?.version || 0;

  // 每次打开重置向导进度：预选了设备（换绑/编辑草稿）直接进第 2 步，否则从第 1 步选设备开始
  useEffect(() => {
    if (open) {
      setStep(presetDeviceId ? 1 : 0);
      setDeviceId(presetDeviceId || null);
      setSourceKw('');
      setDevKw('');
      setDevBound('all');
      setDevType('all');
    }
  }, [open, presetDeviceId]);

  // 仅提示用：其它设备已启用绑定占用的 IoT 来源编码（不作为校验限制，允许重复绑定）
  const occupiedCodes = useMemo(() => {
    const set = new Set();
    Object.values(state.entities.bindingsByDeviceId).forEach((b) => {
      if (b.deviceId !== deviceId && b.configStatus === '已启用') {
        (b.items || []).forEach((i) => { if (i.enabled) set.add(i.iotDeviceCode); });
      }
    });
    return set;
  }, [state, deviceId]);

  const draftItems = draft?.items || [];
  const discoveredMetrics = draftItems.reduce((s, i) => s + (i.metrics || []).length, 0);
  const selectedDevice = allDevices.find((d) => d.deviceId === deviceId);
  // 设备绑定情况：已有绑定（含历史停用）即视为「已绑定」——不能重复新建，只能换绑；
  // 未保存的草稿不算已绑定（放弃草稿即可重新新建）
  const boundOf = (devId) => state.entities.bindingsByDeviceId[devId] || null;
  const deviceRows = useMemo(() => {
    const k = devKw.trim().toLowerCase();
    return allDevices
      .map((d) => ({ ...d, bound: !!boundOf(d.deviceId) }))
      .filter((d) => (devBound === 'all' ? true : devBound === 'bound' ? d.bound : !d.bound))
      .filter((d) => (devType === 'all' ? true : d.type === devType))
      .filter((d) => (!k ? true : `${d.deviceId} ${d.name} ${d.assetCode}`.toLowerCase().includes(k)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allDevices, state.entities.bindingsByDeviceId, devKw, devBound, devType]);
  const deviceTypes = useMemo(() => [...new Set(allDevices.map((d) => d.type).filter(Boolean))], [allDevices]);

  const goNext = () => {
    if (step === 0) {
      if (!deviceId) { message.warning('请先选择设备管理系统的设备'); return; }
      if (boundOf(deviceId)) { message.warning('该设备已绑定，不能重复绑定：请关闭后使用列表中的「换绑」'); return; }
      setStep(1);
    }
  };

  const goPrev = () => setStep(step - 1);

  // 保存：reducer 内部先校验（至少 1 个启用来源 / 同一绑定内来源编码不重复），通过后生成新版本
  const doSave = () => {
    if (!draft) { message.warning('请先勾选 IoT 数据源，生成绑定草稿'); return; }
    const res = validateBindingDraft(draft, { metricsByKey: state.entities.metricsByKey });
    if (!res.ok) { message.error(`校验未通过：${res.errors.join('；')}`); return; }
    const r = actions.saveBinding(deviceId, `绑定草稿 v${draft.version}：${draftItems.length} 个来源 / 自动接入 ${discoveredMetrics} 项指标`);
    if (r.ok) {
      message.success(`${r.message}；如需曲线监控，请到「监控指标配置」Tab 勾选指标`);
      onClose();
    } else {
      message.error(r.message);
    }
  };

  const footer = [
    <Button key="cancel" onClick={onClose}>取消</Button>,
    ...(step > 0 ? [<Button key="prev" icon={<ArrowLeft size={14} />} onClick={goPrev}>上一步</Button>] : []),
    ...(step === 0
      ? [<Button key="next" type="primary" disabled={!deviceId} onClick={goNext}>下一步：选择 IoT 设备 <ArrowRight size={14} style={{ verticalAlign: '-2px' }} /></Button>]
      : [<Button key="save" type="primary" icon={<Save size={14} />} disabled={!draftItems.length} onClick={doSave}>保存（生成待生效版本）</Button>]),
  ];

  return (
    <Modal
      title={(
        <Space size={8} wrap>
          <span>{selectedDevice ? `设备绑定 · ${selectedDevice.name}（${deviceId}）` : '新建设备绑定'}</span>
          {selectedDevice && <Tag>新版本 v{currentVersion + 1}</Tag>}
        </Space>
      )}
      width={1000}
      open={open}
      onCancel={onClose}
      footer={footer}
    >
      <Steps
        size="small" current={step} style={{ marginBottom: 16, maxWidth: 560 }}
        items={[{ title: '选择设备' }, { title: '选择 IoT 设备' }]}
      />
      <Alert
        type="info" showIcon style={{ marginBottom: 12 }}
        message="绑定即接入：绑定保存并启用后，系统获取这些 IoT 来源上报的全部数据指标并存储；是否纳入曲线监控，在「监控指标配置」Tab 中按需勾选（可以不选）。草稿仅保存在页面状态中，保存后生成新版本「待生效」，需再点「启用」才真正开始接入。"
      />

      {step === 0 && (
        <>
          <Typography.Paragraph type="secondary" style={{ fontSize: 12, marginBottom: 6 }}>
            第 1 步 · 选择设备管理系统的设备（点击行选中；已绑定设备不能重复绑定，仅可换绑）
          </Typography.Paragraph>
          <Space size={8} wrap style={{ marginBottom: 8 }}>
            <Input
              allowClear size="small" style={{ width: 220 }}
              placeholder="搜索设备编号 / 名称 / 资产编码" value={devKw} onChange={(e) => setDevKw(e.target.value)}
            />
            <Select
              size="small" style={{ width: 130 }} value={devBound}
              onChange={(v) => setDevBound(v)}
              options={[{ value: 'all', label: '绑定状态：全部' }, { value: 'unbound', label: '未绑定' }, { value: 'bound', label: '已绑定' }]}
            />
            <Select
              size="small" style={{ width: 120 }} value={devType}
              onChange={(v) => setDevType(v)}
              options={[{ value: 'all', label: '类型：全部' }, ...deviceTypes.map((t) => ({ value: t, label: t }))]}
            />
          </Space>
          <Table
            rowKey="deviceId" size="small"
            dataSource={deviceRows}
            pagination={deviceRows.length > 8 ? { pageSize: 8, size: 'small' } : false}
            onRow={(d) => ({
              onClick: () => {
                if (d.bound) {
                  const b = boundOf(d.deviceId);
                  message.warning(`设备 ${d.name} 已绑定（v${b.version}，${b.configStatus}），不能重复绑定：请关闭弹窗后使用列表中的「换绑」`);
                  return;
                }
                setDeviceId(d.deviceId);
              },
              style: { cursor: d.bound ? 'not-allowed' : 'pointer' },
            })}
            rowClassName={(d) => (d.deviceId === deviceId ? 'ant-table-row-selected' : '')}
            columns={[
              {
                title: '', width: 40,
                render: (_, d) => <Checkbox checked={d.deviceId === deviceId} disabled={d.bound} />,
              },
              { title: '设备编号', dataIndex: 'deviceId', width: 95 },
              { title: '设备名称', dataIndex: 'name', width: 130 },
              { title: '资产编码', dataIndex: 'assetCode', width: 115 },
              { title: '类型', dataIndex: 'type', width: 95 },
              { title: '型号', dataIndex: 'model', width: 95 },
              { title: '车间 / 工位', width: 130, render: (_, d) => `${d.workshopName || '--'} / ${d.stationName || '--'}` },
              { title: '设备负责人', dataIndex: 'owner', width: 95, render: (v) => v || '--' },
              {
                title: '接入状态', width: 120,
                render: (_, d) => {
                  const b = boundOf(d.deviceId);
                  if (!b) return <Tag color="green">未绑定</Tag>;
                  return (
                    <Tooltip title={`已绑定（v${b.version}，${b.configStatus}）：不能重复绑定，仅可在列表中「换绑」`}>
                      <Tag color="blue" style={{ cursor: 'help' }}>已绑定 v{b.version}</Tag>
                    </Tooltip>
                  );
                },
              },
            ]}
          />
          <Typography.Paragraph type="secondary" style={{ fontSize: 12, margin: '8px 0 0' }}>
            {deviceId
              ? <>已选 <b>{selectedDevice?.deviceId} · {selectedDevice?.name}</b>；点击「下一步」勾选 IoT 来源设备。</>
              : '尚未选择设备：点击列表中一行选中设备（仅未绑定设备可选）。'}
          </Typography.Paragraph>
        </>
      )}

      {step === 1 && (
        <>
          <Typography.Paragraph type="secondary" style={{ fontSize: 12, marginBottom: 6 }}>
            第 2 步 · 勾选 IoT 来源设备（不分主/子设备，来源间平级；可多选）。勾选即自动发现该来源上报的全部指标，无需逐项挑选。
          </Typography.Paragraph>
          <Input
            allowClear size="small" style={{ width: 260, marginBottom: 8 }}
            placeholder="搜索来源编码 / 名称" value={sourceKw} onChange={(e) => setSourceKw(e.target.value)}
          />
          <div style={{ border: '1px solid #eef1f4', borderRadius: 6, padding: '8px 12px', marginBottom: 12, maxHeight: 320, overflow: 'auto' }}>
            {sourceDevices.map((s) => {
              const item = draftItems.find((i) => i.iotDeviceId === s.iotDeviceId);
              const checked = !!item;
              const occupied = occupiedCodes.has(s.iotDeviceCode);
              return (
                <div key={s.iotDeviceId} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0' }}>
                  <Checkbox
                    checked={checked}
                    onChange={(e) => {
                      if (e.target.checked) {
                        actions.addBindingSource(deviceId, {
                          iotDeviceId: s.iotDeviceId,
                          iotDeviceCode: s.iotDeviceCode,
                          name: s.name,
                          sensorType: s.name,
                          metrics: [],
                        });
                      } else {
                        actions.removeBindingSource(deviceId, s.iotDeviceId);
                      }
                    }}
                  >
                    {s.iotDeviceCode} · {s.name}
                  </Checkbox>
                  {checked && (
                    <Tooltip title="指标自动发现：保存启用后将全量接入并存储这些指标">
                      <Tag color="cyan" style={{ cursor: 'help' }}>将接入 {(item.metrics || []).length} 项指标</Tag>
                    </Tooltip>
                  )}
                  {occupied && (
                    <Tooltip title="仅提示：该编码已被其它设备绑定，不影响本次绑定（业务允许多台设备绑定同一来源）">
                      <Tag color="warning" style={{ cursor: 'help' }}>已被其它设备占用</Tag>
                    </Tooltip>
                  )}
                </div>
              );
            })}
          </div>
          <Typography.Paragraph type="secondary" style={{ fontSize: 12, marginBottom: 0 }}>
            已选 <b>{draftItems.length}</b> 个 IoT 来源设备，自动发现 <b>{discoveredMetrics}</b> 项指标；点击「保存」生成待生效版本，启用后开始全量接入存储。
          </Typography.Paragraph>
        </>
      )}
    </Modal>
  );
}

// ---------- 停用弹窗（填原因） ----------
function DisableBindingModal({ deviceId, deviceName, version, open, onClose }) {
  const actions = useDemoActions();
  const { message } = App.useApp();
  const [reason, setReason] = useState('');

  const doDisable = () => {
    if (!reason.trim()) { message.warning('停用必须填写原因（留痕）'); return; }
    const r = actions.disableBinding(deviceId);
    if (r.ok) {
      message.success(`${r.message}（停用原因：${reason.trim()}）`);
      setReason('');
      onClose();
    } else {
      message.error(r.message);
    }
  };

  return (
    <Modal
      title={`停用绑定 · ${deviceName}（${deviceId} · v${version}）`}
      width={520}
      open={open}
      onOk={doDisable}
      onCancel={() => { setReason(''); onClose(); }}
      okText="确认停用" cancelText="取消"
    >
      <Alert
        type="warning" showIcon style={{ marginBottom: 12 }}
        message="停用后该设备数据接入立即停止，实时监测 / 指标报警 / 稼动率 / 报表失去数据来源（状态「已停用」）；可重新编辑绑定后再次启用。"
      />
      <div style={{ marginBottom: 6, fontSize: 12, color: '#5d6b78' }}>停用原因（必填，进入业务履历留痕）</div>
      <Input.TextArea
        rows={3}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="如：设备转产停用 / IoT 网关更换，待重新绑定"
      />
    </Modal>
  );
}

// ---------- 监控指标配置弹窗（Tab 2）：按来源分组勾选监控指标，勾选即时生效（不产生新版本） ----------
function MonitorConfigModal({ deviceId, deviceName, open, onClose }) {
  const state = useDemoState();
  const actions = useDemoActions();
  const { message } = App.useApp();
  const [tplNameOpen, setTplNameOpen] = useState(false);
  const [tplName, setTplName] = useState('');

  const binding = state.entities.bindingsByDeviceId[deviceId];
  const items = (binding?.items || []).filter((i) => i.enabled);
  const totalCount = items.reduce((s, i) => s + (i.metrics || []).length, 0);
  const monitoredCount = items.reduce((s, i) => s + (i.metrics || []).filter((m) => m.monitored).length, 0);

  useEffect(() => {
    if (open) { setTplNameOpen(false); setTplName(deviceName ? `${deviceName}监控模板` : ''); }
  }, [open, deviceName]);

  const toggle = (item, metric) => actions.setMetricMonitored(deviceId, item, metric.metricCode);

  const toggleAll = (item, on) => {
    (item.metrics || []).forEach((m) => {
      if (!!m.monitored !== on) actions.setMetricMonitored(deviceId, item, m.metricCode);
    });
  };

  // 存为模板：固化「来源结构 + 监控指标口径」，供批量应用到同型号设备（绑定+监控一次到位）
  const doSaveTemplate = () => {
    const name = tplName.trim();
    if (!name) { message.warning('请填写模板名称'); return; }
    if (!items.length) { message.warning('当前绑定没有启用的来源，无法保存为模板'); return; }
    if (!monitoredCount) { message.warning('尚未勾选任何监控指标：请至少勾选 1 项后再存为模板'); return; }
    const template = {
      templateId: `bt-${Date.now()}`,
      name,
      sourceName: `${deviceName || deviceId}（${deviceId}）`,
      items: items.map((i) => ({
        sensorType: i.sensorType && i.sensorType !== '--' ? i.sensorType : '来源设备',
        metrics: (i.metrics || []).map((m) => ({ metricCode: m.metricCode, metricVersion: m.metricVersion, monitored: !!m.monitored })),
      })),
    };
    const r = actions.saveBindingTemplate(template);
    r.ok ? message.success(r.message) : message.error(r.message);
    setTplNameOpen(false);
  };

  return (
    <Modal
      title={(
        <Space size={8}>
          <span>监控指标配置 · {deviceName}（{deviceId}）</span>
          <Tag color="blue">监控中 {monitoredCount} / 接入 {totalCount} 项</Tag>
        </Space>
      )}
      width={860}
      open={open}
      onCancel={onClose}
      footer={[
        <Button key="close" onClick={onClose}>关闭</Button>,
        <Button key="tpl" type="primary" ghost icon={<LayoutTemplate size={14} />} disabled={!monitoredCount} onClick={() => setTplNameOpen(true)}>存为模板</Button>,
      ]}
    >
      <Alert
        type="info" showIcon style={{ marginBottom: 12 }}
        message="该设备的全部接入指标已在持续存储；勾选 = 纳入监控（曲线 / 实时监测呈现），不勾选 = 仅存储不做监控，可随时在设备台账「数据指标历史」中查看。勾选即时生效，不产生新绑定版本。"
      />
      {!binding ? (
        <div style={{ color: '#8a97a3', fontSize: 12 }}>该设备尚未创建绑定：请先在「设备绑定管理」Tab 完成绑定。</div>
      ) : (
        items.map((item) => {
          const monitoredOfItem = (item.metrics || []).filter((m) => m.monitored).length;
          return (
            <Card
              key={item.iotDeviceId}
              size="small"
              style={{ marginBottom: 8 }}
              title={(
                <Space size={6} wrap>
                  <span>{item.iotDeviceCode} · {item.sensorType && item.sensorType !== '--' ? item.sensorType : '来源设备'}</span>
                </Space>
              )}
              extra={(
                <Space size={6}>
                  <span style={{ fontSize: 12, color: '#8a97a3' }}>监控中 {monitoredOfItem} / {(item.metrics || []).length} 项</span>
                  <Button size="text" type="text" style={{ fontSize: 12, padding: '0 4px' }} onClick={() => toggleAll(item, true)}>全选</Button>
                  <Button size="text" type="text" style={{ fontSize: 12, padding: '0 4px' }} onClick={() => toggleAll(item, false)}>清空</Button>
                </Space>
              )}
            >
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 4 }}>
                {(item.metrics || []).map((m) => {
                  const def = state.entities.metricsByKey[m.metricCode];
                  return (
                    <Checkbox key={m.metricCode} checked={!!m.monitored} onChange={() => toggle(item, m)}>
                      <span>{def?.name || m.metricCode}（{m.metricCode} · {m.metricVersion}）</span>
                    </Checkbox>
                  );
                })}
              </div>
            </Card>
          );
        })
      )}
      <Modal
        title="保存为监控指标模板"
        width={460}
        open={tplNameOpen}
        destroyOnClose
        onCancel={() => setTplNameOpen(false)}
        onOk={doSaveTemplate}
        okText="保存模板" cancelText="取消"
      >
        <Typography.Paragraph type="secondary" style={{ fontSize: 12 }}>
          模板记录来源结构与监控指标口径（不记录具体 IoT 编码）：应用到设备时自动创建绑定并按模板预置监控勾选，同一模板可应用到任意多台同型号设备。模板的新建 / 编辑 / 删除也可在「监控指标模板管理」页维护。
        </Typography.Paragraph>
        <Input placeholder="模板名称（如：CNC 加工中心标准监控模板）" value={tplName} onChange={(e) => setTplName(e.target.value)} />
      </Modal>
    </Modal>
  );
}

// 模板批量应用弹窗已抽为共享组件（components/ApplyTemplateModal.jsx），供本页两个 Tab 与「监控指标模板管理」页共用。

// ---------- 主页面 ----------
export default function BindingOverviewPage() {
  const state = useDemoState();
  const actions = useDemoActions();
  const { message } = App.useApp();
  const navigate = useNavigate();

  // UI 局部状态：弹窗开关
  const [draftTarget, setDraftTarget] = useState(null);     // { deviceId, deviceName }
  const [disableTarget, setDisableTarget] = useState(null); // { deviceId, deviceName, version }
  const [applyTarget, setApplyTarget] = useState(null);     // null=关闭；字符串=预选模板 id（''=不预选）
  const [monitorTarget, setMonitorTarget] = useState(null); // { deviceId, deviceName }
  const [activeTab, setActiveTab] = useState('binding');

  const rows = useMemo(() => selectAllDevices(state).map((d) => {
    const binding = state.entities.bindingsByDeviceId[d.deviceId] || null;
    const draft = selectBindingDraft(state, d.deviceId);
    const health = state.entities.healthByDeviceId[d.deviceId] || {};
    const status = draft ? draft.configStatus : (binding?.configStatus || '未配置');
    const current = draft || binding;
    const metricTotal = current?.items?.reduce((s, i) => s + (i.metrics || []).length, 0) ?? null;
    const metricMonitored = current?.items?.reduce((s, i) => s + (i.metrics || []).filter((m) => m.monitored).length, 0) ?? null;
    return { device: d, binding, draft, health, status, metricTotal, metricMonitored };
  }), [state]);

  const activeCount = rows.filter((r) => r.status === '已启用').length;
  const unconfiguredCount = rows.filter((r) => r.status === '未配置').length;
  const interruptedCount = rows.filter((r) => r.health.status === '数据中断').length;
  const monitoredDeviceCount = rows.filter((r) => (r.metricMonitored ?? 0) > 0).length;

  const enable = (r) => {
    const res = actions.enableBinding(r.device.deviceId);
    if (res.ok) message.success(res.message);
    else message.error(res.message);
  };

  const renderActions = (r) => {
    const { status, binding, device } = r;
    if (status === '未配置') {
      return <Button type="primary" size="small" icon={<Plus size={13} />} onClick={() => setDraftTarget({ deviceId: device.deviceId, deviceName: device.name })}>新建绑定</Button>;
    }
    if (status === '已启用') {
      return (
        <Space size={4}>
          <Button size="small" icon={<Activity size={13} />} onClick={() => { setActiveTab('monitor'); setMonitorTarget({ deviceId: device.deviceId, deviceName: device.name }); }}>监控指标</Button>
          <Button size="small" icon={<PauseCircle size={13} />} onClick={() => setDisableTarget({ deviceId: device.deviceId, deviceName: device.name, version: binding?.version ?? '--' })}>停用</Button>
          <Tooltip title="换绑说明：直接打开绑定草稿，修改来源后保存，将生成新版本（旧版本留痕不覆盖）；监控勾选按来源+指标自动继承；新版本「待生效」→「启用」后完成换绑。">
            <Button size="small" type="text" icon={<Settings2 size={13} />}>换绑</Button>
          </Tooltip>
        </Space>
      );
    }
    if (status === '待生效') {
      return (
        <Space size={4}>
          <Button type="primary" size="small" icon={<Play size={13} />} onClick={() => enable(r)}>启用</Button>
          <Button size="small" onClick={() => setDraftTarget({ deviceId: device.deviceId, deviceName: device.name })}>编辑草稿</Button>
        </Space>
      );
    }
    if (status === '已停用') {
      // 状态机约束：已停用 → 草稿（重新绑定保存后「待生效」→「启用」），不能直接启用
      return <Button size="small" icon={<Plus size={13} />} onClick={() => setDraftTarget({ deviceId: device.deviceId, deviceName: device.name })}>重新绑定</Button>;
    }
    // 草稿 / 校验中 / 换绑中：继续编辑草稿
    return <Button size="small" onClick={() => setDraftTarget({ deviceId: device.deviceId, deviceName: device.name })}>继续编辑</Button>;
  };

  // ===== Tab 1：设备绑定管理 =====
  const bindingTab = (
    <>
      <Row gutter={12} style={{ marginBottom: 12 }}>
        <Col span={6}><Card size="small"><Statistic title="设备绑定关系" value={rows.length} suffix="台" /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title="已启用（接入中）" value={activeCount} suffix="台" valueStyle={{ color: '#3f8600' }} /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title="未配置" value={unconfiguredCount} suffix="台" valueStyle={{ color: unconfiguredCount ? '#d46b08' : undefined }} /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title="数据中断" value={interruptedCount} suffix="台" valueStyle={{ color: interruptedCount ? '#cf1322' : undefined }} /></Card></Col>
      </Row>

      <Alert
        type="info" showIcon icon={<LayoutTemplate size={14} />} style={{ marginBottom: 12 }}
        message={(
          <Space size={4} wrap>
            <span>同型号设备可用「监控指标模板」一次完成绑定接入 + 监控勾选：模板的新建 / 编辑 / 删除在「监控指标模板管理」页维护。</span>
            <a onClick={() => navigate('/binding-templates')}>前往监控指标模板管理 →</a>
          </Space>
        )}
      />

      <Card
        size="small" style={{ marginBottom: 12 }}
        title="设备绑定列表（8 台设备）"
        extra={(
          <Space size={8}>
            <Button size="small" icon={<LayoutTemplate size={13} />} onClick={() => setApplyTarget('')}>模板快速接入</Button>
            {/* 顶部「新建绑定」不预选设备：向导第 1 步先选设备管理系统的设备 */}
            <Button type="primary" size="small" icon={<Plus size={13} />} onClick={() => setDraftTarget({})}>新建绑定</Button>
          </Space>
        )}
      >
        <Table
          rowKey={(r) => r.device.deviceId}
          size="small"
          dataSource={rows}
          pagination={false}
          columns={[
            { title: '设备编号', width: 100, render: (_, r) => r.device.deviceId },
            { title: '设备名称', width: 130, render: (_, r) => r.device.name },
            {
              title: '配置状态', width: 100,
              render: (_, r) => (
                <StatusTag
                  value={r.status}
                  tip={r.draft ? '存在未保存的绑定草稿（保存后生成新版本「待生效」）' : undefined}
                />
              ),
            },
            { title: '健康状态', width: 100, render: (_, r) => <StatusTag value={r.health.status || '--'} /> },
            {
              title: '绑定版本', width: 90,
              render: (_, r) => (r.draft ? <span>草稿 v{r.draft.version}</span> : (r.binding ? `v${r.binding.version}` : '--')),
            },
            {
              title: '来源数 / 接入指标', width: 140,
              render: (_, r) => {
                if (r.metricTotal === null) return '--';
                const items = (r.draft || r.binding)?.items || [];
                return `${items.filter((i) => i.enabled).length} / ${r.metricTotal} 项`;
              },
            },
            {
              title: '监控指标', width: 100,
              render: (_, r) => {
                if (r.metricMonitored === null) return '--';
                return r.metricMonitored > 0
                  ? <Tag color="blue">{r.metricMonitored} 项</Tag>
                  : <Tooltip title="未勾选监控指标：数据仍全量存储，可在「监控指标配置」Tab 勾选后进入曲线监测"><Tag style={{ cursor: 'help' }}>0 项</Tag></Tooltip>;
              },
            },
            { title: '拉取周期', width: 90, render: (_, r) => (r.binding ? `${r.binding.pullCycleSec} 秒` : '--') },
            { title: '最近拉取', width: 150, render: (_, r) => (r.binding?.lastPullTime || '--') },
            {
              title: '待补偿', width: 90,
              render: (_, r) => (r.binding?.pendingCompensation ? <span style={{ color: '#d46b08' }}>{r.binding.pendingCompensation} 个</span> : '0 个'),
            },
            { title: '操作', width: 230, fixed: 'right', render: (_, r) => renderActions(r) },
          ]}
          expandable={{
            expandedRowRender: (r) => {
              const items = (r.draft || r.binding)?.items || [];
              if (!items.length) return <span style={{ color: '#8a97a3', fontSize: 12 }}>无绑定来源（{r.status === '未配置' ? '未配置：点击「新建绑定」创建首个绑定' : '--'}）</span>;
              return (
                <div style={{ display: 'grid', gap: 6 }}>
                  {items.map((i) => (
                    <div key={i.iotDeviceId} style={{ fontSize: 12 }}>
                      <Space size={6} wrap>
                        <Tag color={i.enabled ? undefined : 'default'}>{i.iotDeviceCode}{i.enabled ? '' : '（停用）'}</Tag>
                        <span>{i.sensorType && i.sensorType !== '--' ? i.sensorType : '来源设备'}</span>
                        <span style={{ color: '#8a97a3' }}>接入：</span>
                        {(i.metrics || []).map((m) => {
                          const def = state.entities.metricsByKey[m.metricCode];
                          return (
                            <Tag
                              key={m.metricCode}
                              color={m.monitored ? 'blue' : 'default'}
                              style={{ cursor: 'help' }}
                              title={m.monitored ? '监控中：纳入曲线 / 实时监测呈现' : '仅存储：未纳入监控，可在设备台账「数据指标历史」查看'}
                            >
                              {def?.name || m.metricCode}{m.monitored ? ' · 监控中' : ''}
                            </Tag>
                          );
                        })}
                      </Space>
                    </div>
                  ))}
                </div>
              );
            },
          }}
        />
        <div style={{ color: '#5d6b78', fontSize: 12, marginTop: 8 }}>
          绑定即接入：绑定启用后系统获取来源上报的全部数据指标并存储（指标自动发现，无需人工勾选）；未纳入监控的指标在设备台账「数据指标历史」中可查。
          换绑说明：已启用设备可点击「换绑」打开绑定草稿，修改来源后保存将生成新版本 binding-&#123;deviceId&#125;-NN（旧版本留痕不覆盖，监控勾选按来源+指标自动继承），新版本状态「待生效」，点「启用」后完成换绑。
          校验规则：至少 1 个启用的 IoT 来源设备、同一绑定内来源编码不重复；来源不分主/子设备（来源间平级），来源编码被其它设备占用仅提示、不限制绑定。
          监控指标（曲线呈现）在 <a onClick={() => setActiveTab('monitor')}>监控指标配置</a> 中按需勾选；接入任务健康度见 <a onClick={() => navigate('/platform-metrics')}>平台指标清单 / 接入任务</a>。
        </div>
      </Card>
    </>
  );

  // ===== Tab 2：监控指标配置 =====
  const monitorRows = rows.filter((r) => ['待生效', '已启用'].includes(r.status) && !r.draft);
  const monitorTab = (
    <>
      <Alert
        type="info" showIcon icon={<MonitorCheck size={14} />} style={{ marginBottom: 12 }}
        message="已绑定设备的全部接入指标均在持续存储；此处勾选纳入监控（曲线 / 实时监测呈现）的指标，可以全部不勾选（仅存数据不做监控）。勾选即时生效、不产生新绑定版本；未勾选指标可随时在设备台账「数据指标历史」中查看。"
      />
      <Card
        size="small" style={{ marginBottom: 12 }}
        title={`监控指标配置列表（${monitorRows.length} 台已绑定设备，其中 ${monitoredDeviceCount} 台已配置监控指标）`}
        extra={(
          <Space size={8}>
            <Button size="small" icon={<LayoutTemplate size={13} />} onClick={() => setApplyTarget('')}>模板应用到设备</Button>
            <Button size="small" type="primary" ghost onClick={() => navigate('/binding-templates')}>监控指标模板管理</Button>
          </Space>
        )}
      >
        <Table
          rowKey={(r) => r.device.deviceId}
          size="small"
          dataSource={monitorRows}
          pagination={false}
          columns={[
            { title: '设备编号', width: 110, render: (_, r) => r.device.deviceId },
            { title: '设备名称', width: 150, render: (_, r) => r.device.name },
            { title: '绑定状态', width: 100, render: (_, r) => <StatusTag value={r.status} /> },
            {
              title: '接入指标', width: 100,
              render: (_, r) => `${r.metricTotal ?? '--'} 项`,
            },
            {
              title: '监控中指标', width: 110,
              render: (_, r) => ((r.metricMonitored ?? 0) > 0
                ? <Tag color="blue">{r.metricMonitored} 项</Tag>
                : <Tag>未配置（仅存储）</Tag>),
            },
            { title: '健康状态', width: 100, render: (_, r) => <StatusTag value={r.health.status || '--'} /> },
            {
              title: '操作', width: 150,
              render: (_, r) => (
                <Button type="primary" ghost size="small" icon={<Activity size={13} />} onClick={() => setMonitorTarget({ deviceId: r.device.deviceId, deviceName: r.device.name })}>
                  配置监控指标
                </Button>
              ),
            },
          ]}
        />
        <div style={{ color: '#5d6b78', fontSize: 12, marginTop: 8 }}>
          口径说明：设备绑定（Tab 1）决定「接入哪些设备、存储哪些数据」；本页决定「哪些指标进入曲线监控」——两者独立。
          同型号设备批量配置：在一台设备上勾选好后「存为模板」，再通过「模板应用到设备」批量下发（自动创建绑定并预置监控勾选）。
        </div>
      </Card>
    </>
  );

  return (
    <>
      <PageHeader
        title="物联网接入配置"
        subtitle="第 1 步 设备绑定管理：绑定 IoT 来源设备，绑定即全量接入并存储上报数据 → 第 2 步 监控指标配置：按需勾选纳入曲线监控的指标（可不选）。协议/网关/点位由物联网平台管理，本页不维护"
      />
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          { key: 'binding', label: '设备绑定管理', children: bindingTab },
          { key: 'monitor', label: '监控指标配置', children: monitorTab },
        ]}
      />

      <BindingDraftModal
        deviceId={draftTarget?.deviceId}
        deviceName={draftTarget?.deviceName}
        open={!!draftTarget}
        onClose={() => setDraftTarget(null)}
      />
      <DisableBindingModal
        deviceId={disableTarget?.deviceId}
        deviceName={disableTarget?.deviceName}
        version={disableTarget?.version}
        open={!!disableTarget}
        onClose={() => setDisableTarget(null)}
      />
      <MonitorConfigModal
        deviceId={monitorTarget?.deviceId}
        deviceName={monitorTarget?.deviceName}
        open={!!monitorTarget}
        onClose={() => setMonitorTarget(null)}
      />
      <ApplyTemplateModal
        open={applyTarget !== null}
        initialTemplateId={applyTarget || ''}
        onClose={() => setApplyTarget(null)}
      />
    </>
  );
}
