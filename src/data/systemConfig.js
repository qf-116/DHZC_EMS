// ============================================================
// 基础配置模块演示种子（用户 / 角色 / 组织机构 / 字典 / 日志）
// 系统从宿主平台拆分为独立系统后自建的基础配置域：
//   - 只读种子数据 + 页面内演示交互（新增/编辑/删除页面内生效，不写入 DemoStore）
//   - 时间口径与演示基准日一致（2026-09-16 前后），禁用 Date.now()
// ============================================================

// ---------- 用户管理 ----------
// deptPath：组织机构路径（与 sysOrgTree 的层级一致），部门归属按前缀匹配
export const sysUsers = [
  { userId: 'U0001', account: 'liming', name: '李明', deptPath: ['设备部', '设备管理科'], roles: ['系统管理员'], phone: '13801234567', email: 'liming@dhzc.com', status: '正常', lastLoginTime: '2026-09-16 08:21:04', createTime: '2026-01-06 09:00:00', remark: '平台拆分后首任系统管理员' },
  { userId: 'U0002', account: 'wangjianguo', name: '王建国', deptPath: ['设备部'], roles: ['设备管理员'], phone: '13907654321', email: 'wangjg@dhzc.com', status: '正常', lastLoginTime: '2026-09-16 07:58:36', createTime: '2026-01-06 09:12:00', remark: '设备部负责人' },
  { userId: 'U0003', account: 'zhangwei', name: '张伟', deptPath: ['设备部', '维修科'], roles: ['维修工程师'], phone: '13712345678', email: 'zhangwei@dhzc.com', status: '正常', lastLoginTime: '2026-09-16 08:05:12', createTime: '2026-01-08 10:30:00', remark: null },
  { userId: 'U0004', account: 'liuyang', name: '刘洋', deptPath: ['生产部', '一车间'], roles: ['点检保养专员'], phone: '13623456789', email: 'liuyang@dhzc.com', status: '正常', lastLoginTime: '2026-09-15 16:42:51', createTime: '2026-01-10 14:20:00', remark: null },
  { userId: 'U0005', account: 'chenjing', name: '陈静', deptPath: ['生产部'], roles: ['报表分析员'], phone: '13534567890', email: 'chenjing@dhzc.com', status: '正常', lastLoginTime: '2026-09-16 09:11:27', createTime: '2026-02-01 11:00:00', remark: '生产部运行报表负责人' },
  { userId: 'U0006', account: 'zhaolei', name: '赵磊', deptPath: ['设备部', '电气科'], roles: ['维修工程师'], phone: '13445678901', email: 'zhaolei@dhzc.com', status: '正常', lastLoginTime: '2026-09-14 18:33:09', createTime: '2026-02-03 09:40:00', remark: null },
  { userId: 'U0007', account: 'sunqian', name: '孙倩', deptPath: ['生产部', '一车间'], roles: ['只读访客'], phone: '13356789012', email: 'sunqian@dhzc.com', status: '正常', lastLoginTime: '2026-09-13 08:02:44', createTime: '2026-03-15 15:05:00', remark: '车间看板账号' },
  { userId: 'U0008', account: 'zhouqiang', name: '周强', deptPath: ['生产部', '二车间'], roles: ['生产主管', '点检保养专员'], phone: '13267890123', email: 'zhouqiang@dhzc.com', status: '正常', lastLoginTime: '2026-09-16 07:46:15', createTime: '2026-03-20 10:10:00', remark: null },
  { userId: 'U0009', account: 'wumin', name: '吴敏', deptPath: ['信息部'], roles: ['系统管理员'], phone: '13178901234', email: 'wumin@dhzc.com', status: '正常', lastLoginTime: '2026-09-16 08:30:00', createTime: '2026-04-02 16:45:00', remark: '数据库与账号运维' },
  { userId: 'U0010', account: 'zhenghao', name: '郑浩', deptPath: ['采购部'], roles: ['报表分析员'], phone: '13089012345', email: 'zhenghao@dhzc.com', status: '停用', lastLoginTime: '2026-08-28 17:12:30', createTime: '2026-04-11 13:25:00', remark: '离职待归档（2026-08-31 起）' },
  { userId: 'U0011', account: 'heli', name: '何丽', deptPath: ['行政人事部'], roles: ['只读访客'], phone: '12990123456', email: 'heli@dhzc.com', status: '正常', lastLoginTime: '2026-09-12 11:20:18', createTime: '2026-05-06 09:05:00', remark: null },
  { userId: 'U0012', account: 'qianfeng', name: '钱锋', deptPath: ['质量部'], roles: ['点检保养专员'], phone: '13811223344', email: 'qianfeng@dhzc.com', status: '正常', lastLoginTime: '2026-09-15 09:55:03', createTime: '2026-06-18 14:50:00', remark: null },
];

