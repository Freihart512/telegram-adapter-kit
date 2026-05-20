import { describe, expect, it } from "vitest";
import {
  applyOperationBackoffOverlay,
  OPERATION_BACKOFF_OVERLAYS,
  resolveRetryPolicyForOperation,
  SEND_MESSAGE_RETRY_POLICY,
  type RuntimeOperationKind,
} from "../../src/utils/operation-retry-policy.js";
import { DEFAULT_RETRY_POLICY, RETRY_POLICY_PRESETS } from "../../src/utils/retry.js";

describe("operation retry policy (TT-046)", () => {
  it("returns no-retry policy for sendMessage", () => {
    expect(resolveRetryPolicyForOperation("sendMessage", DEFAULT_RETRY_POLICY)).toEqual(
      SEND_MESSAGE_RETRY_POLICY,
    );
  });

  it("returns normalized default policy for lifecycle and binding operations", () => {
    const lifecycleOps: RuntimeOperationKind[] = [
      "registerBot",
      "startBot",
      "stopBot",
      "cleanupBot",
      "bindIncomingMessages",
    ];
    for (const operation of lifecycleOps) {
      expect(resolveRetryPolicyForOperation(operation, DEFAULT_RETRY_POLICY)).toEqual(
        DEFAULT_RETRY_POLICY,
      );
    }
  });

  it("does not let global maxRetries apply to sendMessage", () => {
    const aggressive = {
      maxRetries: 5,
      baseDelayMs: 100,
      maxDelayMs: 5_000,
      jitter: "full" as const,
    };
    expect(resolveRetryPolicyForOperation("sendMessage", aggressive)).toEqual(
      SEND_MESSAGE_RETRY_POLICY,
    );
  });
});

describe("operation retry policy overlays (TT-048)", () => {
  it("does not apply overlays unless explicitly requested", () => {
    expect(
      resolveRetryPolicyForOperation("startBot", DEFAULT_RETRY_POLICY, { applyOverlays: false }),
    ).toEqual(DEFAULT_RETRY_POLICY);
  });

  it("merges overlays when applyOverlays is true", () => {
    expect(
      resolveRetryPolicyForOperation("startBot", DEFAULT_RETRY_POLICY, { applyOverlays: true }),
    ).toEqual({
      maxRetries: 3,
      baseDelayMs: 250,
      jitter: "equal",
      maxDelayMs: OPERATION_BACKOFF_OVERLAYS.startBot!.maxDelayMs,
    });
  });

  it("applyOperationBackoffOverlay leaves sendMessage policy to TT-046 caller", () => {
    expect(applyOperationBackoffOverlay("registerBot", DEFAULT_RETRY_POLICY)).toEqual(
      DEFAULT_RETRY_POLICY,
    );
    expect(applyOperationBackoffOverlay("startBot", DEFAULT_RETRY_POLICY)).toMatchObject({
      maxDelayMs: 8_000,
      jitter: "equal",
    });
  });

  it("exposes named presets with maxDelayMs and jitter", () => {
    expect(RETRY_POLICY_PRESETS.conservative).toMatchObject({
      maxRetries: 2,
      maxDelayMs: 10_000,
      jitter: "equal",
    });
    expect(RETRY_POLICY_PRESETS.balanced.maxDelayMs).toBe(8_000);
  });
});
