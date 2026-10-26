// 设备管理系统标准版 —— 设备管理业务演示数据（严格按原型字段结构组织）
// 覆盖：设备台账、点检、保养、巡检、维修、备品备件、OEE、文档库、基础配置、工作台

// ============ 设备台账（设备档案） ============
export const deviceTypeTree = [
  { title: '全部设备', key: 'all', children: [
    { title: '车床设备', key: 'lathe', children: [{ title: '数控车床', key: 'lathe-cnc' }, { title: '普通车床', key: 'lathe-normal' }] },
    { title: '加工中心', key: 'mc', children: [{ title: '立式加工中心', key: 'mc-v' }] },
    { title: '激光设备', key: 'laser', children: [{ title: '激光焊接机', key: 'laser-weld' }] },
    { title: '动力设备', key: 'power', children: [{ title: '空压机', key: 'power-air' }, { title: '油压机', key: 'power-oil' }] },
  ] },
];

export const ledgerDevices = [
  { code: 'MT2024A1201', name: '数控车床', model: 'CNC-500', type: '车床', brand: '笑工牌机床', dept: '生产车间/1号产线', station: '1号工位', assetNo: '22100221', networked: '是', oee: '是', state: '正常使用', owner: '张三', enableDate: '2024-01-01', buyDate: '2023-12-20', disableDate: '', updateTime: '2026-01-01 13:00' },
  { code: 'MT2024A1202', name: '数控车床', model: 'CNC-500', type: '车床', brand: '笑工牌机床', dept: '生产车间/1号产线', station: '2号工位', assetNo: '22100222', networked: '是', oee: '是', state: '正常使用', owner: '张三', enableDate: '2024-01-01', buyDate: '2023-12-20', disableDate: '', updateTime: '2026-01-01 13:00' },
  { code: 'MT2024A1203', name: '立式加工中心', model: 'VMC-850', type: '加工中心', brand: '沈阳机床', dept: '生产车间/1号产线', station: '3号工位', assetNo: '22100223', networked: '是', oee: '否', state: '正常使用', owner: '李明', enableDate: '2024-02-15', buyDate: '2024-01-30', disableDate: '', updateTime: '2026-02-10 09:30' },
  { code: 'MT2024A1204', name: '激光焊接机', model: 'LW-3000', type: '激光设备', brand: '大族激光', dept: '生产车间/2号产线', station: '1号工位', assetNo: '22100224', networked: '否', oee: '否', state: '正常使用', owner: '赵艳', enableDate: '2024-03-10', buyDate: '2024-02-25', disableDate: '', updateTime: '2026-03-05 15:20' },
  { code: 'MT2024A1205', name: '油压机', model: 'YH-200T', type: '动力设备', brand: '合肥锻压', dept: '生产车间/2号产线', station: '2号工位', assetNo: '22100225', networked: '否', oee: '否', state: '闲置', owner: '陈晨', enableDate: '2023-06-01', buyDate: '2023-05-12', disableDate: '', updateTime: '2026-04-18 10:05' },
  { code: 'MT2024A1206', name: '空压机', model: 'KA-75', type: '动力设备', brand: '阿特拉斯', dept: '动力站', station: '1号工位', assetNo: '22100226', networked: '是', oee: '否', state: '正常使用', owner: '李明', enableDate: '2022-05-20', buyDate: '2022-04-15', disableDate: '', updateTime: '2026-05-22 11:40' },
  { code: 'MT2024A1207', name: '数控磨床', model: 'MK-1320', type: '磨床', brand: '上海机床', dept: '生产车间/2号产线', station: '3号工位', assetNo: '22100227', networked: '是', oee: '是', state: '停用', owner: '王强', enableDate: '2021-09-01', buyDate: '2021-08-10', disableDate: '2026-06-30', updateTime: '2026-06-30 16:00' },
  { code: 'MT2024A1208', name: '普通车床', model: 'CA6140', type: '车床', brand: '大连机床', dept: '生产车间/1号产线', station: '4号工位', assetNo: '22100228', networked: '否', oee: '否', state: '报废', owner: '张三', enableDate: '2018-03-15', buyDate: '2018-02-01', disableDate: '2025-12-31', updateTime: '2025-12-31 09:00' },
];

// ============ 点检管理 ============
// 点检项目：判断结果类型（单选/数值/文本），单选默认选项 正常/异常（按原型注释栏规则）
export const inspectionItems = [
  { code: 'XJXM20250301001', name: '主轴径向跳动检查', type: '运行状态检查', category: '生产设备', content: '使用振动检测仪检测主轴径向跳动，标准值 ≤ 0.005mm', resultType: '数值', options: '', normalValue: '≤ 0.005mm', remark: '', status: '已启用', createTime: '2025-03-01 10:00:00' },
  { code: 'XJXM20250301002', name: '导轨润滑状态检查', type: '运行状态检查', category: '生产设备', content: '目视+油位尺检查导轨润滑油位是否在标线内、有无渗漏', resultType: '单选', options: '正常/异常', normalValue: '', remark: '', status: '已启用', createTime: '2025-03-01 10:05:00' },
  { code: 'XJXM20250302001', name: '气压系统压力检查', type: '运行状态检查', category: '生产设备', content: '压力表读数确认为 0.6 ~ 0.8 MPa，检查有无漏气现象', resultType: '单选', options: '有/无', normalValue: '0.6 ~ 0.8 MPa', remark: '', status: '已启用', createTime: '2025-03-02 09:00:00' },
  { code: 'XJXM20250315001', name: '激光器冷却水温检查', type: '清洁检查', category: '老化设备', content: '温度计检查冷却水温应在 22 ~ 28 ℃', resultType: '文本', options: '', normalValue: '22 ~ 28 ℃', remark: '', status: '已启用', createTime: '2025-03-15 14:00:00' },
  { code: 'XJXM20250401001', name: '安全防护门联锁检查', type: '机械部件检查', category: '测试设备', content: '功能试验：开门即停、复位正常', resultType: '单选', options: '合格/不合格', normalValue: '', remark: '联锁失效须立即报修', status: '已停用', createTime: '2025-04-01 08:30:00' },
];

export const inspectionStandards = [
  { code: 'XJBZ20250301001', name: '数控车床日常点检标准', devices: 3, status: '已启用', updateTime: '2026-08-12 10:00:00', remark: '' },
  { code: 'XJBZ20250415001', name: '激光焊接机日常点检标准', devices: 1, status: '已启用', updateTime: '2026-07-30 14:20:00', remark: '' },
  { code: 'XJBZ20250601001', name: '空压机周点检标准', devices: 1, status: '已启用', updateTime: '2026-06-15 09:10:00', remark: '' },
  { code: 'XJBZ20260701001', name: '油压机日常点检标准', devices: 1, status: '已停用', updateTime: '2026-07-01 16:45:00', remark: '设备已停用，标准同步停用' },
];

// 标准详情中的点检设备表 / 点检项目表
export const inspectionStandardDevices = [
  { code: 'MT2024A1201', name: '数控车床', model: 'CNC-500', type: '车床', dept: '生产车间/1号产线', station: '1号工位' },
  { code: 'MT2024A1202', name: '数控车床', model: 'CNC-500', type: '车床', dept: '生产车间/1号产线', station: '2号工位' },
  { code: 'MT2024A1203', name: '立式加工中心', model: 'VMC-850', type: '加工中心', dept: '生产车间/1号产线', station: '3号工位' },
];
export const inspectionStandardItemCodes = ['XJXM20250301001', 'XJXM20250301002', 'XJXM20250302001'];

