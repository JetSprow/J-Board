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

以 `.env.example` 为准。生产部署推荐直接使用一键脚本生成 `.env`，手动配置时请重点确认这些值：

| 变量 | 用途 | 说明 |
| --- | --- | --- |
| `APP_PORT` | 面板监听端口 | 默认 `3000`。反向代理应转发到 `http://127.0.0.1:APP_PORT`。 |
| `SITE_NAME` | 站点名称 | 初始化系统设置和邮件模板会使用。 |
| `NEXTAUTH_URL` | 网站访问地址 | 必须填写你准备反代到面板的正式域名，例如 `https://panel.example.com`。不要填容器内地址。 |
| `SUBSCRIPTION_URL` | 订阅访问地址 | 可选。用于生成客户端订阅链接，例如 `https://sub.example.com`；留空时复用 `NEXTAUTH_URL`。如果使用独立订阅域名，也要反代到同一个面板服务。 |
| `NEXTAUTH_SECRET` | 登录会话密钥 | 生产环境必须使用随机长字符串。 |
| `ENCRYPTION_KEY` | 敏感信息加密密钥 | 至少 32 字节。生产使用后不要更换，否则 3x-ui 密码、探测 Token、流媒体凭据等已加密数据会无法解密。 |
| `DATABASE_URL` | PostgreSQL 连接 | 本地工具使用；Docker 部署时 Compose 会覆盖为容器内数据库地址。 |
| `POSTGRES_PASSWORD` | Docker PostgreSQL 密码 | 一键脚本会自动生成。 |
| `REDIS_URL` | Redis 连接 | 本地工具使用；Docker 部署时 Compose 会覆盖为容器内 Redis 地址。 |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` / `ADMIN_NAME` | 初始管理员 | 首次 `db:seed` 创建管理员账号。已有数据库不会强制重置旧管理员密码。 |

SMTP 邮件服务、注册邮箱验证开关、支付方式、3x-ui 节点等业务配置都在管理后台填写，不建议写进 `.env`。

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

## 部署

### 一键部署（推荐）

适合全新的 Linux 服务器。脚本会自动安装 Docker 与 Compose 插件，拉取代码，询问并生成 `.env`，初始化数据库，启动面板，最后输出访问地址、反代目标和管理员账号。

```bash
curl -fsSL https://raw.githubusercontent.com/JetSprow/J-Board/main/scripts/install-jboard-panel.sh | bash
```

脚本会询问这些信息；直接回车即可使用默认值或自动生成值：

| 提示项 | 含义 |
| --- | --- |
| 安装目录 | 默认 `/opt/jboard`；如果在仓库内运行脚本则默认当前仓库。 |
| 站点名称 | 面板标题、邮件模板和初始化系统设置会使用。 |
| 网站访问地址 | 你准备反向代理到本机 `3000` 端口的面板域名，例如 `https://panel.example.com`。没有域名时可先用 `http://服务器IP:3000` 测试。 |
| 订阅访问地址 | 用于生成 Clash/V2rayN/Shadowrocket 等客户端订阅链接。可与网站访问地址相同，也可填独立订阅域名，例如 `https://sub.example.com`。 |
| 本机监听端口 | 默认 `3000`，Nginx/Caddy/宝塔反代目标就是 `http://127.0.0.1:3000`。 |
| 管理员邮箱和密码 | 首次初始化会创建该管理员，脚本完成后会再次打印。 |
| PostgreSQL 密码、`NEXTAUTH_SECRET`、`ENCRYPTION_KEY` | 可手动输入；回车会自动生成安全值。 |

也可以用环境变量覆盖默认行为：

```bash
APP_DIR=/opt/jboard GH_REPO=JetSprow/J-Board BRANCH=main bash <(curl -fsSL https://raw.githubusercontent.com/JetSprow/J-Board/main/scripts/install-jboard-panel.sh)
```

脚本完成后，你会看到类似信息：

```text
访问地址：https://panel.example.com
订阅地址：https://sub.example.com
反代目标：http://127.0.0.1:3000
管理员邮箱：admin@example.com
管理员密码：自动生成或你输入的密码
```

### 反向代理

`NEXTAUTH_URL` 和后台“系统设置 -> 网站 URL”都应该填写面板公网域名，也就是你准备给用户访问、并反向代理到 J-Board 的域名。不要填写 `localhost`、容器名或内网地址。

`SUBSCRIPTION_URL` 和后台“系统设置 -> 订阅 URL”只用于生成客户端订阅链接。它可以和网站 URL 相同；如果你想单独做 Cloudflare/WAF/访问风控，建议使用 `https://sub.example.com` 这类独立域名，并把它也反向代理到同一个 J-Board 服务。独立订阅域名只需要承载 `/api/subscription/*`，后续可以在反代或 WAF 层对其他路径返回 404。

Nginx 示例：

```nginx
server {
  listen 80;
  server_name panel.example.com sub.example.com;

  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
  }
}
```

正式上线建议再用 Certbot、宝塔、1Panel、Caddy 或 CDN 申请 HTTPS 证书，然后把 `NEXTAUTH_URL` 改为 `https://panel.example.com`。如果单独使用订阅域名，把 `SUBSCRIPTION_URL` 或后台订阅 URL 改为 `https://sub.example.com`。

订阅域名套 Cloudflare 时，源站应只允许 Cloudflare 回源或通过 Cloudflare Tunnel 暴露服务，并正确传递 `CF-Connecting-IP` / `X-Forwarded-For`。否则后续订阅访问风控中的真实 IP 可能被直连源站请求伪造。

