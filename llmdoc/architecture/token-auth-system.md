# 令牌与鉴权体系 Architecture

## Identity

**What**: 会话鉴权 + AccessToken + API Token 的多入口鉴权体系。  
**Purpose**: 同时支持控制台用户访问与 OpenAI 兼容 API 调用，并统一注入权限上下文。

## Core Components

| File | Symbol | Purpose |
| ---- | ------ | ------- |
| `middleware/auth.go` | `UserAuth/AdminAuth/RootAuth` | 会话用户鉴权与角色门禁 |
| `middleware/auth.go` | `TokenAuth` | API Token 鉴权，兼容多 header/query 来源 |
| `middleware/auth.go` | `TokenAuthReadOnly` | 只读场景宽松 token 校验 |
| `model/token.go` | `ValidateUserToken` | token 状态/过期/额度校验 |
| `model/user.go` | `ValidateAccessToken` | 控制台 access token 校验 |

## Execution Flow

1. 控制台 API 走 `authHelper`，要求 session/AccessToken + `New-Api-User` 一致。`middleware/auth.go:33-137`  
2. relay/API token 请求走 `TokenAuth`，自动兼容 `Authorization`、`x-api-key`、`x-goog-api-key`、`Sec-WebSocket-Protocol`。`middleware/auth.go:248-286`  
3. `TokenAuth` 调 `ValidateUserToken` 完成令牌状态、过期、额度校验。`middleware/auth.go:304-313`, `model/token.go:167-207`  
4. 写入 token/user/group/cross-group-retry 等上下文供分发和计费使用。`middleware/auth.go:372-401`  
5. 只读查询（如 token usage）走 `TokenAuthReadOnly`，仅确保 key 可解析且用户未封禁。`middleware/auth.go:191-245`  

## 失败与边界

- `New-Api-User` 缺失或与 session 用户不一致直接拒绝。`middleware/auth.go:76-103`  
- token exhausted/expired/status invalid 会返回不同错误语义。`model/token.go:173-205`  
- 普通用户不能通过 token 指定 `specific_channel_id`。`middleware/auth.go:392-399`  
- token 可配置 IP 白名单，越权 IP 直接 `403`。`middleware/auth.go:316-329`  

## Related

- `architecture/channel-routing-selection.md` - 鉴权后进入分发选路
- `architecture/frontend-routing-guards.md` - 前端私有路由与后台权限守卫
