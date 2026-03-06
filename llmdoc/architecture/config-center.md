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
| `common/constants.go` | `RegisterDefaultSubscription*` | 注册默认赠送订阅的运行态开关与目标套餐 |
| `web/src/components/settings/SystemSetting.jsx` | `submitRegisterDefaultSubscription` | 管理端默认赠送套餐选择与保存入口 |

## Execution Flow

1. 启动阶段初始化 `OptionMap`（默认值+注册配置导出+DB 覆盖），包含 `RegisterDefaultSubscriptionEnabled` 与 `RegisterDefaultSubscriptionPlanId`。`main.go:273-275`, `model/option.go:106-108`  
2. 后台协程按频率执行 `SyncOptions`，实现配置热更新。`main.go:93-95`, `model/option.go:172-177`  
3. 管理端在系统设置页读取这两个键；启用开关走通用 `updateOptions`，套餐选择通过 `submitRegisterDefaultSubscription` 单独保存。`web/src/components/settings/SystemSetting.jsx:83-85`, `web/src/components/settings/SystemSetting.jsx:266-276`, `web/src/components/settings/SystemSetting.jsx:349-364`, `web/src/components/settings/SystemSetting.jsx:629-645`  
4. 管理端调用 `/api/option` 更新配置时，控制器会校验：启用时必须已配置套餐，且套餐必须存在并启用；直接修改套餐 ID 时也会拒绝无效或停用套餐。`router/api-router.go:166-173`, `controller/option.go:128-176`  
5. `updateOptionMap` 将两个键热同步到 `common.RegisterDefaultSubscriptionEnabled` / `common.RegisterDefaultSubscriptionPlanId`，注册流程无需重启即可读取新值。`model/option.go:243-244`, `model/option.go:399-400`  

## 失败与边界

- `GetOptions` 自动过滤 Token/Secret/Key 后缀敏感项。`controller/option.go:24-30`  
- 部分配置启用前有前置依赖校验（如 OAuth、Turnstile）。`controller/option.go:71-135`  
- 注册默认赠送配置同样属于前置校验项：不能启用“空套餐”配置，也不能保存未启用套餐作为默认值。`controller/option.go:128-176`  
- 配置模块使用 `模块名.key` 前缀扁平化存储。`setting/config/config.go:47-55`, `setting/config/config.go:290-293`  
- channel affinity 缓存支持按规则清理与统计。`controller/channel_affinity_cache.go:20-60`, `service/channel_affinity.go:111-236`  

## Related

- `reference/config-center-spec.md`
- `architecture/runtime-protection-middleware.md`
