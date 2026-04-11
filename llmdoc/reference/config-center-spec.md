# 配置中心规范

## Core Summary

- 配置持久化源是 `Option` 表，运行态源是 `common.OptionMap`。  
- 更新路径必须是：控制器校验 → `model.UpdateOption` → `updateOptionMap`。  
- 复杂模块配置通过 `setting/config.ConfigManager` 注册并扁平化存储。  
- 必须支持运行时热同步，不依赖重启生效。  
- `RegisterDefaultSubscriptionEnabled` 与 `RegisterDefaultSubscriptionPlanId` 控制“注册默认赠送订阅”，保存时必须做套餐存在性与启用状态校验。  

## Source of Truth

### Primary Code

- `model/option.go:29-160` (InitOptionMap): 默认值+模块导出+DB 覆盖。  
- `model/option.go:172-177` (SyncOptions): 定时热更新。  
- `model/option.go:180-194` (UpdateOption): 落库并更新内存。  
- `model/option.go:196-360` (updateOptionMap): 全局变量与子配置绑定。  
- `model/option.go:106-108`, `model/option.go:243-244`, `model/option.go:399-400`: 注册默认订阅配置默认值与运行态映射。  
- `setting/config/config.go:27-32` (Register): 模块注册入口。  
- `setting/config/config.go:42-67` (LoadFromDB): 前缀映射加载。  
- `controller/option.go:20-43` / `controller/option.go:50-255`: 配置 API 与校验。  
- `web/src/components/settings/SystemSetting.jsx:83-85`, `web/src/components/settings/SystemSetting.jsx:266-276`, `web/src/components/settings/SystemSetting.jsx:349-364`, `web/src/components/settings/SystemSetting.jsx:629-645`: 管理端开关、套餐选择与保存动作。  

### Related Configuration

- `channel_affinity_setting.*`：选路粘滞、缓存容量、TTL、规则。`setting/operation_setting/channel_affinity_setting.go:29-35`  
- `general_setting.*`：运营通用配置。`setting/operation_setting/general_setting.go`  
- `performance_setting.*`：性能阈值配置。`setting/performance_setting/config.go`  
- `RegisterDefaultSubscriptionEnabled`：是否在注册成功后触发默认订阅发放。`common/constants.go:103-105`  
- `RegisterDefaultSubscriptionPlanId`：目标 `SubscriptionPlan.Id`，必须指向已启用套餐。`controller/option.go:153-176`  

## 约束

- 敏感配置（Token/Secret/Key）在查询接口必须脱敏或过滤。`controller/option.go:24-30`  
- JSON 读写在业务代码应使用 `common/json.go` 包装函数（项目规则）。`common/json.go:9-25`  
- 配置键命名应保持可检索，优先 `模块名.字段名`。
- 注册默认赠送配置是运行时策略，不做历史用户补发；配置变更只影响后续新注册用户。`model/subscription.go:654-715`, `controller/user.go:182-186`, `model/user.go:492-507`  

## Related Architecture

- `architecture/config-center.md`
- `architecture/channel-routing-selection.md`
