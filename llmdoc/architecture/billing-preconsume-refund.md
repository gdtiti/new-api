# 计费预扣与退款 Architecture

## Identity

**What**: 请求级计费会话（预扣→结算→失败退款）的统一实现。  
**Purpose**: 保证钱包/订阅两类资金源在成功与失败路径下都可追踪、可回滚、尽量幂等。

## Core Components

| File | Symbol | Purpose |
| ---- | ------ | ------- |
| `service/billing.go` | `PreConsumeBilling` / `SettleBilling` | 对外统一预扣与后结算入口 |
| `service/billing_session.go` | `BillingSession` | 维护单请求资金状态与退款标志 |
| `service/funding_source.go` | `WalletFunding` / `SubscriptionFunding` | 钱包与订阅两种资金源实现 |
| `controller/relay.go` | `Relay` defer 退款 | 下游失败时触发 Refund 与违约费 |
| `controller/relay.go` | `RelayTask` | 任务提交失败退款、成功后结算 |

## Execution Flow

1. 控制器完成价格计算后调用 `PreConsumeBilling`。`controller/relay.go:152-167`, `service/billing.go:17-25`  
2. `NewBillingSession` 按偏好选择 `wallet/subscription`（支持 fallback）。`service/billing_session.go:255-340`  
3. `preConsume` 先扣 token，再扣资金源，资金源失败时回滚 token。`service/billing_session.go:160-183`  
4. 成功路径调用 `SettleBilling` 以实际消耗与预扣差额补扣/退款。`service/billing.go:34-77`  
5. 失败路径 defer 调用 `Billing.Refund` 归还预扣（异步）。`controller/relay.go:169-177`, `service/billing_session.go:79-114`  

## 失败与边界

- 订阅预扣失败会映射为“订阅额度不足或未配置订阅”。`service/billing_session.go:179-183`  
- 钱包退款是非幂等加额操作，不能重试；订阅退款可按 requestId 重试。`service/funding_source.go:61-64`, `service/funding_source.go:115-138`  
- `fundingSettled=true` 后禁用退款，避免二次返还。`service/billing_session.go:124-126`  
- 任务轮询终态失败可触发统一退款。`service/task_polling.go:80-82`, `service/task_polling.go:234-238`  

## Related

- `architecture/subscription-payment.md` - 订阅来源与支付入账
- `architecture/task-platform-relay.md` - 异步任务计费结算点
