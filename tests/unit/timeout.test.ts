import { afterEach, describe, expect, it, vi } from "vitest";
import { withTimeout } from "../../src/utils/timeout.js";
import { OperationTimeoutError } from "../../src/index.js";

describe("withTimeout (TT-044)", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("delegates to fn when no timeout or signal", async () => {
    const fn = vi.fn(async () => "ok");
    await expect(withTimeout(fn)).resolves.toBe("ok");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("succeeds when fn completes within timeoutMs", async () => {
    const fn = vi.fn(async () => 42);
    await expect(withTimeout(fn, { timeoutMs: 500 })).resolves.toBe(42);
  });

  it("rejects with OperationTimeoutError when fn hangs", async () => {
    vi.useFakeTimers();
    const fn = vi.fn(
      () =>
        new Promise<string>(() => {
          /* never settles */
        }),
    );

    const pending = withTimeout(fn, {
      timeoutMs: 1000,
      operation: "startBot",
      meta: { botId: "b1" },
    });
    const assertion = expect(pending).rejects.toMatchObject({
      code: "OPERATION_TIMEOUT",
      meta: { operation: "startBot", botId: "b1", timeoutMs: 1000 },
    });

    await vi.advanceTimersByTimeAsync(1000);
    await assertion;
  });

  it("clears timer when fn completes quickly (no late timeout rejection)", async () => {
    vi.useFakeTimers();
    const fn = vi.fn(async () => "fast");

    const result = await withTimeout(fn, { timeoutMs: 5000 });
    expect(result).toBe("fast");

    await vi.advanceTimersByTimeAsync(10_000);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("rejects with OperationCancelledError when signal is already aborted", async () => {
    const controller = new AbortController();
    controller.abort();
    const fn = vi.fn(async () => "nope");

    await expect(
      withTimeout(fn, { signal: controller.signal, operation: "sendMessage" }),
    ).rejects.toMatchObject({
      code: "OPERATION_CANCELLED",
      meta: { operation: "sendMessage" },
    });
    expect(fn).not.toHaveBeenCalled();
  });

  it("rejects with OperationCancelledError when aborted during fn", async () => {
    const controller = new AbortController();
    const fn = vi.fn(
      () =>
        new Promise<string>(() => {
          /* hang until abort */
        }),
    );

    const pending = withTimeout(fn, { signal: controller.signal });
    controller.abort();

    await expect(pending).rejects.toMatchObject({ code: "OPERATION_CANCELLED" });
  });

  it("propagates async fn errors and cleans up timeout resources", async () => {
    vi.useFakeTimers();
    const controller = new AbortController();
    const removeSpy = vi.spyOn(controller.signal, "removeEventListener");
    const err = new Error("adapter failed");
    const fn = vi.fn(async () => {
      throw err;
    });

    await expect(withTimeout(fn, { timeoutMs: 5000, signal: controller.signal })).rejects.toBe(err);

    expect(removeSpy).toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(10_000);
    removeSpy.mockRestore();
  });

  it("propagates synchronous fn throws and cleans up timer and abort listener", async () => {
    vi.useFakeTimers();
    const controller = new AbortController();
    const removeSpy = vi.spyOn(controller.signal, "removeEventListener");
    const fn = vi.fn(() => {
      throw new Error("sync boom");
    });

    await expect(withTimeout(fn, { timeoutMs: 5000, signal: controller.signal })).rejects.toThrow(
      "sync boom",
    );

    expect(removeSpy).toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(10_000);
    removeSpy.mockRestore();
  });

  it("timeout wins over slow fn when both timeout and signal are set", async () => {
    vi.useFakeTimers();
    const controller = new AbortController();
    const fn = vi.fn(
      () =>
        new Promise<string>(() => {
          /* hang */
        }),
    );

    const pending = withTimeout(fn, { timeoutMs: 500, signal: controller.signal });
    const assertion = expect(pending).rejects.toBeInstanceOf(OperationTimeoutError);

    await vi.advanceTimersByTimeAsync(500);
    await assertion;
  });

  it("removes abort listener after successful completion", async () => {
    const controller = new AbortController();
    const addSpy = vi.spyOn(controller.signal, "addEventListener");
    const removeSpy = vi.spyOn(controller.signal, "removeEventListener");

    await withTimeout(async () => "done", { signal: controller.signal });

    expect(addSpy).toHaveBeenCalled();
    expect(removeSpy).toHaveBeenCalled();
    addSpy.mockRestore();
    removeSpy.mockRestore();
  });
});
