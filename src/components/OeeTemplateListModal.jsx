import React, { useMemo } from 'react';
import { Modal, Table, Tag, Typography } from 'antd';
import { Button } from 'antd';
import { useDemoState } from '../state/DemoStore.jsx';
import { OEE_TEMPLATE_GENERIC_SCOPE } from '../domain/oeeTemplate.js';

// OEE 映射模板清单（只读查看）：按「物联网产品 + 设备类型」归档。
// 模板的创建与更新在绑定向导第 3 步「另存为模板」完成，同范围再次保存即发布新版本。
export default function OeeTemplateListModal({ open, onClose }) {
  const state = useDemoState();
  const templates = useMemo(
    () => Object.values(state.entities.oeeTemplatesById || {})
      .sort((a, b) => (a.product === b.product
        ? String(a.deviceType).localeCompare(String(b.deviceType))
        : String(a.product).localeCompare(String(b.product)))),
    [state.entities.oeeTemplatesById],
  );
  const metricLabel = (code) => {
    const def = state.entities.metricsByKey?.[code];
    return def ? `${def.name}（${code}）` : (code || '--');
  };

  return (
    <Modal
      title="OEE 模板管理"
      width={960}
      open={open}
      onCancel={onClose}
      footer={<Button onClick={onClose}>关闭</Button>}
    >
      <Typography.Paragraph type="secondary" style={{ fontSize: 12 }}>
        模板按「物联网产品 + 设备类型」匹配，同产品同类型设备开启 OEE 时自动带出；
        在绑定向导第 3 步「另存为模板」可创建或更新版本。模板只保存状态指标与报工事件映射，不改变已有绑定的配置。
      </Typography.Paragraph>
      <Table
        rowKey="templateId"
        size="small"
        dataSource={templates}
        pagination={false}
        locale={{ emptyText: '暂无 OEE 模板' }}
        columns={[
          { title: '模板名称', dataIndex: 'name', width: 200 },
          { title: '适用产品', dataIndex: 'product', width: 170 },
          {
            title: '设备类型', dataIndex: 'deviceType', width: 110,
            render: (v) => (v === OEE_TEMPLATE_GENERIC_SCOPE ? <Tag>全部类型</Tag> : v || '--'),
          },
          { title: '状态指标', width: 190, render: (_, t) => metricLabel(t.config?.stateMetricCode) },
          { title: '报工事件', width: 200, render: (_, t) => metricLabel(t.config?.reportMetricCode) },
          { title: '版本', dataIndex: 'version', width: 70, render: (v) => `v${v}` },
          { title: '状态', dataIndex: 'status', width: 80, render: (v) => <Tag color={v === '启用' ? 'success' : 'default'}>{v}</Tag> },
          {
            title: '来源设备', width: 150,
            render: (_, t) => (t.sourceDeviceName ? `${t.sourceDeviceName}` : '--'),
          },
          { title: '更新时间', dataIndex: 'updatedAt', width: 170, render: (v, t) => `${v || '--'}${t.updatedBy ? ` · ${t.updatedBy}` : ''}` },
        ]}
      />
    </Modal>
  );
}
