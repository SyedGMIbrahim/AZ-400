const crypto = require("node:crypto");

function bucketForKey(key) {
  const seed = key || "anonymous";
  const hash = crypto.createHash("sha256").update(seed).digest("hex");
  return Number.parseInt(hash.slice(0, 8), 16) % 100;
}

function normalizePercentage(value) {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) {
    return 0;
  }

  return Math.max(0, Math.min(100, parsed));
}

function parseFlagPayload(rawValue) {
  if (!rawValue) {
    return null;
  }

  if (typeof rawValue === "object") {
    return rawValue;
  }

  try {
    return JSON.parse(rawValue);
  } catch {
    return null;
  }
}

function resolveRolloutPercent(flagPayload, fallbackPercent) {
  const filter = flagPayload?.conditions?.client_filters?.find((entry) => {
    return entry?.name === "Microsoft.Percentage";
  });

  return normalizePercentage(filter?.parameters?.Value ?? fallbackPercent ?? 0);
}

function evaluateRiskyFeature(flagPayload, userKey, fallbackPercent) {
  const flag = parseFlagPayload(flagPayload);
  const rolloutPercent = resolveRolloutPercent(flag, fallbackPercent);
  const bucket = bucketForKey(userKey);
  const enabled = Boolean(flag?.enabled) && bucket < rolloutPercent;

  return {
    enabled,
    rolloutPercent,
    bucket,
    flagVersion: flag?.id || "RiskyFeature",
  };
}

async function loadRiskyFeatureState(client, userKey) {
  if (!client) {
    return evaluateRiskyFeature(process.env.RISKY_FEATURE_FLAG_JSON, userKey, process.env.RISKY_FEATURE_ROLLOUT_PERCENT);
  }

  try {
    const key = ".appconfig.featureflag/RiskyFeature";
    const label = process.env.APP_CONFIG_LABEL || null;
    const setting = await client.getConfigurationSetting({ key, label });

    return evaluateRiskyFeature(setting?.value, userKey, process.env.RISKY_FEATURE_ROLLOUT_PERCENT);
  } catch {
    return evaluateRiskyFeature(process.env.RISKY_FEATURE_FLAG_JSON, userKey, process.env.RISKY_FEATURE_ROLLOUT_PERCENT);
  }
}

module.exports = {
  bucketForKey,
  evaluateRiskyFeature,
  loadRiskyFeatureState,
  normalizePercentage,
  parseFlagPayload,
  resolveRolloutPercent,
};
