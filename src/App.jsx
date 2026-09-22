import React, { useMemo, useState } from 'react';
import { Routes, Route, Navigate, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Layout, Menu, Badge, Button, Drawer, Dropdown, Space } from 'antd';
import {
  Activity, AlarmClock, BookOpen, ClipboardList, DatabaseZap, FileBarChart,
  Gauge, LineChart, Settings2, Truck, Bell, CalendarClock,
  LayoutDashboard, Boxes, Wrench, Package, ClipboardCheck, ArrowRightLeft, CirclePause, Archive,
  GaugeCircle, LogOut, Layers, LayoutTemplate,
  Users, ShieldCheck, Building2, BookMarked, ScrollText,
} from 'lucide-react';
import LoginPage from './pages/LoginPage.jsx';
import WorkbenchPage from './pages/WorkbenchPage.jsx';
import OverviewPage from './pages/OverviewPage.jsx';
import RealtimePage from './pages/RealtimePage.jsx';
import DeviceLedgerPage from './pages/DeviceLedgerPage.jsx';
import DeviceLedgerDetailPage from './pages/DeviceLedgerDetailPage.jsx';
import DocLibraryPage from './pages/DocLibraryPage.jsx';
import BaseTypeConfigPage from './pages/BaseTypeConfigPage.jsx';
import BindingOverviewPage from './pages/BindingOverviewPage.jsx';
import BindingTemplatesPage from './pages/BindingTemplatesPage.jsx';
import PlatformMetricsPage from './pages/PlatformMetricsPage.jsx';
import AlarmCenterPage from './pages/AlarmCenterPage.jsx';
import RuleConfigPage from './pages/RuleConfigPage.jsx';
import AlarmRuleVersionPage from './pages/AlarmRuleVersionPage.jsx';
import NotificationPolicyPage from './pages/NotificationPolicyPage.jsx';
import RuleTemplatePage from './pages/RuleTemplatePage.jsx';
// V2.1：设备采集能力/指标字典/点位映射/数据质量/缺失死信/旧联网配置页面已下线，
// 由 联网配置总览（BindingOverviewPage）与 平台指标清单（PlatformMetricsPage）承接，旧路由做重定向。
import ProgramComparePage from './pages/ProgramComparePage.jsx';
import ProgramHandleRecordPage from './pages/ProgramHandleRecordPage.jsx';
// 点检 / 保养 / 巡检：范围外演示模块（应需求恢复），数据为只读演示种子，完整闭环由点巡保养业务模块承接
import InspectionItemsPage from './pages/InspectionItemsPage.jsx';
import InspectionStandardsPage from './pages/InspectionStandardsPage.jsx';
import InspectionStandardDetailPage from './pages/InspectionStandardDetailPage.jsx';
import InspectionPlansPage from './pages/InspectionPlansPage.jsx';
import InspectionPlanDetailPage from './pages/InspectionPlanDetailPage.jsx';
import InspectionTasksPage from './pages/InspectionTasksPage.jsx';
import InspectionTaskDetailPage from './pages/InspectionTaskDetailPage.jsx';
import InspectionExecutePage from './pages/InspectionExecutePage.jsx';
import InspectionReportPage from './pages/InspectionReportPage.jsx';
import MaintenanceItemsPage from './pages/MaintenanceItemsPage.jsx';
import MaintenanceStandardsPage from './pages/MaintenanceStandardsPage.jsx';
import MaintenanceStandardDetailPage from './pages/MaintenanceStandardDetailPage.jsx';
import MaintenancePlansPage from './pages/MaintenancePlansPage.jsx';
import MaintenancePlanDetailPage from './pages/MaintenancePlanDetailPage.jsx';
import MaintenanceTasksPage from './pages/MaintenanceTasksPage.jsx';
import MaintenanceTaskDetailPage from './pages/MaintenanceTaskDetailPage.jsx';
import MaintenanceExecutePage from './pages/MaintenanceExecutePage.jsx';
import MaintenanceReportPage from './pages/MaintenanceReportPage.jsx';
import PatrolItemsPage from './pages/PatrolItemsPage.jsx';
import PatrolStandardsPage from './pages/PatrolStandardsPage.jsx';
import PatrolStandardDetailPage from './pages/PatrolStandardDetailPage.jsx';
import PatrolPlansPage from './pages/PatrolPlansPage.jsx';
import PatrolPlanDetailPage from './pages/PatrolPlanDetailPage.jsx';
import PatrolTasksPage from './pages/PatrolTasksPage.jsx';
import PatrolTaskDetailPage from './pages/PatrolTaskDetailPage.jsx';
import PatrolExecutePage from './pages/PatrolExecutePage.jsx';
import PatrolReportPage from './pages/PatrolReportPage.jsx';
// 范围外提示组件 ScopeNoticePage 保留在 components/ 下备用（原 /permissions、/audit 已由基础配置模块承接）
import { DemoStoreProvider } from './state/DemoStore.jsx';
// 需求细则（开发说明面板）：每页点击「需求细则」查看本页详细规则，内容维护在 src/specs/pageSpecs.jsx
import { specForPath } from './specs/pageSpecs.jsx';
import RepairPendingPage from './pages/RepairPendingPage.jsx';
import RepairReportsPage from './pages/RepairReportsPage.jsx';
import RepairOrdersPage from './pages/RepairOrdersPage.jsx';
import RepairExecutePage from './pages/RepairExecutePage.jsx';
import RepairDetailPage from './pages/RepairDetailPage.jsx';
import RepairKnowledgePage from './pages/RepairKnowledgePage.jsx';
import SparePartsStockPage from './pages/SparePartsStockPage.jsx';
import SparePartsInboundPage from './pages/SparePartsInboundPage.jsx';
import SpareInboundDetailPage from './pages/SpareInboundDetailPage.jsx';
import SparePartsOutboundPage from './pages/SparePartsOutboundPage.jsx';
import SpareOutboundDetailPage from './pages/SpareOutboundDetailPage.jsx';
import OeeRealtimePage from './pages/OeeRealtimePage.jsx';
import OeeHistoryPage from './pages/OeeHistoryPage.jsx';
import OeeHistoryDetailPage from './pages/OeeHistoryDetailPage.jsx';
import SpeedConfigPage from './pages/SpeedConfigPage.jsx';
import PlannedDowntimePage from './pages/PlannedDowntimePage.jsx';
import RunTimeReportPage from './pages/RunTimeReportPage.jsx';
import ProductionReportPage from './pages/ProductionReportPage.jsx';
import AlarmReportPage from './pages/AlarmReportPage.jsx';
import QualityReportPage from './pages/QualityReportPage.jsx';
import ProgramCompareReportPage from './pages/ProgramCompareReportPage.jsx';
import RepairReportPage from './pages/RepairReportPage.jsx';
import SparePartReportPage from './pages/SparePartReportPage.jsx';
import MttrMtbfReportPage from './pages/MttrMtbfReportPage.jsx';
import ComprehensiveReportPage from './pages/ComprehensiveReportPage.jsx';
import LifecycleTasksPage from './pages/LifecycleTasksPage.jsx';
import LifecycleGovernancePage from './pages/LifecycleGovernancePage.jsx';
// 基础配置模块：系统从宿主平台拆分独立后自建（用户/角色/组织/字典/日志）
import SystemUsersPage from './pages/SystemUsersPage.jsx';
import SystemRolesPage from './pages/SystemRolesPage.jsx';
import SystemOrgPage from './pages/SystemOrgPage.jsx';
import SystemDictPage from './pages/SystemDictPage.jsx';
import SystemLogsPage from './pages/SystemLogsPage.jsx';

