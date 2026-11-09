import React, { useState } from 'react';
import { Table, Button, Space, Select, App } from 'antd';
import { Plus, Trash2 } from 'lucide-react';

// 点检明细（设备）表：对应原型「添加/编辑点检计划.html」「新增点检任务.html」的「点检明细」区。
// 列：序号｜设备名称｜设备编码｜设备类型｜使用部门｜工位｜点检标准名称｜点检项目数｜操作；
// 工具按钮：选择设备、删除（按勾选行批量删除）。
// 每行可维护：点检标准（切换后项目按该标准覆盖）、点检项目（由「设置点检项目」弹窗回写）。
export default function InspectionDeviceDetailTable({
  rows = [],
  onChange,
  standards = [],
  onPickItems,
  onPickDevices,
  height,
}) {
  const { message } = App.useApp();
  const [selectedKeys, setSelectedKeys] = useState([]);

  const updateRow = (code, patch) => {
    onChange?.(rows.map(r => (r.code === code ? { ...r, ...patch } : r)));
  };

  const handleDelete = () => {
    if (selectedKeys.length === 0) {
      message.warning('请先勾选要删除的设备行');
      return;
    }
    onChange?.(rows.filter(r => !selectedKeys.includes(r.code)));
    setSelectedKeys([]);
  };

  const columns = [
    { title: '序号', width: 60, align: 'center', render: (_, __, i) => i + 1 },
    { title: '设备名称', dataIndex: 'name', width: 150, render: v => v || '--' },
    { title: '设备编码', dataIndex: 'code', width: 150 },
    { title: '设备类型', dataIndex: 'type', width: 110, render: v => v || '--' },
    { title: '使用部门', dataIndex: 'dept', width: 170, render: v => v || '--' },
    { title: '工位', dataIndex: 'station', width: 100, render: v => v || '--' },
    {
      title: '点检标准名称', dataIndex: 'standard', width: 220,
      render: (v, r) => (
        <Select
          size="small"
          style={{ width: '100%' }}
          value={v || undefined}
          placeholder="请选择点检标准"
          onChange={(next) => updateRow(r.code, { standard: next, items: [], itemCount: 0 })}
          options={standards.map(s => ({ value: s.name, label: s.name }))}
        />
      ),
    },
    { title: '点检项目数', dataIndex: 'itemCount', width: 110, align: 'center', render: v => (v != null ? `${v} 项` : '--') },
    {
      title: '操作', width: 170,
      render: (_, r) => (
        <Space size={0}>
          <Button type="link" size="small" onClick={() => onPickItems?.(r)}>设置点检项目</Button>
          <Button type="link" size="small" danger onClick={() => onChange?.(rows.filter(x => x.code !== r.code))}>删除</Button>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Space wrap style={{ marginBottom: 8 }}>
        <Button icon={<Plus size={14} />} onClick={() => onPickDevices?.()}>选择设备</Button>
        <Button danger icon={<Trash2 size={14} />} onClick={handleDelete}>删除</Button>
      </Space>
      <Table
        rowKey="code"
        size="small"
        columns={columns}
        dataSource={rows}
        rowSelection={{ columnWidth: 40, selectedRowKeys: selectedKeys, onChange: setSelectedKeys }}
        pagination={false}
        scroll={{ x: 1150, y: height }}
        locale={{ emptyText: '暂无点检明细，请点击「选择设备」添加' }}
      />
    </div>
  );
}
