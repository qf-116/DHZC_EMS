import React, { useMemo, useState } from 'react';
import { Card, Input, Select, Button, Space, Pagination, Tag, Segmented, Alert, App } from 'antd';
import { Link, useNavigate } from 'react-router-dom';
import { Search, Cog, RefreshCw } from 'lucide-react';
import PageHeader from '../components/PageHeader.jsx';
import StatusTag from '../components/StatusTag.jsx';
import EmptyState from '../components/EmptyState.jsx';
import DegradedBanner from '../components/DegradedBanner.jsx';
import { useDemoState, useDemoActions } from '../state/DemoStore.jsx';
import { selectRealtime, selectDevice, selectActiveAlarms, selectOeeResult } from '../state/selectors.js';

const QUALITY_COLOR = { GOOD: 'success', DELAYED: 'processing', NO_VALUE: 'warning', OFFLINE: 'error', BAD: 'error' };

// 质量码 → 中文标签（质量码为采集事实，不是业务状态，不走 StatusTag 字典）
const QUALITY_LABEL = {
  GOOD: '正常', DELAYED: '延迟', NO_VALUE: '无值', OFFLINE: '离线', BAD: '异常',
};

// 卡片状态配色：运行绿 / 待机灰 / 故障红 / 无数据深灰
const stateMeta = {
  运行: { color: '#16a34a' },
  待机: { color: '#8fa3ad' },
  故障: { color: '#dc2626' },
  无数据: { color: '#55636e' },
};

// 折叠态指标区可见行数（约）：超过该数量出现「展开全部」，展开后卡片局部变高
const METRIC_CLAMP = 4;

function DeviceCard({ row }) {
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(false);
  const rt = row.realtime;
  const state = rt.runStatus || '无数据';
  const color = stateMeta[state]?.color || '#55636e';
  const interrupted = rt.healthStatus === '数据中断';
  const delayed = rt.healthStatus === '延迟';
  const oee = row.oee;
  const needClamp = rt.metrics.length > METRIC_CLAMP;

  return (
    <div className="rt-card" style={{ '--st': color }}>
      <div className="rt-head">
        <span className={`rt-dot${delayed ? ' delayed' : ''}`} />
        <div className="rt-title">
          <strong>{row.name}</strong>
          <small>{row.workshopName || '--'} · {row.assetCode}</small>
        </div>
        <Link className="rt-detail" to={`/device/${row.deviceId}`}>详情</Link>
      </div>
      <div className="rt-body">
        <div className="rt-figure">
          <Cog size={34} strokeWidth={1.5} />
          <span>{state}</span>
        </div>
        <div className="rt-info">
          <div className="rt-info-row"><span>运行状态</span><b style={{ color }}>{state}</b></div>
          <div className="rt-info-row">
            <span>通信健康</span>
            <b>
              <StatusTag
                value={rt.healthStatus}
                tip={delayed ? `数据延迟 ${rt.latencySec ?? '--'}s` : undefined}
              />
              {delayed && rt.latencySec != null && <small style={{ marginLeft: 4 }}>延迟 {rt.latencySec}s</small>}
            </b>
          </div>
          <div className="rt-info-row"><span>绑定状态</span><b>{rt.bindingStatus || '--'}</b></div>
          <div className="rt-info-row"><span>活动报警</span><b className={row.alarmCount > 0 ? 'warn' : ''}>{row.alarmCount}</b></div>
          <div className="rt-info-row">
            <span>OEE</span>
            <b>{oee && oee.oee != null ? `${oee.oee}%` : '--'}</b>
          </div>
        </div>
      </div>
      {/* 指标区固定高度 + 滚动（超 METRIC_CLAMP 项可「展开全部」），保证卡片等高、页面协调 */}
      <div className="rt-metrics-wrap">
        <div className="rt-metrics-head">
          <span>实时指标（{rt.metrics.length}）</span>
          {needClamp && (
            <a onClick={() => setExpanded(!expanded)}>{expanded ? '收起 ▴' : `展开全部（${rt.metrics.length} 项）▾`}</a>
          )}
        </div>
        <div className={`rt-metrics${!expanded ? ' clamp' : ''}`}>
          {rt.metrics.length === 0 ? (
            <div style={{ gridColumn: '1 / -1', fontSize: 12, color: '#8a97a3', padding: '4px 0' }}>
              绑定未配置启用指标，暂无可展示数据
            </div>
          ) : rt.metrics.map(m => (
            <div key={`${m.iotDeviceCode}|${m.metricCode}`} className="rt-metric" title={`质量码 ${m.qualityCode}${m.sourceTime ? ` · 采集 ${m.sourceTime}` : ''}`}>
              <span className="n">{m.name}</span>
              <span className="v">{m.value ?? '--'}</span>
              <span className="u">{m.value == null ? '' : m.unit || ''}</span>
              <Tag color={QUALITY_COLOR[m.qualityCode] || 'default'} style={{ fontSize: 10, lineHeight: '16px', marginRight: 0, marginLeft: 4 }}>
                {QUALITY_LABEL[m.qualityCode] || m.qualityCode}
              </Tag>
            </div>
          ))}
        </div>
      </div>
      <div className="rt-foot">
        <span>{interrupted
          ? '数据中断：无数据 ≠ 0，最后样本 ' + (rt.lastSampleAt || '--')
          : '更新 ' + (rt.sourceTime || rt.lastSampleAt || '--')}</span>
        <span className="links">
          <a onClick={() => navigate('/alarm-center')}>报警</a>
          <a onClick={() => navigate('/repair-reports')}>报修</a>
        </span>
      </div>
    </div>
  );
}

