# J-Board API 与 Server Actions

本文整理 J-Board 当前有效的 HTTP Route Handlers 和内部 Server Actions。HTTP 对外结构化描述见 `docs/openapi.yaml`；本文更偏向工程阅读和排障。

## 通用约定

- 普通用户身份：NextAuth Cookie 会话。
- 管理员身份：NextAuth Cookie 会话，且用户角色为 `ADMIN`。
- Agent 身份：`Authorization: Bearer <agent-token>`。
- 返回格式：默认 JSON，订阅内容和文件下载接口除外。
- 时间字段：ISO 8601 字符串。
- 写操作：必须做权限校验、输入校验、审计记录和必要的 `revalidatePath`。
- 3x-ui 密码、Agent Token、SMTP 密码、支付密钥等敏感字段在数据库中加密保存。

## 认证与公开信息

### `POST /api/auth/register`

注册普通用户。是否允许注册、是否必须邀请码、是否需要邮箱验证由后台系统设置控制。

请求体：

```json
{
  "email": "user@example.com",
  "password": "password123",
  "name": "Alice",
  "inviteCode": "optional",
  "turnstileToken": "optional"
}
```

行为：

- 校验邮箱、密码、邀请码和 Turnstile。
- 当注册邮箱验证开启时，用户会进入 `PENDING_EMAIL` 状态并收到验证邮件。
- 当注册邮箱验证关闭时，用户直接成为可登录用户。

### `GET|POST /api/auth/[...nextauth]`

NextAuth 内置登录、登出、会话接口。

### `GET /api/public/app-info`

返回站点名称、注册策略、维护公告、Turnstile 配置、网站公开配置等信息。前端登录页、注册页和公共布局会使用它。

## 延迟与路由展示

### `GET /api/latency?nodeId=<id>`

返回节点最新三网延迟。

### `GET /api/latency/history?nodeId=<id>&carrier=telecom&range=7d`

返回节点延迟历史。`carrier` 通常为 `telecom`、`unicom`、`mobile`；`range` 支持 `1d`、`7d`、`30d`。

### `GET /api/latency/recommendations`

返回前台线路推荐所需的延迟聚合结果。

### `GET /api/traces?nodeId=<id>`

返回节点三网路由追踪结果。服务端会重新归一化历史数据，修正 CN2 GIA、CN2 GT、CMIN2、CMI 等线路分类。

## 支付接口

### `GET /api/payment/providers`

返回当前启用的支付方式。普通用户创建订单或切换支付方式时使用。

### `POST /api/payment/create`

为待支付订单创建支付参数。

请求体：

```json
{
  "orderId": "order-id",
  "provider": "epay"
}
```

行为：

- 校验订单属于当前用户且仍待支付。
- 根据支付方式生成支付链接、二维码或链上支付信息。
- 记录支付流水，便于后续回调或查询。

### `GET /api/payment/order/{orderId}`

查询当前用户自己的订单支付状态。

### `GET /api/payment/query/{tradeNo}`

按支付流水号主动查询支付状态。用于前端轮询或支付平台回调异常时兜底。

### `GET|POST /api/payment/notify/{provider}`

支付平台异步通知入口。当前 provider 包括：

- `epay`
- `alipay_f2f`
- `usdt_trc20` 的链上入账由查询任务处理，不依赖传统 HTTP 回调。

行为：

- 校验签名或链上入账。
- 标记订单已支付。
- 调用 `src/services/provision.ts` 创建或续费订阅。
- 代理订阅会同步 3x-ui client。

## 订阅与用户资源

### `GET /api/subscription/{id}?token=<downloadToken>`

无需登录，但必须提供合法下载 token。成功返回 `text/plain` 订阅内容。

行为：

- 校验订阅状态、到期时间和 token。
- 记录订阅访问日志和真实 IP。
- 执行订阅访问限流和地区变化风控。
- 当订阅被暂停或风控限制时，返回错误内容或拒绝访问。

### `GET /api/subscription/all`

返回用户聚合订阅内容。用于部分客户端的一键导入或总订阅入口。

### `GET /api/notifications`

返回当前用户通知列表。

### `GET /api/support/attachments/{id}`

工单附件访问接口。要求登录用户是附件所属工单用户本人或管理员。加 `?download=1` 可触发下载。

## 管理读取与导出

以下接口要求管理员会话。

### `GET /api/admin/nodes`

返回节点和已同步入站的简要信息。

### `GET /api/admin/nodes/{id}/inbounds`

返回指定节点的已同步入站。套餐绑定和节点详情页会使用。

### `GET /api/admin/export/config`

导出配置快照，包含站点设置、公告、服务、套餐、节点、入站、支付配置等。敏感值会按实现规则脱敏或加密保存，不应公开传播。

