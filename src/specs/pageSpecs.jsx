import React from 'react';

// ============================================================
// 页面需求细则（应用内「需求细则」抽屉）
// 口径与重构后的演示数据驱动模式一致：
//   - 数据全部来自 DemoStore（localStorage 键 dms-demo:state，STORE_VERSION = 3）
//   - 派生数据一律 selector 计算；动作经 actions 工厂派发 reducer（含幂等键）
//   - 演示时钟基准 2026-09-16T16:41:08+08:00，每次动作 +7 秒
// ============================================================

// 字段定义表：需求细则弹窗内展示「字段 / 定义与公式」两列表格
function Fields({ items }) {
  return (
    <table className="spec-fields">
      <tbody>
        {items.map(([k, v]) => (
          <tr key={k}><th>{k}</th><td>{v}</td></tr>
        ))}
      </tbody>
    </table>
  );
}

// ---------- 共享说明片段：演示数据流（写入各 spec 的「数据来源与刷新」节） ----------
const DATA_SOURCE_NOTE = (
  <>
    <p>本系统为演示数据驱动模式：所有页面数据来自 DemoStore 共享状态层，持久化于 localStorage 键 <code>dms-demo:state</code>（快照结构版本 STORE_VERSION = 5，版本不符或解析失败自动恢复初始剧本并提示）。工作台提供「重置演示」一键恢复标准演示剧本。</p>
    <p>派生数据一律由 selector 计算（如 OEE 由 oeeInputs + 停机事实 + 速度配置实时推导，非静态值）；动作经 actions 工厂构造标准 action（含 actionId、幂等键、actorContext）后派发 reducer，重复幂等键不产生新事实并返回原结果。演示时钟基准 2026-09-16T16:41:08+08:00，每次动作推进 7 秒，全程可重放。</p>
    <p>页面顶部以 DataSourceBadge 标识演示数据源（演示轮询 / 演示订阅 / 已断开）；meta.degraded 时显示降级横幅。本系统不含真实 API 与 WebSocket。</p>
    <p>空值语义：null / 未配置 / 不可计算一律显示「--」，与数字 0 严格区分；空态用 EmptyState 说明原因与下一步。</p>
  </>
);

const DEMO_SCRIPTS_NOTE = (
  <>
    <p>三个标准演示剧本（「重置演示」后恢复）：</p>
    <ol>
      <li>剧本 A —— DEV-004 数控铲齿机-04 故障闭环：主轴温度高高报警 → 确认 → 处置 → 生成维修单 → 领用备件 120004 ×2 → 提交验收 → 验收通过 → 报警恢复关闭。</li>
      <li>剧本 B —— DEV-002 CNC加工中心-02 数据延迟（qualityCode = DELAYED，延迟 32s）+ MES 程序参数不一致（进给倍率 120% 超基线 105% ±3%）。</li>
      <li>剧本 C —— DEV-005 机器人焊接-05 离线无数据：指标全部显示「--」，不显示 0。</li>
    </ol>
  </>
);

// ---------- 范围外页面统一 spec（§0.3 / §7.3） ----------
const outOfScopeSpec = {
  title: '范围外页面',
  content: (
    <>
      <h4>页面目标</h4>
      <p>说明该路由属于本次演示范围之外：由宿主平台或其他业务模块承接，本系统不提供页面功能。</p>
      <h4>依据</h4>
      <ol>
        <li>设计方案 §0.3「明确不做」：点检、巡检、保养、系统管理（权限 / 审计）与旧采集配置、旧数据接入路径不在本系统实现范围内。</li>
        <li>设计方案 §7.3「范围外路由」：点检、巡检、保养、系统管理、权限、审计、旧采集配置和旧数据接入路径统一渲染范围外提示页，说明「由宿主平台或其他业务模块提供 / 本次演示不包含」，并提供返回白名单入口。</li>
      </ol>
      <h4>覆盖路由</h4>
      <p><code>/inspection-*</code>（点检）、<code>/maintenance-*</code>（保养）、<code>/patrol-*</code>（巡检）、<code>/permissions</code>（权限管理）、<code>/audit</code>（操作审计）、<code>/report/inspection | /report/patrol | /report/maintenance</code>（点检 / 巡检 / 保养执行统计报表）。</p>
      <h4>规则</h4>
      <ol>
        <li>本系统菜单已收敛到白名单页面，范围外路由不再出现在导航中；直接访问 URL 时渲染本提示页而非报错。</li>
        <li>旧路由（如 /net-config、/metric-dictionary）只允许重定向到已确认的新白名单页面（联网配置总览 / 平台指标清单），不得把范围外页面继续放入菜单。</li>
        <li>本页不消费 DemoStore 业务事实，不提供任何业务动作。</li>
      </ol>
    </>
  ),
};

// ---------- 旧报表路由重定向说明 ----------
const reportRedirectSpec = {
  title: '旧报表路由（已重定向）',
  content: (
    <>
      <h4>说明</h4>
      <p>旧报表聚合入口 <code>/reports</code>、<code>/metrics</code>、<code>/report/status</code> 已按设计方案路由收敛原则重定向到 <code>/report/runtime</code>（运行时长与设备状态统计报表）。本页仅为重定向说明，不承载业务数据。</p>
      <h4>规则</h4>
      <ol>
        <li>旧路由只允许重定向到白名单报表页面，不允许继续渲染旧页面。</li>
        <li>各报表口径（数据来源、字段定义、导出与空态）见对应报表 spec 与通用报表口径说明。</li>
      </ol>
    </>
  ),
};

