# jboard-agent

`jboard-agent` 是 J-Board Lite 的节点侧旁路程序。它运行在节点 VPS 上，负责把节点体验和节点真实连接证据上报到 J-Board Lite。

它做三件事：

- 三网 TCP 延迟探测：`POST /api/agent/latency`
- 三网路由追踪：`POST /api/agent/trace`
- Xray access log 聚合：`POST /api/agent/node-access`

它不做这些事：

- 不创建、删除或修改 3x-ui 入站。
- 不创建、删除或修改 Xray 客户端。
- 不重启 3x-ui 或 Xray。
- 不接管节点流量。
- 不作为公共代理或透明代理。

节点入站、客户端开通、暂停、删除、流量限制等配置均由 3x-ui 面板维护。Agent 只读日志文件，并通过 J-Board Lite 的 Agent Token 上报结果。

## 工作方式

```text
jboard-agent
  ├─ LatencyLoop：定时 TCP connect 三网目标
  ├─ TraceLoop：定时调用 nexttrace 获取三网路由
  └─ XrayAccessLogLoop：读取 Xray access log，聚合真实来源 IP、连接数和不同目标数
       ↓
J-Board Lite /api/agent/*
       ↓
后台节点体验、订阅风控、分析日志、风险报告
```

Agent 使用 `AUTH_TOKEN` 认证。这个 token 在 J-Board Lite 后台节点页生成，服务端会通过它匹配到具体 `NodeServer`。

## 安装

推荐在 J-Board Lite 后台“节点管理”中点击生成 Agent Token，然后复制弹窗中的一键安装命令到节点机执行。安装脚本会自动完成：

- 下载 GitHub Release 中对应架构的二进制。
- 校验 `SHA256SUMS`。
- 安装或复用 `nexttrace`。
- 自动查找 Xray access log。
- 创建 `/var/lib/jboard-agent` 和 `/var/log/jboard`。
- 写入 `/etc/jboard-agent.env`。
- 停用并移除旧的 Agent systemd 服务，避免冲突。
- 写入并启动 `jboard-agent.service`。

手动安装命令形如：

```bash
curl -fsSL https://raw.githubusercontent.com/JetSprow/J-Board/lite/scripts/install-jboard-agent.sh | SERVER_URL=https://panel.example.com AUTH_TOKEN=你的Token bash
```

如果需要指定 Agent Release：

```bash
curl -fsSL https://raw.githubusercontent.com/JetSprow/J-Board/lite/scripts/install-jboard-agent.sh | AGENT_TAG=v3.0.2 SERVER_URL=https://panel.example.com AUTH_TOKEN=你的Token bash
```

## 升级

```bash
curl -fsSL https://raw.githubusercontent.com/JetSprow/J-Board/lite/scripts/upgrade-jboard-agent.sh | bash
```

升级脚本会读取现有 `/etc/jboard-agent.env`，保留服务器地址、Token、探测间隔和 Xray 日志配置，并重新写入当前 systemd service。

升级后确认版本：

```bash
journalctl -u jboard-agent -n 30 --no-pager
```

你应该看到类似：

```text
[agent] jboard-agent v3.0.2 starting in probe-only mode
```

## 环境变量

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `SERVER_URL` | 必填 | J-Board Lite 面板公网地址，例如 `https://panel.example.com`。 |
| `AUTH_TOKEN` | 必填 | 后台节点页生成的 Agent Token。 |
| `LATENCY_INTERVAL` | `5m` | 延迟探测间隔，支持 `30s`、`5m` 或纯秒数。 |
| `TRACE_INTERVAL` | `30m` | 路由探测间隔，支持 `30m` 或纯秒数。 |
| `XRAY_ACCESS_LOG_PATH` | 自动探测 | Xray access log 路径。为空时节点真实连接风控禁用。 |
| `XRAY_LOG_INTERVAL` | `1m` | access log 读取、聚合、上报间隔。 |
| `XRAY_LOG_STATE_FILE` | `/var/lib/jboard-agent/xray-log-state.json` | access log offset 状态文件。 |
| `XRAY_LOG_START_AT_END` | `1` | 首次启动从文件末尾开始，避免上传历史巨量日志；设为 `0` 可从头读取。 |
| `INSTALL_NEXTTRACE` | `1` | 安装脚本是否自动安装 nexttrace。 |

systemd 环境文件默认位于：

```bash
/etc/jboard-agent.env
```

修改环境文件后需要重启：

```bash
systemctl restart jboard-agent
```

## Xray access log

安装/升级脚本会优先查找这些路径：

- `/usr/local/x-ui/access.log`
- `/usr/local/x-ui/bin/access.log`
- `/usr/local/x-ui/xray/access.log`
- `/etc/x-ui/access.log`
- `/etc/x-ui/xray/access.log`
- `/var/log/xray/access.log`
- `/var/log/x-ui/access.log`
- `/opt/3x-ui/access.log`
- `/opt/x-ui/access.log`
- `/usr/local`、`/etc`、`/var/log`、`/opt`、Docker volume 下名称包含 `access.log` 或 `xray` 的日志

如果没有找到，脚本会提示你在 3x-ui 的 Xray Config 中开启：

```json
"log": {
  "access": "/usr/local/x-ui/access.log",
  "error": "/usr/local/x-ui/error.log",
  "loglevel": "warning"
}
```

然后重启 x-ui，再重跑 Agent 安装或升级脚本。

### 支持的日志格式

Agent 支持常见 Xray access log 格式，包括：

```text
2026/04/29 10:11:12 203.0.113.9:51820 accepted tcp:example.com:443 [proxy-in >> freedom] email: user@example.com-cabc1234
```

也支持 3x-ui/Xray 新格式：