export const inspectionPlans = [
  { code: 'XJJH20250202001', name: '数控车床日常点检计划', startDate: '2026-09-01', endDate: '2026-12-31', cycle: '日', interval: 1, skip: '跳过星期日', owner: '李四、王强', deviceCount: 3, totalTasks: 92, doneTasks: 88, status: '进行中', remark: '', createTime: '2026-08-28 10:00:00' },
  { code: 'XJJH20250202002', name: '激光焊接机日常点检计划', startDate: '2026-09-01', endDate: '2026-12-31', cycle: '日', interval: 1, skip: '', owner: '赵艳', deviceCount: 1, totalTasks: 92, doneTasks: 86, status: '进行中', remark: '', createTime: '2026-08-28 10:10:00' },
  { code: 'XJJH20250202003', name: '空压机周点检计划', startDate: '2026-09-01', endDate: '2026-12-31', cycle: '周', interval: 1, skip: '', owner: '李明', deviceCount: 1, totalTasks: 18, doneTasks: 10, status: '未开始', remark: '', createTime: '2026-08-28 10:20:00' },
  { code: 'XJJH20250202004', name: '油压机日常点检计划', startDate: '2026-05-01', endDate: '2026-08-31', cycle: '自定义', interval: 4, skip: '跳过星期六、跳过星期天', owner: '陈晨', deviceCount: 1, totalTasks: 62, doneTasks: 62, status: '已完成', remark: '', createTime: '2026-04-25 15:00:00' },
  { code: 'XJJH20250202005', name: '数控磨床月度点检计划', startDate: '2026-06-01', endDate: '2026-06-30', cycle: '月', interval: 1, skip: '', owner: '王强', deviceCount: 1, totalTasks: 6, doneTasks: 3, status: '已关闭', remark: '设备停用，提前完结计划', createTime: '2026-05-28 09:00:00' },
];

export const inspectionTasks = [
  { code: 'XJJH20250202001-001', name: '数控车床日常点检计划', shouldCount: 3, date: '2026-09-04', plan: '数控车床日常点检计划', group: '机加班组', owner: '李四', status: '未开始', createTime: '2026-09-04 06:00:00', remark: '' },
  { code: 'XJJH20250202002-001', name: '激光焊接机日常点检计划', shouldCount: 1, date: '2026-09-04', plan: '激光焊接机日常点检计划', group: '激光班组', owner: '赵艳', status: '进行中', createTime: '2026-09-04 06:00:00', remark: '' },
  { code: 'XJJH20250202003-001', name: '空压机周点检计划', shouldCount: 1, date: '2026-09-04', plan: '空压机周点检计划', group: '动力班组', owner: '李明', status: '已完成', createTime: '2026-09-04 06:00:00', remark: '' },
  { code: 'XJJH20250202001-002', name: '数控车床日常点检计划', shouldCount: 3, date: '2026-09-03', plan: '数控车床日常点检计划', group: '机加班组', owner: '李四', status: '已关闭', createTime: '2026-09-03 06:00:00', remark: '计划提前完结，任务同步关闭' },
];

// 任务详情中的点检明细（每台设备一行）
export const inspectionTaskDetails = [
  { code: 'MT2024A1201', name: '数控车床', model: 'CNC-500', type: '车床', dept: '生产车间/1号产线', station: '1号工位', itemTotal: 2, itemNames: '主轴径向跳动检查、导轨润滑状态检查', checked: 1, unchecked: 1, execTime: '2026-09-04 08:12', skipReason: '' },
  { code: 'MT2024A1202', name: '数控车床', model: 'CNC-500', type: '车床', dept: '生产车间/1号产线', station: '2号工位', itemTotal: 2, itemNames: '主轴径向跳动检查、气压系统压力检查', checked: 0, unchecked: 2, execTime: '', skipReason: '' },
  { code: 'MT2024A1203', name: '立式加工中心', model: 'VMC-850', type: '加工中心', dept: '生产车间/1号产线', station: '3号工位', itemTotal: 1, itemNames: '导轨润滑状态检查', checked: 0, unchecked: 1, execTime: '', skipReason: '设备临时生产任务冲突，无法停机点检' },
];

// 执行点检（单设备多项目）：结果类型 单选（radio 选项）/ 数值（normalValue 为正常范围提示）/ 文本
export const inspectionExecItems = [
  { code: 'XJXM20250301001', name: '主轴径向跳动检查', type: '运行状态检查', content: '使用振动检测仪检测主轴径向跳动，标准值 ≤ 0.005mm', resultType: '数值', options: '', normalValue: '≤ 0.005mm' },
  { code: 'XJXM20250301002', name: '导轨润滑状态检查', type: '运行状态检查', content: '目视+油位尺检查导轨润滑油位是否在标线内、有无渗漏', resultType: '单选', options: '正常/异常', normalValue: '' },
  { code: 'XJXM20250302001', name: '气压系统压力检查', type: '运行状态检查', content: '压力表读数确认为 0.6 ~ 0.8 MPa，检查有无漏气现象', resultType: '单选', options: '有/无', normalValue: '0.6 ~ 0.8 MPa' },
];

// ============ 保养管理 ============
// 保养项目基础档案（分组字段用于「添加保养项目」弹窗左侧分组树，对齐原型「选择项目」页）
export const maintenanceItemGroups = ['清洁保养', '干湿类保养', '表面保养', '机油保养'];

export const maintenanceItems = [
  { code: 'BYXM20250301001', name: '主轴轴承润滑脂更换', type: '机油保养', group: '机油保养', part: '主轴', level: '一级', require: '清理旧脂、加注新脂 200g（SKF LGMT2）', resultType: '单选', options: '正常/异常', remark: '', status: '已启用', createTime: '2025-03-01 10:00:00' },
  { code: 'BYXM20250301002', name: '冷却液更换与管路清洗', type: '干湿类保养', group: '干湿类保养', part: '冷却系统', level: '二级', require: '排空、清洗、加注新液（Barida 5510）', resultType: '文本', options: '', remark: '', status: '已启用', createTime: '2025-03-01 10:10:00' },
  { code: 'BYXM20250301003', name: '干保养（表面除尘）', type: '干湿类保养', group: '干湿类保养', part: '外观', level: '一级', require: '干布擦拭设备表面灰尘、油污', resultType: '单选', options: '正常/异常', remark: '', status: '已启用', createTime: '2025-03-01 10:20:00' },
  { code: 'BYXM20250301004', name: '湿保养（表面清洗）', type: '干湿类保养', group: '干湿类保养', part: '外观', level: '一级', require: '清洗剂清洗设备表面并擦干', resultType: '单选', options: '正常/异常', remark: '', status: '已启用', createTime: '2025-03-01 10:30:00' },
  { code: 'BYXM20250415001', name: '激光器镜片清洁', type: '表面保养', group: '表面保养', part: '激光器', level: '一级', require: '无尘布+专用清洗剂擦拭', resultType: '单选', options: '合格/不合格', remark: '', status: '已启用', createTime: '2025-04-15 14:00:00' },
  { code: 'BYXM20250501001', name: '导轨油润滑检查', type: '机油保养', group: '机油保养', part: '导轨', level: '一级', require: '检查导轨油位并加注润滑油', resultType: '单选', options: '正常/异常', remark: '', status: '已启用', createTime: '2025-05-01 09:00:00' },
  { code: 'BYXM20250515001', name: '电控柜清洁保养', type: '清洁保养', group: '清洁保养', part: '电气系统', level: '二级', require: '断电后清洁电控柜灰尘并检查接线', resultType: '单选', options: '正常/异常', remark: '', status: '已启用', createTime: '2025-05-15 10:00:00' },
  { code: 'BYXM20250601001', name: '空压机滤芯更换', type: '其他保养', group: '清洁保养', part: '进气系统', level: '三级', require: '更换空滤、油滤、油分（原厂 2901-x）', resultType: '数值', options: '', remark: '记录压差 kPa', status: '已停用', createTime: '2025-06-01 09:00:00' },
];