const { Sider, Content, Header } = Layout;

// 设备详情统一为 /device-ledger/detail/:deviceId；旧监测详情路由重定向
function DeviceDetailRedirect() {
  const { deviceId } = useParams();
  return <Navigate to={`/device-ledger/detail/${deviceId}`} replace />;
}
// 旧联网配置页并入详情页「联网配置」Tab，重定向并定位 Tab
function NetConfigRedirect() {
  const [sp] = useSearchParams();
  const qs = sp.toString();
  return <Navigate to={`/device-ledger/detail${qs ? `?${qs}&tab=network` : '?tab=network'}`} replace />;
}

// 菜单架构：白名单业务域 + 点检/保养/巡检演示模块（应需求恢复，作为范围外演示模块由点巡保养业务承接完整闭环）
// + 基础配置模块（系统从宿主平台拆分独立后自建：用户/角色/组织机构/字典/日志）。
const menus = [
  { key: 'workbench', icon: <LayoutDashboard size={15} />, label: '工作台', children: [
    { key: '/', icon: <LayoutDashboard size={14} />, label: '工作台首页' },
  ] },
  { key: 'asset', icon: <Boxes size={15} />, label: '设备资产', children: [
    { key: '/device-ledger', icon: <Boxes size={14} />, label: '设备台账' },
    { key: '/doc-library', icon: <BookOpen size={14} />, label: '综合文档库' },
    { key: '/base-type-config', icon: <Settings2 size={14} />, label: '基础类型配置' },
    // V2.1：设备联网配置移入「数据接入 · 联网配置总览」，设备台账列表提供「联网配置」入口
  ] },
  { key: 'lifecycle', icon: <ClipboardCheck size={15} />, label: '生命周期管理', children: [
    // 生命周期工作台（/lifecycle/workbench）暂不下发：按需求移除，旧路由重定向到设备入账；页面文件保留备用
    { key: '/lifecycle/tasks', icon: <ClipboardCheck size={14} />, label: '设备入账' },
    { key: '/lifecycle/changes', icon: <ArrowRightLeft size={14} />, label: '资产变更' },
    { key: '/lifecycle/idle', icon: <CirclePause size={14} />, label: '闲置与再启用' },
    { key: '/lifecycle/scrap', icon: <Archive size={14} />, label: '报废与归档' },
  ] },
  { key: 'inspection', icon: <ClipboardList size={15} />, label: '点检管理', children: [
    { key: '/inspection-items', icon: <ClipboardList size={14} />, label: '点检项目' },
    { key: '/inspection-standards', icon: <ClipboardList size={14} />, label: '点检标准' },
    { key: '/inspection-plans', icon: <ClipboardList size={14} />, label: '点检计划' },
    { key: '/inspection-tasks', icon: <ClipboardList size={14} />, label: '点检任务' },
  ] },
  { key: 'maintenance', icon: <Truck size={15} />, label: '保养管理', children: [
    { key: '/maintenance-items', icon: <Truck size={14} />, label: '保养项目' },
    { key: '/maintenance-standards', icon: <Truck size={14} />, label: '保养标准' },
    { key: '/maintenance-plans', icon: <Truck size={14} />, label: '保养计划' },
    { key: '/maintenance-tasks', icon: <Truck size={14} />, label: '保养任务' },
  ] },
  { key: 'patrol', icon: <Activity size={15} />, label: '巡检管理', children: [
    { key: '/patrol-items', icon: <Activity size={14} />, label: '巡检项目' },
    { key: '/patrol-standards', icon: <Activity size={14} />, label: '巡检标准' },
    { key: '/patrol-plans', icon: <Activity size={14} />, label: '巡检计划' },
    { key: '/patrol-tasks', icon: <Activity size={14} />, label: '巡检任务' },
  ] },
  { key: 'repair', icon: <Wrench size={15} />, label: '维修管理', children: [
    { key: '/repair-pending', icon: <Wrench size={14} />, label: '待维修' },
    { key: '/repair-reports', icon: <Wrench size={14} />, label: '故障报修' },
    { key: '/repair-orders', icon: <Wrench size={14} />, label: '维修任务' },
    { key: '/repair-knowledge', icon: <BookOpen size={14} />, label: '维修经验库' },
  ] },
  { key: 'spare', icon: <Package size={15} />, label: '备品备件', children: [
    { key: '/spare-parts-stock', icon: <Package size={14} />, label: '备件台账' },
    { key: '/spare-parts-inbound', icon: <Package size={14} />, label: '入库记录' },
    { key: '/spare-parts-outbound', icon: <Package size={14} />, label: '出库记录' },
  ] },
  { key: 'data', icon: <DatabaseZap size={15} />, label: '数据接入', children: [
    { key: '/binding-overview', icon: <DatabaseZap size={14} />, label: '联网配置总览' },
    { key: '/binding-templates', icon: <LayoutTemplate size={14} />, label: '绑定模板管理' },
    { key: '/platform-metrics', icon: <BookOpen size={14} />, label: '平台指标清单' },
    { key: '/program-compare', icon: <BookOpen size={14} />, label: '程序参数比对' },
    { key: '/program-handle-record', icon: <ClipboardList size={14} />, label: '比对处理记录' },
    // V2.1：协议/网关/点位/采集能力归 IoT 平台；旧「设备采集能力/指标字典/点位映射/接入质量/缺失死信」并入总览或重定向
  ] },
  { key: 'monitor', icon: <Gauge size={15} />, label: '运行监测', children: [
    { key: '/monitor-overview', icon: <Activity size={14} />, label: '监测总览' },
    { key: '/realtime', icon: <LineChart size={14} />, label: '实时监控' },
    // 设备监测详情（/device/:id）为二级页面：从实时监控/台账等点击设备进入，不占菜单项
    { key: '/oee-realtime', icon: <GaugeCircle size={14} />, label: '实时 OEE' },
    { key: '/oee-history', icon: <GaugeCircle size={14} />, label: '历史 OEE' },
    // 理想生产速度配置 / 计划停机时间管理：OEE 口径的两个基础配置页
    { key: '/oee-speed-config', icon: <Settings2 size={14} />, label: '理想生产速度配置' },
    { key: '/planned-downtime', icon: <CalendarClock size={14} />, label: '计划停机时间管理' },
    { key: '/screen/device', icon: <Activity size={14} />, label: '监测大屏' },
  ] },
  { key: 'alarm', icon: <AlarmClock size={15} />, label: '报警中心', children: [
    { key: '/alarm-center', icon: <AlarmClock size={14} />, label: '报警中心' },
    { key: '/alarm-rules', icon: <Settings2 size={14} />, label: '报警规则配置' },
    { key: '/alarm-rule-templates', icon: <Layers size={14} />, label: '报警规则模板' },
    { key: '/alarm-rule-versions', icon: <ClipboardList size={14} />, label: '报警规则版本' },
    { key: '/notification-policy', icon: <Bell size={14} />, label: '通知策略配置' },
  ] },
  { key: 'report', icon: <FileBarChart size={15} />, label: '报表中心', children: [
    { key: '/report/runtime', icon: <FileBarChart size={14} />, label: '运行时长与设备状态统计' },
    { key: '/report/production', icon: <FileBarChart size={14} />, label: '生产产出' },
    { key: '/report/mttr', icon: <FileBarChart size={14} />, label: 'MTTR / MTBF 分析' },
    { key: '/report/comprehensive', icon: <FileBarChart size={14} />, label: '综合运行分析' },
    { key: '/report/alarm', icon: <FileBarChart size={14} />, label: '报警统计' },
    { key: '/report/quality', icon: <FileBarChart size={14} />, label: '数据质量统计' },
    { key: '/report/program', icon: <FileBarChart size={14} />, label: '程序比对统计' },
    { key: '/report/repair', icon: <FileBarChart size={14} />, label: '维修统计' },
    { key: '/report/sparepart', icon: <FileBarChart size={14} />, label: '备件管理统计' },
    { key: '/report/inspection', icon: <FileBarChart size={14} />, label: '点检执行统计' },
    { key: '/report/patrol', icon: <FileBarChart size={14} />, label: '巡检执行统计' },
    { key: '/report/maintenance', icon: <FileBarChart size={14} />, label: '保养执行统计' },
  ] },
  // 基础配置：系统从宿主平台拆分独立后自建的基础管理域（承接原平台级 用户/角色/组织/字典/日志）
  { key: 'system', icon: <Users size={15} />, label: '基础配置', children: [
    { key: '/system/users', icon: <Users size={14} />, label: '用户管理' },
    { key: '/system/roles', icon: <ShieldCheck size={14} />, label: '角色管理' },
    { key: '/system/org', icon: <Building2 size={14} />, label: '组织机构' },
    { key: '/system/dict', icon: <BookMarked size={14} />, label: '字典管理' },
    { key: '/system/logs', icon: <ScrollText size={14} />, label: '日志管理' },
  ] },
];

