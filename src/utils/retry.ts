import { OperationCancelledError } from "../errors/operation-cancelled-error.js";
import { TelegramSdkError } from "../errors/base.js";
import { TransientNetworkError } from "../errors/transient-network-error.js";
import type { Logger } from "../observability/logger.js";

/** Retry policy for transient failures (TRD §7.4, TT-026). */
export type RetryPolicy = Readonly<{
  /** Extra attempts after the first failure (`0` = no retries). */
  maxRetries: number;
  /** Base delay for exponential backoff in milliseconds. */
  baseDelayMs: number;
}>;

export const DEFAULT_RETRY_POLICY: RetryPolicy = Object.freeze({
  maxRetries: 3,
  baseDelayMs: 250,
});

export type WithRetryOptions = Readonly<{
  isRetryable?: (error: unknown) => boolean;
  logger?: Logger;
  operation?: string;
  signal?: AbortSignal;
  meta?: Readonly<Record<string, unknown>>;
}>;

/** Clamps invalid policy values to safe non-negative integers. */
export function normalizeRetryPolicy(policy: RetryPolicy): RetryPolicy {
  return Object.freeze({
    maxRetries: Math.max(0, Math.floor(policy.maxRetries)),
    baseDelayMs: Math.max(0, Math.floor(policy.baseDelayMs)),
  });
}

/** Returns true when the error is safe to retry (transient network / rate limit). */
export function isTransientSdkError(error: unknown): boolean {
  return error instanceof TransientNetworkError;
}

/**
 * Exponential backoff delay for retry attempt index (0-based).
 * Attempt 0 → `baseDelayMs`, attempt 1 → `2 * baseDelayMs`, etc.
 */
export function computeBackoffDelayMs(attempt: number, baseDelayMs: number): number {
  const safeBase = Math.max(0, baseDelayMs);
  if (attempt <= 0) {
    return safeBase;
  }
  return safeBase * 2 ** attempt;
}

/**
 * Runs `fn` with retries on transient errors only.
 * Total attempts = `policy.maxRetries + 1`. Non-retryable errors fail immediately.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  policy: RetryPolicy = DEFAULT_RETRY_POLICY,
  options?: WithRetryOptions,
): Promise<T> {
  const normalized = normalizeRetryPolicy(policy);
  const isRetryable = options?.isRetryable ?? isTransientSdkError;
  const maxAttempts = normalized.maxRetries + 1;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (options?.signal?.aborted) {
      throw new OperationCancelledError("Operation cancelled before retry attempt", {
        meta: { operation: options.operation, attempt },
      });
    }

    try {
      return await fn();
    } catch (error) {
      const canRetry = isRetryable(error) && attempt < maxAttempts - 1;
      if (!canRetry) {
        throw error;
      }

      const delayMs = computeBackoffDelayMs(attempt, normalized.baseDelayMs);
      const code = error instanceof TelegramSdkError ? error.code : undefined;
      options?.logger?.warn("retrying transient operation failure", {
        operation: options.operation,
        attempt: attempt + 1,
        maxRetries: normalized.maxRetries,
        delayMs,
        code,
        ...options.meta,
      });
      await sleep(delayMs, options?.signal, options?.operation, attempt);
    }
  }

  throw new Error("withRetry: unreachable");
}

function sleep(
  ms: number,
  signal?: AbortSignal,
  operation?: string,
  attempt?: number,
): Promise<void> {
  if (ms <= 0) {
    return Promise.resolve();
  }

  const cancelMeta = { operation, attempt };

  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(
        new OperationCancelledError("Operation cancelled during retry backoff", {
          meta: cancelMeta,
        }),
      );
      return;
    }

    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);

    const onAbort = () => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
      reject(
        new OperationCancelledError("Operation cancelled during retry backoff", {
          meta: cancelMeta,
        }),
      );
    };

    signal?.addEventListener("abort", onAbort, { once: true });
  });
}
