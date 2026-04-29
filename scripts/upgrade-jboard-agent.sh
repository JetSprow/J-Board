#!/usr/bin/env bash
set -euo pipefail

GH_REPO="${GH_REPO:-JetSprow/J-Board}"
AGENT_TAG="${AGENT_TAG:-latest}"
INSTALL_DIR="${INSTALL_DIR:-/usr/local/bin}"
SERVICE_NAME="${SERVICE_NAME:-jboard-agent}"
ENV_FILE="${ENV_FILE:-/etc/jboard-agent.env}"
XRAY_ACCESS_LOG_PATH="${XRAY_ACCESS_LOG_PATH:-}"
XRAY_LOG_INTERVAL="${XRAY_LOG_INTERVAL:-1m}"
XRAY_LOG_STATE_FILE="${XRAY_LOG_STATE_FILE:-/var/lib/jboard-agent/xray-log-state.json}"
XRAY_LOG_START_AT_END="${XRAY_LOG_START_AT_END:-1}"
TMP_DIR="$(mktemp -d)"
ARCH="$(uname -m)"

cleanup() {
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

run_as_root() {
  if [ "$(id -u)" -eq 0 ]; then
    "$@"
  elif command -v sudo >/dev/null 2>&1; then
    sudo "$@"
  else
    echo "This script needs root privileges. Re-run as root or install sudo." >&2
    exit 1
  fi
}

run_as_root_output() {
  if [ "$(id -u)" -eq 0 ]; then
    "$@"
  elif command -v sudo >/dev/null 2>&1; then
    sudo "$@"
  else
    return 1
  fi
}

detect_asset() {
  case "$ARCH" in
    x86_64|amd64)
      echo "jboard-agent-linux-amd64"
      ;;
    aarch64|arm64)
      echo "jboard-agent-linux-arm64"
      ;;
    *)
      echo "Unsupported architecture: $ARCH" >&2
      exit 1
      ;;
  esac
}

resolve_release_tag() {
  if [ "$AGENT_TAG" != "latest" ]; then
    echo "$AGENT_TAG"
    return
  fi

  curl -fsSL "https://api.github.com/repos/${GH_REPO}/releases/latest" \
    | sed -n 's/.*"tag_name"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' \
    | head -n 1
}

get_env_value() {
  local key="$1"
  if ! run_as_root_output test -f "$ENV_FILE" 2>/dev/null; then
    return 0
  fi
  run_as_root_output grep -E "^${key}=" "$ENV_FILE" 2>/dev/null \
    | tail -n 1 \
    | cut -d= -f2- \
    | sed -e "s/^\'//" -e "s/\'$//" -e 's/^"//' -e 's/"$//' || true
}

detect_xray_access_log() {
  if [ -n "$XRAY_ACCESS_LOG_PATH" ]; then
    printf '%s\n' "$XRAY_ACCESS_LOG_PATH"
    return 0
  fi

  for candidate in \
    /usr/local/x-ui/access.log \
    /usr/local/x-ui/bin/access.log \
    /usr/local/x-ui/xray/access.log \
    /etc/x-ui/access.log \
    /etc/x-ui/xray/access.log \
    /var/log/xray/access.log \
    /var/log/x-ui/access.log \
    /opt/3x-ui/access.log \
    /opt/x-ui/access.log; do
    if run_as_root_output test -f "$candidate" 2>/dev/null; then
      printf '%s\n' "$candidate"
      return 0
    fi
  done

  for root in /usr/local /etc /var/log /opt /var/lib/docker/volumes; do
    if ! run_as_root_output test -d "$root" 2>/dev/null; then
      continue
    fi
    while IFS= read -r candidate; do
      case "$candidate" in
        *x-ui*|*3x-ui*|*xray*|*Xray*)
          printf '%s\n' "$candidate"
          return 0
          ;;
      esac
    done < <(run_as_root_output find "$root" -type f \( -name 'access.log' -o -name '*xray*.log' \) 2>/dev/null | head -n 50)
  done

  return 1
}

upsert_env_value() {
  local key="$1"
  local value="$2"
  local quoted=""
  printf -v quoted %q "$value"

  if run_as_root_output test -f "$ENV_FILE" 2>/dev/null; then
    run_as_root_output cat "$ENV_FILE" > "$TMP_DIR/env.current"
  else
    : > "$TMP_DIR/env.current"
  fi

  if grep -qE "^${key}=" "$TMP_DIR/env.current"; then
    sed -E "s|^${key}=.*|${key}=${quoted}|" "$TMP_DIR/env.current" > "$TMP_DIR/env.next"
  else
    cp "$TMP_DIR/env.current" "$TMP_DIR/env.next"
    printf '%s=%s\n' "$key" "$quoted" >> "$TMP_DIR/env.next"
  fi
  run_as_root install -m 0600 "$TMP_DIR/env.next" "$ENV_FILE"
}

configure_xray_log_env() {
  local current=""
  current="$(get_env_value XRAY_ACCESS_LOG_PATH)"
  if [ -n "$current" ]; then
    XRAY_ACCESS_LOG_PATH="$current"
  fi

  local detected=""
  detected="$(detect_xray_access_log || true)"
  if [ -z "$detected" ]; then
    return 1
  fi

  XRAY_ACCESS_LOG_PATH="$detected"
  run_as_root mkdir -p "$(dirname "$XRAY_LOG_STATE_FILE")"
  if run_as_root_output test -f "$XRAY_ACCESS_LOG_PATH" 2>/dev/null; then
    run_as_root chmod a+r "$XRAY_ACCESS_LOG_PATH" 2>/dev/null || true
  fi

  upsert_env_value XRAY_ACCESS_LOG_PATH "$XRAY_ACCESS_LOG_PATH"
  upsert_env_value XRAY_LOG_INTERVAL "$XRAY_LOG_INTERVAL"
  upsert_env_value XRAY_LOG_STATE_FILE "$XRAY_LOG_STATE_FILE"
  upsert_env_value XRAY_LOG_START_AT_END "$XRAY_LOG_START_AT_END"
  return 0
}

