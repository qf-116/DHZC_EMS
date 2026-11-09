import React, { useMemo, useState } from 'react';
import { Modal, Table, Space, Button, App } from 'antd';

// 选择设备弹窗（原型「添加/编辑点检计划.html」「新增点检任务.html」的「选择设备」入口）：
// 演示数据源为设备台账快照（ledgerDevices），可多选后回填到点检明细子表。
export default function InspectionDevicePickerModal({
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
      width={880}
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
          { title: '规格型号', dataIndex: 'model', width: 120, render: v => v || '--' },
          { title: '设备类型', dataIndex: 'type', width: 120, render: v => v || '--' },
          { title: '使用部门', dataIndex: 'dept', width: 180, render: v => v || '--' },
          { title: '工位', dataIndex: 'station', width: 110, render: v => v || '--' },
        ]}
        scroll={{ x: 900 }}
      />
    </Modal>
  );
}
