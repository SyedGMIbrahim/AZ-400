#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "usage: $0 <app-config-name> [feature-name]" >&2
  exit 1
fi

app_config_name="$1"
feature_name="${2:-RiskyFeature}"
feature_key=".appconfig.featureflag/${feature_name}"
feature_json=$(printf '{"id":"%s","enabled":false,"conditions":{"client_filters":[]}}' "$feature_name")

az appconfig kv set \
  --name "$app_config_name" \
  --key "$feature_key" \
  --value "$feature_json" \
  --content-type "application/vnd.microsoft.appconfig.ff+json;charset=utf-8"
