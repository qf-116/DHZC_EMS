import React, { useMemo, useState } from 'react';
import { Table, Button, Space, Input, Card } from 'antd';
import { Plus } from 'lucide-react';
import PageHeader from '../components/PageHeader.jsx';
import { baseTypes } from '../data/standardData.js';

export default function BaseTypeConfigPage() {
  const [kw, setKw] = useState('');

  const list = useMemo(() => baseTypes
    .filter((r) => !kw.trim() || [r.category, r.values, r.updater].some((v) => String(v || '').toLowerCase().includes(kw.trim().toLowerCase()))),
  [kw]);

  return (
    <>
      <PageHeader title="基础类型配置" />
      <Card size="small" style={{ marginBottom: 12 }}>
        <Space wrap>
          <Input.Search allowClear style={{ width: 240 }} placeholder="分类 / 可选值 / 更新人" value={kw} onChange={(e) => setKw(e.target.value)} />
          <Button onClick={() => setKw('')}>重置</Button>
        </Space>
      </Card>
      <Card size="small">
        <Space wrap style={{ marginBottom: 12 }}>
          <Button type="primary" icon={<Plus size={14} />}>新增分类</Button>
        </Space>
        <Table rowKey="category" size="small" dataSource={list} columns={[
          { title: '分类', dataIndex: 'category', width: 120 },
          { title: '可选值', dataIndex: 'values' },
          { title: '项数', dataIndex: 'count', width: 80 },
          { title: '更新人', dataIndex: 'updater', width: 100 },
          { title: '更新日期', dataIndex: 'updateDate', width: 110 },
          { title: '操作', width: 120, render: () => <Button size="small" type="link">编辑</Button> },
        ]} />
      </Card>
    </>
  );
}