```text
2026/04/29 09:20:05.982584 from 220.240.111.193:59425 accepted tcp:example.com:443 [inbound-17583 >> direct] email: user@example.com-cmojtnp3
2026/04/29 09:20:06.006542 from tcp:220.240.111.193:59433 accepted udp:71.18.167.208:443 [inbound-17583 >> direct] email: user@example.com-cmojtnp3
```

Agent 会解析：

- `sourceIp`：真实来源 IP。
- `clientEmail`：Xray client email。
- `inboundTag`：入站 tag，例如 `inbound-17583`。
- `network`：`tcp` 或 `udp`。
- `targetHost` / `targetPort`：样本目标。
- `action`：`accepted` 或 `rejected`。
- `connectionCount`：聚合窗口内连接数。
- `uniqueTargetCount`：聚合窗口内不同目标数。
- `firstSeenAt` / `lastSeenAt`：窗口内首次和最近连接时间。

没有 `email:` 的日志会跳过，因为服务端无法把它归属到 J-Board 的 `NodeClient`。`[api -> api]` 这类 3x-ui 本地 API 通信通常也会跳过。

## Xray client email 与用户邮箱

J-Board 用户邮箱和 Xray client email 不一定完全相同。例如：

```text
J-Board 用户邮箱：user@example.com
Xray client email：user@example.com-cmojtnp3
```

这是正常设计。节点日志风控使用 Xray access log 里的 `email:` 匹配本地 `NodeClient.email`，再找到对应用户和订阅。不要手动在 3x-ui 修改 client email，否则日志会无法归属。

## systemd 运维

查看服务状态：

```bash
systemctl status jboard-agent --no-pager -l
```

实时日志：

```bash
journalctl -u jboard-agent -f --no-pager
```

看最近 100 行：

```bash
journalctl -u jboard-agent -n 100 --no-pager
```

只看 Xray 日志采集：

```bash
journalctl -u jboard-agent -f --no-pager | grep --line-buffered xray-log
```

查看配置：

```bash
cat /etc/jboard-agent.env
```

查看 access log offset 状态：

```bash
cat /var/lib/jboard-agent/xray-log-state.json
```

## 排障

### Agent 没有启动

```bash
systemctl status jboard-agent --no-pager -l
journalctl -u jboard-agent -n 100 --no-pager
```

常见原因：

- `/etc/jboard-agent.env` 缺少 `SERVER_URL` 或 `AUTH_TOKEN`。
- 二进制没有执行权限。
- 旧服务没有清理干净。新安装/升级脚本会自动停用并移除旧服务。

### 没有 `[xray-log]` 输出

这不一定是错误。Agent 只在禁用、报错或成功推送时打印 `xray-log`。如果没有新 access log，实时 grep 会一直等待。

按顺序检查：

```bash
cat /etc/jboard-agent.env | grep XRAY
cat /var/lib/jboard-agent/xray-log-state.json
tail -n 50 /usr/local/x-ui/access.log
grep "email:" /usr/local/x-ui/access.log | tail -n 20
```

如果状态文件类似：

```json
{"path":"/usr/local/x-ui/access.log","inode":393262,"offset":180}
```

说明 Agent 已经找到并跟踪日志。它会从 offset 之后继续读。

### access log 只有 `[api -> api]`

例如：

```text
2026/04/29 09:16:07.001315 from 127.0.0.1:43702 accepted tcp:127.0.0.1:62789 [api -> api]
```

这是 3x-ui / Xray 本地 API 通信，不是用户节点连接。你需要让真实客户端连接节点，再查看是否出现带 `email:` 的记录。

### 强制从头重读 access log

仅用于测试。生产环境不建议长期保持从头读取。

```bash
systemctl stop jboard-agent
rm -f /var/lib/jboard-agent/xray-log-state.json
sed -i 's/^XRAY_LOG_START_AT_END=.*/XRAY_LOG_START_AT_END=0/' /etc/jboard-agent.env
systemctl start jboard-agent
journalctl -u jboard-agent -n 100 --no-pager | grep xray-log
```

测试完成后改回：

```bash
sed -i 's/^XRAY_LOG_START_AT_END=.*/XRAY_LOG_START_AT_END=1/' /etc/jboard-agent.env
systemctl restart jboard-agent
```

### 服务端没有收到节点日志风控

检查：

- 后台系统设置是否开启订阅风控总控。
- 后台是否开启节点日志风控。
- access log 是否包含 `email:`。
- `email:` 是否与 J-Board 数据库里的 `NodeClient.email` 一致。
- Agent Token 是否属于当前节点。
- 面板日志是否有 `/api/agent/node-access` 的错误。

## 构建

```bash
go test ./...
make build
make build-linux
```

生成校验和：

```bash
shasum -a 256 jboard-agent-linux-amd64 jboard-agent-linux-arm64 > SHA256SUMS
```

## Release 规则

只有 Agent 代码或 Agent 安装/升级体验需要随二进制发布时，才创建新的 Agent tag 和 GitHub Release。普通面板页面、后台 UI、文档或 Server Action 改动不需要强行更新 Agent release。

Release 需要包含：

- `jboard-agent-linux-amd64`
- `jboard-agent-linux-arm64`
- `SHA256SUMS`

安装/升级脚本默认使用 GitHub 最新 Release。需要固定版本时传入 `AGENT_TAG=vX.Y.Z`。

## 安全边界

- Agent 只读 Xray access log，但日志中包含真实来源 IP、访问目标和 client email，应按敏感数据处理。
- Agent Token 等同节点上报凭据，不要外传。
- 节点服务器上不要公开 `/etc/jboard-agent.env`。
- 3x-ui 面板建议限制来源 IP 或使用反向代理鉴权。
