# 系统初始化Setup Architecture

## Identity

**What**: 系统首次启动与初始化（资源加载、数据库、Setup 状态、前端引导）链路。  
**Purpose**: 保证实例从“未初始化”安全进入“可登录可运营”状态。

## Core Components

| File | Symbol | Purpose |
| ---- | ------ | ------- |
| `main.go` | `main` / `InitResources` | 启动入口、资源初始化、路由装配 |
| `model/main.go` | `CheckSetup` | 判定 setup 状态并写 `constant.Setup` |
| `controller/setup.go` | `GetSetup` / `PostSetup` | 初始化状态查询与初始化提交 |
| `router/api-router.go` | `/api/setup` | Setup API 入口 |
| `web/src/components/layout/SetupCheck.js` | `SetupCheck` | 前端未初始化时强制跳 `/setup` |

## Execution Flow

1. 进程启动执行 `InitResources`（env、DB、option、redis、i18n、oauth）。`main.go:242-315`  
2. DB 初始化后调用 `CheckSetup`：检查 setup 记录与 root 用户并设置全局标志。`main.go:271-272`, `model/main.go:91-116`  
3. 前端通过 `/api/setup` 获取状态，未初始化进入向导。`router/api-router.go:21-22`, `controller/setup.go:27-52`  
4. 提交 `POST /api/setup`：创建 root（如不存在）、保存模式配置、写 setup 记录。`controller/setup.go:54-174`  
5. 前端 `SetupWizard` 完成后刷新，应用进入正常路由。`web/src/components/setup/SetupWizard.jsx:206-214`  

## 失败与边界

- 已初始化时 `PostSetup` 会拒绝重复执行。`controller/setup.go:55-62`  
- root 不存在时必须校验用户名长度与密码规则。`controller/setup.go:78-103`  
- 模式配置落库失败会中断 setup 并返回错误。`controller/setup.go:137-153`  

## Related

- `guides/system-init-setup-workflow.md`
- `architecture/config-center.md`
