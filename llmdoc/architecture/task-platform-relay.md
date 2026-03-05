# 任务型平台转发 Architecture

## Identity

**What**: 面向异步任务平台（Suno/Video/Jimeng/Kling/MJ）的提交与轮询转发架构。  
**Purpose**: 统一异步任务 API 的提交、状态查询、计费结算与失败退款。

## Core Components

| File | Symbol | Purpose |
| ---- | ------ | ------- |
| `router/video-router.go` | `SetVideoRouter` | `/v1/videos`、`/kling/v1`、`/jimeng` 入口 |
| `router/relay-router.go` | `/suno` `/mj` routes | 任务平台入口与 fetch/submit 分流 |
| `controller/relay.go` | `RelayTask` / `RelayTaskFetch` | 任务提交与查询控制器 |
| `relay/relay_task.go` | `RelayTaskSubmit` / `ResolveOriginTask` | 适配器驱动提交流程与 remix 锁渠道 |
| `service/task_polling.go` | `TaskPollingLoop` | 后台轮询、终态推进、超时退款 |

## Execution Flow

1. 路由根据平台/动作映射到 `RelayTask` 或 `RelayTaskFetch`。`router/video-router.go:23-51`, `router/relay-router.go:184-187`  
2. `RelayTask` 生成 relayInfo，解析 origin task（如 remix）并锁定渠道。`controller/relay.go:476-490`, `relay/relay_task.go:38-106`  
3. `RelayTaskSubmit` 完成平台适配器校验、价格估算、预扣费、上游提交、响应解析。`relay/relay_task.go:144-258`  
4. 成功后控制器结算计费并落库 Task；失败走统一错误与退款。`controller/relay.go:563-589`, `controller/relay.go:494-498`  
5. 后台 `TaskPollingLoop` 周期推进任务状态并在失败终态退款。`service/task_polling.go:90-137`, `service/task_polling.go:234-238`  

## 失败与边界

- 任务请求体过大在控制器阶段直接返回 `413`。`controller/relay.go:529-535`  
- 锁渠道任务重试时仍复用同一渠道，仅轮换 key。`controller/relay.go:510-517`, `relay/relay_task.go:82-101`  
- 超时任务会被独立 sweep 逻辑标记失败并退款。`service/task_polling.go:38-83`  

## Related

- `architecture/billing-preconsume-refund.md`
- `architecture/relay-forwarding-pipeline.md`
