#!/usr/bin/env bash
set -euo pipefail

GH_REPO="${GH_REPO:-JetSprow/J-Board}"
BRANCH="${BRANCH:-main}"
APP_DIR="${APP_DIR:-}"
REWRITE_ENV="${REWRITE_ENV:-}"
SKIP_DOCKER_INSTALL="${SKIP_DOCKER_INSTALL:-0}"

APP_PORT=""
PUBLIC_URL=""
SITE_NAME=""
ADMIN_EMAIL=""
ADMIN_PASSWORD=""
ADMIN_NAME=""
POSTGRES_PASSWORD=""
NEXTAUTH_SECRET=""
ENCRYPTION_KEY=""
ENV_REUSED="0"

is_interactive() {
  [ -r /dev/tty ] && [ -w /dev/tty ]
}

prompt_print() {
  if is_interactive; then
    printf '%b' "$*" > /dev/tty
  else
    printf '%b' "$*" >&2
  fi
}

prompt_read() {
  local __var="$1"
  if is_interactive; then
    IFS= read -r "$__var" < /dev/tty || true
  else
    return 1
  fi
}

run_as_root() {
  if [ "$(id -u)" -eq 0 ]; then
    "$@"
  elif command -v sudo >/dev/null 2>&1; then
    sudo "$@"
  else
    echo "需要 root 权限。请使用 root 用户运行，或先安装 sudo。" >&2
    exit 1
  fi
}

line() {
  printf '%s\n' "------------------------------------------------------------"
}

section() {
  echo
  line
  printf '%s\n' "$1"
  line
}

need_command() {
  command -v "$1" >/dev/null 2>&1
}

install_base_packages() {
  local missing=()
  for cmd in curl git openssl; do
    if ! need_command "$cmd"; then
      missing+=("$cmd")
    fi
  done

  if [ "${#missing[@]}" -eq 0 ]; then
    return
  fi

  section "安装基础依赖：${missing[*]}"
  if need_command apt-get; then
    run_as_root apt-get update
    run_as_root apt-get install -y ca-certificates curl git openssl
  elif need_command dnf; then
    run_as_root dnf install -y ca-certificates curl git openssl
  elif need_command yum; then
    run_as_root yum install -y ca-certificates curl git openssl
  elif need_command apk; then
    run_as_root apk add --no-cache ca-certificates curl git openssl
  else
    echo "无法识别包管理器，请先手动安装：curl git openssl" >&2
    exit 1
  fi
}

install_docker() {
  if [ "$SKIP_DOCKER_INSTALL" = "1" ]; then
    return
  fi

  if need_command docker && run_as_root docker compose version >/dev/null 2>&1; then
    return
  fi

  section "安装 Docker 与 Compose 插件"
  curl -fsSL https://get.docker.com -o /tmp/get-docker.sh
  run_as_root sh /tmp/get-docker.sh
  rm -f /tmp/get-docker.sh

  if need_command systemctl; then
    run_as_root systemctl enable --now docker || true
  elif need_command service; then
    run_as_root service docker start || true
  fi

  if ! run_as_root docker compose version >/dev/null 2>&1; then
    echo "Docker Compose 插件安装后仍不可用，请检查 Docker 安装状态。" >&2
    exit 1
  fi
}

random_hex() {
  openssl rand -hex "$1"
}

random_password() {
  openssl rand -hex 12
}

server_ip() {
  curl -fsS --max-time 3 https://api.ipify.org 2>/dev/null || hostname -I 2>/dev/null | awk '{print $1}' || echo "127.0.0.1"
}

normalize_url() {
  local value="$1"
  value="${value%/}"
  if [ -z "$value" ]; then
    printf '%s' "$value"
    return
  fi
  case "$value" in
    http://*|https://*) printf '%s' "$value" ;;
    *) printf 'https://%s' "$value" ;;
  esac
}

prompt_value() {
  local label="$1"
  local default="$2"
  local help="${3:-}"
  local value=""

  if [ -n "$help" ]; then
    prompt_print "$help\n"
  fi

  if is_interactive; then
    prompt_print "$label [$default]: "
    prompt_read value || true
  fi

  if [ -z "$value" ]; then
    value="$default"
  fi
  printf '%s' "$value"
}

prompt_generated() {
  local label="$1"
  local default="$2"
  local help="${3:-}"
  local value=""

  if [ -n "$help" ]; then
    prompt_print "$help\n"
  fi

  if is_interactive; then
    prompt_print "$label [回车自动生成]: "
    prompt_read value || true
  fi

  if [ -z "$value" ]; then
    value="$default"
  fi
  printf '%s' "$value"
}

prompt_yes_no() {
  local label="$1"
  local default="$2"
  local value=""

  if ! is_interactive; then
    printf '%s' "$default"
    return
  fi

  prompt_print "$label [$default]: "
  prompt_read value || true
  value="${value:-$default}"
  case "$value" in
    y|Y|yes|YES|Yes) printf 'y' ;;
    *) printf 'n' ;;
  esac
}