const specs = {
  // 生命周期工作台（/lifecycle/workbench）已按需求下线（2026-09-22），旧路由重定向到 /lifecycle/tasks；
  // 页面文件 LifecycleWorkbenchPage.jsx 保留备用，恢复时连同菜单/路由与本条细则一并还原。
  '/lifecycle/tasks': {
    title: '设备入账流程',
    content: (
      <>
        <h4>页面目标</h4>
        <p>用一个统一任务串联「采购入账 → 使用部门试用确认 → 设备办理手续入账」。来源口径：采购到货信息统一由采购系统（SRM/WMS 同一来源）同步生成任务，信息完整、直接显示在列表内并进入试用确认，<b>不需要人工新建</b>；「手工新增」入口仅用于设备管理系统自主发起的补录场景（直送现场 / 历史设备 / 接口未覆盖），必须填写来源说明，填完一步提交进入试用确认。</p>
        <h4>状态流转</h4>
        <ol>
          <li>采购系统同步任务：到货即入 <code>使用部门试用确认中</code>（无人工采购入账节点）。</li>
          <li>手工新增任务：填写采购入账信息提交后进入 <code>使用部门试用确认中</code>。</li>
          <li>试用合格进入 <code>待设备手续入账</code>，设备管理员完成手续后进入 <code>设备已入账</code>。</li>
          <li>试用不合格进入 <code>试用不合格退回</code>，补充或更换后可重新提交试用。</li>
        </ol>
        <h4>节点字段</h4>
        <Fields items={[
          ['采购入账', '来源说明（手工新增必填）、设备名称、型号/规格、数量、品牌、供应商、采购订单号、合同号、发货时间、使用部门、试用负责人、合同/发货凭证；同步任务的采购信息由采购系统带入、不可编辑'],
          ['试用确认', '试用结论（合格/不合格）、使用部门意见、主要问题（不合格必填）；原始采购信息和历次试用意见保留'],
          ['设备手续入账', '设备名称、设备类型、车间、产线、工位、设备负责人、资产编号、质保期、验收单、设备档案；系统按任务生成设备编码和台账'],
          ['任务列表', '流程任务号、设备名称、型号、品牌、数量、使用部门、当前节点、来源、操作'],
          ['流程详情', '任务号、状态、设备、来源、试用结论、入账状态、时间线、处理人和处理说明'],
        ]} />
        <h4>交互规则</h4>
        <ul>
          <li>直接访问试用确认或设备手续入账路由时，自动选中第一条匹配待办；没有待办时列表保持空态，可通过「手工新增采购入账」入口处理补录场景。</li>
          <li>任务与设备的关联规则：采购入账阶段设备尚不存在（不填设备编号）；「设备办理手续入账」提交时系统按采购数量批量生成设备编码并写入台账，同时建立双向关联——设备档案.sourceTaskId ↔ 任务.registration.deviceIds；入账前弹窗按当前台账规模预览将生成的编码，流程详情展示入账设备并可跳转台账详情。</li>
          <li>提交后核心采购信息随任务进入下一节点，后续修改必须通过退回后的采购节点完成。</li>
          <li>数量大于 1 时，入账完成会按当前演示规则批量生成对应数量的设备台账。</li>
          <li>所有动作经 <code>createLifecycleTask / submitLifecycleProcurement / confirmLifecycleTrial / registerLifecycleDevice</code> 进入 reducer，重复提交由幂等键拦截。</li>
        </ul>
        <h4>明确不做</h4>
        <p>到货记录、开箱核验、入厂登记、安装、调试、试运行、独立技术验收、条件通过、移位、保全和报废处置执行均不在本页面实现。</p>
      </>
    ),
  },
  '/lifecycle/changes': {
    title: '资产变更',
    content: (
      <>
        <h4>页面目标</h4>
        <p>对已入账设备发起并跟踪调拨、改造、借用和外送，保证资产责任和 custody 状态变化有单据、审批和履历。</p>
        <h4>字段</h4>
        <Fields items={[
          ['变更类型', '调拨 / 改造 / 借用 / 外送；不提供移位'],
          ['变更对象', '已入账且未报废归档的设备；选择后展示设备名称和台账编码'],
          ['变更原因', '必填，说明产能调整、功能改造、临时借用或外送服务背景'],
          ['目标信息', '目标部门/借用方/外送方和目标责任人；调拨完成时更新设备责任'],
          ['计划日期', '变更计划执行日期；执行时填写实际完成日期和执行说明'],
          ['状态', '待审批 → 审批通过/已驳回 → 已完成；驳回单保留历史意见'],
        ]} />
        <h4>动作链</h4>
        <ol>
          <li><code>createAssetChange</code> 提交申请。</li>
          <li><code>approveAssetChange</code> 完成通过或驳回。</li>
          <li><code>completeAssetChange</code> 登记执行结果并写入设备生命周期履历。</li>
        </ol>
        <h4>边界</h4>
        <p>不做移位、独立位置变更和普通台账编辑替代变更；已报废/归档设备不可发起新变更。</p>
      </>
    ),
  },
  '/lifecycle/idle': {
    title: '闲置与再启用',
    content: (
      <>
        <h4>页面目标</h4>
        <p>登记设备闲置原因和复核计划，跟踪复核结论；再启用后设备恢复在用状态并可重新参与后续管理。</p>
        <h4>字段</h4>
        <Fields items={[
          ['闲置对象', '在用设备；发起后写入闲置申请和设备履历'],
          ['闲置原因 / 盘活建议', '说明订单调整、工艺变化或转用于其他产线等建议'],
          ['开始时间 / 复核日期', '闲置开始和下次复核日期；到期复核为后续生产化提醒口径'],
          ['复核结论', '继续闲置 / 再启用 / 转报废'],
          ['复核意见', '必填，记录复核责任人的判断依据'],
        ]} />
        <h4>动作链</h4>
        <ol>
          <li><code>createIdleApplication</code> 提交闲置申请。</li>
          <li><code>reviewIdleApplication</code> 提交继续闲置、再启用或转报废结论。</li>
          <li>再启用后设备生命周期状态恢复「在用」；转报废结论由报废模块继续处理。</li>
        </ol>
        <h4>边界</h4>
        <p>不建设保全计划、定期通电、润滑、防锈和保全费用；不因闲置删除设备历史绑定和运行数据。</p>
      </>
    ),
  },
  '/lifecycle/scrap': {
    title: '报废与归档',
    content: (
      <>
        <h4>页面目标</h4>
        <p>管理设备退出：报废申请、技术鉴定、财务核销确认和最终归档。只有核销确认后设备才进入报废/归档状态。</p>
        <h4>字段</h4>
        <Fields items={[
          ['报废对象', '未报废归档的设备；申请后进入技术鉴定中'],
          ['报废原因', '必填，说明技术淘汰、故障频繁或维修经济性差等原因'],
          ['原值 / 账面价值', '财务参考字段；本系统不做折旧和会计凭证'],
          ['技术鉴定', '同意报废 / 不建议报废，鉴定意见必填'],
          ['财务核销', '核销单号必填；核销后设备生命周期状态更新为报废/归档'],
          ['归档', '核销后的单据可归档，归档后保留只读履历'],
        ]} />
        <h4>动作链</h4>
        <ol>
          <li><code>createScrapApplication</code> 提交报废申请。</li>
          <li><code>appraiseScrap</code> 完成技术鉴定。</li>
          <li><code>confirmScrapWriteOff</code> 确认财务核销，设备停止参与 OEE。</li>
          <li><code>archiveScrap</code> 将已核销单据归档。</li>
        </ol>
        <h4>边界</h4>
        <p>不建设拆除、出售、回收、称重、运输、环保联单和处置去向管理；技术鉴定未通过或财务未核销时不得归档。</p>
      </>
    ),
  },
  '/': {
    title: '工作台（原监测总览）',
    content: (
      <>
        <h4>页面目标</h4>
        <p>行动入口（§7.1）：汇总待办与异常，帮助值班 / 管理人员在 10 秒内决定下一步处置动作，并快速跳转到对应页面；不复制完整 KPI 看板。</p>
        <h4>数据来源与刷新</h4>
        <ol>
          <li>汇总读模型来自 <code>selectWorkbench(state)</code>：一次派生待处理报警、处理中报警、维修待办、待验收、低库存、接入异常、降级设备七类列表，不由本页自行拼装跨域事实。</li>
          <li>{DATA_SOURCE_NOTE}</li>
        </ol>
        <h4>字段定义与计算公式</h4>
        <Fields items={[
          ['待处理报警（unacked）', '报警事件状态 = 已触发 的活动事件，按触发时间倒序；点击跳报警中心确认（剧本 A：DEV-004 主轴温度高高报警）'],
          ['处理中报警（processing）', '状态 ∈ {已确认, 处理中} 的事件数'],
          ['维修待办（pendingDispatch）', '维修主工单状态 = 待派工 的工单；点击跳维修任务派工'],
          ['待验收（pendingAccept）', '工单状态 = 待验收 的工单；点击跳维修工单验收'],
          ['低库存（lowStock）', '备件库存现存 < 安全库存（onHand < spare.safe）的库存行（演示：空压机滤芯 120006 现存 28 < 安全库存 40）；点击跳备件库存'],
          ['接入异常（ingestionIssues）', '接入任务状态 ∈ {失败, 重试中, 部分成功} 的任务（演示：IT-20260916-001 重试中 / -002 部分成功 / -003 失败）；点击跳联网配置总览'],
          ['降级设备（degradedDevices）', '通信健康状态 ∈ {延迟, 数据中断, 部分中断} 的设备（剧本 B：DEV-002 延迟 32s；剧本 C：DEV-005 数据中断）；点击跳设备监测详情'],
        ]} />
        <h4>交互规则</h4>
        <ol>
          <li>点击摘要卡片跳转对应页面并预置筛选（如点击「待验收」跳维修工单并筛选状态 = 待验收）。</li>
          <li>提供「重置演示」按钮：清空 localStorage 快照并以初始剧本状态替换（resetDemo 不走 reducer，直接以初始快照替换，§4.2）。</li>
          <li>{DEMO_SCRIPTS_NOTE}</li>
        </ol>
        <h4>边界与显示规则</h4>
        <ul>
          <li>数量为 0 是真实业务事实（如 0 条待验收），显示 0；数据不可得才显示「--」。</li>
          <li>某类目无数据时卡片保留并显示 0，避免误读为页面缺数据；列表区空态用 EmptyState 说明原因与下一步。</li>
          <li>路由 <code>/monitor-overview</code> 与 <code>/</code> 为同一页面的两个入口，共用本 spec。</li>
        </ul>
      </>
    ),
  },
  '/realtime': {
    title: '实时监控',
    content: (
      <>
        <h4>页面目标</h4>
        <p>值守人员的主工作页：全量联网设备实时状态一屏掌握，按紧急度排序保证最需要处理的设备排最前。</p>
        <h4>数据来源与刷新</h4>
        <ol>
          <li>指标行来自 <code>selectRealtime(state, deviceId)</code>：按绑定中启用项的勾选指标逐行派生 值 / 质量码 / 采集时间（sourceTime）/ 接收时间（receiveTime）/ 来源 IoT 编码 / 指标版本；运行状态取 S.machine_state 样本。</li>
          <li>数据源为演示三模式（setProviderMode）：演示轮询 mock-polling / 演示订阅 mock-subscription / 断开 disconnect；切到「断开」时 meta.degraded = true，全站显示降级横幅，旧值不再标记为实时。手动刷新（refreshRealtime）推进 lastSampleAt 并随机演示延迟 2~5s。无真实 API 与 WebSocket。</li>
          <li>{DATA_SOURCE_NOTE}</li>
        </ol>
        <h4>字段定义与计算公式</h4>
        <Fields items={[
          ['指标值', '最新样本 value；null 一律显示「--」——DEV-003 待机时主轴温度无值（NO_VALUE）、DEV-005 全部指标离线（OFFLINE）都不显示 0；DEV-003 主轴转速 0 是真实采集值，显示 0'],
          ['质量码', 'GOOD / DELAYED / NO_VALUE / OFFLINE；DELAYED 行标注数据延迟（剧本 B：DEV-002 延迟 32s）'],
          ['采集时间 sourceTime', '设备侧采样时间，决定统计分桶；接收时间 receiveTime 只用于延迟判定，二者严格分离，展示时成对给出'],
          ['通信健康', 'selectHealth 派生：状态（正常 / 延迟 / 部分中断 / 数据中断 / 未知）、延迟秒数、最后样本时间、质量率；DEV-007/008 未启用绑定显示「未知」'],
          ['运行状态', 'S.machine_state 样本值（运行 / 待机 / 故障）；无样本显示「无数据」（DEV-005），不参与运行状态统计'],
          ['报警数', 'selectActiveAlarms(deviceId) 活动事件数（未关闭即计入：已触发 + 已确认 + 处理中 + 已恢复待关闭）'],
          ['绑定状态', 'binding.configStatus（已启用 / 已停用 / 待生效 / 未配置）；未绑定设备（DEV-008）不产生指标行'],
        ]} />
        <h4>交互规则</h4>
        <ol>
          <li>数据源模式下拉切换（演示轮询 / 演示订阅 / 断开），切换立即生效并用于降级演示。</li>
          <li>点击设备名进入设备监测详情（/device/:deviceId，param 路由）。</li>
          <li>筛选维度（车间 / 运行状态 / 健康状态 / 关键词）为演示态，刷新不重置已选筛选。</li>
        </ol>
        <h4>边界与显示规则</h4>
        <ul>
          <li>断开模式保留最后一次展示值但整行弱化并标注「数据已断开」，不伪装成实时。</li>
          <li>数据延迟设备（DEV-002）在采集时间处显示延迟标识与延迟秒数。</li>
          <li>设备身份、通信、运行状态三列永远显示；未勾选指标不渲染行，不显示「--」占位混淆「未配置」与「无数据」。</li>
        </ul>
      </>
    ),
  },
  '/device/:deviceId': {
    title: '设备监测详情（设备 360）',
    content: (
      <>
        <h4>页面目标</h4>
        <p>单台设备的二级页面（param 路由 <code>/device/:deviceId</code>，从实时监控 / 工作台点击设备进入，不在左侧菜单显示）：一屏汇总该设备实时、健康、绑定、报警、维修、停机与 OEE 视图。</p>
        <h4>数据来源与刷新</h4>
        <ol>
          <li>整页读模型来自 <code>selectDevice360(state, deviceId)</code>：一次性返回 device（含 crosswalk 映射后的台账编码与位置）、crosswalk、binding、realtime、health、activeAlarms、repair（工单 + 报修）、downtime、oee（实时窗口）、ingestionTasks、businessHistory。</li>
          <li>canonical deviceId 为 DEV-001..008；台账资产码 MT2024A1201..1208 经 deviceCrosswalk 映射展示，两个编码体系同屏标注来源。</li>
          <li>{DATA_SOURCE_NOTE}</li>
        </ol>
        <h4>字段定义与计算公式</h4>
        <Fields items={[
          ['设备身份', 'deviceId（canonical）+ assetCode（台账）+ monitorCode（监测编码）+ 车间 / 产线 / 工位（selectDevice 拼接 location）'],
          ['绑定信息', 'selectBinding：版本、配置状态（未配置 / 草稿 / 校验通过 / 待生效 / 已启用 / 已停用 / 换绑中）、来源设备（1 主 + N 子）、勾选指标'],
          ['通信健康', 'selectHealth：状态 / 延迟 / 最后样本时间 / 质量率（DEV-002 延迟 32s；DEV-005 数据中断）'],
          ['实时指标', 'selectRealtime 指标行（值 / 质量码 / sourceTime），null 显示「--」'],
          ['活动报警', 'selectActiveAlarms(deviceId)：未关闭事件列表，含 dedupeKey、重复计数、关联工单 / 停机'],
          ['维修履历', 'selectRepairThread：该设备全部主工单与报修记录，按创建时间倒序'],
          ['停机事实', 'selectDowntime(deviceId)：统一停机事实（计划停机 / 故障停机 / 维修停机 / 换模 / 待料 / 数据中断），进行中事实无结束时间显示「--」'],
          ['实时 OEE', 'selectOeeResult(window=realtime)：三率与 OEE；不可计算时显示 blockers 原因（DEV-005：该窗口无生产数据）'],
          ['接入任务', 'selectIngestionTasks(deviceId)：该设备的拉取 / 补传 / 补偿任务及失败原因'],
          ['业务履历', 'selectBusinessHistory(device, deviceId)：动作产生的履历流水（报警确认、派工、绑定变更等）'],
        ]} />
        <h4>交互规则</h4>
        <ol>
          <li>页头提供「设备台账详情」链接（/device-ledger/detail/:deviceId），档案与监测设备经 crosswalk 同码对齐。</li>
          <li>报警确认 / 处置 / 关闭、维修派工等动作跳转报警中心 / 维修模块完成，本页不重复提供状态变更入口。</li>
          <li>OEE 区块显示目标值与 blockers；点击可跳历史 OEE 详情。</li>
        </ol>
        <h4>边界与显示规则</h4>
        <ul>
          <li>未知 deviceId（如 /device/DEV-999）：selectDevice 返回 null，页面显示「未找到对象」EmptyState 并说明有效编号范围，禁止回退显示第一条设备。</li>
          <li>DEV-005（剧本 C）：通信显示「数据中断」，指标区全部「--」，OEE 显示不可计算原因，不显示 0。</li>
          <li>DEV-008 未绑定：绑定区显示「未配置」与首绑入口提示；DEV-007 绑定「已停用」并显示停用留痕。</li>
        </ul>
      </>
    ),
  },
  '/alarm-center': {
    title: '报警中心',
    content: (
      <>
        <h4>页面目标</h4>
        <p>报警事件的唯一处置入口：从触发到关闭的全生命周期闭环管理，所有动作可追溯。</p>
        <h4>数据来源与刷新</h4>
        <ol>
          <li>事件列表来自 <code>selectAllAlarms / selectActiveAlarms</code>；详情时间线来自 <code>selectAlarmTimeline(alarmId)</code>；通知送达记录来自 <code>selectNotificationDeliveries(alarmId)</code>。</li>
          <li>状态流转由动作层校验（canAlarmTransition + closeBlockers）后经 reducer 变更，动作失败只反馈不变更事实。</li>
          <li>{DATA_SOURCE_NOTE}</li>
        </ol>
        <h4>状态机</h4>
        <code>已触发 → 已确认 → 处理中 → 已恢复待关闭 → 已关闭</code>
        <Fields items={[
          ['已触发', '待确认状态，通知已按策略发出（候选态为内部静默期，演示快照不产生）'],
          ['已确认', '已有人接管；确认必须填写说明（ackAlarm 必填 note）'],
          ['处理中', '已登记处置措施与预计完成时间（handleAlarm 必填 measure + expectedAt）'],
          ['已恢复待关闭', '指标已恢复或业务动作完成，等待关闭；自动恢复类规则恢复后由系统自动关闭（演示 ALM-20260916-004）'],
          ['已关闭', '终态，不可重开；重新触发生成新事件并关联历史'],
        ]} />
        <h4>字段定义与计算公式</h4>
        <Fields items={[
          ['等级', '紧急 / 重要 / 一般 / 提示；由触发规则版本继承，事件上不可改'],
          ['触发值 / 阈值', '触发时刻实测值与规则阈值；阈值来自规则版本快照（ruleVersion + bindingVersion），规则后续修改不影响既有事件'],
          ['去重键 dedupeKey', 'deviceId:ruleCode:ruleVersion:bindingVersion；同键存在活动事件时重复触发不新建事件，仅「重复」计数 +1 并追加「重复触发」时间线（合并重复触发）'],
          ['恢复方式', '自动恢复（指标回差恢复）/ 业务闭环（如备件补货入库后关闭）/ 人工确认关闭（程序比对类需责任认定，关闭原因必填）'],
          ['关联对象', 'relatedRepairOrderId（转维修回写）、relatedDowntimeId（报警联动停机）'],
          ['通知送达', 'ND-* 记录：策略、渠道、接收人、状态（送达 / 失败 / 升级）、重试次数；失败保留原因'],
        ]} />
        <h4>状态操作规则</h4>
        <ol>
          <li>确认：仅限「已触发」，说明必填；确认后开始计算处理时限。</li>
          <li>处置：必填措施 + 预计完成时间；已恢复待关闭状态无需重复处置。</li>
          <li>转维修：createRepairFromAlarm 幂等（幂等键 repair-from-alarm:alarmId）——同一报警已存在活动工单时返回原工单号不重复建单；已关闭报警不能转维修；生成的待派工工单号回写报警 relatedRepairOrderId。<b>2026-09-22 调整：转维修改为弹窗</b>，除故障类型外提供可选项「转维修时直接派工」——勾选后选择维修人（班组选填）一步生成「已派工」工单，跳过待派工队列；不勾选则生成「待派工」工单进入待维修看板由调度统一派工。派工候选与待维修看板同一份维修人员 / 班组口径。</li>
          <li>关闭：仅限「已恢复待关闭」；恢复证据 + 关闭原因必填（人工确认关闭类原因必填留痕）；关闭前校验 closeBlockers——关联维修工单须已完成验收、关联停机事实须已结束，未满足列出阻塞原因拒绝关闭。</li>
          <li>每一状态变更都校验当前状态；非法流转（如直接关闭已触发事件）返回明确失败消息，不做静默覆盖。</li>
        </ol>
        <h4>剧本与边界</h4>
        <ol>
          <li>{DEMO_SCRIPTS_NOTE}</li>
          <li>剧本 A 主线：ALM-20260916-001（DEV-004，紧急）确认 → 处置 → 转维修生成工单 → 验收通过后进入恢复流程（自动恢复类自动关闭）。</li>
          <li>空态：筛选结果为空时显示 EmptyState（如「当前无活动报警，可到报警规则配置检查规则启用状态」）。</li>
        </ol>
      </>
    ),
  },
  '/repair-pending': {
    title: '报修待派工',
    content: (
      <>
        <h4>页面目标</h4>
        <p>维修调度的工作队列：集中处理所有状态为「待派工」的维修主工单，完成派工后进入维修执行。</p>
        <h4>数据来源与刷新</h4>
        <ol>
          <li>待派工列表来自 <code>selectAllRepairOrders()</code> 过滤 status = 待派工；报修来源明细来自 <code>selectAllRepairReports()</code>。</li>
          <li>待派工工单有两个来源：报警转维修（createRepairFromAlarm，source = alarm）与人工报修（createRepairReport，source = report）；派工动作 <code>assignRepair(repairOrderId, assignee)</code>。报警转维修时若选择了「立即派工」，工单直接为已派工，不再进入本队列。</li>
          <li>{DATA_SOURCE_NOTE}</li>
        </ol>
        <h4>字段定义与计算公式</h4>
        <Fields items={[
          ['工单编号 / 标题', 'RO-* 主工单编号；报警转维修自动生成「{报警名} 维修」标题'],
          ['来源', 'alarm（报警转维修）/ report（人工报修）/ alarm+report（二者关联）；报警来源显示关联报警号'],
          ['设备', '设备名 + 台账资产码（deviceCrosswalk 映射）'],
          ['等级 / 故障类型', '紧急 / 严重 / 一般；机械 / 电气 / 液压 / 气动 / 控制系统等；等级决定 SLA 时限（紧急 2h / 严重 8h / 一般 24h）'],
          ['SLA', 'slaDueAt = 创建时间 + slaHours；超时行高亮'],
          ['派工对象', '维修人 + 维修组（assignee / assigneeGroup），派工必填维修人'],
        ]} />
        <h4>交互规则</h4>
        <ol>
          <li>派工：必填维修人（可选维修组），成功后状态「已派工」并写时间线与业务履历；重复派工受状态机约束（仅 待派工 → 已派工 合法）。</li>
          <li>点击工单进入工单详情 / 执行页（/repair-orders/:repairOrderId 及 /execute）。</li>
          <li>报警转维修为幂等动作：同一报警重复点击「转维修」返回已存在工单号，不新建。</li>
        </ol>
        <h4>边界与显示规则</h4>
        <ul>
          <li>列表为空时 EmptyState：「当前无待派工工单」；剧本 A 初始无待派工单，执行转维修后出现。</li>
          <li>已取消 / 已完成工单不出现在本页；派工按钮仅对状态 = 待派工 的行可用。</li>
        </ul>
      </>
    ),
  },
  '/repair-reports': {
    title: '报修记录',
    content: (
      <>
        <h4>页面目标</h4>
        <p>报修档案：记录每一次故障报修（人工报修 / 报警转维修 / 监测异常），并展示与主工单的关联关系。</p>
        <h4>数据来源与刷新</h4>
        <ol>
          <li>列表来自 <code>selectAllRepairReports()</code>；提交报修走 <code>createRepairReport(deviceId, faultDesc, level, faultType, title)</code>。</li>
          <li>提交报修会同步生成一张「待派工」主工单（RepairReport 与 RepairOrder 一一关联，linkedRepairOrderId 回写）。</li>
          <li>{DATA_SOURCE_NOTE}</li>
        </ol>
        <h4>字段定义与计算公式</h4>
        <Fields items={[
          ['报修编号', 'BX-*；创建时间取演示时钟（每次动作 +7 秒推进）'],
          ['来源', '人工报修 / 报警转维修 / 监测异常；报警转维修的报修与报警事件互链'],
          ['故障描述', '必填；为空提交被 actions 层拒绝（不产生事实）'],
          ['等级 / 故障类型', '紧急 / 严重 / 一般；机械 / 电气 / 液压 / 气动 / 控制系统 / 过热 / 磨损 / 其他'],
          ['关联工单', 'linkedRepairOrderId；点击跳工单详情'],
          ['状态', '待派工 / 已转工单；报修本身不承载维修过程，过程在主工单'],
        ]} />
        <h4>交互规则</h4>
        <ol>
          <li>新增报修为弹窗：选择设备（设备不存在被拒绝）、故障描述必填、等级与故障类型默认值可改。</li>
          <li>提交成功提示主工单号并可跳转派工；重复提交生成新报修（人工报修无幂等约束，报警转维修才有）。</li>
        </ol>
        <h4>边界与显示规则</h4>
        <ul>
          <li>一条活动故障默认一张活动主工单：同一报警的转维修请求受幂等键保护；人工重复报修同一故障在报表侧合并计数。</li>
          <li>设备列显示 canonical 设备名 + 台账资产码；未知设备不进入候选。</li>
        </ul>
      </>
    ),
  },
  '/repair-orders': {
    title: '维修任务（主工单列表）',
    content: (
      <>
        <h4>页面目标</h4>
        <p>全部维修主工单的统一视图：报修与维修统一为一张主工单，跟踪从待派工到已完成的全过程。</p>
        <h4>数据来源与刷新</h4>
        <ol>
          <li>列表来自 <code>selectAllRepairOrders()</code>（按创建时间倒序）；行内聚合领料（parts）与验收（acceptance）摘要。</li>
          <li>状态流转由动作层校验（canRepairTransition）后经 reducer 变更。</li>
          <li>{DATA_SOURCE_NOTE}</li>
        </ol>
        <h4>状态机</h4>
        <code>待派工 → 已派工 → 维修中 →（挂起 ↔ 维修中）→ 待验收 → 已完成；待验收 →（返修）→ 维修中；待派工 / 已派工 / 挂起 → 已取消</code>
        <Fields items={[
          ['reworkCount（返修次数）', '每次验收退回 +1；派工 / 开工 / 提交等幂等键按返修轮次区分（如 assign:{orderId}:v{reworkCount+1}），支持返修后重新走流程'],
          ['关联停机', 'downtimeFactId：开工时自动创建的维修停机事实；验收通过后自动结束'],
          ['SLA', 'slaHours 按等级（紧急 2 / 严重 8 / 一般 24h）；超时未完成行高亮'],
        ]} />
        <h4>交互规则</h4>
        <ol>
          <li>按状态筛选（待派工 / 已派工 / 维修中 / 挂起 / 待验收 / 已完成 / 已取消）；点击行进入工单详情（param 路由）。</li>
          <li>快捷入口：待派工 → 派工；已派工 / 维修中 → 执行页；待验收 → 验收页。</li>
          <li>演示工单：RO-20260916-001（DEV-002，维修中，关联报警与停机）、RO-20260915-002（DEV-001，待验收）、RO-20260910-003（DEV-004，已完成含验收记录）。</li>
        </ol>
        <h4>边界与显示规则</h4>
        <ul>
          <li>所有状态变更必须走动作层，页面不得直接改状态；非法流转返回当前状态提示。</li>
          <li>已完成工单只读，保留完整时间线、领料与验收记录。</li>
        </ul>
      </>
    ),
  },
  '/repair-orders/:repairOrderId': {
    title: '维修工单详情',
    content: (
      <>
        <h4>页面目标</h4>
        <p>param 路由 <code>/repair-orders/:repairOrderId</code>：单张主工单的全量档案——来源链、过程时间线、领料、停机关联与验收留痕。</p>
        <h4>数据来源与刷新</h4>
        <ol>
          <li>工单来自 <code>selectRepairById(state, repairOrderId)</code>；领料明细来自 <code>selectRepairParts / selectOutboundForRepair</code>；关联停机来自 <code>selectDowntime(deviceId)</code>；业务履历来自 <code>selectBusinessHistory(repair, orderId)</code>。</li>
          <li>{DATA_SOURCE_NOTE}</li>
        </ol>
        <h4>字段定义与计算公式</h4>
        <Fields items={[
          ['来源链', 'alarmId（报警转维修）/ reportId（人工报修）/ 二者兼有；点击回跳报警或报修详情'],
          ['过程时间线', '创建 / 派工 / 接单 / 开工 / 挂起 / 恢复 / 领料 / 提交 / 验收通过 / 退回返修 / 取消；每条含时间（演示时钟）、操作人、详情'],
          ['领料明细', 'parts：备件编码 / 名称 / 数量 / 仓库 / 出库单号（OB-*）'],
          ['停机关联', 'downtimeFactId → 统一停机事实（维修停机；进行中事实无结束时间显示「--」）'],
          ['维修结果', 'measures（措施）+ verification（验证方式）+ laborHours（工时）'],
          ['验收记录', 'AC-*：结论（通过 / 返修）、意见、验收人、时间；返修不产生完成记录但时间线保留「退回返修」'],
          ['业务履历', 'businessHistory：本工单相关的动作流水（与 reducer addHistory 写入一致）'],
        ]} />
        <h4>交互规则</h4>
        <ol>
          <li>按当前状态渲染下一步动作：待派工 → 派工；已派工 → 开工；维修中 → 挂起 / 领料 / 提交；待验收 → 验收。</li>
          <li>非法动作（如对已完成工单再开工）被状态机拒绝并提示当前状态。</li>
        </ol>
        <h4>边界与显示规则</h4>
        <ul>
          <li>无效 repairOrderId：selectRepairById 返回 null，页面显示「未找到对象」EmptyState，不回退到列表第一条。</li>
          <li>工时、时间为演示时钟推算值，页面标注演示口径。</li>
        </ul>
      </>
    ),
  },
  '/repair-orders/:repairOrderId/execute': {
    title: '维修工单执行',
    content: (
      <>
        <h4>页面目标</h4>
        <p>param 路由 <code>/repair-orders/:repairOrderId/execute</code>：维修人的作业台——开工、挂起 / 恢复、领料出库、提交验收。</p>
        <h4>数据来源与刷新</h4>
        <ol>
          <li>工单与领料来自 <code>selectRepairById / selectRepairParts</code>；库存来自 <code>selectAvailableStock(warehouseId, spareCode)</code>；动作：startRepair / pauseRepair / resumeRepair / consumeSpare / submitRepair。</li>
          <li>{DATA_SOURCE_NOTE}</li>
        </ol>
        <h4>字段定义与计算公式</h4>
        <Fields items={[
          ['开工（startRepair）', '仅「已派工」可开工；开工自动创建一张进行中的「维修停机」停机事实（source = 维修联动，relatedRepairOrderId 回写），联动 OEE 可用率口径'],
          ['挂起 / 恢复', '仅「维修中」可挂起（可填原因）、「挂起」可恢复；挂起不结束停机事实'],
          ['领料出库（consumeSpare）', '仅「已派工 / 维修中」允许；校验可用库存（validateOutbound：数量为正且 ≤ 现存 − 预留），超量拦截；幂等键 outbound:{repairOrderId}:{spareCode}:{requestId}，重复提交返回原出库单'],
          ['提交验收（submitRepair）', '仅「维修中」可提交；维修措施与验证方式必填；提交后进入「待验收」，不直接完成'],
        ]} />
        <h4>交互规则</h4>
        <ol>
          <li>领料时选择仓库与备件，实时显示该仓库可用量（现存 − 预留）与水位；出库成功后工单时间线追加「领料」，库存与流水同步更新。</li>
          <li>剧本 A：对 DEV-004 工单领用备件 120004 ×2 后提交验收。</li>
          <li>提交前措施 / 验证未填则被拒绝并逐项提示。</li>
        </ol>
        <h4>边界与显示规则</h4>
        <ul>
          <li>工单状态不在「已派工 / 维修中」时领料入口禁用并说明原因。</li>
          <li>领料幂等：同 requestId 重复提交不产生第二张出库单、不重复扣库存。</li>
          <li>停机事实由 reducer 自动管理，本页不提供手工登记维修停机入口。</li>
        </ul>
      </>
    ),
  },
  '/repair-orders/:repairOrderId/accept': {
    title: '维修工单验收',
    content: (
      <>
        <h4>页面目标</h4>
        <p>param 路由 <code>/repair-orders/:repairOrderId/accept</code>：验收人对「待验收」工单给出结论——通过（设备恢复）或返修（退回维修中）。</p>
        <h4>数据来源与刷新</h4>
        <ol>
          <li>工单来自 <code>selectRepairById</code>；验收动作 <code>acceptRepair(repairOrderId, result, opinion)</code>；验收留痕写入 repairAcceptancesById（AC-*）。</li>
          <li>{DATA_SOURCE_NOTE}</li>
        </ol>
        <h4>字段定义与计算公式</h4>
        <Fields items={[
          ['验收通过', '工单 → 已完成（acceptedAt 记录）；结束进行中的关联维修 / 故障停机事实；设备恢复（数据中断设备显示「无数据」，其余恢复「待机」）；关联报警进入恢复流程——自动恢复类规则随验收自动恢复并关闭'],
          ['返修', '工单 → 维修中，reworkCount +1；原时间线与领料履历全部保留，新一轮派工 / 开工 / 提交使用新的幂等轮次'],
          ['验收意见', '选填；通过 / 返修均写入时间线与验收记录'],
        ]} />
        <h4>交互规则</h4>
        <ol>
          <li>仅「待验收」状态可验收；其他状态显示当前状态与不可验收原因。</li>
          <li>验收通过提示：设备恢复、关联停机结束、报警进入恢复流程（一条动作联动三类事实，§9 跨模块动作矩阵）。</li>
          <li>验收通过后工单只读；如需再维修走人工报修新建工单。</li>
        </ol>
        <h4>边界与显示规则</h4>
        <ul>
          <li>返修不是取消：工单继续存在且 reworkCount 递增，履历不重置。</li>
          <li>无效 repairOrderId 显示「未找到对象」EmptyState。</li>
          <li>联动结果以 reducer 为准（toast 仅辅助）：页面提示与实体状态必须一致，可通过业务履历核验。</li>
        </ul>
      </>
    ),
  },
  '/spare-parts-stock': {
    title: '备件库存',
    content: (
      <>
        <h4>页面目标</h4>
        <p>备件库存总览与水位预警：按 仓库 × 备件 展示现存、预留、可用与水位状态，识别低库存与超储。</p>
        <h4>数据来源与刷新</h4>
        <ol>
          <li>列表来自 <code>selectStockRows(state)</code>：逐行派生 available（可用量）与 level（水位），并关联备件档案（sparesByCode）。</li>
          <li>出入库 / 退库动作后库存行与流水（selectStockFlows）即时更新——派生自同一 store，无独立静态库存。</li>
          <li>{DATA_SOURCE_NOTE}</li>
        </ol>
        <h4>字段定义与计算公式</h4>
        <Fields items={[
          ['现存（onHand）', '在库实物数量；出库减少、入库 / 退库回冲'],
          ['预留（reserved）', '已被工单锁定的数量'],
          ['可用量', '可用 = 现存 − 预留（availableQty）；未配置库存返回 null 显示「--」，与 0 严格区分'],
          ['水位判断（stockLevel）', '现存 < 安全库存 → 「低于安全库存」（红）；现存 > 最大库存 → 「超过最大库存」（黄）；否则「正常」（绿）'],
          ['演示低库存', '空压机滤芯 120006（现存 28 < 安全库存 40）联动报警 ALM-20260916-006（业务闭环：补货入库至安全库存后关闭）；仓库二 120006 现存 0 是真实 0，显示 0'],
        ]} />
        <h4>交互规则</h4>
        <ol>
          <li>筛选：仓库 / 备件编码 / 备件名称；点击行查看库存流水（入库 / 出库 / 退库 / 预留 / 释放，含关联单据）。</li>
          <li>低于安全库存的行提供「去入库」快捷入口。</li>
        </ol>
        <h4>边界与显示规则</h4>
        <ul>
          <li>「--」（该仓库未配置此备件库存）与 0（配置了但现存为 0）必须可区分。</li>
          <li>单位沿用备件档案（个 / 千克 / 米），不得统一写「件」。</li>
        </ul>
      </>
    ),
  },
  '/spare-parts-inbound': {
    title: '备件入库',
    content: (
      <>
        <h4>页面目标</h4>
        <p>采购到货与退料入库：登记入库单，回冲对应仓库现存并留流水。</p>
        <h4>数据来源与刷新</h4>
        <ol>
          <li>入库单列表来自 store 实体 inboundsById（演示：IB-20260910-001、IB-20260905-002）；动作 <code>inboundSpare(spareCode, warehouseId, qty, requestId, supplier)</code>。</li>
          <li>{DATA_SOURCE_NOTE}</li>
        </ol>
        <h4>字段定义与计算公式</h4>
        <Fields items={[
          ['入库单', 'IB-* 编号 + rk 单据号；明细含备件 / 单位 / 仓库 / 数量'],
          ['数量校验', '入库数量必须为正数（validateInbound），否则拒绝'],
          ['幂等键', 'inbound:{warehouseId}:{spareCode}:{requestId}；重复提交返回原结果，不重复加库存'],
          ['库存影响', '已有库存行现存 +qty；无库存行则新建（现存 = qty，预留 0）；流水新增「入库」记录含结余'],
        ]} />
        <h4>交互规则</h4>
        <ol>
          <li>新建入库为弹窗：选择仓库与备件、数量、供应商（选填）。</li>
          <li>入库成功后可在备件库存页验证现存变化与流水。</li>
        </ol>
        <h4>边界与显示规则</h4>
        <ul>
          <li>备件必须存在于档案（sparesByCode），未知备件拒绝入库。</li>
          <li>演示剧本 A 中补货入库空压机滤芯可使关联报警 ALM-20260916-006 达成业务闭环条件。</li>
        </ul>
      </>
    ),
  },
  '/spare-parts-outbound': {
    title: '备件出库与退库',
    content: (
      <>
        <h4>页面目标</h4>
        <p>领用出库与维修出库的登记和追溯；维修出库必须关联维修工单，支持余料退库。</p>
        <h4>数据来源与刷新</h4>
        <ol>
          <li>出库单来自 outboundsById（OB-*），退库单来自 returnsById（RT-*），流水来自 <code>selectStockFlows()</code>；动作 <code>consumeSpare</code> / <code>returnSpare</code>。</li>
          <li>{DATA_SOURCE_NOTE}</li>
        </ol>
        <h4>字段定义与计算公式</h4>
        <Fields items={[
          ['出库类型', '领用出库（车间日常领用，无工单）/ 维修出库（必须关联维修工单，工单状态 ∈ 已派工 / 维修中）'],
          ['可用量拦截', '出库数量必须为正且 ≤ 该仓库可用量（现存 − 预留）；超量提示「出库数量 N 超过该仓库可用库存 M」并拒绝，不产生事实'],
          ['requestId 幂等', '幂等键 outbound:{repairOrderId}:{spareCode}:{requestId}；网络重试 / 重复点击返回原出库单，不重复扣减'],
          ['退库（returnSpare）', '退库数量 ≤ 该出库单已出库未归还余量（出库量 − 已退量）；超量提示「退库数量超过该工单可退余量」；成功后回冲仓库现存并写「退库」流水'],
          ['库存流水', 'SF-*：时间 / 仓库 / 备件 / 类型 / 数量（正负）/ 结余 / 关联单据（报警、出库单、退库单）'],
        ]} />
        <h4>交互规则</h4>
        <ol>
          <li>维修出库需选择维修工单 + 仓库 + 备件 + 数量；出库成功后工单时间线追加「领料」并回写出库单号。</li>
          <li>退库从出库单发起，填写数量与原因；退库原因默认「余料退库」。</li>
        </ol>
        <h4>边界与显示规则</h4>
        <ul>
          <li>工单状态非「已派工 / 维修中」时不允许领料出库（明确提示当前状态）。</li>
          <li>演示出库单：OB-20260915-002（RO-20260915-002 领备件三 ×2）、OB-20260910-003（RO-20260910-003 领备件一 ×1）；退库单 RT-20260912-001（领用余料退库 ×20）。</li>
        </ul>
      </>
    ),
  },
  '/oee-realtime': {
    title: '实时 OEE',
    content: (
      <>
        <h4>页面目标</h4>
        <p>按设备实时展示最近 1 小时的 OEE 及其构成因子，用于当班效率监控。</p>
        <h4>数据来源与刷新</h4>
        <ol>
          <li>行数据来自 <code>selectOeeRealtimeRows(state)</code> → 逐设备 <code>selectOeeResult(state, deviceId, window='realtime')</code>：OEE 不是静态值，由 oeeInputs（实时窗口原始输入）+ 停机事实（计划停机 / 换模分钟）+ 速度配置（理想速度）实时推导。</li>
          <li>saveDowntime / saveSpeedConfig / recomputeOee 之后，本页结果随 selector 立即重算可见；重算履历见 selectOeeRecomputeLog（RC-*）。</li>
          <li>{DATA_SOURCE_NOTE}</li>
        </ol>
        <h4>字段定义与计算公式</h4>
        <Fields items={[
          ['负荷时间', '统计窗口内设备处于可统计状态的总时长（分钟）'],
          ['计划停机时间', '该设备当日「计划停机 + 换模」且状态 ∈ {已结束, 进行中} 的停机事实分钟合计；只影响可用率分母，不扣性能率或合格率'],
          ['运行时间', '窗口内运行状态持续时长（分钟）'],
          ['可用率', '运行时间 / (负荷时间 − 计划停机时间) × 100%；分母 ≤ 0 或缺失 → null → 显示「--」+ 原因'],
          ['理想生产速度', '该设备当前物料在速度配置中「生效」记录的基准速度（个/小时）；未配置 → null'],
          ['实际生产速度', '窗口产出 / 运行时间 × 3600（个/小时）'],
          ['性能率', '实际生产速度 / 理想生产速度 × 100%'],
          ['合格率', '良品数 / 总产量 × 100%；产量缺失或为 0 且无良品来源 → null'],
          ['OEE', '可用率 × 性能率 × 合格率；任一因子不可计算则整体 null，显示「--」并列出 blockers'],
          ['blockers（不可计算原因）', '按序给出：设备未启用有效 IoT 绑定 / 未配置班次日历 / 缺少负荷时间 / 未配置理想速度 / 缺少运行时间 / 窗口内无生产数据 / 缺少产量 / 缺少质量数据'],
          ['目标值', 'oeeTargetsByDeviceId 按设备配置（DEV-001 78% / DEV-002 75% / DEV-003 70% / DEV-004 65%）'],
        ]} />
        <h4>交互规则</h4>
        <ol>
          <li>设备名称链接到设备监测详情；OEE 单元格可下钻损失（selectOeeLosses：可用率损失 → 停机事实，性能率损失 → 速度差，合格率损失 → 不良明细）。</li>
          <li>顶部汇总仅统计可计算设备，剔除台数在悬浮说明。</li>
          <li>OEE 色阶：≥75% 绿 / 60%~75% 橙 / &lt;60% 红 / 不可计算灰。</li>
        </ol>
        <h4>边界与显示规则</h4>
        <ul>
          <li>DEV-005（剧本 C）：无生产数据 → 整行显示「该窗口无生产数据」，不伪造 0。</li>
          <li>DEV-006：动力设备未纳入 OEE（无班次日历与生产口径）→ blockers 说明。</li>
          <li>数据完整率不足的行标注参考性（dataComplete）。</li>
        </ul>
      </>
    ),
  },
  '/oee-history': {
    title: '历史 OEE',
    content: (
      <>
        <h4>页面目标</h4>
        <p>按「设备 × 日」回看历史 OEE，定位效率异常的具体日期并下钻到当天构成。</p>
        <h4>数据来源与刷新</h4>
        <ol>
          <li>数据来自 <code>selectOeeDailyRows(state, day)</code> → <code>selectOeeResult(window='daily', day)</code>；演示覆盖 2026-09-01 ~ 09-16，默认演示日 demoDay = 2026-09-16。</li>
          <li>{DATA_SOURCE_NOTE}</li>
        </ol>
        <h4>字段定义与计算公式</h4>
        <Fields items={[
          ['口径（设备 × 日）', '同一天同一设备可能生产多种物料，指标按日聚合；所有比率逐日独立计算，严禁用月度累计或月平均替代某天 OEE'],
          ['可用率', '运行时间 / (负荷时间 − 当日计划停机分钟) × 100%；计划停机分钟来自当日「计划停机 + 换模」停机事实'],
          ['性能率', '实际速度 / 理想速度（按当日物料生效的速度配置）× 100%'],
          ['合格率', '良品 / 总产量 × 100%（跨物料求和）'],
          ['当天 OEE', '三率乘积；任一因子 null → 「--」+ 原因'],
        ]} />
        <h4>交互规则</h4>
        <ol>
          <li>筛选：日期 + 设备（演示数据集只覆盖 09 月上旬至 16 日）。</li>
          <li>点击设备进入历史 OEE 详情（/oee-history/detail/:deviceId）；点击单元格直达该设备该天详情。</li>
          <li>单元格配色：≥75% 绿 / 60%~75% 橙 / &lt;60% 红 / 无生产数据空白不填色；悬浮显示三率构成。</li>
        </ol>
        <h4>边界与显示规则</h4>
        <ul>
          <li>某设备某天未开机的单元格显示「--」且不可点击，与「有生产但 OEE 低」严格区分。</li>
          <li>DEV-005 无日输入 → 整行「该窗口无生产数据」；DEV-006/007/008 未纳入 OEE → 说明原因。</li>
        </ul>
      </>
    ),
  },
  '/oee-history/detail': {
    title: '历史 OEE 详情',
    content: (
      <>
        <h4>页面目标</h4>
        <p>param 路由 <code>/oee-history/detail/:deviceId</code>（兼容 <code>/oee-history/detail?deviceId=</code> query 形式）：单设备逐日 OEE 构成、损失下钻与重算履历。</p>
        <h4>数据来源与刷新</h4>
        <ol>
          <li>设备与日选择后经 <code>selectOeeResult(window='daily', day)</code> 取构成；损失下钻经 <code>selectOeeLosses</code>；重算履历经 <code>selectOeeRecomputeLog(deviceId)</code>（RC-*：触发原因、区间、时间、轮次）。</li>
          <li>{DATA_SOURCE_NOTE}</li>
        </ol>
        <h4>字段定义与汇总规则</h4>
        <Fields items={[
          ['负荷 / 计划停机 / 运行时间、产量 / 良品', '时间与数量类指标跨日取「合计」（Σ 各日值）'],
          ['可用率 / 性能率 / 合格率 / OEE', '比率类逐日独立计算，不跨日合计；「平均」列仅为各日算术平均并注明「非加权」'],
          ['损失下钻', '可用率损失 → 当日停机事实明细（分类 / 分钟 / 单号）；性能率损失 → 实际 vs 理想速度差；合格率损失 → 不良品明细'],
          ['重算履历', 'RC-*：每次 saveDowntime（计划停机 / 换模）、saveSpeedConfig、取消停机或人工重算都会追加一条，含 revision 递增'],
        ]} />
        <h4>交互规则</h4>
        <ol>
          <li>日期切换联动物料明细与矩阵高亮；趋势图点击数据点同样切换日期。</li>
          <li>提供「重算」按钮（recomputeOee(deviceId, range, reason)）：按当前停机事实与配置重新推导并记录履历。</li>
        </ol>
        <h4>边界与显示规则</h4>
        <ul>
          <li>无效 deviceId 或无该日输入：显示「该窗口无生产数据」EmptyState + blockers，不显示 0。</li>
          <li>DEV-005/006 等未纳入设备进入详情页时说明资格原因（oeeEligibility.reason）。</li>
        </ul>
      </>
    ),
  },
  '/oee-speed-config': {
    title: '理想生产速度配置',
    content: (
      <>
        <h4>页面目标</h4>
        <p>维护「设备 × 物料」的理论生产速度基准（个/小时），是 OEE 性能率唯一的分母来源；未配置则性能率不可计算。</p>
        <h4>数据来源与刷新</h4>
        <ol>
          <li>配置来自 speedConfigsById（演示：DEV-001 三条、DEV-002 两条、DEV-003 / DEV-004 各一条；DEV-005 未配置 → OEE 不可计算的演示点）；物料基础档案来自 materialPool。</li>
          <li>修改走 <code>saveSpeedConfig(configId, idealSpeed)</code>：版本 +1、生效日期取演示日、状态「生效」，并追加 OEE 重算履历（RC-*）；保存后 selector 立即按新基准重算实时 OEE。</li>
          <li>{DATA_SOURCE_NOTE}</li>
        </ol>
        <h4>字段定义与计算公式</h4>
        <Fields items={[
          ['设备 × 物料', '设备从台账选择（演示 8 台）；物料编码 / 名称 / 型号来自物料池联想'],
          ['理想生产速度', '必须 &gt; 0 的数值（个/小时）；性能率 = 实际生产速度 / 理想生产速度 × 100%'],
          ['版本与生效时点', '每次保存 version +1 并记录生效日期；历史版本留痕，当日统计沿用触发时刻的基准，避免当日改基准导致历史口径漂移'],
          ['唯一约束', '同一设备 + 同一物料编码仅一条「生效」记录；selector speedFor 只取生效记录'],
        ]} />
        <h4>交互规则</h4>
        <ol>
          <li>筛选：设备编号、物料编码、物料名称（AND 关系）。</li>
          <li>新增 / 编辑为弹窗：理想速度必填且 &gt; 0，非法值被动作层拒绝。</li>
          <li>保存成功提示新版本号与「已触发演示重算」。</li>
        </ol>
        <h4>边界与显示规则</h4>
        <ul>
          <li>未配置速度的设备（DEV-005）在 OEE 页显示「该物料未配置理想生产速度/标准节拍」blockers，不按 0 计。</li>
          <li>速度配置不影响已完成的日统计重放口径，只影响之后的选择器推导。</li>
        </ul>
      </>
    ),
  },
  '/planned-downtime': {
    title: '计划停机时间管理',
    content: (
      <>
        <h4>页面目标</h4>
        <p>登记计划内停机（保养 / 换模 / 计划检修 / 停电等），供 OEE 可用率在分母中扣减，避免计划停机被误判为效率损失。</p>
        <h4>数据来源与刷新</h4>
        <ol>
          <li>停机事实统一存于 downtimeFactsById（§6.7：计划停机 / 故障停机 / 维修停机 / 换模 / 待料 / 数据中断 同表）；列表来自 <code>selectDowntime(deviceId, range)</code>。</li>
          <li>动作：<code>saveDowntime(fact)</code> 登记或取消、<code>deleteDowntime(downtimeId, reason)</code> 删除 / 取消留痕；保存「计划停机 / 换模」自动追加 OEE 重算履历并触发重算。</li>
          <li>{DATA_SOURCE_NOTE}</li>
        </ol>
        <h4>字段定义与计算公式</h4>
        <Fields items={[
          ['停机分类', '计划停机 / 故障停机 / 维修停机 / 换模 / 待料 / 数据中断；来源：人工登记 / 报警联动 / 维修联动 / 计划排程'],
          ['状态机', '待执行 → 进行中 → 已结束；取消 → 已取消（留痕不物理删除）'],
          ['时间校验（validateDowntime）', '开始 &lt; 结束；取消必须填原因；同设备未取消事实不允许时间重叠（提示冲突单号）'],
          ['OEE 口径', '可用率 = 运行 / (负荷 − 计划停机分钟)；计划停机分钟只统计「计划停机 + 换模」且状态 ∈ {已结束, 进行中} 的事实；故障 / 维修 / 待料计入损失不下分母'],
          ['演示事实', '计划停机：DT-20260916-101/102/103（班前点检润滑）；待执行：DT-20260917-201（换模）、DT-20260918-202、DT-20260920-203；数据中断：DT-20260916-905（DEV-005，进行中，分钟显示「--」）'],
        ]} />
        <h4>交互规则</h4>
        <ol>
          <li>新增 / 编辑为弹窗：设备、分类、开始 / 结束时间、原因；保存即校验（重叠 / 时间合法性）。</li>
          <li>删除规则：「待执行」可物理删除；「进行中 / 已结束」只能取消留痕（状态 → 已取消，原因必填）并触发 OEE 重算。</li>
          <li>取消后历史 OEE 在下一次重算 / selector 查询时按新口径呈现，履历可追溯。</li>
        </ol>
        <h4>边界与显示规则</h4>
        <ul>
          <li>进行中停机无结束时间，分钟显示「--」，不显示 0。</li>
          <li>「数据中断」分类的停机不计入生产损失口径，仅说明接入状态。</li>
          <li>维修开工自动生成的「维修停机」事实在本页只读展示（来源 = 维修联动），管理入口在维修工单。</li>
        </ul>
      </>
    ),
  },
  '/binding-overview': {
    title: '联网配置总览（IoT 绑定）',
    content: (
      <>
        <h4>页面目标</h4>
        <p>数据接入运维视图：集中查看设备与 IoT 平台的绑定关系与拉取健康度，并在此完成绑定草稿、校验、保存与启停（§6.1）。</p>
        <h4>数据来源与刷新</h4>
        <ol>
          <li>绑定来自 bindingsByDeviceId（8 台设备：DEV-001..007 有绑定，DEV-008 无绑定——演示「空绑定必须能创建首个绑定」）；版本历史来自 bindingVersionsById；草稿存于 store 的 ui.bindingDraftsByDeviceId（draft-（设备ID））。</li>
          <li>动作：addBindingSource / removeBindingSource / toggleBindingMetric（草稿编辑，保存前不入正式绑定）、saveBinding（版本 +1 → 待生效）、enableBinding / disableBinding；校验经 binding/validate（validateBindingDraft）。</li>
          <li>{DATA_SOURCE_NOTE}</li>
        </ol>
        <h4>绑定状态机</h4>
        <code>未配置 → 草稿 → 校验中 → 校验通过 → 待生效 → 已启用 →（已停用 / 换绑中）</code>
        <Fields items={[
          ['校验规则（保存时全部通过）', '启用来源 ≥ 1（来源设备不分主/子，2026-09 流程调整）；至少勾选一项有效（非失效）指标；同一绑定内来源编码不重复（被其它设备占用仅提示不拦截）；失效指标（如 M.ambient_humidity）不能参与绑定'],
          ['保存（saveBinding）', '校验通过后生成新版本（version + 1）状态「待生效」，版本历史留痕（summary）；启用（enableBinding）后 effectiveFrom 记演示时钟'],
          ['换绑 / 停用', '已启用绑定可停用（effectiveTo 留痕）或进入换绑中；换绑不覆盖旧版本（bindingVersions 保存历史与生效区间）；DEV-002 v2 换绑至 IOT-D-10002 为演示样例'],
          ['影响范围', '绑定变更影响该设备的运行监测、指标报警判定、OEE 计算与报表统计（bindingImpact）；停用期间该设备报警判定挂起、OEE 不可计算'],
          ['拉取健康度', '拉取周期 / 最近拉取时间 / 连续失败次数 / 待补偿窗口（只读展示）；健康状态：正常 / 延迟 / 部分中断 / 数据中断（DEV-005 连续失败 3 次 → 数据中断）'],
        ]} />
        <h4>交互规则</h4>
        <ol>
          <li>绑定草稿走三步向导：① 选设备（表格含设备编号/名称/资产编码/类型/型号/车间工位/负责人列与「是否已绑定指标」列，支持关键字 + 绑定状态 + 设备类型筛选）② 勾选 IoT 来源设备（不分主/子）③ 为各来源选指标。</li>
          <li>已绑定设备（bindingsByDeviceId 有记录即算，含已停用）在第 1 步置灰不可选——不能重复绑定，只能通过列表「换绑」修改；未保存的草稿不算已绑定。</li>
          <li>编辑绑定先生成草稿（store 内，未保存不产生正式版本）；逐项添加 / 移除来源、勾选指标，随时校验并逐条展示错误。</li>
          <li>保存 → 待生效 → 启用 三步走；每步受状态机约束（非法流转被拒绝）。</li>
          <li>DEV-008 首绑演示：无历史绑定也能创建草稿并保存为 v1。</li>
          <li>本页不维护协议 / 网关 / IP / 端口 / 点表（IoT 平台职责，只读展示见设备台账联网配置）。</li>
        </ol>
        <h4>边界与显示规则</h4>
        <ul>
          <li>校验失败列出全部错误（非首个），保存动作被拒绝且不产生事实。</li>
          <li>失效指标在指标选择中置灰并标注「已失效」；未勾选指标不采集、不统计、不参与验收。</li>
          <li>绑定版本历史可追溯：每个版本含生效区间与变更摘要。</li>
        </ul>
      </>
    ),
  },
  '/platform-metrics': {
    title: '平台指标清单与接入任务',
    content: (
      <>
        <h4>页面目标</h4>
        <p>从 IoT 平台只读同步的指标目录（本系统不自建指标），以及接入任务（拉取 / 补传 / 补偿）的执行状态、失败原因与下一步建议。</p>
        <h4>数据来源与刷新</h4>
        <ol>
          <li>指标清单来自 metricsByKey：14 项平台指标（M.spindle_temp / M.coolant_temp / M.spindle_speed / M.feed_rate / M.vib_amplitude / M.bearing_temp / M.ambient_humidity / S.machine_state / S.alarm_code / M.air_pressure / M.motor_current / M.oil_pressure / M.weld_current / M.axis_load），只读不可编辑。</li>
          <li>接入任务来自 <code>selectIngestionTasks()</code>：IT-20260916-001..004（对应演示任务 IT-001..004）。</li>
          <li>{DATA_SOURCE_NOTE}</li>
        </ol>
        <h4>字段定义与计算公式</h4>
        <Fields items={[
          ['指标编码 / 版本', '编码全局唯一（如 M.spindle_temp）；版本唯一键 = (metricCode, metricVersion)；绑定 / 规则引用时同时记录编码 + 版本'],
          ['数据类型 / 单位 / 精度 / 有效范围', '数值型有单位、精度与有效范围（范围外判无效）；状态型为枚举映射（设备状态：运行/待机/计划停机/故障/维修中/无数据）；事件型为触发记录'],
          ['同步状态', '正常 / 已失效；已失效指标（M.ambient_humidity）不物理删除、不能参与绑定，引用处标注失效并提示处理'],
          ['最近同步时间', '该指标最后一次快照更新时间（演示每日 06:00 同步）'],
          ['接入任务（IT-*）', '任务编号 / 设备 / 类型（拉取 / 补传 / 补偿）/ 状态（成功 / 部分成功 / 重试中 / 失败）/ 成功数 / 失败数 / failReason / impact（影响范围）/ owner / nextStep（下一步）'],
          ['演示任务', 'IT-001（DEV-002 重试中：网关重连后报文乱序，冷却液温度延迟 32s）；IT-002（DEV-003 部分成功：温度子传感器已停用，轴承温度缺口）；IT-003（DEV-005 失败：主设备心跳超时数据中断，OEE 不可计算）；IT-004（DEV-001 成功）'],
        ]} />
        <h4>交互规则</h4>
        <ol>
          <li>筛选：指标编码 / 名称（模糊）、数据类型、同步状态；任务按设备 / 状态筛选。</li>
          <li>失效指标行弱化显示并悬浮说明原因；点击任务行展开 failReason / impact / nextStep。</li>
          <li>任务列表只读；补偿 / 重试入口在联网配置总览（本页只读口径）。</li>
        </ol>
        <h4>边界与显示规则</h4>
        <ul>
          <li>指标目录与任务均为演示快照只读数据，不提供新增 / 删除。</li>
          <li>任务影响范围与下一步为演示文案，与设备健康、OEE blockers 的展示口径保持一致。</li>
        </ul>
      </>
    ),
  },
  '/program-compare': {
    title: '程序参数比对',
    content: (
      <>
        <h4>页面目标</h4>
        <p>比对设备当前运行程序 / 参数集与程序基线，及时发现参数漂移、误修改与未授权变更。</p>
        <h4>数据来源与刷新</h4>
        <ol>
          <li>比对记录来自 <code>selectProgramCompare(deviceId)</code>（PC-*）；基线参数明细来自 programBaselines（按 程序|版本 键）。</li>
          <li>{DATA_SOURCE_NOTE}</li>
        </ol>
        <h4>字段定义与计算公式</h4>
        <Fields items={[
          ['程序 / 版本 / 基线', '设备当前运行的程序号与版本 + 基线序号；与基线程序号不同时直接判参数不一致'],
          ['比对结果', '一致 / 参数不一致 / 比对失败 / 不适用（无程序基线）；不适用不参与不一致统计，失败不统计为不一致'],
          ['差异明细', '基线值 / 实际值 / 容差逐参数列出；偏差在容差内判一致（演示 PC-001：进给倍率 105% → 120%，容差 ±3%，判不一致）'],
          ['失败原因', '通信 / 解析失败等可追溯原因（演示 PC-003：PLC 读取超时）'],
          ['处理状态', '未处理 / 处理中 / 已处理 / 待确认 / 无需处理；参数不一致必须填写处理结论和措施后才能标记已处理（跳转比对处理记录）'],
          ['关联报警', '参数不一致触发的报警事件（演示 PC-001 → ALM-20260916-003，剧本 B）'],
        ]} />
        <h4>交互规则</h4>
        <ol>
          <li>点击不一致行展开逐字段比对明细（programBaselines 基线 vs 实际）。</li>
          <li>处理入口跳转「比对处理记录」登记结论与措施；记录不可删除。</li>
          <li>筛选：设备 / 比对结果 / 处理状态。</li>
        </ol>
        <h4>边界与显示规则</h4>
        <ul>
          <li>比对失败与参数不一致严格分开统计；无基线显示「不适用」。</li>
          <li>剧本 B 主线：DEV-002 进给倍率超容差 → 报警 ALM-20260916-003 → 处理记录回改参数 → 恢复一致后报警方可关闭。</li>
        </ul>
      </>
    ),
  },
  '/program-handle-record': {
    title: '比对处理记录',
    content: (
      <>
        <h4>页面目标</h4>
        <p>追溯程序参数不一致的处置过程、关联报警和维修申请，形成「发现 → 处置 → 归档」闭环留痕。</p>
        <h4>数据来源与刷新</h4>
        <ol>
          <li>处理记录来自 <code>selectProgramHandles(deviceId)</code>（PCR-*，按时间倒序）。</li>
          <li>{DATA_SOURCE_NOTE}</li>
        </ol>
        <h4>字段定义与计算公式</h4>
        <Fields items={[
          ['处理人 / 处理时间', '处置责任人与完成时间（演示时钟口径）'],
          ['处理结论 / 措施', '结论枚举（确认可用 / 重新下发 / 回退程序 / 升级处理 / 无需处理）+ 具体执行动作描述，均必填'],
          ['关联报警 / 关联维修申请', '参数不一致触发的报警事件与维修工单（演示 PCR-001：ALM-20260916-003 → RO-20260916-001）'],
          ['附件 / 影响范围', '照片 / 比对报告佐证材料；impactScope 说明该记录对关联报警处置的作用'],
        ]} />
        <h4>操作与留痕规则</h4>
        <ol>
          <li>处理记录不可删除，只可追加说明；追加说明按时间顺序保留并显示追加人。</li>
          <li>处理结论 / 措施保存后不可修改，只能追加更正说明。</li>
          <li>点击比对记录编号回看当时的差异字段明细（程序参数比对页）。</li>
        </ol>
        <h4>边界与显示规则</h4>
        <ul>
          <li>无关联报警 / 工单的记录对应字段显示「--」。</li>
          <li>比对结果恢复一致后，关联的人工确认关闭类报警方可关闭（剧本 B 收口）。</li>
        </ul>
      </>
    ),
  },
  '/device-ledger': {
    title: '设备台账（设备档案）',
    content: (
      <>
        <h4>页面目标</h4>
        <p>设备全生命周期主档案：8 台演示设备（DEV-001..008）的基础信息、资产编码映射、生命周期状态与 OEE 参与标识。</p>
        <h4>数据来源与刷新</h4>
        <ol>
          <li>列表来自 <code>selectAllDevices(state)</code>（devicesById + crosswalk 映射）；canonical deviceId 与台账资产码 MT2024A1201..1208 经 deviceCrosswalk 一一映射。</li>
          <li>{DATA_SOURCE_NOTE}</li>
        </ol>
        <h4>字段定义与计算公式</h4>
        <Fields items={[
          ['设备编号（canonical）', 'DEV-001..008；为本系统各域统一主键（监测 / 报警 / 维修 / OEE / 停机均以 deviceId 关联）'],
          ['台账资产码', 'MT2024A1201..1208（crosswalk.assetCode）；监测编码（crosswalk.monitorCode）随行展示，用于对齐宿主平台资产档案'],
          ['基本信息', '名称 / 型号 / 类型 / 品牌 / 车间 / 产线 / 工位 / 负责人 / 资产编号 / 启用与购置日期'],
          ['生命周期状态', '在用 / 停用 / 报废-归档（演示：DEV-007 停用、DEV-008 报废-归档）；状态轴与绑定状态分离，互不覆盖'],
          ['是否联网', '存在绑定即「是」：DEV-001..006 联网（DEV-007 已停用）、DEV-008 未配置 = 不联网'],
          ['是否进行 OEE 分析', 'oeeEligible 标识 + oeeEligibility：DEV-001..004 参与统计；DEV-005 数据中断未配置速度不参与；DEV-006 动力设备未纳入；DEV-007/008 不参与'],
        ]} />
        <h4>交互规则</h4>
        <ol>
          <li>点击设备进入台账详情（/device-ledger/detail/:deviceId）；联网设备提供「监测详情」与「联网配置」入口。</li>
          <li>筛选：车间 / 类型 / 生命周期状态 / 是否联网 / 是否参与 OEE。</li>
          <li>新增 / 编辑档案为演示弹窗（双列布局，字段对齐已上线原型：资产编号 / 名称 / 类型 / 型号 / 品牌 / 车间 / 产线 / 工位 / 状态 / 负责人 / 档案资产编号 / 是否联网 / OEE统计 / 启用 / 采购 / 停用日期 / 图片 / 备注），确认不落快照、重置演示可恢复；是否联网与 OEE统计 由绑定与配置推导，编辑态只读。</li>
        </ol>
        <h4>边界与显示规则</h4>
        <ul>
          <li>编码双体系必须同屏标注（canonical deviceId / 台账 assetCode / 监测编码），避免跨页跳转串号。</li>
          <li>不联网设备（DEV-008）在监测 / OEE 页显示「未配置」，不显示 0。</li>
        </ul>
      </>
    ),
  },
  '/device-ledger/detail': {
    title: '设备台账详情',
    content: (
      <>
        <h4>页面目标</h4>
        <p>param 路由 <code>/device-ledger/detail/:deviceId</code>（兼容 <code>/device-ledger/detail?deviceId=</code> query 形式）：单台设备的档案视图——资产信息、编码映射、绑定与版本历史、接入状态、业务履历，以及关联业务记录（点检 / 保养 / 巡检 / 报修与维修工单 / 报警 Tab 页）。</p>
        <h4>数据来源与刷新</h4>
        <ol>
          <li>档案来自 <code>selectDevice(state, deviceId)</code>；编码映射来自 <code>selectDeviceCrosswalk</code>；绑定与版本历史来自 <code>selectBinding / selectBindingVersions</code>；接入任务来自 <code>selectIngestionTasks(deviceId)</code>；通用动作履历来自 <code>selectBusinessHistory(device, deviceId)</code>。</li>
          <li>生命周期履历来自 <code>selectDeviceLifecycleHistory(state, deviceId)</code>，聚合采购入账、试用确认、设备手续入账、资产变更、闲置管理和报废归档记录。</li>
          <li>{DATA_SOURCE_NOTE}</li>
        </ol>
        <h4>字段定义与计算公式</h4>
        <Fields items={[
          ['资产信息', '与台账列表同源：基本信息 + 生命周期状态 + 负责人 + 位置（车间 / 产线 / 工位 拼接）'],
          ['编码映射（crosswalk）', 'deviceId ↔ assetCode ↔ monitorCode 三列对照；缺失映射时回退设备自带编码并标注'],
          ['入账来源', '按 deviceId 反查生成台账的设备入账流程任务（任务侧持有 registration.deviceIds，一任务可批量生成多台设备）：显示任务号（可跳转设备入账页）+ 来源标签（采购系统同步 / 手工新增）；无关联任务时显示「手工建档 / 未走流程」'],
          ['绑定概览', '当前绑定版本 / 配置状态 / 来源设备（平级，不分主/子）/ 生效区间；历史版本列表含变更摘要'],
          ['状态与趋势 · 监控曲线', '「配置监控曲线」弹窗列出该设备绑定（启用）来源中 dataType = 数值 的已选指标（状态 / 事件类 S.* 不参与）；多选确定后在栏目顶部按指标成图：优先用平台快照趋势（trends），无快照时按当前采样值生成确定性演示序列；数据中断或无值时显示占位说明；为页面级 UI 偏好（不写入绑定、换设备清空）'],
          ['指标历史数据', '本台设备绑定指标的历史采样明细，供查询与追溯（栏目不绑定 IOT 命名，数据来源可扩展）：宽表布局——每行一个拉取时间点、各绑定指标占一列（表头含指标编码与单位），按采集时间升序对齐展示；时间范围查询精确到分钟（默认当天 00:00 ~ 当前）；按绑定整体拉取，一次拉取覆盖全部来源设备的全部指标，同行采集时间一致；单元格按质量码着色，悬停查看质量码与接收时间；支持按当前查询范围导出 CSV（与页面同构）；无采样数据的指标 / 时间点不存储、不显示占位；仅联网设备展示'],
          ['接入状态', '通信健康（selectHealth）+ 接入任务（IT-*）摘要'],
          ['业务履历', '该设备的全部动作履历（绑定变更、报警确认、派工、停机登记等）'],
          ['生命周期履历', '按时间倒序展示采购入账、试用确认、设备手续入账、资产变更、闲置管理、报废归档和业务动作；包含单据号、说明、处理人和状态，只读'],
          ['关联业务记录 · 点检 / 巡检', '演示种子（standardData.js）按资产编码过滤任务明细行，按最新任务补齐计划 / 日期 / 状态口径；含应检 / 已检 / 未检、执行时间与跳过原因（只读，完整闭环由点巡保养业务模块承接）'],
          ['关联业务记录 · 保养', '演示种子保养任务按「设备名 资产编码」匹配本设备：任务编号 / 计划 / 日期 / 负责人 / 状态 / 备注（只读）'],
          ['关联业务记录 · 报修 / 维修工单', '演示状态机 repairReportsById / repairOrdersById 按 canonical deviceId 过滤；工单号可跳转 /repair-orders/:id 查看派工 / 执行 / 验收，动作后实时联动'],
          ['关联业务记录 · 报警', '演示状态机 alarmEventsById 按 deviceId 过滤：报警 ID / 名称 / 级别 / 状态 / 触发指标与触发值 / 触发时间 / 持续时长'],
        ]} />
        <h4>交互规则</h4>
        <ol>
          <li>跳转入口：设备监测详情（/device/:deviceId）、联网配置（/device-ledger/net-config，只读）、历史 OEE 详情。</li>
          <li>状态与趋势栏目：点「配置监控曲线」勾选数值型指标（可多选），确定后形成各指标曲线趋势图进行监控。</li>
          <li>param 与 query 两种进入形式均解析 deviceId，解析不到时显示「未找到对象」。</li>
        </ol>
        <h4>边界与显示规则</h4>
        <ul>
          <li>未知 deviceId：显示「未找到对象」EmptyState（有效范围 DEV-001..008），不回退第一条设备。</li>
          <li>档案静态字段只读；联网配置详情见 net-config spec（协议 / 网关 / IP / 端口 / 点表不在本系统维护）。</li>
        </ul>
      </>
    ),
  },
  '/device-ledger/net-config': {
    title: '设备联网配置（只读）',
    content: (
      <>
        <h4>页面目标</h4>
        <p>从设备台账进入的联网信息页：展示设备与 IoT 平台的对接信息与绑定结构。本页整体只读——协议 / 网关 / IP / 端口 / 点表不可编辑。</p>
        <h4>数据来源与刷新</h4>
        <ol>
          <li>绑定结构来自 <code>selectBinding / selectBindingVersions</code>；来源设备清单来自 sourceDevicesById；指标选择随绑定展示。</li>
          <li>{DATA_SOURCE_NOTE}</li>
        </ol>
        <h4>字段定义与计算公式</h4>
        <Fields items={[
          ['只读边界', '协议、网关、IP、端口、点表映射由 IoT 平台维护，本系统不提供任何编辑入口（演示与后续宿主集成都如此）'],
          ['绑定实例（只读展示）', '来源设备平级结构（不分主/子，2026-09 流程调整）：展示来源编码（IOT-D-* / IOT-S-* 种子沿用旧编码）与来源类型；状态类指标与温度 / 振动等专用指标按来源勾选'],
          ['指标勾选（展示）', '按来源设备分组展示已勾选指标与版本；未勾选指标不采集、不统计'],
          ['变更入口', '绑定关系的配置变更（换绑 / 增减来源 / 勾选指标）统一在联网配置总览走草稿 → 校验 → 保存 → 启用流程，本页只读'],
        ]} />
        <h4>交互规则</h4>
        <ol>
          <li>所有字段渲染为只读态（无输入控件）；页头提示「接入配置由 IoT 平台维护」。</li>
          <li>提供「去绑定管理」跳转联网配置总览。</li>
        </ol>
        <h4>边界与显示规则</h4>
        <ul>
          <li>未绑定设备（DEV-008）显示「未配置」与首绑引导，不显示空表格。</li>
          <li>已停用绑定（DEV-007）显示生效区间终点与停用摘要。</li>
        </ul>
      </>
    ),
  },
  '/report/runtime': {
    title: '运行时长与设备状态统计报表',
    content: (
      <>
        <h4>页面目标</h4>
        <p>按 日 × 设备 复盘各状态时长、稼动率与切换行为，是效率考核与设备改善的主要依据报表（合并原「运行时长与稼动率」「设备状态统计」两表）。</p>
        <h4>数据来源与刷新</h4>
        <ol>
          <li>行数据来自 <code>selectReportRows(state, 'runtime', filters)</code>（演示种子数据，兼容导出），筛选在 selector 内统一处理；查询动作 runReport 记录口径（reportsByKey：口径截止 = meta.lastSampleAt）。</li>
          <li>{DATA_SOURCE_NOTE}</li>
        </ol>
        <h4>字段定义与计算公式</h4>
        <Fields items={[
          ['运行 / 待机 / 故障 / 离线时长', '统计周期内各状态持续时长合计（分钟）；来自演示停机与状态事实派生'],
          ['稼动率', '运行 / (运行 + 待机 + 故障) × 100%；离线时长不入分母，防止失联设备虚增稼动率'],
          ['状态占比', '各状态时长 / 总统计时长 × 100%，堆叠条呈现，四项之和 = 100%'],
          ['切换次数 / 最长连续运行 / 最长离线', '状态跳变次数 / 最长运行段 / 最长离线段；跨天段连续计算'],
          ['汇总行', '时长类求和；稼动率用汇总时长重新计算（不是各行平均）'],
        ]} />
        <h4>交互规则</h4>
        <ol>
          <li>筛选：日期范围 + 车间 + 设备；汇总视图（一设备一行）与明细视图（一设备一天一行）切换。</li>
          <li>导出：createExportTask 生成演示导出任务（EXP-*，幂等键防重复），任务列表（selectExportTasks）显示状态流转与口径截止时间；导出内容标注「演示口径」。</li>
        </ol>
        <h4>边界与显示规则</h4>
        <ul>
          <li>筛选结果为空时显示 EmptyState（说明筛选条件与演示数据覆盖范围 2026-09 上旬至 16 日），不显示空表格或 0。</li>
          <li>无数据 / 不可计算一律「--」；数据完整率不足的行稼动率标注「不可计算」并附原因。</li>
        </ul>
      </>
    ),
  },
  '/report/production': {
    title: '生产产出报表',
    content: (
      <>
        <h4>页面目标</h4>
        <p>按 日 × 设备 复盘产量、质量与加工节拍，支撑排产核对与质量追溯。</p>
        <h4>数据来源与刷新</h4>
        <ol>
          <li>行数据来自 <code>selectReportRows(state, 'production', filters)</code>；产量与良品同源 oeeInputs（生产 / 质量点位汇总），明细标注数据来源。</li>
          <li>{DATA_SOURCE_NOTE}</li>
        </ol>
        <h4>字段定义与计算公式</h4>
        <Fields items={[
          ['产量', '合格 + 不合格数量合计（按生产计数点累计）'],
          ['合格 / 不合格数量', '质检判定结果数量；质检未回传时合格率显示「待质检」，不按 100% 计'],
          ['合格率', '合格数量 / 生产数量 × 100%；产量缺失或为 0 → 「--」+ 原因'],
          ['平均加工节拍', '运行时长 / 加工数量（秒/件）；运行时长为 0 时显示「--」'],
        ]} />
        <h4>交互规则</h4>
        <ol>
          <li>产量、合格率列排序；点击设备行下钻按物料拆分的产出明细。</li>
          <li>导出为演示任务（同通用报表导出口径）。</li>
        </ol>
        <h4>边界与显示规则</h4>
        <ul>
          <li>无上报不按 0 统计——DEV-005 无生产数据显示「--」与 EmptyState 说明。</li>
          <li>明细与汇总口径一致：明细 NG 数与汇总「不合格数量」同源。</li>
        </ul>
      </>
    ),
  },
  '/report/mttr': {
    title: 'MTTR / MTBF 分析报表',
    content: (
      <>
        <h4>页面目标</h4>
        <p>按月衡量维修速度（MTTR）与故障频率（MTBF），评估设备可靠性与维修效率趋势。</p>
        <h4>数据来源与刷新</h4>
        <ol>
          <li>指标来自 <code>selectMttrMtbf(state, deviceId)</code>：MTTR 从已完成工单（startedAt → acceptedAt）推导；MTBF = 有效运行时间 / 已关闭故障事件数（S.machine_state 类报警）。均从事实推导，不从页面数值二次平均。</li>
          <li>{DATA_SOURCE_NOTE}</li>
        </ol>
        <h4>字段定义与计算公式</h4>
        <Fields items={[
          ['故障次数', '统计期内进入故障状态且被确认的事件次数；未确认的瞬时抖动不计'],
          ['维修总时长 / MTTR', 'Σ 每次维修（开工 → 验收通过）时长 / 已完成工单数；无已完成工单显示「--」'],
          ['MTBF', '运行时长合计 / 故障次数；故障 0 次显示「--」不显示 ∞'],
          ['可用率', '运行 / (运行 + 故障维修) × 100%；≥98% 绿，否则橙'],
        ]} />
        <h4>交互规则</h4>
        <ol>
          <li>顶部摘要卡展示全部设备平均 MTTR / MTBF / 可用率 / 本月故障总数。</li>
          <li>点击设备行查看故障事件明细；导出含公式与口径说明（演示导出任务）。</li>
        </ol>
        <h4>边界与显示规则</h4>
        <ul>
          <li>统计期内无故障 → MTBF「--」；无已完成工单 → MTTR「--」，均不显示 0。</li>
          <li>已完成工单缺开始 / 验收时间属数据异常，剔除该单计算并提示。</li>
        </ul>
      </>
    ),
  },
  '/report/comprehensive': {
    title: '设备综合运行分析报表',
    content: (
      <>
        <h4>页面目标</h4>
        <p>一设备一行的综合体检表：状态、稼动率、报警、数据质量、产出、程序比对集中呈现，用于月度设备例会。</p>
        <h4>数据来源与刷新</h4>
        <ol>
          <li>行数据来自 <code>selectReportRows(state, 'comprehensive', filters)</code>；各字段口径与对应专项报表完全一致，本页不单独定义。</li>
          <li>{DATA_SOURCE_NOTE}</li>
        </ol>
        <h4>字段定义与计算公式</h4>
        <Fields items={[
          ['状态分布 / 稼动率', '运行 / 待机 / 故障 / 离线 时长占比堆叠条；稼动率 = 运行 / (运行 + 待机 + 故障) × 100%，离线不入分母'],
          ['报警数 / 重要报警数', '活动报警事件数 / 其中紧急 + 重要数量'],
          ['产量 / 合格率', '各物料产出合计；合格率 = 合格 / 生产 × 100%'],
          ['OEE', '实时 OEE 快照（selectOeeResult）；不可计算显示「--」+ blockers'],
          ['参数不一致数', '程序比对结果为「参数不一致」的次数；比对失败不统计在内'],
        ]} />
        <h4>交互规则</h4>
        <ol>
          <li>报警数列可排序；点击各指标跳转对应专项报表并预置该设备筛选。</li>
          <li>横向滚动时设备列固定；导出为演示任务。</li>
        </ol>
        <h4>边界与显示规则</h4>
        <ul>
          <li>数据完整率不足的整行加「数据参考性有限」提示。</li>
          <li>无数据设备（DEV-005）各指标显示「--」并在行内说明数据中断。</li>
        </ul>
      </>
    ),
  },
  '/report/alarm': {
    title: '报警统计报表',
    content: (
      <>
        <h4>页面目标</h4>
        <p>按 日 × 设备 统计报警数量、状态分布与处置时效，评估报警负载与响应效率。</p>
        <h4>数据来源与刷新</h4>
        <ol>
          <li>行数据来自 <code>selectReportRows(state, 'alarm', filters)</code>；状态分布可由 selectAllAlarms 按 demoDay 交叉核验（同源事实）。</li>
          <li>{DATA_SOURCE_NOTE}</li>
        </ol>
        <h4>字段定义与计算公式</h4>
        <Fields items={[
          ['报警总数', '统计期内新建报警事件数（不含被重复抑制的触发；重复抑制量单列）'],
          ['状态分布', '待确认 / 处理中 / 恢复待关闭 / 已关闭 按事件当前状态；跨天未关闭事件归发生日'],
          ['平均确认', 'Σ(确认时间 − 触发时间) / 已确认事件数；无已确认事件显示「--」'],
          ['平均关闭', 'Σ(关闭时间 − 触发时间) / 已关闭事件数'],
          ['重复 / 升级', '重复抑制累计次数 / 超时升级次数；重复占比过高提示规则需调参'],
        ]} />
        <h4>交互规则</h4>
        <ol>
          <li>点击设备行查看报警事件明细（可跳转报警中心预置设备筛选）。</li>
          <li>超时限目标（按等级 SLA）的行橙色标注；导出为演示任务。</li>
        </ol>
        <h4>边界与显示规则</h4>
        <ul>
          <li>演示数据集覆盖 2026-09-16 当日 6 条事件 + 历史事件，筛选范围外显示 EmptyState。</li>
          <li>状态分布为期末快照口径，与报警中心实时状态可能存在时点差，页面注明。</li>
        </ul>
      </>
    ),
  },
  '/report/quality': {
    title: '数据质量统计报表',
    content: (
      <>
        <h4>页面目标</h4>
        <p>按 日 × 设备 度量采集链路健康度：采样完整性、延迟、补传与重复情况，为「不可计算」判定提供依据。</p>
        <h4>数据来源与刷新</h4>
        <ol>
          <li>行数据来自 <code>selectReportRows(state, 'quality', filters)</code>；质量口径与接入域一致（延迟 = 超过 2×采样周期；质量码模型 GOOD / DELAYED / NO_VALUE / OFFLINE）。</li>
          <li>{DATA_SOURCE_NOTE}</li>
        </ol>
        <h4>字段定义与计算公式</h4>
        <Fields items={[
          ['应采样 / 实收 / 有效', 'Σ已配置指标数 × 理论采样次数 / 实际接收 / 通过质量校验数'],
          ['缺失 / 延迟', '缺失 = 按周期判定未到达；延迟 = 超过 2×采样周期才到达'],
          ['补传 / 重复', '补传 = 修复后重放入库量；重复 = 按幂等键判重丢弃量'],
          ['完整率', '有效 / 应采样 × 100%；为 0% 且应采样 > 0 时整行标红'],
        ]} />
        <h4>交互规则</h4>
        <ol>
          <li>完整率低的设备行可点击跳转联网配置总览查看健康度与任务。</li>
          <li>缺失明细可导出（演示任务）供补传修复参照。</li>
        </ol>
        <h4>边界与显示规则</h4>
        <ul>
          <li>DEV-005 完整率 0%（数据中断）→ 整行标红并联动 IT-003 任务原因。</li>
          <li>DEV-007/008 未启用绑定显示「未配置」，不显示 0%。</li>
        </ul>
      </>
    ),
  },
  '/report/program': {
    title: '程序比对统计报表',
    content: (
      <>
        <h4>页面目标</h4>
        <p>按 日 × 设备 统计程序下发与比对结果，监控参数漂移和下发管理执行情况。</p>
        <h4>数据来源与刷新</h4>
        <ol>
          <li>行数据来自 <code>selectReportRows(state, 'program', filters)</code>；可与 selectProgramCompare 明细交叉核验。</li>
          <li>{DATA_SOURCE_NOTE}</li>
        </ol>
        <h4>字段定义与计算公式</h4>
        <Fields items={[
          ['下发次数 / 比对次数', '向设备下发程序参数集次数 / 比对任务执行次数'],
          ['一致 / 参数不一致', '关键参数与基线一致 / 存在差异（差异字段、容差可追溯）'],
          ['比对失败数 / 不适用数', '通信或解析失败 / 无程序基线；两者均不参与一致性统计并单列'],
          ['处理完成 / 未处理', '参数不一致中已填写处理结论 / 尚未处置的数量；处理记录不可删除'],
          ['一致率', '一致 / (比对次数 − 比对失败 − 不适用) × 100%，仅对有效比对计算'],
        ]} />
        <h4>交互规则</h4>
        <ol>
          <li>参数不一致 &gt; 0 的行高亮；点击跳转程序参数比对页查看差异明细。</li>
          <li>未处理数 &gt; 0 的行提示跳转比对处理记录跟进；导出为演示任务。</li>
        </ol>
        <h4>边界与显示规则</h4>
        <ul>
          <li>比对失败与参数不一致严格分开统计；无基线设备单独归类。</li>
          <li>演示当日：DEV-002 参数不一致（处理中）、DEV-004 比对失败、DEV-003 不适用、DEV-001 一致。</li>
        </ul>
      </>
    ),
  },
  '/report/repair': {
    title: '维修统计报表',
    content: (
      <>
        <h4>页面目标</h4>
        <p>按 月 × 设备 统计报修、维修工单闭环、故障类型分布与维修时效，支撑维修资源与故障率分析。</p>
        <h4>数据来源与刷新</h4>
        <ol>
          <li>行数据来自 <code>selectReportRows(state, 'repair', filters)</code>；工单口径与 selectAllRepairOrders / selectMttrMtbf 同源。</li>
          <li>{DATA_SOURCE_NOTE}</li>
        </ol>
        <h4>字段定义与计算公式</h4>
        <Fields items={[
          ['报修数 / 维修工单数', '新建报修单数 / 主工单数（报警转维修 + 人工报修）；重复报修同一故障合并计数并备注'],
          ['状态分布', '已完成 / 进行中（已派工 + 维修中 + 挂起）/ 待处理（待派工 + 待验收）期末快照'],
          ['故障类型分布', '机械 / 电气 / 液压 / 气动 / 控制系统等按工单登记分类；类型之和 = 工单数（校验）'],
          ['MTTR / 一次修复率', 'Σ修复耗时 / 已完成工单数；一次修复率 = 返修 0 次工单 / 已完成工单 × 100%（reworkCount 口径）'],
        ]} />
        <h4>交互规则</h4>
        <ol>
          <li>故障类型分布柱状图与表格联动；点击设备行跳转维修任务列表（预置筛选）。</li>
          <li>待处理 &gt; 0 的行标黄提示；导出为演示任务。</li>
        </ol>
        <h4>边界与显示规则</h4>
        <ul>
          <li>无已完成工单时 MTTR / 一次修复率显示「--」。</li>
          <li>跨月工单按开工月份统计；返修轮次保留在工单履历不重置。</li>
        </ul>
      </>
    ),
  },
  '/report/sparepart': {
    title: '备件管理统计报表',
    content: (
      <>
        <h4>页面目标</h4>
        <p>按备件统计出入库与库存水位，识别低库存、超储与高消耗备件，支撑采购与库存策略。</p>
        <h4>数据来源与刷新</h4>
        <ol>
          <li>行数据来自 <code>selectReportRows(state, 'sparepart', filters)</code>；库存与流水可与 selectStockRows / selectStockFlows 交叉核验（同源事实）。</li>
          <li>{DATA_SOURCE_NOTE}</li>
        </ol>
        <h4>字段定义与计算公式</h4>
        <Fields items={[
          ['期初库存', '当前库存 − 本月入库 + 本月出库（反推，保证勾稽一致）'],
          ['本月入库 / 出库', '已审核入库单 / 出库单数量合计（按备件明细行汇总）'],
          ['当前库存 / 可用', '现存（onHand）与可用 = 现存 − 预留；未配置库存显示「--」'],
          ['安全 / 最高库存', '备件档案配置值；库存状态判定与库存页一致（低于安全 / 超储 / 正常）'],
          ['周转天数', '期末库存 / (月出库量 / 30)；月出库为 0 显示「--」'],
        ]} />
        <h4>交互规则</h4>
        <ol>
          <li>当前库存 / 安全库存分组柱状图对比水位；低于安全库存的备件行标红（演示：空压机滤芯 120006）。</li>
          <li>点击备件行跳转库存明细（流水预筛选）；导出为演示任务。</li>
        </ol>
        <h4>边界与显示规则</h4>
        <ul>
          <li>期初勾稽不平（台账被手工调整）时行标黄提示补录；负库存禁止保存出库单（出库校验拦截）。</li>
          <li>不同仓库同备件合并统计，明细页按仓库分行；领用 / 维修 / 退库分类型统计。</li>
        </ul>
      </>
    ),
  },
  '/screen/device': {
    title: '设备监测大屏',
    content: (
      <>
        <h4>页面目标</h4>
        <p>管理层快速查看设备运行、报警与数据接入质量的深色大屏（独立渲染，不经后台布局）。</p>
        <h4>数据来源与刷新</h4>
        <ol>
          <li>读模型来自 <code>selectScreenViewModel(state)</code>：与后台同源 selector——取前 5 台设备（DEV-001..005）的实时状态、健康、主轴 / 冷却温度、实时 OEE 与活动报警，并汇总 running / fault / noData / activeAlarms / unacked。</li>
          <li>只读页面：大屏不提供业务动作，仅支持翻页（setScreenPage）。</li>
          <li>{DATA_SOURCE_NOTE}</li>
        </ol>
        <h4>字段定义与计算公式</h4>
        <Fields items={[
          ['设备卡片', '设备身份（名称 + 台账资产码）、运行状态（S.machine_state）、通信健康、主轴温度 / 冷却液温度（无值「--」）、OEE、报警数；紧急报警单独高亮（urgentAlarm）'],
          ['汇总条', '运行 / 故障 / 无数据 台数 + 活动报警 / 未确认数；「无数据」与「故障」分开统计（DEV-005 计入无数据）'],
          ['演示标注', '底部固定「演示数据」标注（meta.source = demo）+ 最后样本时间；深色主题下仍可读'],
        ]} />
        <h4>交互规则</h4>
        <ol>
          <li>默认轮播翻页，可暂停；从工作台 / 菜单以独立窗口打开（#/screen/device）。</li>
          <li>点击卡片不跳转业务页（大屏只读），返回后台查看详情。</li>
        </ol>
        <h4>边界与显示规则</h4>
        <ul>
          <li>DEV-005（剧本 C）：运行状态「无数据」、温度与 OEE 显示「--」，不显示 0。</li>
          <li>数据断开模式（meta.degraded）时顶部显示降级提示，旧值不再标记为实时。</li>
        </ul>
      </>
    ),
  },
  '/alarm-rules': {
    title: '报警规则配置',
    content: (
      <>
        <h4>页面目标</h4>
        <p>维护报警判定规则：判定条件、等级、通知策略与版本化发布；规则是报警中心事件的唯一产生来源。</p>
        <h4>数据来源与刷新</h4>
        <ol>
          <li>规则档案来自 alarmRulesById（演示白名单规则 R-TEMP-001/002、R-PRESS-001、R-STATE-001、R-COMPARE-001、R-QUALITY-001、R-SPARE-001——点检 / 保养类规则不在本次范围）。</li>
          <li>{DATA_SOURCE_NOTE}</li>
        </ol>
        <h4>字段定义</h4>
        <Fields items={[
          ['规则类型', '阈值（越上限 / 越下限 / 区间外 + 持续时间 + 恢复回差）/ 状态（S.* 枚举判定，状态恢复即恢复）/ 质量（数据延迟、无效率）/ 程序比对 / 备件水位'],
          ['触发 / 恢复条件', '演示样例：主轴温度 > 80℃ 持续 60s，恢复 < 75℃（回差 5℃）持续 30s；气压区间外 0.6~0.8 MPa，恢复带 0.65~0.75 MPa'],
          ['重复抑制 / 风暴限流', '同一设备 + 同一规则存在活动事件时不新建事件（去重键合并计数）；单规则每小时新建事件上限'],
          ['等级 / 通知策略', '紧急 / 重要 / 一般 / 提示 + NP-* 策略引用'],
          ['近 7 天 触发 / 抑制', '规则治理统计（trig7d / supp7d）；抑制 &gt; 触发判定为高抖动规则并提示调参'],
        ]} />
        <h4>指标级联选择（2026-09-22 调整）</h4>
        <ol>
          <li>新增 / 编辑弹窗中「设备 → 子设备 → 指标」三级改为一个级联控件（Cascader）一次选完：① 系统设备（台账资产编码）→ ② 子设备（来源 IoT 设备：主设备 / 传感器，标注角色）→ ③ 已勾选指标；支持关键词搜索。</li>
          <li>仅展示「已启用」绑定中的已勾选指标，未启用绑定与未勾选指标不进入可选范围；无可用指标的分支自动裁剪。</li>
          <li>状态规则在级联中仅可选状态类 S.* 指标（叶子按前缀过滤）；切换规则类型时已选指标自动切换到对应类型的可用项。</li>
          <li>选中指标后仍按「指标判定特征模板」自动带出推荐判定模式与参数，可修改；规则模板导入优先于指标特征模板。</li>
        </ol>
        <h4>通知策略 = 模板 + 临时调整（2026-09-22 调整）</h4>
        <ol>
          <li>⑥ 通知策略中选择 NP-* 策略后，系统按该策略<b>模板带出</b>其通知内容：渠道（站内必发不可取消）、接收人、首次通知、重复间隔、升级节点、静默时段、最大重试。</li>
          <li>带出后各字段可针对本规则<b>临时调整</b>（如缩短重复间隔、追加值班接收人、覆盖静默时段）；调整仅本规则生效，不回写「通知策略配置」中的策略本体；发生偏离时显示「已临时调整」标记，可一键「恢复模板默认」。</li>
          <li>更换策略模板时按新模板重新带出；发布版本快照记录调整后的最终通知口径（policyOverride 标记）。</li>
        </ol>
        <h4>版本与发布规则</h4>
        <ol>
          <li>规则发布生成不可变版本快照（R-TEMP-001 V2 → V3），活动报警按触发时版本判定（ruleVersion 进 dedupeKey）。</li>
          <li>规则只能停用，不可删除；历史事件与版本保留。</li>
          <li>演示数据源降级（断开模式）时实时规则标注「降级」并明示实际延迟，不静默承诺秒级报警。</li>
        </ol>
      </>
    ),
  },
  '/alarm-rule-templates': {
    title: '报警规则模板',
    content: (
      <>
        <h4>页面目标</h4>
        <p>同型设备的指标特征与报警参数高度一致，模板 = 除「设备绑定」外的全部规则要素预设，一次调优、多处复用。</p>
        <h4>应用入口</h4>
        <ol>
          <li>新增报警规则时「从模板导入」：自动填充规则类型、判定模式、阈值 / 区间、持续时间、回差等参数，再选设备与指标。</li>
          <li>本页「应用到设备」：多选设备批量生成规则草稿，按各自绑定关系匹配模板适用指标，生成后逐条确认发布。</li>
          <li>规则编辑弹窗「存为模板」沉淀通用参数。</li>
        </ol>
        <h4>字段定义</h4>
        <Fields items={[
          ['模板编号 / 名称', 'RT-* 编号；按「指标类型 + 判定模式」命名'],
          ['适用指标 / 规则类型', '描述模板适用指标类型（温度类 / 压力液位类 / 振动类 / 状态类等）与判定模式'],
          ['触发 / 恢复参数', '阈值或正常区间、持续时间、回差；状态模板无阈值与回差'],
          ['通知策略 / 状态', '模板预设 NP-* 策略；启用模板才出现在导入候选中'],
        ]} />
        <h4>版本语义</h4>
        <ol>
          <li>模板更新不回写已发布规则；删除模板不影响已发布规则与版本快照。</li>
          <li>模板在演示环境中为只读示例数据，不提供编辑动作。</li>
        </ol>
      </>
    ),
  },
  '/alarm-rule-versions': {
    title: '报警规则版本',
    content: (
      <>
        <h4>页面目标</h4>
        <p>追溯规则历史版本；当需要解释「这条报警当时按什么条件触发」时，以本页快照为准。</p>
        <h4>数据来源与刷新</h4>
        <ol>
          <li>版本快照来自 alarmRuleVersionsById（演示：R-TEMP-001 V2/V3、R-STATE-001 V5、R-COMPARE-001 V2、R-QUALITY-001 V4）。</li>
          <li>{DATA_SOURCE_NOTE}</li>
        </ol>
        <h4>字段定义</h4>
        <Fields items={[
          ['版本号', '同一规则内递增（V1/V2/…），发布时生成；不可修改、不可删除'],
          ['发布时间 / 发布人', '发布动作留痕，与审计履历关联'],
          ['生效区间', '该版本起止生效时间；判定历史报警按事件发生时间取对应版本'],
          ['条件 / 通知快照', '触发与恢复条件、通知策略的完整快照；与策略后续修改无关'],
          ['关联事件数', '使用该版本判定的报警事件数量（评估修改影响面）'],
        ]} />
        <h4>比对规则</h4>
        <ol>
          <li>任选两个版本比对，逐项展示差异并标注类型：新增 / 删除 / 修改。</li>
          <li>版本快照为只读演示数据；报警事件的 ruleVersion 字段与本页版本对应，可在报警中心回溯。</li>
        </ol>
      </>
    ),
  },
  '/notification-policy': {
    title: '通知策略配置',
    content: (
      <>
        <h4>页面目标</h4>
        <p>配置报警事件的通知渠道、接收人、重试与升级节奏；策略被规则发布时以快照方式引用。</p>
        <h4>数据来源与刷新</h4>
        <ol>
          <li>策略档案来自 notificationPoliciesById（演示：NP-URGENT / NP-IMPORTANT / NP-GENERAL）；实际送达结果见报警中心通知送达记录（ND-*）。</li>
          <li>{DATA_SOURCE_NOTE}</li>
        </ol>
        <h4>字段定义</h4>
        <Fields items={[
          ['适用等级 / 渠道', '紧急 / 重要 / 一般 / 提示；渠道 站内 / 短信 / 企业微信（站内必选）'],
          ['通知组 / 接收人', '组与个人混选（演示：NP-URGENT → 李明、王强、赵艳）'],
          ['首次通知 / 重复间隔', '触发后首次通知延迟；未确认时按间隔重复通知（有上限）'],
          ['升级节点 / 静默时段', '超时未确认升级（如 10 分钟 / 30 分钟，每层级一次）；静默时段内外部渠道不发、站内保留'],
          ['最大重试', '发送失败最大重试；超过标记失败并保留原因（ND-006：重试 3 次后成功）'],
        ]} />
        <h4>校验与测试规则</h4>
        <ol>
          <li>策略停用后已发布规则版本快照不受影响；新发布版本不可再选停用策略。</li>
          <li>「测试发送」记录送达结果（演示为模拟记录）；策略档案为演示只读口径，不提供编辑动作。</li>
        </ol>
      </>
    ),
  },

  // ---------- 基础配置模块（系统从宿主平台拆分独立后自建，参考特变项目基础管理功能） ----------
  '/system/users': {
    title: '用户管理',
    content: (
      <>
        <h4>页面目标</h4>
        <p>系统从数字化宿主平台拆分独立后自建的账号管理入口：维护登录账号、所属组织机构、角色绑定与账号生命周期（新增 / 编辑 / 启停用 / 重置密码 / 删除），登录控制以本页账号状态为准。</p>
        <h4>数据来源</h4>
        <ul>
          <li>只读种子来自 <code>src/data/systemConfig.js</code>（sysUsers，工号 U0001..U0012）；部门选项来自组织机构树，角色选项来自角色管理。</li>
          <li>新增 / 编辑 / 删除 / 批量启停用 / 重置密码为页面内演示交互，不写入 DemoStore（刷新恢复种子）。</li>
        </ul>
        <h4>字段与校验规则</h4>
        <Fields items={[
          ['工号', '系统自动生成（U + 4 位序号），不可编辑'],
          ['登录账号', '字母开头，3-20 位字母/数字/下划线，全局唯一；创建后不可修改'],
          ['所属部门', '组织机构树节点（含路径），决定数据权限过滤范围'],
          ['角色', '至少绑定 1 个角色，功能权限随角色生效；可多选'],
          ['手机号', '必填，11 位且 1[3-9] 开头，用于登录异常通知'],
          ['状态', '正常 / 停用；停用立即无法登录，历史操作日志保留'],
        ]} />
        <h4>操作与安全规则</h4>
        <ol>
          <li>新增用户：初始密码统一为 Dh@2026，首次登录强制修改密码（提示口径）。</li>
          <li>重置密码：二次确认；旧密码立即失效，重置为初始密码。</li>
          <li>删除用户：二次确认；系统管理员内置账号（U0001）不允许删除 / 停用；被删除用户的历史日志按账号归档保留。</li>
          <li>批量启用 / 停用：需先勾选行，未勾选时按钮禁用并提示「请先勾选数据」。</li>
          <li>登录锁定策略：密码连续输错 5 次锁定 30 分钟（失败记录见日志管理 · 登录日志）。</li>
        </ol>
      </>
    ),
  },
  '/system/roles': {
    title: '角色管理',
    content: (
      <>
        <h4>页面目标</h4>
        <p>RBAC 角色管理：一个角色 = 一组功能权限（菜单 / 页面 / 操作）+ 一个数据权限范围；用户通过绑定角色获得权限，本页提供角色的新增 / 编辑 / 启停用 / 删除与「分配权限」。</p>
        <h4>数据来源</h4>
        <ul>
          <li>角色种子来自 <code>systemConfig.js</code>（sysRoles，R001..R006：系统管理员 / 设备管理员 / 维修工程师 / 点检保养专员 / 报表分析员 / 只读访客）。</li>
          <li>功能权限树来自 <code>sysPermissionTree</code>（菜单级 menu:* + 基础配置操作级 perm:system:*）。</li>
        </ul>
        <h4>字段与校验规则</h4>
        <Fields items={[
          ['角色编码', '大写字母开头，3-30 位大写字母/数字/下划线，全局唯一，创建后不可修改'],
          ['数据权限范围', '全部 / 本部门及以下 / 本部门 / 仅本人（按组织机构树过滤业务数据）'],
          ['已分配用户', '引用计数，从用户管理实时推导，角色页不允许直接删人'],
          ['功能权限', '分配权限弹窗按树勾选，保存后用户下次进入页面时刷新生效'],
        ]} />
        <h4>操作规则</h4>
        <ol>
          <li>删除角色：已分配用户的角色不允许删除，须先在用户管理中移除；系统管理员角色（R001）内置不允许删除。</li>
          <li>停用角色：已分配用户保留角色绑定，但对应功能权限不再生效。</li>
          <li>新增角色默认未勾选任何功能权限，创建成功提示进入「分配权限」配置。</li>
        </ol>
      </>
    ),
  },
  '/system/org': {
    title: '组织机构',
    content: (
      <>
        <h4>页面目标</h4>
        <p>左树右表结构：左侧维护部门树（公司 → 部门 → 科室 / 车间），右侧展示所选部门的部门人员；部门树是数据权限（本部门及以下）和业务归属（使用部门、责任部门）的唯一组织口径。</p>
        <h4>数据来源</h4>
        <ul>
          <li>部门树种子来自 <code>systemConfig.js</code>（sysOrgTree，根组织 DHZC 不允许删除 / 停用）；部门人员按用户 deptPath 前缀匹配实时推导。</li>
        </ul>
        <h4>字段与交互规则</h4>
        <Fields items={[
          ['部门路径', 'key 为完整路径（如 设备部/维修科），重命名时子孙部门与人员路径同步更新'],
          ['显示排序', '同层级按序号升序展示'],
          ['含子部门', '右侧人员列表开关：开启时展示所选部门及其全部子孙部门人员'],
        ]} />
        <ol>
          <li>新增部门：必选上级部门 + 部门名称；同级同名部门不允许创建；停用状态的部门不允许新增人员。</li>
          <li>编辑部门：不允许把自己或其子孙部门选为上级（防环）。</li>
          <li>删除部门：存在子部门或人员时禁止删除，提示先转移；根组织不允许删除 / 停用。</li>
          <li>新增人员：组织机构页快捷入口只录基础信息并挂部门；角色、密码等完整账号管理在用户管理页维护。</li>
        </ol>
      </>
    ),
  },
  '/system/dict': {
    title: '字典管理',
    content: (
      <>
        <h4>页面目标</h4>
        <p>系统级枚举字典（字典类型 + 字典项两级）：业务下拉、状态标签、报表口径统一取数于此（设备运行状态、报警级别、报修来源、用户状态、数据权限范围、登录结果等），避免各页面硬编码枚举。</p>
        <h4>数据来源</h4>
        <ul>
          <li>种子来自 <code>systemConfig.js</code>（sysDictTypes 6 类 + sysDictEntries；设备运行状态与运行监测/台账状态轴口径一致）。</li>
        </ul>
        <h4>字段与校验规则</h4>
        <Fields items={[
          ['字典编码', '小写字母开头，2-30 位小写字母/数字/下划线，全局唯一，创建后不可修改'],
          ['字典标签', '业务侧显示文字；同一类型内唯一'],
          ['键值', '业务数据实际存储编码；同一类型内唯一，保存后不建议修改'],
          ['排序', '字典项在下拉中的显示顺序'],
        ]} />
        <h4>操作规则</h4>
        <ol>
          <li>删除字典类型：类型下存在字典项时禁止删除，须先清空字典项。</li>
          <li>停用字典项：业务侧新增数据时不再提供该选项，历史数据不受影响。</li>
          <li>删除字典项二次确认：已被业务数据引用的项删除后历史记录按原标签显示。</li>
        </ol>
      </>
    ),
  },
  '/system/logs': {
    title: '日志管理',
    content: (
      <>
        <h4>页面目标</h4>
        <p>登录日志 + 系统操作日志两个视图（Tabs）：登录日志记录每次登录的成败与失败原因（密码错误 / 账号停用 / 锁定），操作日志记录关键业务动作（新增 / 修改 / 删除 / 导入 / 导出 / 状态流转 / 分配权限 / 重置密码），供运维排查与操作追溯。</p>
        <h4>数据来源</h4>
        <ul>
          <li>种子来自 <code>systemConfig.js</code>（sysLoginLogs 13 条，含 2 条失败样例；sysOperationLogs 14 条，含 1 条失败样例）。</li>
        </ul>
        <h4>字段与规则</h4>
        <Fields items={[
          ['日志编号', 'LOGIN-/OPT- + 日期 + 序号，系统自动生成'],
          ['登录地点', '按 IP 段推导（厂区办公网 / 车间终端 / 外网 VPN / 机房运维网）'],
          ['操作类型', '新增 / 修改 / 删除 / 导入 / 导出 / 状态流转 / 分配权限 / 重置密码，不同 Tag 色'],
          ['耗时', '操作日志记录接口耗时（ms），空值显示 --'],
        ]} />
        <ol>
          <li>日志由系统自动写入，不提供人工新增 / 编辑。</li>
          <li>查询条件：登录日志（用户 / 登录结果 / 关键词），操作日志（模块 / 操作人 / 结果 / 关键词）；均支持导出。</li>
          <li>清空：仅系统管理员可操作，二次确认并建议先导出留档（演示模式下刷新恢复）。</li>
          <li>失败日志计数展示在 Tab 标签上（登录失败条数），失败原因记录在描述列。</li>
        </ol>
      </>
    ),
  },
};

