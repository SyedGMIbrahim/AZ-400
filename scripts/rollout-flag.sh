#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 2 ]]; then
  echo "usage: $0 <app-config-name> <percent> [feature-name]" >&2
  exit 1
fi

app_config_name="$1"
rollout_percent="$2"
feature_name="${3:-RiskyFeature}"
feature_key=".appconfig.featureflag/${feature_name}"
feature_json=$(printf '{"id":"%s","enabled":true,"conditions":{"client_filters":[{"name":"Microsoft.Percentage","parameters":{"Value":"%s"}}]}}' "$feature_name" "$rollout_percent")

az appconfig kv set \
  --name "$app_config_name" \
  --key "$feature_key" \
  --value "$feature_json" \
  --content-type "application/vnd.microsoft.appconfig.ff+json;charset=utf-8"
