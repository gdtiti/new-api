# 运行时防护中间件规范

## Core Summary

- API 与 Relay 路由必须挂载最小防护链：限流、鉴权、性能检查、清理。  
- 中间件返回码应保持一致：限流 429、性能过载 503、panic 500。  
- 请求体缓存必须在请求结束后清理，避免磁盘/内存泄漏。  
- 防护策略支持 Redis 与内存双实现，禁用 Redis 时需自动降级。  

## Source of Truth

### Primary Code

- `router/api-router.go:18-20`：API 默认防护挂载。  
- `router/relay-router.go:70-74`：Relay 防护挂载顺序。  
- `middleware/rate-limit.go:97-109`：全局 API 与关键限流入口。  
- `middleware/model-rate-limit.go:167-199`：模型请求限流实现。  
- `middleware/performance.go:40-65`：系统阈值检查逻辑。  
- `main.go:156-164`：panic recover 统一输出。  
- `middleware/body_cleanup.go:9-21`：请求结束清理策略。  

### Related Configuration

- 全局限流开关与阈值：`common/*RateLimit*`（由 Option 驱动）`middleware/rate-limit.go:90-109`  
- 模型限流配置：`setting.ModelRequestRateLimit*` `middleware/model-rate-limit.go:175-191`  
- 性能阈值：`performance_setting` -> `GetPerformanceMonitorConfig` `middleware/performance.go:42-43`  

## Related Architecture

- `architecture/runtime-protection-middleware.md`
- `architecture/config-center.md`
