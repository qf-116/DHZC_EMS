// ============================================================
// 物联网接入配置（/binding-overview · 数据接入域核心交互页）
// 2026-11-04 绑定模板管理下线：向导不再提供模板预填，产品筛选 + 勾选自动发现指标即原生路径。
// 2026-10-27 口径：单页单列表（原「设备绑定 / 监控指标」双 Tab 合并）——
//   绑定向导三步走：① 选择主设备（设备管理台账）→ ② 选择物联网平台子设备（来源，可多选，来源间平级）
//   → ③ 选择监控指标（可选：不选则无曲线 / 实时监测呈现；无论选否，接入指标均全量存储，
//   可在设备台账「数据指标历史」查看）。向导内监控勾选作用于草稿（binding/setDraftMonitored，
//   保存时随草稿整体落库）；已保存绑定的勾选调整走行内「监控指标」（binding/setMonitored，即时生效）。
// 状态轴：未配置 → 草稿 → 校验 → 待生效 → 已启用 → 已停用（domain/binding.js）。
// 页面不展示绑定版本或待补偿字段；绑定关系与状态按当前配置展示。
// 列表仅展示已创建的正式绑定；未配置设备通过「新建绑定」向导选择，不在列表中占位。
// ============================================================

import React, { useEffect, useMemo, useState } from 'react';
import {
  App, Alert, Button, Card, Checkbox, Input, Modal, Select, Space, Steps, Switch, Table, Tag, Tooltip, Typography,
} from 'antd';
import { Plus, Save, Play, PauseCircle, Pencil, Trash2, Eye, ArrowRight, ArrowLeft, LayoutTemplate } from 'lucide-react';
import PageHeader from '../components/PageHeader.jsx';
import FilterBar, { FilterField } from '../components/FilterBar.jsx';
import StatusTag from '../components/StatusTag.jsx';
import OeeTemplateListModal from '../components/OeeTemplateListModal.jsx';
import { useDemoState, useDemoActions } from '../state/DemoStore.jsx';
import { selectAllDevices, selectBindingDraft } from '../state/selectors.js';
import { validateBindingDraft } from '../domain/binding.js';
import { normalizeMetricMeta } from '../domain/alarmRule.js';
import {
  matchOeeTemplates, bestOeeTemplate, templateOeeConfig, oeeConfigOfBinding, oeeConfigSourceLabel,
} from '../domain/oeeTemplate.js';

// OEE 报工事件候选：只有生产报工事件可作为产量 / 质量来源（报警代码等事件类指标不可映射）
const OEE_REPORT_METRICS = new Set(['E.production_report']);

