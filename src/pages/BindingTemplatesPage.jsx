// ============================================================
// 监控指标模板管理（/binding-templates · 数据接入域）
// 监控指标模板独立管理页：新建 / 编辑 / 删除 / 应用到设备（批量）。
// 模板记录「来源结构（N 个平级来源设备，不分主/子）+ 监控指标口径」，不记录具体 IoT 编码——
// 批量应用时由物联网平台按设备自动分配专属来源编码（演示模拟，见 actions.applyBindingTemplate）。
// 保存走 bindingTemplate/save（reducer 按 templateId upsert：同 id 即编辑，保留原创建时间）。
// ============================================================

import React, { useMemo, useState } from 'react';
import {
  App, Alert, Button, Card, Empty, Input, Modal, Select, Space, Table, Tag, Typography,
} from 'antd';
import { LayoutTemplate, Plus, Trash2, Edit3, Copy } from 'lucide-react';
import PageHeader from '../components/PageHeader.jsx';
import EmptyState from '../components/EmptyState.jsx';
import ApplyTemplateModal from '../components/ApplyTemplateModal.jsx';
import { useDemoState, useDemoActions } from '../state/DemoStore.jsx';
import { iotProducts } from '../data/demo/bindings.js';

let itemSeq = 0;
const nextUid = () => `tpl-item-${Date.now()}-${++itemSeq}`;

