// ============================================================
// 统一业务设备（DeviceAsset）初始快照
// canonical deviceId 以监测域 DEV-001..008 为准；资产码/监测码映射见 deviceCrosswalk.js
// 状态轴分离见 domain/device.js：本表只存资产生命周期与档案字段
// ============================================================

export const devices = [
  {
    deviceId: 'DEV-001', assetCode: 'MT2024A1201', name: 'CNC加工中心-01', model: 'VMC-850', type: '加工中心', brand: '沈阳机床',
    organizationId: 'org-demo', workshopId: 'workshop-1', workshopName: '一号车间', lineId: 'line-1', lineName: '加工一线', stationId: 'station-01', stationName: '1号工位',
    assetNo: '22100221', lifecycleStatus: '在用', owner: '张三', enableDate: '2024-01-01', buyDate: '2023-12-20',
    oeeEligible: true,
  },
  {
    deviceId: 'DEV-002', assetCode: 'MT2024A1202', name: 'CNC加工中心-02', model: 'VMC-850', type: '加工中心', brand: '沈阳机床',
    organizationId: 'org-demo', workshopId: 'workshop-1', workshopName: '一号车间', lineId: 'line-1', lineName: '加工一线', stationId: 'station-02', stationName: '2号工位',
    assetNo: '22100222', lifecycleStatus: '在用', owner: '张三', enableDate: '2024-01-01', buyDate: '2023-12-20',
    oeeEligible: true,
  },
  {
    deviceId: 'DEV-003', assetCode: 'MT2024A1203', name: '激光焊接机-03', model: 'LW-3000', type: '激光设备', brand: '大族激光',
    organizationId: 'org-demo', workshopId: 'workshop-1', workshopName: '一号车间', lineId: 'line-2', lineName: '焊接一线', stationId: 'station-03', stationName: '3号工位',
    assetNo: '22100223', lifecycleStatus: '在用', owner: '赵艳', enableDate: '2024-02-15', buyDate: '2024-01-30',
    oeeEligible: true,
  },
  {
    deviceId: 'DEV-004', assetCode: 'MT2024A1204', name: '数控铲齿机-04', model: 'GM-1320', type: '铲齿机', brand: '上海机床',
    organizationId: 'org-demo', workshopId: 'workshop-2', workshopName: '二号车间', lineId: 'line-3', lineName: '铲齿线', stationId: 'station-04', stationName: '1号工位',
    assetNo: '22100224', lifecycleStatus: '在用', owner: '王强', enableDate: '2024-03-10', buyDate: '2024-02-25',
    oeeEligible: true,
  },
  {
    deviceId: 'DEV-005', assetCode: 'MT2024A1205', name: '机器人焊接-05', model: 'RB-2000', type: '焊接机器人', brand: '埃斯顿',
    organizationId: 'org-demo', workshopId: 'workshop-2', workshopName: '二号车间', lineId: 'line-4', lineName: '焊接二线', stationId: 'station-05', stationName: '2号工位',
    assetNo: '22100225', lifecycleStatus: '在用', owner: '陈晨', enableDate: '2024-05-20', buyDate: '2024-04-15',
    oeeEligible: false,
  },
  {
    deviceId: 'DEV-006', assetCode: 'MT2024A1206', name: '空压机', model: 'KA-75', type: '动力设备', brand: '阿特拉斯',
    organizationId: 'org-demo', workshopId: 'workshop-power', workshopName: '动力站', lineId: '', lineName: '--', stationId: 'station-06', stationName: '1号工位',
    assetNo: '22100226', lifecycleStatus: '在用', owner: '李明', enableDate: '2022-05-20', buyDate: '2022-04-15',
    oeeEligible: false,
  },

  {
    deviceId: 'DEV-008', assetCode: 'MT2024A1208', name: '普通车床', model: 'CA6140', type: '车床', brand: '大连机床',
    organizationId: 'org-demo', workshopId: 'workshop-1', workshopName: '一号车间', lineId: 'line-1', lineName: '加工一线', stationId: 'station-08', stationName: '4号工位',
    assetNo: '22100228', lifecycleStatus: '报废/归档', owner: '张三', enableDate: '2018-03-15', buyDate: '2018-02-01',
    oeeEligible: false,
  },
  // 2026-11-05 新增 3 台在用未绑定设备：新建绑定向导第 1 步可绑定设备由 1 台（报废）扩充至 4 台
  {
    deviceId: 'DEV-009', assetCode: 'MT2024A1209', name: '数控车床-09', model: 'CK-6150', type: '车床', brand: '大连机床',
    organizationId: 'org-demo', workshopId: 'workshop-1', workshopName: '一号车间', lineId: 'line-1', lineName: '加工一线', stationId: 'station-09', stationName: '5号工位',
    assetNo: '22100229', lifecycleStatus: '在用', owner: '张三', enableDate: '2025-06-01', buyDate: '2025-05-20',
    oeeEligible: true,
  },
  {
    deviceId: 'DEV-010', assetCode: 'MT2024A1210', name: '钻攻中心-10', model: 'DT-500', type: '钻攻中心', brand: '台群精机',
    organizationId: 'org-demo', workshopId: 'workshop-1', workshopName: '一号车间', lineId: 'line-1', lineName: '加工一线', stationId: 'station-10', stationName: '6号工位',
    assetNo: '22100230', lifecycleStatus: '在用', owner: '李明', enableDate: '2025-08-10', buyDate: '2025-07-28',
    oeeEligible: true,
  },
  {
    deviceId: 'DEV-011', assetCode: 'MT2024A1211', name: '加工中心-11', model: 'VMC-1060', type: '加工中心', brand: '沈阳机床',
    organizationId: 'org-demo', workshopId: 'workshop-2', workshopName: '二号车间', lineId: 'line-3', lineName: '铲齿线', stationId: 'station-11', stationName: '4号工位',
    assetNo: '22100231', lifecycleStatus: '在用', owner: '王强', enableDate: '2025-09-15', buyDate: '2025-09-01',
    oeeEligible: true,
  },
];
