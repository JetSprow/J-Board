#!/usr/bin/env bash

# Shared build profile detection for panel install/upgrade scripts.
# Strong machines use Docker's default behavior. Small machines trade time for
# lower peak CPU and memory usage.

JBOARD_BUILD_PROFILE_RESOLVED=""
JBOARD_CPU_COUNT=""
JBOARD_HOST_MEM_MB=""
JBOARD_DOCKER_MEM_MB=""
JBOARD_DOCKER_DISK_AVAIL_MB=""
JBOARD_EFFECTIVE_MEM_MB=""
JBOARD_NODE_HEAP_MB=""
JBOARD_DOCKER_BUILD_ARGS=()

jboard_cpu_count() {
  local value=""

  if command -v nproc >/dev/null 2>&1; then
    value="$(nproc 2>/dev/null || true)"
  elif command -v getconf >/dev/null 2>&1; then
    value="$(getconf _NPROCESSORS_ONLN 2>/dev/null || true)"
  elif command -v sysctl >/dev/null 2>&1; then
    value="$(sysctl -n hw.ncpu 2>/dev/null || true)"
  fi

  case "$value" in
    ''|*[!0-9]*) echo 1 ;;
    *) echo "$value" ;;
  esac
}

jboard_host_mem_mb() {
  local value=""

  if [ -r /proc/meminfo ]; then
    value="$(awk '/^MemTotal:/ {print int($2 / 1024)}' /proc/meminfo 2>/dev/null || true)"
  elif command -v getconf >/dev/null 2>&1; then
    local pages page_size
    pages="$(getconf _PHYS_PAGES 2>/dev/null || true)"
    page_size="$(getconf PAGE_SIZE 2>/dev/null || true)"
    if [ -n "$pages" ] && [ -n "$page_size" ]; then
      value="$((pages * page_size / 1024 / 1024))"
    fi
  elif command -v sysctl >/dev/null 2>&1; then
    local bytes
    bytes="$(sysctl -n hw.memsize 2>/dev/null || true)"
    if [ -n "$bytes" ]; then
      value="$((bytes / 1024 / 1024))"
    fi
  fi

  case "$value" in
    ''|*[!0-9]*) echo 0 ;;
    *) echo "$value" ;;
  esac
}

jboard_docker_info() {
  if ! command -v docker >/dev/null 2>&1; then
    return 1
  fi

  if command -v run_as_root >/dev/null 2>&1; then
    run_as_root docker info "$@" 2>/dev/null
  else
    docker info "$@" 2>/dev/null
  fi
}

jboard_docker_mem_mb() {
  local bytes=""
  bytes="$(jboard_docker_info --format '{{.MemTotal}}' 2>/dev/null || true)"

  case "$bytes" in
    ''|*[!0-9]*) echo 0 ;;
    *) echo "$((bytes / 1024 / 1024))" ;;
  esac
}

jboard_path_avail_mb() {
  local path="$1"
  local value=""

  if [ -n "$path" ]; then
    if command -v run_as_root >/dev/null 2>&1; then
      value="$(run_as_root df -Pm "$path" 2>/dev/null | awk 'NR == 2 {print $4}' || true)"
    else
      value="$(df -Pm "$path" 2>/dev/null | awk 'NR == 2 {print $4}' || true)"
    fi
  fi

  case "$value" in
    ''|*[!0-9]*) echo 0 ;;
    *) echo "$value" ;;
  esac
}

jboard_docker_disk_avail_mb() {
  local root_dir=""
  root_dir="$(jboard_docker_info --format '{{.DockerRootDir}}' 2>/dev/null || true)"

  if [ -n "$root_dir" ]; then
    jboard_path_avail_mb "$root_dir"
  else
    echo 0
  fi
}

jboard_effective_mem_mb() {
  local host="$1"
  local docker_mem="$2"

  if [ "$docker_mem" -gt 0 ] && [ "$host" -gt 0 ]; then
    if [ "$docker_mem" -lt "$host" ]; then
      echo "$docker_mem"
    else
      echo "$host"
    fi
  elif [ "$docker_mem" -gt 0 ]; then
    echo "$docker_mem"
  else
    echo "$host"
  fi
}

jboard_low_resource_heap_mb() {
  local mem_mb="$1"

  if [ -n "${JBOARD_LOW_RESOURCE_NODE_MB:-}" ]; then
    echo "$JBOARD_LOW_RESOURCE_NODE_MB"
    return
  fi

  if [ "$mem_mb" -gt 0 ] && [ "$mem_mb" -le 1200 ]; then
    echo 640
  elif [ "$mem_mb" -gt 0 ] && [ "$mem_mb" -le 1700 ]; then
    echo 768
  elif [ "$mem_mb" -gt 0 ] && [ "$mem_mb" -le 2400 ]; then
    echo 1024
  else
    echo 1536
  fi
}

