## 为什么

当前用户侧体验分散在 `/console`、`/console/personal`、`/console/topup`、
`/console/log` 与 `/pricing` 等入口中。虽然仓库已经具备多方式登录、
个人数据分析、钱包充值、订阅查看、日志追踪与模型定价等能力，但客户
需要在多个页面之间切换才能理解自己的余额、套餐、消耗与模型使用情况。

现在需要一套独立的客户门户，把现有能力重组成统一、专业、可信赖的
产品体验，用更清晰的信息架构和更高级的视觉系统承接真实付费用户。

## 变更内容

- 新增独立于管理后台的客户门户命名空间，用统一导航承载客户侧页面。
- 新增统一认证中心，整合邮箱密码、OAuth、Passkey 与 2FA 二段验证。
- 新增客户总览与数据分析体验，统一展示余额、订阅、近期消耗与趋势洞察。
- 新增钱包与订阅账单中心，整合充值、支付方式、账单记录与套餐查看。
- 新增统一日志中心，整合 API、任务与图像相关日志查询和详情追踪。
- 新增模型广场，把现有模型定价能力升级为客户可浏览、可筛选、可联动的
  门户级体验。
- v1 以复用现有后端接口为主，不把新的聚合 API 作为首发前置条件。

## 功能 (Capabilities)

### 新增功能

- `customer-auth-hub`: 统一客户认证入口与登录后回跳体验。
- `customer-overview-analytics`: 客户总览首页与个人分析页。
- `customer-billing-subscription-center`: 钱包、充值、账单与订阅的一体化中心。
- `customer-logs-center`: 统一的客户日志查询与详情追踪体验。
- `customer-model-gallery`: 门户级模型目录、详情与个人使用视角叠加。

### 修改功能

无。

## 影响

- `web/src/App.jsx`: 新增客户门户路由与路由守卫编排。
- `web/src/components/auth/*`: 统一认证中心与登录流程重构。
- `web/src/components/dashboard/*` 与
  `web/src/hooks/dashboard/useDashboardData.js`: 客户总览与分析重组。
- `web/src/components/topup/*`: 钱包、账单与订阅中心重组。
- `web/src/components/table/usage-logs/*`、
  `web/src/hooks/usage-logs/useUsageLogsData.jsx`、
  `web/src/hooks/task-logs/*`、
  `web/src/hooks/mj-logs/*`: 统一日志中心壳层与联动能力。
- `web/src/components/table/model-pricing/*` 与
  `web/src/hooks/model-pricing/useModelPricingData.jsx`: 模型广场体验升级。
- 复用现有接口 `/api/user/*`、`/api/subscription/*`、`/api/log/*`、
  `/api/data/self`、`/api/pricing`，v1 不要求后端契约变更。
