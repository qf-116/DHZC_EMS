// ============================================================
// 物联网接入配置（/binding-overview · 数据接入域核心交互页）
// 2026-10-27 口径：单页单列表（原「设备绑定 / 监控指标」双 Tab 合并）——
//   绑定向导三步走：① 选择主设备（设备管理台账）→ ② 选择物联网平台子设备（来源，可多选，来源间平级）
//   → ③ 选择监控指标（可选：不选则无曲线 / 实时监测呈现；无论选否，接入指标均全量存储，
//   可在设备台账「数据指标历史」查看）。向导内监控勾选作用于草稿（binding/setDraftMonitored，
//   保存时随草稿整体落库）；已保存绑定的勾选调整走行内「监控指标」（binding/setMonitored，即时生效）。
// 状态轴：未配置 → 草稿 → 校验 → 待生效 → 已启用 → 已停用/换绑中（domain/binding.js）。
// 绑定版本不再作为页面列展示（内部仍随保存递增留痕）；待补偿字段已移除。
// DEV-008 故意未配置，用于演示「首次绑定」全流程（首绑后监控指标默认全部不勾选）。
// ============================================================

import React, { useEffect, useMemo, useState } from 'react';
import {
  App, Alert, Button, Card, Checkbox, Input, Modal, Select, Space, Steps, Table, Tag, Tooltip, Typography,
} from 'antd';
import { Plus, Save, Play, PauseCircle, Settings2, LayoutTemplate, Activity, ArrowRight, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../components/PageHeader.jsx';
import StatusTag from '../components/StatusTag.jsx';
import ApplyTemplateModal from '../components/ApplyTemplateModal.jsx';
import { useDemoState, useDemoActions } from '../state/DemoStore.jsx';
import { selectAllDevices, selectBindingDraft } from '../state/selectors.js';
import { validateBindingDraft } from '../domain/binding.js';

// ---------- 绑定草稿弹窗（三步向导：① 选主设备（设备管理台账）→ ② 选物联网平台子设备 →
// ③ 选监控指标（可选））。勾选子设备即自动发现其上报的全部指标（reducer binding/addSource 带出），
// 第 3 步按需勾选纳入曲线监控的子集（可以全不选）；保存时监控勾选随草稿整体落库。
// 草稿状态全部来自 store，不经页面 useState。从列表行进入时预选设备、直接到第 2 步。 ----------
function BindingDraftModal({ deviceId: presetDeviceId, deviceName, open, onClose }) {
  const state = useDemoState();
  const actions = useDemoActions();
  const { message } = App.useApp();
  const [step, setStep] = useState(0);                        // 向导步骤：0=选主设备，1=选 IoT 子设备，2=选监控指标
  const [deviceId, setDeviceId] = useState(null);             // 向导内选定的设备管理台账设备
  const [devKw, setDevKw] = useState('');                     // 第 1 步查询条件：编号/名称/资产编码
  const [devBound, setDevBound] = useState('all');            // 第 1 步查询条件：是否已绑定
  const [devType, setDevType] = useState('all');              // 第 1 步查询条件：设备类型
  const [sourceKw, setSourceKw] = useState('');               // 来源列表搜索（设备多时缓解弹窗拥挤）
  const [sourceProduct, setSourceProduct] = useState('all');  // 来源列表查询条件：产品名称

  const allDevices = useMemo(() => selectAllDevices(state), [state]);
  const draft = deviceId ? selectBindingDraft(state, deviceId) : null;
  const sourceDevicesAll = Object.values(state.entities.sourceDevicesById);
  const sourceDevices = useMemo(() => {
    const k = sourceKw.trim().toLowerCase();
    return sourceDevicesAll
      .filter((s) => (sourceProduct === 'all' ? true : s.product === sourceProduct))
      .filter((s) => (!k ? true : `${s.iotDeviceCode} ${s.name}`.toLowerCase().includes(k)));
  }, [sourceDevicesAll, sourceKw, sourceProduct]);
  const sourceProducts = useMemo(
    () => [...new Set(sourceDevicesAll.map((s) => s.product).filter(Boolean))],
    [sourceDevicesAll],
  );

  // 勾选来源（表格行选 / 多选）：新增走 binding/addSource（自动发现指标），移除走 binding/removeSource
  const toggleSourcesByIds = (ids) => {
    ids.forEach((id) => {
      const s = sourceDevicesAll.find((x) => x.iotDeviceId === id);
      if (!s) return;
      if (draftItems.some((i) => i.iotDeviceId === id)) {
        actions.removeBindingSource(deviceId, id);
      } else {
        actions.addBindingSource(deviceId, {
          iotDeviceId: s.iotDeviceId,
          iotDeviceCode: s.iotDeviceCode,
          name: s.name,
          sensorType: s.name,
          metrics: [],
        });
      }
    });
  };
  const toggleSources = (keys) => toggleSourcesByIds(
    keys.filter((id) => !draftItems.some((i) => i.iotDeviceId === id))
      .concat(draftItems.map((i) => i.iotDeviceId).filter((id) => !keys.includes(id))),
  );
  const currentVersion = state.entities.bindingsByDeviceId[deviceId]?.version || 0;

  // 每次打开重置向导进度：预选了设备（换绑/编辑草稿）直接进第 2 步，否则从第 1 步选设备开始
  useEffect(() => {
    if (open) {
      setStep(presetDeviceId ? 1 : 0);
      setDeviceId(presetDeviceId || null);
      setSourceKw('');
      setSourceProduct('all');
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
  const monitoredMetrics = draftItems.reduce((s, i) => s + (i.metrics || []).filter((m) => m.monitored).length, 0);
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
      if (!deviceId) { message.warning('请先选择设备管理系统的主设备'); return; }
      if (boundOf(deviceId)) { message.warning('该设备已绑定，不能重复绑定：请关闭后使用列表中的「换绑」'); return; }
      setStep(1);
      return;
    }
    if (step === 1) {
      if (!draftItems.length) { message.warning('请先勾选至少 1 个物联网平台子设备'); return; }
      setStep(2);
    }
  };

  const goPrev = () => setStep(step - 1);

  // 保存：reducer 内部先校验（至少 1 个启用来源 / 同一绑定内来源编码不重复），通过后生成新版本；
  // 监控指标勾选随草稿整体落库（可以全部不勾选）
  const doSave = () => {
    if (!draft) { message.warning('请先勾选物联网平台子设备，生成绑定草稿'); return; }
    const res = validateBindingDraft(draft, { metricsByKey: state.entities.metricsByKey });
    if (!res.ok) { message.error(`校验未通过：${res.errors.join('；')}`); return; }
    const r = actions.saveBinding(deviceId, `绑定草稿 v${draft.version}：${draftItems.length} 个来源 / 自动接入 ${discoveredMetrics} 项指标 / 监控 ${monitoredMetrics} 项`);
    if (r.ok) {
      message.success(monitoredMetrics > 0
        ? `${r.message}；启用后开始接入存储，${monitoredMetrics} 项监控指标进入曲线呈现`
        : `${r.message}；未勾选监控指标——数据仍全量存储，可随时在行内「监控指标」中勾选，或到设备台账「数据指标历史」查看`);
      onClose();
    } else {
      message.error(r.message);
    }
  };

  // 第 3 步：草稿监控勾选（作用于草稿，保存时随草稿整体落库）
  const toggleDraftMetric = (item, metricCode) => actions.setDraftMetricMonitored(deviceId, item, metricCode);
  const toggleDraftAll = (item, on) => {
    (item.metrics || []).forEach((m) => {
      if (!!m.monitored !== on) actions.setDraftMetricMonitored(deviceId, item, m.metricCode);
    });
  };

  const footer = [
    <Button key="cancel" onClick={onClose}>取消</Button>,
    ...(step > 0 ? [<Button key="prev" icon={<ArrowLeft size={14} />} onClick={goPrev}>上一步</Button>] : []),
    ...(step === 0
      ? [<Button key="next" type="primary" disabled={!deviceId} onClick={goNext}>下一步：选择物联网平台子设备 <ArrowRight size={14} style={{ verticalAlign: '-2px' }} /></Button>]
      : step === 1
        ? [<Button key="next2" type="primary" disabled={!draftItems.length} onClick={goNext}>下一步：选择监控指标 <ArrowRight size={14} style={{ verticalAlign: '-2px' }} /></Button>]
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
        size="small" current={step} style={{ marginBottom: 16, maxWidth: 660 }}
        items={[{ title: '选择主设备' }, { title: '选择 IoT 子设备' }, { title: '选择监控指标（可选）' }]}
      />

      {step === 0 && (
        <>
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
            {deviceId ? <>已选主设备：<b>{selectedDevice?.deviceId} · {selectedDevice?.name}</b></> : '尚未选择主设备'}
          </Typography.Paragraph>
        </>
      )}

      {step === 1 && (
        <>
          <Space size={8} wrap style={{ marginBottom: 8 }}>
            <Input
              allowClear size="small" style={{ width: 220 }}
              placeholder="搜索来源编码 / 名称" value={sourceKw} onChange={(e) => setSourceKw(e.target.value)}
            />
            <Select
              size="small" style={{ width: 170 }} value={sourceProduct}
              onChange={setSourceProduct}
              options={[{ value: 'all', label: '产品名称：全部' }, ...sourceProducts.map((t) => ({ value: t, label: t }))]}
            />
            <Button size="small" onClick={() => { setSourceKw(''); setSourceProduct('all'); }}>重置</Button>
          </Space>
          <Table
            rowKey="iotDeviceId" size="small"
            dataSource={sourceDevices}
            pagination={sourceDevices.length > 8 ? { pageSize: 8, size: 'small' } : false}
            rowSelection={{
              selectedRowKeys: draftItems.map((i) => i.iotDeviceId),
              onChange: toggleSources,
              columnWidth: 40,
            }}
            onRow={(s) => ({
              // 点击行切换勾选；点击勾选框列本身不重复触发（由 rowSelection 处理）
              onClick: (e) => {
                if (e.target.closest('.ant-table-selection-column')) return;
                toggleSourcesByIds([s.iotDeviceId]);
              },
              style: { cursor: 'pointer' },
            })}
            columns={[
              { title: '来源编码', dataIndex: 'iotDeviceCode', width: 120 },
              { title: '来源名称', dataIndex: 'name', width: 170 },
              { title: '产品名称', dataIndex: 'product', width: 150, render: (v) => v || '--' },
              { title: '类型', dataIndex: 'kind', width: 90 },
              {
                title: '接入指标', width: 110,
                render: (_, s) => {
                  const item = draftItems.find((i) => i.iotDeviceId === s.iotDeviceId);
                  if (!item) return <span style={{ color: '#b6c2cc' }}>--</span>;
                  return (
                    <Tooltip title="指标自动发现：保存启用后将全量接入并存储这些指标">
                      <Tag color="cyan" style={{ cursor: 'help' }}>将接入 {(item.metrics || []).length} 项</Tag>
                    </Tooltip>
                  );
                },
              },
              {
                title: '占用状态', width: 140,
                render: (_, s) => (occupiedCodes.has(s.iotDeviceCode)
                  ? (
                    <Tooltip title="仅提示：该编码已被其它设备绑定，不影响本次绑定（业务允许多台设备绑定同一来源）">
                      <Tag color="warning" style={{ cursor: 'help' }}>已被其它设备占用</Tag>
                    </Tooltip>
                  )
                  : <span style={{ color: '#b6c2cc' }}>--</span>),
              },
            ]}
          />
          <Typography.Paragraph type="secondary" style={{ fontSize: 12, margin: '8px 0 0' }}>
            已选 <b>{draftItems.length}</b> 个来源 · 自动发现 <b>{discoveredMetrics}</b> 项指标
          </Typography.Paragraph>
        </>
      )}

      {step === 2 && (
        <>
          {draftItems.map((item) => {
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
                    <Button size="text" type="text" style={{ fontSize: 12, padding: '0 4px' }} onClick={() => toggleDraftAll(item, true)}>全选</Button>
                    <Button size="text" type="text" style={{ fontSize: 12, padding: '0 4px' }} onClick={() => toggleDraftAll(item, false)}>清空</Button>
                  </Space>
                )}
              >
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 4 }}>
                  {(item.metrics || []).map((m) => {
                    const def = state.entities.metricsByKey[m.metricCode];
                    return (
                      <Checkbox key={m.metricCode} checked={!!m.monitored} onChange={() => toggleDraftMetric(item, m.metricCode)}>
                        <span>{def?.name || m.metricCode}（{m.metricCode} · {m.metricVersion}）</span>
                      </Checkbox>
                    );
                  })}
                </div>
              </Card>
            );
          })}
          <Typography.Paragraph type="secondary" style={{ fontSize: 12, marginBottom: 0 }}>
            共接入 <b>{discoveredMetrics}</b> 项指标 · 已勾选监控 <b>{monitoredMetrics}</b> 项
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

// ---------- 监控指标弹窗（行内操作）：按来源分组勾选监控指标。
// 2026-10-29 交互统一：勾选先暂存在弹窗本地状态，点击「确认」后统一生效（不产生新版本）；
// 已保存绑定的事后调整入口（绑定向导第 3 步覆盖创建期勾选）。「存为模板」操作已移除 ----------
function MonitorConfigModal({ deviceId, deviceName, open, onClose }) {
  const state = useDemoState();
  const actions = useDemoActions();
  const { message } = App.useApp();
  // 本地暂存：key = `${iotDeviceId}:${metricCode}` → 是否监控（打开时从绑定当前值初始化）
  const [draftFlags, setDraftFlags] = useState({});

  const binding = state.entities.bindingsByDeviceId[deviceId];
  const items = (binding?.items || []).filter((i) => i.enabled);
  const totalCount = items.reduce((s, i) => s + (i.metrics || []).length, 0);
  const draftMonitoredCount = items.reduce(
    (s, i) => s + (i.metrics || []).filter((m) => draftFlags[`${i.iotDeviceId}:${m.metricCode}`]).length, 0,
  );
  // 与当前生效值的差异数（用于确认按钮提示与空变更拦截）
  const changedCount = items.reduce((s, i) => s + (i.metrics || []).filter(
    (m) => !!draftFlags[`${i.iotDeviceId}:${m.metricCode}`] !== !!m.monitored,
  ).length, 0);

  useEffect(() => {
    if (open) {
      const flags = {};
      items.forEach((i) => (i.metrics || []).forEach((m) => {
        flags[`${i.iotDeviceId}:${m.metricCode}`] = !!m.monitored;
      }));
      setDraftFlags(flags);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, deviceId]);

  const toggle = (item, metric) => {
    const key = `${item.iotDeviceId}:${metric.metricCode}`;
    setDraftFlags((f) => ({ ...f, [key]: !f[key] }));
  };

  const toggleAll = (item, on) => {
    setDraftFlags((f) => {
      const next = { ...f };
      (item.metrics || []).forEach((m) => { next[`${item.iotDeviceId}:${m.metricCode}`] = on; });
      return next;
    });
  };

  // 确认：把与生效值的全部差异逐项写入（binding/setMonitored，即时生效、不产生新版本）
  const doConfirm = () => {
    if (!changedCount) { message.info('监控指标未变更'); onClose(); return; }
    let applied = 0;
    let failed = 0;
    items.forEach((i) => (i.metrics || []).forEach((m) => {
      if (!!draftFlags[`${i.iotDeviceId}:${m.metricCode}`] !== !!m.monitored) {
        const r = actions.setMetricMonitored(deviceId, i, m.metricCode);
        if (r && r.ok === false) failed += 1;
        else applied += 1;
      }
    }));
    if (failed) { message.error(`${failed} 项变更未生效，请重试`); return; }
    message.success(`监控指标配置已确认生效（更新 ${applied} 项，监控中 ${draftMonitoredCount} / 接入 ${totalCount} 项）`);
    onClose();
  };

  return (
    <Modal
      title={(
        <Space size={8}>
          <span>监控指标配置 · {deviceName}（{deviceId}）</span>
          <Tag color={changedCount ? 'orange' : 'blue'}>
            {changedCount ? `未确认变更 ${changedCount} 项` : `监控中 ${draftMonitoredCount} / 接入 ${totalCount} 项`}
          </Tag>
        </Space>
      )}
      width={860}
      open={open}
      onCancel={onClose}
      footer={[
        <Button key="cancel" onClick={onClose}>取消</Button>,
        <Button key="confirm" type="primary" icon={<Save size={14} />} onClick={doConfirm}>
          确认{changedCount ? `（${changedCount} 项变更）` : ''}
        </Button>,
      ]}
    >
      <Alert
        type="info" showIcon style={{ marginBottom: 12 }}
        message="该设备的全部接入指标已在持续存储；勾选 = 纳入监控（曲线 / 实时监测呈现），不勾选 = 仅存储不做监控，可随时在设备台账「数据指标历史」中查看。勾选后请点击「确认」统一生效（不产生新绑定版本），直接取消则不保存本次修改。"
      />
      {!binding ? (
        <div style={{ color: '#8a97a3', fontSize: 12 }}>该设备尚未创建绑定：请先完成设备绑定。</div>
      ) : (
        items.map((item) => {
          const monitoredOfItem = (item.metrics || []).filter((m) => draftFlags[`${item.iotDeviceId}:${m.metricCode}`]).length;
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
                    <Checkbox
                      key={m.metricCode}
                      checked={!!draftFlags[`${item.iotDeviceId}:${m.metricCode}`]}
                      onChange={() => toggle(item, m)}
                    >
                      <span>{def?.name || m.metricCode}（{m.metricCode} · {m.metricVersion}）</span>
                    </Checkbox>
                  );
                })}
              </div>
            </Card>
          );
        })
      )}
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

  const rows = useMemo(() => selectAllDevices(state).map((d) => {
    const binding = state.entities.bindingsByDeviceId[d.deviceId] || null;
    const draft = selectBindingDraft(state, d.deviceId);
    const status = draft ? draft.configStatus : (binding?.configStatus || '未配置');
    const current = draft || binding;
    const metricTotal = current?.items?.reduce((s, i) => s + (i.metrics || []).length, 0) ?? null;
    const metricMonitored = current?.items?.reduce((s, i) => s + (i.metrics || []).filter((m) => m.monitored).length, 0) ?? null;
    return { device: d, binding, draft, status, metricTotal, metricMonitored };
  }), [state]);

  // 查询条件（实时筛选；规范 §4：关键词 → 下拉 → 重置；2026-10-29 去掉健康状态条件与列）
  const [kw, setKw] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const statusOptions = useMemo(() => [...new Set(rows.map((r) => r.status))], [rows]);
  const filteredRows = useMemo(() => rows.filter((r) => {
    const k = kw.trim().toLowerCase();
    if (k && !`${r.device.deviceId} ${r.device.name} ${r.device.assetCode || ''}`.toLowerCase().includes(k)) return false;
    if (statusFilter !== 'all' && r.status !== statusFilter) return false;
    return true;
  }), [rows, kw, statusFilter]);
  const resetFilters = () => { setKw(''); setStatusFilter('all'); };

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
          <Button size="small" icon={<Activity size={13} />} onClick={() => setMonitorTarget({ deviceId: device.deviceId, deviceName: device.name })}>监控指标</Button>
          <Button size="small" icon={<PauseCircle size={13} />} onClick={() => setDisableTarget({ deviceId: device.deviceId, deviceName: device.name, version: binding?.version ?? '--' })}>停用</Button>
          <Tooltip title="换绑说明：直接打开绑定草稿，修改来源与监控指标后保存，将生成新版本（旧版本留痕不覆盖）；监控勾选按来源+指标自动继承；新版本「待生效」→「启用」后完成换绑。">
            <Button size="small" type="text" icon={<Settings2 size={13} />} onClick={() => setDraftTarget({ deviceId: device.deviceId, deviceName: device.name })}>换绑</Button>
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

  // ===== 主视图：设备绑定列表（规范结构：查询条件 → 工具栏（左上）→ 列表） =====
  const bindingTab = (
    <>
      <Card size="small" style={{ marginBottom: 12 }}>
        <Space wrap size={8}>
          <Input.Search
            allowClear placeholder="搜索设备编号 / 名称 / 资产编码" style={{ width: 240 }}
            value={kw} onChange={(e) => setKw(e.target.value)}
          />
          <Select
            style={{ width: 140 }} value={statusFilter}
            onChange={setStatusFilter}
            options={[{ value: 'all', label: '配置状态：全部' }, ...statusOptions.map((s) => ({ value: s, label: s }))]}
          />
          <Button onClick={resetFilters}>重置</Button>
        </Space>
      </Card>

      <Card size="small">
        <Space wrap style={{ marginBottom: 12 }}>
          <Button type="primary" size="small" icon={<Plus size={13} />} onClick={() => setDraftTarget({})}>新建绑定</Button>
          <Button size="small" icon={<LayoutTemplate size={13} />} onClick={() => setApplyTarget('')}>模板快速接入</Button>
          <Button size="small" icon={<Settings2 size={13} />} onClick={() => navigate('/binding-templates')}>监控指标模板管理</Button>
        </Space>
        <Table
          rowKey={(r) => r.device.deviceId}
          size="small"
          dataSource={filteredRows}
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
            {
              title: '来源设备数 / 接入指标', width: 150,
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
                  : <Tooltip title="未勾选监控指标：无曲线 / 实时监测呈现，数据仍全量存储；可在行内「监控指标」中勾选"><Tag style={{ cursor: 'help' }}>0 项</Tag></Tooltip>;
              },
            },
            { title: '拉取周期', width: 90, render: (_, r) => (r.binding ? `${r.binding.pullCycleSec} 秒` : '--') },
            { title: '最近拉取', width: 150, render: (_, r) => (r.binding?.lastPullTime || '--') },
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
      </Card>
    </>
  );

  return (
    <>
      <PageHeader title="物联网接入配置" />
      {bindingTab}

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
