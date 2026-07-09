#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "usage: $0 <app-config-name>" >&2
  exit 1
fi

app_config_name="$1"
key=".appconfig.featureflag/RiskyFeature"

echo "Querying App Configuration for $key"
az appconfig kv show --name "$app_config_name" --key "$key" --query value -o json
