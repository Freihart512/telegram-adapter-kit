import { afterEach, describe, expect, it, vi } from "vitest";
import {
  computeBackoffDelayMs,
  DEFAULT_RETRY_POLICY,
  isTransientSdkError,
  normalizeRetryPolicy,
  withRetry,
} from "../../src/utils/retry.js";
import {
  OperationCancelledError,
  SendMessageError,
  TransientNetworkError,
  ValidationError,
} from "../../src/index.js";

describe("retry utilities (TT-026)", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("computes exponential backoff delays", () => {
    expect(computeBackoffDelayMs(0, 100)).toBe(100);
    expect(computeBackoffDelayMs(1, 100)).toBe(200);
    expect(computeBackoffDelayMs(2, 100)).toBe(400);
  });

  it("treats negative baseDelayMs as zero delay", () => {
    expect(computeBackoffDelayMs(0, -50)).toBe(0);
    expect(computeBackoffDelayMs(2, -50)).toBe(0);
  });

  it("normalizes invalid retry policy values", () => {
    expect(normalizeRetryPolicy({ maxRetries: -10, baseDelayMs: -100 })).toEqual({
      maxRetries: 0,
      baseDelayMs: 0,
    });
    expect(normalizeRetryPolicy({ maxRetries: 2.9, baseDelayMs: 99.1 })).toEqual({
      maxRetries: 2,
      baseDelayMs: 99,
    });
  });

  it("identifies TransientNetworkError as retryable", () => {
    expect(isTransientSdkError(new TransientNetworkError("net"))).toBe(true);
    expect(isTransientSdkError(new ValidationError("bad"))).toBe(false);
    expect(isTransientSdkError(new SendMessageError("send"))).toBe(false);
  });

  it("succeeds on first attempt without delay", async () => {
    const fn = vi.fn(async () => "ok");
    const result = await withRetry(fn, { maxRetries: 3, baseDelayMs: 100 });
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("retries transient failures until success", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new TransientNetworkError("fail 1"))
      .mockRejectedValueOnce(new TransientNetworkError("fail 2"))
      .mockResolvedValue("ok");

    const result = await withRetry(fn, { maxRetries: 3, baseDelayMs: 1 });
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("throws immediately on ValidationError without extra attempts", async () => {
    const fn = vi.fn(async () => {
      throw new ValidationError("invalid");
    });

    await expect(withRetry(fn, { maxRetries: 5, baseDelayMs: 1 })).rejects.toBeInstanceOf(
      ValidationError,
    );
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("throws immediately on SendMessageError without extra attempts", async () => {
    const fn = vi.fn(async () => {
      throw new SendMessageError("send failed");
    });

    await expect(withRetry(fn, { maxRetries: 5, baseDelayMs: 1 })).rejects.toBeInstanceOf(
      SendMessageError,
    );
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("uses custom isRetryable when provided", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new ValidationError("retry me"))
      .mockResolvedValue("ok");

    const result = await withRetry(
      fn,
      { maxRetries: 2, baseDelayMs: 1 },
      { isRetryable: (error) => error instanceof ValidationError },
    );

    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("throws last transient error when retries are exhausted", async () => {
    const last = new TransientNetworkError("still failing");
    const fn = vi.fn(async () => {
      throw last;
    });

    await expect(withRetry(fn, { maxRetries: 2, baseDelayMs: 1 })).rejects.toBe(last);
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("logs retry attempts when logger is provided", async () => {
    const logger = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new TransientNetworkError("fail"))
      .mockResolvedValue(undefined);

    await withRetry(fn, DEFAULT_RETRY_POLICY, {
      logger,
      operation: "startBot",
      meta: { botId: "b1" },
    });

    expect(logger.warn).toHaveBeenCalledWith(
      "retrying transient operation failure",
      expect.objectContaining({ operation: "startBot", botId: "b1", attempt: 1 }),
    );
  });

  it("respects maxRetries 0 as single attempt", async () => {
    const fn = vi.fn(async () => {
      throw new TransientNetworkError("fail");
    });

    await expect(withRetry(fn, { maxRetries: 0, baseDelayMs: 1 })).rejects.toBeInstanceOf(
      TransientNetworkError,
    );
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("aborts before first attempt when signal is already aborted", async () => {
    const controller = new AbortController();
    controller.abort();
    const fn = vi.fn(async () => "ok");

    await expect(
      withRetry(fn, { maxRetries: 3, baseDelayMs: 1 }, { signal: controller.signal }),
    ).rejects.toBeInstanceOf(OperationCancelledError);

    expect(fn).not.toHaveBeenCalled();
  });

  it("aborts during backoff when signal is aborted", async () => {
    vi.useFakeTimers();
    const controller = new AbortController();
    const fn = vi.fn(async () => {
      throw new TransientNetworkError("fail");
    });

    const pending = withRetry(
      fn,
      { maxRetries: 3, baseDelayMs: 1000 },
      {
        signal: controller.signal,
        operation: "startBot",
      },
    );

    await Promise.resolve();
    controller.abort();

    await expect(pending).rejects.toMatchObject({
      meta: expect.objectContaining({ operation: "startBot", attempt: 0 }),
    });
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
