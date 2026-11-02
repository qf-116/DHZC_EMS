// ============================================================
// 平台指标清单 + 接入任务（/platform-metrics · 数据接入域）
// 指标来自 src/data/demo/metrics.js（14 项，含版本 / 单位 / 失效标记，只读，
// 编辑由平台接入服务提供，本页不自建指标、不改协议/网关/点位）。
// 接入任务来自 store（selectIngestionTasks，IT-001..004：重试中/部分成功/失败/成功），
// 展示 failReason / impact / nextStep。搜索/筛选为页面 UI 局部状态。
// ============================================================

import React, { useMemo, useState } from 'react';
import { Card, Input, Select, Space, Table, Tag, Typography } from 'antd';
import { Search } from 'lucide-react';
import PageHeader from '../components/PageHeader.jsx';
import StatusTag from '../components/StatusTag.jsx';
import FilterBar, { FilterField } from '../components/FilterBar.jsx';
import { useDemoState } from '../state/DemoStore.jsx';
import { selectIngestionTasks } from '../state/selectors.js';
import { metrics } from '../data/demo/metrics.js';

const dataTypeColor = { '数值': 'blue', '状态': 'purple', '事件': 'orange' };

export default function PlatformMetricsPage() {
  const state = useDemoState();
  // UI 局部状态：筛选条件（不影响业务事实）
  const [keyword, setKeyword] = useState('');
  const [dataType, setDataType] = useState(null);
  const [syncStatus, setSyncStatus] = useState(null);

  const metricRows = useMemo(() => metrics.filter((m) => {
    if (keyword && !`${m.metricCode} ${m.name}`.toLowerCase().includes(keyword.trim().toLowerCase())) return false;
    if (dataType && m.dataType !== dataType) return false;
    if (syncStatus && m.syncStatus !== syncStatus) return false;
    return true;
  }), [keyword, dataType, syncStatus]);

  const tasks = useMemo(() => selectIngestionTasks(state), [state]);
  const taskIssues = tasks.filter((t) => ['失败', '重试中', '部分成功'].includes(t.status));

  const statusMeta = {
    '重试中': { color: 'processing', note: '连续 3 次失败转人工处理' },
    '部分成功': { color: 'warning', note: '成功部分已入库，失败部分看 failReason' },
    '失败': { color: 'error', note: '需要人工介入' },
    '成功': { color: 'success', note: '--' },
  };

  return (
    <>
      <PageHeader
        title="平台指标清单"
        subtitle="从 IoT 平台同步的只读指标目录（含失效标记）· 指标新增/修改/停用由平台接入服务提供，本页只读"
      />
      <FilterBar onQuery={() => {}} onReset={() => { setKeyword(''); setDataType(null); setSyncStatus(null); }} extra={<Typography.Text type="secondary" style={{ fontSize: 12 }}>共 {metricRows.length} / {metrics.length} 项 · 已失效指标不能参与绑定（校验不通过）</Typography.Text>}>
        <FilterField label="指标关键词">
          <Input style={{ width: 220 }} prefix={<Search size={13} />} placeholder="指标编码 / 指标名称" allowClear value={keyword} onChange={(e) => setKeyword(e.target.value)} />
        </FilterField>
        <FilterField label="数据类型">
          <Select style={{ width: 130 }} placeholder="请选择" allowClear value={dataType} onChange={setDataType} options={['数值', '状态', '事件'].map((v) => ({ value: v, label: v }))} />
        </FilterField>
        <FilterField label="同步状态">
          <Select style={{ width: 130 }} placeholder="请选择" allowClear value={syncStatus} onChange={setSyncStatus} options={['正常', '已失效'].map((v) => ({ value: v, label: v }))} />
        </FilterField>
      </FilterBar>

      <Card size="small" style={{ marginBottom: 12 }} title="指标字典（只读 · 平台同步快照）">
        <Table
          rowKey="metricCode" size="small"
          dataSource={metricRows}
          columns={[
            { title: '指标编码', dataIndex: 'metricCode', width: 180 },
            { title: '指标名称', dataIndex: 'name', width: 110 },
            { title: '单位', width: 80, render: (_, m) => m.unit || '--' },
            { title: '数据类型', dataIndex: 'dataType', width: 90, render: (v) => <Tag color={dataTypeColor[v] || 'default'}>{v}</Tag> },
            { title: '精度', dataIndex: 'precision', width: 80, render: (v) => v ?? '--' },
            { title: '有效范围', dataIndex: 'range', width: 220, render: (v) => v || '--' },
            {
              title: '同步状态', dataIndex: 'syncStatus', width: 100,
              render: (v) => <Tag color={v === '正常' ? 'success' : 'error'}>{v}</Tag>,
            },
            { title: '最近同步时间', dataIndex: 'lastSyncTime', width: 150 },
          ]}
          pagination={false}
        />
        <div style={{ color: '#5d6b78', fontSize: 12, marginTop: 8 }}>
          说明：「已失效」指标（如环境湿度 M.ambient_humidity）为平台侧删除/停用，本地不物理删除；在绑定草稿中勾选会导致校验不通过。指标元数据变更由平台接入服务统一维护，本系统仅消费同步快照。
        </div>
      </Card>

      <Card
        size="small"
        title={`接入任务（${taskIssues.length} 项异常待关注）`}
        extra={<Typography.Text type="secondary" style={{ fontSize: 12 }}>任务由接入服务调度：拉取 / 补传 / 补偿重放</Typography.Text>}
      >
        <Table
          rowKey="taskId" size="small"
          scroll={{ x: 1280 }}
          dataSource={tasks}
          columns={[
            { title: '任务编号', dataIndex: 'taskId', width: 150, fixed: 'left' },
            { title: '设备', dataIndex: 'deviceName', width: 130 },
            { title: '类型', dataIndex: 'type', width: 90 },
            {
              title: '状态', dataIndex: 'status', width: 100,
              render: (v) => <StatusTag value={v} tip={statusMeta[v]?.note} />,
            },
            { title: '开始', dataIndex: 'startedAt', width: 90 },
            { title: '最近更新', dataIndex: 'updatedAt', width: 90 },
            {
              title: '失败 / 成功报文', width: 110,
              render: (_, t) => <span>{t.failCount ?? '--'} / {t.successCount ?? '--'}</span>,
            },
            { title: '失败原因', dataIndex: 'failReason', width: 220, render: (v) => v || '--' },
            { title: '影响范围', dataIndex: 'impact', width: 240, render: (v) => v || '--' },
            { title: '负责人', dataIndex: 'owner', width: 90, render: (v) => v || '--' },
            { title: '下一步', dataIndex: 'nextStep', render: (v) => v || '--' },
          ]}
          pagination={false}
        />
        <div style={{ color: '#5d6b78', fontSize: 12, marginTop: 8 }}>
          说明：接入任务状态机为 成功 / 失败 / 重试中 / 部分成功；「失败」「重试中」「部分成功」会在工作台生成待办。
          任务的重试、补偿与人工处理由平台接入服务执行，本页只读展示 failReason / impact / nextStep。
        </div>
      </Card>
    </>
  );
}