J-Board 会记录订阅 API 的真实 IP、User-Agent 和可用的地理位置头，并按后台“系统设置 -> 订阅访问风控”配置执行限流、跨城市/省份告警与自动暂停。默认规则保持为：24 小时内 4 个城市警告、5 个城市暂停；2 个省/地区警告、3 个省/地区暂停；2 个国家/地区警告、3 个国家/地区暂停；IP 180 次/小时、订阅 60 次/小时。管理员可以关闭风控总控，或关闭自动暂停改为只记录警告；也可以在后台“订阅风控”查看关联用户、订阅、IP、地区统计，并将事件标记为待处理、已确认或已解决，必要时可人工恢复被暂停的订阅。项目内置 `data/GeoLite2-City.mmdb` 作为本地 GeoIP 城市库，默认通过 `GEOIP_MMDB_PATH=data/GeoLite2-City.mmdb` 读取；如果反代或 CDN 已传地理位置头，系统优先使用请求头，并用 MMDB 补齐缺失字段。Cloudflare 场景建议在 Rules -> Settings -> Managed Transforms 开启 Add visitor location headers，让回源请求带上 `cf-ipcity`、`cf-region`、`cf-region-code` 等字段；未提供城市/省份字段且 MMDB 不可用时，系统只记录 IP，不会触发地区变化规则。

### 手动 Docker 部署

首次启动：

```bash
cp .env.example .env
# 编辑 .env，尤其是 NEXTAUTH_URL、SUBSCRIPTION_URL、NEXTAUTH_SECRET、ENCRYPTION_KEY、POSTGRES_PASSWORD、管理员账号
docker compose build init app
docker compose --profile setup run --rm init
docker compose up -d app
```

更新部署：

```bash
git pull --ff-only
docker compose build init app
docker compose --profile setup run --rm init sh -lc 'npm run db:push'
docker compose up -d app
```

仓库内也提供更新脚本：

```bash
./scripts/upgrade-jboard-panel.sh
```

常用排障：

- 查看状态：`docker compose ps`
- 查看日志：`docker compose logs -f app`
- 页面仍是旧版本：确认已执行 `docker compose build init app` 和 `docker compose up -d app`
- Schema 没有生效：单独运行 `docker compose --profile setup run --rm init sh -lc 'npm run db:push'`
- 登录回调、邮件链接或支付回跳出现 `localhost`：检查 `.env` 里的 `NEXTAUTH_URL` 和后台系统设置里的网站 URL。
- 订阅链接仍然使用主站域名：检查 `.env` 里的 `SUBSCRIPTION_URL` 或后台系统设置里的订阅 URL；后台配置优先于环境变量。

### 部署后检查清单

1. 登录 `/admin`，进入“系统设置”，确认网站 URL 是面板反代域名，订阅 URL 是你准备给客户端拉取订阅的域名。
2. 配置 SMTP 邮件服务并点击“测试”，再按需要开启注册邮箱验证。
3. 进入“支付配置”，填写并启用至少一种支付方式。
4. 添加 3x-ui 节点，测试连接并同步入站。
5. 创建套餐，绑定入站或流媒体服务。
6. 用普通用户注册、下单、支付、查看订阅，走一遍完整流程。

可以展示给用户的常用入口：

- 登录：`https://你的域名/login`
- 注册：`https://你的域名/register`
- 套餐商店：`https://你的域名/store`
- 用户中心：`https://你的域名/dashboard`
- 订阅列表：`https://你的域名/subscriptions`

## 支付配置

支付配置在后台 `/admin/payments` 完成，密钥会保存在数据库中，不写入 `.env`，也不要提交到仓库或截图外传。创建订单时，系统会根据用户选择的支付方式生成支付链接、二维码或链上收款信息；支付成功后进入 `src/services/payment/process.ts` 完成订单确认和订阅开通。

| 支付方式 | 适用场景 | 必填信息 | 回调 / 查询说明 |
| --- | --- | --- | --- |
| 易支付 | 第三方聚合支付，常用于支付宝/微信通道 | API 地址、商户 ID、商户密钥、启用渠道 | 通知地址为 `https://你的域名/api/payment/notify/epay`。支持 `alipay`、`wxpay` 渠道。 |
| 支付宝当面付 | 支付宝官方扫码支付 | App ID、应用私钥、支付宝公钥、网关地址 | 通知地址为 `https://你的域名/api/payment/notify/alipay_f2f`，也支持订单查询兜底。 |
| USDT TRC20 | 加密货币收款 | TRC20 钱包地址、汇率，可选 TronGrid API Key | 没有传统回调，系统按订单金额查询近期 TRC20 入账。建议配置 TronGrid API Key 提高稳定性。 |

支付上线前建议：

- 在支付平台后台把通知域名、回跳域名、应用网关白名单都设置为你的公网域名。
- 先创建低金额测试套餐，确认“创建订单 -> 支付 -> 回调/查询 -> 自动开通订阅”完整可用。
- 易支付的 API 地址不要带尾部路径，例如填 `https://pay.example.com`，系统会自动请求 `/mapi.php`、`/submit.php` 和 `/api.php`。
- 支付宝密钥可以填写纯 key 内容或 PEM 格式；系统会自动补 PEM 包装。
- USDT TRC20 按金额匹配入账，测试时避免短时间出现多笔完全相同金额。

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
- 数据库备份里包含用户、订单和支付配置，建议加密保存并限制下载权限
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
