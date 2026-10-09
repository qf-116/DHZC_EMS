# 设备管理系统（标准版）· 演示原型

React 19 + Vite 7 + Ant Design 6 构建的设备管理监测系统标准版演示原型，含完整演示数据与状态机交互，供开发团队对照开发。

## 在线浏览

启用 GitHub Pages 后访问：<https://qf-116.github.io/DHZC_EMS/>

> 单文件构建（JS/CSS 全部内联），无需任何服务端，双击 `index.html` 本地打开亦可运行。
> 工作台顶栏与左侧菜单「监测大屏」按钮在新标签页打开独立大屏页 `设备监测大屏演示.html`。

## 功能范围

- 工作台 / 组织与权限（演示）
- 设备台账、设备分组、备件台账
- 实时监测、联网配置总览（绑定模板 + 批量应用）、报警中心与规则
- 点检 / 巡检 / 保养任务与执行、维修工单全流程
- 停机事实、OEE 分析
- 报表中心：点检、巡检、保养、维修、报警、程序比对、MTTR/MTBF、设备综合运行、运行时长、数据质量、生产、备件管理统计（均含日期范围筛选）
- 设备监测大屏演示（`设备监测大屏演示.html`，独立单文件页面）

## 本地开发

```bash
npm install
npm run dev
```

## 构建

```bash
npm run build   # 产出 dist/index.html（单文件）+ favicon.svg + 设备监测大屏演示.html
```

## 部署（GitHub Pages）

`gh-pages` 分支根目录即构建产物；仓库 Settings → Pages → Source 选 "Deploy from a branch"、分支选 `gh-pages` / `(root)` 即可。