// ---------- 绑定草稿弹窗（三步向导：① 选主设备（设备管理台账）→ ② 选物联网平台子设备 →
// ③ 选监控指标（可选））。勾选子设备即自动发现其上报的全部指标（reducer binding/addSource 带出），
// 第 3 步按需勾选纳入曲线监控的子集（可以全不选）；保存时监控勾选随草稿整体落库。
// 草稿状态全部来自 store，不经页面 useState。从列表行进入时预选设备、直接到第 2 步。 ----------
function BindingDraftModal({ deviceId: presetDeviceId, deviceName, open, onClose }) {
  const state = useDemoState();
  const actions = useDemoActions();
  const { message } = App.useApp();
  const [step, setStep] = useState(0);                        // 向导步骤：0=选主设备，1=选物联网设备，2=选择监控指标
  const [deviceId, setDeviceId] = useState(null);             // 向导内选定的设备管理台账设备
  const [devKw, setDevKw] = useState('');                     // 第 1 步查询条件：编号/名称/资产编码
  const [devBound, setDevBound] = useState(presetDeviceId ? 'all' : 'unbound'); // 第 1 步查询条件：新建绑定默认只看未绑定；编辑（预选设备）看全部
  const [devType, setDevType] = useState('all');              // 第 1 步查询条件：设备类型
  const [sourceKw, setSourceKw] = useState('');               // 来源列表搜索
  const [productFilter, setProductFilter] = useState('all');
  const [appliedSourceKw, setAppliedSourceKw] = useState('');
  const [appliedProductFilter, setAppliedProductFilter] = useState('all');
  const [copyOpen, setCopyOpen] = useState(false);             // 从已有设备复制 OEE 配置
  const [templateOpen, setTemplateOpen] = useState(false);     // 另存为 OEE 模板
  const [templateForm, setTemplateForm] = useState({ name: '', deviceType: '全部', note: '' });
  const [templateApplied, setTemplateApplied] = useState(false); // 本次进入向导后是否已自动套用模板

  const allDevices = useMemo(() => selectAllDevices(state), [state]);
  const draft = deviceId ? selectBindingDraft(state, deviceId) : null;
  const sourceDevicesAll = Object.values(state.entities.sourceDevicesById);
  const sourceDevices = useMemo(() => {
    const k = appliedSourceKw.trim().toLowerCase();
    return sourceDevicesAll
      .filter((s) => (appliedProductFilter === 'all' ? true : s.product === appliedProductFilter))
      .filter((s) => (!k ? true : `${s.iotDeviceCode} ${s.name}`.toLowerCase().includes(k)));
  }, [sourceDevicesAll, appliedSourceKw, appliedProductFilter]);
  const sourceProducts = useMemo(
    () => [...new Set(sourceDevicesAll.map((s) => s.product).filter(Boolean))],
    [sourceDevicesAll],
  );
  const sourceDevicesForView = useMemo(() => sourceDevices.filter((s) => {
    if (productFilter === 'all') return true;
    return s.product === productFilter;
  }), [sourceDevices, productFilter]);

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
  // 每次打开重置向导进度：预选了设备（编辑/编辑草稿）直接进第 2 步，否则从第 1 步选设备开始。
  // 编辑类打开时（已有绑定）：把当前绑定启用的来源带入草稿（binding/addSource 自动继承监控勾选），
  // 来源列表即以「已勾选」状态呈现，用户在此基础上增减后保存。
  useEffect(() => {
    if (open) {
      setStep(presetDeviceId ? 1 : 0);
      setDeviceId(presetDeviceId || null);
      setSourceKw('');
      setProductFilter('all');
      setAppliedSourceKw('');
      setAppliedProductFilter('all');
      setDevKw('');
      setTemplateApplied(false);
      // 新建绑定（无预选设备）默认只看未绑定设备；编辑 / 换绑预选设备时保持全部（主设备已固定）
      if (!presetDeviceId) setDevBound('unbound');
      setDevType('all');
      if (presetDeviceId) {
        const existingDraft = (state.ui.bindingDraftsByDeviceId || {})[`draft-${presetDeviceId}`];
        if (!existingDraft) {
          const binding = state.entities.bindingsByDeviceId[presetDeviceId];
          (binding?.items || [])
            .filter((i) => i.enabled)
            .forEach((i) => {
              actions.addBindingSource(presetDeviceId, {
                iotDeviceId: i.iotDeviceId,
                iotDeviceCode: i.iotDeviceCode,
                name: i.name,
                sensorType: i.sensorType || i.name,
                metrics: [],
              });
            });
          if (binding?.mesPrimarySourceId) {
            actions.setDraftMesPrimarySource(presetDeviceId, binding.mesPrimarySourceId);
          }
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
  const selectedMesPrimaryId = draft?.mesPrimarySourceId || draftItems.find((i) => i.enabled)?.iotDeviceId || null;
  const mesPrimaryOptions = draftItems.filter((i) => i.enabled).map((i) => ({
    value: i.iotDeviceId,
    label: `${i.iotDeviceCode} · ${i.name || state.entities.sourceDevicesById[i.iotDeviceId]?.name || '物联网设备'}`,
  }));
  const discoveredMetrics = draftItems.reduce((s, i) => s + (i.metrics || []).length, 0);
  const monitoredMetrics = draftItems.reduce((s, i) => s + (i.metrics || []).filter((m) => m.monitored).length, 0);
  // OEE 计算配置（2026-11-05）：候选 = 草稿中已勾选监控的指标；状态指标（可用率）+ 报工事件（产量/质量）两项必映射
  const oeeCfg = draft?.oee || { enabled: false };
  const monitoredMetricDefs = React.useMemo(() => {
    const seen = new Map();
    draftItems.forEach((i) => (i.metrics || []).forEach((m) => {
      if (m.monitored && !seen.has(m.metricCode)) {
        const def = normalizeMetricMeta(state.entities.metricsByKey[m.metricCode]);
        if (def && def.syncStatus !== '已失效') seen.set(m.metricCode, def);
      }
    }));
    return [...seen.values()];
  }, [draftItems, state]);
  const selectedDevice = allDevices.find((d) => d.deviceId === deviceId);

  // OEE 模板（2026-11-05）：按「物联网产品 + 设备类型」匹配；同类型精确模板优先，其次通用模板
  const primarySource = draftItems.find((i) => i.role === 'main') || draftItems[0] || null;
  const primaryProduct = primarySource
    ? (state.entities.sourceDevicesById[primarySource.iotDeviceId]?.product || null)
    : null;
  const templateDeviceType = selectedDevice?.type || '全部';
  const matchingTemplates = useMemo(
    () => matchOeeTemplates(Object.values(state.entities.oeeTemplatesById || {}), {
      product: primaryProduct, deviceType: templateDeviceType,
    }),
    [state.entities.oeeTemplatesById, primaryProduct, templateDeviceType],
  );
  const bestTemplate = matchingTemplates[0] || null;
  const currentTemplate = oeeCfg.templateId ? state.entities.oeeTemplatesById?.[oeeCfg.templateId] : null;
  const templateOptions = matchingTemplates.map((t) => ({
    value: t.templateId, label: `${t.name} · v${t.version}`,
  }));
  if (currentTemplate && !templateOptions.some((o) => o.value === currentTemplate.templateId)) {
    templateOptions.unshift({
      value: currentTemplate.templateId,
      label: `${currentTemplate.name} · v${currentTemplate.version}（当前）`,
    });
  }
  const ensureMonitored = (codes) => {
    const wanted = (codes || []).filter(Boolean);
    if (!wanted.length) return;
    draftItems.forEach((item) => (item.metrics || []).forEach((m) => {
      if (wanted.includes(m.metricCode) && !m.monitored) {
        actions.setDraftMetricMonitoredValue(deviceId, item, m.metricCode, true);
      }
    }));
  };
  const applyOeeConfig = (config, label) => {
    if (!config) return;
    actions.setDraftOee(deviceId, { ...config, enabled: true });
    ensureMonitored([config.stateMetricCode, config.reportMetricCode]);
    if (label) message.success(label);
  };
  const applyTemplate = (templateId) => {
    const template = state.entities.oeeTemplatesById?.[templateId];
    if (!template) return;
    applyOeeConfig(
      templateOeeConfig(template, { enabled: true }),
      `已套用产品模板「${template.name}」v${template.version}`,
    );
  };
  const setOee = (patch) => {
    let next = { ...oeeCfg, ...patch };
    if (patch.enabled === true) {
      if (!next.stateMetricCode || !next.reportMetricCode) {
        if (bestTemplate) {
          // 同产品 / 同类型设备自动套用模板，用户只需确认
          next = { ...next, ...templateOeeConfig(bestTemplate, { enabled: true }) };
        } else {
          // 无模板时回退到按指标目录自动预选（状态类指标 + 生产报工事件）
          const stateM = monitoredMetricDefs.find((d) => d.dataType === 'state');
          const reportM = monitoredMetricDefs.find((d) => OEE_REPORT_METRICS.has(d.metricCode));
          next.stateMetricCode = next.stateMetricCode || (stateM?.metricCode || null);
          next.reportMetricCode = next.reportMetricCode || (reportM?.metricCode || null);
          next.configSource = next.configSource || 'manual';
        }
      }
    }
    if (patch.stateMetricCode !== undefined || patch.reportMetricCode !== undefined) {
      // 模板带出后手工改选 → 记为设备级覆盖，不影响模板
      next.configSource = 'manual';
    }
    actions.setDraftOee(deviceId, next);
    if (patch.enabled === true) {
      ensureMonitored([next.stateMetricCode, next.reportMetricCode]);
      if (bestTemplate && next.templateId === bestTemplate.templateId) {
        message.success(`已自动套用产品模板「${bestTemplate.name}」v${bestTemplate.version}`);
      }
    }
  };
  const oeeMetricOptions = (field) => {
    const list = field === 'stateMetricCode'
      ? monitoredMetricDefs.filter((d) => d.dataType === 'state')
      : monitoredMetricDefs.filter((d) => OEE_REPORT_METRICS.has(d.metricCode));
    return list.map((d) => ({
      value: d.metricCode,
      label: `${d.name}（${d.metricCode}）· ${d.dataType === 'state' ? '状态' : '事件'}`,
    }));
  };
  const oeeSourceMeta = oeeConfigSourceLabel(oeeCfg);
  const metricLabelOf = (code) => {
    const def = state.entities.metricsByKey[code];
    return def ? `${def.name}（${code}）` : (code || '--');
  };
  const copyCandidates = Object.values(state.entities.bindingsByDeviceId)
    .filter((b) => b.deviceId !== deviceId)
    .map((b) => ({ binding: b, config: oeeConfigOfBinding(b), device: state.entities.devicesById[b.deviceId] }))
    .filter((x) => x.device && x.config && x.config.enabled !== false
      && x.config.stateMetricCode && x.config.reportMetricCode);
  const openSaveTemplate = () => {
    if (!oeeCfg.stateMetricCode || !oeeCfg.reportMetricCode) {
      message.warning('请先完成状态指标与报工事件映射，再存为模板');
      return;
    }
    // 设备类型精确模板 → 以本设备类型为新范围；通用模板 → 沿用当前设备类型，避免误改通用模板
    const exactTemplate = matchingTemplates.find((t) => t.deviceType === templateDeviceType) || null;
    setTemplateForm({
      name: exactTemplate?.name || `${primaryProduct || '设备'} · ${templateDeviceType} OEE 模板`,
      deviceType: templateDeviceType,
      note: exactTemplate?.note || '',
    });
    setTemplateOpen(true);
  };
  const doSaveTemplate = () => {
    if (!templateForm.name.trim()) { message.error('模板名称必填'); return; }
    if (!primaryProduct) { message.error('无法确定物联网产品，不能存为模板'); return; }
    const r = actions.saveOeeTemplate({
      templateId: null,
      name: templateForm.name.trim(),
      product: primaryProduct,
      deviceType: templateForm.deviceType || templateDeviceType,
      note: templateForm.note,
      sourceDeviceId: deviceId,
      sourceDeviceName: selectedDevice?.name || null,
      config: {
        stateMetricCode: oeeCfg.stateMetricCode,
        reportMetricCode: oeeCfg.reportMetricCode,
      },
    });
    if (!r.ok) { message.error(r.message); return; }
    actions.setDraftOee(deviceId, {
      ...oeeCfg,
      templateId: r.refs.templateId,
      templateName: templateForm.name.trim(),
      templateVersion: r.refs.version,
      configSource: 'template',
    });
    message.success(r.message);
    setTemplateOpen(false);
  };
  // 设备绑定情况：已有绑定（含历史停用）即视为「已绑定」——不能重复新建，只能编辑；
  // 未保存的草稿不算已绑定（放弃草稿即可重新新建）
  const boundOf = (devId) => state.entities.bindingsByDeviceId[devId] || null;
  const deviceRows = useMemo(() => {
    const k = devKw.trim().toLowerCase();
    return allDevices
      .map((d) => ({ ...d, bound: !!boundOf(d.deviceId) }))
      .filter((d) => (devBound === 'all' ? true : devBound === 'bound' ? d.bound : !d.bound))
      .filter((d) => (devType === 'all' ? true : d.type === devType))
      .filter((d) => (!k ? true : `${d.deviceId} ${d.name} ${d.assetCode}`.toLowerCase().includes(k)))
      // 未绑定设备排最前（新建绑定的目标就是未绑定设备），其余按编号排序
      .sort((a, b) => (a.bound === b.bound ? String(a.deviceId).localeCompare(String(b.deviceId)) : (a.bound ? 1 : -1)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allDevices, state.entities.bindingsByDeviceId, devKw, devBound, devType]);
  const deviceTypes = useMemo(() => [...new Set(allDevices.map((d) => d.type).filter(Boolean))], [allDevices]);

  const goNext = () => {
    if (step === 0) {
      if (!deviceId) { message.warning('请先选择设备管理系统的主设备'); return; }
      if (boundOf(deviceId)) { message.warning('该设备已绑定，不能重复绑定：请关闭后使用列表中的「编辑」'); return; }
      setStep(1);
      return;
    }
    if (step === 1) {
      if (!draftItems.length) { message.warning('请先勾选至少 1 个物联网平台子设备'); return; }
      setStep(2);
      // 进入第 3 步：同产品 / 同类型设备自动套用 OEE 模板（需开启开关才落库）
      if (bestTemplate && !templateApplied) {
        if (draft?.oee?.enabled) {
          actions.setDraftOee(deviceId, {
            ...oeeCfg,
            ...templateOeeConfig(bestTemplate, { enabled: true }),
          });
          ensureMonitored([bestTemplate.config?.stateMetricCode, bestTemplate.config?.reportMetricCode]);
        }
        setTemplateApplied(true);
        message.success(`检测到匹配模板「${bestTemplate.name}」v${bestTemplate.version}，开启 OEE 后将自动带出映射`);
      }
    }
  };

  const goPrev = () => setStep(step - 1);

  // 关闭即放弃未保存草稿（2026-10-29：本页不做草稿功能，列表不再出现「草稿/继续编辑」）；
  // 保存成功关闭时草稿已被 saveBinding 消费，此处丢弃为无害空操作
  const handleClose = () => {
    if (deviceId) actions.discardDraft(deviceId);
    onClose();
  };

  // 保存：reducer 内部先校验（至少 1 个启用来源 / 同一绑定内来源编码不重复），通过后保存为待生效状态；
  // 监控指标勾选随草稿整体落库（可以全部不勾选）
  const doSave = () => {
    if (!draft) { message.warning('请先勾选物联网平台子设备，生成绑定草稿'); return; }
    const res = validateBindingDraft(draft, { metricsByKey: state.entities.metricsByKey });
    if (!res.ok) { message.error(`校验未通过：${res.errors.join('；')}`); return; }
    // OEE 校验（2026-11-05）：开启时状态指标 / 报工事件必映射，且映射的指标须已勾选监控
    if (draft.oee?.enabled) {
      const missing = [];
      if (!draft.oee.stateMetricCode) missing.push('状态指标未映射');
      if (!draft.oee.reportMetricCode) missing.push('报工事件未映射');
      if (missing.length) { message.error(`OEE 指标映射未完成：${missing.join('、')}`); return; }
      const monitoredCodes = new Set(draftItems.flatMap((i) => (i.metrics || []).filter((m) => m.monitored).map((m) => m.metricCode)));
      const notMonitored = [draft.oee.stateMetricCode, draft.oee.reportMetricCode]
        .filter((c) => c && !monitoredCodes.has(c));
      if (notMonitored.length) { message.error(`OEE 映射的指标未勾选监控：${notMonitored.join('、')}，请先纳入监控或调整映射`); return; }
    }
    const r = actions.saveBinding(deviceId, `绑定草稿：${draftItems.length} 个来源 / 自动接入 ${discoveredMetrics} 项指标 / 监控 ${monitoredMetrics} 项`);
    if (r.ok) {
      message.success(monitoredMetrics > 0
        ? `${r.message}；启用后开始接入存储，${monitoredMetrics} 项监控指标进入曲线呈现`
        : `${r.message}；未勾选监控指标——数据仍全量存储，可随时在行内「监控指标」中勾选，或到设备台账「数据指标历史」查看`);
      handleClose();
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
    <Button key="cancel" onClick={handleClose}>取消</Button>,
    // 预选设备进入（编辑 / 编辑草稿 / 重新绑定）时主设备已固定，「上一步」无意义，隐藏
    ...(step > 0 && !presetDeviceId ? [<Button key="prev" icon={<ArrowLeft size={14} />} onClick={goPrev}>上一步</Button>] : []),
    ...(step === 0
      ? [<Button key="next" type="primary" disabled={!deviceId} onClick={goNext}>下一步：选择物联网平台子设备 <ArrowRight size={14} style={{ verticalAlign: '-2px' }} /></Button>]
      : step === 1
        ? [<Button key="next2" type="primary" disabled={!draftItems.length} onClick={goNext}>下一步：选择监控指标 <ArrowRight size={14} style={{ verticalAlign: '-2px' }} /></Button>]
        : [<Button key="save" type="primary" icon={<Save size={14} />} disabled={!draftItems.length} onClick={doSave}>保存并提交</Button>]),
  ];

  return (
    <>
    <Modal
      title={(
        <Space size={8} wrap>
          <span>{selectedDevice ? `设备绑定 · ${selectedDevice.name}（${deviceId}）` : '新建设备绑定'}</span>
        </Space>
      )}
      width={1000}
      open={open}
      onCancel={handleClose}
      footer={footer}
    >
      <Steps
        size="small" current={step} style={{ marginBottom: 16, maxWidth: 660 }}
        items={[{ title: '选择主设备' }, { title: '选择物联网设备' }, { title: '选择监控指标（可选）' }]}
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
                  message.warning(`设备 ${d.name} 已完成绑定（${b.configStatus}），不能重复绑定：请关闭弹窗后使用列表中的「编辑」`);
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
                    <Tooltip title={`已完成绑定（${b.configStatus}）：不能重复绑定，仅可在列表中「编辑」`}>
                      <Tag color="blue" style={{ cursor: 'help' }}>已绑定</Tag>
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
          <Space size={8} wrap>
            <FilterField label="物联网设备">
              <Input allowClear size="small" style={{ width: 180 }} placeholder="编号 / 名称" value={sourceKw} onChange={(e) => setSourceKw(e.target.value)} />
            </FilterField>
            <FilterField label="产品">
              <Select size="small" style={{ width: 180 }} value={productFilter} onChange={setProductFilter} options={[{ value: 'all', label: '全部' }, ...sourceProducts.map((p) => ({ value: p, label: p }))]} />
            </FilterField>
            <Button size="small" type="primary" onClick={() => { setAppliedSourceKw(sourceKw); setAppliedProductFilter(productFilter); }}>查询</Button>
            <Button size="small" onClick={() => { setSourceKw(''); setProductFilter('all'); setAppliedSourceKw(''); setAppliedProductFilter('all'); }}>重置</Button>
          </Space>
          <Table
            rowKey="iotDeviceId" size="small"
            dataSource={sourceDevicesForView}
            pagination={sourceDevicesForView.length > 8 ? { pageSize: 8, size: 'small' } : false}
            rowSelection={{
              selectedRowKeys: draftItems.map((i) => i.iotDeviceId),
              onChange: toggleSources,
              // 搜索/分页过滤掉已勾选来源时保留勾选（AntD 默认会把不在当前 dataSource 的 key 丢弃）
              preserveSelectedRowKeys: true,
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
                    <Tag color="cyan">将接入 {(item.metrics || []).length} 项</Tag>
                  );
                },
              },
              {
                title: '占用状态', width: 140,
                render: (_, s) => (occupiedCodes.has(s.iotDeviceCode)
                  ? (
                    <Tooltip title="该编码已被其它设备绑定，不影响本次绑定">
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
          <div style={{ marginTop: 10, padding: '9px 10px', background: '#f7fafc', border: '1px solid #e8eef4', borderRadius: 6 }}>
            <Space wrap size={8}>
              <span style={{ fontSize: 12, color: '#5d6b78' }}>MES 程序下发主设备</span>
              <Select
                size="small"
                style={{ width: 320 }}
                value={selectedMesPrimaryId || undefined}
                placeholder={mesPrimaryOptions.length ? '选择已勾选的物联网设备' : '请先勾选物联网设备'}
                disabled={mesPrimaryOptions.length === 0}
                options={mesPrimaryOptions}
                onChange={(value) => {
                  const r = actions.setDraftMesPrimarySource(deviceId, value);
                  if (r?.ok === false) message.error(r.message);
                }}
              />
              <Tag color="blue">程序文件将下发至此设备</Tag>
            </Space>
            <div style={{ fontSize: 12, color: '#8a97a3', marginTop: 4 }}>
              上方勾选的物联网设备中选择 1 台作为 MES 程序文件下发目标；只勾选 1 台时自动选中。该设置不影响监控指标、OEE 取数和其他来源设备的数据接入。
            </div>
          </div>
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
                        <span>{def?.name || m.metricCode}（{m.metricCode}）</span>
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

          <Card
            size="small"
            title={(
              <Space size={10}>
                <span>OEE 计算</span>
                <Switch size="small" checked={!!oeeCfg.enabled} onChange={(v) => setOee({ enabled: v })} />
                <span style={{ fontSize: 12, fontWeight: 400, color: oeeCfg.enabled ? '#16a34a' : '#8a97a3' }}>
                  {oeeCfg.enabled ? '参与 OEE 计算' : '不参与 OEE 计算'}
                </span>
              </Space>
            )}
            style={{ marginTop: 8 }}
          >
            {oeeCfg.enabled ? (
              <>
                <div style={{ marginBottom: 10, padding: '8px 10px', background: '#f7fafc', border: '1px solid #e8eef4', borderRadius: 6 }}>
                  <Space wrap size={8}>
                    <span style={{ fontSize: 12, color: '#5d6b78' }}>OEE 模板</span>
                    <Select
                      size="small" style={{ width: 260 }}
                      placeholder={templateOptions.length ? '选择产品模板' : '暂无匹配模板'}
                      disabled={!templateOptions.length}
                      value={oeeCfg.templateId && templateOptions.some((o) => o.value === oeeCfg.templateId)
                        ? oeeCfg.templateId
                        : undefined}
                      onChange={applyTemplate}
                      options={templateOptions}
                      notFoundContent="当前产品 / 设备类型暂无模板"
                    />
                    <Button size="small" onClick={() => setCopyOpen(true)}>从已有设备复制</Button>
                    <Button size="small" onClick={openSaveTemplate}>另存为模板</Button>
                    <Tag color={oeeSourceMeta.color}>{oeeSourceMeta.label}</Tag>
                  </Space>
                  <div style={{ fontSize: 12, color: '#8a97a3', marginTop: 4 }}>
                    同产品 / 同类型设备共用模板，开启 OEE 时自动带出；模板只带出状态指标与报工事件映射，保存后仍可在本设备单独调整。
                  </div>
                </div>
                <div style={{ fontSize: 12, color: '#5d6b78', marginBottom: 8 }}>
                  OEE 指标映射：状态指标提供运行时长；报工事件逐条记录报工时间、数量（默认 +1）与合格标记，产量 / 合格数由事件在统计窗口内汇总。两项均必映射，候选 = 已勾选监控的指标。
                </div>
                <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
                  <tbody>
                    {[
                      ['状态指标（可用率）', 'stateMetricCode', '必选', '提供运行 / 待机 / 故障状态流，聚合出运行时长'],
                      ['报工事件（性能率 + 质量率）', 'reportMetricCode', '必选', '逐条记录报工时间、数量（默认 +1）与是否合格；窗口内汇总产量与合格数'],
                    ].map(([label, field, req, desc]) => (
                      <tr key={field}>
                        <td style={{ padding: '6px 8px', width: 190, borderBottom: '1px solid #eef1f4', color: '#5d6b78' }}>
                          {label} {req === '必选' && <span style={{ color: '#dc2626' }}>*</span>}
                        </td>
                        <td style={{ padding: '6px 8px', borderBottom: '1px solid #eef1f4' }}>
                          <Select
                            style={{ width: 280 }}
                            allowClear={req !== '必选'}
                            placeholder={oeeMetricOptions(field).length
                              ? '选择已勾选监控的指标'
                              : (field === 'stateMetricCode' ? '请先勾选状态类指标' : '请先勾选生产报工事件')}
                            value={oeeCfg[field] || undefined}
                            onChange={(v) => setOee({ [field]: v || null })}
                            notFoundContent="无已勾选监控的指标"
                            options={oeeMetricOptions(field)}
                          />
                          <div style={{ fontSize: 12, color: '#8a97a3', marginTop: 2 }}>{desc}</div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            ) : (
              <div style={{ fontSize: 12, color: '#8a97a3' }}>
                不参与 OEE 计算：综合运行分析 / 实时 OEE / 大屏中该设备 OEE 显示「未纳入 OEE 计算」；监控指标照常勾选。
                {bestTemplate && (
                  <div style={{ marginTop: 4, color: '#1677ff' }}>
                    检测到匹配模板「{bestTemplate.name}」v{bestTemplate.version}
                    （{primaryProduct} / {bestTemplate.deviceType}），开启后将自动带出映射。
                  </div>
                )}
              </div>
            )}
          </Card>
        </>
      )}
    </Modal>

    <Modal
      title="从已有设备复制 OEE 配置"
      width={820}
      open={copyOpen}
      onCancel={() => setCopyOpen(false)}
      footer={<Button onClick={() => setCopyOpen(false)}>关闭</Button>}
    >
      <Typography.Paragraph type="secondary" style={{ fontSize: 12 }}>
        复制只带入状态指标与报工事件映射，不改变当前设备的来源与监控勾选；复制后仍可单独调整。
      </Typography.Paragraph>
      <Table
        rowKey={(x) => x.binding.deviceId}
        size="small"
        dataSource={copyCandidates}
        pagination={copyCandidates.length > 8 ? { pageSize: 8, size: 'small' } : false}
        locale={{ emptyText: '暂无其它已配置 OEE 的设备' }}
        columns={[
          { title: '设备', width: 170, render: (_, x) => `${x.device.name}（${x.device.deviceId}）` },
          { title: '状态指标', width: 210, render: (_, x) => metricLabelOf(x.config.stateMetricCode) },
          { title: '报工事件', width: 210, render: (_, x) => metricLabelOf(x.config.reportMetricCode) },
          {
            title: '配置来源', width: 100,
            render: (_, x) => {
              const m = oeeConfigSourceLabel(x.config);
              return <Tag color={m.color}>{m.label}</Tag>;
            },
          },
          {
            title: '操作', width: 80,
            render: (_, x) => (
              <Button
                type="link" size="small"
                onClick={() => {
                  applyOeeConfig({
                    ...x.config,
                    enabled: true,
                    configSource: 'copy',
                    copiedFromDeviceId: x.binding.deviceId,
                    copiedFromDeviceName: x.device.name,
                  }, `已从 ${x.device.name} 复制 OEE 配置`);
                  setCopyOpen(false);
                }}
              >
                复制
              </Button>
            ),
          },
        ]}
      />
    </Modal>

    <Modal
      title="另存为 OEE 模板"
      width={520}
      open={templateOpen}
      onCancel={() => setTemplateOpen(false)}
      onOk={doSaveTemplate}
      okText="保存模板"
    >
      <Space direction="vertical" size={10} style={{ width: '100%' }}>
        <div style={{ fontSize: 12, color: '#5d6b78' }}>
          适用产品：<b>{primaryProduct || '--'}</b> · 当前设备类型：<b>{templateDeviceType}</b>
        </div>
        <div>
          <div style={{ fontSize: 12, color: '#5d6b78', marginBottom: 4 }}>模板名称</div>
          <Input
            value={templateForm.name}
            onChange={(e) => setTemplateForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="如：GW200 加工中心 OEE 模板"
          />
        </div>
        <div>
          <div style={{ fontSize: 12, color: '#5d6b78', marginBottom: 4 }}>适用范围</div>
          <Select
            style={{ width: '100%' }}
            value={templateForm.deviceType}
            onChange={(v) => setTemplateForm((f) => ({ ...f, deviceType: v }))}
            options={[...new Set([templateDeviceType, '全部'])].map((v) => ({
              value: v, label: v === '全部' ? '全部设备类型（通用模板）' : v,
            }))}
          />
        </div>
        <div>
          <div style={{ fontSize: 12, color: '#5d6b78', marginBottom: 4 }}>说明</div>
          <Input
            value={templateForm.note}
            onChange={(e) => setTemplateForm((f) => ({ ...f, note: e.target.value }))}
            placeholder="选填：适用场景 / 厂商差异说明"
          />
        </div>
        <div style={{ fontSize: 12, color: '#8a97a3' }}>
          同产品同类型已存在模板时，将发布为新版本；已保存绑定不受影响，新建设备按最新模板带出。
        </div>
      </Space>
    </Modal>
    </>
  );
}

// ---------- 停用弹窗（填原因） ----------
function DisableBindingModal({ deviceId, deviceName, open, onClose }) {
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
      title={`停用绑定 · ${deviceName}（${deviceId}）`}
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

// ---------- 监控指标配置弹窗（保留组件供已有状态兼容） ----------
// 2026-10-29 交互统一：勾选先暂存在弹窗本地状态，点击「确认」后统一生效（不产生新版本）；
// 已保存绑定的指标调整入口由列表「编辑」统一处理，保存时与来源设备一并生效----------
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
      {!binding ? (
        <div style={{ color: '#8a97a3', fontSize: 12 }}>该设备尚未创建绑定</div>
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
                      <span>{def?.name || m.metricCode}（{m.metricCode}）</span>
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

// ---------- 绑定明细弹窗（列表点击查看）：来源设备明细 / 接入指标明细 / 监控指标明细 ----------
function BindingDetailModal({ deviceId, deviceName, open, onClose }) {
  const state = useDemoState();
  const binding = state.entities.bindingsByDeviceId[deviceId];
  const draft = selectBindingDraft(state, deviceId);
  const oeeCfg = oeeConfigOfBinding(draft || binding);
  const oeeSource = oeeConfigSourceLabel(oeeCfg);
  const templateOfBinding = oeeCfg?.templateId ? state.entities.oeeTemplatesById?.[oeeCfg.templateId] : null;
  const items = (draft || binding)?.items || [];
  const sourceNameOf = (i) => i.name || state.entities.sourceDevicesById[i.iotDeviceId]?.name || '--';
  const metricRows = items.flatMap((i) => (i.metrics || []).map((m) => ({
    key: `${i.iotDeviceId}:${m.metricCode}`,
    source: `${i.iotDeviceCode} · ${sourceNameOf(i)}`,
    metricCode: m.metricCode,
    monitored: m.monitored,
  })));

  return (
    <Modal
      title={`绑定详情 · ${deviceName || '--'}（${deviceId || '--'}）`}
      width={760}
      open={open}
      onCancel={onClose}
      footer={<Button onClick={onClose}>关闭</Button>}
    >
      {oeeCfg && (
        <div style={{ marginBottom: 12, padding: '8px 10px', background: '#f7fafc', border: '1px solid #e8eef4', borderRadius: 6 }}>
          <Space wrap size={8}>
            <span style={{ fontSize: 12, color: '#5d6b78' }}>OEE 分析</span>
            <Tag color={oeeCfg.enabled === false ? 'default' : 'success'}>
              {oeeCfg.enabled === false ? '不需要' : '需要'}
            </Tag>
            <Tag color={oeeSource.color}>{oeeSource.label}</Tag>
            {templateOfBinding && <span style={{ fontSize: 12 }}>{templateOfBinding.name} · v{templateOfBinding.version}</span>}
          </Space>
          {oeeCfg.enabled !== false && (
            <div style={{ fontSize: 12, color: '#5d6b78', marginTop: 4 }}>
              状态指标：{state.entities.metricsByKey[oeeCfg.stateMetricCode]?.name || '--'}
              {' · '}报工事件：{state.entities.metricsByKey[oeeCfg.reportMetricCode]?.name || '--'}
            </div>
          )}
        </div>
      )}
      <Table
        rowKey="key" size="small"
        dataSource={metricRows}
        pagination={metricRows.length > 10 ? { pageSize: 10, size: 'small' } : false}
        columns={[
          { title: '物联网平台设备', dataIndex: 'source', width: 250 },
          { title: '指标名称', width: 150, render: (_, m) => state.entities.metricsByKey[m.metricCode]?.name || m.metricCode },
          { title: '指标编码', dataIndex: 'metricCode', width: 150 },
          { title: '监控状态', width: 90, render: (_, m) => (m.monitored ? <Tag color="blue">监控中</Tag> : <Tag>仅存储</Tag>) },
        ]}
      />
    </Modal>
  );
}


// ---------- 主页面 ----------
export default function BindingOverviewPage() {
  const state = useDemoState();
  const actions = useDemoActions();
  const { message } = App.useApp();

  // UI 局部状态：弹窗开关
  const [draftTarget, setDraftTarget] = useState(null);     // { deviceId, deviceName }
  const [disableTarget, setDisableTarget] = useState(null); // { deviceId, deviceName }
  const [deleteTarget, setDeleteTarget] = useState(null);  // { deviceId, deviceName }
  const [detailTarget, setDetailTarget] = useState(null);   // { deviceId, deviceName }
  const [templateListOpen, setTemplateListOpen] = useState(false); // OEE 模板管理

  // 列表只展示正式绑定，未配置设备不再作为列表占位行；新建绑定时在向导第 1 步选择主设备。
  const rows = useMemo(() => selectAllDevices(state).flatMap((d) => {
    const binding = state.entities.bindingsByDeviceId[d.deviceId] || null;
    if (!binding) return [];
    const status = binding.configStatus;
    const metricTotal = binding.items?.reduce((s, i) => s + (i.metrics || []).length, 0) ?? 0;
    const metricMonitored = binding.items?.reduce((s, i) => s + (i.metrics || []).filter((m) => m.monitored).length, 0) ?? 0;
    // 是否需要 OEE 分析：由绑定 OEE 开关派生（无 oee 字段的种子绑定默认需要）
    const oeeCfg = oeeConfigOfBinding(binding);
    const oeeRequired = oeeCfg?.enabled !== false;
    return [{ device: d, binding, status, metricTotal, metricMonitored, oeeRequired, oeeCfg }];
  }), [state]);

  // 查询条件（实时筛选；规范 §4：关键词 → 下拉 → 重置；2026-10-29 去掉健康状态条件与列）
  const [kw, setKw] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [oeeFilter, setOeeFilter] = useState('all');
  const [appliedKw, setAppliedKw] = useState('');
  const [appliedStatusFilter, setAppliedStatusFilter] = useState('all');
  const [appliedOeeFilter, setAppliedOeeFilter] = useState('all');
  const statusOptions = useMemo(() => [...new Set(rows.map((r) => r.status))], [rows]);
  const filteredRows = useMemo(() => rows.filter((r) => {
    const k = appliedKw.trim().toLowerCase();
    if (k && !`${r.device.deviceId} ${r.device.name} ${r.device.assetCode || ''}`.toLowerCase().includes(k)) return false;
    if (appliedStatusFilter !== 'all' && r.status !== appliedStatusFilter) return false;
    if (appliedOeeFilter !== 'all' && r.oeeRequired !== (appliedOeeFilter === 'required')) return false;
    return true;
  }), [rows, appliedKw, appliedStatusFilter, appliedOeeFilter]);
  const resetFilters = () => {
    setKw(''); setStatusFilter('all'); setOeeFilter('all');
    setAppliedKw(''); setAppliedStatusFilter('all'); setAppliedOeeFilter('all');
  };

  const enable = (r) => {
    const res = actions.enableBinding(r.device.deviceId);
    if (res.ok) message.success(res.message);
    else message.error(res.message);
  };

  const renderActions = (r) => {
    const { status, device } = r;
    const blueButton = { type: 'link', size: 'small', style: { color: '#1677ff', paddingInline: 4 } };
    const edit = <Button {...blueButton} icon={<Pencil size={13} />} onClick={() => setDraftTarget({ deviceId: device.deviceId, deviceName: device.name })}>编辑</Button>;
    const detail = <Button {...blueButton} icon={<Eye size={13} />} onClick={() => setDetailTarget({ deviceId: device.deviceId, deviceName: device.name })}>详情</Button>;
    const remove = <Button {...blueButton} icon={<Trash2 size={13} />} onClick={() => setDeleteTarget({ deviceId: device.deviceId, deviceName: device.name })}>删除</Button>;
    if (status === '已启用') return <Space size={2}>{detail}{edit}<Button {...blueButton} icon={<PauseCircle size={13} />} onClick={() => setDisableTarget({ deviceId: device.deviceId, deviceName: device.name })}>停用</Button>{remove}</Space>;
    if (status === '待生效') return <Space size={2}>{detail}<Button {...blueButton} icon={<Play size={13} />} onClick={() => enable(r)}>启用</Button>{edit}{remove}</Space>;
    if (status === '已停用') return <Space size={2}>{detail}<Button {...blueButton} icon={<Play size={13} />} onClick={() => enable(r)}>启用</Button>{edit}{remove}</Space>;
    return null;
  };

  // ===== 主视图：设备绑定列表（规范结构：查询条件 → 工具栏（左上）→ 列表） =====
  const bindingTab = (
    <>
      <FilterBar
        onQuery={() => {
          setAppliedKw(kw);
          setAppliedStatusFilter(statusFilter);
          setAppliedOeeFilter(oeeFilter);
        }}
        onReset={resetFilters}
      >
        <FilterField label="设备">
          <Input allowClear placeholder="设备编号 / 名称 / 资产编码" style={{ width: 250 }} value={kw} onChange={(e) => setKw(e.target.value)} />
        </FilterField>
        <FilterField label="配置状态">
          <Select style={{ width: 150 }} value={statusFilter} onChange={setStatusFilter} options={[{ value: 'all', label: '全部' }, ...statusOptions.map((s) => ({ value: s, label: s }))]} />
        </FilterField>
        <FilterField label="OEE 分析">
          <Select
            style={{ width: 130 }} value={oeeFilter} onChange={setOeeFilter}
            options={[{ value: 'all', label: '全部' }, { value: 'required', label: '需要' }, { value: 'notRequired', label: '不需要' }]}
          />
        </FilterField>
      </FilterBar>

      <Card size="small">
        <Space wrap style={{ marginBottom: 12 }}>
          <Button type="primary" icon={<Plus size={14} />} onClick={() => setDraftTarget({})}>新建绑定</Button>
          <Button icon={<LayoutTemplate size={14} />} onClick={() => setTemplateListOpen(true)}>OEE 模板管理</Button>
        </Space>
        <Table
          rowKey={(r) => r.device.deviceId}
          size="small"
          dataSource={filteredRows}
          pagination={false}
          columns={[
            { title: '设备编号', width: 100, render: (_, r) => r.device.deviceId },
            { title: '设备名称', width: 130, render: (_, r) => r.device.name },
            { title: '来源设备数', width: 100, render: (_, r) => `${(r.binding?.items || []).filter((i) => i.enabled).length} 个` },
            { title: '接入指标', width: 90, render: (_, r) => `${r.metricTotal} 项` },
            {
              title: '是否需要 OEE 分析', width: 150,
              render: (_, r) => (r.oeeRequired
                ? (
                  <Tooltip title={`已开启 OEE 计算：需完成状态指标与报工事件映射 · 配置来源：${oeeConfigSourceLabel(r.oeeCfg).label}`}>
                    <Tag color="success" style={{ cursor: 'help' }}>需要</Tag>
                  </Tooltip>
                )
                : <Tag>不需要</Tag>),
            },
            {
              title: 'OEE 配置来源', width: 120,
              render: (_, r) => {
                if (!r.oeeRequired) return '--';
                const meta = oeeConfigSourceLabel(r.oeeCfg);
                const template = r.oeeCfg?.templateId ? state.entities.oeeTemplatesById?.[r.oeeCfg.templateId] : null;
                return (
                  <Tooltip title={template ? `${template.name} · v${template.version}（${template.product} / ${template.deviceType}）` : undefined}>
                    <Tag color={meta.color} style={template ? { cursor: 'help' } : undefined}>{meta.label}</Tag>
                  </Tooltip>
                );
              },
            },
            { title: '拉取周期', width: 90, render: (_, r) => (r.binding ? `${r.binding.pullCycleSec} 秒` : '--') },
            {
              title: '配置状态', width: 100,
              render: (_, r) => (
                <StatusTag value={r.status} />
              ),
            },
            { title: '创建时间', width: 150, render: (_, r) => (r.binding?.createdAt || r.binding?.effectiveFrom || '--') },
            { title: '操作', width: 300, fixed: 'right', render: (_, r) => renderActions(r) },
          ]}
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
        open={!!disableTarget}
        onClose={() => setDisableTarget(null)}
      />
      <Modal
        title={`删除绑定 · ${deleteTarget?.deviceName || '--'}（${deleteTarget?.deviceId || '--'}）`}
        open={!!deleteTarget}
        onCancel={() => setDeleteTarget(null)}
        onOk={() => {
          const res = actions.deleteBinding(deleteTarget.deviceId);
          if (res.ok) { message.success(res.message); setDeleteTarget(null); } else message.error(res.message);
        }}
        okText="确认删除"
        okButtonProps={{ danger: true }}
        cancelText="取消"
      >
        <Typography.Paragraph style={{ marginBottom: 0 }}>
          确定删除该设备的绑定配置吗？删除后可重新创建绑定。
        </Typography.Paragraph>
      </Modal>
      <BindingDetailModal
        deviceId={detailTarget?.deviceId}
        deviceName={detailTarget?.deviceName}
        open={!!detailTarget}
        onClose={() => setDetailTarget(null)}
      />
      <OeeTemplateListModal open={templateListOpen} onClose={() => setTemplateListOpen(false)} />
    </>
  );
}
