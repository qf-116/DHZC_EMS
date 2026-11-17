// ============================================================
// 三方主数据（组织 / 人员 / 物料）——模拟由外部系统同步的主数据，
// 供各表单「弹窗选择 / 下拉联动」使用，禁止在表单里手输。
// 组织层级与 demo/devices.js 的设备档案保持一致。
// ============================================================

export const workshops = [
  {
    workshopId: 'workshop-1', workshopName: '一号车间',
    lines: [
      { lineId: 'line-1', lineName: '加工一线', stations: ['1号工位', '2号工位', '4号工位'] },
      { lineId: 'line-2', lineName: '焊接一线', stations: ['3号工位'] },
    ],
  },
  {
    workshopId: 'workshop-2', workshopName: '二号车间',
    lines: [
      { lineId: 'line-3', lineName: '铲齿线', stations: ['1号工位', '3号工位'] },
      { lineId: 'line-4', lineName: '焊接二线', stations: ['2号工位'] },
    ],
  },
  {
    workshopId: 'workshop-power', workshopName: '动力站',
    lines: [
      { lineId: '', lineName: '--', stations: ['1号工位'] },
    ],
  },
];

// 人员主数据（姓名与演示数据中已出现的人员保持一致）
export const users = [
  { userId: 'U-1001', name: '李明', dept: '设备部', role: '设备管理员', status: '在职' },
  { userId: 'U-1002', name: '张三', dept: '一号车间', role: '设备负责人', status: '在职' },
  { userId: 'U-1003', name: '李四', dept: '设备部', role: '点检员', status: '在职' },
  { userId: 'U-1004', name: '赵艳', dept: '设备部', role: '巡检员', status: '在职' },
  { userId: 'U-1005', name: '王强', dept: '机修班', role: '维修工程师', status: '在职' },
  { userId: 'U-1006', name: '周强', dept: '机修班', role: '维修工程师', status: '在职' },
  { userId: 'U-1007', name: '陈晨', dept: '设备部', role: '备件管理员', status: '在职' },
  { userId: 'U-1008', name: '孙伟', dept: '动力站', role: '运行工', status: '在职' },
  { userId: 'U-1009', name: '吴涛', dept: '厂家售后', role: '厂家工程师', status: '在职' },
  { userId: 'U-1010', name: '郑洁', dept: '设备部', role: '润滑工', status: '离职' },
  { userId: 'U-1011', name: '赵强', dept: '机修班', role: '维修工程师', status: '在职' },
];

// 派工候选口径（报警中心转维修 / 故障报修指派任务 / 维修任务派工共用同一份口径）：
// 维修人员 = 在职的维修工程师、设备负责人、点检员、巡检员、备件管理员姓名
export const repairStaffNames = users
  .filter(u => u.status === '在职' && ['维修工程师', '设备负责人', '点检员', '巡检员', '备件管理员'].includes(u.role))
  .map(u => u.name);
// 维修班组（演示口径固定三值）
export const repairGroupNames = ['机修班', '电气班', '工艺班'];

// 供应商主数据（与 demo/standardData.js 的入库记录口径一致）
export const suppliers = [
  { supplierId: 'SUP-001', name: '供应商一' },
  { supplierId: 'SUP-002', name: '供应商二' },
];

// 物料/备件主数据（编码与备件统计口径一致）
export const materials = [
  { code: '120001', name: '备件一', spec: '12*12*6', unit: '个' },
  { code: '120002', name: '备件二', spec: '12*12*6', unit: '千克' },
  { code: '120003', name: '备件三', spec: '12*12*6', unit: '米' },
  { code: '120004', name: '备件四', spec: '12*12*6', unit: '个' },
  { code: '120005', name: '备件五', spec: '12*12*6', unit: '个' },
];
