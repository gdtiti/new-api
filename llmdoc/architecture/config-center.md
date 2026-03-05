# 配置中心 Architecture

## Identity

**What**: 基于 `Option` 表与内存映射的统一配置中心。  
**Purpose**: 将系统/运营/模型/性能配置集中管理，并支持运行时同步刷新。

## Core Components

| File | Symbol | Purpose |
| ---- | ------ | ------- |
| `model/option.go` | `InitOptionMap` | 构建默认配置与数据库覆盖加载 |
| `model/option.go` | `SyncOptions` | 周期性从 DB 拉取并热更新 |
| `model/option.go` | `UpdateOption` | 持久化配置并更新运行态 |
| `setting/config/config.go` | `ConfigManager` | 按模块注册/序列化/反序列化配置结构体 |
| `controller/option.go` | `GetOptions/UpdateOption` | 后台配置读写 API |

## Execution Flow

1. 启动阶段初始化 `OptionMap`（默认值+注册配置导出+DB 覆盖）。`main.go:273-275`, `model/option.go:29-160`  
2. 后台协程按频率执行 `SyncOptions`，实现配置热更新。`main.go:93-95`, `model/option.go:172-177`  
3. 管理端调用 `/api/option` 更新配置，控制器先做业务校验再写库。`router/api-router.go:166-173`, `controller/option.go:50-255`  
4. `updateOptionMap` 将新值同步到全局变量或子模块配置。`model/option.go:196-360`  

## 失败与边界

- `GetOptions` 自动过滤 Token/Secret/Key 后缀敏感项。`controller/option.go:24-30`  
- 部分配置启用前有前置依赖校验（如 OAuth、Turnstile）。`controller/option.go:71-135`  
- 配置模块使用 `模块名.key` 前缀扁平化存储。`setting/config/config.go:47-55`, `setting/config/config.go:290-293`  
- channel affinity 缓存支持按规则清理与统计。`controller/channel_affinity_cache.go:20-60`, `service/channel_affinity.go:111-236`  

## Related

- `reference/config-center-spec.md`
- `architecture/runtime-protection-middleware.md`
