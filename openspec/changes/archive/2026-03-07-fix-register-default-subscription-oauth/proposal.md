## 为什么

当前“新用户注册默认赠送订阅”有两个现实问题：管理员可以设置默认套餐，但不能将其清空为“无”；同时 GitHub 登录首次注册的账号没有稳定应用默认套餐，导致不同注册入口的行为不一致。

这会让配置中心缺少完整的开关语义，也会让普通注册与 OAuth 注册在订阅权益上出现分叉，因此需要补齐配置清空能力并修复 GitHub 注册链路的一致性。

## 变更内容

- 允许管理员将“注册默认赠送订阅套餐”从已选套餐恢复为“空配置”。
- 保持启用状态下的安全约束：当注册默认赠送功能处于启用状态时，仍然必须配置一个存在且已启用的套餐。
- 修复 GitHub OAuth 首次注册用户未应用默认赠送套餐的问题，使其与普通注册保持一致。
- 补充回归测试，覆盖配置清空与 GitHub OAuth 新注册发放默认套餐场景。

## 功能 (Capabilities)

### 新增功能

### 修改功能

- `registration-default-subscription`: 调整默认套餐配置的清空语义，并补齐 GitHub OAuth 新用户注册时的默认套餐发放行为。

## 影响

- `web/src/components/settings/SystemSetting.jsx`: 默认套餐选择器与保存逻辑，支持提交空值。
- `controller/option.go`: 默认套餐配置校验逻辑，允许在功能关闭时保存空值。
- `controller/oauth.go`: GitHub/OAuth 新用户注册后的默认套餐发放链路校验与修正。
- `controller/register_default_subscription_test.go`: 增加或补强回归测试。
- 可能涉及 `model/user.go`: 若需要统一注册后默认套餐发放入口。