// 保养计划明细（每台设备一行，对齐原型「新增保养计划/保养计划详情」明细表）
export const maintenancePlanDetails = [
  { code: 'MT2024A1201', name: '数控车床', type: '车床', dept: '生产车间/1号产线', station: '1号工位', standard: '数控车床月度保养标准', itemCount: '2项' },
  { code: 'MT2024A1202', name: '数控车床', type: '车床', dept: '生产车间/1号产线', station: '2号工位', standard: '数控车床月度保养标准', itemCount: '2项' },
  { code: 'MT2024A1204', name: '激光焊接机', type: '激光设备', dept: '生产车间/2号产线', station: '1号工位', standard: '激光焊接机半年度保养标准', itemCount: '2项' },
];

export const maintenancePlans = [
  { code: 'BYJH20260801001', name: '数控车床一级保养计划', year: '2026', level: '一级保养', method: '循环保养', planDate: '2026-09-01 ~ 2026-12-31', startDate: '2026-09-01', endDate: '2026-12-31', cycle: '周', intervalDays: '', skipDays: '跳过星期六、跳过星期天', devices: '数控车床 ×3', items: '主轴轴承润滑脂更换、导轨润滑检查', status: '执行中', executor: '机修班-王强', creator: '王强', createTime: '2026-08-01 10:00:00', remark: '' },
  { code: 'BYJH20260801002', name: '激光焊接机二级保养计划', year: '2026', level: '二级保养', method: '单次保养', planDate: '2026-09-15', startDate: '2026-09-15', endDate: '2026-09-15', cycle: '日', intervalDays: '', skipDays: '', devices: '激光焊接机 ×1', items: '激光器镜片清洁、冷却水温检查', status: '待执行', executor: '厂家工程师', creator: '赵艳', createTime: '2026-08-05 14:30:00', remark: '厂家到场保养' },
  { code: 'BYJH20260701001', name: '空压机三级保养计划', year: '2026', level: '三级保养', method: '循环保养', planDate: '2026-07-01 ~ 2026-12-31', startDate: '2026-07-01', endDate: '2026-12-31', cycle: '自定义', intervalDays: '15', skipDays: '跳过星期天', devices: '空压机 ×1', items: '空压机滤芯更换', status: '已停止', executor: '李明', creator: '李明', createTime: '2026-07-01 09:00:00', remark: '备件未到位暂停' },
  { code: 'BYJH20260601001', name: '油压机年度保养计划', year: '2026', level: '二级保养', method: '循环保养', planDate: '2026-06-01 ~ 2026-08-31', startDate: '2026-06-01', endDate: '2026-08-31', cycle: '月', intervalDays: '', skipDays: '', devices: '油压机 ×1', items: '液压油更换、密封件检查', status: '已完成', executor: '机修班', creator: '陈晨', createTime: '2026-06-01 08:30:00', remark: '' },
];

export const maintenanceTasks = [
  { code: 'BYRW20260904001', name: '数控车床一级保养计划', device: '数控车床 MT2024A1201', dept: '生产车间/1号产线', date: '2026-09-04', plan: '数控车床一级保养计划', owner: '机修班-王强', status: '未开始', remark: '', createTime: '2026-09-04 06:00:00' },
  { code: 'BYRW20260904002', name: '数控车床一级保养计划', device: '数控车床 MT2024A1202', dept: '生产车间/1号产线', date: '2026-09-04', plan: '数控车床一级保养计划', owner: '机修班-王强', status: '进行中', remark: '优先处理主轴异响', createTime: '2026-09-04 06:00:00' },
  { code: 'BYRW20260903001', name: '数控车床一级保养计划', device: '立式加工中心 MT2024A1203', dept: '生产车间/1号产线', date: '2026-09-03', plan: '数控车床一级保养计划', owner: '机修班-王强', status: '已完成', remark: '', createTime: '2026-09-03 06:00:00' },
  { code: 'BYRW20260905001', name: '激光焊接机二级保养计划', device: '激光焊接机 MT2024A1204', dept: '生产车间/2号产线', date: '2026-09-05', plan: '激光焊接机二级保养计划', owner: '厂家工程师', status: '未开始', remark: '', createTime: '2026-09-03 14:00:00' },
  { code: 'BYRW20260901001', name: '空压机三级保养计划', device: '空压机 MT2024A1206', dept: '动力站', date: '2026-09-01', plan: '空压机三级保养计划', owner: '李明', status: '已关闭', remark: '备件未到位，计划关闭', createTime: '2026-09-01 06:00:00' },
];

// 保养任务明细（每台设备一行，含保养项目数/已检/未检/执行时间/跳过原因，对齐原型「保养任务详情」）
export const maintenanceTaskDetails = [
  { code: 'MT2024A1201', name: '数控车床', model: 'CNC-500', type: '车床', dept: '生产车间/1号产线', station: '1号工位', itemCount: '2项', checked: 2, unchecked: 0, execTime: '2026-09-04 09:12:35', skipReason: '' },
  { code: 'MT2024A1202', name: '数控车床', model: 'CNC-500', type: '车床', dept: '生产车间/1号产线', station: '2号工位', itemCount: '2项', checked: 1, unchecked: 1, execTime: '2026-09-04 10:05:11', skipReason: '' },
  { code: 'MT2024A1203', name: '立式加工中心', model: 'VMC-850', type: '加工中心', dept: '生产车间/1号产线', station: '3号工位', itemCount: '2项', checked: 0, unchecked: 0, execTime: '', skipReason: '设备正在加工急单，经生产科确认跳过本次保养' },
];

export const maintenanceExecItems = [
  { code: 'BYXM20250301001', name: '主轴轴承润滑脂更换', type: '机油保养', part: '主轴', level: '一级', require: '清理旧脂、加注新脂 200g（SKF LGMT2）' },
  { code: 'BYXM20250301002', name: '冷却液更换与管路清洗', type: '干湿类保养', part: '冷却系统', level: '二级', require: '排空、清洗、加注新液（Barida 5510）' },
];

