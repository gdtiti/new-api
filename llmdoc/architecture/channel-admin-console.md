# 渠道管理后台 Architecture

## Identity

**What**: 管理端渠道生命周期管理（查询、编辑、测试、余额、模型同步、多密钥）。  
**Purpose**: 让管理员可持续治理上游渠道健康度与模型覆盖。

## Core Components

| File | Symbol | Purpose |
| ---- | ------ | ------- |
| `router/api-router.go` | `/api/channel/*` | 渠道管理 API 路由全集 |
| `controller/channel.go` | `GetAllChannels/SearchChannels/UpdateChannel/...` | 渠道 CRUD 与运维动作 |
| `controller/channel_upstream_update.go` | `Detect/Apply Upstream Updates` | 上游模型差异检测与应用 |
| `web/src/pages/Channel/index.jsx` | `Channel` 页面 | 渠道管理页入口 |
| `web/src/hooks/channels/useChannelsData.jsx` | `loadChannels/manageChannel` | 前端数据加载与操作封装 |

## Execution Flow

1. 管理员进入 `/console/channel`，前端加载渠道列表与过滤统计。`web/src/App.jsx:135-140`, `web/src/hooks/channels/useChannelsData.jsx:345-369`  
2. 列表/搜索请求命中 `GetAllChannels` 或 `SearchChannels`。`router/api-router.go:205-207`, `controller/channel.go:71-173`, `controller/channel.go:248-358`  
3. 编辑、启停、标签、多密钥等操作走 `PUT/POST /api/channel/*`。`router/api-router.go:215-243`, `web/src/hooks/channels/useChannelsData.jsx:448-497`  
4. 健康运维：测试、余额更新、能力修复、上游模型更新。`router/api-router.go:211-214`, `router/api-router.go:223-243`  

## 失败与边界

- 渠道 key 明文读取接口需要 Root + 限流 + 安全验证。`router/api-router.go:210`  
- tag mode/normal mode 两种查询路径都支持状态与类型过滤。`controller/channel.go:90-145`, `controller/channel.go:286-322`  
- 上游模型同步会按 channel type 走不同 fetch 逻辑（Ollama/Gemini/通用）。`controller/channel_upstream_update.go:238-292`  

## Related

- `architecture/channel-routing-selection.md`
- `guides/channel-admin-workflow.md`
