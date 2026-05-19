import { afterEach, describe, expect, it, vi } from "vitest";
import { withOperationControl } from "../../src/utils/operation-control.js";
import {
  DEFAULT_RETRY_POLICY,
  OperationCancelledError,
  OperationTimeoutError,
  TransientNetworkError,
} from "../../src/index.js";

describe("withOperationControl (TT-045)", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("applies timeout per retry attempt", async () => {
    vi.useFakeTimers();
    let calls = 0;
    const fn = vi.fn(() => {
      calls += 1;
      if (calls === 1) {
        return new Promise<string>(() => {
          /* hang until timeout */
        });
      }
      return Promise.reject(new TransientNetworkError("still failing"));
    });

    const pending = withOperationControl(fn, "startBot", {
      defaultRetryPolicy: { maxRetries: 1, baseDelayMs: 10 },
      operationOptions: { timeoutMs: 1000 },
    });
    const assertion = expect(pending).rejects.toBeInstanceOf(OperationTimeoutError);

    await vi.advanceTimersByTimeAsync(1000);
    await assertion;
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("retries transient errors when each attempt finishes within timeoutMs", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new TransientNetworkError("t1"))
      .mockResolvedValue("ok");

    const result = await withOperationControl(fn, "startBot", {
      defaultRetryPolicy: { maxRetries: 1, baseDelayMs: 1 },
      operationOptions: { timeoutMs: 5000 },
    });

    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("does not retry sendMessage on transient failure", async () => {
    const fn = vi.fn(async () => {
      throw new TransientNetworkError("send");
    });

    await expect(
      withOperationControl(fn, "sendMessage", {
        defaultRetryPolicy: DEFAULT_RETRY_POLICY,
        operationOptions: { timeoutMs: 5000 },
      }),
    ).rejects.toBeInstanceOf(TransientNetworkError);

    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("rejects with OperationCancelledError when signal aborts during fn", async () => {
    const controller = new AbortController();
    const fn = vi.fn(
      () =>
        new Promise<string>(() => {
          /* hang */
        }),
    );

    const pending = withOperationControl(fn, "sendMessage", {
      defaultRetryPolicy: DEFAULT_RETRY_POLICY,
      operationOptions: { signal: controller.signal },
    });
    controller.abort();

    await expect(pending).rejects.toBeInstanceOf(OperationCancelledError);
  });
});
