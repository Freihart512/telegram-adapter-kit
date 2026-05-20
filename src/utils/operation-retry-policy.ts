import { normalizeRetryPolicy, type JitterStrategy, type RetryPolicy } from "./retry.js";

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
  jitter: "none",
});

/**
 * Optional backoff overlays per operation (TT-048).
 * Does not override TT-046 retry classification (`maxRetries` per operation).
 */
export const OPERATION_BACKOFF_OVERLAYS: Readonly<
  Partial<Record<RuntimeOperationKind, Readonly<{ maxDelayMs: number; jitter: JitterStrategy }>>>
> = Object.freeze({
  startBot: { maxDelayMs: 8_000, jitter: "equal" },
  stopBot: { maxDelayMs: 8_000, jitter: "equal" },
  cleanupBot: { maxDelayMs: 5_000, jitter: "equal" },
  bindIncomingMessages: { maxDelayMs: 5_000, jitter: "equal" },
  unbindIncomingMessages: { maxDelayMs: 5_000, jitter: "equal" },
});

/**
 * Merges an operation-specific backoff overlay onto a base policy (TT-048).
 * Use from `resolveRetryPolicyForOperation` or when building a custom `retryPolicy`.
 */
export function applyOperationBackoffOverlay(
  operation: RuntimeOperationKind,
  policy: RetryPolicy,
): RetryPolicy {
  const overlay = OPERATION_BACKOFF_OVERLAYS[operation];
  if (!overlay) {
    return normalizeRetryPolicy(policy);
  }
  return normalizeRetryPolicy({ ...policy, ...overlay });
}

/**
 * Resolves the retry policy for a runtime operation.
 * `sendMessage` never retries by default to avoid duplicate sends on ambiguous transient failures.
 *
 * @param applyOverlays — when true, merges {@link OPERATION_BACKOFF_OVERLAYS} (TT-048). Default false
 *   to preserve delay behavior unless the consumer opts in.
 */
export function resolveRetryPolicyForOperation(
  operation: RuntimeOperationKind,
  defaultPolicy: RetryPolicy,
  options?: Readonly<{ applyOverlays?: boolean }>,
): RetryPolicy {
  if (operation === "sendMessage") {
    return SEND_MESSAGE_RETRY_POLICY;
  }
  const base = normalizeRetryPolicy(defaultPolicy);
  if (options?.applyOverlays) {
    return applyOperationBackoffOverlay(operation, base);
  }
  return base;
}
