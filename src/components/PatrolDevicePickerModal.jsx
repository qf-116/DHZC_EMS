import React, { useMemo, useState } from 'react';
import { Modal, Table, Space, Button, Tag, App } from 'antd';
import { Plus, Trash2 } from 'lucide-react';

// 选择设备弹窗（原型「新增巡检计划 / 新增巡检任务」的「选择设备」入口）：
// 演示数据源为巡检计划/任务的设备明细快照（patrolPlanDevices）。
export default function PatrolDevicePickerModal({
  open,
  onCancel,
  onConfirm,
  devices = [],
  excludeCodes = [],
}) {
  const { message } = App.useApp();
  const [selectedKeys, setSelectedKeys] = useState([]);

  const rows = useMemo(
    () => devices.filter(d => !excludeCodes.includes(d.code)),
    [devices, excludeCodes],
  );

  const handleOk = () => {
    if (selectedKeys.length === 0) {
      message.warning('请先勾选要添加的设备');
      return;
    }
    onConfirm?.(rows.filter(d => selectedKeys.includes(d.code)));
    setSelectedKeys([]);
  };

  return (
    <Modal
      title="选择设备"
      open={open}
      width={860}
      onCancel={() => { setSelectedKeys([]); onCancel(); }}
      onOk={handleOk}
      okText="确认"
      cancelText="取消"
      destroyOnHidden
    >
      <Table
        rowKey="code"
        size="small"
        rowSelection={{ columnWidth: 40, selectedRowKeys: selectedKeys, onChange: setSelectedKeys }}
        dataSource={rows}
        pagination={false}
        locale={{ emptyText: '暂无可选设备' }}
        columns={[
          { title: '设备编码', dataIndex: 'code', width: 150 },
          { title: '设备名称', dataIndex: 'name', width: 180 },
          { title: '设备类型', dataIndex: 'type', width: 120, render: v => v || '--' },
          { title: '使用部门', dataIndex: 'dept', width: 180, render: v => v || '--' },
          { title: '工位', dataIndex: 'station', width: 110, render: v => v || '--' },
          { title: '巡检标准名称', dataIndex: 'standard', width: 200, render: v => v || <Tag>未配置</Tag> },
        ]}
        scroll={{ x: 900 }}
      />
    </Modal>
  );
}
