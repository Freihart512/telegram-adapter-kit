import { OperationCancelledError } from "../errors/operation-cancelled-error.js";
import { OperationTimeoutError } from "../errors/operation-timeout-error.js";

/** Options for operational time limits and cancellation (PRD §11.3, TRD §7.8, TT-044). */
export type WithTimeoutOptions = Readonly<{
  timeoutMs?: number;
  signal?: AbortSignal;
  /** Operation name for logs and error metadata (e.g. `startBot`). */
  operation?: string;
  /** Non-secret diagnostic fields (`botId`, etc.). */
  meta?: Readonly<Record<string, unknown>>;
}>;

function buildErrorMeta(
  options?: WithTimeoutOptions,
): Readonly<Record<string, unknown>> | undefined {
  const { operation, meta } = options ?? {};
  if (operation === undefined && meta === undefined) {
    return undefined;
  }
  return { ...(meta ?? {}), ...(operation !== undefined ? { operation } : {}) };
}

/**
 * Runs `fn` with optional per-call timeout and {@link AbortSignal} cancellation.
 *
 * When the caller rejects due to timeout or abort, the underlying `fn()` promise may
 * still settle later if the provider does not support cooperative cancellation.
 */
export async function withTimeout<T>(
  fn: () => Promise<T>,
  options?: WithTimeoutOptions,
): Promise<T> {
  const timeoutMs = options?.timeoutMs;
  const signal = options?.signal;
  const errorMeta = buildErrorMeta(options);
  const hasTimeout = timeoutMs !== undefined && timeoutMs > 0;
  const hasSignal = signal !== undefined;

  if (signal?.aborted) {
    throw new OperationCancelledError("Operation cancelled before start", { meta: errorMeta });
  }

  if (!hasTimeout && !hasSignal) {
    return fn();
  }

  return new Promise<T>((resolve, reject) => {
    let settled = false;

    const cleanup = (): void => {
      if (timer !== undefined) {
        clearTimeout(timer);
        timer = undefined;
      }
      if (hasSignal) {
        signal.removeEventListener("abort", onAbort);
      }
    };

    const settle = (run: () => void): void => {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      run();
    };

    let timer: ReturnType<typeof setTimeout> | undefined;

    const onAbort = (): void => {
      settle(() => {
        reject(
          new OperationCancelledError("Operation cancelled", {
            meta: errorMeta,
          }),
        );
      });
    };

    if (hasSignal) {
      signal.addEventListener("abort", onAbort, { once: true });
    }

    if (hasTimeout) {
      timer = setTimeout(() => {
        settle(() => {
          reject(
            new OperationTimeoutError(`Operation timed out after ${timeoutMs}ms`, {
              meta: { ...errorMeta, timeoutMs },
            }),
          );
        });
      }, timeoutMs);
    }

    // Promise.resolve() ensures synchronous throws from fn() route through settle/cleanup.
    void Promise.resolve()
      .then(fn)
      .then(
        (value) => {
          settle(() => {
            resolve(value);
          });
        },
        (error: unknown) => {
          settle(() => {
            reject(error);
          });
        },
      );
  });
}
