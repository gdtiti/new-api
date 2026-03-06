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
| `model/subscription.go` | `GrantRegisterDefaultSubscription` | 注册赠送订阅创建、配置读取与幂等保护 |
| `model/user.go` | `GrantRegisterDefaultSubscriptionForUser` | 注册后置触发、软失败日志与用户日志记录 |
| `controller/user.go` / `controller/wechat.go` | `Register` / `WeChatAuth` | 新用户创建成功后的默认订阅触点 |
| `service/subscription_reset_task.go` | `StartSubscriptionQuotaResetTask` | 周期重置与过期清理 |

## Execution Flow

1. 管理员先配置可用套餐；支付购买和注册赠送都复用同一 `SubscriptionPlan`。`controller/subscription.go:110-255`, `model/subscription.go:350-352`  
2. 若是付费路径，后端创建 `SubscriptionOrder(pending)` 并等待回调完结。`controller/subscription_payment_stripe.go:86-105`, `controller/subscription_payment_creem.go:82-129`, `controller/subscription_payment_epay.go:84-112`  
3. 若是新用户注册路径，用户记录创建成功后触发 `GrantRegisterDefaultSubscriptionForUser`；普通注册与微信注册显式接入，OAuth 创建完成后也会调用相同后置逻辑。`controller/user.go:182-186`, `controller/wechat.go:100-107`, `model/user.go:463-493`  
4. `GrantRegisterDefaultSubscription` 读取运行态配置、校验目标套餐仍存在且启用，然后以 `source=register_default` 创建 `UserSubscription`。`model/subscription.go:654-699`  
5. 幂等通过 `grant_key=register_default` + 查询已存在记录实现；若并发下唯一约束冲突则降级为 `already_exists`。`model/subscription.go:245-246`, `model/subscription.go:677-696`  
6. 订阅信息通过 `/api/subscription/self` 返回 active/all 两视图，因此注册赠送订阅会和付费订阅一起出现在自助查询结果中。`controller/subscription.go:41-63`, `model/subscription.go:718-763`  
7. 后台任务周期执行额度重置、过期标记与预扣记录清理。`service/subscription_reset_task.go:57-89`  

## 失败与边界

- 套餐未启用、购买上限命中会在支付前阻断。`controller/subscription_payment_stripe.go:36-43`, `controller/subscription_payment_creem.go:67-76`  
- Epay/Stripe 回调必须验签并按订单锁处理，防止并发重复入账。`controller/subscription_payment_epay.go:145-159`, `controller/topup_stripe.go:156-167`, `controller/topup_stripe.go:190-200`  
- 订阅订单非 pending 状态不可重复完成。`model/subscription.go:529-531`  
- 注册默认赠送默认关闭；未启用时 `GrantRegisterDefaultSubscription` 返回 `skipped`，不创建订阅。`common/constants.go:103-106`, `model/subscription.go:658-660`  
- 注册赠送不走支付订单链路，不生成伪订单；它直接创建 `UserSubscription`，避免污染支付语义。`model/subscription.go:631-715`  
- 配置缺失、套餐不存在或已停用时，赠送返回 `failed`，但注册成功结果保留，仅记录系统错误日志。`model/subscription.go:661-675`, `model/user.go:495-503`  
- 只有首次成功发放会写入“新用户注册赠送默认订阅套餐”日志；重复触发返回 `already_exists` 时不会重复记账或重复日志。`model/user.go:499-510`, `model/register_default_subscription_test.go:48-63`  

## Related

- `architecture/billing-preconsume-refund.md` - 订阅作为 funding source
- `guides/subscription-payment-workflow.md`
