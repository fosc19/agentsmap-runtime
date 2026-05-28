#!/usr/bin/env bash

set -euo pipefail

source "$(cd "$(dirname "$0")" && pwd)/dev_stack_common.sh"

ensure_log_dir

start_service() {
  local service="$1"
  local cmd
  cmd="$(service_command "$service")"

  pkill -f "$(service_pattern "$service")" >/dev/null 2>&1 || true
  rm -f "$(service_pid_path "$service")"

  setsid -f bash -lc "cd '$ROOT_DIR' && exec $cmd" \
    >"$(service_log_path "$service")" 2>&1 < /dev/null

  local pid
  pid="$(pgrep -n -f "$(service_pattern "$service")" || true)"
  if [[ -n "$pid" ]]; then
    echo "$pid" >"$(service_pid_path "$service")"
  fi
}

for service in "${STACK_SERVICES[@]}"; do
  start_service "$service"
done

sleep 6

echo "started local stack"
"$ROOT_DIR/scripts/dev_stack_status.sh"
