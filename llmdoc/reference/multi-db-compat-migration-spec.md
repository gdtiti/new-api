# 多数据库兼容迁移规范

## Core Summary

- 运行时必须支持 SQLite/MySQL/PostgreSQL 三库自动识别与启动。  
- 业务 SQL 涉及 `group/key/boolean` 时必须走统一方言变量。  
- 迁移优先 GORM AutoMigrate，SQLite 特例走“建表/补列”策略。  
- 非主节点禁止迁移，避免多实例并发 DDL。  

## Source of Truth

### Primary Code

- `model/main.go:118-175` (chooseDB): DSN 驱动选择与数据库类型标志。  
- `model/main.go:28-40` (initCol): `commonGroupCol/commonKeyCol/commonTrueVal/commonFalseVal` 初始化。  
- `model/main.go:177-206` (InitDB): 主库连接池与迁移触发。  
- `model/main.go:250-297` (migrateDB): 统一实体迁移清单。  
- `model/main.go:381-410` (ensureSubscriptionPlanTableSQLite): SQLite 兼容建表路径。  
- `common/database.go:9-12` (UsingSQLite/UsingPostgreSQL/UsingMySQL): 运行标记。  

### Related Configuration

- `SQL_DSN` / `LOG_SQL_DSN`（数据库连接来源）`model/main.go:122`, `model/main.go:214`  
- `SQL_MAX_IDLE_CONNS` / `SQL_MAX_OPEN_CONNS` / `SQL_MAX_LIFETIME`（连接池）`model/main.go:194-196`  

## 兼容规则

- 禁止直接写死 `"group"`/`` `group` ``，统一引用 `commonGroupCol`。`model/main.go:20-21`, `model/main.go:31-38`  
- 禁止直接写死布尔字面量，统一使用 `commonTrueVal/commonFalseVal`。`model/main.go:22-23`, `model/main.go:33-39`  
- SQLite 不做复杂 `ALTER COLUMN`，采用补列/重建表策略。`model/main.go:381-410`  
- MySQL 启动需校验中文字符集支持。`model/main.go:184-189`  

## Related Architecture

- `architecture/multi-db-compat-migration.md`
- `architecture/system-init-setup.md`
