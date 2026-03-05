# 订阅与支付工作流

## 目标

完成“创建套餐 → 用户购买 → 回调入账 → 订阅生效”闭环，并验证用户侧订阅状态可见。

## 步骤

### Step 1: 管理员配置订阅套餐

- 使用 `/api/subscription/admin/plans` 新增或更新套餐。`router/api-router.go:145-151`, `controller/subscription.go:110-255`。
- 确保支付渠道字段可用（`stripe_price_id` 或 `creem_product_id`）。`controller/subscription_payment_stripe.go:40-43`, `controller/subscription_payment_creem.go:47-50`。

验证: `GET /api/subscription/admin/plans` 可看到新套餐

### Step 2: 用户发起支付

- 前端在 Topup 页面拉取套餐与订阅状态。`web/src/components/topup/index.jsx:328-355`。
- 用户选择支付方式调用 `POST /api/subscription/{stripe|creem|epay}/pay`。`web/src/components/topup/SubscriptionPlansCard.jsx:123-182`。

验证: 返回支付链接或 Epay 表单参数

### Step 3: 回调与订单完结

- Stripe/Creem/Epay 回调到后端并验签。`router/api-router.go:49-50`, `router/api-router.go:162-165`, `controller/topup_stripe.go:148-177`, `controller/subscription_payment_epay.go:114-165`。
- 订单完结调用 `CompleteSubscriptionOrder` 创建用户订阅。`model/subscription.go:508-571`。

验证: `GET /api/subscription/self` 出现 active subscription

## 故障排除

| 问题 | 解决方案 |
| ---- | -------- |
| 返回“套餐未启用” | 检查套餐 `enabled` 状态。`controller/subscription_payment_stripe.go:36-39` |
| 返回“已达到购买上限” | 调整 `max_purchase_per_user` 或清理历史订阅。`controller/subscription_payment_creem.go:67-76` |
| 回调后未生效 | 检查回调验签是否通过、订单是否仍为 pending。`controller/subscription_payment_epay.go:145-153`, `model/subscription.go:529-531` |