// ============ 巡检管理 ============
// 巡检项目基础档案（字段/枚举对齐现有系统「巡检项目」页；判断结果类型：单选默认 正常/异常，数值在限定范围内为正常，文本直接填写结果）
export const patrolItems = [
  { code: 'XJXM-P20250301001', name: '设备外观检查', type: '外观检查', content: '检查设备表面是否有损坏、变形、腐蚀等情况', resultType: '单选', options: '正常/异常', normalRange: '', remark: '', status: '已启用', createTime: '2025-03-01 10:00:00' },
  { code: 'XJXM-P20250301002', name: '运行状态检查', type: '运行状态检查', content: '观察设备的指示灯、仪表读数等是否显示正常', resultType: '单选', options: '正常/异常', normalRange: '', remark: '', status: '已启用', createTime: '2025-03-01 10:05:00' },
  { code: 'XJXM-P20250302001', name: '异常振动检查', type: '运行状态检查', content: '用手或工具轻触设备，感觉是否有异常的振动或响动', resultType: '数值', options: '', normalRange: '0 ~ 25', remark: '记录振动幅值 mm/s', status: '已启用', createTime: '2025-03-02 09:00:00' },
  { code: 'XJXM-P20250315001', name: '部件磨损检查', type: '机械部件检查', content: '仔细检查设备各部件的磨损情况，有无松动或明显的缺陷', resultType: '文本', options: '', normalRange: '', remark: '', status: '已启用', createTime: '2025-03-15 14:00:00' },
  { code: 'XJXM-P20250401001', name: '清洁度检查', type: '清洁检查', content: '检查设备表面及周围是否有灰尘、污垢、油污等杂物，如有则进行清理并记录清理前后的情况', resultType: '文本', options: '', normalRange: '', remark: '', status: '已停用', createTime: '2025-04-01 08:30:00' },
];

// 保养标准档案（字段对齐现有系统「保养标准」页；状态为 已启用/已停用）
export const maintenanceStandards = [
  { code: 'BYBZ20250301001', name: '数控车床月度保养标准', devices: 2, status: '已启用', updateTime: '2026-08-12 10:00:00', remark: '含主轴、冷却系统月度保养项目' },
  { code: 'BYBZ20250415001', name: '加工中心季度保养标准', devices: 3, status: '已启用', updateTime: '2026-07-30 14:20:00', remark: '' },
  { code: 'BYBZ20250601001', name: '激光焊接机半年度保养标准', devices: 2, status: '已启用', updateTime: '2026-06-15 09:10:00', remark: '' },
  { code: 'BYBZ20260701001', name: '空压机月度保养标准', devices: 1, status: '已停用', updateTime: '2026-07-01 16:45:00', remark: '备件供应调整，暂停使用' },
];

// 保养标准关联设备 / 关联保养项目（对齐原型「标准详情」「新增标准」页）
export const maintenanceStandardDevices = [
  { code: 'MT2024A1201', name: '数控车床', model: 'CNC-500', type: '车床', dept: '生产车间/1号产线', station: '1号工位', state: '正常使用' },
  { code: 'MT2024A1202', name: '数控车床', model: 'CNC-500', type: '车床', dept: '生产车间/1号产线', station: '2号工位', state: '正常使用' },
];

// 数控车床月度保养标准关联的保养项目编号（maintenanceItems 内）
export const maintenanceStandardItemCodes = ['BYXM20250301001', 'BYXM20250301003', 'BYXM20250501001'];

export const patrolStandards = [
  { code: 'XJBZ-P20250301001', name: '一号车间日常巡检标准', devices: 4, status: '已启用', remark: '', updateTime: '2026-08-12 10:00:00' },
  { code: 'XJBZ-P20250415001', name: '二号车间日常巡检标准', devices: 3, status: '已启用', remark: '', updateTime: '2026-07-30 14:20:00' },
  { code: 'XJBZ-P20250601001', name: '动力站夜间巡检标准', devices: 1, status: '已停用', remark: '', updateTime: '2026-06-15 09:10:00' },
];

export const patrolPlans = [
  { code: 'XJJH-P20250202001', name: '一号车间日常巡检计划', startDate: '2026-09-01', endDate: '2026-12-31', cycle: '日', interval: 1, skip: '跳过星期日', owner: '李四、王强', deviceCount: 4, totalTasks: 92, doneTasks: 90, status: '进行中', remark: '', createTime: '2026-08-28 10:00:00' },
  { code: 'XJJH-P20250202002', name: '二号车间日常巡检计划', startDate: '2026-09-01', endDate: '2026-12-31', cycle: '自定义', interval: 4, skip: '跳过星期六、跳过星期天', owner: '王强', deviceCount: 3, totalTasks: 23, doneTasks: 0, status: '未开始', remark: '', createTime: '2026-08-28 10:10:00' },
  { code: 'XJJH-P20250202003', name: '动力站夜间巡检计划', startDate: '2026-09-01', endDate: '2026-12-31', cycle: '周', interval: 1, skip: '', owner: '李四', deviceCount: 1, totalTasks: 18, doneTasks: 18, status: '已完成', remark: '提前完结', createTime: '2026-08-28 10:20:00' },
];

// 巡检计划/任务的巡检明细设备行（对齐原型：设备 + 巡检标准 + 巡检项目数）
export const patrolPlanDevices = [
  { code: 'MT2024A1201', name: '数控车床', model: 'CNC-500', type: '车床', dept: '生产车间/1号产线', station: '1号工位', standard: '一号车间日常巡检标准', itemCount: 10 },
  { code: 'MT2024A1203', name: '立式加工中心', model: 'VMC-850', type: '加工中心', dept: '生产车间/1号产线', station: '3号工位', standard: '一号车间日常巡检标准', itemCount: 10 },
  { code: 'MT2024A1204', name: '激光焊接机', model: 'LW-3000', type: '激光设备', dept: '生产车间/2号产线', station: '1号工位', standard: '二号车间日常巡检标准', itemCount: 8 },
  { code: 'MT2024A1206', name: '空压机', model: 'KA-75', type: '动力设备', dept: '动力站', station: '1号工位', standard: '动力站夜间巡检标准', itemCount: 6 },
];

export const patrolTasks = [
  { code: 'XJJH-P20250202001-001', name: '一号车间日常巡检计划', shouldCount: 4, date: '2026-09-04', plan: '一号车间日常巡检计划', owner: '李四、王强', status: '进行中', createTime: '2026-09-04 06:00:00' },
  { code: 'XJJH-P20250202002-001', name: '二号车间日常巡检计划', shouldCount: 3, date: '2026-09-04', plan: '二号车间日常巡检计划', owner: '王强', status: '未开始', createTime: '2026-09-04 06:00:00' },
  { code: 'XJJH-P20250202001-002', name: '一号车间日常巡检计划', shouldCount: 4, date: '2026-09-03', plan: '一号车间日常巡检计划', owner: '李四、王强', status: '已完成', createTime: '2026-09-03 06:00:00' },
  { code: 'XJJH-P20250202002-002', name: '二号车间日常巡检计划', shouldCount: 3, date: '2026-08-30', plan: '二号车间日常巡检计划', owner: '王强', status: '已逾期', createTime: '2026-08-30 06:00:00' },
  { code: 'XJJH-P20250202003-001', name: '动力站夜间巡检计划', shouldCount: 1, date: '2026-08-29', plan: '动力站夜间巡检计划', owner: '李四', status: '逾期完成', createTime: '2026-08-29 06:00:00' },
];

export const patrolTaskDetails = [
  { code: 'MT2024A1201', name: '数控车床', model: 'CNC-500', type: '车床', dept: '生产车间/1号产线', station: '1号工位', location: '车间B区', itemCount: 10, itemNames: '运行异响检查、仪表读数记录', checked: 10, unchecked: 0, execTime: '2026-09-04 08:30', skipReason: '' },
  { code: 'MT2024A1203', name: '立式加工中心', model: 'VMC-850', type: '加工中心', dept: '生产车间/1号产线', station: '3号工位', location: '车间B区', itemCount: 10, itemNames: '运行异响检查', checked: 8, unchecked: 2, execTime: '2026-09-04 08:45', skipReason: '' },
  { code: 'MT2024A1204', name: '激光焊接机', model: 'LW-3000', type: '激光设备', dept: '生产车间/2号产线', station: '1号工位', location: '车间A区', itemCount: 8, itemNames: '冷却水温检查、排烟系统检查', checked: 0, unchecked: 0, execTime: '', skipReason: '设备正在生产，无法停机巡检' },
  { code: 'MT2024A1206', name: '空压机', model: 'KA-75', type: '动力设备', dept: '动力站', station: '1号工位', location: '动力站', itemCount: 6, itemNames: '压力表读数记录', checked: 0, unchecked: 6, execTime: '', skipReason: '' },
];

