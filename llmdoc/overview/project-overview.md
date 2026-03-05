# new-api 项目总览

## 项目定位

- **定位**：统一 AI API 网关（gateway/proxy），聚合多上游模型厂商并提供统一调用入口。参考：`main.go:43` (main), `router/main.go:16` (SetRouter)
- **系统角色**：同时包含 API 中转、用户与配额管理、渠道管理、管理后台前端。参考：`router/main.go:17-20` (SetApiRouter/SetDashboardRouter/SetRelayRouter/SetVideoRouter)

## 目标用户

- 运维/平台管理员：管理渠道、模型映射、系统配置、监控与运营。
- 应用开发者：通过统一 API 接入不同模型供应商。
- 团队/企业场景：需要多租户、配额/计费、可替换上游供应商的组织。

## 核心能力

- **统一路由入口**：在单进程中装配 API、Relay、Dashboard、Web 路由。`main.go:185-186`, `router/main.go:16-20`
- **多数据库支持**：SQLite / MySQL / PostgreSQL 运行时自动选择。`model/main.go:118-175` (chooseDB), `common/database.go:3-13`
- **跨供应商 Relay**：按渠道类型处理能力并支持流式选项判断。`relay/common/relay_info.go:301-321` (streamSupportedChannels)
- **中英文等多语言能力**：后端 go-i18n 与前端 i18next 双栈。`i18n/i18n.go:35-60`, `web/src/i18n/i18n.js:32-51`
- **后台与前端一体部署**：Go 服务嵌入前端构建产物并对外提供 Web。`main.go:37-41`, `router/main.go:26-33`

## 技术栈

- **Backend**：Go + Gin + GORM（`main.go:31`, `model/main.go:17`）
- **Frontend**：React + Vite + Semi UI（`web/package.json:24-25`, `web/package.json:46`, `web/package.json:8`）
- **i18n**：go-i18n（后端）+ i18next/react-i18next（前端）`i18n/i18n.go:9`, `web/src/i18n/i18n.js:20-23`
- **任务与后台能力**：启动阶段挂载自动任务与缓存同步。`main.go:90-139`

## 运行入口

- **后端入口**：`main.go:43` (main)
- **资源初始化**：`main.go:242-316` (InitResources)
- **路由装配**：`main.go:186` -> `router/main.go:16-35` (SetRouter)
- **前端入口**：`web/src/index.jsx:57-77` (React root render)

## 目录分层（核心）

- `router/`：HTTP 路由编排与分发，如 `router/main.go:16`
- `controller/`：请求处理（参数解析、响应封装）
- `service/`：业务逻辑与任务调度（如 `main.go:109-114` 调用服务任务）
- `model/`：数据模型与数据库访问（如 `model/main.go:177` InitDB)
- `relay/`：上游适配与请求转换（如 `relay/common/relay_info.go`）
- `web/`：管理端前端应用（如 `web/src/index.jsx:57`）

## 非目标范围（简短）

- 不负责训练基础模型（仅做网关/中转与治理层）。
- 不承诺与任一单一云厂商强绑定（强调多上游适配）。
- 不将前端构建体系扩展到 Bun 以外优先路径（仓库约定优先 Bun）。