### `GET /api/admin/export/audit-logs?q=<keyword>`

导出审计日志。

### `GET /api/admin/backup/database`

导出 SQL 数据库备份。备份包含用户、订单、节点、支付、SMTP 等敏感信息，应加密保存。

## Agent 上报接口

以下接口由 `agent/jboard-agent` 调用。Agent Token 存储在 `NodeServer.agentToken` 中，并加密保存。请求头必须为：

```http
Authorization: Bearer <agent-token>
```

服务端会通过 Token 匹配到具体节点 `nodeId`。

### `POST /api/agent/latency`

请求体：

```json
{
  "latencies": [
    { "carrier": "telecom", "latencyMs": 35 },
    { "carrier": "unicom", "latencyMs": 42 },
    { "carrier": "mobile", "latencyMs": 28 }
  ]
}
```

行为：

- 更新 `NodeLatency`。
- 写入 `NodeLatencyLog`。
- 前台节点延迟、历史图表和推荐会使用这些数据。

### `POST /api/agent/trace`

请求体：

```json
{
  "traces": [
    {
      "carrier": "telecom",
      "hops": [
        {
          "hop": 1,
          "ip": "203.0.113.1",
          "geo": "CN",
          "latency": 3.5,
          "asn": "AS4809",
          "owner": "China Telecom CN2",
          "isp": "China Telecom"
        }
      ],
      "summary": "CN2 GIA",
      "hopCount": 12
    }
  ]
}
```

行为：

- 服务端重新分类线路，避免旧 Agent 或 nexttrace 文案导致误判。
- 按 `nodeId + carrier` 更新 `RouteTrace`。
- 线路分类会优先识别 CN2 GIA、CN2 GT、CMIN2、CMI 等常见中国方向线路。

### `POST /api/agent/node-access`

接收 Agent 从 Xray access log 聚合出的真实节点连接事件。

请求体：

```json
{
  "events": [
    {
      "clientEmail": "user@example.com-cmojtnp3",
      "sourceIp": "220.240.111.193",
      "inboundTag": "inbound-17583",
      "network": "tcp",
      "targetHost": "example.com",
      "targetPort": 443,
      "action": "accepted",
      "connectionCount": 18,
      "uniqueTargetCount": 14,
      "firstSeenAt": "2026-04-29T09:20:05+10:00",
      "lastSeenAt": "2026-04-29T09:20:07+10:00"
    }
  ]
}
```

行为：

- 通过 `clientEmail` 匹配 `NodeClient.email`。
- 同时要求该 client 属于当前 Agent Token 对应节点。
- 写入 `SubscriptionAccessLog`，来源标记为“节点真实连接”。
- 使用 `sourceIp` 执行国家、省/地区、城市变化风控。
- 使用 `connectionCount` 和 `uniqueTargetCount` 执行节点日志行为风控。
- 创建 `SubscriptionRiskEvent`、通知、审计日志，并在需要时自动暂停订阅。

返回示例：

```json
{
  "ok": true,
  "processed": 1,
  "skipped": 0,
  "warnings": 0,
  "suspended": 0
}
```

常见跳过原因：

- Xray access log 没有 `email:` 字段。
- `email:` 与本地 `NodeClient.email` 不一致。
- 日志来自 `[api -> api]` 这类 3x-ui 本地 API 通信。
- 后台关闭了订阅风控总控或节点日志风控。

## Server Actions

Server Actions 是后台和用户端写操作的主要入口。它们不是公开 HTTP API，不建议第三方直接调用。

### 管理端 Actions

#### 节点：`src/actions/admin/nodes.ts`

- `createNode(formData)`：创建 3x-ui 节点并同步入站。
- `updateNode(id, formData)`：更新 3x-ui 节点连接信息并重新同步入站。
- `deleteNode(id)`：删除节点及本地关联数据。
- `testNodeConnection(id)`：测试 3x-ui 登录并同步入站。
- `batchTestNodeConnections(formData)`：批量测试并同步节点。
- `updateInboundDisplayName(id, formData)`：修改同步入站的前台展示名称。
- `deleteInbound(id)`：仅删除本地入站镜像，不删除 3x-ui 入站。
- `generateAgentToken(nodeId)`：生成 Agent Token。
- `revokeAgentToken(nodeId)`：撤销 Agent Token。

#### 订阅：`src/actions/admin/subscriptions.ts`