// 实时监控：逐设备消费 selectRealtime（指标名/值/单位/质量码/采集时间 sourceTime）。
// 数据源模式切换走 actions.setProviderMode（mock-polling / mock-subscription / disconnect）。
export default function RealtimePage() {
  const state = useDemoState();
  const actions = useDemoActions();
  const { message } = App.useApp();
  const navigate = useNavigate();
  const meta = state.meta;

  const [workshop, setWorkshop] = useState('all');
  const [health, setHealth] = useState('all');
  const [run, setRun] = useState('all');
  const [kw, setKw] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 8;

  const rows = useMemo(() => Object.values(state.entities.devicesById)
    .filter(d => d.lifecycleStatus === '在用') // 停用/报废设备不参与实时监测
    .map((d) => {
      const device = selectDevice(state, d.deviceId);
      const realtime = selectRealtime(state, d.deviceId);
      return {
        deviceId: d.deviceId,
        name: device.name,
        workshopName: device.workshopName,
        assetCode: device.assetCode,
        realtime,
        alarmCount: selectActiveAlarms(state, d.deviceId).length,
        oee: selectOeeResult(state, d.deviceId, { window: 'realtime' }),
      };
    }), [state]);

  const workshops = useMemo(() => [...new Set(rows.map(r => r.workshopName).filter(Boolean))], [rows]);

  const filtered = useMemo(() => {
    const kwTrim = kw.trim().toLowerCase();
    return rows
      .filter(r => workshop === 'all' || r.workshopName === workshop)
      .filter(r => health === 'all' || r.realtime.healthStatus === health)
      .filter(r => run === 'all' || r.realtime.runStatus === run)
      .filter(r => !kwTrim || r.name.toLowerCase().includes(kwTrim) || (r.assetCode || '').toLowerCase().includes(kwTrim));
  }, [rows, workshop, health, run, kw]);

  const paged = filtered.slice((page - 1) * pageSize, page * pageSize);

  const changeProviderMode = (mode) => {
    const res = actions.setProviderMode(mode);
    if (res) message[res.ok ? 'success' : 'error'](res.message);
  };
  const refresh = () => {
    const res = actions.refreshRealtime();
    if (res) message[res.ok ? 'success' : 'error'](res.message);
  };

  return (
    <>
      <PageHeader
        title="实时监控"
        subtitle={`${rows.length} 台在用设备 · 当前筛选 ${filtered.length} 台 · 最后样本 ${meta.lastSampleAt || '--'}`}
      />
      <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 12, color: '#5d6b78' }}>数据源模式：</span>
        <Segmented
          size="small"
          value={meta.provider}
          onChange={changeProviderMode}
          options={[
            { value: 'mock-polling', label: '轮询' },
            { value: 'mock-subscription', label: '订阅' },
            { value: 'disconnect', label: '断开（降级）' },
          ]}
        />
        <Button size="small" icon={<RefreshCw size={13} />} onClick={refresh}>刷新</Button>
      </div>
      <DegradedBanner meta={meta} />
      {meta.provider === 'disconnect' && (
        <Alert
          type="info" showIcon style={{ marginBottom: 12 }}
          message="断开期间无有效实时数据，指标值显示 --；切回轮询/订阅后恢复。"
        />
      )}
      <Card size="small" style={{ marginBottom: 12 }}>
        <Space wrap>
          <Select value={workshop} onChange={v => { setWorkshop(v); setPage(1); }} style={{ width: 140 }} options={[{ value: 'all', label: '全部车间' }, ...workshops.map(w => ({ value: w, label: w }))]} />
          <Select value={health} onChange={v => { setHealth(v); setPage(1); }} style={{ width: 130 }} options={[
            { value: 'all', label: '全部通信' },
            { value: '正常', label: '正常' },
            { value: '延迟', label: '延迟' },
            { value: '部分中断', label: '部分中断' },
            { value: '数据中断', label: '数据中断' },
          ]} />
          <Select value={run} onChange={v => { setRun(v); setPage(1); }} style={{ width: 130 }} options={[
            { value: 'all', label: '全部运行' },
            { value: '运行', label: '运行' },
            { value: '待机', label: '待机' },
            { value: '故障', label: '故障' },
            { value: '无数据', label: '无数据' },
          ]} />
          <Input allowClear prefix={<Search size={13} />} placeholder="设备名称 / 资产编号" style={{ width: 200 }} value={kw} onChange={e => { setKw(e.target.value); setPage(1); }} />
        </Space>
      </Card>

      {filtered.length === 0 ? (
        <Card size="small">
          <EmptyState
            description="没有匹配当前筛选条件的在用设备"
            reason="可能筛选过严，或所选状态下暂无设备"
            next="重置筛选"
            onNext={() => { setWorkshop('all'); setHealth('all'); setRun('all'); setKw(''); setPage(1); }}
            nextLabel="重置筛选"
          />
        </Card>
      ) : (
        <div className="rt-grid">
          {paged.map(r => <DeviceCard key={r.deviceId} row={r} />)}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 14 }}>
        <Pagination
          size="small"
          current={page}
          pageSize={pageSize}
          total={filtered.length}
          onChange={setPage}
          showTotal={t => `共 ${t} 台`}
        />
      </div>
    </>
  );
}
