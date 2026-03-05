# llmdoc 文档索引

## 概览（overview）

- `overview/project-overview.md` - 项目定位、分层结构、核心能力与运行入口总览。

## 架构（architecture）

- `architecture/relay-forwarding-pipeline.md` - Relay 主转发链路（路由、分发、控制器、适配器、重试）。
- `architecture/channel-routing-selection.md` - 渠道分发与选路（group/model、优先级、affinity、重试）。
- `architecture/billing-preconsume-refund.md` - 计费预扣、后结算与失败退款机制。
- `architecture/multi-db-compat-migration.md` - SQLite/MySQL/PostgreSQL 兼容初始化与迁移策略。
- `architecture/token-auth-system.md` - 会话鉴权、AccessToken、API Token 三层鉴权体系。
- `architecture/config-center.md` - 配置中心（OptionMap + ConfigManager + 热更新）。
- `architecture/subscription-payment.md` - 订阅套餐、支付回调、入账与生命周期任务。
- `architecture/channel-admin-console.md` - 渠道管理后台的 API 与前端协同架构。
- `architecture/task-platform-relay.md` - 异步任务平台提交/轮询/计费链路。
- `architecture/system-init-setup.md` - 系统启动初始化与 Setup 一次性流程。
- `architecture/frontend-routing-guards.md` - 前端路由表与登录/管理员/初始化守卫。
- `architecture/runtime-protection-middleware.md` - 运行时防护中间件链（限流、性能、恢复、清理、CORS）。

## 指南（guides）

- `guides/system-init-setup-workflow.md` - 新实例 Setup 初始化执行与校验步骤。
- `guides/channel-admin-workflow.md` - 渠道管理后台日常运维工作流。
- `guides/subscription-payment-workflow.md` - 订阅支付从下单到回调生效的操作闭环。

## 规范（reference）

- `reference/coding-conventions.md` - 项目编码与分层、JSON、DB、i18n 约束。
- `reference/git-conventions.md` - Git 分支、提交、PR 与禁用操作规范。
- `reference/multi-db-compat-migration-spec.md` - 三数据库兼容与迁移执行规范。
- `reference/config-center-spec.md` - 配置中心数据流、校验与安全边界规范。
- `reference/runtime-protection-middleware-spec.md` - 运行时防护链路与限流/恢复标准。
