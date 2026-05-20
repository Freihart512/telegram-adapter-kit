import type { OperationOptions } from "../contracts/operations.js";
import type { Logger } from "../observability/logger.js";
import {
  resolveRetryPolicyForOperation,
  type RuntimeOperationKind,
} from "./operation-retry-policy.js";
import { type RetryPolicy, withRetry } from "./retry.js";
import { withTimeout } from "./timeout.js";

export type WithOperationControlDeps = Readonly<{
  defaultRetryPolicy: RetryPolicy;
  applyOperationBackoffOverlays?: boolean;
  operationOptions?: OperationOptions;
  logger?: Logger;
  meta?: Readonly<Record<string, unknown>>;
}>;

/**
 * Composes retry (TT-026/046) around per-attempt timeout/cancel (TT-044).
 *
 * - `withRetry` wraps the full operation.
 * - Each attempt runs inside `withTimeout` (`timeoutMs` is **per attempt**, not global).
 */
export async function withOperationControl<T>(
  fn: () => Promise<T>,
  operation: RuntimeOperationKind,
  deps: WithOperationControlDeps,
): Promise<T> {
  const retryPolicy = resolveRetryPolicyForOperation(operation, deps.defaultRetryPolicy, {
    applyOverlays: deps.applyOperationBackoffOverlays,
  });

  return withRetry(
    () =>
      withTimeout(fn, {
        timeoutMs: deps.operationOptions?.timeoutMs,
        signal: deps.operationOptions?.signal,
        operation,
        meta: deps.meta,
      }),
    retryPolicy,
    {
      logger: deps.logger,
      operation,
      signal: deps.operationOptions?.signal,
      meta: deps.meta,
    },
  );
}
