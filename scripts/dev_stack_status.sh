#!/usr/bin/env bash

set -euo pipefail

source "$(cd "$(dirname "$0")" && pwd)/dev_stack_common.sh"

for service in "${STACK_SERVICES[@]}"; do
  if is_service_running "$service"; then
    printf "up   %-16s %s\n" "$service" "$(service_pattern "$service")"
  else
    printf "down %-16s %s\n" "$service" "$(service_pattern "$service")"
  fi
done