// ---------- 点检 / 保养 / 巡检（范围外演示模块，应需求恢复） ----------
// 数据为只读演示种子（standardData.js），设备经 canonical crosswalk 映射；执行交互为页面本地 UI 状态，
// 完整业务闭环由点巡保养业务模块承接；页面顶部显示演示数据源徽标与降级横幅。
const DEMO_MODULE_NOTE = (
  <>
    <li>本模块为范围外演示模块：数据直接只读来自演示种子（standardData.js），不进入 DemoStore 动作流；新增 / 编辑 / 执行均为演示交互（页面本地 UI 状态），不持久化。</li>
    <li>完整点巡保养业务闭环（任务生成、执行留痕、异常闭环）由点巡保养业务模块承接；设备展示统一经 canonical crosswalk 映射（DEV-001..008 ↔ MT2024A1201..1208）。</li>
    <li>空值显示 '--'，状态用统一状态标签；时间取种子自带时间或演示快照时间，不使用真实时钟。</li>
  </>
);

const inspectionContent = (
  <>
    <h4>页面目标</h4>
    <p>点检管理演示模块：维护点检项目档案、点检标准（标准关联设备与项目）、点检计划（周期生成任务）与点检任务（执行 / 详情），并提供执行统计报表。</p>
    <h4>数据来源与刷新</h4>
    <ol>
      <li>点检项目来自种子 inspectionItems；点检标准来自 inspectionStandards / inspectionStandardDevices / inspectionStandardItemCodes；点检计划来自 inspectionPlans；点检任务来自 inspectionTasks / inspectionTaskDetails / inspectionExecItems。</li>
      <li>{DEMO_MODULE_NOTE}</li>
    </ol>
    <h4>字段定义与计算公式</h4>
    <Fields items={[
      ['判断结果类型', '单选（正常/异常）/ 数值（给出正常值范围，超出为异常）/ 文本（描述）；单选默认选项 正常/异常'],
      ['任务状态', '待执行 / 进行中 / 已完成 / 已逾期（演示种子固定值，用统一状态标签着色）'],
      ['完成率（报表）', '已完成任务数 / 任务总数 × 100%；异常检出率 = 异常项数 / 已检项数 × 100%'],
      ['检查项结果', '正常 / 异常 / 未检 三态；异常项在详情中高亮并提示关联处理方式'],
    ]} />
    <h4>交互规则与边界</h4>
    <ol>
      <li>列表页：编号 / 名称 / 类型 / 状态筛选；项目 / 标准 / 计划 / 任务列表均提供新增 / 编辑弹窗与行级操作（删除、完结、启用停用等），新增的行在页面内可见（演示不落库，刷新恢复快照）；计划编辑同步口径提示「变更同步到未执行任务及后续生成任务」，完结提示「已生成任务仍可执行、计划不再生成新任务」。</li>
      <li>标准详情展示关联设备（crosswalk canonical 名称 + MT 资产编号）与关联项目清单；计划详情展示关联任务完成情况。</li>
      <li>执行页（/inspection-tasks/execute）：逐项填写 结果 + 数值 / 备注，提交后仅本地确认弹窗提示「演示模式：执行结果仅在当前页面生效」。</li>
      <li>详情 / 执行页通过 query 参数读取单据 id，无对应对象时显示「未找到对象」空态（原因 + 下一步），不回退第一条。</li>
      <li>报表（/report/inspection）：按设备 / 执行人 / 状态聚合任务完成率与异常检出率；导出为演示占位。</li>
    </ol>
  </>
);

