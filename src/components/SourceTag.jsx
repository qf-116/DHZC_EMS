import React from 'react';
import { Tag, Tooltip } from 'antd';

// 「来源」标签（报修记录 / 维修任务通用，2026-11-20 口径）：
// 人工创建 = 蓝、设备报警 = 橘红，一眼区分故障是人工报的还是设备报警转来的。
// info 来自 domain/repair.js 的 orderSourceInfo / reportSourceInfo（单一判定，页面不得自行实现）；
// detail=false 时只显示类别标签；refText 用于补充来源单据号文本（链接由页面自行拼接）。
export default function SourceTag({ info, detail = true, refText = null }) {
  if (!info) return '--';
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>
      <Tooltip title={info.category === '设备报警'
        ? `来源：设备报警（${info.detail}${info.alarmId ? ` · ${info.alarmId}` : ''}）`
        : `来源：人工创建（${info.detail}）`}>
        <Tag color={info.color} style={{ marginInlineEnd: 0 }}>{info.category}</Tag>
      </Tooltip>
      {detail && info.detail && <span style={{ fontSize: 12, color: '#8a97a3' }}>{info.detail}</span>}
      {refText}
    </span>
  );
}