// ---------- 角色管理 ----------
// menuKeys：分配权限弹窗中勾中的功能点 key（与 sysPermissionTree 一致）
export const sysRoles = [
  { roleId: 'R001', code: 'SYS_ADMIN', name: '系统管理员', dataScope: '全部数据权限', status: '已启用', userCount: 2, remark: '基础配置模块全部权限，负责账号/角色/字典/日志治理', menuKeys: ['perm:system:all'], createTime: '2026-01-06 09:00:00' },
  { roleId: 'R002', code: 'DEVICE_ADMIN', name: '设备管理员', dataScope: '本部门及以下', status: '已启用', userCount: 1, remark: '台账/报警规则/维修派工/备件管理', menuKeys: ['menu:workbench', 'menu:device-ledger', 'menu:doc-library', 'menu:base-type-config', 'menu:alarm-center', 'menu:alarm-rules', 'menu:repair-pending', 'menu:repair-reports', 'menu:repair-orders', 'menu:spare-parts-stock', 'menu:report-runtime', 'menu:report:repair'], createTime: '2026-01-06 09:30:00' },
  { roleId: 'R003', code: 'REPAIR_ENG', name: '维修工程师', dataScope: '本部门', status: '已启用', userCount: 2, remark: '接单/执行/验收，只读台账', menuKeys: ['menu:workbench', 'menu:repair-orders', 'menu:repair-knowledge', 'menu:spare-parts-outbound'], createTime: '2026-01-08 10:30:00' },
  { roleId: 'R004', code: 'INSPECTOR', name: '点检保养专员', dataScope: '本部门及以下', status: '已启用', userCount: 3, remark: '点检/保养/巡检执行与记录', menuKeys: ['menu:workbench', 'menu:inspection-tasks', 'menu:maintenance-tasks', 'menu:patrol-tasks', 'menu:repair-reports'], createTime: '2026-01-10 14:20:00' },
  { roleId: 'R005', code: 'ANALYST', name: '报表分析员', dataScope: '全部数据权限', status: '已启用', userCount: 2, remark: '报表中心全部报表只读 + 导出', menuKeys: ['menu:workbench', 'menu:report-runtime', 'menu:report:production', 'menu:report:mttr', 'menu:report:comprehensive', 'menu:report:alarm', 'menu:report:quality', 'menu:report:sparepart'], createTime: '2026-02-01 11:00:00' },
  { roleId: 'R006', code: 'VIEWER', name: '只读访客', dataScope: '仅本人数据', status: '已启用', userCount: 2, remark: '监测总览/实时监控只读，无操作权限', menuKeys: ['menu:workbench', 'menu:monitor-overview', 'menu:realtime'], createTime: '2026-03-15 15:05:00' },
];

// ---------- 组织机构（部门树） ----------
// key 与 deptPath 节点一致；memberCount 由页面按用户 deptPath 前缀实时推导
export const sysOrgTree = [
  { key: 'DHZC', title: '东浩智创制造有限公司', leader: '董事长办公室', phone: '0512-6688 0001', sort: 1, status: '启用', remark: '集团根组织，不允许删除' },
  { key: '生产部', parent: 'DHZC', title: '生产部', leader: '周强', phone: '0512-6688 0101', sort: 1, status: '启用', remark: null },
  { key: '生产部/一车间', parent: '生产部', title: '一车间', leader: '刘洋', phone: '0512-6688 0102', sort: 1, status: '启用', remark: null },
  { key: '生产部/二车间', parent: '生产部', title: '二车间', leader: '周强', phone: '0512-6688 0103', sort: 2, status: '启用', remark: null },
  { key: '设备部', parent: 'DHZC', title: '设备部', leader: '王建国', phone: '0512-6688 0201', sort: 2, status: '启用', remark: '设备管理主责部门' },
  { key: '设备部/设备管理科', parent: '设备部', title: '设备管理科', leader: '李明', phone: '0512-6688 0202', sort: 1, status: '启用', remark: null },
  { key: '设备部/维修科', parent: '设备部', title: '维修科', leader: '张伟', phone: '0512-6688 0203', sort: 2, status: '启用', remark: null },
  { key: '设备部/电气科', parent: '设备部', title: '电气科', leader: '赵磊', phone: '0512-6688 0204', sort: 3, status: '启用', remark: null },
  { key: '质量部', parent: 'DHZC', title: '质量部', leader: '钱锋', phone: '0512-6688 0301', sort: 3, status: '启用', remark: null },
  { key: '采购部', parent: 'DHZC', title: '采购部', leader: '郑浩', phone: '0512-6688 0401', sort: 4, status: '停用', remark: '采购业务已切回 SRM 系统（2026-08-31）' },
  { key: '信息部', parent: 'DHZC', title: '信息部', leader: '吴敏', phone: '0512-6688 0501', sort: 5, status: '启用', remark: null },
  { key: '行政人事部', parent: 'DHZC', title: '行政人事部', leader: '何丽', phone: '0512-6688 0601', sort: 6, status: '启用', remark: null },
];

