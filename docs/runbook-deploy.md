# Deployment Runbook

This runbook contains the exact commands to provision the Azure resources, wire secrets, and run the pipeline.

1. Deploy infrastructure (requires `az login` with sufficient privileges):

```bash
bash scripts/deploy-infra.sh az400-canary-rg eastus2 az400canary
```

2. Retrieve outputs (resource names) from the deployment and save them for the pipeline variables.

3. Add secrets to `Key Vault` (connection strings). Example:

```bash
az appconfig credential list --name <appConfigName> -o json
# copy the primary connection string into Key Vault
az keyvault secret set --vault-name <keyVaultName> --name APP_CONFIG_CONNECTION_STRING --value "<connection-string>"

# add Application Insights connection string
az monitor app-insights component show --app <appInsightsName> -g <resourceGroup> -o json
az keyvault secret set --vault-name <keyVaultName> --name APPLICATIONINSIGHTS_CONNECTION_STRING --value "<connection-string>"
```

4. Create `RiskyFeature` flag (initially dark):

```bash
bash scripts/rollout-flag.sh <appConfigName> 0
```

5. Create an Azure DevOps service connection scoped to the resource group, or add a service principal with least privilege and store credentials in the pipeline.

6. Update `azure-pipelines.yml` variables or variable group with the real resource names and `keyVaultName`.

7. Run the pipeline in Azure DevOps and follow the manual review gates to progress the rollout.
