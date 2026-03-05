# Git 协作规范

## Core Summary

- 采用短生命周期分支开发，主分支保持可发布状态。
- 提交信息建议使用 `type: summary` 风格（与仓库历史一致）。
- PR 以“变更目的 + 风险 + 验证”最小闭环描述，避免只写“改了什么”。
- 严禁危险 Git 操作（如强推主分支、绕过校验后合并）。

## 提交风格建议（基于仓库习惯）

参考近期历史：`fix: ...`、`feat: ...`、`chore: ...`（示例见 `git log` 最近提交）。

推荐格式：

- `feat: <新增能力的目的>`
- `fix: <修复的问题与影响面>`
- `chore: <非功能性维护项>`
- `refactor: <重构目标>`
- `docs: <文档变更主题>`
- `test: <测试补充点>`

建议：

- 标题尽量 ≤ 72 字符，使用祈使语气，突出“为什么”。
- 一个提交聚焦一个逻辑主题，避免“顺手修”混入。

## 分支策略

- 主分支：`main`（受保护，保持稳定）。
- 功能分支：`feature/<topic>` 或 `feat/<topic>`。
- 修复分支：`fix/<issue-or-topic>`。
- 文档分支：`docs/<topic>`（纯文档可单独分支）。

实践建议：

- 分支从最新 `main` 拉出，定期同步（rebase 或 merge 团队约定其一）。
- 分支命名包含可识别主题，避免 `test1`/`tmp`。

## PR 检查清单

提交 PR 前请逐项确认：

- [ ] 变更范围清晰：PR 描述说明背景、目标、非目标。
- [ ] 代码分层正确：未破坏 `router -> controller -> service -> model` 约束。
- [ ] JSON 规范遵守：业务 JSON 使用 `common/json.go` 包装函数。
- [ ] DB 兼容已考虑：SQLite/MySQL/PostgreSQL 均有兼容策略。
- [ ] Relay 渠道变更已检查 `StreamOptions` 与 `streamSupportedChannels`。
- [ ] 前端改动用 Bun 验证（至少 `bun run build`）。
- [ ] i18n 改动已运行 `bun run i18n:extract/sync/lint`（如适用）。
- [ ] 不包含敏感文件与凭据（`.env`、密钥、token 等）。
- [ ] 文档是否需要更新（涉及行为变化时同步更新 llmdoc）。

## 禁止项（Hard Rules）

- 禁止对 `main/master` 执行 `push --force`。
- 禁止在未评审情况下直接向主分支推送功能改动。
- 禁止使用 `--no-verify` 跳过钩子后合并（除非团队紧急流程明确批准）。
- 禁止提交密钥/凭据/本地环境文件。
- 禁止在历史已共享后随意改写公共提交历史（例如任意 rebase 后强推）。

## Source of Truth

### Primary References

- `AGENTS.md:56-107`：工程级开发规则（JSON、DB、Bun、StreamOptions）
- `main.go:185-186`：路由装配主入口
- `router/main.go:16-20`：分层路由组合
- `common/json.go:9-25`：JSON 统一包装函数
- `model/main.go:118-175`：数据库选择逻辑
- `relay/common/relay_info.go:301-321`：streamSupportedChannels 规则落点
- `web/package.json:44-55`：Bun 与 i18n 命令规范

## Related

- `reference/coding-conventions.md`
- `overview/project-overview.md`
