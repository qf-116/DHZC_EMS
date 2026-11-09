// ============================================================
// 备件（SpareStock / Inbound / Outbound / Return / Reservation）初始快照；§3.2
// 口径：现存 = 在库实物；预留 = 工单锁定；可用 = 现存 − 预留；单位不得统一写「件」
// ============================================================

export const warehouses = [
  { warehouseId: '备品备件仓库', name: '备品备件仓库' },
  { warehouseId: '仓库二', name: '仓库二' },
];

// 备件档案（原型「备品备件管理」列表列口径）：
// 名称/编号/规格型号/品牌/供应商/供应商联系人/供应商联系电话/现存量/寿命时长（天）/
// 安全库存数量/最高库存上限/单位/货期（天）/用途/备注/创建时间/更新时间/更新人
// 安全库存数量与最高库存上限是「备件档案级」配置（现存量为所有仓库合计），库存页据此判水位。
export const spares = [
  { code: '120001', name: '备件一', spec: '12*12*6', brand: '品牌一', unit: '个', life: 600, safe: 400, max: 1000, supplier: '供应商一', contact: '王五', phone: '13888888888', leadTime: 15, usage: '--', remark: '--', createTime: '2025-03-31 12:00:00', updateTime: '2025-03-31 12:00:00', updater: '张三' },
  { code: '120002', name: '备件二', spec: '12*12*6', brand: '--', unit: '千克', life: 400, safe: 400, max: 1000, supplier: '供应商一', contact: '王五', phone: '13888888888', leadTime: 15, usage: '--', remark: '--', createTime: '2025-03-31 12:00:00', updateTime: '2025-03-31 12:00:00', updater: '李四' },
  { code: '120003', name: '备件三', spec: '12*12*6', brand: '--', unit: '米', life: 400, safe: 400, max: 1000, supplier: '供应商一', contact: '王五', phone: '13888888888', leadTime: 15, usage: '--', remark: '--', createTime: '2025-03-31 12:00:00', updateTime: '2025-03-31 12:00:00', updater: '王五' },
  { code: '120004', name: '备件四', spec: '12*12*6', brand: '品牌一', unit: '个', life: 400, safe: 400, max: 1000, supplier: '供应商一', contact: '王五', phone: '13888888888', leadTime: 15, usage: '--', remark: '--', createTime: '2025-03-31 12:00:00', updateTime: '2025-03-31 12:00:00', updater: '赵六' },
  { code: '120005', name: '备件五', spec: '12*12*6', brand: '品牌二', unit: '个', life: 400, safe: 400, max: 1000, supplier: '供应商一', contact: '王五', phone: '13888888888', leadTime: 15, usage: '--', remark: '--', createTime: '2025-03-31 12:00:00', updateTime: '2025-03-31 12:00:00', updater: '唐七' },
  { code: '120006', name: '空压机滤芯', spec: '2901-x', brand: '阿特拉斯', unit: '个', life: 90, safe: 40, max: 120, supplier: '供应商二', contact: '周强', phone: '13888888888', leadTime: 15, usage: '空压机三级保养用', remark: '空压机三级保养用', createTime: '2025-03-31 12:00:00', updateTime: '2026-08-10 09:00:00', updater: '王五' },
];

// stockKey = `${warehouseId}|${spareCode}`
export const stock = [
  { stockKey: '备品备件仓库|120001', warehouseId: '备品备件仓库', spareCode: '120001', onHand: 799, reserved: 100, outboundDone: 101, returned: 20, batch: 'B2025-0331-01' },
  { stockKey: '仓库二|120001', warehouseId: '仓库二', spareCode: '120001', onHand: 200, reserved: 0, outboundDone: 0, returned: 0, batch: 'B2025-0331-01' },
  { stockKey: '备品备件仓库|120002', warehouseId: '备品备件仓库', spareCode: '120002', onHand: 250, reserved: 0, outboundDone: 250, returned: 0, batch: 'B2025-0331-01' },
  { stockKey: '备品备件仓库|120003', warehouseId: '备品备件仓库', spareCode: '120003', onHand: 350, reserved: 0, outboundDone: 150, returned: 0, batch: 'B2025-0331-02' },
  { stockKey: '仓库二|120003', warehouseId: '仓库二', spareCode: '120003', onHand: 148, reserved: 2, outboundDone: 152, returned: 2, batch: 'B2025-0331-02' },
  { stockKey: '备品备件仓库|120004', warehouseId: '备品备件仓库', spareCode: '120004', onHand: 260, reserved: 0, outboundDone: 140, returned: 0, batch: 'B2025-0330-01' },
  { stockKey: '仓库二|120004', warehouseId: '仓库二', spareCode: '120004', onHand: 100, reserved: 0, outboundDone: 0, returned: 0, batch: 'B2025-0330-01' },
  { stockKey: '备品备件仓库|120005', warehouseId: '备品备件仓库', spareCode: '120005', onHand: 200, reserved: 0, outboundDone: 160, returned: 0, batch: 'B2025-0330-02' },
  { stockKey: '仓库二|120005', warehouseId: '仓库二', spareCode: '120005', onHand: 160, reserved: 0, outboundDone: 0, returned: 0, batch: 'B2025-0330-02' },
  { stockKey: '备品备件仓库|120006', warehouseId: '备品备件仓库', spareCode: '120006', onHand: 28, reserved: 0, outboundDone: 12, returned: 0, batch: 'B2026-0810-01' },
  { stockKey: '仓库二|120006', warehouseId: '仓库二', spareCode: '120006', onHand: 0, reserved: 0, outboundDone: 0, returned: 0, batch: '--' },
];

