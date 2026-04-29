# J-Board

J-Board（也称 JB 面板）是一个面向代理订阅售卖与流媒体共享的全栈管理面板。它负责用户、套餐、订单、支付、订阅、工单、邮件、公告、审计、探测展示与订阅风控；节点实际运行、入站协议、Xray 客户端配置仍由 3x-ui 维护。

J-Board 的定位很明确：它不是新的节点控制面，也不替代 3x-ui。它把售卖、开通、订阅交付、售后和风险审查做成一个完整面板，并通过只读 Agent 从节点侧采集延迟、路由和 Xray access log 证据。

开发进度频道：[@JBoardAnno](https://t.me/JBoardAnno)

## 快速认识

```text
用户浏览器 / 客户端订阅
  ↓
Next.js App Router 面板
  ├─ SQLite：用户、订单、套餐、订阅、审计、风控事件
  ├─ 进程内限流：无需 Redis 单独容器
  ├─ 3x-ui API：同步入站、开通/暂停/删除代理客户端
  └─ Agent API：接收 jboard-agent 上报的延迟、路由、节点真实连接日志

节点 VPS
  ├─ 3x-ui / Xray：真实入站、客户端、流量限制与代理运行
  └─ jboard-agent：旁路只读探测与日志聚合，不修改 3x-ui 配置
```

J-Board 只保存售卖和展示需要的节点镜像数据。入站协议、端口、Reality/TLS、Xray 运行状态和客户端真实配置仍以 3x-ui 为准。

## 功能概览

用户端：

- 注册、登录、邮箱验证、忘记密码、邮箱变更验证。
- 支持 Cloudflare Turnstile 人机验证。
- 代理套餐和流媒体套餐购买、续费、增流量。
- 购物车、订单、支付状态查询和支付方式切换。
- 代理订阅查看、订阅链接下载、订阅访问重置。
- 线路体验展示：三网延迟、延迟历史、三网路由追踪。
- 流媒体订阅凭据展示。
- 通知中心、工单售后、账号资料、邀请码。
- 暗色/夜间模式和移动端适配。

管理端：

- 3x-ui 节点管理：保存面板地址、账号、密码，测试连接并同步入站。
- 本地入站展示名维护，套餐绑定同步后的入站线路。
- 探测 Token 管理：用于 Agent 上报延迟、路由和节点日志。
- 用户、订单、套餐、订阅、流媒体服务、支付配置。
- SMTP 邮件服务设置、注册邮箱验证开关、邮件模板发送。
- 公告、工单、系统设置、审计日志、任务中心、备份恢复。
- 支持工单上限配置，默认每个用户最多开启 2 个未关闭工单。
- 流量视图：基于本地订阅与 3x-ui 同步结果展示客户端用量。
- 订阅访问风控：IP、城市、省/地区、国家变化审查。
- 节点日志风控：基于 Xray access log 分析真实来源 IP、连接数、不同目标数。
- 风控人工处理：查看用户、订阅、地图、IP、分析日志，生成风险报告，选择解除限制或保持封禁/暂停。

节点侧：

- 3x-ui 负责入站、客户端、协议配置和节点运行。
- J-Board 通过 3x-ui API 同步入站并执行客户端增删改。
- `agent/jboard-agent` 负责三网 TCP 延迟、三网路由追踪和可选 Xray access log 风控上报。
- Agent 只读日志文件，不重启 Xray，不修改 3x-ui 配置。

## 版本与发布规则

J-Board 面板和 Agent 使用相对独立的版本节奏。

- 面板代码变更可以只提交到 `main`，不一定创建 GitHub Release。
- Agent 二进制发生变化时，才需要升级 Agent 版本、打 tag、创建 Release，并上传 `jboard-agent-linux-amd64`、`jboard-agent-linux-arm64`、`SHA256SUMS`。
- Agent 安装/升级脚本默认下载 GitHub 最新 Release 中的 Agent 产物。
- 不要为了普通网站页面或后台文案改动强行更新 Agent tag。

当前项目版本写在 `package.json`，Agent 运行时版本写在 `agent/jboard-agent/cmd/agent/main.go`，Agent 构建版本写在 `agent/jboard-agent/Makefile`。

## 技术栈

- Next.js 16 App Router + React 19
- Prisma 7 + SQLite
- NextAuth 4 Credentials
- Tailwind CSS 4 + Base UI + Sonner + Recharts
- Nodemailer SMTP 邮件
- MaxMind MMDB GeoIP
- Go jboard-agent
- Docker / Docker Compose

注意：本项目使用的 Next.js 版本包含和旧版本不同的约定。开发前请阅读 `AGENTS.md`，并按 `node_modules/next/dist/docs/` 中的当前文档实现。

## 目录结构

| 路径 | 说明 |
| --- | --- |
| `src/app` | 页面、布局、Route Handlers。 |
| `src/actions` | Server Actions，负责写操作、权限校验、审计和缓存刷新。 |
| `src/services` | 领域服务与第三方适配。 |
| `src/services/node-panel` | 3x-ui 面板适配层。 |
| `src/services/provision.ts` | 支付成功后的订阅开通与 3x-ui 客户端同步。 |
| `src/services/subscription-risk.ts` | 订阅访问与节点日志风控判定。 |
| `src/services/subscription-risk-review.ts` | 风控事件证据整理、报告生成辅助。 |
| `src/lib` | Prisma、鉴权、加密、Turnstile、GeoIP、工具函数。 |
| `prisma/schema.prisma` | 数据模型事实源。 |
| `data/GeoLite2-City.mmdb` | 默认 GeoIP 城市库。 |
| `agent/jboard-agent` | Go Agent 源码、构建脚本和 Agent 文档。 |
| `scripts/install-jboard-panel.sh` | 面板一键安装向导。 |
| `scripts/upgrade-jboard-panel.sh` | 面板升级脚本。 |
| `scripts/install-jboard-agent.sh` | Agent 安装脚本。 |
| `scripts/upgrade-jboard-agent.sh` | Agent 升级脚本。 |
| `docs/API.md` | HTTP 接口与 Server Actions 参考。 |
| `docs/openapi.yaml` | 对外 HTTP 接口 OpenAPI 描述。 |

## 环境变量

以 `.env.example` 为准。生产部署推荐使用一键脚本生成 `.env`，手动配置时重点确认下列变量。

| 变量 | 用途 | 说明 |
| --- | --- | --- |
| `APP_PORT` | 面板监听端口 | 默认 `3000`。反向代理应转发到 `http://127.0.0.1:APP_PORT`。 |
| `SITE_NAME` | 站点名称 | 初始化系统设置和邮件模板会使用。 |
| `NEXTAUTH_URL` | 网站访问地址 | 必须填写准备反代到面板的正式域名，例如 `https://panel.example.com`。不要填 `localhost`、容器名或内网地址。 |
| `SUBSCRIPTION_URL` | 订阅访问地址 | 可选。用于生成客户端订阅链接，例如 `https://sub.example.com`；留空时复用 `NEXTAUTH_URL`。 |
| `NEXTAUTH_SECRET` | 登录会话密钥 | 生产环境必须使用随机长字符串。 |
| `ENCRYPTION_KEY` | 敏感信息加密密钥 | 至少 32 字节。生产使用后不要更换，否则 3x-ui 密码、探测 Token、SMTP 密码、流媒体凭据等已加密数据会无法解密。 |
| `DATABASE_URL` | SQLite 文件地址 | 本地默认 `file:./storage/jboard.db`；Docker 部署时 Compose 会覆盖为容器内 `/app/storage/jboard.db`。 |
| `GEOIP_MMDB_PATH` | GeoIP 城市库 | 默认 `data/GeoLite2-City.mmdb`。可换成自己的 MaxMind City MMDB。 |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` / `ADMIN_NAME` | 初始管理员 | 首次 `db:seed` 创建管理员账号。已有数据库不会强制重置旧管理员密码。 |

SMTP 邮件服务、注册邮箱验证开关、支付方式、3x-ui 节点等业务配置在管理后台填写，不建议写进 `.env`。

## 一键部署

适合全新 Linux 服务器。脚本会安装基础依赖、安装 Docker 与 Compose 插件、拉取代码、生成 `.env`、初始化数据库并启动面板。

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/JetSprow/J-Board/lite/scripts/install-jboard-panel.sh)
```

安装和更新脚本会自动检测 CPU、宿主机内存、Docker 可用内存和 Docker 数据盘空间。常规机器使用 Docker 默认构建策略；1C、低于 2GB 内存或 Docker 可用空间低于 8GB 的小机器会自动进入低资源模式，降低 Compose 并发、npm 编译并发和 Next 构建堆内存，并把镜像分步构建，构建会更慢但峰值占用更低。

脚本会交互询问：

| 问题 | 如何填写 |
| --- | --- |
| 安装目录 | 默认 `/opt/jboard`；如果在仓库内运行脚本则默认当前仓库。 |
| 站点名称 | 面板标题、邮件模板和初始化系统设置会使用。 |
| 网站访问地址 | 你准备反向代理到本机 `3000` 端口的面板域名，例如 `https://panel.example.com`。没有域名时可先用 `http://服务器IP:3000` 测试。 |
| 订阅访问地址 | 用于生成 Clash/V2rayN/Shadowrocket 等客户端订阅链接。可以和网站地址相同，也可以填独立订阅域名，例如 `https://sub.example.com`。 |
| 本机监听端口 | 默认 `3000`。Nginx、Caddy、宝塔或 1Panel 的反代目标就是 `http://127.0.0.1:3000`。 |
| 管理员邮箱和密码 | 首次初始化会创建该管理员，脚本完成后会再次打印。 |
| `NEXTAUTH_SECRET`、`ENCRYPTION_KEY` | 可手动输入；回车会自动生成安全值。 |

也可以通过环境变量覆盖默认行为：

```bash
APP_DIR=/opt/jboard GH_REPO=JetSprow/J-Board BRANCH=lite bash <(curl -fsSL https://raw.githubusercontent.com/JetSprow/J-Board/lite/scripts/install-jboard-panel.sh)
```

构建资源策略也可以手动覆盖：

```bash
# 自动判断，默认值
JBOARD_BUILD_PROFILE=auto ./scripts/upgrade-jboard-panel.sh

# 强制低资源慢速构建
JBOARD_BUILD_PROFILE=low ./scripts/upgrade-jboard-panel.sh

# 强制常规构建，不额外限制并发或 Node heap
JBOARD_BUILD_PROFILE=normal ./scripts/upgrade-jboard-panel.sh
```

脚本完成后会输出：

```text
访问地址：https://panel.example.com
订阅地址：https://sub.example.com
反代目标：http://127.0.0.1:3000
管理员邮箱：admin@example.com
管理员密码：自动生成或你输入的密码
```

请把管理员密码保存到密码管理器。已有数据库重复部署时，脚本会尽量沿用现有配置，不会随意重置管理员。

## 手动 Docker 部署

首次启动：

```bash
cp .env.example .env
# 编辑 .env，尤其是 NEXTAUTH_URL、SUBSCRIPTION_URL、NEXTAUTH_SECRET、ENCRYPTION_KEY、管理员账号
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

更新脚本同样会自动判断机器配置，并在更新前备份 SQLite 数据库到 `backups/`。

常用排障：

```bash
docker compose ps
docker compose logs -f app
docker compose --profile setup run --rm init sh -lc 'npm run db:push'
```

如果页面仍是旧版本，确认已执行 `docker compose build init app` 和 `docker compose up -d app`。如果 schema 没生效，单独运行 `npm run db:push` 对应的 setup 命令。

## 反向代理与域名

`NEXTAUTH_URL` 和后台“系统设置 -> 网站 URL”都应该填写面板公网域名，也就是给用户访问、并反向代理到 J-Board 的域名。不要填写 `localhost`、容器名或内网地址，否则登录回调、邮件链接、支付回跳和退出登录提示可能出现错误地址。

`SUBSCRIPTION_URL` 和后台“系统设置 -> 订阅 URL”只用于生成客户端订阅链接。它可以和网站 URL 相同；如果希望单独做 Cloudflare/WAF/访问风控，建议使用独立订阅域名，例如 `https://sub.example.com`，并把它也反向代理到同一个 J-Board 服务。

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

正式上线建议使用 Certbot、宝塔、1Panel、Caddy 或 CDN 配置 HTTPS。订阅域名套 Cloudflare 时，源站建议只允许 Cloudflare 回源或通过 Cloudflare Tunnel 暴露，并正确传递 `CF-Connecting-IP` / `X-Forwarded-For`。如果源站允许绕过 Cloudflare 直连，订阅访问风控中的真实 IP 可能被伪造。

## 后台初始化清单

1. 登录 `/admin`，进入“系统设置”，确认网站 URL 和订阅 URL。
2. 配置 SMTP 邮件服务并点击“测试发信”。
3. 按需要开启注册邮箱验证。忘记密码和邮箱变更也会使用 SMTP。
4. 进入“支付配置”，填写并启用至少一种支付方式。
5. 添加 3x-ui 节点，测试连接并同步入站。
6. 创建代理套餐，绑定入站；或创建流媒体服务和套餐。
7. 在节点页生成探测 Token，安装 Agent。
8. 用普通用户注册、下单、支付、查看订阅，走一遍完整流程。
9. 进入“订阅风控”，确认地图、IP、分析日志、人工操作按钮都能正常展示。

可以展示给用户的常用入口：

- 登录：`https://你的域名/login`
- 注册：`https://你的域名/register`
- 套餐商店：`https://你的域名/store`
- 用户中心：`https://你的域名/dashboard`
- 订阅列表：`https://你的域名/subscriptions`
- 工单中心：`https://你的域名/support`

## 邮件与邮箱验证

SMTP 配置在后台“系统设置”中完成，密码会加密保存在数据库中。支持的邮件场景包括：

- 注册邮箱验证，可由管理员开启或关闭。
- 忘记密码重置链接。
- 修改邮箱验证。
- 管理员测试发信。
- 风控报告发送和通知辅助。

建议使用专用发信邮箱或应用专用密码。Gmail、企业邮箱和大多数 SMTP 服务都可以使用 `host + port + user + password + from` 的方式接入。生产环境请优先使用 587 STARTTLS 或服务商推荐端口。

## 支付配置

支付配置在后台 `/admin/payments` 完成，密钥会加密保存在数据库中，不写入 `.env`，也不要提交到仓库或截图外传。创建订单时，系统会根据用户选择的支付方式生成支付链接、二维码或链上收款信息；支付成功后进入 `src/services/payment/process.ts` 完成订单确认和订阅开通。

| 支付方式 | 适用场景 | 必填信息 | 回调 / 查询说明 |
| --- | --- | --- | --- |
| 易支付 | 第三方聚合支付，常用于支付宝/微信通道 | API 地址、商户 ID、商户密钥、启用渠道 | 通知地址为 `https://你的域名/api/payment/notify/epay`。支持 `alipay`、`wxpay` 渠道。 |
| 支付宝当面付 | 支付宝官方扫码支付 | App ID、应用私钥、支付宝公钥、网关地址 | 通知地址为 `https://你的域名/api/payment/notify/alipay_f2f`，也支持订单查询兜底。 |
| USDT TRC20 | 加密货币收款 | TRC20 钱包地址、汇率，可选 TronGrid API Key | 没有传统回调，系统按订单金额查询近期 TRC20 入账。建议配置 TronGrid API Key 提高稳定性。 |

支付上线前建议：

- 在支付平台后台把通知域名、回跳域名、应用网关白名单设置为公网域名。
- 先创建低金额测试套餐，确认“创建订单 -> 支付 -> 回调/查询 -> 自动开通订阅”完整可用。
- 易支付 API 地址不要带尾部路径，例如填 `https://pay.example.com`，系统会自动请求 `/mapi.php`、`/submit.php` 和 `/api.php`。
- 支付宝密钥可以填写纯 key 内容或 PEM 格式；系统会自动补 PEM 包装。
- USDT TRC20 按金额匹配入账，测试时避免短时间出现多笔完全相同金额。

## 节点、3x-ui 与 Agent

节点接入流程：

1. 在 VPS 安装并配置 3x-ui，确认面板 API 可访问。
2. 在 3x-ui 中创建真实入站。
3. 管理后台添加 3x-ui 节点，填写面板地址、用户名和密码。
4. 保存后 J-Board 会登录 3x-ui 并同步入站到 `NodeInbound`。
5. 在代理套餐中绑定已同步入站。
6. 用户购买代理套餐后，J-Board 调用 3x-ui API 创建客户端，并保存 `NodeClient`。
7. 订阅暂停、恢复、删除、重置访问时，同步调用 3x-ui API 更新客户端。
8. 如需前台展示延迟、线路和节点日志风控，点击“生成探测 Token”，复制一键安装命令到节点执行。

Agent 安装脚本会：

- 下载 GitHub Release 中对应架构的 Agent 二进制。
- 安装或复用 `nexttrace`。
- 自动查找 `/usr/local/x-ui/access.log` 等常见 Xray access log 路径。
- 创建 `/var/lib/jboard-agent` 和 `/var/log/jboard`。
- 尝试让 Agent 具有 access log 读取权限。
- 写入 `/etc/jboard-agent.env`。
- 停用并移除旧的 Agent systemd 服务，避免冲突。
- 写入并启动 `jboard-agent.service`。

节点机常用命令：

```bash
systemctl status jboard-agent --no-pager -l
journalctl -u jboard-agent -n 100 --no-pager
journalctl -u jboard-agent -f --no-pager
journalctl -u jboard-agent -f --no-pager | grep --line-buffered xray-log
cat /etc/jboard-agent.env
cat /var/lib/jboard-agent/xray-log-state.json
```

升级 Agent：

```bash
curl -fsSL https://raw.githubusercontent.com/JetSprow/J-Board/main/scripts/upgrade-jboard-agent.sh | bash
```

如果只想手动运行 Agent：

```bash
SERVER_URL=https://your-domain.com \
AUTH_TOKEN=后台生成的探测Token \
./jboard-agent
```

更多 Agent 说明见 `agent/jboard-agent/README.md`。

## 订阅访问风控

J-Board 的订阅风控分两层。

第一层是订阅 API 访问风控。用户或客户端拉取 `/api/subscription/*` 时，系统记录真实 IP、User-Agent、国家、省/地区、城市、经纬度，并按后台配置判断：

- 单 IP 每小时访问次数。
- 单订阅 token 每小时访问次数。
- 24 小时窗口内不同城市数量。
- 24 小时窗口内不同省/地区数量。
- 24 小时窗口内不同国家/地区数量。

第二层是节点真实连接风控。Agent 读取 Xray access log，将日志里的 `email: user@example.com-xxxx` 匹配到本地 `NodeClient.email`，再归属到用户和订阅。系统记录：

- 真实来源 IP。
- 真实来源 IP 的 GeoIP。
- 入站 tag。
- tcp/udp。
- 样本目标域名或 IP。
- 目标端口。
- 聚合窗口内连接数。
- 聚合窗口内不同目标数。
- 首次和最近连接时间。

管理员可在“系统设置 -> 订阅访问风控”中配置总开关、自动暂停开关、窗口时长、城市/省/国家阈值、IP/订阅访问频率阈值，以及节点日志风控中的连接数和不同目标数阈值。

默认规则保持为：

- 24 小时内 4 个城市警告，5 个城市暂停。
- 2 个省/地区警告，3 个省/地区暂停。
- 2 个国家/地区警告，3 个国家/地区暂停。
- IP 180 次/小时，订阅 60 次/小时。
- 节点日志风控默认开启，连接数和不同目标数按 Agent 单次聚合窗口计算。

风控事件会进入后台“订阅风控”。管理员可以：

- 查看关联用户和订阅详情。
- 查看 IP、国家、省/地区、城市统计。
- 在世界地图上查看可识别坐标点。
- 展开分析日志，看到每条证据的 IP、时间、来源、Xray 解析详情、连接数和不同目标数。
- 生成风险报告。
- 选择是否发送到用户端。
- 解除限制或保持封禁/暂停。

用户收到管理员发送的风险报告后，会看到全屏不可关闭的限制通知，只能新建工单联系客服，不能继续进行其他用户端操作。

## GeoIP 与 Cloudflare

项目内置 `data/GeoLite2-City.mmdb` 作为本地 GeoIP 城市库，默认通过 `GEOIP_MMDB_PATH=data/GeoLite2-City.mmdb` 读取。系统会优先使用反向代理或 CDN 提供的地理位置头，并用 MMDB 补齐缺失字段。

Cloudflare 场景建议在 Rules -> Settings -> Managed Transforms 开启 Add visitor location headers，让回源请求带上 `cf-ipcity`、`cf-region`、`cf-region-code` 等字段。未提供城市/省份字段且 MMDB 不可用时，系统只记录 IP，不会触发地区变化规则。

如果网站域名和订阅域名相同，系统只统计订阅 API 访问，不会把普通网站浏览计入订阅风控。

## 备份与恢复

下载 SQLite 备份：

```bash
docker compose exec -T app sh -lc 'cd /app/storage && set -- jboard.db; [ -f jboard.db-wal ] && set -- "$@" jboard.db-wal; [ -f jboard.db-shm ] && set -- "$@" jboard.db-shm; tar -czf - "$@"' > backup_$(date +%Y%m%d_%H%M%S).tar.gz
```

后台也可通过 `/admin/backups` 导出或恢复数据库。恢复前务必先保存当前数据库备份。

建议：

- 定期备份 SQLite volume 或通过后台导出数据库。
- 将备份加密保存。
- 备份恢复后立即检查管理员登录、支付配置、节点密码、SMTP、订阅 URL 和 Agent 上报。

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

- 修改 `prisma/schema.prisma` 后运行 `npm run db:push`。
- 生产 Docker 部署更新后，运行 `docker compose --profile setup run --rm init sh -lc 'npm run db:push'`。
- 当前项目使用 `prisma db push --accept-data-loss`，上线前请确认 schema 变更不会误删重要数据。

Agent 开发：

```bash
cd agent/jboard-agent
go test ./...
make build-linux
shasum -a 256 jboard-agent-linux-amd64 jboard-agent-linux-arm64 > SHA256SUMS
```

## 安全建议

- 不要提交 `.env`、探测 Token、3x-ui 密码、SMTP 密码、支付密钥。
- 数据库备份包含用户、订单、支付配置、节点凭据和邮件配置，建议加密保存并限制下载权限。
- 生产环境不要公开 SQLite 文件、备份文件或管理接口。
- 3x-ui 面板建议限制来源 IP 或使用反向代理鉴权。
- `ENCRYPTION_KEY` 一旦生产使用不要随意更换。
- 管理后台账号建议使用强密码和专用邮箱。
- 订阅域名套 CDN 时应避免源站裸露，否则真实 IP 风控可信度会下降。
- Agent 只读 Xray access log，但日志中包含用户 IP、访问目标和 client email，应按敏感数据处理。

## 常见问题

### 登录、退出或邮件链接出现 localhost

检查 `.env` 中的 `NEXTAUTH_URL` 和后台系统设置中的网站 URL。后台配置优先于环境变量。生产环境必须填写公网域名。

### 订阅链接使用了错误域名

检查 `.env` 中的 `SUBSCRIPTION_URL` 和后台系统设置中的订阅 URL。后台配置优先于环境变量。

### 点击测试发信报错

先确认 SMTP 是否启用、Host/Port/User/Password/From 是否正确。Gmail 等服务通常需要应用专用密码。生产环境隐藏原始异常时，可查看 `docker compose logs -f app`。

### 用户不验证邮箱也能注册

确认后台“注册邮箱验证”已经开启，并检查 SMTP 是否启用。邮箱验证开启后，新用户会进入待验证状态，必须通过邮件链接激活。

### Agent 没有 xray-log 输出

先看 Agent 是否运行：

```bash
systemctl status jboard-agent --no-pager -l
journalctl -u jboard-agent -n 100 --no-pager
```

再确认 access log 状态：

```bash
cat /etc/jboard-agent.env | grep XRAY
cat /var/lib/jboard-agent/xray-log-state.json
tail -n 50 /usr/local/x-ui/access.log
grep "email:" /usr/local/x-ui/access.log | tail -n 20
```

Agent 默认 `XRAY_LOG_START_AT_END=1`，首次启动会从文件末尾开始，只分析启动后的新连接。需要真实客户端连接节点并产生带 `email:` 的 access log，后台才会出现节点真实连接分析。

### Xray client email 带后缀是否有影响

没有影响。J-Board 用户邮箱可能是 `user@example.com`，Xray client email 可能是 `user@example.com-cmojtnp3`。节点日志风控用 Xray access log 里的 client email 匹配本地 `NodeClient.email`，再找到真实用户和订阅。不要手动在 3x-ui 改 client email，否则会导致日志无法归属。

## 文档

- `docs/API.md`：HTTP 接口与 Server Actions 参考。
- `docs/openapi.yaml`：对外 HTTP 接口 OpenAPI 3.1 描述。
- `agent/jboard-agent/README.md`：Agent 安装、升级、日志与排障说明。
- `AGENTS.md`：给代码协作 Agent 的仓库规则。

## 请我喝杯咖啡

![JsPYre9xe7W1Ad6mwPgrfuXBYJ8iy6oC.webp](https://cdn.nodeimage.com/i/XuxZ7NoLsc51fS99S6AtMB9K9ekTTQcD.webp)

USDT-TRC20: TQfaGEBdnB89V4y6R6bypZXx7Za5QfXBCi

Telegram：[@JetSprow](https://t.me/JetSprow)