export default function App() {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('dms-user')); } catch { return null; }
  });
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [specOpen, setSpecOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const selectedKey = useMemo(() => {
    // 设备监测详情为二级页面，菜单高亮归入其入口「实时监控」
    if (location.pathname.startsWith('/device/')) return '/realtime';
    // 详情/新增/编辑等子路由归入对应列表菜单（最长前缀匹配）
    const all = menus.flatMap(m => (m.children || []).map(c => c.key));
    return all.filter(k => location.pathname === k || location.pathname.startsWith(k + '/'))
      .sort((a, b) => b.length - a.length)[0] || location.pathname;
  }, [location.pathname]);
  const openKeys = useMemo(() => {
    const found = menus.find(m => m.children && m.children.some(c => (c.children || []).some(g => g.key === selectedKey) || c.key === selectedKey));
    return found ? [found.key] : [];
  }, [selectedKey]);
  // 需求细则：按当前路由取本页规则说明（/monitor-overview 复用工作台细则）
  const spec = specForPath(location.pathname === '/monitor-overview' ? '/' : location.pathname);

  // 监测大屏：直接打开独立的大屏页面（public/ 下，构建后位于 dist/index.html 同级）
  const openScreen = () => window.open('设备监测大屏演示.html', '_blank');

  const handleLogin = (u) => {
    localStorage.setItem('dms-user', JSON.stringify(u));
    setUser(u);
  };
  const handleLogout = () => {
    localStorage.removeItem('dms-user');
    setUser(null);
  };

  if (!user) return <LoginPage onLogin={handleLogin} />;

  return (
    <DemoStoreProvider>
    <Layout className="app-shell">
      <Layout className="main-layout">
        <Sider
          collapsible
          collapsed={collapsed}
          breakpoint="lg"
          onBreakpoint={(broken) => setMobileOpen(broken)}
          theme="dark"
          width={220}
          className="app-sider"
        >
          <div className="app-brand">
            <span className="app-brand-icon"><Truck color="#fff" size={18} /></span>
            {!collapsed && (
              <div>
                <div className="app-brand-name"><strong>东浩智创</strong></div>
                <div className="app-brand-sub">设备管理系统标准版</div>
              </div>
            )}
          </div>
          <Menu
            mode="inline"
            theme="dark"
            selectedKeys={[selectedKey]}
            defaultOpenKeys={openKeys}
            items={menus}
            onClick={({ key }) => {
              if (key === '/screen/device') { openScreen(); return; }
              if (key.startsWith('/')) navigate(key);
              setMobileOpen(false);
            }}
          />
          <div className="app-sider-foot">
            标准版 V1.0
          </div>
        </Sider>
        <Layout>
          <Header className="app-header">
            <Space size={14}>
              <Button type="primary" ghost icon={<Activity size={14} />} onClick={openScreen}>监测大屏</Button>
              <Dropdown
                menu={{
                  items: [{ key: 'logout', icon: <LogOut size={14} />, label: '退出登录' }],
                  onClick: ({ key }) => { if (key === 'logout') handleLogout(); },
                }}
              >
                <div className="user-chip">
                  <span className="user-avatar">{(user.name || '用')[0]}</span>
                  <span className="user-meta">
                    <div className="user-name">{user.name}</div>
                    <div className="user-role">{user.role}</div>
                  </span>
                  <Badge count={3} size="small" offset={[-2, 2]} />
                </div>
              </Dropdown>
            </Space>
          </Header>
          <Content className="app-content">
            <main className="page-main">
              <div className="spec-entry-row">
                <Button icon={<BookOpen size={14} />} onClick={() => setSpecOpen(true)}>
                  需求细则
                </Button>
              </div>
                <Routes>
                  <Route path="/" element={<WorkbenchPage />} />
                  {/* 设备资产 */}
                  <Route path="/device-ledger" element={<DeviceLedgerPage />} />
                  <Route path="/device-ledger/detail/:deviceId" element={<DeviceLedgerDetailPage />} />
                  <Route path="/device-ledger/detail" element={<DeviceLedgerDetailPage />} />
                  <Route path="/device-ledger/edit" element={<DeviceLedgerPage />} />
                  {/* 旧联网配置页重定向到详情页「联网配置」Tab */}
                  <Route path="/device-ledger/net-config" element={<NetConfigRedirect />} />
                  <Route path="/doc-library" element={<DocLibraryPage />} />
                  <Route path="/base-type-config" element={<BaseTypeConfigPage />} />
                  {/* 生命周期管理：简化流程与资产治理（生命周期工作台已下线，重定向到设备入账） */}
                  <Route path="/lifecycle/workbench" element={<Navigate to="/lifecycle/tasks" replace />} />
                  <Route path="/lifecycle/tasks" element={<LifecycleTasksPage />} />
                  <Route path="/lifecycle/tasks/procurement-entry" element={<LifecycleTasksPage mode="procurement" />} />
                  <Route path="/lifecycle/tasks/trial-confirmation" element={<LifecycleTasksPage mode="trial" />} />
                  <Route path="/lifecycle/tasks/device-registration" element={<LifecycleTasksPage mode="registration" />} />
                  <Route path="/lifecycle/changes" element={<LifecycleGovernancePage kind="change" />} />
                  <Route path="/lifecycle/idle" element={<LifecycleGovernancePage kind="idle" />} />
                  <Route path="/lifecycle/scrap" element={<LifecycleGovernancePage kind="scrap" />} />
                  {/* 运行监测 */}
                  <Route path="/monitor-overview" element={<OverviewPage />} />
                  <Route path="/realtime" element={<RealtimePage />} />
                  {/* 设备详情统一为台账详情页（联网/未联网设备内容自动区分）；/device/:id 重定向 */}
                  <Route path="/device/:deviceId" element={<DeviceDetailRedirect />} />
                  {/* 报警中心 */}
                  <Route path="/alarm-center" element={<AlarmCenterPage />} />
                  <Route path="/alarm-rules" element={<RuleConfigPage />} />
                  <Route path="/alarm-rule-templates" element={<RuleTemplatePage />} />
                  <Route path="/alarm-rule-versions" element={<AlarmRuleVersionPage />} />
                  <Route path="/notification-policy" element={<NotificationPolicyPage />} />
                  {/* 点检管理（演示模块）：新增/编辑为弹窗，详情/执行为独立页面 */}
                  <Route path="/inspection-items" element={<InspectionItemsPage />} />
                  <Route path="/inspection-standards" element={<InspectionStandardsPage />} />
                  <Route path="/inspection-standards/detail" element={<InspectionStandardDetailPage />} />
                  <Route path="/inspection-plans" element={<InspectionPlansPage />} />
                  <Route path="/inspection-plans/detail" element={<InspectionPlanDetailPage />} />
                  <Route path="/inspection-tasks" element={<InspectionTasksPage />} />
                  <Route path="/inspection-tasks/detail" element={<InspectionTaskDetailPage />} />
                  <Route path="/inspection-tasks/execute" element={<InspectionExecutePage />} />
                  {/* 保养管理（演示模块） */}
                  <Route path="/maintenance-items" element={<MaintenanceItemsPage />} />
                  <Route path="/maintenance-standards" element={<MaintenanceStandardsPage />} />
                  <Route path="/maintenance-standards/detail" element={<MaintenanceStandardDetailPage />} />
                  <Route path="/maintenance-plans" element={<MaintenancePlansPage />} />
                  <Route path="/maintenance-plans/detail" element={<MaintenancePlanDetailPage />} />
                  <Route path="/maintenance-tasks" element={<MaintenanceTasksPage />} />
                  <Route path="/maintenance-tasks/detail" element={<MaintenanceTaskDetailPage />} />
                  <Route path="/maintenance-tasks/execute" element={<MaintenanceExecutePage />} />
                  {/* 巡检管理（演示模块） */}
                  <Route path="/patrol-items" element={<PatrolItemsPage />} />
                  <Route path="/patrol-standards" element={<PatrolStandardsPage />} />
                  <Route path="/patrol-standards/detail" element={<PatrolStandardDetailPage />} />
                  <Route path="/patrol-plans" element={<PatrolPlansPage />} />
                  <Route path="/patrol-plans/detail" element={<PatrolPlanDetailPage />} />
                  <Route path="/patrol-tasks" element={<PatrolTasksPage />} />
                  <Route path="/patrol-tasks/detail" element={<PatrolTaskDetailPage />} />
                  <Route path="/patrol-tasks/execute" element={<PatrolExecutePage />} />
                  {/* 维修管理 */}
                  <Route path="/repair-pending" element={<RepairPendingPage />} />
                  <Route path="/repair-reports" element={<RepairReportsPage />} />
                  <Route path="/repair-orders" element={<RepairOrdersPage />} />
                  <Route path="/repair-orders/:repairOrderId" element={<RepairDetailPage />} />
                  <Route path="/repair-orders/:repairOrderId/execute" element={<RepairExecutePage />} />
                  <Route path="/repair-orders/:repairOrderId/accept" element={<RepairDetailPage />} />
                  <Route path="/repair-orders/execute" element={<RepairExecutePage />} />
                  <Route path="/repair-orders/detail" element={<RepairDetailPage />} />
                  <Route path="/repair-knowledge" element={<RepairKnowledgePage />} />
                  {/* 备品备件 */}
                  <Route path="/spare-parts-stock" element={<SparePartsStockPage />} />
                  <Route path="/spare-parts-inbound" element={<SparePartsInboundPage />} />
                  <Route path="/spare-parts-inbound/detail" element={<SpareInboundDetailPage />} />
                  <Route path="/spare-parts-outbound" element={<SparePartsOutboundPage />} />
                  <Route path="/spare-parts-outbound/detail" element={<SpareOutboundDetailPage />} />
                  {/* 维护管理 · OEE（口径：可用率 = 运行时间 / (负荷时间 - 计划停机时间)） */}
                  <Route path="/oee-realtime" element={<OeeRealtimePage />} />
                  <Route path="/oee-history" element={<OeeHistoryPage />} />
                  <Route path="/oee-history/detail/:deviceId" element={<OeeHistoryDetailPage />} />
                  <Route path="/oee-history/detail" element={<OeeHistoryDetailPage />} />
                  <Route path="/oee-speed-config" element={<SpeedConfigPage />} />
                  <Route path="/planned-downtime" element={<PlannedDowntimePage />} />
                  {/* 数据接入（V2.1：4 页 + 旧路由重定向） */}
                  <Route path="/binding-overview" element={<BindingOverviewPage />} />
                  <Route path="/binding-templates" element={<BindingTemplatesPage />} />
                  <Route path="/platform-metrics" element={<PlatformMetricsPage />} />
                  <Route path="/program-compare" element={<ProgramComparePage />} />
                  <Route path="/program-handle-record" element={<ProgramHandleRecordPage />} />
                  {/* 旧页面迁移重定向（按 5.4 页面迁移清单） */}
                  <Route path="/net-config" element={<Navigate to="/binding-overview" replace />} />
                  <Route path="/device-capability" element={<Navigate to="/binding-overview" replace />} />
                  <Route path="/point-mapping" element={<Navigate to="/binding-overview" replace />} />
                  <Route path="/data-quality" element={<Navigate to="/binding-overview" replace />} />
                  <Route path="/data-gap-dead-letter" element={<Navigate to="/binding-overview" replace />} />
                  <Route path="/metric-dictionary" element={<Navigate to="/platform-metrics" replace />} />
                  {/* 报表中心 */}
                  <Route path="/report/runtime" element={<RunTimeReportPage />} />
                  <Route path="/report/status" element={<Navigate to="/report/runtime" replace />} />
                  <Route path="/report/production" element={<ProductionReportPage />} />
                  <Route path="/report/mttr" element={<MttrMtbfReportPage />} />
                  <Route path="/report/comprehensive" element={<ComprehensiveReportPage />} />
                  <Route path="/report/alarm" element={<AlarmReportPage />} />
                  <Route path="/report/quality" element={<QualityReportPage />} />
                  <Route path="/report/program" element={<ProgramCompareReportPage />} />
                  {/* 点检/巡检/保养执行统计（演示模块报表） */}
                  <Route path="/report/inspection" element={<InspectionReportPage />} />
                  <Route path="/report/patrol" element={<PatrolReportPage />} />
                  <Route path="/report/maintenance" element={<MaintenanceReportPage />} />
                  <Route path="/report/repair" element={<RepairReportPage />} />
                  <Route path="/report/sparepart" element={<SparePartReportPage />} />
                  {/* 基础配置模块：系统拆分独立后自建的基础管理域 */}
                  <Route path="/system/users" element={<SystemUsersPage />} />
                  <Route path="/system/roles" element={<SystemRolesPage />} />
                  <Route path="/system/org" element={<SystemOrgPage />} />
                  <Route path="/system/dict" element={<SystemDictPage />} />
                  <Route path="/system/logs" element={<SystemLogsPage />} />
                  {/* 原「由宿主平台提供」的权限/审计入口，拆分后由本系统基础配置模块承接，重定向 */}
                  <Route path="/permissions" element={<Navigate to="/system/roles" replace />} />
                  <Route path="/audit" element={<Navigate to="/system/logs" replace />} />
                  {/* 旧路径兼容 */}
                  <Route path="/metrics" element={<Navigate to="/report/runtime" replace />} />
                  <Route path="/reports/*" element={<Navigate to="/report/runtime" replace />} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
            </main>
            <Drawer
              title={<div className="spec-title"><BookOpen size={16} /> 需求细则</div>}
              placement="right"
              width={480}
              open={specOpen}
              onClose={() => setSpecOpen(false)}
              styles={{ body: { paddingTop: 0 } }}
            >
              <Badge status="processing" text={`当前页面：${spec.title}`} />
              <div className="spec-body" style={{ marginTop: 12 }}>{spec.content}</div>
              <div className="spec-note">
                本面板面向开发说明，不进入生产 UI。
              </div>
            </Drawer>
          </Content>
        </Layout>
      </Layout>
    </Layout>
    </DemoStoreProvider>
  );
}
