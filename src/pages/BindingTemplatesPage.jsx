// ============================================================
// 监控指标模板管理（/binding-templates · 数据接入域）
// 监控指标模板独立管理页：新建 / 编辑 / 删除 / 应用到设备（批量）。
// 模板记录「来源结构（N 个平级来源设备，不分主/子）+ 监控指标口径」，不记录具体 IoT 编码——
// 批量应用时由物联网平台按设备自动分配专属来源编码（演示模拟，见 actions.applyBindingTemplate）。
// 保存走 bindingTemplate/save（reducer 按 templateId upsert：同 id 即编辑，保留原创建时间）。
// ============================================================

import React, { useMemo, useState } from 'react';
import {
  App, Alert, AutoComplete, Button, Card, Checkbox, Empty, Input, Modal, Space, Table, Tag, Typography,
} from 'antd';
import { LayoutTemplate, Plus, Trash2, Edit3, Copy } from 'lucide-react';
import PageHeader from '../components/PageHeader.jsx';
import ApplyTemplateModal from '../components/ApplyTemplateModal.jsx';
import { useDemoState, useDemoActions } from '../state/DemoStore.jsx';

let itemSeq = 0;
const nextUid = () => `tpl-item-${Date.now()}-${++itemSeq}`;

// 常用传感器类型建议（AutoComplete 可自由输入）
const SENSOR_TYPE_SUGGESTIONS = ['振动传感器', '温度传感器', '气压传感器', '电流传感器', '位移传感器'];