// ---------- 字典管理 ----------
// dictType：字典类型；entries：字典项（label/value 均唯一）
export const sysDictTypes = [
  { typeCode: 'device_status', typeName: '设备运行状态', remark: '运行监测/台账状态轴口径', status: '已启用', updateTime: '2026-09-10 10:12:00', updater: '李明' },
  { typeCode: 'alarm_level', typeName: '报警级别', remark: '报警规则配置与通知策略共用', status: '已启用', updateTime: '2026-09-08 15:40:00', updater: '王建国' },
  { typeCode: 'repair_source', typeName: '报修来源', remark: '报修单 source 字段枚举', status: '已启用', updateTime: '2026-08-30 09:20:00', updater: '王建国' },
  { typeCode: 'user_status', typeName: '用户状态', remark: '基础配置·用户管理', status: '已启用', updateTime: '2026-09-14 11:05:00', updater: '吴敏' },
  { typeCode: 'data_scope', typeName: '数据权限范围', remark: '基础配置·角色数据范围', status: '已启用', updateTime: '2026-09-14 11:08:00', updater: '吴敏' },
  { typeCode: 'login_result', typeName: '登录结果', remark: '基础配置·登录日志', status: '已启用', updateTime: '2026-09-14 11:10:00', updater: '吴敏' },
];

export const sysDictEntries = {
  device_status: [
    { entryId: 'DS01', label: '运行', value: 'RUN', sort: 1, status: '已启用', remark: null },
    { entryId: 'DS02', label: '待机', value: 'IDLE', sort: 2, status: '已启用', remark: null },
    { entryId: 'DS03', label: '计划停机', value: 'PLAN_STOP', sort: 3, status: '已启用', remark: null },
    { entryId: 'DS04', label: '故障', value: 'FAULT', sort: 4, status: '已启用', remark: null },
    { entryId: 'DS05', label: '无数据', value: 'NO_DATA', sort: 5, status: '已启用', remark: '设备离线时显示，不等于停机' },
  ],
  alarm_level: [
    { entryId: 'AL01', label: '提醒', value: 'INFO', sort: 1, status: '已启用', remark: '仅记录，不通知' },
    { entryId: 'AL02', label: '警告', value: 'WARN', sort: 2, status: '已启用', remark: '工作台待办 + 站内通知' },
    { entryId: 'AL03', label: '严重', value: 'CRITICAL', sort: 3, status: '已启用', remark: '短信/电话通知值班工程师' },
  ],
  repair_source: [
    { entryId: 'RS01', label: '操作员报修', value: 'MANUAL', sort: 1, status: '已启用', remark: null },
    { entryId: 'RS02', label: '报警自动生成', value: 'ALARM_AUTO', sort: 2, status: '已启用', remark: '严重报警触发，禁止人工撤单' },
    { entryId: 'RS03', label: '点检发现', value: 'INSPECT', sort: 3, status: '已启用', remark: null },
    { entryId: 'RS04', label: '保养发现', value: 'MAINTAIN', sort: 4, status: '已启用', remark: null },
  ],
  user_status: [
    { entryId: 'US01', label: '正常', value: 'NORMAL', sort: 1, status: '已启用', remark: null },
    { entryId: 'US02', label: '停用', value: 'DISABLED', sort: 2, status: '已启用', remark: '停用后立即无法登录' },
  ],
  data_scope: [
    { entryId: 'SC01', label: '全部数据权限', value: 'ALL', sort: 1, status: '已启用', remark: null },
    { entryId: 'SC02', label: '本部门及以下', value: 'DEPT_AND_CHILD', sort: 2, status: '已启用', remark: '按组织机构树向下过滤' },
    { entryId: 'SC03', label: '本部门', value: 'DEPT_ONLY', sort: 3, status: '已启用', remark: null },
    { entryId: 'SC04', label: '仅本人数据', value: 'SELF', sort: 4, status: '已启用', remark: null },
  ],
  login_result: [
    { entryId: 'LR01', label: '成功', value: 'SUCCESS', sort: 1, status: '已启用', remark: null },
    { entryId: 'LR02', label: '失败', value: 'FAIL', sort: 2, status: '已启用', remark: '记录失败原因（密码错误/账号停用等）' },
  ],
};

