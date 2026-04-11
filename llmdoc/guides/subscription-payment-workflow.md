# 订阅与支付工作流

## 目标

完成“创建套餐 → 用户购买 → 回调入账 → 订阅生效”闭环，并验证用户侧订阅状态可见。

本体系也支持“新用户注册后默认赠送订阅套餐”的非支付发放路径。

## 步骤

### Step 1: 管理员配置订阅套餐

- 使用 `/api/subscription/admin/plans` 新增或更新套餐。`router/api-router.go:145-151`, `controller/subscription.go:110-255`。
- 确保支付渠道字段可用（`stripe_price_id` 或 `creem_product_id`）。`controller/subscription_payment_stripe.go:40-43`, `controller/subscription_payment_creem.go:47-50`。
- 若该套餐将作为注册赠送套餐，必须保持 `enabled=true`，否则后台配置保存会被拒绝。`controller/option.go:137-148`, `controller/option.go:162-173`。
- 管理员可在设置页的“支付设置”标签查看页面顶部“支付方式概览”，快速核对当前 `PayMethods` JSON 配置是否已经加载到运行态。`web/src/pages/Setting/index.jsx:101-110`, `web/src/components/settings/PaymentSetting.jsx:196-214`。

验证: `GET /api/subscription/admin/plans` 可看到新套餐

验证: 设置页顶部 Banner 能展示当前支付方式标签；若未配置，则显示“未配置”

### Step 2: 配置注册默认赠送套餐（可选）

- 在系统设置中启用 `RegisterDefaultSubscriptionEnabled`，并选择 `RegisterDefaultSubscriptionPlanId`。`web/src/components/settings/SystemSetting.jsx:266-276`, `web/src/components/settings/SystemSetting.jsx:349-364`。
- 保存时后端会拒绝“未配置套餐”“套餐不存在”“套餐未启用”三类无效配置。`controller/option.go:128-176`。
- 配置写入 `OptionMap` 后立即热生效，无需重启。`model/option.go:106-108`, `model/option.go:243-244`, `model/option.go:399-400`。

验证: `GET /api/option` 返回已保存的 `RegisterDefaultSubscription*` 键

### Step 3: 用户发起支付

- 前端在 Topup 页面拉取套餐与订阅状态。`web/src/components/topup/index.jsx:328-355`。
- 用户选择支付方式调用 `POST /api/subscription/{stripe|creem|epay}/pay`。`web/src/components/topup/SubscriptionPlansCard.jsx:123-182`。

验证: 返回支付链接或 Epay 表单参数

### Step 4: 回调、注册赠送与订阅可见性

- Stripe/Creem/Epay 回调到后端并验签。`router/api-router.go:49-50`, `router/api-router.go:162-165`, `controller/topup_stripe.go:148-177`, `controller/subscription_payment_epay.go:114-165`。
- 订单完结调用 `CompleteSubscriptionOrder` 创建用户订阅。`model/subscription.go:508-571`。
- 普通注册、微信注册、OAuth 用户创建完成后，会在用户创建成功后尝试 `GrantRegisterDefaultSubscriptionForUser`。`controller/user.go:182-186`, `controller/wechat.go:100-107`, `model/user.go:463-507`。
- 注册赠送以 `source=register_default` / `grant_key=register_default` 创建订阅；重复触发只会返回 `already_exists`，不会重复发放。`model/subscription.go:654-715`。

验证: `GET /api/subscription/self` 出现 active subscription

## 故障排除

| 问题 | 解决方案 |
| ---- | -------- |
| 返回“套餐未启用” | 检查套餐 `enabled` 状态。`controller/subscription_payment_stripe.go:36-39` |
| 返回“已达到购买上限” | 调整 `max_purchase_per_user` 或清理历史订阅。`controller/subscription_payment_creem.go:67-76` |
| 回调后未生效 | 检查回调验签是否通过、订单是否仍为 pending。`controller/subscription_payment_epay.go:145-153`, `model/subscription.go:529-531` |
| 支付入口与预期不一致，或管理端看不到可用通道 | 先检查设置页“支付方式概览”是否与预期一致；若显示“未配置”或标签缺失，再回查 `PayMethods` 的 JSON 保存值。`web/src/components/settings/PaymentSetting.jsx:196-214`, `web/src/pages/Setting/Payment/SettingsPaymentGateway.jsx:114-119`, `web/src/pages/Setting/Payment/SettingsPaymentGateway.jsx:168-170` |
| 注册成功但没有赠送订阅 | 检查 `RegisterDefaultSubscriptionEnabled` / `RegisterDefaultSubscriptionPlanId` 是否有效，以及系统错误日志是否记录套餐失效。`controller/option.go:128-176`, `model/user.go:499-503` |
| 重试注册后担心重复赠送 | 核对 `user_subscriptions.grant_key=register_default` 是否仅一条；该键受幂等查询和唯一约束保护。`model/subscription.go:245-246`, `model/subscription.go:677-696` |