// 执行巡检 / 巡检详情（单设备多项目；判断结果类型：单选/数值/文本，数值在正常值范围内为正常）
export const patrolExecItems = [
  { code: 'XJXM-P001', name: '外观检查具体描述', type: '外观检查', content: '检查设备表面是否有损坏、变形、腐蚀等情况', resultType: '单选', options: '合格/不合格', result: '合格', remark: '设备正常运行，没有问题' },
  { code: 'XJXM-P002', name: '运行是否正常', type: '运行状态检查', content: '观察设备的指示灯、仪表读数等是否显示正常', resultType: '数值', normalValue: '13~25', result: '13', remark: '' },
  { code: 'XJXM-P003', name: '有无漏油、漏气、漏水现象', type: '外观检查', content: '检查设备表面是否有损坏、变形、腐蚀等情况', resultType: '单选', options: '有/无', result: '无', remark: '' },
  { code: 'XJXM-P004', name: '有无异常震动', type: '运行状态检查', content: '用手或工具轻触设备，感觉是否有异常的振动或响动', resultType: '文本', result: '运行平稳，无明显异振', remark: '' },
];

// ============ 维修管理 ============
// 故障报修
export const repairReports = [
  { code: 'GZBX2503220001', name: '设备一报修', device: '设备一', faultType: '机械', level: '紧急', faultTime: '2026-01-15 15:21', status: '未处理', creator: '傅彭薄', createTime: '2026-01-15 15:33' },
  { code: 'GZBX2503220002', name: '设备二报修', device: '设备二', faultType: '电气', level: '严重', faultTime: '2026-01-15 15:21', status: '进行中', creator: '王五', createTime: '2026-01-15 15:33' },
  { code: 'GZBX2503220003', name: '设备三报修', device: '设备三', faultType: '液压', level: '一般', faultTime: '2026-01-15 15:21', status: '已完成', creator: '王乐康', createTime: '2026-01-15 15:33' },
  { code: 'GZBX2503220004', name: '设备四报修', device: '设备四', faultType: '控制系统', level: '严重', faultTime: '2026-01-15 15:21', status: '已完成', creator: '张三', createTime: '2026-01-15 15:33' },
  { code: 'GZBX2508220005', name: '数控车床主轴异响报修', device: '数控车床 MT2024A1201', faultType: '机械', level: '紧急', faultTime: '2026-09-02 09:40', status: '进行中', creator: '张伟', createTime: '2026-09-02 09:45' },
];

// 待维修看板
export const pendingRepairs = [
  { code: 'BX20260902001', name: '设备一报修', device: '设备一', deviceCode: '1234', deviceType: '类型一', stop: '是', level: '紧急', faultTime: '2026-09-02 16:34:23', desc: '设备运转异常，安灯报警，影响生产，请尽快处理。' },
  { code: 'BX20260902002', name: '数控车床主轴异响报修', device: '豪迈电子锯180L', deviceCode: 'HM1932-G180L', deviceType: '豪迈电子锯180L', stop: '是', level: '严重', faultTime: '2026-09-02 16:34:23', desc: '设备运转异常，安灯报警，影响生产，请尽快处理。' },
  { code: 'BX20260901003', name: '设备三报修', device: '豪迈电子锯180L', deviceCode: 'HM1932-G180L', deviceType: '豪迈电子锯180L', stop: '否', level: '一般', faultTime: '2026-09-01 16:34:23', desc: '设备运转异常，安灯报警，影响生产，请尽快处理。' },
  { code: 'BX20260901004', name: '设备四报修', device: '豪迈电子锯180L', deviceCode: 'HM1932-G180L', deviceType: '豪迈电子锯180L', stop: '否', level: '一般', faultTime: '2026-09-01 10:20:11', desc: '设备运转异常，安灯报警，影响生产，请尽快处理。' },
  { code: 'BX20260831005', name: '空压机压力低报修', device: '空压机', deviceCode: 'KA-75', deviceType: '动力设备', stop: '否', level: '一般', faultTime: '2026-08-31 08:05:00', desc: '排气压力低于 0.5 MPa，疑似进气阀故障。' },
];

// 维修任务（任务来源：报修登记/报修任务、监测异常、快速维修；仅快速维修可编辑）
export const repairTasks = [
  { code: 'ME1010010101', faultName: '电动机轴承损坏维修', faultType: '过热', level: '一般', faultReason: '冷却设备故障', repairPart: '冷却系统', repairType: '普通维修', repairLevel: '一般维修', device: 'XXXXXX设备', model: 'SD001', dept: '生产部', location: '车间B区', status: '待处理', startTime: '2026-07-12 10:30', endTime: '', duration: '', source: '报修任务', refNo: 'RXD002', owner: '周强', createTime: '2026-07-12 10:04:39', faultDesc: '设备运转异常，安灯报警，影响生产，请尽快处理。' },
  { code: 'ME1010010102', faultName: '电动机轴承损坏维修', faultType: '过热', level: '一般', faultReason: '冷却设备故障', repairPart: '冷却系统', repairType: '普通维修', repairLevel: '一般维修', device: 'XXXXXX设备', model: 'SD001', dept: '生产部', location: '车间B区', status: '维修中', startTime: '2026-07-12 10:30', endTime: '', duration: '', source: '报修任务', refNo: 'RXD002', owner: '周强', createTime: '2026-07-12 10:04:39', faultDesc: '设备运转异常，安灯报警，影响生产，请尽快处理。' },
  { code: 'ME1010010103', faultName: '电动机轴承损坏维修', faultType: '过热', level: '一般', faultReason: '冷却设备故障', repairPart: '冷却系统', repairType: '普通维修', repairLevel: '一般维修', device: 'XXXXXX设备', model: 'SD001', dept: '生产部', location: '车间B区', status: '维修中', startTime: '2026-07-12 10:30', endTime: '', duration: '', source: '监测异常', refNo: 'YC10020211', owner: '周强', createTime: '2026-07-12 10:04:39', faultDesc: '设备运转异常，安灯报警，影响生产，请尽快处理。' },
  { code: 'ME1010010104', faultName: '电动机轴承损坏维修', faultType: '过热', level: '一般', faultReason: '冷却设备故障', repairPart: '冷却系统', repairType: '普通维修', repairLevel: '一般维修', device: 'XXXXXX设备', model: 'SD001', dept: '生产部', location: '车间B区', status: '已完成', startTime: '2026-07-12 10:30', endTime: '2026-07-12 10:50', duration: '20分钟', source: '监测异常', refNo: 'YC10020211', owner: '周强', createTime: '2026-07-12 10:04:39', faultDesc: '设备运转异常，安灯报警，影响生产，请尽快处理。' },
  { code: 'ME1010010105', faultName: '电动机轴承损坏维修', faultType: '过热', level: '一般', faultReason: '冷却设备故障', repairPart: '冷却系统', repairType: '普通维修', repairLevel: '一般维修', device: 'XXXXXX设备', model: 'SD001', dept: '生产部', location: '车间B区', status: '已完成', startTime: '2026-07-12 10:30', endTime: '2026-07-12 10:50', duration: '20分钟', source: '快速维修', refNo: '---', owner: '周强', createTime: '2026-07-12 10:04:39', faultDesc: '设备运转异常，安灯报警，影响生产，请尽快处理。' },
];

