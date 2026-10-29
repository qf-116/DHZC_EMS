// ============================================================
// 模板批量应用弹窗（共享组件：物联网接入配置两个 Tab / 监控指标模板管理页 共用入口）
// 同型号设备的接入与监控口径通常一致：先「存为模板」，再批量应用到其它设备——
// 应用时自动创建设备绑定（绑定即全量接入存储）并按模板预置监控指标勾选。
// IoT 来源编码由物联网平台按设备自动分配（演示模拟），不与已占用编码冲突。
// ============================================================

import React, { useMemo, useState } from 'react';
import { App, Alert, Checkbox, Modal, Select, Typography } from 'antd';
import { useDemoState, useDemoActions } from '../state/DemoStore.jsx';
import { selectAllDevices } from '../state/selectors.js';

export default function ApplyTemplateModal({ open, initialTemplateId, onClose }) {
  const state = useDemoState();
  const actions = useDemoActions();
  const { message } = App.useApp();
  const [templateId, setTemplateId] = useState(null);
  const [deviceIds, setDeviceIds] = useState([]);
  const [autoEnable, setAutoEnable] = useState(true);

  const templates = state.ui.bindingTemplates || [];
  const effectiveTemplateId = open ? (initialTemplateId || templateId) : templateId;
  const template = templates.find((t) => t.templateId === effectiveTemplateId) || null;
  const metricCount = template ? template.items.reduce((s, i) => s + (i.metrics || []).filter((m) => m.monitored).length, 0) : 0;

  const deviceOptions = useMemo(() => selectAllDevices(state).map((d) => {
    const b = state.entities.bindingsByDeviceId[d.deviceId];
    return { value: d.deviceId, label: `${d.deviceId} · ${d.name}（${b?.configStatus || '未配置'}）` };
  }), [state]);

  const doApply = () => {
    const res = actions.applyBindingTemplate({ deviceIds, template, autoEnable });
    if (res.ok) {
      message.success(res.message);
      setDeviceIds([]);
      onClose();
    } else {
      message.error(res.message);
    }
  };

  return (
    <Modal
      title="监控指标模板应用到设备（批量）"
      width={620}
      open={open}
      destroyOnClose
      onCancel={onClose}
      onOk={doApply}
      okText={`应用到 ${deviceIds.length} 台设备`} cancelText="取消"
      okButtonProps={{ disabled: !template || deviceIds.length === 0 }}
    >
      <Alert
        type="info" showIcon style={{ marginBottom: 12 }}
        message="应用模板 = 一次完成两步：① 创建设备绑定（绑定即全量接入并存储该来源上报的全部指标）② 按模板预置监控指标勾选（曲线呈现）。应用时由物联网平台为每台设备自动分配专属 IoT 来源编码（演示模拟），不会与已占用编码冲突。"
      />
      <div style={{ marginBottom: 10 }}>
        <div style={{ fontSize: 12, color: '#5d6b78', marginBottom: 4 }}>监控指标模板</div>
        <Select
          style={{ width: '100%' }} placeholder="请选择监控指标模板"
          value={effectiveTemplateId || undefined}
          onChange={(v) => setTemplateId(v)}
          options={templates.map((t) => ({ value: t.templateId, label: `${t.name}（${t.items.length} 个来源 / 监控 ${t.items.reduce((s, i) => s + (i.metrics || []).filter((m) => m.monitored).length, 0)} 项指标）` }))}
          notFoundContent="暂无模板：请到「数据接入 · 监控指标模板管理」新建，或在物联网接入配置「监控指标配置」中配好后「存为模板」"
        />
      </div>
      <div style={{ marginBottom: 10 }}>
        <div style={{ fontSize: 12, color: '#5d6b78', marginBottom: 4 }}>目标设备（可搜索多选，几十台上百台建议按型号分批应用）</div>
        <Select
          mode="multiple" showSearch optionFilterProp="label"
          style={{ width: '100%' }} placeholder="请选择要应用模板的设备"
          value={deviceIds} onChange={setDeviceIds}
          options={deviceOptions}
          maxTagCount="responsive"
        />
      </div>
      <Checkbox checked={autoEnable} onChange={(e) => setAutoEnable(e.target.checked)}>
        应用后立即启用（已启用设备应用模板视为换绑，生成新版本并直接生效）
      </Checkbox>
      {template && (
        <Typography.Paragraph type="secondary" style={{ fontSize: 12, marginTop: 10, marginBottom: 0 }}>
          模板结构：{template.items.map((i) => `1 ${i.product || i.sensorType || '来源设备'}×监控 ${(i.metrics || []).filter((m) => m.monitored).length} 项`).join(' + ')}，共监控 {metricCount} 项指标。
        </Typography.Paragraph>
      )}
    </Modal>
  );
}