// 入库单
export const inbounds = [
  { inboundId: 'IB-20260910-001', code: 'rk202609100001', supplier: '供应商一', buyer: '张三', date: '2026-09-10', status: '已入库', creator: '王五', createTime: '2026-09-10 12:00', remark: '按采购单验收，包装完好。', items: [{ spareCode: '120004', spareName: '备件四', unit: '个', warehouseId: '备品备件仓库', qty: 100 }, { spareCode: '120006', spareName: '空压机滤芯', unit: '个', warehouseId: '备品备件仓库', qty: 30 }] },
  { inboundId: 'IB-20260905-002', code: 'rk202609050002', supplier: '供应商二', buyer: '张三', date: '2026-09-05', status: '已入库', creator: '王五', createTime: '2026-09-05 12:00', remark: '随机附合格证。', items: [{ spareCode: '120003', spareName: '备件三', unit: '米', warehouseId: '仓库二', qty: 150 }] },
];

// 出库单（维修出库与 repairOrderId 幂等关联；requestId 防重复提交）
export const outbounds = [
  { outboundId: 'OB-20260915-002', code: 'ck202609150002', type: '维修出库', repairOrderId: 'RO-20260915-002', idempotencyKey: 'outbound:RO-20260915-002:120003:req-0001', warehouseId: '仓库二', date: '2026-09-15', status: '已出库', person: '周强', creator: '王五', createTime: '2026-09-15 10:20', remark: '维修任务 RO-20260915-002 领料。', items: [{ spareCode: '120003', spareName: '备件三', unit: '米', qty: 2 }] },
  { outboundId: 'OB-20260910-003', code: 'ck202609100003', type: '维修出库', repairOrderId: 'RO-20260910-003', idempotencyKey: 'outbound:RO-20260910-003:120001:req-0001', warehouseId: '备品备件仓库', date: '2026-09-10', status: '已出库', person: '赵强', creator: '王五', createTime: '2026-09-10 09:10', remark: '维修任务 RO-20260910-003 领料。', items: [{ spareCode: '120001', spareName: '备件一', unit: '个', qty: 1 }] },
  { outboundId: 'OB-20260901-001', code: 'ck202609010001', type: '领用出库', repairOrderId: null, idempotencyKey: 'outbound:none:120001:req-0009', warehouseId: '备品备件仓库', date: '2026-09-01', status: '已出库', person: '张三', creator: '王五', createTime: '2026-09-01 12:00', remark: '车间日常领用。', items: [{ spareCode: '120001', spareName: '备件一', unit: '个', qty: 100 }] },
];

// 退库单（余料退库 / 冲销）
export const returns = [
  { returnId: 'RT-20260912-001', code: 'th202609120001', outboundId: 'OB-20260901-001', warehouseId: '备品备件仓库', date: '2026-09-12', status: '已退库', spareCode: '120001', spareName: '备件一', unit: '个', qty: 20, reason: '领用余料退库', person: '张三', createTime: '2026-09-12 14:00' },
];

// 库存流水（台账明细：入库/出库/退库/预留/释放）
export const stockFlows = [
  { flowId: 'SF-001', time: '2026-09-16 16:20', warehouseId: '备品备件仓库', spareCode: '120006', type: '报警提醒', qty: 0, balanceAfter: 28, ref: 'ALM-20260916-006', note: '库存 28 低于安全库存 40' },
  { flowId: 'SF-002', time: '2026-09-15 10:20', warehouseId: '仓库二', spareCode: '120003', type: '维修出库', qty: -2, balanceAfter: 148, ref: 'OB-20260915-002', note: 'RO-20260915-002 领料' },
  { flowId: 'SF-003', time: '2026-09-12 14:00', warehouseId: '备品备件仓库', spareCode: '120001', type: '退库', qty: 20, balanceAfter: 799, ref: 'RT-20260912-001', note: '领用余料退库' },
  { flowId: 'SF-004', time: '2026-09-10 12:00', warehouseId: '备品备件仓库', spareCode: '120004', type: '入库', qty: 100, balanceAfter: 260, ref: 'IB-20260910-001', note: '采购到货入库' },
  { flowId: 'SF-005', time: '2026-09-10 09:10', warehouseId: '备品备件仓库', spareCode: '120001', type: '维修出库', qty: -1, balanceAfter: 800, ref: 'OB-20260910-003', note: 'RO-20260910-003 领料' },
];
