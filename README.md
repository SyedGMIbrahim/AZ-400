# AZ-400 Canary Release Demo

This repository implements a canary release using Azure App Configuration feature flags, Azure Pipelines YAML, and Application Insights.
The risky code path is deployed dark, then exposed gradually at 5%, 25%, and 100% based on telemetry.

## What is included

- `src/` contains a small Node.js service that reads the `RiskyFeature` flag from Azure App Configuration and emits Application Insights telemetry tagged with flag state.
- `azure-pipelines.yml` defines a multi-stage Azure Pipelines flow with a security gate, rollout stages, and manual review points.
- `scripts/` contains rollout, rollback, and telemetry query helpers.
- `docs/canary-release.md` explains the release strategy and the telemetry needed to make the rollout decision.

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

## Pipeline behavior

The pipeline should:

- build and test the app;
- run a security gate with `npm audit --audit-level=high`;
- deploy the app with the risky feature dark;
- raise the flag to 5%, then 25%, then 100%;
- query Application Insights between stages;
- stop or roll back when the telemetry breaches the guardrail.

## Instant rollback

Use `scripts/rollback-flag.sh` to disable the feature flag immediately.
That leaves the deployed code in place and removes user exposure from the risky path.

## Demo note

For the 25% checkpoint, simulate an error spike by calling the risky endpoint with `?fault=1` or by enabling `SIMULATE_RISK_SPIKE=true` in a demo environment.
Then review the Application Insights query output before deciding whether to continue or roll back.

## Next Steps To Complete The Project

1. Create or confirm the Azure App Configuration instance, the Application Insights resource, and the app host you will deploy to.
2. Add the Azure DevOps service connection and replace the placeholder values in `azure-pipelines.yml` with your real resource names.
3. Store runtime secrets in Azure DevOps secret variables or Azure Key Vault, then link them to the pipeline and app settings.
4. Create the `RiskyFeature` flag in Azure App Configuration and verify that the default state is fully dark at 0%.
5. Run the build stage once to confirm unit tests and the security gate pass before any rollout.
6. Deploy the app with the feature off, then validate that `/healthz` and the root endpoint respond correctly.
7. Increase the flag to 5% and check the Application Insights query output for the on-versus-off cohorts.
8. At 25%, intentionally trigger the simulated spike, inspect the telemetry, and decide whether to pause, continue, or roll back.
9. If the spike is unacceptable, disable the flag immediately with `scripts/rollback-flag.sh` and confirm no redeploy was required.
10. If the telemetry stays healthy, advance the flag to 100% and capture the final metrics snapshot.
11. Document the final rollout decision, the rollback demonstration, and the telemetry comparison so the project is ready to present.

## Definition Of Done

The project is complete when the pipeline runs end to end, the feature can be rolled out and rolled back without redeployment, the security gate passes, and Application Insights shows a real comparison between the flagged and unflagged cohorts.
