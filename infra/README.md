# Infrastructure Notes

This project is intentionally lightweight in the workspace, but the intended Azure resources are:

- Azure App Configuration for the `RiskyFeature` flag.
- Azure App Service or Container App for the application host.
- Application Insights for telemetry and cohort comparison.
- Azure Cost Management budget and alerting on the subscription.

A production-ready deployment would scope the service connection to the resource group only and store secrets in Key Vault or the Azure DevOps secret store.