// ---------- 登录日志 ----------
export const sysLoginLogs = [
  { logId: 'LOGIN-20260916-001', userName: '李明', account: 'liming', dept: '设备部/设备管理科', ip: '192.168.10.21', location: '厂区办公网', browser: 'Chrome 128', os: 'Windows 11', result: '成功', message: '登录成功', time: '2026-09-16 08:21:04' },
  { logId: 'LOGIN-20260916-002', userName: '王建国', account: 'wangjianguo', dept: '设备部', ip: '192.168.10.35', location: '厂区办公网', browser: 'Chrome 128', os: 'Windows 10', result: '成功', message: '登录成功', time: '2026-09-16 07:58:36' },
  { logId: 'LOGIN-20260916-003', userName: '张伟', account: 'zhangwei', dept: '设备部/维修科', ip: '192.168.20.14', location: '维修科现场终端', browser: 'Edge 127', os: 'Windows 10', result: '成功', message: '登录成功', time: '2026-09-16 08:05:12' },
  { logId: 'LOGIN-20260916-004', userName: '陈静', account: 'chenjing', dept: '生产部', ip: '192.168.10.66', location: '厂区办公网', browser: 'Chrome 127', os: 'Windows 11', result: '成功', message: '登录成功', time: '2026-09-16 09:11:27' },
  { logId: 'LOGIN-20260916-005', userName: '吴敏', account: 'wumin', dept: '信息部', ip: '192.168.30.08', location: '机房运维网', browser: 'Firefox 129', os: 'Ubuntu 22.04', result: '成功', message: '登录成功', time: '2026-09-16 08:30:00' },
  { logId: 'LOGIN-20260916-006', userName: '李明', account: 'liming', dept: '设备部/设备管理科', ip: '10.89.4.12', location: '外网 VPN', browser: 'Chrome 128', os: 'macOS 14', result: '失败', message: '密码错误（第 1 次，连续 5 次将锁定 30 分钟）', time: '2026-09-16 08:15:47' },
  { logId: 'LOGIN-20260916-007', userName: '郑浩', account: 'zhenghao', dept: '采购部', ip: '192.168.10.77', location: '厂区办公网', browser: 'Chrome 126', os: 'Windows 10', result: '失败', message: '账号已停用，禁止登录', time: '2026-09-16 08:40:21' },
  { logId: 'LOGIN-20260916-008', userName: '刘洋', account: 'liuyang', dept: '生产部/一车间', ip: '192.168.40.31', location: '一车间看板终端', browser: 'Chrome 127', os: 'Windows 10', result: '成功', message: '登录成功', time: '2026-09-15 16:42:51' },
  { logId: 'LOGIN-20260916-009', userName: '周强', account: 'zhouqiang', dept: '生产部/二车间', ip: '192.168.40.55', location: '二车间办公网', browser: 'Edge 127', os: 'Windows 11', result: '成功', message: '登录成功', time: '2026-09-16 07:46:15' },
  { logId: 'LOGIN-20260916-010', userName: '孙倩', account: 'sunqian', dept: '生产部/一车间', ip: '192.168.40.32', location: '一车间看板终端', browser: 'Chrome 125', os: 'Windows 10', result: '成功', message: '登录成功', time: '2026-09-13 08:02:44' },
  { logId: 'LOGIN-20260916-011', userName: '赵磊', account: 'zhaolei', dept: '设备部/电气科', ip: '192.168.20.42', location: '维修科现场终端', browser: 'Edge 126', os: 'Windows 10', result: '成功', message: '登录成功', time: '2026-09-14 18:33:09' },
  { logId: 'LOGIN-20260916-012', userName: '钱锋', account: 'qianfeng', dept: '质量部', ip: '192.168.10.90', location: '厂区办公网', browser: 'Chrome 127', os: 'Windows 11', result: '成功', message: '登录成功', time: '2026-09-15 09:55:03' },
  { logId: 'LOGIN-20260916-013', userName: '何丽', account: 'heli', dept: '行政人事部', ip: '192.168.10.103', location: '厂区办公网', browser: 'Chrome 127', os: 'Windows 11', result: '成功', message: '登录成功', time: '2026-09-12 11:20:18' },
];

