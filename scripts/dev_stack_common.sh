#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG_DIR="$ROOT_DIR/.runtime-logs"

declare -a STACK_SERVICES=(
  "api"
  "web"
  "demo-worker"
)

declare -A STACK_COMMANDS=(
  ["api"]="npm run dev:api"
  ["web"]="npm run dev:web -- --host 0.0.0.0 --port 5173"
  ["demo-worker"]="npm run dev:worker"
)

declare -A STACK_PATTERNS=(
  ["api"]="tsx apps/api/src/server.ts"
  ["web"]="vite --config apps/web/vite.config.js"
  ["demo-worker"]="tsx apps/worker/src/demo_activity_worker.ts"
)

ensure_log_dir() {
  mkdir -p "$LOG_DIR"
}

service_log_path() {
  local service="$1"
  echo "$LOG_DIR/$service.log"
}

service_pid_path() {
  local service="$1"
  echo "$LOG_DIR/$service.pid"
}

service_pattern() {
  local service="$1"
  echo "${STACK_PATTERNS[$service]}"
}

service_command() {
  local service="$1"
  echo "${STACK_COMMANDS[$service]}"
}

is_service_running() {
  local service="$1"
  pgrep -f "$(service_pattern "$service")" >/dev/null 2>&1
}
