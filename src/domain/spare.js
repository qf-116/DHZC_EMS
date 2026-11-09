// ============================================================
// 备件库存领域层（纯 JS：可用库存口径、出库校验、幂等约束；§6.6）
// ============================================================

// 库存口径：现存 = 在库实物；预留 = 已被工单锁定；可用 = 现存 − 预留；
// 出库后现存减少、已出库累计增加；退库回冲现存。
export function availableQty(stock) {
  if (!stock) return null; // 未配置库存与 0 严格区分
  return stock.onHand - stock.reserved;
}

// 出库校验：数量必须为正且不得超过指定仓库可用库存（返回 {ok, error}）
export function validateOutbound(stock, qty) {
  if (!stock) return { ok: false, error: '该仓库未配置此备件库存' };
  const q = Number(qty);
  if (!Number.isFinite(q) || q <= 0) return { ok: false, error: '出库数量必须为正数' };
  const avail = availableQty(stock);
  if (q > avail) return { ok: false, error: `出库数量 ${q} 超过该仓库可用库存 ${avail}` };
  return { ok: true };
}

// 入库校验
export function validateInbound(qty) {
  const q = Number(qty);
  if (!Number.isFinite(q) || q <= 0) return { ok: false, error: '入库数量必须为正数' };
  return { ok: true };
}

// 退库校验：退库数量不得超过该工单该备件的已出库量（余料退库）
export function validateReturn(outboundQty, returnedQty, qty) {
  const q = Number(qty);
  if (!Number.isFinite(q) || q <= 0) return { ok: false, error: '退库数量必须为正数' };
  if (q > outboundQty - returnedQty) return { ok: false, error: `退库数量超过该工单可退余量 ${outboundQty - returnedQty}` };
  return { ok: true };
}

// 幂等键约定：
//   出库：outbound:{repairOrderId}:{spareCode}:{requestId}
//   退库：return:{outboundId}:{requestId}
//   入库：inbound:{warehouseId}:{spareCode}:{requestId}
export function outboundIdempotencyKey(repairOrderId, spareCode, requestId) {
  return `outbound:${repairOrderId}:${spareCode}:${requestId}`;
}

// 库存水位：低于安全库存预警，高于最大库存积压预警
// 安全库存 / 最高库存是备件档案级配置（现存量为所有仓库合计），
// 因此水位判定以「备件现存合计」对比档案阈值；stock 上有同名字段时以 stock 优先（兼容行级配置）。
export function stockLevel(stock, archive = null) {
  if (!stock) return '未配置';
  const safe = stock.safe ?? archive?.safe ?? null;
  const max = stock.max ?? archive?.max ?? null;
  if (safe !== null && safe !== undefined && stock.onHand < safe) return '低于安全库存';
  if (max !== null && max !== undefined && stock.onHand > max) return '超过最大库存';
  return '正常';
}

// 备件现存合计（跨仓库）：现存量口径 = 所有仓库 onHand 之和
export function spareTotals(stockRows = []) {
  const totals = {};
  for (const row of stockRows) {
    const t = totals[row.spareCode] || { onHand: 0, reserved: 0, available: 0 };
    t.onHand += row.onHand || 0;
    t.reserved += row.reserved || 0;
    t.available += (row.onHand || 0) - (row.reserved || 0);
    totals[row.spareCode] = t;
  }
  return totals;
}

// 备件编号生成：BPBJ + YYYYMMDD + 3 位流水（原型「备品备件编号：BPBJ202504030001」）
export function nextSpareCode(existingCodes = [], date = '2026-09-16') {
  const day = String(date).replaceAll('-', '');
  const prefix = `BPBJ${day}`;
  const sameDay = existingCodes.filter(c => String(c).startsWith(prefix));
  const seq = sameDay.length + 1;
  return `${prefix}${String(seq).padStart(3, '0')}`;
}

// 备件档案校验（对齐原型「新增/编辑备品备件」表单规则）
// 名称/编号/规格型号 必填；寿命时长、安全库存数量、最高库存数量为数字且可为小数；
// 备注 ≤300 字符，其余文本字段 ≤30 字符；编辑时编号不可修改。
export function validateSpareDraft(draft = {}, { existingCodes = [] } = {}) {
  const errors = {};
  if (!(draft.name || '').trim()) errors.name = '请输入备品备件名称';
  if ((draft.name || '').length > 30) errors.name = '名称不超过 30 个字符';
  if (!(draft.spec || '').trim()) errors.spec = '请输入规格型号';
  if ((draft.spec || '').length > 30) errors.spec = '规格型号不超过 30 个字符';
  if (!(draft.code || '').trim()) errors.code = '请输入备品备件编号';
  if (existingCodes.includes(draft.code)) errors.code = '备品备件编号已存在';
  if ((draft.remark || '').length > 300) errors.remark = '备注不超过 300 个字符';
  for (const f of ['brand', 'supplier', 'contact', 'phone', 'usage']) {
    if ((draft[f] || '').length > 30) errors[f] = '该字段不超过 30 个字符';
  }
  for (const f of ['life', 'safe', 'max', 'leadTime']) {
    const v = draft[f];
    if (v === undefined || v === null || v === '') continue;
    if (!Number.isFinite(Number(v)) || Number(v) < 0) errors[f] = '请输入不小于 0 的数字';
  }
  if (draft.safe !== undefined && draft.safe !== null && draft.safe !== ''
    && draft.max !== undefined && draft.max !== null && draft.max !== ''
    && Number(draft.safe) > Number(draft.max)) errors.safe = '安全库存数量不能大于最高库存数量';
  return { ok: Object.keys(errors).length === 0, errors };
}
