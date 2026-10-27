import React, { useMemo, useState } from 'react';
import { Card, Table, Button, Space, Input, Select, Typography } from 'antd';
import { Inbox, PackageOpen } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../components/PageHeader.jsx';
import StatusTag from '../components/StatusTag.jsx';
import DegradedBanner from '../components/DegradedBanner.jsx';
import { useDemoState } from '../state/DemoStore.jsx';
import { selectStockRows } from '../state/selectors.js';

// 空值统一显示 --（无库存记录 ≠ 0）
const dash = (v) => (v === null || v === undefined || v === '' ? '--' : v);

// 备件库存总览（仓库 × 备件）：读模型来自 selectStockRows；
// 未配置库存的备件按「--」展示；低于安全库存的行（如 120006）数量标红 + 库存水位标签预警
export default function SparePartsStockPage() {
  const navigate = useNavigate();
  const state = useDemoState();
  const [keyword, setKeyword] = useState('');
  const [warehouseId, setWarehouseId] = useState(null);

  const rows = useMemo(() => {
    const { sparesByCode, warehousesById } = state.entities;
    const stockMap = Object.fromEntries(selectStockRows(state).map(r => [r.stockKey, r]));
    return Object.values(sparesByCode).flatMap(spare =>
      Object.values(warehousesById).map(wh => {
        const stockKey = `${wh.warehouseId}|${spare.code}`;
        const s = stockMap[stockKey];
        return s
          ? { key: stockKey, ...s }
          : { key: stockKey, stockKey, warehouseId: wh.warehouseId, spareCode: spare.code, spare, onHand: null, reserved: null, available: null, safe: null, max: null, level: null };
      })
    );
  }, [state]);

  const filtered = rows.filter(r => {
    if (warehouseId && r.warehouseId !== warehouseId) return false;
    if (keyword) {
      const kw = keyword.trim();
      const spare = r.spare || {};
      if (!(spare.code || '').includes(kw) && !(spare.name || '').includes(kw) && !(spare.brand || '').includes(kw)) return false;
    }
    return true;
  });
  const lowStockCount = rows.filter(r => r.level === '低于安全库存').length;

  const qtyCell = (value, r) => {
    if (r.level === null && (value === null || value === undefined)) return '--'; // 无库存记录
    const low = r.level === '低于安全库存';
    return <span style={low ? { color: '#cf1322', fontWeight: 600 } : undefined}>{dash(value)}</span>;
  };

  return (
    <>
      <PageHeader title="备件库存总览" />
      <DegradedBanner meta={state.meta} />
      <Card size="small" style={{ marginBottom: 12 }}>
        <Space wrap>
          <Input
            style={{ width: 240 }}
            placeholder="备件编码 / 名称 / 品牌"
            allowClear
            value={keyword}
            onChange={e => setKeyword(e.target.value)}
          />
          <Select
            style={{ width: 160 }}
            placeholder="仓库"
            allowClear
            value={warehouseId}
            onChange={setWarehouseId}
            options={Object.values(state.entities.warehousesById).map(w => ({ value: w.warehouseId, label: w.name }))}
          />
          <Button onClick={() => { setKeyword(''); setWarehouseId(null); }}>重置</Button>
        </Space>
      </Card>
      <Card size="small">
        <Space wrap style={{ marginBottom: 12 }}>
          <Button type="primary" icon={<Inbox size={14} />} onClick={() => navigate('/spare-parts-inbound')}>到货入库</Button>
          <Button type="primary" icon={<PackageOpen size={14} />} onClick={() => navigate('/spare-parts-outbound')}>维修领料出库</Button>
        </Space>
        {lowStockCount > 0 && (
          <Typography.Text type="danger" style={{ display: 'block', marginBottom: 8 }}>
            {lowStockCount} 条库存低于安全库存，请及时补货（入库入口：到货入库）。
          </Typography.Text>
        )}
        <Table
          rowKey="key" size="small"
          dataSource={filtered}
          columns={[
            { title: '仓库', dataIndex: 'warehouseId', width: 120 },
            { title: '备件编码', width: 100, render: (_, r) => dash(r.spare?.code) },
            { title: '备件名称', width: 120, render: (_, r) => dash(r.spare?.name) },
            { title: '规格型号', width: 100, render: (_, r) => dash(r.spare?.spec) },
            { title: '单位', width: 70, render: (_, r) => dash(r.spare?.unit) },
            { title: '在库量', width: 90, render: (_, r) => qtyCell(r.onHand, r) },
            { title: '预留量', width: 90, render: (_, r) => dash(r.reserved) },
            { title: '可用量', width: 90, render: (_, r) => qtyCell(r.available, r) },
            { title: '安全库存', width: 90, render: (_, r) => dash(r.safe) },
            { title: '最大库存', width: 90, render: (_, r) => dash(r.max) },
            { title: '批次', dataIndex: 'batch', width: 130, render: v => dash(v) },
            { title: '库存水位', width: 130, render: (_, r) => <StatusTag value={r.level} /> },
          ]}
          scroll={{ x: 1230 }}
          pagination={{ pageSize: 10, showTotal: t => `共 ${t} 条数据` }}
        />
      </Card>
    </>
  );
}