const maintenanceContent = (
  <>
    <h4>页面目标</h4>
    <p>保养管理演示模块：维护保养项目档案（按 清洁保养 / 干湿类保养 / 表面保养 / 机油保养 分组）、保养标准、保养计划与保养任务（执行 / 详情），并提供执行统计报表。</p>
    <h4>数据来源与刷新</h4>
    <ol>
      <li>保养项目来自种子 maintenanceItems / maintenanceItemGroups；保养标准来自 maintenanceStandards / maintenanceStandardDevices / maintenanceStandardItemCodes；保养计划来自 maintenancePlans / maintenancePlanDetails；保养任务来自 maintenanceTasks / maintenanceTaskDetails / maintenanceExecItems。</li>
      <li>{DEMO_MODULE_NOTE}</li>
    </ol>
    <h4>字段定义与计算公式</h4>
    <Fields items={[
      ['保养项目分组', '清洁保养 / 干湿类保养 / 表面保养 / 机油保养 四组，项目按组展示'],
      ['周期类型', '日 / 周 / 月 / 季 / 年（计划按周期生成任务，演示种子固定）'],
      ['任务状态', '待执行 / 进行中 / 已完成 / 已逾期；执行项结果为 已做 / 异常 / 跳过（跳过必填原因）'],
      ['完成率（报表）', '已完成任务数 / 任务总数 × 100%；工时合计 = Σ任务实耗工时'],
    ]} />
    <h4>交互规则与边界</h4>
    <ol>
      <li>列表页：关键词 / 分组 / 状态筛选；项目 / 标准 / 计划 / 任务列表均提供新增 / 编辑弹窗与行级操作（删除、完结、启用停用），新增的行在页面内可见（演示不落库，刷新恢复快照）。</li>
      <li>标准详情展示关联设备（crosswalk canonical）与关联项目；计划详情展示周期配置与关联任务。</li>
      <li>执行页（/maintenance-tasks/execute）：逐项保养结果 + 耗材 / 工时录入，提交仅本地确认提示「完整闭环由点巡保养业务模块承接」。</li>
      <li>详情 / 执行页 query 读 id，无对象显示「未找到对象」；空值 '--'。</li>
      <li>报表（/report/maintenance）：按设备 / 执行人聚合计划完成率、异常率、工时合计；导出为演示占位。</li>
    </ol>
  </>
);

