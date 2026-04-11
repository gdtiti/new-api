# Relay转发链路 Architecture

## Identity

**What**: 统一的模型请求转发执行链路（路由→鉴权→分发→控制器→适配器）。
**Purpose**: 在单入口下兼容 OpenAI/Claude/Gemini/任务平台协议，并保证重试、计费和错误语义一致。

## 模块边界

- **入口路由**：`router/relay-router.go:13-201`（SetRelayRouter）
- **鉴权与分发**：`middleware/auth.go:248-369`（TokenAuth）, `middleware/distributor.go:30-159`（Distribute）
- **控制器调度**：`controller/relay.go:67-242`（Relay）
- **协议适配层**：`controller/relay.go:34-65`（relayHandler/geminiRelayHandler）+ `relay/*.go`

## Core Components

| File | Symbol | Purpose |
| ---- | ------ | ------- |
| `router/relay-router.go` | `SetRelayRouter` | 挂载 `/v1`、`/v1beta`、`/mj`、`/suno` 等协议入口 |
| `middleware/distributor.go` | `Distribute` | 提取模型并注入选中渠道上下文 |
| `controller/relay.go` | `Relay` | 统一处理请求验证、计费预扣、重试、错误输出 |
| `controller/relay.go` | `relayHandler` | 根据 RelayMode 分派 Text/Image/Audio/Embedding/Rerank |
| `controller/relay.go` | `processChannelError` | 渠道错误记录、自动封禁、错误日志写入 |

## Execution Flow

1. 请求命中 relay 路由组并依次经过性能检查、令牌鉴权、模型级限流、分发中间件。`router/relay-router.go:69-86`  
2. `TokenAuth` 兼容 `Authorization/x-api-key/x-goog-api-key/query key` 等来源并写入 token 上下文。`middleware/auth.go:248-364`  
3. `Distribute` 从路径/Body推断模型与模式，选渠道并调用 `SetupContextForSelectedChannel` 注入渠道参数。`middleware/distributor.go:176-338`, `middleware/distributor.go:340-401`  
4. `Relay` 做请求校验、敏感词检查、token 估算、价格计算与预扣费。`controller/relay.go:108-167`  
5. 进入重试循环：每轮拿渠道、恢复可重读请求体、调用对应 helper。`controller/relay.go:189-235`  
6. 成功即返回；失败按错误类型决定重试/终止，并记录渠道错误链路。`controller/relay.go:227-235`, `controller/relay.go:318-345`  

## 失败与边界情况

- 请求体过大统一映射为 `413`（含重试路径）。`controller/relay.go:110-113`, `controller/relay.go:201-204`  
- WebSocket realtime 单独升级与错误回包格式。`controller/relay.go:78-86`, `controller/relay.go:93-95`  
- Claude 与 OpenAI 错误响应结构不同。`controller/relay.go:95-103`  
- 指定渠道（`specific_channel_id`）时禁止常规重试扩散。`controller/relay.go:334-336`  

## Related

- `architecture/channel-routing-selection.md` - 渠道选择与重试优先级
- `architecture/billing-preconsume-refund.md` - 预扣费/结算/退款闭环
- `architecture/runtime-protection-middleware.md` - 性能与限流防护链