export const repairKnowledge = [
  { code: 1, name: '电机过热', faultType: '过热', deviceType: '电机', devicePart: '电机', faultDesc: '1、电机过热导致停机；2、......', faultReason: '冷却系统故障', repairContent: '清理散热风道，更换冷却风扇', status: '启用', creator: '李四', createTime: '2026-01-01 13:00' },
  { code: 2, name: '液压系统压力不足', faultType: '压力不足', deviceType: '液压系统', devicePart: '液压泵', faultDesc: '液压系统压力不足', faultReason: '冷却系统故障', repairContent: '更换液压泵密封件并补油', status: '启用', creator: '李四', createTime: '2026-01-01 13:00' },
  { code: 3, name: '控制面板无法响应操作', faultType: '响应故障', deviceType: '控制面板', devicePart: '控制面板', faultDesc: '控制面板无法响应操作', faultReason: '冷却系统故障', repairContent: '重启控制器，重新烧录程序', status: '启用', creator: '李四', createTime: '2026-01-01 13:00' },
  { code: 4, name: '刀片磨损', faultType: '磨损', deviceType: '剪板机', devicePart: '刀片', faultDesc: '刀片磨损导致剪切不准确', faultReason: '冷却系统故障', repairContent: '更换刀片并重新对刀', status: '启用', creator: '李四', createTime: '2026-01-01 13:00' },
  { code: 5, name: '传动系统出现异响', faultType: '异响', deviceType: '传动系统', devicePart: '传动系统', faultDesc: '传动系统出现异响', faultReason: '冷却系统故障', repairContent: '紧固联轴器螺栓，补充润滑', status: '启用', creator: '李四', createTime: '2026-01-01 13:00' },
  { code: 6, name: '电路板烧毁', faultType: '短路', deviceType: '电路板', devicePart: '电路板', faultDesc: '电路板烧毁', faultReason: '冷却系统故障', repairContent: '更换烧毁电路板并检测供电', status: '启用', creator: '李四', createTime: '2026-01-01 13:00' },
  { code: 7, name: '传感器故障', faultType: '故障', deviceType: '传感器', devicePart: '传感器', faultDesc: '传感器故障导致检测失误', faultReason: '冷却系统故障', repairContent: '更换传感器并重新标定', status: '启用', creator: '李四', createTime: '2026-01-01 13:00' },
  { code: 8, name: '轴承磨损', faultType: '磨损', deviceType: '机械系统', devicePart: '轴承', faultDesc: '轴承磨损过度', faultReason: '冷却系统故障', repairContent: '更换轴承并补充润滑脂', status: '启用', creator: '李四', createTime: '2026-01-01 13:00' },
  { code: 9, name: '冷却系统漏水', faultType: '漏水', deviceType: '冷却系统', devicePart: '冷却系统', faultDesc: '冷却系统漏水', faultReason: '冷却系统故障', repairContent: '更换密封管路并加压检漏', status: '启用', creator: '李四', createTime: '2026-01-01 13:00' },
  { code: 10, name: '电源模块损坏', faultType: '损坏', deviceType: '电源模块', devicePart: '电源模块', faultDesc: '电源模块损坏导致停机', faultReason: '冷却系统故障', repairContent: '更换电源模块并测试输出电压', status: '启用', creator: '李四', createTime: '2026-01-01 13:00' },
];

// ============ 备品备件 ============
export const spareParts = [
  { code: '120001', name: '备件一', spec: '12*12*6', brand: '品牌一', stock: 999, life: 600, safe: 400, max: 1000, unit: '个', use: '--', remark: '--', createTime: '2025-03-31 12:00:00', updateTime: '2025-03-31 12:00:00', updater: '张三' },
  { code: '120002', name: '备件二', spec: '12*12*6', brand: '--', stock: 450, life: 400, safe: 400, max: 1000, unit: '千克', use: '--', remark: '--', createTime: '2025-03-31 12:00:00', updateTime: '2025-03-31 12:00:00', updater: '李四' },
  { code: '120003', name: '备件三', spec: '12*12*6', brand: '--', stock: 500, life: 400, safe: 400, max: 1000, unit: '米', use: '--', remark: '--', createTime: '2025-03-31 12:00:00', updateTime: '2025-03-31 12:00:00', updater: '王五' },
  { code: '120004', name: '备件四', spec: '12*12*6', brand: '品牌一', stock: 360, life: 400, safe: 400, max: 1000, unit: '个', use: '--', remark: '--', createTime: '2025-03-31 12:00:00', updateTime: '2025-03-31 12:00:00', updater: '赵六' },
  { code: '120005', name: '备件五', spec: '12*12*6', brand: '品牌二', stock: 360, life: 400, safe: 400, max: 1000, unit: '个', use: '--', remark: '--', createTime: '2025-03-31 12:00:00', updateTime: '2025-03-31 12:00:00', updater: '唐七' },
];

// 备品备件公共选项（单位/仓库选项严格按原型：单位 个/米/千克/平方米；仓库 备品备件仓库/仓库二）
export const spareUnits = ['个', '米', '千克', '平方米'];
export const spareWarehouses = ['备品备件仓库', '仓库二'];

export const inboundRecords = [
  { code: 'rk202601010001', supplier: '供应商一', buyer: '张三', date: '2025-03-31', creator: '王五', createTime: '2025-03-31 12:00:00', remark: '到货入库说明：按采购单验收，包装完好。', items: [
    { name: '备件一', code: '120001', spec: '12*12*6', brand: '品牌一', unit: '个', warehouse: '1号仓库', qty: 200 },
    { name: '备件二', code: '120002', spec: '12*12*6', brand: '--', unit: '米', warehouse: '1号仓库', qty: 200 },
  ] },
  { code: 'rk202601010002', supplier: '供应商二', buyer: '张三', date: '2025-03-31', creator: '王五', createTime: '2025-03-31 12:00:00', remark: '到货入库说明：随机附合格证。', items: [
    { name: '备件三', code: '120003', spec: '12*12*6', brand: '--', unit: '米', warehouse: '2号仓库', qty: 150 },
  ] },
  { code: 'rk202601010003', supplier: '供应商一', buyer: '张三', date: '2025-03-30', creator: '王五', createTime: '2025-03-30 12:00:00', remark: '到货入库说明：——', items: [
    { name: '备件四', code: '120004', spec: '12*12*6', brand: '品牌一', unit: '个', warehouse: '1号仓库', qty: 100 },
    { name: '备件五', code: '120005', spec: '12*12*6', brand: '品牌二', unit: '个', warehouse: '2号仓库', qty: 120 },
  ] },
];

