# 订阅与支付 Architecture

## Identity

**What**: 订阅套餐、下单支付、回调入账、订阅生命周期维护体系。  
**Purpose**: 为用户提供持续额度来源，并与计费系统衔接 subscription funding。

## Core Components

| File | Symbol | Purpose |
| ---- | ------ | ------- |
| `router/api-router.go` | `/api/subscription/*` | 用户/管理员/回调路由聚合 |
| `controller/subscription.go` | `GetSubscriptionPlans` 等 | 套餐与用户偏好管理 |
| `controller/subscription_payment_*.go` | `SubscriptionRequest*Pay` | Stripe/Creem/Epay 下单入口 |
| `model/subscription.go` | `CompleteSubscriptionOrder` | 支付成功后创建用户订阅与订单完结 |
| `service/subscription_reset_task.go` | `StartSubscriptionQuotaResetTask` | 周期重置与过期清理 |

## Execution Flow

1. 前端加载套餐与用户订阅状态。`web/src/components/topup/index.jsx:328-355`  
2. 用户发起支付，后端创建 `SubscriptionOrder(pending)` 并返回支付链接。`controller/subscription_payment_stripe.go:86-105`, `controller/subscription_payment_creem.go:82-129`, `controller/subscription_payment_epay.go:84-112`  
3. 支付回调触发订单完结：`CompleteSubscriptionOrder` 创建/续期 `UserSubscription`。`model/subscription.go:508-571`  
4. 订阅信息通过 `/api/subscription/self` 返回 active/all 两视图。`controller/subscription.go:41-63`  
5. 后台任务周期执行额度重置、过期标记与预扣记录清理。`service/subscription_reset_task.go:57-89`  

## 失败与边界

- 套餐未启用、购买上限命中会在支付前阻断。`controller/subscription_payment_stripe.go:36-43`, `controller/subscription_payment_creem.go:67-76`  
- Epay/Stripe 回调必须验签并按订单锁处理，防止并发重复入账。`controller/subscription_payment_epay.go:145-159`, `controller/topup_stripe.go:156-167`, `controller/topup_stripe.go:190-200`  
- 订阅订单非 pending 状态不可重复完成。`model/subscription.go:529-531`  

## Related

- `architecture/billing-preconsume-refund.md` - 订阅作为 funding source
- `guides/subscription-payment-workflow.md`
