#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "usage: $0 <base-url> [hit-count] [inject-fault]" >&2
  exit 1
fi

base_url="$1"
hit_count="${2:-25}"
inject_fault="${3:-false}"

for i in $(seq 1 "$hit_count"); do
  user_id="demo-user-$i"
  url="$base_url/api/risky-feature?user=$user_id"

  if [[ "$inject_fault" == "true" && $i -le $((hit_count / 2)) ]]; then
    url="$url&fault=1"
  fi

  curl -sS -H "x-user-id: $user_id" "$url" >/dev/null || true
  curl -sS "$base_url/healthz" >/dev/null || true

done
