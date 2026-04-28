# J-Board

J-Board（也称 JB面板）是一个面向代理订阅售卖与流媒体共享的全栈应用。节点运行、入站和客户端配置由 3x-ui 面板维护；J-Board 负责售卖、订单、订阅、用户、支付、工单和探测展示；自带 Go 程序只做延迟与线路探测上报。

## 架构

```text
用户浏览器
  ↓
Next.js App Router 面板
  ├─ PostgreSQL / Redis
  ├─ 3x-ui API：同步入站、开通/暂停/删除客户端
  └─ Probe API：接收 jboard-agent 的延迟与路由上报
```

J-Board 只保存售卖和展示所需的节点、入站、客户端镜像数据，不下发 Xray/Hy2 配置，也不维护自建节点控制面。

## 功能

用户端：

- 注册、登录、Cloudflare Turnstile 人机验证
- 代理套餐与流媒体套餐购买、续费、增流量
- 线路体验：三网延迟、延迟历史、三网路由追踪详情
- 代理订阅查看、订阅链接下载、订阅访问重置
- 流媒体订阅查看与凭据展示
- 通知中心、工单售后、账号资料、邀请码
- 响应式移动端适配

管理端：

- 3x-ui 节点管理：保存面板地址、账号、密码，测试连接并同步入站
- 本地入站展示名称维护，套餐绑定同步后的入站线路
- 探测 Token 管理：仅用于 `/api/agent/latency` 与 `/api/agent/trace`
- 用户、订单、套餐、订阅、流媒体服务、支付配置
- 公告、工单、系统设置、审计日志、任务中心、备份恢复
- 流量视图：基于本地订阅与 3x-ui 同步结果展示客户端用量

节点侧：

- 3x-ui 负责入站、客户端、协议配置和节点运行
- J-Board 通过 3x-ui API 同步入站并执行客户端增删改
- `agent/jboard-agent` 只负责三网 TCP 延迟和三网路由追踪

## 核心流程

节点接入：

1. 管理员在 3x-ui 中创建真实入站。
2. 管理员在 J-Board 添加节点并填写 3x-ui 面板地址、用户名、密码。
3. J-Board 登录 3x-ui，读取入站列表并写入 `NodeInbound`。
4. 管理员将套餐绑定到已同步入站。
5. 用户购买代理套餐后，J-Board 调用 3x-ui API 创建客户端，并保存 `NodeClient`。
6. 订阅暂停、恢复、删除、重置访问时，同步调用 3x-ui API 更新客户端。

支付开通：

1. 用户选择套餐、入站和流量规格并创建订单。
2. 支付平台回调后，`src/services/payment/process.ts` 标记订单已支付。
3. `src/services/provision.ts` 创建或更新 `UserSubscription`。
4. 代理订阅通过 `src/services/node-panel` 调用 3x-ui 创建或更新客户端。
5. 流媒体订阅分配 `StreamingSlot`。

探测上报：

1. 管理员为节点生成探测 Token。
2. 节点运行 `agent/jboard-agent`，配置 `SERVER_URL` 和 `AUTH_TOKEN`。
3. 探测程序定时调用 `POST /api/agent/latency` 和 `POST /api/agent/trace`。
4. J-Board 按 Token 匹配节点并更新延迟、历史和路由数据。

## 技术栈

- Next.js 16 App Router + React 19
- Prisma 7 + PostgreSQL 16
- NextAuth 4 Credentials + Cloudflare Turnstile
- Redis 7
- Tailwind CSS 4 + Base UI + Sonner + Recharts
- Go probe agent
- Docker / Docker Compose

## 目录

- `src/app`：页面、布局、Route Handlers
- `src/actions`：Server Actions，负责写操作、权限校验、审计和缓存刷新
- `src/services`：领域服务与第三方适配
- `src/services/node-panel`：3x-ui 面板适配层
- `src/services/provision.ts`：支付成功后的订阅开通与 3x-ui 客户端同步
- `src/services/subscription.ts`：订阅内容生成
- `src/lib`：Prisma、鉴权、加密、Turnstile、通用工具
- `prisma/schema.prisma`：数据模型事实源
- `agent/jboard-agent`：延迟与线路探测程序
- `docs/API.md`：HTTP 接口与 Server Actions 参考
- `docs/openapi.yaml`：对外 HTTP 接口的 OpenAPI 描述

## 环境变量

