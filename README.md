# AZ-400 Canary Release Demo

This repository implements a canary release using Azure App Configuration feature flags, Azure Pipelines YAML, and Application Insights.
The risky code path is deployed dark, then exposed gradually at 5%, 25%, and 100% based on telemetry.

## What is included

- Minimal Node.js app (`src/`) with feature-flag gating and Application Insights telemetry, pipeline YAML (`azure-pipelines.yml`), helper scripts (`scripts/`), and documentation (`docs/`).

## Local development

1. Install Node.js 20 or later.
2. Run `npm install`.
3. Start the app with `npm start`.
4. Run tests with `npm test`.

## Azure setup

Required runtime settings:

- `APP_CONFIG_ENDPOINT` or `APP_CONFIG_CONNECTION_STRING`
- `APPLICATIONINSIGHTS_CONNECTION_STRING`
- `AI_SERVICE_NAME` optional
- `RISKY_FEATURE_ROLLOUT_PERCENT` for local fallback

The flag is stored as `.appconfig.featureflag/RiskyFeature` in Azure App Configuration.
The rollback path disables that flag in place, which is the core AZ-400 lesson: release can be reversed without rebuilding or redeploying.

## Quick overview

- The pipeline builds and tests the app, enforces a security gate (`npm audit`), deploys the code dark, and uses Azure App Configuration feature flags to roll out the risky path (0% → 5% → 25% → 100%) with manual review gates and an instant rollback via `scripts/rollback-flag.sh`.

## Definition Of Done

The project is complete when the pipeline runs end to end, the feature can be rolled out and rolled back without redeployment, the security gate passes, and Application Insights shows a real comparison between the flagged and unflagged cohorts.

## Completed Work (so far)

- Added a minimal Node.js app that reads the `RiskyFeature` flag, emits Application Insights telemetry, and exposes `/api/risky-feature` and `/healthz` (`src/`).
- Implemented feature-flag evaluation helpers and local fallback behavior (`src/featureFlagService.js`).
- Instrumented telemetry helpers and Application Insights integration (`src/telemetry.js`).
- Wrote unit tests for the flag logic (`test/featureFlagService.test.js`).
- Added rollout and rollback scripts for Azure App Configuration (`scripts/rollout-flag.sh`, `scripts/rollback-flag.sh`) and a flag query helper (`scripts/get-flag.sh`).
- Added a demo traffic generator (`scripts/send-demo-traffic.sh`) and a KQL telemetry query helper (`scripts/query-flag-telemetry.kql`).
- Created an Azure Pipelines multi-stage YAML with build, deploy (dark), and staged rollout stages plus manual review gates (`azure-pipelines.yml`).
- Added infrastructure IaC (Bicep): App Configuration, Application Insights, App Service plan + Web App, and Key Vault (`infra/main.bicep`) and a deploy helper (`scripts/deploy-infra.sh`).
- Added deployment runbook and cost-governance notes (`docs/runbook-deploy.md`, `docs/cost-governance.md`, `docs/canary-release.md`).
- Validated scripts with `bash -n` and committed & pushed the repo to GitHub (`git` commit `Initial canary release scaffold`).

## Remaining Implementation Steps (ordered)

Follow these platform-specific steps on Azure. Commands assume the `az` CLI is installed and you are signed in (`az login`). Replace placeholder names in angle brackets.

1) Deploy infrastructure (Bicep)

```bash
# Create resource group
az group create --name <resourceGroup> --location <location>

# Deploy the Bicep template included in `infra/main.bicep`
bash scripts/deploy-infra.sh <resourceGroup> <location> <namePrefix>

# Example: bash scripts/deploy-infra.sh az400-canary-rg eastus2 az400canary

# Get deployment outputs (to read resource names)
az deployment group show --resource-group <resourceGroup> --name <deploymentName> -o json
```

2) Create a service principal for CI/CD (least-privilege) and assign role on the resource group

```bash
# create an SP with contributor rights to the resource group
az ad sp create-for-rbac --name "http://az400-canary-sp" \
	--role Contributor \
	--scopes "/subscriptions/$(az account show --query id -o tsv)/resourceGroups/<resourceGroup>" \
	-o json

# Save the output (appId, password, tenant) — these are used for the Azure DevOps service connection.
```