// ---------- 系统操作日志 ----------
export const sysOperationLogs = [
  { logId: 'OPT-20260916-001', userName: '王建国', dept: '设备部', module: '报警中心', type: '修改', content: '修改报警规则 ALR-012（主轴温度上限 75℃ → 78℃）并发布新版本 v3', ip: '192.168.10.35', result: '成功', costMs: 132, time: '2026-09-16 10:02:33' },
  { logId: 'OPT-20260916-002', userName: '李明', dept: '设备部/设备管理科', module: '设备台账', type: '新增', content: '新增设备 DEV-008（机器人焊接-08，资产编码 MT2024A1208）', ip: '192.168.10.21', result: '成功', costMs: 205, time: '2026-09-16 09:47:10' },
  { logId: 'OPT-20260916-003', userName: '张伟', dept: '设备部/维修科', module: '维修管理', type: '状态流转', content: '维修单 WX-20260916-003 派工给 赵磊', ip: '192.168.20.14', result: '成功', costMs: 98, time: '2026-09-16 09:30:55' },
  { logId: 'OPT-20260916-004', userName: '李明', dept: '设备部/设备管理科', module: '基础配置', type: '分配权限', content: '角色「点检保养专员」重新分配功能权限（勾选 报修上报）', ip: '192.168.10.21', result: '成功', costMs: 76, time: '2026-09-16 09:12:48' },
  { logId: 'OPT-20260916-005', userName: '吴敏', dept: '信息部', module: '基础配置', type: '重置密码', content: '重置用户 sunqian 的登录密码', ip: '192.168.30.08', result: '成功', costMs: 61, time: '2026-09-16 08:41:02' },
  { logId: 'OPT-20260916-006', userName: '吴敏', dept: '信息部', module: '基础配置', type: '新增', content: '新增角色「报表分析员」（数据范围：全部数据权限）', ip: '192.168.30.08', result: '成功', costMs: 88, time: '2026-09-15 17:26:40' },
  { logId: 'OPT-20260916-007', userName: '陈静', dept: '生产部', module: '报表中心', type: '导出', content: '导出《运行时长与设备状态统计》Excel（时间范围 09-01 ~ 09-15）', ip: '192.168.10.66', result: '成功', costMs: 1540, time: '2026-09-16 09:25:17' },
  { logId: 'OPT-20260916-008', userName: '李明', dept: '设备部/设备管理科', module: '基础配置', type: '修改', content: '字典「设备运行状态」新增字典项 无数据（NO_DATA）', ip: '192.168.10.21', result: '成功', costMs: 54, time: '2026-09-14 14:08:29' },
  { logId: 'OPT-20260916-009', userName: '王建国', dept: '设备部', module: '备品备件', type: '新增', content: '备件入库单 RK-20260913-002（轴承 120004 ×2 入库）', ip: '192.168.10.35', result: '成功', costMs: 173, time: '2026-09-13 15:40:06' },
  { logId: 'OPT-20260916-010', userName: '刘洋', dept: '生产部/一车间', module: '点检管理', type: '新增', content: '新增点检任务 XJRW20260916002（DEV-001 日检）', ip: '192.168.40.31', result: '成功', costMs: 121, time: '2026-09-15 08:15:44' },
  { logId: 'OPT-20260916-011', userName: '李明', dept: '设备部/设备管理科', module: '数据接入', type: '修改', content: '设备 DEV-005 重新绑定 IoT 设备（原绑定已失效）', ip: '192.168.10.21', result: '失败', costMs: 2100, message: 'IoT 平台校验不通过：设备编码已被其它租户占用', time: '2026-09-15 16:52:31' },
  { logId: 'OPT-20260916-012', userName: '周强', dept: '生产部/二车间', module: 'OEE', type: '修改', content: '修改 DEV-007 理想生产速度（1200 件/h → 1350 件/h）', ip: '192.168.40.55', result: '成功', costMs: 67, time: '2026-09-14 11:33:20' },
  { logId: 'OPT-20260916-013', userName: '吴敏', dept: '信息部', module: '基础配置', type: '修改', content: '停用部门「采购部」（业务切回 SRM 系统）', ip: '192.168.30.08', result: '成功', costMs: 45, time: '2026-09-01 10:05:12' },
  { logId: 'OPT-20260916-014', userName: '何丽', dept: '行政人事部', module: '基础配置', type: '新增', content: '新增用户 heli（行政人事部，角色：只读访客）', ip: '192.168.10.103', result: '成功', costMs: 59, time: '2026-09-01 09:18:55' },
];

