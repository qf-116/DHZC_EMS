import React, { useMemo, useState } from 'react';
import { Modal, Table, App } from 'antd';

// 保养模块「选择设备」弹窗（原型「新增保养计划」/「新增保养任务」的设备选择入口）：
// 演示数据源为设备台账快照 ledgerDevices；保养标准名称 / 保养项目数由保养计划明细
// maintenancePlanDetails 命中同一设备编码时带出，未命中显示「未配置」（不臆造数据）。
export default function MaintenanceDevicePickerModal({
  open,
  title = '选择设备',
  devices = [],
  detailMap = {},
  selectedCodes = [],
  onCancel,
  onConfirm,
}) {
  const { message } = App.useApp();
  const [selectedKeys, setSelectedKeys] = useState([]);

  const rows = useMemo(
    () => devices
      .filter(d => !selectedCodes.includes(d.code))
      .map(d => {
        const detail = detailMap[d.code];
        return {
          ...d,
          standard: detail?.standard || '',
          itemCount: detail?.itemCount || '',
        };
      }),
    [devices, detailMap, selectedCodes],
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
      title={title}
      open={open}
      width={900}
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
          { title: '设备名称', dataIndex: 'name', width: 170 },
          { title: '规格型号', dataIndex: 'model', width: 120, render: v => v || '--' },
          { title: '设备类型', dataIndex: 'type', width: 120, render: v => v || '--' },
          { title: '使用部门', dataIndex: 'dept', width: 180, render: v => v || '--' },
          { title: '工位', dataIndex: 'station', width: 110, render: v => v || '--' },
          {
            title: '保养标准名称', dataIndex: 'standard', width: 200,
            render: v => (v ? v : <span style={{ color: '#9aa7b5' }}>未配置</span>),
          },
          {
            title: '保养项目数', dataIndex: 'itemCount', width: 100, align: 'center',
            render: v => (v ? v : <span style={{ color: '#9aa7b5' }}>未配置</span>),
          },
        ]}
        scroll={{ x: 1040 }}
      />
    </Modal>
  );
}