resolve_default_app_dir() {
  local source="${BASH_SOURCE[0]:-}"
  local dir=""

  if [ -n "$source" ] && [ -f "$source" ]; then
    dir="$(cd -- "$(dirname -- "$source")" && pwd)"
    if [ -f "$dir/../package.json" ]; then
      cd -- "$dir/.." && pwd
      return
    fi
  fi

  echo "/opt/jboard"
}

git_in_repo() {
  if [ -w "$APP_DIR/.git" ] || [ -w "$APP_DIR" ]; then
    git -c safe.directory="$APP_DIR" "$@"
  else
    run_as_root git -c safe.directory="$APP_DIR" "$@"
  fi
}

prepare_repo() {
  section "准备 J-Board 代码"

  local default_dir
  default_dir="$(resolve_default_app_dir)"
  APP_DIR="$(prompt_value "安装目录" "${APP_DIR:-$default_dir}" "如果你已经在仓库目录里运行脚本，直接回车即可。")"

  if [ -d "$APP_DIR/.git" ]; then
    echo "检测到已有仓库：$APP_DIR"
    cd "$APP_DIR"
    git_in_repo fetch origin "$BRANCH"
    git_in_repo checkout "$BRANCH"
    git_in_repo pull --ff-only origin "$BRANCH"
  elif [ -e "$APP_DIR" ] && [ "$(find "$APP_DIR" -mindepth 1 -maxdepth 1 2>/dev/null | wc -l | tr -d ' ')" != "0" ]; then
    echo "安装目录已存在且不为空：$APP_DIR" >&2
    echo "请换一个目录，或设置 APP_DIR 指向空目录/已有 J-Board 仓库。" >&2
    exit 1
  else
    run_as_root mkdir -p "$(dirname "$APP_DIR")"
    run_as_root git clone --branch "$BRANCH" "https://github.com/${GH_REPO}.git" "$APP_DIR"
    cd "$APP_DIR"
  fi
}

load_existing_env() {
  if [ -f .env ]; then
    if [ -r .env ]; then
      set -a
      # shellcheck disable=SC1091
      . ./.env
      set +a
    else
      echo ".env 存在但当前用户不可读取；如需显示管理员密码，请使用 root 重新运行或查看 .env。"
    fi
    APP_PORT="${APP_PORT:-3000}"
    PUBLIC_URL="${NEXTAUTH_URL:-}"
    SITE_NAME="${SITE_NAME:-J-Board}"
    ADMIN_EMAIL="${ADMIN_EMAIL:-admin@jboard.local}"
    ADMIN_PASSWORD="${ADMIN_PASSWORD:-}"
    ADMIN_NAME="${ADMIN_NAME:-Admin}"
  fi
}

env_escape() {
  printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g; s/\$/\\$/g'
}

write_env() {
  local tmp
  tmp="$(mktemp)"

  {
    printf '# J-Board panel\n'
    printf 'APP_PORT="%s"\n' "$(env_escape "$APP_PORT")"
    printf 'SITE_NAME="%s"\n' "$(env_escape "$SITE_NAME")"
    printf '\n# PostgreSQL for local tools; Docker Compose overrides host to db\n'
    printf 'POSTGRES_PASSWORD="%s"\n' "$(env_escape "$POSTGRES_PASSWORD")"
    printf 'DATABASE_URL="postgresql://jboard:%s@localhost:5432/jboard"\n' "$(env_escape "$POSTGRES_PASSWORD")"
    printf '\n# NextAuth\n'
    printf 'NEXTAUTH_SECRET="%s"\n' "$(env_escape "$NEXTAUTH_SECRET")"
    printf 'NEXTAUTH_URL="%s"\n' "$(env_escape "$PUBLIC_URL")"
    printf '\n# Must be at least 32 bytes, used for AES-256-GCM encryption\n'
    printf 'ENCRYPTION_KEY="%s"\n' "$(env_escape "$ENCRYPTION_KEY")"
    printf '\n# Redis connection URL for local tools; Docker Compose overrides host to redis\n'
    printf 'REDIS_URL="redis://localhost:6379"\n'
    printf '\n# Initial admin account, used by npm run db:seed on first install\n'
    printf 'ADMIN_EMAIL="%s"\n' "$(env_escape "$ADMIN_EMAIL")"
    printf 'ADMIN_PASSWORD="%s"\n' "$(env_escape "$ADMIN_PASSWORD")"
    printf 'ADMIN_NAME="%s"\n' "$(env_escape "$ADMIN_NAME")"
  } > "$tmp"

  if [ -f .env ]; then
    run_as_root cp .env ".env.backup.$(date +%Y%m%d%H%M%S)"
  fi
  run_as_root install -m 0600 "$tmp" .env
  rm -f "$tmp"
}