// ---------- 模板编辑弹窗（新建 / 编辑 / 复制新建 共用） ----------
// 2026-10-29 交互重构：模板按「物联网平台产品 + 该产品物模型指标」定义，
// 列表形式逐行添加产品，选产品后才出现该产品的指标多选（不再默认铺开全部指标）。
function TemplateEditorModal({ template, open, onClose }) {
  const state = useDemoState();
  const actions = useDemoActions();
  const { message } = App.useApp();
  const [name, setName] = useState('');
  const [items, setItems] = useState([]);      // [{ uid, product, metrics: [{metricCode, metricVersion}] }]
  const [openKey, setOpenKey] = useState('');

  const metricDefs = useMemo(
    () => Object.values(state.entities.metricsByKey).filter((m) => m.syncStatus !== '已失效'),
    [state],
  );
  const metricNameOf = (code) => metricDefs.find((m) => m.metricCode === code)?.name || code;
  const productMetricsOf = (product) => iotProducts.find((p) => p.product === product)?.metrics || [];
  const metricOptionsOf = (product) => (productMetricsOf(product).length
    ? productMetricsOf(product).map((m) => ({
      value: m.metricCode,
      label: `${metricNameOf(m.metricCode)}（${m.metricCode} · ${m.metricVersion}）`,
    }))
    // 兼容历史模板的产品（不在当前产品目录）：退回全量指标可选
    : metricDefs.map((m) => ({ value: m.metricCode, label: `${m.name}（${m.metricCode} · ${m.metricVersion}）` })));

  // 每次打开按目标模板初始化编辑草稿（兼容旧模型 sensorType → product）
  if (open && openKey !== `${open}-${template?.templateId || 'new'}`) {
    setOpenKey(`${open}-${template?.templateId || 'new'}`);
    setName(template ? `${template.name}${template.templateId ? '' : ' 副本'}` : '');
    setItems((template?.items || []).map((i) => ({
      uid: nextUid(),
      product: i.product || (i.sensorType && i.sensorType !== '--' ? i.sensorType : '') || '',
      metrics: (i.metrics || []).filter((m) => m.monitored).map((m) => ({ metricCode: m.metricCode, metricVersion: m.metricVersion })),
    })));
  }
  if (!open && openKey) setOpenKey('');

  const addItem = () => setItems((prev) => [...prev, { uid: nextUid(), product: '', metrics: [] }]);
  const patchItem = (uid, patch) => setItems((prev) => prev.map((i) => (i.uid === uid ? { ...i, ...patch } : i)));
  const removeItem = (uid) => setItems((prev) => prev.filter((i) => i.uid !== uid));

  const problems = [];
  if (!name.trim()) problems.push('请填写模板名称');
  if (items.length === 0) problems.push('至少添加 1 个产品');
  const dupProducts = items.map((i) => i.product).filter((p, idx, arr) => p && arr.indexOf(p) !== idx);
  items.forEach((i, idx) => {
    if (!(i.product || '').trim()) problems.push(`产品 ${idx + 1}：请选择物联网平台产品`);
    else if (dupProducts.includes(i.product)) problems.push(`产品 ${idx + 1}：产品「${i.product}」重复，请合并到一行`);
    if ((i.metrics || []).length === 0) problems.push(`产品 ${idx + 1}：请至少选择 1 项监控指标`);
  });

  const doSave = () => {
    if (problems.length) { message.warning(`无法保存：${problems[0]}`); return; }
    const payload = {
      templateId: template?.templateId || `bt-${Date.now()}`,
      name: name.trim(),
      sourceName: template?.sourceName || '监控指标模板管理页创建',
      items: items.map((i) => ({
        product: i.product,
        sensorType: i.product, // 兼容旧展示口径
        metrics: (i.metrics || []).map((m) => ({ metricCode: m.metricCode, metricVersion: m.metricVersion, monitored: true })),
      })),
    };
    const r = actions.saveBindingTemplate(payload);
    if (r.ok) { message.success(r.message); onClose(); } else message.error(r.message);
  };

  return (
    <Modal
      title={template?.templateId ? `编辑监控指标模板 · ${template.name}` : '新建监控指标模板'}
      width={820}
      open={open}
      onCancel={onClose}
      onOk={doSave}
      okText="保存模板" cancelText="取消"
      okButtonProps={{ disabled: problems.length > 0 }}
    >
      <Alert
        type="info" showIcon style={{ marginBottom: 12 }}
        message="模板按「物联网平台产品 + 该产品的监控指标」定义；应用到设备时按产品自动创建来源并预置监控勾选。"
      />
      <div style={{ marginBottom: 10 }}>
        <div style={{ fontSize: 12, color: '#5d6b78', marginBottom: 4 }}>模板名称 <span style={{ color: '#cf1322' }}>*</span></div>
        <Input style={{ width: 420 }} placeholder="如：CNC 加工中心标准监控模板" value={name} onChange={(e) => setName(e.target.value)} />
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          产品与监控指标（每行选择 1 个产品及其要纳入监控的指标，可添加多行）
        </Typography.Text>
        <Button size="small" type="primary" ghost icon={<Plus size={13} />} onClick={addItem}>添加产品</Button>
      </div>

      {items.length === 0 ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="尚未添加产品：请点击右上角「添加产品」" />
      ) : (
        <Table
          rowKey="uid" size="small"
          dataSource={items}
          pagination={false}
          columns={[
            { title: '#', width: 40, render: (_, __, idx) => idx + 1 },
            {
              title: '物联网平台产品', width: 220,
              render: (_, i) => (
                <Select
                  size="small" style={{ width: '100%' }} placeholder="请选择产品"
                  value={i.product || undefined}
                  onChange={(v) => patchItem(i.uid, { product: v, metrics: [] })}
                  options={iotProducts.map((p) => ({ value: p.product, label: `${p.product}（${p.metrics.length} 项指标）` }))}
                />
              ),
            },
            {
              title: '监控指标（该产品物模型）',
              render: (_, i) => (
                <Select
                  size="small" mode="multiple" style={{ width: '100%' }}
                  placeholder={i.product ? '请选择要监控的指标' : '先选择产品'}
                  disabled={!i.product}
                  value={(i.metrics || []).map((m) => m.metricCode)}
                  onChange={(codes) => patchItem(i.uid, {
                    metrics: codes.map((c) => {
                      const def = productMetricsOf(i.product).find((m) => m.metricCode === c);
                      return { metricCode: c, metricVersion: def?.metricVersion || metricDefs.find((m) => m.metricCode === c)?.metricVersion || 'v1.0' };
                    }),
                  })}
                  options={metricOptionsOf(i.product)}
                  maxTagCount="responsive"
                />
              ),
            },
            {
              title: '操作', width: 70,
              render: (_, i) => <Button size="small" type="text" danger icon={<Trash2 size={13} />} onClick={() => removeItem(i.uid)}>移除</Button>,
            },
          ]}
        />
      )}

      {problems.length > 0 && (
        <Alert
          type="warning" showIcon style={{ marginTop: 10 }}
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

  // 查询条件（规范 §4：关键词 → 下拉 → 重置，实时筛选；选项从数据推导）
  const [kw, setKw] = useState('');
  const [productFilter, setProductFilter] = useState('all');
  const productOptions = useMemo(
    () => [...new Set(templates.flatMap((t) => (t.items || []).map((i) => i.product || (i.sensorType && i.sensorType !== '--' ? i.sensorType : '')).filter(Boolean)))],
    [templates],
  );
  const filteredTemplates = useMemo(() => templates.filter((t) => {
    const k = kw.trim().toLowerCase();
    if (k) {
      const hay = [t.name, ...(t.items || []).map((i) => i.product || i.sensorType || ''), ...(t.items || []).flatMap((i) => (i.metrics || []).map((m) => m.metricCode))]
        .join(' ').toLowerCase();
      if (!hay.includes(k)) return false;
    }
    if (productFilter !== 'all' && !(t.items || []).some((i) => (i.product || i.sensorType) === productFilter)) return false;
    return true;
  }), [templates, kw, productFilter]);

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
      <PageHeader title="监控指标模板管理" />
      {/* 查询条件卡（规范 §4：关键词 → 下拉 → 重置，实时筛选） */}
      <Card size="small" style={{ marginBottom: 12 }}>
        <Space wrap size={8}>
          <Input.Search
            allowClear placeholder="搜索模板名称 / 产品 / 指标编码" style={{ width: 240 }}
            value={kw} onChange={(e) => setKw(e.target.value)}
          />
          <Select
            style={{ width: 170 }} value={productFilter}
            onChange={setProductFilter}
            options={[{ value: 'all', label: '产品：全部' }, ...productOptions.map((s2) => ({ value: s2, label: s2 }))]}
          />
          <Button onClick={() => { setKw(''); setProductFilter('all'); }}>重置</Button>
        </Space>
      </Card>

      <Card size="small" title={<Space size={6}><LayoutTemplate size={14} />监控指标模板（{filteredTemplates.length}）</Space>}>
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
                暂无模板：点击「新建模板」创建。
              </span>
            )}
          />
        ) : filteredTemplates.length === 0 ? (
          <EmptyState
            description="没有符合条件的模板"
            reason="当前关键词或产品筛选下无匹配模板"
            next="重置筛选条件" onNext={() => { setKw(''); setProductFilter('all'); }}
          />
        ) : (
          <Table
            rowKey="templateId" size="small" pagination={false}
            dataSource={filteredTemplates}
            columns={[
              { title: '模板名称', dataIndex: 'name', width: 240, render: (v) => <b>{v}</b> },
              {
                title: '产品结构', width: 260,
                render: (_, t) => t.items.map((i, idx) => (
                  <Tag key={idx}>
                    {i.product || (i.sensorType && i.sensorType !== '--' ? i.sensorType : '来源设备')}×{(i.metrics || []).filter((m) => m.monitored).length}
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
