import React from 'react';

// 基础配置（用户 / 角色 / 组织 / 字典 / 日志）统一提示页（2026-11-04 需求方确认）：
// 页面内容全部移除，仅提示使用已有平台基础管理模块的功能。
export default function PlatformModuleNotice() {
  return (
    <div style={{ padding: '120px 24px', textAlign: 'center' }}>
      <div style={{ fontSize: 15, color: '#5d6b78', letterSpacing: 0.5 }}>
        使用已有平台基础管理模块的功能
      </div>
    </div>
  );
}
