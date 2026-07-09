const express = require("express");
const { AppConfigurationClient } = require("@azure/app-configuration");
const { DefaultAzureCredential } = require("@azure/identity");
const {
  initTelemetry,
  trackEvent,
  trackException,
  trackMetric,
  trackRequest,
} = require("./telemetry");
const { loadRiskyFeatureState } = require("./featureFlagService");

function createAppConfigClient() {
  const connectionString = process.env.APP_CONFIG_CONNECTION_STRING;
  const endpoint = process.env.APP_CONFIG_ENDPOINT;

  if (connectionString) {
    return new AppConfigurationClient(connectionString);
  }

  if (endpoint) {
    return new AppConfigurationClient(endpoint, new DefaultAzureCredential());
  }

  return null;
}

function createFlagStateMiddleware(appConfigClient) {
  return async (req, res, next) => {
    const userKey = req.header("x-user-id") || req.query.user || req.ip || "anonymous";
    const startedAt = Date.now();

    try {
      req.flagState = await loadRiskyFeatureState(appConfigClient, userKey);
      req.flagState.userKey = userKey;

      res.on("finish", () => {
        const durationMs = Date.now() - startedAt;
        const properties = {
          feature: "RiskyFeature",
          flagState: req.flagState.enabled ? "on" : "off",
          rolloutPercent: String(req.flagState.rolloutPercent),
          userBucket: String(req.flagState.bucket),
        };

        trackRequest(`${req.method} ${req.path}`, durationMs, res.statusCode < 500, properties);
        trackMetric("risk_feature_latency_ms", durationMs, properties);
      });

      next();
    } catch (error) {
      next(error);
    }
  };
}

async function main() {
  initTelemetry();

  const app = express();
  const appConfigClient = createAppConfigClient();
  app.use(express.json());
  app.use(createFlagStateMiddleware(appConfigClient));

  app.get("/healthz", (_req, res) => {
    res.json({ ok: true });
  });

  app.get("/", (req, res) => {
    res.json({
      service: "canary-release-demo",
      riskyFeature: req.flagState?.enabled ? "on" : "off",
      rolloutPercent: req.flagState?.rolloutPercent ?? 0,
    });
  });

  app.get("/api/risky-feature", async (req, res, next) => {
    try {
      const state = req.flagState || {
        enabled: false,
        rolloutPercent: 0,
        bucket: 0,
        userKey: "anonymous",
      };

      if (!state.enabled) {
        trackEvent("risky_feature_skipped", {
          feature: "RiskyFeature",
          flagState: "off",
          rolloutPercent: String(state.rolloutPercent),
        });

        res.status(204).end();
        return;
      }

      if (req.query.fault === "1" || process.env.SIMULATE_RISK_SPIKE === "true") {
        throw new Error("Simulated risky feature failure");
      }

      const payload = {
        message: "Risky feature served successfully.",
        cohort: state.bucket < state.rolloutPercent ? "enabled" : "control",
        flagState: "on",
        rolloutPercent: state.rolloutPercent,
        userBucket: state.bucket,
      };

      trackEvent("risky_feature_served", {
        feature: "RiskyFeature",
        flagState: "on",
        rolloutPercent: String(state.rolloutPercent),
      });

      res.json(payload);
    } catch (error) {
      trackException(error, {
        feature: "RiskyFeature",
        flagState: req.flagState?.enabled ? "on" : "off",
        rolloutPercent: String(req.flagState?.rolloutPercent ?? 0),
      });
      next(error);
    }
  });

  app.use((error, _req, res, _next) => {
    res.status(500).json({
      error: error.message,
      detail: "The risky feature failed. Roll back the flag without redeploying if telemetry breaches the guardrail.",
    });
  });

  const port = Number.parseInt(process.env.PORT || "3000", 10);
  app.listen(port, () => {
    console.log(`Canary demo listening on port ${port}`);
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
