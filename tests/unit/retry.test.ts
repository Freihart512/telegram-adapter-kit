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

  it("normalizes non-finite policy fields safely", () => {
    expect(
      normalizeRetryPolicy({
        maxRetries: Infinity,
        baseDelayMs: NaN,
        maxDelayMs: -Infinity,
      }),
    ).toEqual({
      maxRetries: 0,
      baseDelayMs: 0,
      maxDelayMs: 0,
      jitter: "none",
    });
  });

  it("normalizes invalid retry policy values", () => {
    expect(normalizeRetryPolicy({ maxRetries: -10, baseDelayMs: -100 })).toEqual({
      maxRetries: 0,
      baseDelayMs: 0,
      jitter: "none",
    });
    expect(normalizeRetryPolicy({ maxRetries: 2.9, baseDelayMs: 99.1 })).toEqual({
      maxRetries: 2,
      baseDelayMs: 99,
      jitter: "none",
    });
    expect(
      normalizeRetryPolicy({
        maxRetries: 1,
        baseDelayMs: 100,
        maxDelayMs: -50,
        jitter: "bogus" as "full",
      }),
    ).toEqual({
      maxRetries: 1,
      baseDelayMs: 100,
      maxDelayMs: 0,
      jitter: "none",
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

  describe("backoff hardening (TT-048)", () => {
    it("keeps legacy exponential delays when jitter and maxDelayMs are omitted", () => {
      expect(computeBackoffDelayMs(0, 100)).toBe(100);
      expect(computeBackoffDelayMs(2, 100)).toBe(400);
    });

    it("caps delay with maxDelayMs", () => {
      expect(computeBackoffDelayMs(5, 250, { maxDelayMs: 1_000 })).toBe(1_000);
      expect(computeBackoffDelayMs(1, 100, { maxDelayMs: 150 })).toBe(150);
    });

    it("applies full jitter with deterministic random", () => {
      const random = () => 0.5;
      // attempt 5 → 3200ms raw, capped to 1000, full jitter at 0.5 → 500
      expect(computeBackoffDelayMs(5, 100, { maxDelayMs: 1_000, jitter: "full", random })).toBe(
        500,
      );
      // below cap: attempt 2 → 400ms, full jitter at 0.5 → 200
      expect(computeBackoffDelayMs(2, 100, { maxDelayMs: 1_000, jitter: "full", random })).toBe(
        200,
      );
    });

    it("applies equal jitter with deterministic random", () => {
      const random = vi.fn().mockReturnValue(0);
      expect(computeBackoffDelayMs(3, 100, { maxDelayMs: 800, jitter: "equal", random })).toBe(400);

      random.mockReturnValue(1);
      expect(computeBackoffDelayMs(3, 100, { maxDelayMs: 800, jitter: "equal", random })).toBe(800);
    });

    it("produces spread delays with full jitter across random values", () => {
      const capped = 1_000;
      const samples = [0, 0.25, 0.5, 0.75, 1].map((value) =>
        computeBackoffDelayMs(4, 100, {
          maxDelayMs: capped,
          jitter: "full",
          random: () => value,
        }),
      );
      expect(Math.min(...samples)).toBe(0);
      expect(Math.max(...samples)).toBe(capped);
      expect(new Set(samples).size).toBeGreaterThan(1);
    });

    it("never exceeds maxDelayMs with jitter", () => {
      for (let i = 0; i < 20; i++) {
        const delay = computeBackoffDelayMs(10, 500, {
          maxDelayMs: 2_000,
          jitter: "equal",
          random: () => i / 20,
        });
        expect(delay).toBeLessThanOrEqual(2_000);
      }
    });

    it("hardens direct computeBackoffDelayMs options from invalid JS values", () => {
      expect(
        computeBackoffDelayMs(2, 100, {
          maxDelayMs: NaN,
          jitter: "bogus" as "equal",
          random: () => NaN,
        }),
      ).toBe(0);

      expect(
        computeBackoffDelayMs(2, 100, {
          maxDelayMs: 500,
          jitter: "bogus" as "equal",
        }),
      ).toBe(400);

      expect(
        computeBackoffDelayMs(Infinity, 100, {
          maxDelayMs: 500,
          jitter: "equal",
          random: () => Infinity,
        }),
      ).toBeLessThanOrEqual(500);

      expect(computeBackoffDelayMs(1, -50, { maxDelayMs: Infinity })).toBe(0);
    });
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
