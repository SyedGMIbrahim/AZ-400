const appInsights = require("applicationinsights");

let client = null;

function initTelemetry() {
  const connectionString = process.env.APPLICATIONINSIGHTS_CONNECTION_STRING;

  if (!connectionString) {
    return null;
  }

  appInsights.setup(connectionString)
    .setAutoCollectConsole(false)
    .setAutoCollectExceptions(true)
    .setAutoCollectDependencies(false)
    .setAutoCollectPerformance(false)
    .setAutoCollectRequests(false)
    .setSendLiveMetrics(false)
    .start();

  client = appInsights.defaultClient;
  client.commonProperties = {
    service: process.env.AI_SERVICE_NAME || "az400-canary-api",
  };

  return client;
}

function enrichProperties(properties) {
  return {
    service: process.env.AI_SERVICE_NAME || "az400-canary-api",
    ...properties,
  };
}

function trackEvent(name, properties = {}) {
  client?.trackEvent({ name, properties: enrichProperties(properties) });
}

function trackMetric(name, value, properties = {}) {
  client?.trackMetric({ name, value, properties: enrichProperties(properties) });
}

function trackException(exception, properties = {}) {
  client?.trackException({ exception, properties: enrichProperties(properties) });
}

function trackRequest(name, durationMs, success, properties = {}) {
  client?.trackRequest({
    name,
    duration: durationMs,
    resultCode: success ? "200" : "500",
    success,
    properties: enrichProperties(properties),
  });
}

module.exports = {
  initTelemetry,
  trackEvent,
  trackException,
  trackMetric,
  trackRequest,
};
