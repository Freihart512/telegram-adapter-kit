import { describe, expect, it, vi } from "vitest";
import { EventBus, HandlerExecutionError, ValidationError } from "../../src/index.js";

describe("EventBus (TT-014)", () => {
  it("fan-outs events to multiple handlers", () => {
    const bus = new EventBus();
    const h1 = vi.fn();
    const h2 = vi.fn();

    bus.onMessage(h1);
    bus.onMessage(h2);

    bus.emitMessage({
      botId: "bot-1",
      chatId: "-100",
      messageId: 10,
      text: "hello",
      date: new Date("2026-01-01T00:00:00.000Z"),
      raw: { source: "test" },
    });

    expect(h1).toHaveBeenCalledTimes(1);
    expect(h2).toHaveBeenCalledTimes(1);
  });

  it("emits HandlerExecutionError when a non-error handler throws", () => {
    const bus = new EventBus();
    const cause = new Error("handler boom");
    const onError = vi.fn();

    bus.onMessage(() => {
      throw cause;
    });
    bus.onError(onError);

    bus.emitMessage({
      botId: "bot-1",
      chatId: "-100",
      messageId: 1,
      text: "x",
      date: new Date("2026-01-01T00:00:00.000Z"),
      raw: {},
    });

    expect(onError).toHaveBeenCalledTimes(1);
    const err = onError.mock.calls[0]![0] as HandlerExecutionError;
    expect(err).toBeInstanceOf(HandlerExecutionError);
    expect(err.code).toBe("HANDLER_EXECUTION_FAILED");
    expect(err.cause).toBe(cause);
    expect(err.meta).toEqual({ channel: "message" });
  });

  it("isolates handler exceptions so others still receive events", () => {
    const bus = new EventBus();
    const good = vi.fn();

    bus.onError(() => {
      throw new Error("boom");
    });
    bus.onError(good);

    bus.emitError(new ValidationError("invalid"));

    expect(good).toHaveBeenCalledTimes(1);
  });

  it("unsubscribe stops delivery for that handler", () => {
    const bus = new EventBus();
    const handler = vi.fn();

    const off = bus.onBotStateChange(handler);
    off();

    bus.emitBotStateChange({
      botId: "bot-2",
      status: "started",
      at: new Date("2026-01-01T00:00:00.000Z"),
    });

    expect(handler).not.toHaveBeenCalled();
  });

  it("generic subscribe/publish works for each channel", () => {
    const bus = new EventBus();
    const onState = vi.fn();

    bus.subscribe("botStateChange", onState);
    bus.publish("botStateChange", {
      botId: "bot-3",
      status: "stopped",
      at: new Date("2026-01-01T00:00:00.000Z"),
      previousStatus: "stopping",
    });

    expect(onState).toHaveBeenCalledTimes(1);
  });
});
