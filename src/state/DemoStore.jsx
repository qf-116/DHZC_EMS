// ============================================================
// DemoStore（§4）：React 上下文封装 —— 状态、dispatch、actions、selectors 统一出口
// resetDemo 直接以初始快照替换状态（§4.2），清空 localStorage 快照。
// Action 结果契约（M0）：dispatch 同步返回 reducer 的真实结果（meta.lastAction），
// stateRef 保证同一事件内连续多次 dispatch 不读旧状态 —— actions 层与页面据此
// 读取 { ok, message, refs }，不再依赖「先 setState 再读新 state」的竞态假设。
// ============================================================

import React, { createContext, useContext, useEffect, useMemo, useReducer, useRef } from 'react';
import { createDemoState, STORE_VERSION } from '../data/demo/index.js';
import { reducer } from './reducer.js';
import { createDemoActions } from './actions.js';
import { loadDemoState, saveDemoState, clearDemoState } from './persistence.js';

const DemoStateContext = createContext(null);
const DemoActionsContext = createContext(null);

const RESET = Symbol('demo-reset');

// store 级 reducer：处理 reset；业务动作由 dispatch 直接计算后传入完整 { state, notice }
function storeReducer(prev, next) {
  if (next === RESET) return { state: createDemoState(), notice: '已重置为初始状态' };
  return next;
}

function initStore() {
  const { state, notice } = loadDemoState();
  return { state: state || createDemoState(), notice };
}

export function DemoStoreProvider({ children }) {
  const [store, setStoreRaw] = useReducer(storeReducer, undefined, initStore);
  const stateRef = useRef(null);
  if (stateRef.current === null) stateRef.current = store.state;
  const storeRef = useRef(store);
  storeRef.current = store;

  const dispatch = (action) => {
    if (action && action.type === 'demo/reset') {
      clearDemoState();
      stateRef.current = createDemoState();
      setStoreRaw(RESET);
      return { ok: true, message: '已重置为初始状态', refs: {} };
    }
    const next = reducer(stateRef.current, action);
    stateRef.current = next;
    setStoreRaw({ state: next, notice: storeRef.current.notice });
    return next.meta.lastAction || { ok: false, message: '动作未产生结果', refs: {} };
  };

  const actions = useMemo(() => createDemoActions(store.state, dispatch), [store.state]);

  // 快照持久化（§4.2）：只写业务快照，不写临时弹窗与分页
  useEffect(() => { saveDemoState(store.state); }, [store.state]);

  const value = useMemo(() => ({ ...store, dispatch }), [store]);

  return (
    <DemoStateContext.Provider value={value}>
      <DemoActionsContext.Provider value={actions}>{children}</DemoActionsContext.Provider>
    </DemoStateContext.Provider>
  );
}

export function useDemoStore() {
  const ctx = useContext(DemoStateContext);
  if (!ctx) throw new Error('useDemoStore 必须在 <DemoStoreProvider> 内使用');
  return ctx;
}

export function useDemoState() {
  return useDemoStore().state;
}

export function useDemoNotice() {
  const ctx = useContext(DemoStateContext);
  return ctx ? ctx.notice : null;
}

export function useDemoActions() {
  return useContext(DemoActionsContext);
}

export function useDemoReset() {
  return useDemoStore().dispatch; // 调用 dispatch({ type: 'demo/reset' })
}

export { STORE_VERSION };
