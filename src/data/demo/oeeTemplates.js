// ============================================================
// OEE 映射模板（2026-11-05）
// 模板按「物联网平台产品 + 设备类型」匹配：同产品同类型设备共用一套
// OEE 映射，异常设备可在绑定时单独覆盖。
// 模板只保存 OEE 取数映射（状态指标 / 报工事件），不保存监控勾选与绑定关系。
// ============================================================

export const oeeTemplates = [
  {
    templateId: 'OT-GW200-GEN-V1',
    name: 'GW200 通用 OEE 模板',
    product: '工业智能网关 GW200',
    deviceType: '全部',
    version: 1,
    status: '启用',
    effectiveFrom: '2026-09-01 08:00',
    updatedAt: '2026-09-16 08:30',
    updatedBy: '李明',
    sourceDeviceId: 'DEV-001',
    sourceDeviceName: 'CNC加工中心-01',
    config: {
      stateMetricCode: 'S.machine_state',
      reportMetricCode: 'E.production_report',
    },
    note: '适用于 GW200 主控制器接入的生产设备；设备状态用于可用率，生产报工事件用于性能率与质量率。',
  },
  {
    templateId: 'OT-GW200-LASER-V1',
    name: 'GW200 激光设备 OEE 模板',
    product: '工业智能网关 GW200',
    deviceType: '激光设备',
    version: 1,
    status: '启用',
    effectiveFrom: '2026-09-01 08:00',
    updatedAt: '2026-09-16 08:35',
    updatedBy: '李明',
    sourceDeviceId: 'DEV-003',
    sourceDeviceName: '激光焊接机-03',
    config: {
      stateMetricCode: 'S.machine_state',
      reportMetricCode: 'E.production_report',
    },
    note: '激光设备优先套用本模板；更换焊材 / 程序时仍以报工事件的合格标记计算质量率。',
  },
];