// ---------- 模板编辑弹窗（新建 / 编辑 / 复制新建 共用） ----------
function TemplateEditorModal({ template, open, onClose }) {
  const state = useDemoState();
  const actions = useDemoActions();
  const { message } = App.useApp();
  // 编辑草稿：纯 UI 局部状态（模板不挂在具体设备上，不进绑定草稿 store）
  const [name, setName] = useState('');
  const [items, setItems] = useState([]);
  const [openKey, setOpenKey] = useState(''); // 初次打开时回填表单

  const metrics = useMemo(
    () => Object.values(state.entities.metricsByKey).filter((m) => m.syncStatus !== '已失效'),
    [state],
  );

  // 每次打开按目标模板初始化编辑草稿
  if (open && openKey !== `${open}-${template?.templateId || 'new'}`) {
    setOpenKey(`${open}-${template?.templateId || 'new'}`);
    setName(template ? `${template.name}${template.templateId ? '' : ' 副本'}` : '');
    setItems(template
      ? (template.items || []).map((i) => ({
        uid: nextUid(),
        sensorType: (i.sensorType && i.sensorType !== '--' ? i.sensorType : '') || (i.kind && i.kind !== '主设备' ? i.kind : '') || '',
        metrics: (i.metrics || []).map((m) => ({ metricCode: m.metricCode, metricVersion: m.metricVersion, monitored: !!m.monitored })),
      }))
      : []);
  }
  if (!open && openKey) setOpenKey('');

  const addItem = () => {
    setItems((prev) => [...prev, {
      uid: nextUid(),
      sensorType: '',
      metrics: [],
    }]);
  };

  const patchItem = (uid, patch) => {
    setItems((prev) => prev.map((i) => (i.uid === uid ? { ...i, ...patch } : i)));
  };

  const removeItem = (uid) => setItems((prev) => prev.filter((i) => i.uid !== uid));

  const toggleMetric = (uid, m) => {
    setItems((prev) => prev.map((i) => {
      if (i.uid !== uid) return i;
      const list = [...(i.metrics || [])];
      const idx = list.findIndex((x) => x.metricCode === m.metricCode);
      if (idx >= 0) list[idx] = { ...list[idx], monitored: !list[idx].monitored };
      else list.push({ metricCode: m.metricCode, metricVersion: m.metricVersion, monitored: true });
      return { ...i, metrics: list };
    }));
  };

  const problems = [];
  if (!name.trim()) problems.push('请填写模板名称');
  if (items.length === 0) problems.push('至少添加 1 个来源结构');
  items.forEach((i, idx) => {
    if (!(i.sensorType || '').trim()) problems.push(`来源 ${idx + 1}：请填写来源类型`);
    if ((i.metrics || []).filter((m) => m.monitored).length === 0) problems.push(`来源 ${idx + 1}：至少勾选 1 项监控指标`);
  });

  const doSave = () => {
    if (problems.length) { message.warning(`无法保存：${problems[0]}`); return; }
    const payload = {
      templateId: template?.templateId || `bt-${Date.now()}`,
      name: name.trim(),
      sourceName: template?.sourceName || '监控指标模板管理页创建',
      items: items.map((i) => ({
        sensorType: i.sensorType.trim(),
        metrics: (i.metrics || []).map((m) => ({ metricCode: m.metricCode, metricVersion: m.metricVersion, monitored: !!m.monitored })),
      })),
    };
    const r = actions.saveBindingTemplate(payload);
    if (r.ok) { message.success(r.message); onClose(); } else message.error(r.message);
  };

  return (
    <Modal
      title={template?.templateId ? `编辑监控指标模板 · ${template.name}` : '新建监控指标模板'}
      width={860}
      open={open}
      onCancel={onClose}
      onOk={doSave}
      okText="保存模板" cancelText="取消"
      okButtonProps={{ disabled: problems.length > 0 }}
    >
      <Alert
        type="info" showIcon style={{ marginBottom: 12 }}
        message="模板记录来源结构（N 个平级来源设备，不分主/子）与指标口径，不记录具体 IoT 编码——批量应用时由物联网平台按设备自动分配专属来源编码（演示模拟），同一模板可应用到任意多台设备。"
      />
      <div style={{ marginBottom: 10 }}>
        <div style={{ fontSize: 12, color: '#5d6b78', marginBottom: 4 }}>模板名称 <span style={{ color: '#cf1322' }}>*</span></div>
        <Input style={{ width: 420 }} placeholder="如：CNC 加工中心标准监控模板" value={name} onChange={(e) => setName(e.target.value)} />
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          来源结构（来源设备平级、不分主/子；每个来源至少勾选 1 项监控指标）
        </Typography.Text>
        <Space size={8}>
          <Button size="small" type="primary" ghost icon={<Plus size={13} />} onClick={addItem}>添加来源设备</Button>
        </Space>
      </div>

      {items.length === 0 && (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="尚未添加来源结构：请点击右上角「添加来源设备」" />
      )}
      {items.map((item, idx) => {
        const selCount = (item.metrics || []).filter((m) => m.monitored).length;
        const err = selCount === 0 || !(item.sensorType || '').trim();
        return (
          <Card
            key={item.uid} size="small" style={{ marginBottom: 8, borderColor: err ? '#ffa39e' : undefined }}
            title={(
              <Space size={8} wrap>
                <span>来源 {idx + 1}</span>
                <AutoComplete
                  size="small" style={{ width: 180 }}
                  placeholder="来源类型（如：主控制器 / 振动传感器）"
                  value={item.sensorType}
                  options={SENSOR_TYPE_SUGGESTIONS.map((s) => ({ value: s }))}
                  onChange={(v) => patchItem(item.uid, { sensorType: v })}
                />
              </Space>
            )}
            extra={(
              <Space size={8}>
                <span style={{ fontSize: 12, color: selCount ? '#8a97a3' : '#cf1322' }}>监控 {selCount} 项指标</span>
                <Button size="small" type="text" danger icon={<Trash2 size={13} />} onClick={() => removeItem(item.uid)}>移除</Button>
              </Space>
            )}
          >
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 4 }}>
              {metrics.map((m) => {
                const sel = (item.metrics || []).find((x) => x.metricCode === m.metricCode);
                return (
                  <Checkbox key={m.metricCode} checked={!!sel?.monitored} onChange={() => toggleMetric(item.uid, m)}>
                    <span>{m.name}（{m.metricCode} · {m.metricVersion}）</span>
                  </Checkbox>
                );
              })}
            </div>
          </Card>
        );
      })}

      {problems.length > 0 && (
        <Alert
          type="warning" showIcon style={{ marginTop: 4 }}
          message={(
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {problems.map((p) => <li key={p}>{p}</li>)}
            </ul>
          )}
        />
      )}
    </Modal>
  );
}