const patrolContent = (
  <>
    <h4>页面目标</h4>
    <p>巡检管理演示模块：维护巡检项目档案、巡检标准（巡检线路关联设备）、巡检计划与巡检任务（按线路执行 / 详情），并提供执行统计报表。</p>
    <h4>数据来源与刷新</h4>
    <ol>
      <li>巡检项目来自种子 patrolItems；巡检标准来自 patrolStandards；巡检计划与线路设备来自 patrolPlans / patrolPlanDevices；巡检任务与明细来自 patrolTasks / patrolTaskDetails / patrolExecItems。</li>
      <li>{DEMO_MODULE_NOTE}</li>
    </ol>
    <h4>字段定义与计算公式</h4>
    <Fields items={[
      ['巡检线路', '标准下挂多个设备（如 一号车间日常巡检标准 4 台设备），设备行含 工位 / 位置 / 巡检项目数'],
      ['判断结果类型', '单选（合格/不合格、有/无）/ 数值（正常值范围）/ 文本；数值在范围内为正常'],
      ['任务状态', '进行中 / 未开始 / 已完成 / 已逾期 / 逾期完成（演示种子固定值）'],
      ['漏检（报表）', '漏检项目数 = Σ任务明细 unchecked；跳过设备须有跳过原因；完成率 = 已完成 / 任务总数'],
    ]} />
    <h4>交互规则与边界</h4>
    <ol>
      <li>列表页：关键词 / 状态筛选；项目 / 标准 / 计划 / 任务列表均提供新增 / 编辑弹窗与行级操作（删除、完结、启用停用），任务支持「新增临时任务（不从计划生成）」，新增的行在页面内可见（演示不落库，刷新恢复快照）。</li>
      <li>标准详情展示巡检线路设备（crosswalk canonical）与项目清单；计划详情展示线路设备与关联任务。</li>
      <li>执行页（/patrol-tasks/execute）：按线路逐设备逐项填写 结果 / 备注，设备可跳过（必填原因，如「设备正在生产，无法停机巡检」）；提交仅本地确认提示。</li>
      <li>详情 / 执行页 query 读 id，无对象显示「未找到对象」；空值 '--'。</li>
      <li>报表（/report/patrol）：按巡检线路聚合任务完成率、逾期数、漏检项目数与跳过设备数；导出为演示占位。</li>
    </ol>
  </>
);