configure_env() {
  section "生成 .env 配置"

  if [ -f .env ] && [ -z "$REWRITE_ENV" ]; then
    local answer
    answer="$(prompt_yes_no "检测到已有 .env，是否重新生成" "n")"
    if [ "$answer" = "n" ]; then
      ENV_REUSED="1"
      load_existing_env
      echo "沿用现有 .env。"
      return
    fi
  elif [ "${REWRITE_ENV:-0}" = "0" ] && [ -f .env ]; then
    ENV_REUSED="1"
    load_existing_env
    echo "沿用现有 .env。"
    return
  fi

  local ip default_url
  ip="$(server_ip)"
  default_url="http://${ip}:3000"

  SITE_NAME="$(prompt_value "站点名称" "J-Board")"
  PUBLIC_URL="$(prompt_value "公网访问地址" "$default_url" "这里请填写你准备反向代理到本机 3000 端口的正式域名，例如 https://panel.example.com。没有域名时可先回车用 IP:3000 测试。")"
  PUBLIC_URL="$(normalize_url "$PUBLIC_URL")"
  APP_PORT="$(prompt_value "本机监听端口" "3000" "反向代理目标会是 http://127.0.0.1:端口，默认 3000。")"
  ADMIN_EMAIL="$(prompt_value "管理员邮箱" "admin@jboard.local")"
  ADMIN_PASSWORD="$(prompt_generated "管理员密码" "$(random_password)" "回车会生成一个安全密码，部署完成后会在结果中显示一次。")"
  ADMIN_NAME="$(prompt_value "管理员昵称" "Admin")"
  POSTGRES_PASSWORD="$(prompt_generated "PostgreSQL 密码" "$(random_password)")"
  NEXTAUTH_SECRET="$(prompt_generated "NEXTAUTH_SECRET" "$(random_hex 32)")"
  ENCRYPTION_KEY="$(prompt_generated "ENCRYPTION_KEY" "$(random_hex 32)" "生产使用后不要更换 ENCRYPTION_KEY，否则已加密的面板密码、Token、凭据会无法解密。")"

  write_env
  echo ".env 已写入：$APP_DIR/.env"
}

docker_compose() {
  run_as_root docker compose "$@"
}

start_panel() {
  section "构建并启动面板"
  docker_compose build init app
  docker_compose --profile setup run --rm init
  docker_compose up -d app
}

wait_for_app() {
  section "检查启动状态"
  local url="http://127.0.0.1:${APP_PORT:-3000}/api/public/app-info"
  local ok="0"

  for _ in $(seq 1 30); do
    if curl -fsS "$url" >/dev/null 2>&1; then
      ok="1"
      break
    fi
    sleep 2
  done

  docker_compose ps
  echo
  if [ "$ok" = "1" ]; then
    echo "健康检查通过：$url"
  else
    echo "健康检查暂未通过，请查看日志：docker compose logs -f app"
  fi
}

print_summary() {
  local proxy_target="http://127.0.0.1:${APP_PORT:-3000}"
  local shown_password="$ADMIN_PASSWORD"
  if [ "$ENV_REUSED" = "1" ] && [ -z "$shown_password" ]; then
    shown_password="沿用已有数据库账号；如忘记请在数据库中重置"
  fi

  echo
  printf '%s\n' "============================================================"
  printf '%s\n' "J-Board 部署完成"
  printf '%s\n' "============================================================"
  printf '访问地址：%s\n' "${PUBLIC_URL:-http://127.0.0.1:${APP_PORT:-3000}}"
  printf '反代目标：%s\n' "$proxy_target"
  printf '管理员邮箱：%s\n' "${ADMIN_EMAIL:-admin@jboard.local}"
  printf '管理员密码：%s\n' "$shown_password"
  echo
  printf '%s\n' "反向代理提示"
  printf '  将你的域名解析到这台服务器，并把 Web 反向代理到 %s。\n' "$proxy_target"
  printf '  NEXTAUTH_URL 与后台系统设置中的站点域名都应使用这个公网域名。\n'
  echo
  printf '%s\n' "可以展示给用户的入口"
  printf '  首页 / 登录：%s/login\n' "${PUBLIC_URL%/}"
  printf '  注册入口：%s/register\n' "${PUBLIC_URL%/}"
  printf '  套餐商店：%s/store\n' "${PUBLIC_URL%/}"
  printf '  用户中心：%s/dashboard\n' "${PUBLIC_URL%/}"
  echo
  printf '%s\n' "上线前建议完成"
  printf '  1. 后台 /admin/settings：确认站点域名、SMTP 邮件服务、注册策略。\n'
  printf '  2. 后台 /admin/payments：配置并启用支付方式。\n'
  printf '  3. 后台 /admin/nodes：添加 3x-ui 节点并同步入站。\n'
  printf '  4. 后台 /admin/plans：创建套餐并绑定入站或流媒体服务。\n'
  echo
  printf '%s\n' "常用命令"
  printf '  cd %s\n' "$APP_DIR"
  printf '  sudo docker compose logs -f app\n'
  printf '  sudo docker compose ps\n'
  printf '  sudo ./scripts/upgrade-jboard-panel.sh\n'
  printf '%s\n' "============================================================"
}

main() {
  section "J-Board 一键部署向导"
  echo "这个脚本会安装 Docker、准备配置、初始化数据库并启动面板。"
  echo "适合全新 Linux 服务器；已有环境会尽量保留现有 .env。"

  install_base_packages
  prepare_repo
  configure_env
  install_docker
  start_panel
  wait_for_app
  print_summary
}

main "$@"