3) Store secrets in Key Vault (or pipeline secret store)

```bash
# Example: obtain App Configuration connection string
az appconfig credential list --name <appConfigName> -o json

# Store secrets in Key Vault
az keyvault secret set --vault-name <keyVaultName> --name APP_CONFIG_CONNECTION_STRING --value "<connection-string>"
az keyvault secret set --vault-name <keyVaultName> --name APPLICATIONINSIGHTS_CONNECTION_STRING --value "<ai-connection-string>"
```

4) Create the Azure DevOps service connection

Option A — create via Azure DevOps portal:
- In your Azure DevOps project: Project settings → Service connections → New service connection → Azure Resource Manager → Service principal (manual) → paste `appId`/`password`/`tenant` and scope to the resource group.

Option B — create via `az devops` extension (requires `az extension add --name azure-devops` and `az devops login`):

```bash
az devops service-endpoint azurerm create \
	--name "az400-prod-sc" \
	--resource-group <resourceGroup> \
	--subscription-id $(az account show --query id -o tsv) \
	--service-principal-id <appId> \
	--service-principal-secret <password> \
	--tenant-id <tenant>
```

5) Wire pipeline variables and Key Vault in Azure DevOps

- Add a variable group or pipeline variables: `resourceGroup`, `appServiceName`, `appConfigName`, `applicationInsightsName`, `keyVaultName`, and set `azureServiceConnection` to the service connection name.
- Optionally link Key Vault secrets as pipeline variables (Library → Variable groups → Link secrets from an Azure key vault)

6) Create the initial `RiskyFeature` flag (dark)

```bash
# Use the helper script (writes a feature flag JSON to App Configuration)
bash scripts/rollout-flag.sh <appConfigName> 0

# Verify the stored flag
bash scripts/get-flag.sh <appConfigName>
```

7) Run the pipeline (Azure DevOps)

- Trigger the pipeline in Azure DevOps. The first run should complete the Build stage (unit tests + `npm audit`).
- If you prefer CLI: install `az devops` and run `az pipelines run --name <pipelineName>`.

8) Post-deploy verification

```bash
# Verify the app is healthy after Deploy (dark)
curl -f https://<app-host>/healthz
curl -s https://<app-host>/ | jq .
```

9) Canary rollout and telemetry checks

- Roll to 5% using `bash scripts/rollout-flag.sh <appConfigName> 5` (or let the pipeline stage do it).
- Query Application Insights using the KQL in `scripts/query-flag-telemetry.kql` with `az monitor app-insights query` to compare `flagState` cohorts:

```bash
query=$(cat scripts/query-flag-telemetry.kql)
az monitor app-insights query --app <applicationInsightsName> --analytics-query "$query" --timespan 2h
```

10) Simulate a spike at 25% (optional) and decide

- Roll to 25%: `bash scripts/rollout-flag.sh <appConfigName> 25`.
- Optionally inject demo traffic that triggers failures: `bash scripts/send-demo-traffic.sh https://<app-host> 40 true`.
- Re-run the Application Insights query and compare error rate and latency between `flagState == on` and `off` cohorts. If the on cohort shows a statistically significant degradation, immediately run the rollback step below.

11) Instant rollback (if needed)

```bash
bash scripts/rollback-flag.sh <appConfigName>
```

12) Complete rollout

- If telemetry is healthy, roll to 100%: `bash scripts/rollout-flag.sh <appConfigName> 100`.
- Capture final metrics and export KQL results or screenshots for presentation.

13) Finalize documentation

- Add the final telemetry outputs, incident notes (if any), and the rollback demo steps to `docs/canary-release.md`.


## Notes and Constraints

- I implemented the IaC, scripts, pipeline YAML, and app instrumentation but cannot run `az` or create service connections or Key Vault secrets on your behalf without your credentials and tenant-level permissions.
- Use Key Vault or the Azure DevOps secret store for all secrets—never commit connection strings or keys to source control.
- If you want, I can generate an Azure DevOps variable group JSON or a `gh`/`az` command snippet to create the service connection and set variables; choose which I should produce next.