// 点检 / 保养 / 巡检（演示模块）：按前缀路由到域细则，标题按具体页面区分
const DEMO_MODULE_TITLES = {
  '/inspection-items': '点检项目', '/inspection-standards': '点检标准', '/inspection-plans': '点检计划',
  '/inspection-tasks': '点检任务',
  '/maintenance-items': '保养项目', '/maintenance-standards': '保养标准', '/maintenance-plans': '保养计划',
  '/maintenance-tasks': '保养任务',
  '/patrol-items': '巡检项目', '/patrol-standards': '巡检标准', '/patrol-plans': '巡检计划',
  '/patrol-tasks': '巡检任务',
};
const DEMO_MODULE_CONTENT = { '/inspection-': inspectionContent, '/maintenance-': maintenanceContent, '/patrol-': patrolContent };

function demoModuleSpec(path) {
  const prefix = Object.keys(DEMO_MODULE_CONTENT).find(p => path.startsWith(p));
  if (!prefix) return null;
  if (path.endsWith('/detail')) {
    const base = DEMO_MODULE_TITLES[path.replace('/detail', '')];
    return { title: `${base || '演示模块'}详情`, content: DEMO_MODULE_CONTENT[prefix] };
  }
  if (path.endsWith('/execute')) {
    const base = DEMO_MODULE_TITLES[path.replace('/execute', '')];
    return { title: `${base || '演示模块'}执行`, content: DEMO_MODULE_CONTENT[prefix] };
  }
  const title = DEMO_MODULE_TITLES[path];
  return title ? { title, content: DEMO_MODULE_CONTENT[prefix] } : null;
}

