import { OperationCancelledError } from "../errors/operation-cancelled-error.js";
import { TelegramSdkError } from "../errors/base.js";
import { TransientNetworkError } from "../errors/transient-network-error.js";
import type { Logger } from "../observability/logger.js";

/** Jitter strategy for retry backoff (TT-048). */
export type JitterStrategy = "none" | "full" | "equal";

/** Retry policy for transient failures (TRD §7.4, TT-026, TT-048). */
export type RetryPolicy = Readonly<{
  /** Extra attempts after the first failure (`0` = no retries). */
  maxRetries: number;
  /** Base delay for exponential backoff in milliseconds. */
  baseDelayMs: number;
  /** Upper bound for delay between attempts (TT-048). */
  maxDelayMs?: number;
  /** Jitter applied after capping exponential delay (default `none`). */
  jitter?: JitterStrategy;
}>;

export const DEFAULT_RETRY_POLICY: RetryPolicy = Object.freeze({
  maxRetries: 3,
  baseDelayMs: 250,
  jitter: "none",
});

/** Named retry presets for consumers (TT-048); merge with `normalizeRetryPolicy`. */
export const RETRY_POLICY_PRESETS = Object.freeze({
  default: DEFAULT_RETRY_POLICY,
  conservative: Object.freeze({
    maxRetries: 2,
    baseDelayMs: 500,
    maxDelayMs: 10_000,
    jitter: "equal",
  } satisfies RetryPolicy),
  balanced: Object.freeze({
    maxRetries: 3,
    baseDelayMs: 250,
    maxDelayMs: 8_000,
    jitter: "equal",
  } satisfies RetryPolicy),
});

export type WithRetryOptions = Readonly<{
  isRetryable?: (error: unknown) => boolean;
  logger?: Logger;
  operation?: string;
  signal?: AbortSignal;
  meta?: Readonly<Record<string, unknown>>;
}>;

export type ComputeBackoffDelayOptions = Readonly<{
  maxDelayMs?: number;
  jitter?: JitterStrategy;
  /** Injectable PRNG in `[0, 1)` for tests (TT-048). */
  random?: () => number;
}>;

/** Coerces a number to a safe non-negative integer (TT-048, internal). */
function safeNonNegativeInt(value: number, fallback = 0): number {
  if (!Number.isFinite(value)) {
    return fallback;
  }
  return Math.max(0, Math.floor(value));
}

function normalizeJitter(jitter: JitterStrategy | undefined): JitterStrategy {
  if (jitter === "full" || jitter === "equal") {
    return jitter;
  }
  return "none";
}

function sanitizeRandom(random: () => number): () => number {
  return () => {
    const value = random();
    if (!Number.isFinite(value) || value <= 0) {
      return 0;
    }
    if (value >= 1) {
      return 1;
    }
    return value;
  };
}

function normalizeComputeBackoffOptions(options?: ComputeBackoffDelayOptions): Readonly<{
  maxDelayMs: number | undefined;
  jitter: JitterStrategy;
  random: () => number;
}> {
  return {
    maxDelayMs:
      options?.maxDelayMs !== undefined ? safeNonNegativeInt(options.maxDelayMs) : undefined,
    jitter: normalizeJitter(options?.jitter),
    random: sanitizeRandom(options?.random ?? Math.random),
  };
}

/** Clamps invalid policy values to safe non-negative integers. */
export function normalizeRetryPolicy(policy: RetryPolicy): RetryPolicy {
  const normalized: {
    maxRetries: number;
    baseDelayMs: number;
    maxDelayMs?: number;
    jitter: JitterStrategy;
  } = {
    maxRetries: safeNonNegativeInt(policy.maxRetries),
    baseDelayMs: safeNonNegativeInt(policy.baseDelayMs),
    jitter: normalizeJitter(policy.jitter),
  };
  if (policy.maxDelayMs !== undefined) {
    normalized.maxDelayMs = safeNonNegativeInt(policy.maxDelayMs);
  }
  return Object.freeze(normalized);
}

/** Returns true when the error is safe to retry (transient network / rate limit). */
export function isTransientSdkError(error: unknown): boolean {
  return error instanceof TransientNetworkError;
}

function capDelay(delayMs: number, maxDelayMs: number | undefined): number {
  if (maxDelayMs === undefined) {
    return delayMs;
  }
  return Math.min(delayMs, maxDelayMs);
}

function applyJitter(cappedDelayMs: number, jitter: JitterStrategy, random: () => number): number {
  if (jitter === "none" || cappedDelayMs <= 0) {
    return cappedDelayMs;
  }
  const fraction = random();
  if (jitter === "full") {
    return Math.floor(fraction * cappedDelayMs);
  }
  const half = cappedDelayMs / 2;
  return Math.floor(half + fraction * half);
}

/**
 * Exponential backoff delay for retry attempt index (0-based).
 * Attempt 0 → `baseDelayMs`, attempt 1 → `2 * baseDelayMs`, etc.
 * Optional `maxDelayMs` cap and jitter (TT-048).
 */
export function computeBackoffDelayMs(
  attempt: number,
  baseDelayMs: number,
  options?: ComputeBackoffDelayOptions,
): number {
  const { maxDelayMs, jitter, random } = normalizeComputeBackoffOptions(options);
  const safeAttempt = safeNonNegativeInt(attempt);
  const safeBase = safeNonNegativeInt(baseDelayMs);
  let exponential = safeAttempt <= 0 ? safeBase : safeBase * 2 ** safeAttempt;
  if (!Number.isFinite(exponential)) {
    exponential = maxDelayMs ?? Number.MAX_SAFE_INTEGER;
  }
  const capped = capDelay(exponential, maxDelayMs);
  return applyJitter(capped, jitter, random);
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

      const delayMs = computeBackoffDelayMs(attempt, normalized.baseDelayMs, {
        maxDelayMs: normalized.maxDelayMs,
        jitter: normalized.jitter,
      });
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
