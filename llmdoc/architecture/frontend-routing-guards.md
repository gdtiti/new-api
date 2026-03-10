# 前端路由与守卫 Architecture

## Identity

**What**: React 路由表与登录/管理员/初始化守卫体系。  
**Purpose**: 在客户端提前阻断未授权访问并引导用户进入正确流程。

## Core Components

| File | Symbol | Purpose |
| ---- | ------ | ------- |
| `web/src/App.jsx` | `App` | 前端全量路由声明 |
| `web/src/helpers/auth.jsx` | `PrivateRoute` / `AdminRoute` / `AuthRedirect` | 登录态与角色守卫 |
| `web/src/components/layout/SetupCheck.js` | `SetupCheck` | 未初始化实例强制跳 setup |
| `web/src/components/layout/PageLayout.jsx` | `loadStatus` / `isPortalRoute` | 初始化加载 `/api/status` 写入状态上下文；识别 `/app` 门户路由并隐藏全局 Header |
| `web/src/components/portal/PortalShell.jsx` | `PortalShell` | 客户门户壳（侧边导航 + 顶栏 + `<Outlet/>` 子路由渲染） |
| `web/src/index.jsx` | React Root | Provider + BrowserRouter 根装配 |

## Execution Flow

1. 应用根挂载 BrowserRouter 与状态上下文。`web/src/index.jsx:57-76`  
2. `PageLayout` 启动时加载用户与系统状态（`/api/status`），并基于路由识别 `/app` 门户页面从而隐藏全局 Header。`web/src/components/layout/PageLayout.jsx:71-73`, `web/src/components/layout/PageLayout.jsx:89-106`  
3. `App` 使用 `SetupCheck` 包裹路由树，未 setup 时跳 `/setup`。`web/src/App.jsx:90-92`, `web/src/components/layout/SetupCheck.js:29-35`  
4. 控制台路由按权限使用 `PrivateRoute/AdminRoute`。`web/src/App.jsx:111-172`, `web/src/helpers/auth.jsx:45-66`  
5. 客户门户路由树挂载在 `/app/*`，整体使用 `PrivateRoute` 保护，并由 `PortalShell` 承载侧边导航与子路由渲染（overview/analytics/wallet/subscription/logs/models/account）。`web/src/App.jsx:294-357`, `web/src/components/portal/PortalShell.jsx:48-476`  
6. 登录/注册页使用 `AuthRedirect`，已登录用户回到控制台。`web/src/App.jsx:183-200`, `web/src/helpers/auth.jsx:35-43`  

## 失败与边界

- `AdminRoute` 依赖 localStorage user.role>=10，解析失败则进入 forbidden。`web/src/helpers/auth.jsx:57-66`  
- `PrivateRoute` 仅检查本地 user 存在，后端接口仍需服务端鉴权兜底。`web/src/helpers/auth.jsx:45-50`  
- setup 检查使用 `window.location.href` 强跳，绕过组件层导航栈。`web/src/components/layout/SetupCheck.js:33`  
- 门户页面的系统状态标签依赖 `StatusContext`（由 `PageLayout.loadStatus` 写入）；若 `/api/status` 加载失败，将退化为基础提示或缺失动态能力标签。`web/src/components/layout/PageLayout.jsx:89-106`, `web/src/components/portal/PortalShell.jsx:41-218`  

## Related

- `architecture/token-auth-system.md`
- `architecture/system-init-setup.md`
- `architecture/customer-portal.md`
