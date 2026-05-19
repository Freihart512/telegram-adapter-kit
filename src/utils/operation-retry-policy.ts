import {
  normalizeRetryPolicy,
  type RetryPolicy,
} from "./retry.js";

/** Runtime operations that pass through {@link RuntimeManager} `guard()` (TT-046). */
export type RuntimeOperationKind =
  | "registerBot"
  | "unregisterBot"
  | "startBot"
  | "stopBot"
  | "cleanupBot"
  | "bindIncomingMessages"
  | "unbindIncomingMessages"
  | "sendMessage";

/**
 * v1 scope (TT-046): only `sendMessage` is restricted (`maxRetries: 0`).
 * All other operations keep the global `RuntimeManagerDeps.retryPolicy` (TT-026).
 * TRD §7.7 idempotency for `registerBot` / `unregisterBot` is not changed in this task.
 */
export const SEND_MESSAGE_RETRY_POLICY: RetryPolicy = Object.freeze({
  maxRetries: 0,
  baseDelayMs: 0,
});

/**
 * Resolves the retry policy for a runtime operation.
 * `sendMessage` never retries by default to avoid duplicate sends on ambiguous transient failures.
 */
export function resolveRetryPolicyForOperation(
  operation: RuntimeOperationKind,
  defaultPolicy: RetryPolicy,
): RetryPolicy {
  switch (operation) {
    case "sendMessage":
      return SEND_MESSAGE_RETRY_POLICY;
    default:
      return normalizeRetryPolicy(defaultPolicy);
  }
}
