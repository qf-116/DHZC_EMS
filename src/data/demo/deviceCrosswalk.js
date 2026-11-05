// ============================================================
// Canonical 设备 crosswalk（第一优先级；§3.1）
// 每条业务设备固定一条映射：所有页面只传 deviceId，
// 资产码 / 监测码 / IoT 来源码 / 展示名一律经 selector 由此表解析。
// 禁止 DEV-00x → MT2024A12xx 字符串推导、数组顺序映射。
//
// 冲突处理记录（2026-09-16）：旧 oeeData.js 曾映射 DEV-003→MT2024A1204、
// DEV-004→MT2024A1205、DEV-005→MT2024A1206，与设备台账及监测域命名冲突；
// 本表为唯一权威映射，旧文件仅作兼容导出保留，不再被白名单页面引用。
// ============================================================

export const deviceCrosswalk = [
  {
    deviceId: 'DEV-001', assetCode: 'MT2024A1201', monitorCode: 'DEV-001', name: 'CNC加工中心-01',
    ledgerRecordId: 'ledger-001', bindingId: 'binding-001-v2', oeeDeviceId: 'OEE-001', screenDeviceId: 'screen-001',
    iotMainDeviceId: 'iot-main-001', organizationId: 'org-demo', workshopId: 'workshop-1', lineId: 'line-1', stationId: 'station-01',
  },
  {
    deviceId: 'DEV-002', assetCode: 'MT2024A1202', monitorCode: 'DEV-002', name: 'CNC加工中心-02',
    ledgerRecordId: 'ledger-002', bindingId: 'binding-002-v2', oeeDeviceId: 'OEE-002', screenDeviceId: 'screen-002',
    iotMainDeviceId: 'iot-main-002', organizationId: 'org-demo', workshopId: 'workshop-1', lineId: 'line-1', stationId: 'station-02',
  },
  {
    deviceId: 'DEV-003', assetCode: 'MT2024A1203', monitorCode: 'DEV-003', name: '激光焊接机-03',
    ledgerRecordId: 'ledger-003', bindingId: 'binding-003-v1', oeeDeviceId: 'OEE-003', screenDeviceId: 'screen-003',
    iotMainDeviceId: 'iot-main-003', organizationId: 'org-demo', workshopId: 'workshop-1', lineId: 'line-2', stationId: 'station-03',
  },
  {
    deviceId: 'DEV-004', assetCode: 'MT2024A1204', monitorCode: 'DEV-004', name: '数控铲齿机-04',
    ledgerRecordId: 'ledger-004', bindingId: 'binding-004-v2', oeeDeviceId: 'OEE-004', screenDeviceId: 'screen-004',
    iotMainDeviceId: 'iot-main-004', organizationId: 'org-demo', workshopId: 'workshop-2', lineId: 'line-3', stationId: 'station-04',
  },
  {
    deviceId: 'DEV-005', assetCode: 'MT2024A1205', monitorCode: 'DEV-005', name: '机器人焊接-05',
    ledgerRecordId: 'ledger-005', bindingId: 'binding-005-v1', oeeDeviceId: 'OEE-005', screenDeviceId: 'screen-005',
    iotMainDeviceId: 'iot-main-005', organizationId: 'org-demo', workshopId: 'workshop-2', lineId: 'line-4', stationId: 'station-05',
  },
  {
    deviceId: 'DEV-006', assetCode: 'MT2024A1206', monitorCode: 'DEV-006', name: '空压机',
    ledgerRecordId: 'ledger-006', bindingId: 'binding-006-v2', oeeDeviceId: null, screenDeviceId: null,
    iotMainDeviceId: 'iot-main-006', organizationId: 'org-demo', workshopId: 'workshop-power', lineId: '', stationId: 'station-06',
  },

  {
    deviceId: 'DEV-008', assetCode: 'MT2024A1208', monitorCode: 'DEV-008', name: '普通车床',
    ledgerRecordId: 'ledger-008', bindingId: null, oeeDeviceId: null, screenDeviceId: null,
    iotMainDeviceId: null, organizationId: 'org-demo', workshopId: 'workshop-1', lineId: 'line-1', stationId: 'station-08',
  },
  {
    deviceId: 'DEV-009', assetCode: 'MT2024A1209', monitorCode: 'DEV-009', name: '数控车床-09',
    ledgerRecordId: 'ledger-009', bindingId: null, oeeDeviceId: null, screenDeviceId: null,
    iotMainDeviceId: 'iot-main-009', organizationId: 'org-demo', workshopId: 'workshop-1', lineId: 'line-1', stationId: 'station-09',
  },
  {
    deviceId: 'DEV-010', assetCode: 'MT2024A1210', monitorCode: 'DEV-010', name: '钻攻中心-10',
    ledgerRecordId: 'ledger-010', bindingId: null, oeeDeviceId: null, screenDeviceId: null,
    iotMainDeviceId: 'iot-main-010', organizationId: 'org-demo', workshopId: 'workshop-1', lineId: 'line-1', stationId: 'station-10',
  },
  {
    deviceId: 'DEV-011', assetCode: 'MT2024A1211', monitorCode: 'DEV-011', name: '加工中心-11',
    ledgerRecordId: 'ledger-011', bindingId: null, oeeDeviceId: null, screenDeviceId: null,
    iotMainDeviceId: 'iot-main-011', organizationId: 'org-demo', workshopId: 'workshop-2', lineId: 'line-3', stationId: 'station-11',
  },
];

export const crosswalkByDeviceId = Object.fromEntries(deviceCrosswalk.map(c => [c.deviceId, c]));
export const crosswalkByAssetCode = Object.fromEntries(deviceCrosswalk.map(c => [c.assetCode, c]));
