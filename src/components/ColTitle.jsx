import React from 'react';
import { Tooltip } from 'antd';
import { Info } from 'lucide-react';

// 报表列头「标题 + 信息图标」（2026-11-05）：标题只留短名，口径 / 公式放信息图标内，
// 鼠标悬停显示解释文字——替代长列名（如「MTTR（平均修复时间）」→「MTTR ⓘ」）。
export default function ColTitle({ title, tip }) {
  if (!tip) return title;
  return (
    <span>
      {title}
      <Tooltip title={tip}>
        <Info size={13} style={{ marginLeft: 3, verticalAlign: '-2px', color: '#8a97a3', cursor: 'help' }} />
      </Tooltip>
    </span>
  );
}