print_xray_log_hint() {
  cat <<'HINT'

Xray access log was not found automatically. Node access risk telemetry remains disabled.
To enable it, open 3x-ui panel -> Xray Config and set:

"log": {
  "access": "/usr/local/x-ui/access.log",
  "error": "/usr/local/x-ui/error.log",
  "loglevel": "warning"
}

Then restart x-ui and rerun this upgrade script, or add XRAY_ACCESS_LOG_PATH=/usr/local/x-ui/access.log to /etc/jboard-agent.env.
HINT
}

service_candidates() {
  printf '%s\n' "$SERVICE_NAME" jboard-agent jboard-probe-agent j-board-agent jboard-probe \
    | awk 'NF && !seen[$0]++'
}

agent_service_exists() {
  local candidate="$1"
  run_as_root_output test -f "/etc/systemd/system/${candidate}.service" 2>/dev/null \
    || run_as_root_output test -f "/lib/systemd/system/${candidate}.service" 2>/dev/null \
    || run_as_root_output test -f "/usr/lib/systemd/system/${candidate}.service" 2>/dev/null \
    || run_as_root_output systemctl is-active --quiet "${candidate}.service" 2>/dev/null \
    || run_as_root_output systemctl is-enabled --quiet "${candidate}.service" 2>/dev/null
}

remove_old_agent_services() {
  local removed=0
  local candidate=""

  while IFS= read -r candidate; do
    [ -n "$candidate" ] || continue
    if agent_service_exists "$candidate"; then
      echo "Removing old agent service: ${candidate}.service"
      run_as_root systemctl stop "${candidate}.service" >/dev/null 2>&1 || true
      run_as_root systemctl disable "${candidate}.service" >/dev/null 2>&1 || true
      run_as_root systemctl reset-failed "${candidate}.service" >/dev/null 2>&1 || true
      run_as_root rm -f \
        "/etc/systemd/system/${candidate}.service" \
        "/lib/systemd/system/${candidate}.service" \
        "/usr/lib/systemd/system/${candidate}.service"
      removed=1
    fi
  done < <(service_candidates)

  if [ "$removed" = "1" ]; then
    run_as_root systemctl daemon-reload
  else
    echo "No old agent service found."
  fi
}

write_systemd_service() {
  local service_tmp="$TMP_DIR/${SERVICE_NAME}.service"
  cat > "$service_tmp" <<SERVICE
[Unit]
Description=J-Board Probe Agent
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
EnvironmentFile=${ENV_FILE}
ExecStart=${INSTALL_DIR}/jboard-agent
Restart=always
RestartSec=10
MemoryMax=64M

[Install]
WantedBy=multi-user.target
SERVICE
  run_as_root install -m 0644 "$service_tmp" "/etc/systemd/system/${SERVICE_NAME}.service"
}

ASSET="$(detect_asset)"
RESOLVED_TAG="$(resolve_release_tag)"

if [ -z "$RESOLVED_TAG" ]; then
  echo "Failed to resolve release tag for ${GH_REPO}" >&2
  exit 1
fi

DOWNLOAD_BASE="https://github.com/${GH_REPO}/releases/download/${RESOLVED_TAG}"
DOWNLOAD_URL="${DOWNLOAD_BASE}/${ASSET}"
CHECKSUM_URL="${DOWNLOAD_BASE}/SHA256SUMS"

echo "[1/7] Release tag: ${RESOLVED_TAG}"
echo "[2/7] Downloading probe agent binary: ${ASSET}"
curl -fsSL "$DOWNLOAD_URL" -o "$TMP_DIR/$ASSET"

if curl -fsSL "$CHECKSUM_URL" -o "$TMP_DIR/SHA256SUMS" 2>/dev/null; then
  echo "[3/7] Verifying checksum..."
  grep "  ${ASSET}$" "$TMP_DIR/SHA256SUMS" > "$TMP_DIR/SHA256SUMS.current"
  (
    cd "$TMP_DIR"
    if command -v sha256sum >/dev/null 2>&1; then
      sha256sum -c SHA256SUMS.current >/dev/null
    else
      shasum -a 256 -c SHA256SUMS.current >/dev/null
    fi
  )
else
  echo "[3/7] Checksum file not found; skipping verification."
fi

echo "[4/7] Removing old agent service..."
remove_old_agent_services

echo "[5/7] Installing binary..."
run_as_root install -m 0755 "$TMP_DIR/$ASSET" "${INSTALL_DIR}/jboard-agent"
run_as_root mkdir -p /var/log/jboard /var/lib/jboard-agent

echo "[6/7] Detecting Xray access log..."
if configure_xray_log_env; then
  echo "Node access risk telemetry: enabled (${XRAY_ACCESS_LOG_PATH})"
else
  echo "Node access risk telemetry: disabled"
  print_xray_log_hint
fi

echo "[7/7] Writing service and starting..."
write_systemd_service
run_as_root systemctl daemon-reload
run_as_root systemctl enable "$SERVICE_NAME"
run_as_root systemctl restart "$SERVICE_NAME"

echo
echo "Upgrade complete."
echo
echo "Service status:"
run_as_root systemctl --no-pager --full status "$SERVICE_NAME" || true

echo
echo "Recent logs:"
run_as_root journalctl -u "$SERVICE_NAME" -n 50 --no-pager || true
