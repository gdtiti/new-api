# 渠道管理后台工作流

## 目标

通过管理后台完成渠道巡检、编辑与上游模型同步，保证可用渠道池健康。

## 步骤

### Step 1: 查看渠道与筛选问题范围

- 打开 `/console/channel`，加载分页、类型统计、状态过滤。`web/src/App.jsx:135-140`, `web/src/hooks/channels/useChannelsData.jsx:345-369`。
- 后端对应 `GET /api/channel`。`router/api-router.go:205`。

验证: 页面能显示 `items/total/type_counts`

### Step 2: 执行运维动作

- 测试全量或单渠道：`/api/channel/test`、`/api/channel/test/:id`。`router/api-router.go:211-212`。
- 更新余额：`/api/channel/update_balance`。`router/api-router.go:213-214`。
- 编辑渠道、标签、多密钥：`PUT /api/channel`、`PUT /api/channel/tag`、`POST /api/channel/multi_key/manage`。`router/api-router.go:216,220,239`。

验证: 操作后重新加载列表，状态/字段有变化

### Step 3: 同步上游模型

- 先 detect 再 apply：`/api/channel/upstream_updates/detect(_all)` -> `/apply(_all)`。`router/api-router.go:240-243`。
- 支持不同渠道类型上游模型拉取策略。`controller/channel_upstream_update.go:238-292`。

验证: 渠道模型列表与上游一致

## 故障排除

| 问题 | 解决方案 |
| ---- | -------- |
| 无法查看渠道密钥 | 该接口要求 Root + 安全验证，确认账号角色与二次验证通过。`router/api-router.go:210` |
| 搜索结果为空 | 检查 `keyword/group/model/status/type` 组合过滤是否过严。`controller/channel.go:248-358` |
| 上游模型检测失败 | 检查渠道 baseURL/key 是否可用，关注类型特定接口差异（Gemini/Ollama）。`controller/channel_upstream_update.go:244-266` |
