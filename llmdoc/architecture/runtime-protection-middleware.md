# 运行时防护中间件 Architecture

## Identity

**What**: 请求生命周期中的运行时防护层（限流、性能保护、恢复、清理、跨域）。  
**Purpose**: 在高并发和异常场景下保护系统稳定性并输出一致错误语义。

## Core Components

| File | Symbol | Purpose |
| ---- | ------ | ------- |
| `middleware/rate-limit.go` | `GlobalAPIRateLimit/CriticalRateLimit/...` | 全局/IP/用户维度限流 |
| `middleware/model-rate-limit.go` | `ModelRequestRateLimit` | 模型请求专用限流（成功数+总数） |
| `middleware/performance.go` | `SystemPerformanceCheck` | CPU/内存/磁盘阈值保护 |
| `main.go` | `gin.CustomRecovery` | 全局 panic 恢复输出标准错误 |
| `middleware/body_cleanup.go` | `BodyStorageCleanup` | 请求结束后 body/file 缓存清理 |
| `middleware/cors.go` | `CORS` | 跨域策略与响应头 |

## Execution Flow

1. API 路由默认挂全局限流与 body 清理。`router/api-router.go:18-20`  
2. Relay 路由挂性能检查+鉴权+模型限流+分发。`router/relay-router.go:70-74`  
3. `ModelRequestRateLimit` 在请求前检查配额，成功响应后记录成功次数。`middleware/model-rate-limit.go:167-199`, `middleware/model-rate-limit.go:124-127`  
4. 全局 panic 由 `gin.CustomRecovery` 捕获并返回 `500/new_api_panic`。`main.go:156-164`  
5. 请求结束统一清理 BodyStorage 与文件缓存。`middleware/body_cleanup.go:14-21`  

## 失败与边界

- Redis 限流异常会返回 `500` 并中止请求。`middleware/rate-limit.go:26-30`  
- 令牌桶限流在 total count=0 时跳过。`middleware/model-rate-limit.go:97-100`  
- 性能保护会区分 Claude/OpenAI 错误包装。`middleware/performance.go:19-31`  
- CORS 允许全部源且带凭据，需配合上层鉴权控制风险。`middleware/cors.go:10-15`  

## Related

- `reference/runtime-protection-middleware-spec.md`
- `architecture/relay-forwarding-pipeline.md`
