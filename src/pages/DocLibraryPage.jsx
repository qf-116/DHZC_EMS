import React, { useMemo, useState } from 'react';
import { Table, Tag, Button, Space, Select, Input, Upload, Card } from 'antd';
import { Download, FileText } from 'lucide-react';
import PageHeader from '../components/PageHeader.jsx';
import { docLibrary } from '../data/standardData.js';

export default function DocLibraryPage() {
  const [kw, setKw] = useState('');
  const [type, setType] = useState(null);
  const [device, setDevice] = useState(null);

  const typeOptions = useMemo(() => [...new Set(docLibrary.map((d) => d.type).filter(Boolean))].map((v) => ({ value: v, label: v })), []);
  const deviceOptions = useMemo(() => [...new Set(docLibrary.map((d) => d.device).filter(Boolean))].map((v) => ({ value: v, label: v })), []);

  const list = useMemo(() => docLibrary
    .filter((r) => !type || r.type === type)
    .filter((r) => !device || r.device === device)
    .filter((r) => !kw.trim() || [r.code, r.name, r.updater].some((v) => String(v || '').toLowerCase().includes(kw.trim().toLowerCase()))),
  [kw, type, device]);

  return (
    <>
      <PageHeader title="综合文档库" />
      <Card size="small" style={{ marginBottom: 12 }}>
        <Space wrap>
          <Input.Search allowClear style={{ width: 240 }} placeholder="文档编号 / 名称 / 更新人" value={kw} onChange={(e) => setKw(e.target.value)} />
          <Select allowClear style={{ width: 140 }} placeholder="全部类型" value={type} onChange={setType} options={typeOptions} />
          <Select allowClear style={{ width: 150 }} placeholder="全部设备" value={device} onChange={setDevice} options={deviceOptions} />
          <Button onClick={() => { setKw(''); setType(null); setDevice(null); }}>重置</Button>
        </Space>
      </Card>
      <Card size="small">
        <Space wrap style={{ marginBottom: 12 }}>
          <Upload><Button type="primary" icon={<FileText size={14} />}>上传文档</Button></Upload>
        </Space>
        <Table rowKey="code" size="small" dataSource={list} columns={[
          { title: '文档编号', dataIndex: 'code', width: 100 },
          { title: '文档名称', dataIndex: 'name', render: v => <Button type="link" size="small" style={{ padding: 0 }} icon={<FileText size={13} />}>{v}</Button> },
          { title: '类型', dataIndex: 'type', width: 100, render: v => <Tag>{v}</Tag> },
          { title: '关联设备', dataIndex: 'device', width: 130 },
          { title: '版本', dataIndex: 'version', width: 70 },
          { title: '更新人', dataIndex: 'updater', width: 90 },
          { title: '更新日期', dataIndex: 'updateDate', width: 110 },
          { title: '大小', dataIndex: 'size', width: 90 },
          { title: '操作', width: 80, render: () => <Button size="small" type="link" icon={<Download size={13} />}>下载</Button> },
        ]} />
      </Card>
    </>
  );
}
