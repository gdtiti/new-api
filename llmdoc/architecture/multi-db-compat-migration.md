# 多数据库兼容迁移 Architecture

## Identity

**What**: SQLite/MySQL/PostgreSQL 三库兼容的初始化与迁移实现。  
**Purpose**: 保证同一代码在不同数据库下可启动、可升级、可回滚兼容字段。

## Core Components

| File | Symbol | Purpose |
| ---- | ------ | ------- |
| `model/main.go` | `chooseDB` | 按 DSN 判定数据库类型并初始化驱动 |
| `model/main.go` | `initCol` | 统一保留字列名与布尔字面量差异 |
| `model/main.go` | `InitDB` / `InitLogDB` | 主库/日志库连接池初始化与迁移触发 |
| `model/main.go` | `migrateDB` | 核心表 AutoMigrate 与前置迁移任务 |
| `model/main.go` | `ensureSubscriptionPlanTableSQLite` | SQLite 专用建表/补列逻辑 |

## Execution Flow

1. 启动时 `InitResources` 调用 `model.InitDB`。`main.go:264-269`  
2. `chooseDB` 根据 `SQL_DSN` 识别 pg/mysql/sqlite 并设置运行标志。`model/main.go:118-175`  
3. `initCol` 根据数据库类型设置 `group/key` 引号与布尔值写法。`model/main.go:28-40`  
4. 主节点执行 `migrateDB`，批量迁移实体表。`model/main.go:198-206`, `model/main.go:250-297`  
5. SQLite 场景走 `ensureSubscriptionPlanTableSQLite` 规避列变更限制。`model/main.go:287-295`, `model/main.go:381-410`  

## 失败与边界

- MySQL 自动补 `parseTime=true`，避免时间解析异常。`model/main.go:153-159`  
- MySQL 字符集在启动时做中文能力校验。`model/main.go:184-189`, `model/main.go:224-229`  
- 非主节点不执行迁移，只建连接池。`model/main.go:198-200`, `model/main.go:238-240`  
- 日志库可独立 DSN，且有独立方言标记。`model/main.go:41-59`, `model/main.go:213-243`  

## Related

- `reference/multi-db-compat-migration-spec.md` - 兼容约束清单
- `architecture/config-center.md` - 配置项与迁移关联
