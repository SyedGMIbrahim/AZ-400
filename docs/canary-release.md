# Canary Release With Feature Flags

This project demonstrates a canary release that decouples deployment from release.
The risky code is deployed fully dark, then enabled for 5%, 25%, and 100% of traffic by changing an Azure App Configuration feature flag, not by redeploying the app.

## Why the distinction matters

Deployment ships code to production.
Release exposes the code to users.
With feature flags, you can deploy safely, observe real traffic, and decide whether to expand, pause, or roll back without a new build.
That reduces blast radius and makes the release decision reversible.

## Rollout flow

1. Deploy the application with `RiskyFeature` disabled or set to 0%.
2. Increase the percentage in Azure App Configuration to 5%.
3. Query Application Insights and compare flagged versus unflagged traffic.
4. Increase to 25% only if the telemetry stays within guardrails.
5. If the 25% stage shows a spike, disable the flag immediately and stop the rollout.
6. If the telemetry remains healthy, advance to 100%.

## Telemetry needed for a meaningful comparison

Use Application Insights dimensions that let you segment traffic by flag state and cohort:

- `feature` name.
- `flagState` on or off.
- `rolloutPercent`.
- `userBucket` or targeting bucket.
- endpoint or route.
- request success and failure rate.
- p95 or p99 latency.
- exception type and message.
- build or deployment version.
- time window and traffic source.

Without those dimensions, the comparison becomes a gut feel instead of a statistically defensible decision.

## Demo decision rule at 25%

If failures or latency increase for the enabled cohort, pause the rollout and inspect the query output before proceeding.
If the error spike is clearly attributable to `RiskyFeature`, use the rollback script to disable the flag and protect production traffic without a redeploy.

## Runbook

See [README](../README.md) for the pipeline and local setup, and use the scripts in `scripts/` to update the flag or query telemetry.
