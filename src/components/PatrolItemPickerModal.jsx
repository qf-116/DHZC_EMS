import React, { useEffect, useMemo, useState } from 'react';
import { Modal, Button, Space, Table, Input, Select, Tag, App } from 'antd';
import { Plus, Trash2, Search } from 'lucide-react';

// 设置/选择巡检项目弹窗（对齐原型「选择巡检项目.html」）：
// 1、默认加载当前设备已关联的巡检标准（最近关联的巡检标准）；
// 2、支持切换到其他巡检标准，选择后将该标准的巡检项目全部覆盖到本弹窗列表；
// 3、支持直接添加、删除巡检项目；4、确认后回写所选设备的巡检项目。
//
// 演示口径：原型未导出「标准 ↔ 巡检项目」的关联数据，标准所含项目取该标准下的
// 全部已启用巡检项目（数据层补关联表后可替换）。
export default function PatrolItemPickerModal({
  open,
  title = '设置巡检项目',
  standards = [],
  items = [],
  defaultStandard,
  assignedCodes = [],
  readOnly = false,
  onCancel,
  onConfirm,
}) {
  const { message } = App.useApp();
  const [standard, setStandard] = useState(defaultStandard || undefined);
  const [list, setList] = useState([]);
  const [selectedKeys, setSelectedKeys] = useState([]);
  const [kw, setKw] = useState([]);
  const [addValue, setAddValue] = useState(undefined);
  const [search, setSearch] = useState('');

  // 打开时：按当前设备的关联标准加载项目列表
  const assignedKey = (assignedCodes || []).join(',');
  useEffect(() => {
    if (!open) return;
    setStandard(defaultStandard || (standards[0] && standards[0].name));
    setSelectedKeys([]);
    setAddValue(undefined);
    setSearch('');
    setList(
      assignedKey
        ? items.filter(i => assignedKey.split(',').includes(i.code))
        : items.filter(i => i.status === '已启用'),
    );
  }, [open, defaultStandard, assignedKey, items, standards]);

  const candidates = useMemo(
    () => items.filter(i => !list.some(x => x.code === i.code)),
    [items, list],
  );

  const handleStandardChange = (next) => {
    setStandard(next);
    // 原型规则：切换巡检标准后，将该标准的巡检项目全部覆盖到列表内
    setList(items.filter(i => i.status === '已启用'));
    setSelectedKeys([]);
    message.info(`已切换巡检标准「${next}」，项目列表已覆盖为该标准的巡检项目`);
  };

  const handleAdd = () => {
    if (!addValue) {
      message.warning('请先选择要添加的巡检项目');
      return;
    }
    const found = items.find(i => i.code === addValue);
    if (!found) return;
    setList(prev => (prev.some(i => i.code === found.code) ? prev : [...prev, found]));
    setAddValue(undefined);
  };

  const handleDelete = () => {
    if (selectedKeys.length === 0) {
      message.warning('请先勾选要删除的巡检项目');
      return;
    }
    setList(prev => prev.filter(i => !selectedKeys.includes(i.code)));
    setSelectedKeys([]);
  };

  const columns = [
    { title: '巡检项目名称', dataIndex: 'name', width: 160 },
    { title: '巡检项目编号', dataIndex: 'code', width: 180 },
    { title: '巡检项目类型', dataIndex: 'type', width: 130, render: v => v || '--' },
    { title: '巡检内容', dataIndex: 'content', ellipsis: true, render: v => v || '--' },
    {
      title: '巡检结果',
      width: 150,
      render: (_, r) => (r.options || r.normalRange || r.normalValue ? <Tag>{r.options || r.normalRange || r.normalValue}</Tag> : '--'),
    },
  ];

  return (
    <Modal
      title={title}
      open={open}
      onCancel={onCancel}
      width={900}
      destroyOnHidden
      footer={readOnly
        ? [<Button key="close" onClick={onCancel}>关闭</Button>]
        : [
          <Button key="cancel" onClick={onCancel}>取消</Button>,
          <Button key="ok" type="primary" onClick={() => onConfirm?.(list, standard)}>确认</Button>,
        ]}
    >
      <div style={{ marginBottom: 12 }}>
        <Space wrap align="center">
          <span style={{ color: '#5a6a78' }}>巡检标准</span>
          <Select
            style={{ width: 260 }}
            value={standard}
            disabled={readOnly}
            onChange={handleStandardChange}
            options={standards.map(s => ({ value: s.name, label: s.name }))}
            placeholder="请选择巡检标准"
          />
          {!readOnly && (
            <>
              <Select
                style={{ width: 220 }}
                showSearch
                value={addValue}
                onChange={setAddValue}
                placeholder="选择要添加的巡检项目"
                options={candidates.map(i => ({ value: i.code, label: `${i.name}（${i.code}）` }))}
              />
              <Button icon={<Plus size={14} />} onClick={handleAdd}>添加项目</Button>
              <Button danger icon={<Trash2 size={14} />} onClick={handleDelete}>删除</Button>
            </>
          )}
        </Space>
      </div>
      <Input
        allowClear
        prefix={<Search size={14} />}
        placeholder="搜索巡检项目名称 / 编号"
        style={{ marginBottom: 12 }}
        value={search}
        onChange={e => setSearch(e.target.value)}
      />
      <Table
        rowKey="code"
        size="small"
        columns={columns}
        dataSource={list.filter(i => !search
          || [i.name, i.code].some(v => (v || '').toLowerCase().includes(search.trim().toLowerCase())))}
        rowSelection={readOnly ? undefined : { columnWidth: 40, selectedRowKeys: selectedKeys, onChange: setSelectedKeys }}
        pagination={false}
        locale={{ emptyText: '暂无巡检项目' }}
        scroll={{ x: 900 }}
      />
    </Modal>
  );
}
