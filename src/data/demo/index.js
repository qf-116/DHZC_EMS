// ============================================================
// DemoState 初始快照装配（§4.1 / §4.2）
// 初始快照由此文件创建；持久化写入 localStorage 键 dms-demo:state（见 state/persistence.js）
// ============================================================

import { devices } from './devices.js';
import { deviceCrosswalk, crosswalkByDeviceId, crosswalkByAssetCode } from './deviceCrosswalk.js';
import { metrics, metricsByKey } from './metrics.js';
import { bindingsByDeviceId, bindingVersions, sourceDevices } from './bindings.js';
import { samples, trends, health, ingestionTasks, DEMO_TIME, DEMO_LAST_SAMPLE_AT } from './samples.js';
import { alarmRules, alarmRuleVersions, alarmEvents, notificationDeliveries, notificationPolicies } from './alarms.js';
import { normalizeLegacyRule } from '../../domain/alarmRule.js';
import { repairReports, repairOrders, repairAcceptances } from './repairs.js';
import { warehouses, spares, stock, inbounds, outbounds, returns, stockFlows } from './spares.js';
import { downtimeFacts } from './downtime.js';
import { materialPool, speedConfigs, oeeTargets, shiftCalendar, oeeInputs, oeeEligibility, oeeRecomputeLog } from './oee.js';
import { programCompare, programBaselines, programHandles } from './programCompare.js';
import { lifecycleTasks, assetChangeRecords, idleApplications, scrapApplications } from './lifecycle.js';
import { ruleTemplateSeeds } from './ruleTemplates.js';

export const STORE_VERSION = 10; // 快照结构版本：P2 模板持久化（ruleTemplatesById 实体容器）

export const DEMO_META = {
  mode: 'demo',
  source: 'demo',
  provider: 'mock-polling',      // 演示轮询；可为 mock-subscription / disconnect（降级演示）
  updatedAt: DEMO_TIME,
  lastSampleAt: DEMO_LAST_SAMPLE_AT,
  latencySec: 3,
  degraded: false,
  timezone: '+08:00',
  actorContext: { userId: 'demo-user', userName: '李明', source: 'host-context' },
  demoDay: '2026-09-16',
};

export function createDemoState() {
  return {
    version: STORE_VERSION,
    meta: { ...DEMO_META },
    entities: {
      devicesById: Object.fromEntries(devices.map(d => [d.deviceId, d])),
      crosswalkById: crosswalkByDeviceId,
      crosswalkByAssetCode,
      bindingsByDeviceId,
      bindingVersionsById: Object.fromEntries(bindingVersions.map(v => [v.bindingId, v])),
      sourceDevicesById: Object.fromEntries(sourceDevices.map(s => [s.iotDeviceId, s])),
      metricsByKey,
      samplesByKey: Object.fromEntries(samples.map(s => [s.key, s])),
      trends,
      healthByDeviceId: { ...health },
      ingestionTasksById: Object.fromEntries(ingestionTasks.map(t => [t.taskId, t])),
      alarmRulesById: Object.fromEntries(alarmRules.map(r => [r.code, normalizeLegacyRule(r)])),
      alarmRuleVersionsById: Object.fromEntries(alarmRuleVersions.map((v, i) => [`${v.code}|${v.version}`, v])),
      alarmEventsById: Object.fromEntries(alarmEvents.map(a => [a.id, a])),
      notificationDeliveriesById: Object.fromEntries(notificationDeliveries.map(n => [n.id, n])),
      notificationPoliciesById: Object.fromEntries(notificationPolicies.map(p => [p.code, p])),
      repairReportsById: Object.fromEntries(repairReports.map(r => [r.reportId, r])),
      repairOrdersById: Object.fromEntries(repairOrders.map(r => [r.repairOrderId, r])),
      repairAcceptancesById: Object.fromEntries(repairAcceptances.map(a => [a.acceptanceId, a])),
      sparesByCode: Object.fromEntries(spares.map(s => [s.code, s])),
      stockByKey: Object.fromEntries(stock.map(s => [s.stockKey, s])),
      warehousesById: Object.fromEntries(warehouses.map(w => [w.warehouseId, w])),
      inboundsById: Object.fromEntries(inbounds.map(i => [i.inboundId, i])),
      outboundsById: Object.fromEntries(outbounds.map(o => [o.outboundId, o])),
      returnsById: Object.fromEntries(returns.map(r => [r.returnId, r])),
      stockFlowsById: Object.fromEntries(stockFlows.map(f => [f.flowId, f])),
      downtimeFactsById: Object.fromEntries(downtimeFacts.map(d => [d.downtimeId, d])),
      materialPool,
      speedConfigsById: Object.fromEntries(speedConfigs.map(s => [s.id, s])),
      oeeTargetsByDeviceId: Object.fromEntries(oeeTargets.map(t => [t.deviceId, t])),
      shiftCalendar,
      oeeInputs,
      oeeEligibilityByDeviceId: oeeEligibility,
      oeeRecomputeLogById: Object.fromEntries(oeeRecomputeLog.map(r => [r.recomputeId, r])),
      programCompareById: Object.fromEntries(programCompare.map(p => [p.recordId, p])),
      programBaselines,
      programHandlesById: Object.fromEntries(programHandles.map(h => [h.recordId, h])),
      businessHistoryById: {},   // 动作产生的业务履历（selectBusinessHistory 消费）
      idempotencyByKey: {},      // 已处理动作的幂等登记（重复请求返回同一结果）
      exportTasksById: {},       // 演示导出任务
      reportsByKey: {},          // runReport 动作写入的查询口径记录
      lifecycleTasksById: Object.fromEntries(lifecycleTasks.map(t => [t.taskId, t])),
      assetChangeRecordsById: Object.fromEntries(assetChangeRecords.map(r => [r.changeId, r])),
      idleApplicationsById: Object.fromEntries(idleApplications.map(r => [r.idleId, r])),
      scrapApplicationsById: Object.fromEntries(scrapApplications.map(r => [r.scrapId, r])),
      alarmBatchesById: {},      // 批量创建批次（M3-M4：逐目标结果 + clientRequestId 幂等）
      ruleTemplatesById: Object.fromEntries(ruleTemplateSeeds.map((t) => [t.templateId, t])), // P2 模板持久化
    },
    ui: {
      filtersByRoute: {},
      screenPage: 'overview',
    },
  };
}
