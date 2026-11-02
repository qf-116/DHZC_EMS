import React from 'react';
import { Button, Card, Space } from 'antd';

export function FilterField({ label, children, style }) {
  return (
    <label className="filter-bar-field" style={style}>
      <span className="filter-bar-label">{label}</span>
      {children}
    </label>
  );
}

export default function FilterBar({ children, onQuery, onReset, extra, queryDisabled = false }) {
  return (
    <Card size="small" style={{ marginBottom: 12 }}>
      <Space wrap align="center" size={[12, 8]} style={{ width: '100%' }}>
        {children}
        {extra}
        <Space size={8} className="filter-bar-actions">
          <Button type="primary" onClick={onQuery} disabled={queryDisabled}>查询</Button>
          <Button onClick={onReset}>重置</Button>
        </Space>
      </Space>
    </Card>
  );
}
