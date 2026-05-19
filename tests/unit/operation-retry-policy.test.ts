import { describe, expect, it } from "vitest";
import {
  resolveRetryPolicyForOperation,
  SEND_MESSAGE_RETRY_POLICY,
  type RuntimeOperationKind,
} from "../../src/utils/operation-retry-policy.js";
import { DEFAULT_RETRY_POLICY } from "../../src/utils/retry.js";

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
    const aggressive = { maxRetries: 5, baseDelayMs: 100 };
    expect(resolveRetryPolicyForOperation("sendMessage", aggressive)).toEqual({
      maxRetries: 0,
      baseDelayMs: 0,
    });
  });
});
