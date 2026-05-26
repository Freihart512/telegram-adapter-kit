import { describe, expect, it, vi } from "vitest";
import { createSafeLogger } from "../../src/observability/safe-logger.js";

const BOT_TOKEN = "12345678:abcdefghijklmnopqrstuvwxyzABCDEF";

describe("createSafeLogger (TT-034)", () => {
  it("sanitizes meta before delegating to the underlying logger", () => {
    const inner = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    const logger = createSafeLogger(inner);

    logger.error("runtime operation failed", {
      operation: "registerBot",
      botToken: BOT_TOKEN,
      err: `provider said ${BOT_TOKEN}`,
    });

    expect(inner.error).toHaveBeenCalledWith(
      "runtime operation failed",
      expect.objectContaining({
        operation: "registerBot",
        botToken: "1234****",
      }),
    );
    const meta = inner.error.mock.calls[0]![1] as Record<string, unknown>;
    expect(String(meta.err)).not.toContain(BOT_TOKEN);
  });

  it("sanitizes log message text before delegating", () => {
    const inner = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    const logger = createSafeLogger(inner);

    logger.warn(`custom diagnostic leaked token ${BOT_TOKEN}`);

    const message = inner.warn.mock.calls[0]![0] as string;
    expect(message).toContain("1234****");
    expect(message).not.toContain(BOT_TOKEN);
  });
});
