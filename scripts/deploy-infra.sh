#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 2 ]]; then
  echo "usage: $0 <resource-group> <location> [name-prefix]" >&2
  exit 1
fi

rg="$1"
location="$2"
name_prefix="${3:-az400canary}"

echo "Creating resource group $rg in $location"
az group create --name "$rg" --location "$location"

echo "Deploying Bicep template"
az deployment group create \
  --resource-group "$rg" \
  --template-file infra/main.bicep \
  --parameters namePrefix="$name_prefix" location="$location" --query properties.outputResources --output json

echo "Deployment finished. To retrieve outputs run: az deployment group show --resource-group $rg --name $(az deployment group show --resource-group $rg --query name -o tsv)"