export function specForPath(path) {
  if (!path) return specs['/'];
  if (path.startsWith('/lifecycle/tasks')) return specs['/lifecycle/tasks'];
  if (path.startsWith('/lifecycle/changes')) return specs['/lifecycle/changes'];
  if (path.startsWith('/lifecycle/idle')) return specs['/lifecycle/idle'];
  if (path.startsWith('/lifecycle/scrap')) return specs['/lifecycle/scrap'];
  // 设备监测详情：/device/:deviceId（param 路由）
  if (path.startsWith('/device/')) return specs['/device/:deviceId'];
  // 台账详情：/device-ledger/detail/:deviceId 与 /device-ledger/detail?deviceId= 两种形式
  if (path.startsWith('/device-ledger/detail')) return specs['/device-ledger/detail'];
  // 维修工单：/repair-orders 列表；/repair-orders/:id[/execute|/accept]（param 路由）
  if (path === '/repair-orders') return specs['/repair-orders'];
  if (path.startsWith('/repair-orders/')) {
    if (path.endsWith('/execute')) return specs['/repair-orders/:repairOrderId/execute'];
    if (path.endsWith('/accept')) return specs['/repair-orders/:repairOrderId/accept'];
    return specs['/repair-orders/:repairOrderId'];
  }
  // 历史 OEE 详情：/oee-history/detail/:deviceId 与 query 形式
  if (path.startsWith('/oee-history/detail')) return specs['/oee-history/detail'];
  if (path === '/oee-history') return specs['/oee-history'];
  // 点检 / 保养 / 巡检（范围外演示模块，应需求恢复）：页面细则按域给出
  const demo = demoModuleSpec(path);
  if (demo) return demo;
  // 报表：点检 / 巡检 / 保养执行统计为演示模块报表（复用域细则）；其余命中报表 spec，未知旧报表路由给重定向说明
  if (path.startsWith('/report/')) {
    if (path === '/report/inspection') return { title: '点检执行统计', content: inspectionContent };
    if (path === '/report/patrol') return { title: '巡检执行统计', content: patrolContent };
    if (path === '/report/maintenance') return { title: '保养执行统计', content: maintenanceContent };
    return specs[path] || reportRedirectSpec;
  }
  if (path.startsWith('/screen/')) return specs['/screen/device'];
  if (path === '/monitor-overview') return specs['/'];
  // 基础配置模块（系统拆分独立后自建）：/system/* 路由到对应细则
  if (path.startsWith('/system/')) return specs[path] || specs['/system/users'];
  // 原「宿主平台提供」的权限/审计入口已由基础配置模块承接，旧路由仅做重定向
  if (path === '/permissions') return { title: '权限管理（已迁移）', content: <p>原宿主平台权限管理入口已迁移：角色与功能权限见 <code>基础配置 · 角色管理</code>，账号与启停用见 <code>基础配置 · 用户管理</code>。</p> };
  if (path === '/audit') return { title: '操作审计（已迁移）', content: <p>原宿主平台操作审计入口已迁移至 <code>基础配置 · 日志管理（系统操作日志）</code>。</p> };
  return specs[path] || { title: '演示页面', content: <p>该页面暂未配置需求细则。</p> };
}