以 `.env.example` 为准，运行至少需要：

- `DATABASE_URL`
- `NEXTAUTH_SECRET`
- `NEXTAUTH_URL`
- `ENCRYPTION_KEY`
- `REDIS_URL`

`ENCRYPTION_KEY` 必须至少 32 字节，用于 3x-ui 面板密码、探测 Token、流媒体凭据等敏感信息加密。Docker 部署时 `DATABASE_URL` 与 `REDIS_URL` 会由 `docker-compose.yml` 覆盖为容器内地址。

## 本地开发

```bash
npm install
cp .env.example .env
npm run db:push
npm run db:seed
npm run dev
```

默认管理员账号：

- 邮箱：`admin@jboard.local`
- 密码：`admin123`

常用检查：

```bash
npx prisma generate
npx tsc --noEmit
npm run lint
npm run build
```

数据库变更：

- 修改 `prisma/schema.prisma` 后运行 `npx prisma generate`
- 使用 `npm run db:push` 同步 schema 到数据库
- 不维护 Prisma migrations，不提交迁移脚本
- 删除字段或模型时同步清理引用、文档和导出逻辑

## Docker 部署

首次启动：

```bash
docker compose up -d --build
docker compose --profile setup run --rm init sh -lc 'npx prisma db push --accept-data-loss'
docker compose exec app npm run db:seed
```

更新部署：

```bash
git pull --ff-only
docker compose build init app
docker compose --profile setup run --rm init sh -lc 'npx prisma db push --accept-data-loss'
docker compose up -d app
```

常用排障：

- 查看状态：`docker compose ps`
- 查看日志：`docker compose logs -f app`
- 页面仍是旧版本：确认已执行 `docker compose build init app` 和 `docker compose up -d app`
- Schema 没有生效：单独运行 `docker compose --profile setup run --rm init sh -lc 'npx prisma db push --accept-data-loss'`

## 节点与探测

1. 在 VPS 安装并配置 3x-ui，确认面板 API 可访问。
2. 管理后台添加 3x-ui 节点。
3. 保存后 J-Board 会登录 3x-ui 并同步入站。
4. 在代理套餐中绑定已同步入站。
5. 如需前台展示延迟/线路，点击“生成探测 Token”，复制弹窗里的一键安装命令到节点执行。

探测程序也可手动运行：

```bash
SERVER_URL=https://your-domain.com \
AUTH_TOKEN=后台生成的探测Token \
./jboard-agent
```

可选变量：

- `LATENCY_INTERVAL`：默认 `5m`
- `TRACE_INTERVAL`：默认 `30m`

路由探测依赖 `nexttrace`。没有该命令时，延迟探测仍可运行，路由探测会记录错误日志。

## 备份与安全

下载 SQL 备份：

```bash
docker compose exec -T db pg_dump -U jboard jboard > backup_$(date +%Y%m%d_%H%M%S).sql
```

后台也可通过 `/admin/backups` 导出或恢复数据库。恢复前务必先保存当前数据库备份。

安全建议：

- 不要提交 `.env`、探测 Token、3x-ui 密码、支付密钥
- 生产环境不要公开 PostgreSQL 和 Redis 端口
- 3x-ui 面板建议限制来源 IP 或使用反向代理鉴权
- `ENCRYPTION_KEY` 一旦生产使用不要随意更换，否则已加密数据会无法解密

## 开发原则

- 节点入站与客户端运行配置以 3x-ui 为准，J-Board 只保存售卖镜像
- 后端只保留探测上报接口，不再新增节点控制面接口
- Server Actions 负责权限、校验、审计和缓存刷新
- Route Handlers 仅用于外部 HTTP 接口或文件下载
- 重要副作用必须记录审计日志或任务记录

## 文档

- `docs/API.md`：HTTP 接口与 Server Actions 参考
- `docs/openapi.yaml`：对外 HTTP 接口的 OpenAPI 3.1 描述
- `agent/jboard-agent/README.md`：探测程序说明

## 请我喝杯咖啡
![JsPYre9xe7W1Ad6mwPgrfuXBYJ8iy6oC.webp](https://cdn.nodeimage.com/i/XuxZ7NoLsc51fS99S6AtMB9K9ekTTQcD.webp)

USDT-TRC20: TQfaGEBdnB89V4y6R6bypZXx7Za5QfXBCi

Telegram：[@JetSprow](https://t.me/JetSprow)
