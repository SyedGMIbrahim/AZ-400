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

1. Deploy the Azure resources with the provided Bicep template and capture outputs (requires `az login`):

```bash
# example (replace names/locations as needed)
bash scripts/deploy-infra.sh az400-canary-rg eastus2 az400canary

# retrieve deployment outputs (resource names)
az deployment group show --resource-group az400-canary-rg --name <deployment-name> -o json
```

2. Store runtime secrets (App Configuration connection string and App Insights connection string) in Key Vault or the pipeline secret store. Example using Key Vault:

```bash
az appconfig credential list --name <appConfigName> -o json
az keyvault secret set --vault-name <keyVaultName> --name APP_CONFIG_CONNECTION_STRING --value "<connection-string>"
az monitor app-insights component show --app <appInsightsName> -g <resourceGroup> -o json
az keyvault secret set --vault-name <keyVaultName> --name APPLICATIONINSIGHTS_CONNECTION_STRING --value "<connection-string>"
```

3. Create an Azure DevOps service connection scoped to the resource group (or a least-privilege service principal) and add it to the pipeline as `azureServiceConnection`. Alternatively configure a GitHub Actions workflow with similar steps.

4. Update `azure-pipelines.yml` pipeline variables (or a variable group) with the real names: `resourceGroup`, `appServiceName`, `appConfigName`, `applicationInsightsName`, `keyVaultName`, and set the `azureServiceConnection` to the service connection name.

5. Run the pipeline once to execute the Build stage (unit tests + `npm audit`). Fix any failing tests or high-severity audit findings.

6. Start the pipeline to perform the Deploy (dark) stage. After deployment, verify the service is healthy:

```bash
curl -f https://<app-host>/healthz
curl -s https://<app-host>/ | jq .
```

7. Create or verify the `RiskyFeature` flag is present and dark (0%):

```bash
bash scripts/rollout-flag.sh <appConfigName> 0
bash scripts/get-flag.sh <appConfigName>
```

8. Roll the flag to 5% (pipeline stage or manual) and examine Application Insights using the provided KQL (`scripts/query-flag-telemetry.kql`) to compare `flagState == on` vs `off` cohorts.

9. Roll the flag to 25% and (optionally) inject the simulated spike using `scripts/send-demo-traffic.sh` or the `?fault=1` query parameter to the risky endpoint. Inspect telemetry for error rate and latency deltas.

10. If the 25% stage shows unacceptable degradation, run:

```bash
bash scripts/rollback-flag.sh <appConfigName>
```

to disable the flag instantly without redeploying.

11. If telemetry is healthy, advance to 100% and capture final metrics snapshot via Application Insights and the KQL helper.

12. Document the final rollout decision, include the KQL outputs and screenshots, and add the rollback demonstration steps to `docs/canary-release.md` for presentation.

## Notes and Constraints

- I implemented the IaC, scripts, pipeline YAML, and app instrumentation but cannot run `az` or create service connections or Key Vault secrets on your behalf without your credentials and tenant-level permissions.
- Use Key Vault or the Azure DevOps secret store for all secrets—never commit connection strings or keys to source control.
- If you want, I can generate an Azure DevOps variable group JSON or a `gh`/`az` command snippet to create the service connection and set variables; choose which I should produce next.
