# 配置中心规范

## Core Summary

- 配置持久化源是 `Option` 表，运行态源是 `common.OptionMap`。  
- 更新路径必须是：控制器校验 → `model.UpdateOption` → `updateOptionMap`。  
- 复杂模块配置通过 `setting/config.ConfigManager` 注册并扁平化存储。  
- 必须支持运行时热同步，不依赖重启生效。  

## Source of Truth

### Primary Code

- `model/option.go:29-160` (InitOptionMap): 默认值+模块导出+DB 覆盖。  
- `model/option.go:172-177` (SyncOptions): 定时热更新。  
- `model/option.go:180-194` (UpdateOption): 落库并更新内存。  
- `model/option.go:196-360` (updateOptionMap): 全局变量与子配置绑定。  
- `setting/config/config.go:27-32` (Register): 模块注册入口。  
- `setting/config/config.go:42-67` (LoadFromDB): 前缀映射加载。  
- `controller/option.go:20-43` / `controller/option.go:50-255`: 配置 API 与校验。  

### Related Configuration

- `channel_affinity_setting.*`：选路粘滞、缓存容量、TTL、规则。`setting/operation_setting/channel_affinity_setting.go:29-35`  
- `general_setting.*`：运营通用配置。`setting/operation_setting/general_setting.go`  
- `performance_setting.*`：性能阈值配置。`setting/performance_setting/config.go`  

## 约束

- 敏感配置（Token/Secret/Key）在查询接口必须脱敏或过滤。`controller/option.go:24-30`  
- JSON 读写在业务代码应使用 `common/json.go` 包装函数（项目规则）。`common/json.go:9-25`  
- 配置键命名应保持可检索，优先 `模块名.字段名`。

## Related Architecture

- `architecture/config-center.md`
- `architecture/channel-routing-selection.md`
