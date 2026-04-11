# openai-downstream-routing-guard 规范

## 目的
待定 - 由归档变更 enforce-openai-upstream-for-openai-downstream 创建。归档后请更新目的。
## 需求
### 需求: 管理员可以配置 OpenAI 下游严格上游限制

系统必须允许管理员通过系统级配置启用或关闭“OpenAI 下游严格上游限制”，并且该配置必须可被运行时选路逻辑读取。

#### 场景: 启用严格上游限制
- **当** 管理员开启 OpenAI 下游严格上游限制
- **那么** 系统必须保存该配置
- **并且** 后续 OpenAI 风格下游请求必须按该配置执行协议兼容过滤

#### 场景: 关闭严格上游限制
- **当** 管理员关闭 OpenAI 下游严格上游限制
- **那么** 系统必须保存该配置
- **并且** 后续选路逻辑不得因为该配置而额外过滤原本可用的非 OpenAI 上游渠道

### 需求: 严格模式下 OpenAI 下游请求只能选择 OpenAI 协议兼容上游

当 OpenAI 下游严格上游限制已启用时，系统必须只为 OpenAI 风格下游请求选择 OpenAI 协议兼容的上游渠道，并且不得对不兼容渠道执行跨协议转换。

#### 场景: Chat Completions 请求过滤非 OpenAI 上游渠道
- **当** 下游请求使用 `/v1/chat/completions`
- **并且** OpenAI 下游严格上游限制已启用
- **那么** 系统只能从 `APITypeOpenAI` 或 `APITypeCodex` 渠道中选择上游

#### 场景: Responses 请求过滤非 OpenAI 上游渠道
- **当** 下游请求使用 `/v1/responses`
- **并且** OpenAI 下游严格上游限制已启用
- **那么** 系统只能从 `APITypeOpenAI` 或 `APITypeCodex` 渠道中选择上游

#### 场景: Responses Compact 请求过滤非 OpenAI 上游渠道
- **当** 下游请求使用 `/v1/responses/compact`
- **并且** OpenAI 下游严格上游限制已启用
- **那么** 系统只能从 `APITypeOpenAI` 或 `APITypeCodex` 渠道中选择上游
- **并且** 不兼容的上游渠道不得进入协议转换流程

