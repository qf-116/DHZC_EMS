import React from 'react';
import { Card, Space, Select, InputNumber, Switch, Cascader, Radio, Input, Button } from 'antd';

const RULE_TYPE_LABEL = { threshold: '阈值规则', state: '状态规则', quality: '质量规则', combo: '组合规则' };

// 报警规则表单主体（新增向导第 2 步 / 编辑弹窗共用）
// 受控表单：所有字段变化经 patch/patchTrigger 等回调写入外部 form 状态，组件本身不持有业务状态。
// showTarget=false 时隐藏「规则目标」区块（新增向导第 1 步已确定目标）。
export default function RuleFormBody({
  form,
  patch,
  patchTrigger,
  patchRecoveryCondition,
  changeRuleType,
  changeTarget,
  currentTarget,
  cascadeOptions,
  cascadeStateOptions,
  enumOptions,
  deviceOptions,
  targets,
  disabled = false,
  showTarget = true,
  showTypeSelect = true,
}) {
  const metricUnit = currentTarget?.metric?.unit || '';
  const step = currentTarget?.metricCode === 'M.air_pressure' ? 0.05 : 1;
  const fineStep = currentTarget?.metricCode === 'M.air_pressure' ? 0.01 : 1;

  return (
    <Space direction="vertical" style={{ width: '100%' }} size={12}>
      {showTypeSelect && (
        <Space wrap>
          <Select
            value={form.type}
            disabled={disabled}
            onChange={changeRuleType}
            style={{ width: 130 }}
            options={[
              { value: 'threshold', label: '阈值' },
              { value: 'state', label: '状态' },
              { value: 'quality', label: '质量' },
              { value: 'combo', label: '组合' },
            ]}
          />
          <Select
            value={form.severity}
            disabled={disabled}
            onChange={(v) => patch({ severity: v })}
            style={{ width: 100 }}
            options={['紧急', '重要', '一般', '提示'].map((v) => ({ value: v, label: v }))}
          />
        </Space>
      )}

      {showTarget && (
        <Card size="small" title="规则目标">
          <Space direction="vertical" style={{ width: '100%' }}>
            {form.type === 'quality' ? (
              <Select
                placeholder="选择质量监控设备（启用绑定中的设备）"
                style={{ width: '100%' }}
                disabled={disabled}
                value={form.target.deviceId || undefined}
                onChange={(v) => patch({ target: { deviceId: v || null, sourceId: null, metricCode: null } })}
                options={deviceOptions}
                showSearch
                optionFilterProp="label"
              />
            ) : (
              <Cascader
                style={{ width: '100%' }}
                className="rule-target-cascader"
                disabled={disabled}
                value={[form.target.deviceId, form.target.sourceId, form.target.metricCode].filter(Boolean)}
                options={form.type === 'state' ? cascadeStateOptions : cascadeOptions}
                onChange={changeTarget}
                placeholder={form.type === 'state' ? '① 系统设备 → ② 子设备 → ③ 状态类指标（S.*）' : '① 系统设备 → ② 子设备（主设备 / 传感器）→ ③ 已勾选指标'}
                showSearch
              />
            )}
            {currentTarget && form.type !== 'quality' && (
              <div style={{ fontSize: 12, color: '#5d6b78', lineHeight: 1.7 }}>
                指标：{currentTarget.metric.name}（{currentTarget.metricCode}）· 单位 {currentTarget.metric.unit || '--'} ·{' '}
                {currentTarget.metric.enumValues
                  ? `取值 ${currentTarget.metric.enumValues.join(' / ')}`
                  : `量程 ${currentTarget.metric.range ? `${currentTarget.metric.range.min} ~ ${currentTarget.metric.range.max}` : '--'}`}
              </div>
            )}
          </Space>
        </Card>
      )}

      <Card size="small" title="① 触发条件" extra={<span style={{ fontSize: 12, color: '#5d6b78' }}>{RULE_TYPE_LABEL[form.type]}配置方式</span>}>
        <Space direction="vertical" style={{ width: '100%' }} size={8}>
          {form.type === 'threshold' && (
            <>
              <Space wrap>
                <span>判定模式</span>
                <Select
                  value={form.triggerConfig.mode}
                  disabled={disabled}
                  onChange={(v) => patchTrigger({ mode: v, operator: v === 'lower' ? '<' : '>' })}
                  style={{ width: 250 }}
                  options={[
                    { value: 'upper', label: '越上限（值 > 阈值 为异常）' },
                    { value: 'lower', label: '越下限（值 < 阈值 为异常）' },
                    { value: 'rangeOut', label: '区间外（超出正常区间 为异常）' },
                    { value: 'rangeIn', label: '区间内（落入区间 为异常）' },
                  ]}
                />
              </Space>
              {['rangeOut', 'rangeIn'].includes(form.triggerConfig.mode) ? (
                <Space wrap>
                  <span>{form.triggerConfig.mode === 'rangeOut' ? '正常区间' : '异常区间'}</span>
                  <InputNumber value={form.triggerConfig.low} disabled={disabled} step={step} onChange={(v) => patchTrigger({ low: v })} />
                  <span>~</span>
                  <InputNumber value={form.triggerConfig.high} disabled={disabled} step={step} onChange={(v) => patchTrigger({ high: v })} />
                  <span>{metricUnit}</span>
                  <span>持续</span>
                  <InputNumber value={form.triggerConfig.durationSec} disabled={disabled} min={0} onChange={(v) => patchTrigger({ durationSec: v ?? 0 })} />
                  <span>秒 才触发</span>
                </Space>
              ) : (
                <Space wrap>
                  <span>{form.triggerConfig.mode === 'lower' ? '低于' : '高于'}</span>
                  <InputNumber value={form.triggerConfig.threshold} disabled={disabled} onChange={(v) => patchTrigger({ threshold: v })} step={step} />
                  <span>{metricUnit}</span>
                  <span>持续</span>
                  <InputNumber value={form.triggerConfig.durationSec} disabled={disabled} min={0} onChange={(v) => patchTrigger({ durationSec: v ?? 0 })} />
                  <span>秒 才触发</span>
                </Space>
              )}
            </>
          )}
          {form.type === 'state' && (
            <>
              <Space wrap>
                <span>异常状态（落入即立即触发）</span>
                <Select
                  mode="multiple"
                  placeholder="选择异常枚举，如：故障 / 无数据"
                  value={form.triggerConfig.abnormalValues}
                  disabled={disabled}
                  onChange={(v) => patchTrigger({ abnormalValues: v })}
                  options={enumOptions}
                  style={{ minWidth: 280 }}
                  maxTagCount="responsive"
                />
              </Space>
              <Space wrap>
                <span>正常状态（用于恢复判定）</span>
                <Select
                  mode="multiple"
                  placeholder="选择正常枚举，如：运行 / 待机"
                  value={form.triggerConfig.normalValues}
                  disabled={disabled}
                  onChange={(v) => patchTrigger({ normalValues: v })}
                  options={enumOptions}
                  style={{ minWidth: 280 }}
                  maxTagCount="responsive"
                />
              </Space>
            </>
          )}
          {form.type === 'quality' && (
            <>
              <Space wrap>
                <span>质量规则类型</span>
                <Select
                  value={form.triggerConfig.mode}
                  disabled={disabled}
                  onChange={(v) => patchTrigger({ mode: v })}
                  style={{ width: 260 }}
                  options={[
                    { value: 'outage', label: '数据中断（订阅断开 / 拉取超时）' },
                    { value: 'invalidRate', label: '无效率超限（BAD 占比）' },
                    { value: 'delay', label: '采集延迟超限' },
                  ]}
                />
              </Space>
              <Space wrap>
                <span>持续</span>
                <InputNumber value={form.triggerConfig.durationMin} disabled={disabled} min={1} onChange={(v) => patchTrigger({ durationMin: v ?? 5 })} />
                <span>分钟未恢复即产生质量报警</span>
                {form.triggerConfig.mode === 'invalidRate' && (
                  <>
                    <span>；无效率阈值</span>
                    <InputNumber value={form.triggerConfig.invalidRatePercent} disabled={disabled} min={0} max={100} onChange={(v) => patchTrigger({ invalidRatePercent: v })} />
                    <span>%</span>
                  </>
                )}
                {form.triggerConfig.mode === 'delay' && (
                  <>
                    <span>；最大允许延迟</span>
                    <InputNumber value={form.triggerConfig.delaySec} disabled={disabled} min={1} onChange={(v) => patchTrigger({ delaySec: v })} />
                    <span>秒</span>
                  </>
                )}
              </Space>
            </>
          )}
          {form.type === 'combo' && (
            <>
              <Space wrap>
                <span>组合关系</span>
                <Select
                  value={form.triggerConfig.operator}
                  disabled={disabled}
                  onChange={(v) => patchTrigger({ operator: v })}
                  style={{ width: 180 }}
                  options={[{ value: 'AND', label: '全部满足（AND）' }, { value: 'OR', label: '任一满足（OR）' }]}
                />
                <span>时间窗口</span>
                <InputNumber value={form.triggerConfig.windowSec} disabled={disabled} min={1} onChange={(v) => patchTrigger({ windowSec: v ?? 300 })} />
                <span>秒</span>
              </Space>
              {form.triggerConfig.conditions.map((c, idx) => (
                <Space key={idx} wrap style={{ width: '100%', justifyContent: 'space-between' }}>
                  <Space wrap>
                    <span>子条件 {String.fromCharCode(65 + idx)}</span>
                    <Cascader
                      style={{ width: 320 }}
                      className="rule-target-cascader"
                      disabled={disabled}
                      value={[c.target?.deviceId, c.target?.sourceId, c.target?.metricCode].filter(Boolean)}
                      options={cascadeOptions}
                      onChange={(path) => {
                        const [deviceId, sourceId, metricCode] = path;
                        const t = targets.find((x) => x.deviceId === deviceId && x.sourceId === sourceId && x.metricCode === metricCode);
                        const conditions = [...form.triggerConfig.conditions];
                        conditions[idx] = { ...c, target: { deviceId: deviceId || null, sourceId: sourceId || null, metricCode: metricCode || null }, unit: t?.metric.unit || '' };
                        patchTrigger({ conditions });
                      }}
                      placeholder="目标（设备 → 子设备 → 指标）"
                      showSearch
                    />
                    <Select value={c.operator} disabled={disabled} onChange={(v) => { const conditions = [...form.triggerConfig.conditions]; conditions[idx] = { ...c, operator: v }; patchTrigger({ conditions }); }} style={{ width: 70 }} options={[{ value: '>', label: '>' }, { value: '<', label: '<' }]} />
                    <InputNumber value={c.value} disabled={disabled} onChange={(v) => { const conditions = [...form.triggerConfig.conditions]; conditions[idx] = { ...c, value: v }; patchTrigger({ conditions }); }} step={0.1} />
                    <span>持续</span>
                    <InputNumber value={c.durationSec} disabled={disabled} min={0} onChange={(v) => { const conditions = [...form.triggerConfig.conditions]; conditions[idx] = { ...c, durationSec: v ?? 0 }; patchTrigger({ conditions }); }} />
                    <span>秒</span>
                  </Space>
                  <a style={{ color: '#d64545' }} onClick={() => patchTrigger({ conditions: form.triggerConfig.conditions.filter((_, i) => i !== idx) })}>删除</a>
                </Space>
              ))}
              <Button
                type="dashed"
                block
                disabled={disabled}
                onClick={() => patchTrigger({ conditions: [...form.triggerConfig.conditions, { target: { deviceId: null, sourceId: null, metricCode: null }, operator: '>', value: null, durationSec: 60 }] })}
              >
                + 添加子条件（至少 2 个）
              </Button>
            </>
          )}
        </Space>
      </Card>

      <Card size="small" title="② 恢复条件" extra={<span style={{ fontSize: 12, color: '#5d6b78' }}>{RULE_TYPE_LABEL[form.type]}恢复口径</span>}>
        <Space direction="vertical" style={{ width: '100%' }} size={8}>
          <Space wrap>
            <span>恢复方式</span>
            <Select value="auto" disabled style={{ width: 190 }} options={[{ value: 'auto', label: '自动恢复（满足条件）' }, { value: 'business', label: '恢复后业务闭环（随维修验收）' }, { value: 'manual', label: '人工确认关闭' }]} />
          </Space>
          {form.type === 'threshold' && ['rangeOut', 'rangeIn'].includes(form.triggerConfig.mode) && (
            <Space wrap>
              <span>恢复区间 = [下限 +</span>
              <InputNumber value={form.recoveryConfig.condition.lowDeadband ?? 0} disabled={disabled} step={fineStep} min={0} onChange={(v) => patchRecoveryCondition({ lowDeadband: v ?? 0 })} />
              <span>, 上限 −</span>
              <InputNumber value={form.recoveryConfig.condition.highDeadband ?? 0} disabled={disabled} step={fineStep} min={0} onChange={(v) => patchRecoveryCondition({ highDeadband: v ?? 0 })} />
              <span>]（独立回差）持续</span>
              <InputNumber value={form.recoveryConfig.stabilize.durationSec} disabled={disabled} min={0} onChange={(v) => patch({ recoveryConfig: { ...form.recoveryConfig, stabilize: { ...form.recoveryConfig.stabilize, durationSec: v ?? 0 } } })} />
              <span>秒</span>
            </Space>
          )}
          {form.type === 'threshold' && !['rangeOut', 'rangeIn'].includes(form.triggerConfig.mode) && (
            <>
              <Space wrap>
                <span>恢复阈值</span>
                <Radio.Group
                  value={form.recoveryConfig.condition.thresholdMode}
                  disabled={disabled}
                  onChange={(e) => patchRecoveryCondition({ thresholdMode: e.target.value })}
                  options={[{ value: 'deadband', label: '按回差' }, { value: 'explicit', label: '直接指定' }]}
                  optionType="button"
                />
                {form.recoveryConfig.condition.thresholdMode === 'deadband' ? (
                  <>
                    <span>= 触发阈值 {form.triggerConfig.mode === 'lower' ? '+' : '−'}</span>
                    <InputNumber value={form.recoveryConfig.condition.deadband} disabled={disabled} min={0} onChange={(v) => patchRecoveryCondition({ deadband: v ?? 0 })} step={fineStep} />
                    <span>（回差）</span>
                  </>
                ) : (
                  <InputNumber value={form.recoveryConfig.condition.recoveryValue} disabled={disabled} onChange={(v) => patchRecoveryCondition({ recoveryValue: v })} step={fineStep} placeholder="恢复阈值" />
                )}
                <span>{metricUnit}</span>
              </Space>
              <Space wrap>
                <span>恢复稳定</span>
                <InputNumber value={form.recoveryConfig.stabilize.durationSec} disabled={disabled} min={0} onChange={(v) => patch({ recoveryConfig: { ...form.recoveryConfig, stabilize: { ...form.recoveryConfig.stabilize, durationSec: v ?? 0 } } })} />
                <span>秒（GOOD 数据持续；无效数据保持报警，再次超限计时归零）</span>
              </Space>
            </>
          )}
        </Space>
      </Card>

      <Card size="small" title="③ 重复报警抑制">
        <Space direction="vertical" size={8}>
          <Switch disabled checkedChildren="活动事件未关闭期间抑制重复触发（系统统一口径）" checked />
          <Space wrap>
            <Switch
              checked={form.suppressionConfig.remindEnabled}
              disabled={disabled}
              checkedChildren="重复提醒开启"
              unCheckedChildren="不重复提醒"
              onChange={(v) => patch({ suppressionConfig: { ...form.suppressionConfig, remindEnabled: v } })}
            />
            <span>抑制期间每</span>
            <InputNumber value={form.suppressionConfig.remindIntervalMin} disabled={disabled} min={1} onChange={(v) => patch({ suppressionConfig: { ...form.suppressionConfig, remindIntervalMin: v ?? 5 } })} />
            <span>分钟重复提醒一次（不新建事件）</span>
          </Space>
        </Space>
      </Card>

      <Card size="small" title="④ 报警风暴保护（限流合并）">
        <Space direction="vertical" size={8}>
          <Space wrap>
            <Switch
              checked={form.stormConfig.enabled}
              disabled={disabled}
              checkedChildren="风暴保护开启"
              unCheckedChildren="关闭"
              onChange={(v) => patch({ stormConfig: { ...form.stormConfig, enabled: v } })}
            />
            <span>统计窗口</span>
            <InputNumber value={form.stormConfig.windowMin} disabled={disabled || !form.stormConfig.enabled} min={1} addonAfter="分钟" onChange={(v) => patch({ stormConfig: { ...form.stormConfig, windowMin: v ?? 60 } })} />
            <span>内最多新建</span>
            <InputNumber value={form.stormConfig.maxEvents} disabled={disabled || !form.stormConfig.enabled} min={1} addonAfter="条" onChange={(v) => patch({ stormConfig: { ...form.stormConfig, maxEvents: v ?? 3 } })} />
          </Space>
          {form.stormConfig.enabled && (
            <Space wrap>
              <span>统计范围</span>
              <Select value={form.stormConfig.scope} disabled={disabled} style={{ width: 170 }} onChange={(v) => patch({ stormConfig: { ...form.stormConfig, scope: v } })} options={[{ value: 'sameRule', label: '同规则' }, { value: 'sameDevice', label: '同设备' }, { value: 'sameMetric', label: '同指标' }]} />
              <span>超限动作</span>
              <Select value={form.stormConfig.overflowAction} disabled={disabled} style={{ width: 170 }} onChange={(v) => patch({ stormConfig: { ...form.stormConfig, overflowAction: v } })} options={[{ value: 'merge', label: '合并到首条事件' }, { value: 'downgrade', label: '降级为提示' }, { value: 'pauseNew', label: '暂停新建事件' }]} />
            </Space>
          )}
        </Space>
      </Card>

      <Card size="small" title="⑤ 静默时段（规则级）">
        <Space direction="vertical" size={8} style={{ width: '100%' }}>
          <Space wrap>
            <Switch
              checked={form.silenceConfig.enabled}
              disabled={disabled}
              checkedChildren="本规则静默已启用"
              unCheckedChildren="未启用规则级静默"
              onChange={(v) => patch({ silenceConfig: { ...form.silenceConfig, enabled: v, source: v ? 'override' : 'template' } })}
            />
            <Switch disabled checkedChildren="计划停机期间静默" checked />
          </Space>
          {form.silenceConfig.enabled && (
            <>
              {form.silenceConfig.windows.map((w, idx) => (
                <Space key={idx} wrap>
                  <span>静默 {idx + 1}</span>
                  <Input style={{ width: 110 }} value={w.start} disabled={disabled} placeholder="22:00" onChange={(e) => { const windows = [...form.silenceConfig.windows]; windows[idx] = { ...w, start: e.target.value }; patch({ silenceConfig: { ...form.silenceConfig, windows } }); }} />
                  <span>~</span>
                  <Input style={{ width: 110 }} value={w.end} disabled={disabled} placeholder="07:00" onChange={(e) => { const windows = [...form.silenceConfig.windows]; windows[idx] = { ...w, end: e.target.value }; patch({ silenceConfig: { ...form.silenceConfig, windows } }); }} />
                  <a style={{ color: '#d64545' }} onClick={() => patch({ silenceConfig: { ...form.silenceConfig, windows: form.silenceConfig.windows.filter((_, i) => i !== idx) } })}>删除</a>
                </Space>
              ))}
              <Button type="dashed" block disabled={disabled} onClick={() => patch({ silenceConfig: { ...form.silenceConfig, windows: [...form.silenceConfig.windows, { start: '22:00', end: '07:00' }] } })}>+ 添加静默时段</Button>
            </>
          )}
        </Space>
      </Card>
    </Space>
  );
}
