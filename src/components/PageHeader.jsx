import React from 'react';
import { Typography, Space } from 'antd';

// 页面标题区已按需求（2026-11-04）整体移除：当前页面由左侧菜单标明，标题不再重复展示。
// 组件仅保留右侧动作区（如详情页的「返回列表」按钮）与更新时间；无动作内容时不渲染任何节点。
export default function PageHeader({ actions, updatedAt }) {
  if (!actions && !updatedAt) return null;
  return (
    <div className="page-head">
      <div />
      <Space>
        {updatedAt && <Typography.Text type="secondary" style={{ fontSize: 12 }}>更新于 {updatedAt}</Typography.Text>}
        {actions}
      </Space>
    </div>
  );
}
