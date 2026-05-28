#!/usr/bin/env bash

set -euo pipefail

source "$(cd "$(dirname "$0")" && pwd)/dev_stack_common.sh"

for service in "${STACK_SERVICES[@]}"; do
  if [[ -f "$(service_pid_path "$service")" ]]; then
    pid="$(cat "$(service_pid_path "$service")" 2>/dev/null || true)"
    if [[ -n "${pid:-}" ]]; then
      kill "$pid" >/dev/null 2>&1 || true
    fi
    rm -f "$(service_pid_path "$service")"
  fi
  pkill -f "$(service_pattern "$service")" >/dev/null 2>&1 || true
done

echo "stopped local stack"

