# 渠道分发与选路 Architecture

## Identity

**What**: 面向模型请求的渠道选择与上下文注入机制。  
**Purpose**: 在多分组、多优先级、多密钥场景下提升成功率并控制重试范围。

## Core Components

| File | Symbol | Purpose |
| ---- | ------ | ------- |
| `middleware/distributor.go` | `Distribute` | 解析模型/分组，执行首次选路与上下文装配 |
| `service/channel_select.go` | `CacheGetRandomSatisfiedChannel` | auto 分组、跨组重试、优先级推进 |
| `middleware/distributor.go` | `SetupContextForSelectedChannel` | 注入渠道 key/baseURL/modelMapping/override |
| `service/channel_affinity.go` | `GetPreferredChannelByAffinity`/`RecordChannelAffinity` | 粘滞选路与成功后回写 |
| `controller/relay.go` | `shouldRetry` | 按错误类型、状态码、配置判断重试 |

## Execution Flow

1. `Distribute` 从路径和请求体提取模型名、relay mode、group。`middleware/distributor.go:176-338`  
2. 若 token 绑定固定渠道先走直连，否则做模型权限校验。`middleware/distributor.go:33-75`  
3. 先尝试 affinity 命中；失败回退随机可用渠道选择。`middleware/distributor.go:102-132`  
4. 选中后把 key、baseURL、header/param override 等写入 context。`middleware/distributor.go:340-401`  
5. 请求成功且状态<400时记录 affinity，供下次复用。`middleware/distributor.go:156-158`  

## 失败与边界

- token 模型白名单不包含目标模型时直接 `403`。`middleware/distributor.go:57-74`  
- auto 分组在当前分组无可用渠道时切换下一分组并重置重试索引。`service/channel_select.go:118-129`  
- 指定渠道、skip-retry、状态码策略会抑制重试。`controller/relay.go:322-345`  
- affinity 规则可标记“失败后不重试”。`service/channel_affinity.go:27`, `setting/operation_setting/channel_affinity_setting.go:23-27`  

## Related

- `architecture/relay-forwarding-pipeline.md` - 完整转发主链
- `reference/config-center-spec.md` - affinity 与重试配置来源
