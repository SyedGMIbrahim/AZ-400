const test = require("node:test");
const assert = require("node:assert/strict");
const { bucketForKey, evaluateRiskyFeature, normalizePercentage } = require("../src/featureFlagService");

test("bucketForKey is deterministic", () => {
  assert.equal(bucketForKey("alice"), bucketForKey("alice"));
  assert.notEqual(bucketForKey("alice"), bucketForKey("bob"));
});

test("normalizePercentage clamps values", () => {
  assert.equal(normalizePercentage("125"), 100);
  assert.equal(normalizePercentage("-10"), 0);
  assert.equal(normalizePercentage("25"), 25);
});

test("evaluateRiskyFeature turns on only for matching buckets", () => {
  const flag = {
    id: "RiskyFeature",
    enabled: true,
    conditions: {
      client_filters: [
        {
          name: "Microsoft.Percentage",
          parameters: {
            Value: "25",
          },
        },
      ],
    },
  };

  const enabledState = evaluateRiskyFeature(flag, "candidate-user");
  const controlState = evaluateRiskyFeature(flag, "control-user");

  assert.equal(enabledState.flagVersion, "RiskyFeature");
  assert.ok(enabledState.rolloutPercent === 25);
  assert.ok(enabledState.enabled === (enabledState.bucket < 25));
  assert.ok(controlState.enabled === (controlState.bucket < 25));
});
