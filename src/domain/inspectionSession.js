// ============================================================
// 点检演示会话（仅页面内存，不写入 DemoStore）
// ------------------------------------------------------------
// 用途：让「跳过点检 / 任务完成 / 调整任务」等跨页交互在演示中可见：
//   执行点检页写入跳过原因 / 提交结果 → 点检任务详情页显示该原因与「进行中」状态
//   → 点检任务列表页「任务完成」按钮按原型规则实时判定可用性
// 数据来源：standardData.js 演示快照（只读），本模块只在内存中叠加演示态。
// 说明：刷新页面即恢复快照，符合演示模块「不写入 DemoStore」的既有约定。
// ============================================================

import { useSyncExternalStore } from 'react';
import { inspectionTaskDetails, inspectionTasks } from '../data/standardData.js';

const listeners = new Set();

const initialState = {
  version: 0,
  // taskCode -> 设备明细行（含跳过原因、已检/未检、执行时间）
  details: {},
  // taskCode -> 任务字段补丁（状态 / 任务日期 / 负责人 / 班组 / 备注）
  patches: {},
};

let snapshot = initialState;

function emit(next) {
  snapshot = { ...next, version: snapshot.version + 1 };
  listeners.forEach(fn => fn());
}

export function subscribeInspectionSession(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getInspectionSessionSnapshot() {
  return snapshot;
}

export function useInspectionSession() {
  return useSyncExternalStore(subscribeInspectionSession, getInspectionSessionSnapshot, getInspectionSessionSnapshot);
}

// 演示快照派生：任务明细取共享快照 inspectionTaskDetails 的前 shouldCount 台设备。
// 原型/快照未给出「任务 ↔ 设备明细」的完整关联表，此处按应检设备数截取，口径与现详情页一致。
// 注：临时新增任务不在快照关联范围内，返回空明细（不伪造点检数据）。
export function deriveTaskDetails(task) {
  if (!task) return [];
  const seed = inspectionTasks.find(t => t.code === task.code);
  if (!seed) return [];
  const rows = inspectionTaskDetails.slice(0, Math.max(0, seed.shouldCount ?? 0)).map(r => ({ ...r }));
  // 快照里唯一有完整点检记录的是「已完成」任务：其设备明细视为全部已检
  if (seed.status === '已完成') {
    return rows.map(r => ({ ...r, checked: r.itemTotal, unchecked: 0 }));
  }
  return rows;
}

// 解析某任务的设备明细：快照派生 + 演示态覆盖
export function resolveTaskDetails(task, sessionSnapshot) {
  const override = sessionSnapshot?.details?.[task?.code];
  if (override) return override;
  return deriveTaskDetails(task);
}

// 解析某任务的字段补丁
export function resolveTaskPatch(task, sessionSnapshot) {
  return sessionSnapshot?.patches?.[task?.code] || {};
}

function writeDetails(taskCode, rows) {
  emit({ ...snapshot, details: { ...snapshot.details, [taskCode]: rows } });
}

export function writeTaskPatch(taskCode, patch) {
  emit({ ...snapshot, patches: { ...snapshot.patches, [taskCode]: { ...(snapshot.patches[taskCode] || {}), ...patch } } });
}

// 跳过点检：写入该设备的跳过原因；该设备未检项按跳过处理（未检计数归零）
export function skipDevice(task, deviceCode, reason) {
  const rows = resolveTaskDetails(task, snapshot).map(r => (
    r.code === deviceCode ? { ...r, skipReason: reason, checked: 0, unchecked: 0 } : r
  ));
  writeDetails(task.code, rows);
  // 原型规则：任务存在跳过点检时，未开始的任务状态进入「进行中」（已结束任务不回退）
  const patch = snapshot.patches[task.code] || {};
  const current = patch.status || inspectionTasks.find(t => t.code === task.code)?.status;
  if (!patch.status && current === '未开始') {
    writeTaskPatch(task.code, { status: '进行中' });
  }
}

// 提交点检结果：该设备已检数按本次提交的项目数推进
export function submitDeviceResult(task, deviceCode, checkedCount, execTime) {
  const rows = resolveTaskDetails(task, snapshot).map(r => (
    r.code === deviceCode
      ? { ...r, checked: checkedCount, unchecked: Math.max(0, (r.itemTotal ?? 0) - checkedCount), execTime, skipReason: '' }
      : r
  ));
  writeDetails(task.code, rows);
  // 原型规则：任务下存在已检项目数 > 0 时，未开始的任务状态进入「进行中」
  const patch = snapshot.patches[task.code] || {};
  const current = patch.status || inspectionTasks.find(t => t.code === task.code)?.status;
  if (!patch.status && current === '未开始') {
    writeTaskPatch(task.code, { status: '进行中' });
  }
}