jboard_resolve_build_profile() {
  local requested="${JBOARD_BUILD_PROFILE:-auto}"
  local cpu="$1"
  local mem_mb="$2"
  local docker_disk_mb="$3"

  case "$requested" in
    low|slow|small)
      echo low
      return
      ;;
    normal|fast|strong)
      echo normal
      return
      ;;
    auto|'')
      ;;
    *)
      echo "未知 JBOARD_BUILD_PROFILE=$requested，回退为 auto。" >&2
      ;;
  esac

  if [ "$cpu" -le 1 ]; then
    echo low
  elif [ "$mem_mb" -gt 0 ] && [ "$mem_mb" -lt 2048 ]; then
    echo low
  elif [ "$docker_disk_mb" -gt 0 ] && [ "$docker_disk_mb" -lt 8192 ]; then
    echo low
  else
    echo normal
  fi
}

jboard_prepare_docker_build_env() {
  JBOARD_CPU_COUNT="$(jboard_cpu_count)"
  JBOARD_HOST_MEM_MB="$(jboard_host_mem_mb)"
  JBOARD_DOCKER_MEM_MB="$(jboard_docker_mem_mb)"
  JBOARD_DOCKER_DISK_AVAIL_MB="$(jboard_docker_disk_avail_mb)"
  JBOARD_EFFECTIVE_MEM_MB="$(jboard_effective_mem_mb "$JBOARD_HOST_MEM_MB" "$JBOARD_DOCKER_MEM_MB")"
  JBOARD_BUILD_PROFILE_RESOLVED="$(jboard_resolve_build_profile "$JBOARD_CPU_COUNT" "$JBOARD_EFFECTIVE_MEM_MB" "$JBOARD_DOCKER_DISK_AVAIL_MB")"
  JBOARD_DOCKER_BUILD_ARGS=()

  export NEXT_TELEMETRY_DISABLED=1

  if [ "$JBOARD_BUILD_PROFILE_RESOLVED" = "low" ]; then
    JBOARD_NODE_HEAP_MB="$(jboard_low_resource_heap_mb "$JBOARD_EFFECTIVE_MEM_MB")"
    export COMPOSE_PARALLEL_LIMIT="${COMPOSE_PARALLEL_LIMIT:-1}"
    export NPM_CONFIG_JOBS="${NPM_CONFIG_JOBS:-1}"
    export npm_config_jobs="${npm_config_jobs:-$NPM_CONFIG_JOBS}"
    export NEXT_BUILD_NODE_OPTIONS="${NEXT_BUILD_NODE_OPTIONS:---max-old-space-size=${JBOARD_NODE_HEAP_MB}}"
  else
    JBOARD_NODE_HEAP_MB=""
    export NEXT_BUILD_NODE_OPTIONS="${NEXT_BUILD_NODE_OPTIONS:-}"
    export NPM_CONFIG_JOBS="${NPM_CONFIG_JOBS:-}"
  fi

  if [ -n "${NEXT_BUILD_NODE_OPTIONS:-}" ]; then
    JBOARD_DOCKER_BUILD_ARGS+=(--build-arg "NEXT_BUILD_NODE_OPTIONS=${NEXT_BUILD_NODE_OPTIONS}")
  fi
  if [ -n "${NPM_CONFIG_JOBS:-}" ]; then
    JBOARD_DOCKER_BUILD_ARGS+=(--build-arg "NPM_CONFIG_JOBS=${NPM_CONFIG_JOBS}")
  fi
}

jboard_is_low_resource_build() {
  [ "${JBOARD_BUILD_PROFILE_RESOLVED:-}" = "low" ]
}

jboard_print_build_profile() {
  local docker_mem="${JBOARD_DOCKER_MEM_MB:-0}"
  local docker_disk="${JBOARD_DOCKER_DISK_AVAIL_MB:-0}"
  local docker_text="unknown"
  local disk_text="unknown"

  if [ "$docker_mem" -gt 0 ]; then
    docker_text="${docker_mem}MB"
  fi
  if [ "$docker_disk" -gt 0 ]; then
    disk_text="${docker_disk}MB"
  fi

  if jboard_is_low_resource_build; then
    echo "检测到低资源构建环境：CPU=${JBOARD_CPU_COUNT:-?}，内存=${JBOARD_EFFECTIVE_MEM_MB:-0}MB，Docker内存=${docker_text}，Docker可用空间=${disk_text}"
    echo "启用慢速低占用模式：Compose 并发=1，npm jobs=${NPM_CONFIG_JOBS:-1}，Node heap=${JBOARD_NODE_HEAP_MB:-?}MB。"
  else
    echo "检测到常规构建环境：CPU=${JBOARD_CPU_COUNT:-?}，内存=${JBOARD_EFFECTIVE_MEM_MB:-0}MB，Docker内存=${docker_text}，Docker可用空间=${disk_text}"
    echo "使用 Docker 默认构建策略，不额外限制并发或 Node heap。"
  fi

  if [ "$docker_disk" -gt 0 ] && [ "$docker_disk" -lt 8192 ]; then
    echo "提示：Docker 可用空间低于 8GB，建议扩容 Docker 数据盘或清理未使用镜像/缓存。"
  fi
}
