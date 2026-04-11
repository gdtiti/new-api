## 为什么

当前 OpenAI 风格下游请求会在渠道选择完成后继续依赖协议转换，这会让 OpenAI 新旧协议的路由边界不清晰，也会让管理员难以显式禁止跨协议转换。

需要一个系统级严格模式开关，让管理员可以明确要求：当下游请求是 OpenAI 新旧协议时，只允许使用原生 OpenAI 协议上游渠道，不再走协议转换。

## 变更内容

- 新增一个系统级开关，用于控制 OpenAI 风格下游请求是否启用严格上游限制
- 当开关开启时，`/v1/chat/completions`、`/v1/responses`、`/v1/responses/compact` 只能路由到 OpenAI 协议兼容的上游渠道
- 不兼容的上游渠道不会进入候选集合，因此不会发生跨协议转换
- 在系统设置中暴露该开关，便于统一启用或关闭

## 功能 (Capabilities)

### 新增功能
- `openai-downstream-routing-guard`: 为 OpenAI 风格下游请求提供可配置的严格上游协议限制，确保在启用后只选择 OpenAI 协议兼容渠道

### 修改功能

## 影响

- `setting/model_setting/global.go`: 新增全局设置项并提供默认值
- `service/channel_select.go`: 在渠道选择阶段增加协议兼容过滤
- `controller/channel-test.go`: 对齐渠道测试场景下的协议限制
- `web/src/pages/Setting/Model/SettingGlobalModel.jsx`: 暴露系统开关
