import React, { useEffect, useMemo, useState } from 'react';
import { Modal, Button, Space, Table, Input, Select, Tag, App } from 'antd';
import { Plus, Trash2, Search } from 'lucide-react';

// 设置点检项目弹窗（对应原型「选择巡检项目.html」，点检侧同构）：
// 1、默认加载当前设备已关联的点检标准（最近关联的点检标准）；
// 2、支持切换到其他点检标准（未关联该设备的标准也可选），选择后将该标准的点检项目全部覆盖到本弹窗列表；
// 3、支持直接添加、删除点检项目；4、确认后回写所选设备的点检项目配置。
//
// 演示口径：原型未导出「点检标准 ↔ 点检项目」的完整关联表，
// 数据侧以 inspectionStandardItemCodes（首个标准快照）为准，其余标准按「已启用点检项目」近似，
// 待数据层补齐关联表后即可替换。
export default function InspectionItemPickerModal({
  open,
  title = '设置点检项目',
  standards = [],
  items = [],
  standardItemCodes = [],
  snapshotStandardCode = '',
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
  const [addValue, setAddValue] = useState(undefined);
  const [search, setSearch] = useState('');

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
    // 原型规则：切换点检标准后，将该标准的点检项目全部覆盖到列表内
    const target = standards.find(s => s.name === next);
    const codes = target && target.code === snapshotStandardCode ? standardItemCodes : null;
    setList(codes
      ? items.filter(i => codes.includes(i.code))
      : items.filter(i => i.status === '已启用'));
    setSelectedKeys([]);
    message.info(`已切换点检标准「${next}」，点检项目列表已覆盖为该标准的点检项目`);
  };

  const handleAdd = () => {
    if (!addValue) {
      message.warning('请先选择要添加的点检项目');
      return;
    }
    const found = items.find(i => i.code === addValue);
    if (!found) return;
    setList(prev => (prev.some(i => i.code === found.code) ? prev : [...prev, found]));
    setAddValue(undefined);
  };

  const handleDelete = () => {
    if (selectedKeys.length === 0) {
      message.warning('请先勾选要删除的点检项目');
      return;
    }
    setList(prev => prev.filter(i => !selectedKeys.includes(i.code)));
    setSelectedKeys([]);
  };

  const columns = [
    { title: '点检项目名称', dataIndex: 'name', width: 170 },
    { title: '点检项目编号', dataIndex: 'code', width: 180 },
    { title: '点检项目类型', dataIndex: 'type', width: 130, render: v => v || '--' },
    { title: '点检内容', dataIndex: 'content', ellipsis: true, render: v => v || '--' },
    {
      title: '点检结果',
      width: 160,
      render: (_, r) => (r.options || r.normalValue ? <Tag>{r.options || r.normalValue}</Tag> : '--'),
    },
    { title: '序号', width: 70, align: 'center', render: (_, __, i) => i + 1 },
  ];

  return (
    <Modal
      title={title}
      open={open}
      onCancel={onCancel}
      width={920}
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
          <span style={{ color: '#5a6a78' }}>点检标准</span>
          <Select
            style={{ width: 260 }}
            value={standard}
            disabled={readOnly}
            onChange={handleStandardChange}
            options={standards.map(s => ({ value: s.name, label: s.name }))}
            placeholder="请选择点检标准"
          />
          {!readOnly && (
            <>
              <Select
                style={{ width: 230 }}
                showSearch
                value={addValue}
                onChange={setAddValue}
                placeholder="选择要添加的点检项目"
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
        placeholder="搜索点检项目名称 / 编号"
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
        locale={{ emptyText: '暂无点检项目' }}
        scroll={{ x: 920 }}
      />
    </Modal>
  );
}