export const outboundRecords = [
  { code: 'ck202601010001', type: '领用出库', person: '张三', date: '2025-03-31', creator: '王五', createTime: '2025-03-31 12:00:00', remark: '领用出库说明：车间日常领用。', items: [
    { name: '备件一', spec: '12*12*6', brand: '品牌一', unit: '个', warehouse: '1号仓库', qty: 300 },
    { name: '备件二', spec: '12*12*6', brand: '--', unit: '米', warehouse: '1号仓库', qty: 200 },
  ] },
  { code: 'ck202601010002', type: '领用出库', person: '张三', date: '2025-03-31', creator: '王五', createTime: '2025-03-31 12:00:00', remark: '领用出库说明：——', items: [
    { name: '备件三', spec: '12*12*6', brand: '--', unit: '米', warehouse: '2号仓库', qty: 50 },
  ] },
  { code: 'ck202601010003', type: '维修出库', person: '张三', date: '2025-03-31', creator: '王五', createTime: '2025-03-31 12:00:00', remark: '维修出库说明：维修任务 ME1010010101 自动生成。', items: [
    { name: '备件四', spec: '12*12*6', brand: '品牌一', unit: '个', warehouse: '1号仓库', qty: 2 },
  ] },
  { code: 'ck202601010004', type: '维修出库', person: '张三', date: '2025-03-30', creator: '王五', createTime: '2025-03-30 12:00:00', remark: '维修出库说明：维修任务自动生成。', items: [
    { name: '备件五', spec: '12*12*6', brand: '品牌二', unit: '个', warehouse: '2号仓库', qty: 1 },
  ] },
];

export const oeeRealtime = [
  { device: 'CNC加工中心-01', availability: '88.0%', performance: '92.5%', quality: '97.7%', oee: '79.5%', state: '运行', shift: '白班' },
  { device: 'CNC加工中心-02', availability: '85.3%', performance: '90.1%', quality: '98.3%', oee: '75.5%', state: '运行', shift: '白班' },
  { device: '激光焊接机-03', availability: '76.2%', performance: '88.6%', quality: '99.0%', oee: '66.8%', state: '待机', shift: '白班' },
  { device: '数控铲齿机-04', availability: '69.9%', performance: '85.4%', quality: '98.8%', oee: '59.0%', state: '故障', shift: '白班' },
  { device: '数控磨床-06', availability: '91.5%', performance: '94.2%', quality: '98.5%', oee: '84.9%', state: '运行', shift: '白班' },
];

export const oeeHistory = [
  { month: '2026-04', cnc01: 76.2, cnc02: 72.8, gm04: 63.5 },
  { month: '2026-05', cnc01: 77.5, cnc02: 74.1, gm04: 62.0 },
  { month: '2026-06', cnc01: 78.1, cnc02: 73.5, gm04: 60.8 },
  { month: '2026-07', cnc01: 78.8, cnc02: 75.0, gm04: 58.9 },
  { month: '2026-08', cnc01: 79.1, cnc02: 75.8, gm04: 57.6 },
  { month: '2026-09', cnc01: 79.5, cnc02: 75.5, gm04: 59.0 },
];

export const docLibrary = [
  { code: 'DOC-001', name: 'CNC-850 电气原理图', type: '技术资料', device: 'CNC加工中心', version: 'V3', updater: '李明', updateDate: '2026-08-20', size: '4.2 MB' },
  { code: 'DOC-002', name: 'CNC-850 机械维护手册', type: '维修手册', device: 'CNC加工中心', version: 'V2', updater: '王强', updateDate: '2026-07-11', size: '12.8 MB' },
  { code: 'DOC-003', name: '激光焊接机操作规程', type: '操作规程', device: '激光焊接机', version: 'V4', updater: '赵艳', updateDate: '2026-08-05', size: '2.1 MB' },
  { code: 'DOC-004', name: '空压机年度维保合同', type: '合同附件', device: '空压机', version: 'V1', updater: '陈晨', updateDate: '2026-06-30', size: '860 KB' },
  { code: 'DOC-005', name: '设备台账导入模板', type: '模板', device: '通用', version: 'V2', updater: '设备部', updateDate: '2026-09-01', size: '45 KB' },
];

export const baseTypes = [
  { category: '设备类型', values: '车床、加工中心、激光设备、动力设备、磨床', count: 5, updater: '李明', updateDate: '2026-08-20' },
  { category: '设备状态', values: '正常使用、闲置、停用、报废', count: 4, updater: '设备部', updateDate: '2026-05-11' },
  { category: '故障类型', values: '机械、电气、液压、气动、控制系统、过热、磨损、其他', count: 8, updater: '王强', updateDate: '2026-07-02' },
  { category: '维修类型', values: '普通维修、外协维修、厂家维修', count: 3, updater: '王强', updateDate: '2026-06-18' },
  { category: '设备部位', values: '主轴、冷却系统、液压泵、控制面板、传动系统、刀片', count: 6, updater: '陈晨', updateDate: '2026-08-12' },
];

export const netConfigs = [
  { device: 'MT2024A1201', gateway: 'GW-01', protocol: 'Modbus TCP', ip: '192.168.10.101', port: 502, cycle: '1 s', lastHeartbeat: '16:41:08', status: '在线' },
  { device: 'MT2024A1202', gateway: 'GW-01', protocol: 'Modbus TCP', ip: '192.168.10.102', port: 502, cycle: '2 s', lastHeartbeat: '16:38:22', status: '延迟' },
  { device: 'MT2024A1203', gateway: 'GW-03', protocol: 'REST', ip: '192.168.10.103', port: 8080, cycle: '5 s', lastHeartbeat: '16:41:05', status: '在线' },
  { device: 'MT2024A1206', gateway: 'GW-04', protocol: 'OPC UA', ip: '192.168.10.104', port: 4840, cycle: '1 s', lastHeartbeat: '16:41:07', status: '在线' },
  { device: 'MT2024A1207', gateway: 'GW-05', protocol: 'MQTT', ip: '192.168.10.105', port: 1883, cycle: '1 s', lastHeartbeat: '15:22:30', status: '离线' },
];

// ===== 数据接入 · 平台指标清单（IoT 平台只读同步，含版本与失效标记；对应 metric_definition_version） =====
export const platformMetrics = [
  { metricCode: 'M.spindle_temp', metricVersion: 'v1.2', name: '主轴温度', unit: '℃', dataType: '数值', precision: 0.1, range: '0 ~ 150', syncStatus: '正常', lastSyncTime: '2026-09-04 06:00' },
  { metricCode: 'M.coolant_temp', metricVersion: 'v1.2', name: '冷却液温度', unit: '℃', dataType: '数值', precision: 0.1, range: '0 ~ 80', syncStatus: '正常', lastSyncTime: '2026-09-04 06:00' },
  { metricCode: 'M.spindle_speed', metricVersion: 'v1.1', name: '主轴转速', unit: 'rpm', dataType: '数值', precision: 1, range: '0 ~ 12000', syncStatus: '正常', lastSyncTime: '2026-09-04 06:00' },
  { metricCode: 'M.feed_rate', metricVersion: 'v1.1', name: '进给速度', unit: 'mm/min', dataType: '数值', precision: 1, range: '0 ~ 30000', syncStatus: '正常', lastSyncTime: '2026-09-04 06:00' },
  { metricCode: 'M.vib_amplitude', metricVersion: 'v2.0', name: '振动幅值', unit: 'mm/s', dataType: '数值', precision: 0.01, range: '0 ~ 50', syncStatus: '正常', lastSyncTime: '2026-09-04 06:00' },
  { metricCode: 'M.bearing_temp', metricVersion: 'v1.0', name: '轴承温度', unit: '℃', dataType: '数值', precision: 0.1, range: '0 ~ 120', syncStatus: '正常', lastSyncTime: '2026-09-04 06:00' },
  { metricCode: 'M.ambient_humidity', metricVersion: 'v1.0', name: '环境湿度', unit: '%RH', dataType: '数值', precision: 1, range: '0 ~ 100', syncStatus: '已失效', lastSyncTime: '2026-08-28 06:00' },
  { metricCode: 'S.machine_state', metricVersion: 'v1.3', name: '设备状态', unit: '--', dataType: '状态', precision: '--', range: '运行/待机/停机/报警', syncStatus: '正常', lastSyncTime: '2026-09-04 06:00' },
  { metricCode: 'S.alarm_code', metricVersion: 'v1.3', name: '报警代码', unit: '--', dataType: '事件', precision: '--', range: 'PLC 报警表', syncStatus: '正常', lastSyncTime: '2026-09-04 06:00' },
  { metricCode: 'M.air_pressure', metricVersion: 'v1.0', name: '气源压力', unit: 'MPa', dataType: '数值', precision: 0.01, range: '0 ~ 1.0', syncStatus: '正常', lastSyncTime: '2026-09-04 06:00' },
  { metricCode: 'M.motor_current', metricVersion: 'v1.1', name: '电机电流', unit: 'A', dataType: '数值', precision: 0.1, range: '0 ~ 60', syncStatus: '正常', lastSyncTime: '2026-09-04 06:00' },
  { metricCode: 'M.oil_pressure', metricVersion: 'v1.0', name: '润滑油压', unit: 'MPa', dataType: '数值', precision: 0.01, range: '0 ~ 0.6', syncStatus: '正常', lastSyncTime: '2026-09-04 06:00' },
];

