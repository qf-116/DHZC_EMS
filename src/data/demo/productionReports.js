// ============================================================
// 生产报工事件（OEE 源数据，2026-11-05 口径）
// 物联网平台按「报工」上报，一条报工 = 报工时间 + 数量（默认 +1）+ 是否合格；
// 系统逐条留存，产量 / 合格数由 selectors 按统计窗口对事件汇总，不再接收
// 「加工数量 / 合格数量」这类聚合结果。
//
// 演示数据锚定 2026-09-16：
//   实时窗口 15:41 ~ 16:41、日窗口 08:00 ~ 16:41，汇总结果与 oeeInputs 的
//   负荷 / 运行时间、速度配置及原有 OEE 展示口径勾稽。
// ============================================================

const DAY = '2026-09-16';
const DAY_KEY = '20260916';

// 秒 → HH:MM:SS
const hms = (sec) => {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};
const at = (sec) => `${DAY} ${hms(sec)}`;
const shiftOf = (sec) => (sec < 20 * 3600 ? '白班' : '夜班');

// pre：08:00 ~ 15:41（实时窗口之前）；last：15:41 ~ 16:41（实时窗口）
// output / qualified 为该区间内的报工件数与合格件数（每件一条事件，quantity=1）
const PLANS = [
  {
    deviceId: 'DEV-001', iotDeviceCode: 'IOT-D-10001', materialCode: 'XN010102-000001',
    workOrderNo: 'WO-20260916-001', batchNo: 'B-20260916-A',
    pre: { output: 204, qualified: 199 }, last: { output: 21, qualified: 20 },
  },
  {
    deviceId: 'DEV-002', iotDeviceCode: 'IOT-D-10002', materialCode: 'XN010102-000001',
    workOrderNo: 'WO-20260916-002', batchNo: 'B-20260916-A',
    pre: { output: 193, qualified: 188 }, last: { output: 17, qualified: 16 },
  },
  {
    deviceId: 'DEV-003', iotDeviceCode: 'IOT-D-10003', materialCode: 'XN020105-000003',
    workOrderNo: 'WO-20260916-003', batchNo: 'B-20260916-B',
    pre: { output: 65, qualified: 65 }, last: { output: 3, qualified: 3 },
  },
  {
    deviceId: 'DEV-004', iotDeviceCode: 'IOT-D-10004', materialCode: 'XN010102-000002',
    workOrderNo: 'WO-20260916-004', batchNo: 'B-20260916-C',
    pre: { output: 44, qualified: 43 }, last: { output: 2, qualified: 2 },
  },
];

// 不合格事件在区间内均匀分布（演示确定性，不使用随机数）
const unqualifiedIndexes = (total, qualified) => {
  const bad = Math.max(0, total - qualified);
  const set = new Set();
  for (let k = 0; k < bad; k += 1) {
    set.add(Math.min(total - 1, Math.floor(((k + 0.5) * total) / bad)));
  }
  return set;
};

const buildSegment = (plan, segment, startSec, endSec, seqStart) => {
  const { output, qualified } = segment;
  const badIndexes = unqualifiedIndexes(output, qualified);
  const events = [];
  for (let i = 0; i < output; i += 1) {
    const sec = Math.floor(startSec + ((i + 0.5) * (endSec - startSec)) / output);
    const seq = seqStart + i + 1;
    const reportTime = at(sec);
    events.push({
      reportId: `PR-${DAY_KEY}-${plan.deviceId.slice(-3)}-${String(seq).padStart(4, '0')}`,
      deviceId: plan.deviceId,
      iotDeviceCode: plan.iotDeviceCode,
      metricCode: 'E.production_report',
      reportTime,
      receivedAt: at(sec + 2),
      materialCode: plan.materialCode,
      quantity: 1,
      qualified: !badIndexes.has(i),
      workOrderNo: plan.workOrderNo,
      batchNo: plan.batchNo,
      shift: shiftOf(sec),
      source: 'IoT',
    });
  }
  return events;
};

const buildDeviceReports = (plan) => {
  const preStart = 8 * 3600;              // 08:00
  const windowStart = 15 * 3600 + 41 * 60; // 15:41
  const windowEnd = 16 * 3600 + 41 * 60;   // 16:41
  const pre = buildSegment(plan, plan.pre, preStart, windowStart, 0);
  const last = buildSegment(plan, plan.last, windowStart, windowEnd, pre.length);
  return [...pre, ...last];
};

export const productionReportsByDeviceId = Object.fromEntries(
  PLANS.map((plan) => [plan.deviceId, buildDeviceReports(plan)]),
);

// 扁平事件流（便于导出 / 排障查看）
export const productionReports = Object.values(productionReportsByDeviceId).flat();
