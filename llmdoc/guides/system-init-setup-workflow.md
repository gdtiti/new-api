# 系统初始化Setup工作流

## 目标

完成新实例从“未初始化”到“可登录可用”的一次性初始化，并验证配置已持久化。

## 步骤

### Step 1: 确认实例处于未初始化状态

- 访问 `GET /api/setup` 检查 `status`。证据链：`router/api-router.go:21-22`, `controller/setup.go:27-52`。
- 前端会在未初始化时强制跳转 `/setup`。证据：`web/src/components/layout/SetupCheck.js:29-35`。

验证: `curl http://<host>/api/setup`

### Step 2: 提交初始化参数

- 调用 `POST /api/setup`，包含管理员账号与模式配置。证据：`controller/setup.go:54-175`。
- 若 root 用户不存在，后端会创建 root 并校验密码长度与一致性。证据：`controller/setup.go:78-123`。

验证: 响应 `success=true` 且 message 为“系统初始化成功”。

### Step 3: 校验持久化与运行态

- 检查 setup 记录已写入。证据：`controller/setup.go:158-163`, `model/setup.go:9-16`。
- 检查模式配置已通过 Option 落库。证据：`controller/setup.go:137-153`, `model/option.go:180-194`。

验证: 再次 `GET /api/setup` 返回 `status=true`

## 故障排除

| 问题 | 解决方案 |
| ---- | -------- |
| 返回“系统已经初始化完成” | 当前实例已有 setup 记录，确认是否误在旧环境执行；必要时新建环境重做。 |
| 提示“保存自用模式设置失败” | 检查数据库写权限与 `Option` 表状态，关注 `model.UpdateOption` 失败日志。`controller/setup.go:137-153` |
| 前端无法进入 `/setup` | 检查 `/api/status` 与 `/api/setup` 是否可达，确认反向代理未拦截。`web/src/components/layout/PageLayout.jsx:87-100` |