- `suspendSubscription(id)`：暂停订阅，并通过 3x-ui 禁用代理客户端。
- `activateSubscription(id)`：恢复订阅，并通过 3x-ui 启用代理客户端。
- `cancelSubscription(id)`：取消订阅。
- `deleteSubscriptionPermanently(id)`：强制删除订阅及名下关联数据，并尽量删除 3x-ui 客户端。
- `reassignStreamingSlot(...)`：调整流媒体槽位。
- `batchSubscriptionOperation(formData)`：批量处理订阅。

#### 订阅风控：`src/actions/admin/subscription-risk.ts`

- 更新复核状态和复核备注。
- 生成风险报告。
- 向用户发送风险报告并开启用户端全屏限制。
- 解除封控限制并恢复可恢复的代理订阅。
- 保持封禁/暂停并记录最终处理结果。

后台“订阅风控”页面依赖 `src/services/subscription-risk-review.ts` 整理地图、IP、分析日志和报告文本。

#### 日志清理：`src/actions/admin/logs.ts`

- `deleteAdminLogEntry({ target, id })`：删除单条审计、任务、流量、节点延迟、风控访问或风控事件日志。
- `cleanupExpiredAdminLogs({ target, cutoffDays })`：按日志范围和保留天数手动清理过期日志，并写入审计日志。

自动清理由 `src/services/log-cleanup-scheduler.ts` 启动，默认每天最多执行一次，读取 `AppConfig.logCleanupEnabled` 和 `AppConfig.logRetentionDays`。自动清理和手动过期清理都会保留仍处于用户端限制中的风控事件。

#### 订单：`src/actions/admin/orders.ts`

- `confirmOrder(orderId)`：手动确认订单并触发开通。
- `cancelOrder(orderId)`：取消订单。
- `updateOrderReview(...)`：更新风控/复核状态。
- `batchOrderOperation(formData)`：批量操作订单。

#### 其他管理动作

- 用户：`src/actions/admin/users.ts`
- 套餐：`src/actions/admin/plans.ts`
- 流媒体服务：`src/actions/admin/services.ts`
- 支付配置：`src/actions/admin/payments.ts`
- 公告：`src/actions/admin/announcements.ts`
- 工单：`src/actions/admin/support.ts`
- 系统设置：`src/actions/admin/settings.ts`
- 日志清理：`src/actions/admin/logs.ts`
- 备份恢复：`src/actions/admin/backups.ts`
- 任务重试：`src/actions/admin/tasks.ts`
- 流量视图刷新：`src/actions/admin/traffic.ts`
- 优惠券与促销：`src/actions/admin/commerce.ts`

### 用户端 Actions

- `src/actions/user/purchase.ts`：立即购买、续费、增流量、查询库存。
- `src/actions/user/cart.ts`：加入购物车、移除、清空、结算。
- `rotateSubscriptionAccess(subscriptionId)`：重置代理订阅访问凭据，并同步更新 3x-ui 客户端。
- `src/actions/user/account.ts`：资料、密码、邀请码、邮箱变更。
- `src/actions/user/notifications.ts`：已读、删除、清空。
- `src/actions/user/support.ts`：创建、回复、关闭、删除工单。创建工单会受后台工单上限控制。
- `src/actions/user/orders.ts`：取消待支付订单、重新选择支付方式。

## 风控数据模型要点

- `SubscriptionAccessLog`：保存订阅 API 访问和节点真实连接证据。
- `SubscriptionRiskEvent`：保存风控事件、复核状态、报告、用户端限制和最终处理动作。
- `SubscriptionRiskReason`：包含城市、省/地区、国家变化，以及节点高频、目标分散等原因。
- `AppConfig`：保存订阅风控总控、自动暂停开关、阈值、节点日志风控阈值，以及日志清理开关、保留天数和上次清理时间。
- `NodeClient.email`：用于匹配 Xray access log 中的 `email:`。它可能形如 `user@example.com-cmojtnp3`，不要手动在 3x-ui 修改。

## 错误处理约定

- 输入校验失败：返回 400 或在 Server Action 中返回可展示错误。
- 未登录：返回 401 或跳转登录。
- 权限不足：返回 403 或抛出权限错误。
- 资源不存在：返回 404 或抛出 not found。
- 外部服务失败：保留审计日志或任务记录，前端展示简洁错误。
- 生产环境 Server Components 会隐藏原始堆栈；排障时看 `docker compose logs -f app`。

## 维护约定

- 新增公开 HTTP 接口时，同时更新 `docs/API.md` 和 `docs/openapi.yaml`。
- 新增 Agent 上报字段时，同时更新 `agent/jboard-agent/README.md`。
- 新增系统设置时，同时更新 `.env.example` 或 README 中对应后台配置说明。
- 涉及 3x-ui 客户端状态的写操作必须通过 `src/services/node-panel` 同步。
- 不再新增节点控制面、运行配置下发、Xray 进程管理类 Action。