// ---------- 功能权限树（角色管理 · 分配权限弹窗） ----------
// key 约定：menu:* 为菜单/页面级权限；perm:system:* 为基础配置操作级权限
export const sysPermissionTree = [
  { title: '工作台', key: 'menu:workbench' },
  { title: '设备资产', key: 'group:asset', children: [
    { title: '设备台账', key: 'menu:device-ledger' },
    { title: '综合文档库', key: 'menu:doc-library' },
    { title: '基础类型配置', key: 'menu:base-type-config' },
  ] },
  { title: '生命周期管理', key: 'group:lifecycle', children: [
    { title: '生命周期工作台', key: 'menu:lifecycle-workbench' },
    { title: '设备入账 / 变更 / 闲置 / 报废', key: 'menu:lifecycle-tasks' },
  ] },
  { title: '点检管理', key: 'group:inspection', children: [
    { title: '点检项目 / 标准', key: 'menu:inspection-base' },
    { title: '点检计划 / 任务', key: 'menu:inspection-tasks' },
  ] },
  { title: '保养管理', key: 'group:maintenance', children: [
    { title: '保养项目 / 标准', key: 'menu:maintenance-base' },
    { title: '保养计划 / 任务', key: 'menu:maintenance-tasks' },
  ] },
  { title: '巡检管理', key: 'group:patrol', children: [
    { title: '巡检项目 / 标准', key: 'menu:patrol-base' },
    { title: '巡检计划 / 任务', key: 'menu:patrol-tasks' },
  ] },
  { title: '维修管理', key: 'group:repair', children: [
    { title: '待维修', key: 'menu:repair-pending' },
    { title: '故障报修', key: 'menu:repair-reports' },
    { title: '维修任务', key: 'menu:repair-orders' },
    { title: '维修经验库', key: 'menu:repair-knowledge' },
  ] },
  { title: '备品备件', key: 'group:spare', children: [
    { title: '备件台账', key: 'menu:spare-parts-stock' },
    { title: '入库 / 出库记录', key: 'menu:spare-parts-io' },
  ] },
  { title: '数据接入', key: 'group:data', children: [
    { title: '物联网接入配置', key: 'menu:binding-overview' },
    { title: '平台指标清单', key: 'menu:platform-metrics' },
    { title: '程序参数比对', key: 'menu:program-compare' },
  ] },
  { title: '运行监测', key: 'group:monitor', children: [
    { title: '监测总览', key: 'menu:monitor-overview' },
    { title: '实时监控', key: 'menu:realtime' },
    { title: 'OEE（实时 / 历史）', key: 'menu:oee' },
    { title: '计划停机时间管理', key: 'menu:planned-downtime' },
  ] },
  { title: '报警中心', key: 'group:alarm', children: [
    { title: '报警中心', key: 'menu:alarm-center' },
    { title: '报警规则配置', key: 'menu:alarm-rules' },
    { title: '通知策略配置', key: 'menu:notification-policy' },
  ] },
  { title: '报表中心', key: 'group:report', children: [
    { title: '运行 / 产量 / MTTR·MTBF / 综合', key: 'menu:report-runtime' },
    { title: '报警 / 质量 / 程序比对统计', key: 'menu:report:alarm' },
    { title: '维修 / 备件管理统计', key: 'menu:report:repair' },
    { title: '点检 / 保养 / 巡检执行统计', key: 'menu:report:inspection' },
  ] },
  { title: '基础配置', key: 'group:system', children: [
    { title: '用户管理（查看 / 新增 / 修改 / 删除 / 重置密码 / 启停用）', key: 'menu:system-users' },
    { title: '角色管理（查看 / 新增 / 修改 / 删除 / 分配权限）', key: 'menu:system-roles' },
    { title: '组织机构（查看 / 新增 / 修改 / 删除）', key: 'menu:system-org' },
    { title: '字典管理（查看 / 新增 / 修改 / 删除）', key: 'menu:system-dict' },
    { title: '日志管理（查看 / 导出 / 清空）', key: 'menu:system-logs' },
    { title: '全部基础配置操作权限（超管勾选，覆盖以上全部动作）', key: 'perm:system:all' },
  ] },
];