// ===== 数据接入 · 设备绑定关系（对应 device_binding / device_binding_item / device_binding_metric） =====
// configStatus: 待配置/已启用/已停用（配置状态）；healthStatus: 正常/部分中断/数据中断/延迟（健康状态，不覆盖配置状态）
const m = (code) => {
  const def = platformMetrics.find(x => x.metricCode === code);
  return { metricCode: code, metricVersion: def.metricVersion, name: def.name, unit: def.unit, dataType: def.dataType, syncStatus: def.syncStatus, monitored: true };
};
const mOff = (code) => ({ ...m(code), monitored: false });

export const netBindings = [
  {
    code: 'MT2024A1201', deviceName: '数控车床', version: 3, configStatus: '已启用', healthStatus: '正常',
    effectiveFrom: '2026-06-01 09:00', pullCycleSec: 60, lastPullTime: '2026-09-04 16:41:10', pullFailCount: 0, pendingCompensation: 0,
    items: [
      { iotDeviceCode: 'IOT-D-10001', iotDeviceId: '10001', role: 'main', sensorType: '--', enabled: true, metrics: [m('M.spindle_temp'), m('M.coolant_temp'), m('M.spindle_speed'), m('M.feed_rate'), m('S.machine_state'), m('S.alarm_code')] },
      { iotDeviceCode: 'IOT-S-20011', iotDeviceId: '20011', role: 'sensor', sensorType: '振动传感器', enabled: true, metrics: [m('M.vib_amplitude'), mOff('M.bearing_temp')] },
      { iotDeviceCode: 'IOT-S-20012', iotDeviceId: '20012', role: 'sensor', sensorType: '温度传感器', enabled: true, metrics: [m('M.bearing_temp')] },
    ],
  },
  {
    code: 'MT2024A1203', deviceName: '立式加工中心', version: 1, configStatus: '已启用', healthStatus: '部分中断',
    effectiveFrom: '2026-07-15 14:00', pullCycleSec: 60, lastPullTime: '2026-09-04 16:40:55', pullFailCount: 1, pendingCompensation: 2,
    items: [
      { iotDeviceCode: 'IOT-D-10003', iotDeviceId: '10003', role: 'main', sensorType: '--', enabled: true, metrics: [m('M.spindle_temp'), m('M.spindle_speed'), m('S.machine_state')] },
      { iotDeviceCode: 'IOT-S-20031', iotDeviceId: '20031', role: 'sensor', sensorType: '振动传感器', enabled: true, metrics: [m('M.vib_amplitude')] },
      { iotDeviceCode: 'IOT-S-20032', iotDeviceId: '20032', role: 'sensor', sensorType: '温度传感器', enabled: false, metrics: [m('M.bearing_temp')] },
    ],
  },
  {
    code: 'MT2024A1206', deviceName: '空压机', version: 2, configStatus: '已启用', healthStatus: '正常',
    effectiveFrom: '2026-08-01 08:30', pullCycleSec: 300, lastPullTime: '2026-09-04 16:40:02', pullFailCount: 0, pendingCompensation: 0,
    items: [
      { iotDeviceCode: 'IOT-D-10006', iotDeviceId: '10006', role: 'main', sensorType: '--', enabled: true, metrics: [m('M.air_pressure'), m('M.motor_current'), m('S.machine_state')] },
    ],
  },
  {
    code: 'MT2024A1207', deviceName: '数控磨床', version: 1, configStatus: '已启用', healthStatus: '数据中断',
    effectiveFrom: '2026-05-20 10:00', pullCycleSec: 60, lastPullTime: '2026-09-04 15:22:30', pullFailCount: 3, pendingCompensation: 5,
    items: [
      { iotDeviceCode: 'IOT-D-10007', iotDeviceId: '10007', role: 'main', sensorType: '--', enabled: true, metrics: [m('M.spindle_speed'), m('M.oil_pressure'), m('S.machine_state')] },
    ],
  },
  {
    code: 'MT2024A1202', deviceName: '数控车床', version: 1, configStatus: '已停用', healthStatus: '--',
    effectiveFrom: '2026-03-10 09:00', pullCycleSec: 60, lastPullTime: '2026-08-30 18:00:00', pullFailCount: 0, pendingCompensation: 0,
    items: [
      { iotDeviceCode: 'IOT-D-10002', iotDeviceId: '10002', role: 'main', sensorType: '--', enabled: false, metrics: [mOff('M.spindle_temp'), mOff('M.spindle_speed'), mOff('S.machine_state')] },
    ],
  },
];

// 设备联网状态：已绑定的取绑定健康/配置状态，未绑定=未配置（设备台账「联网状态」列使用）
export function getNetStatus(code) {
  const b = netBindings.find(x => x.code === code);
  if (!b) return { status: '未配置', color: 'default', health: '--' };
  if (b.configStatus === '已停用') return { status: '已停用', color: 'warning', health: '--' };
  const color = { 正常: 'success', 部分中断: 'warning', 数据中断: 'error', 延迟: 'processing' }[b.healthStatus] || 'default';
  return { status: '已接入', color, health: b.healthStatus };
}

export const workbenchTodos = [
  { id: 1, type: '维修任务', title: '数控车床主轴异响维修（紧急报修）', urgent: true, owner: '周强', due: '今日 16:00', route: '/repair-pending' },
  { id: 2, type: '点检任务', title: '数控车床日常点检（今日）', urgent: false, owner: '李四', due: '今日 18:00', route: '/inspection-tasks' },
  { id: 3, type: '保养任务', title: '激光焊接机二级保养（厂家到场）', urgent: false, owner: '厂家工程师', due: '明日全天', route: '/maintenance-tasks' },
  { id: 4, type: '巡检任务', title: '一号车间日常巡检', urgent: false, owner: '李四', due: '今日 17:00', route: '/patrol-tasks' },
  { id: 5, type: '报警确认', title: 'CNC-02 冷却液温度超限确认', urgent: true, owner: '赵艳', due: '立即', route: '/alarm-center' },
];