// ---------- 主页面 ----------
export default function BindingTemplatesPage() {
  const state = useDemoState();
  const actions = useDemoActions();
  const { message, modal } = App.useApp();

  const [editorTarget, setEditorTarget] = useState(null);   // null=关闭；{}=新建；{template}=编辑/复制
  const [applyTarget, setApplyTarget] = useState(null);     // null=关闭；''=不预选；templateId=预选

  const templates = state.ui.bindingTemplates || [];

  const renderActions = (t) => (
    <Space size={4}>
      <Button type="link" size="small" icon={<LayoutTemplate size={13} />} onClick={() => setApplyTarget(t.templateId)}>应用到设备</Button>
      <Button type="link" size="small" icon={<Edit3 size={13} />} onClick={() => setEditorTarget({ template: t })}>编辑</Button>
      <Button
        type="link" size="small" icon={<Copy size={13} />}
        onClick={() => setEditorTarget({ template: { ...t, templateId: null } })}
      >
        复制
      </Button>
      <Button
        type="link" size="small" danger icon={<Trash2 size={13} />}
        onClick={() => modal.confirm({
          title: '删除监控指标模板',
          content: `确定删除模板「${t.name}」吗？已应用过的设备绑定不受影响。`,
          okText: '删除', okButtonProps: { danger: true }, cancelText: '取消',
          onOk: () => { const r = actions.deleteBindingTemplate(t.templateId, t.name); r.ok ? message.success(r.message) : message.error(r.message); },
        })}
      >
        删除
      </Button>
    </Space>
  );

  return (
    <>
      <PageHeader
        title="监控指标模板管理"
        subtitle="监控指标模板的新建 / 编辑 / 删除与应用：一次完成「设备绑定接入 + 监控指标勾选」两步，批量应用到同型号设备"
      />
      <Alert
        type="info" showIcon style={{ marginBottom: 12 }}
        message="模板记录「来源结构 + 监控指标口径」，不记录具体 IoT 编码：应用到设备时自动创建绑定（绑定即全量接入存储）并按模板预置监控勾选；由物联网平台按每台设备自动分配专属来源编码（演示模拟），全局唯一、不与已占用编码冲突；应用后可在物联网接入配置中逐台启用。"
      />
      <Card size="small" title={<Space size={6}><LayoutTemplate size={14} />监控指标模板（{templates.length}）</Space>}>
        <Space wrap style={{ marginBottom: 12 }}>
          <Button type="primary" icon={<Plus size={14} />} onClick={() => setEditorTarget({})}>
            新建模板
          </Button>
        </Space>
        {templates.length === 0 ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={(
              <span style={{ fontSize: 12 }}>
                暂无模板：点击右上角「新建模板」从零创建；或在物联网接入配置「监控指标配置」中勾选好后「存为模板」。
              </span>
            )}
          />
        ) : (
          <Table
            rowKey="templateId" size="small" pagination={false}
            dataSource={templates}
            columns={[
              { title: '模板名称', dataIndex: 'name', width: 240, render: (v) => <b>{v}</b> },
              {
                title: '来源结构', width: 240,
                render: (_, t) => t.items.map((i, idx) => (
                  <Tag key={idx}>
                    {i.sensorType && i.sensorType !== '--' ? i.sensorType : '来源设备'}×{(i.metrics || []).filter((m) => m.monitored).length}
                  </Tag>
                )),
              },
              {
                title: '指标数', width: 90,
                render: (_, t) => `${t.items.reduce((s, i) => s + (i.metrics || []).filter((m) => m.monitored).length, 0)} 项`,
              },
              { title: '来源', dataIndex: 'sourceName', width: 200, ellipsis: true, render: (v) => v || '--' },
              { title: '创建时间', dataIndex: 'createdAt', width: 170 },
              { title: '操作', width: 300, render: (_, t) => renderActions(t) },
            ]}
          />
        )}
      </Card>

      <TemplateEditorModal
        template={editorTarget?.template || null}
        open={editorTarget !== null}
        onClose={() => setEditorTarget(null)}
      />
      <ApplyTemplateModal
        open={applyTarget !== null}
        initialTemplateId={applyTarget || ''}
        onClose={() => setApplyTarget(null)}
      />
    </>
  );
}
