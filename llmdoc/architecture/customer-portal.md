# 客户门户（/app） Architecture

## Identity

**What**: 面向已登录用户的客户门户路由树（`/app/*`），提供总览、分析、账单、日志、模型与账户等客户侧能力。  
**Purpose**: 将客户侧高频功能收敛到统一的信息架构、视觉布局与联动参数（query），减少在控制台/各功能页之间来回切换的成本。

## Core Components

| File | Symbol | Purpose |
| ---- | ------ | ------- |
| `web/src/App.jsx` | `/app` routes | 声明客户门户入口与子路由（overview/analytics/wallet/subscription/logs/models/account） |
| `web/src/helpers/auth.jsx` | `PrivateRoute` | 门户整体登录态守卫（前端阻断 + 引导登录） |
| `web/src/components/layout/PageLayout.jsx` | `isPortalRoute` / `loadStatus` | 识别门户路由并隐藏全局 Header；加载 `/api/status` 写入 `StatusContext` |
| `web/src/components/portal/PortalShell.jsx` | `PortalShell` | 门户壳：侧边导航 + 顶栏 + 模块引导 + `<Outlet/>` 子路由渲染 |
| `web/src/components/portal/PortalOverviewPage.jsx` | `PortalOverviewPage` | 总览页（账户/订阅/余额/消耗等聚合视图） |
| `web/src/components/portal/PortalAnalyticsPage.jsx` | `PortalAnalyticsPage` | 分析页（趋势/分布视图，复用总览的数据加载与时间范围） |
| `web/src/components/portal/PortalWalletPage.jsx` | `PortalWalletPage` | 钱包与额度（充值、支付、额度展示） |
| `web/src/components/portal/PortalSubscriptionPage.jsx` | `PortalSubscriptionPage` | 我的订阅（套餐状态、续费入口、偏好设置） |
| `web/src/components/portal/PortalLogsPage.jsx` | `PortalLogsPage` | 使用/任务/图像日志入口（复用现有表格页，并接收 query 联动过滤） |
| `web/src/components/portal/PortalModelGalleryPage.jsx` | `PortalModelGalleryPage` | 模型广场（以客户视角聚合价格/能力/可用性与使用情况） |
| `web/src/hooks/portal/usePortalOverviewData.jsx` | `usePortalOverviewData` | 总览/分析共享数据加载（并在 URL query 中同步时间范围与粒度） |
| `web/src/hooks/portal/usePortalBillingData.jsx` | `usePortalBillingData` | 钱包/订阅数据与操作封装（充值、支付、偏好等） |
| `web/src/hooks/portal/usePortalModelGalleryData.jsx` | `usePortalModelGalleryData` | 模型广场数据加载（结合客户侧消耗/统计生成展示数据） |

## Routing Map

入口与子路由（由 `PortalShell` 承载）：

- `/app` → redirect 到 `/app/overview`。`web/src/App.jsx:294-306`  
- `/app/overview`：总览。`web/src/App.jsx:305-312`, `web/src/components/portal/PortalOverviewPage.jsx:29-222`  
- `/app/analytics`：分析。`web/src/App.jsx:313-320`, `web/src/components/portal/PortalAnalyticsPage.jsx:59-297`  
- `/app/wallet`：钱包与额度。`web/src/App.jsx:321-328`, `web/src/components/portal/PortalWalletPage.jsx:29-298`  
- `/app/subscription`：我的订阅。`web/src/App.jsx:329-336`, `web/src/components/portal/PortalSubscriptionPage.jsx:29-343`  
- `/app/logs`：使用/任务/图像日志。`web/src/App.jsx:337-344`, `web/src/components/portal/PortalLogsPage.jsx:1-319`  
- `/app/models`：模型广场。`web/src/App.jsx:345-352`, `web/src/components/portal/PortalModelGalleryPage.jsx:87-405`  
- `/app/account`：账户与安全（复用个人设置页）。`web/src/App.jsx:353-356`  

## Data Flow（关键链路）

1. `PageLayout` 在应用启动时加载 `/api/status` 并写入 `StatusContext`；门户壳会将这些状态渲染为能力标签（Passkey、第三方登录、在线充值等）。`web/src/components/layout/PageLayout.jsx:89-106`, `web/src/components/portal/PortalShell.jsx:41-218`  
2. `usePortalOverviewData` 通过 query 参数承载“时间范围与粒度”：`preset`、`default_time`、`start_timestamp`、`end_timestamp`，并在刷新/切换时同步回 URL。`web/src/hooks/portal/usePortalOverviewData.jsx:158-193`  
3. `usePortalOverviewData.loadPortalData` 使用 `Promise.all` 并发拉取客户侧核心信息（用户、订阅、套餐列表、充值信息、消耗数据），失败则统一落错误提示：  
   - `GET /api/user/self`  
   - `GET /api/subscription/self`  
   - `GET /api/subscription/plans`  
   - `GET /api/user/topup/info`  
   - `GET /api/data/self?default_time=...&start_timestamp=...&end_timestamp=...`  
   `web/src/hooks/portal/usePortalOverviewData.jsx:195-207`  
4. 钱包/订阅页通过 `usePortalBillingData` 复用既有用户/订阅 API，并将“充值、支付、偏好”等动作统一封装为 hook 方法，便于页面保持轻量。`web/src/hooks/portal/usePortalBillingData.jsx:212-680`  
5. 日志页 `PortalLogsPage` 通过 query 参数接收跨页联动过滤（例如时间范围、模型名、分组、请求 ID），并复用既有三套表格页：`UsageLogsPage`、`TaskLogsPage`、`MjLogsPage`。`web/src/components/portal/PortalLogsPage.jsx:20-269`  

## 失败与边界

- 门户由 `PrivateRoute` 进行前端登录态阻断（基于 localStorage）；真实权限与数据隔离仍必须由后端鉴权兜底。`web/src/helpers/auth.jsx:45-50`  
- 时间范围参数在 URL 中以字符串形式保存，向后端查询时会转换为 Unix 秒；若外部手工改写 query 造成非法时间范围，需要后端接口做边界校验与降级返回。`web/src/hooks/portal/usePortalOverviewData.jsx:158-207`  
- 门户壳会隐藏全局 Header（由 `PageLayout.isPortalRoute` 控制），因此门户内跳转应优先使用 `PortalShell` 的导航与模块入口。`web/src/components/layout/PageLayout.jsx:71-73`, `web/src/components/portal/PortalShell.jsx:120-417`  

## Related

- `architecture/frontend-routing-guards.md`
- `architecture/billing-preconsume-refund.md`
- `architecture/subscription-payment.md`

