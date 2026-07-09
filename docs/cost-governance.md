# Cost Governance

Create the Azure subscription budget and alert before you run long-lived infrastructure.
For this project, the baseline rule is:

- set a monthly budget on the resource group or subscription;
- alert at a low threshold such as 50% so you notice early;
- keep canary rollout traffic small until the telemetry is stable;
- use the rollback script to stop exposure before you add more load.

The point is to catch spend drift before the demo turns into an expensive soak test.

If you reuse this scaffold for AKS, VM, or Container App deployments, make the budget alert part of the bootstrap checklist, not an afterthought.
