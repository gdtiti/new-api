# 编码规范（可执行）

## Core Summary

- 后端遵循分层调用：`router -> controller -> service -> model`，避免跨层直连。
- 所有 JSON 编解码统一走 `common/json.go` 包装函数，业务代码不直接调用 `encoding/json`。
- 数据库逻辑必须兼容 SQLite / MySQL / PostgreSQL，原生 SQL 需做方言分支。
- 新增 relay channel 时必须检查 `StreamOptions` 支持并维护 `streamSupportedChannels`。
- 前端默认使用 Bun；i18n 按前后端既定流程维护，多语言变更需运行 i18n 工具链。

## Source of Truth

### Primary Code

- `main.go:186` (router.SetRouter): 运行时统一装配路由层。
- `router/main.go:16-20` (SetRouter): API/Dashboard/Relay/Web 路由组合。
- `common/json.go:9-25` (Unmarshal/Marshal/...): JSON 包装函数全集。
- `model/main.go:20-23` (commonGroupCol/commonKeyCol/commonTrueVal/commonFalseVal): 跨库 SQL 兼容字段。
- `model/main.go:118-175` (chooseDB): 三数据库选择与初始化入口。
- `common/database.go:9-12` (UsingSQLite/UsingPostgreSQL/UsingMySQL): DB 类型标志位。
- `relay/common/relay_info.go:301-321` (streamSupportedChannels): 支持 StreamOptions 的渠道白名单。
- `web/package.json:44-55`: 前端脚本与 i18n CLI 命令。
- `i18n/i18n.go:35-60` (Init): 后端 i18n 初始化与语言加载。
- `web/src/i18n/i18n.js:32-51`: 前端 i18next 初始化、资源与 fallback。

## 执行规范

### 1) Go 分层调用规范

- Router 仅做路由编排，不写业务逻辑。
- Controller 负责请求参数处理、鉴权上下文读取、调用 Service。
- Service 组织业务流程，可协调多个 Model。
- Model 负责 DB 读写与查询细节。
- **禁止**：Router 直接访问 Model；Controller 直接拼复杂 SQL。

检查方式：
- 评审时确认新增逻辑是否跨层跳转。
- 新增文件按目录职责放置（`router/`、`controller/`、`service/`、`model/`）。

### 2) JSON 处理强制规范

- 必须使用：
  - `common.Unmarshal` / `common.UnmarshalJsonStr`
  - `common.DecodeJson`
  - `common.Marshal`
  - `common.GetJsonType`
- 业务代码中避免直接 `encoding/json.Marshal/Unmarshal` 调用。

检查方式：
- 提交前检索是否新增直接 JSON 调用（允许类型引用，如 `json.RawMessage`）。

### 3) 三数据库兼容规范

- 默认优先 GORM 抽象，不优先手写 SQL。
- 原生 SQL 不可避免时：
  - 保留字列名使用 `commonGroupCol/commonKeyCol`。
  - 布尔值使用 `commonTrueVal/commonFalseVal`。
  - 根据 `UsingPostgreSQL/UsingSQLite/UsingMySQL` 做方言分支。
- 迁移需考虑 SQLite 限制（例如 `ALTER COLUMN` 不可直接使用）。

检查方式：
- 对新增 SQL 检查 PostgreSQL + MySQL/SQLite 语法差异。
- 至少在本地跑一种 SQL 方言；PR 描述中说明兼容性考虑。

### 4) 新增 Relay Channel 规范（StreamOptions）

- 新增渠道时先确认上游是否支持 `StreamOptions`。
- 若支持，必须加入 `streamSupportedChannels`。
- 若不支持，需在文档/PR 描述说明行为差异。

检查方式：
- 改动涉及 `relay/channel/` 时，审查 `relay/common/relay_info.go:301-321` 是否同步更新。

### 5) 前端 Bun 约定

- 包管理与脚本执行统一使用 Bun：
  - `bun install`
  - `bun run dev`
  - `bun run build`
  - `bun run i18n:*`
- 避免在文档和 CI 指南中混用 npm/yarn 命令。

检查方式：
- 前端变更后使用 Bun 执行对应命令验证。

### 6) i18n 约定

- 后端：通过 `i18n.Init()` 加载语言包，按上下文语言返回消息。
- 前端：`web/src/i18n/locales/*.json` 维护文案，`zh-CN` 为 fallback。
- 前端 key 约定：以中文源文案作为 key（仓库既有习惯）。
- 修改文案后执行：`bun run i18n:extract && bun run i18n:sync && bun run i18n:lint`。

检查方式：
- PR 中若含文案改动，需附 i18n 工具执行结果或说明。

### 7) 命名与提交前检查

- 命名：
  - Go 导出符号使用 PascalCase，局部变量语义化命名。
  - 文件名遵循现有目录风格（Go 使用 snake_case 文件名，前端延续既有命名）。
- 提交前检查（最小集）：
  1. 后端编译/测试通过（至少受影响模块）。
  2. 前端改动时完成 `bun run build` 或等效验证。
  3. i18n 改动执行 i18n 工具链。
  4. 无敏感信息（`.env`、密钥、凭据）进入提交。

## Related Architecture

- `overview/project-overview.md`
