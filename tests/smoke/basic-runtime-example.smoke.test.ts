import { describe, expect, it } from "vitest";
import { createBasicRuntimeHarness } from "../../examples/basic-runtime/harness.js";
import { runBasicRuntime } from "../../examples/basic-runtime/run.js";

const BOT_TOKEN = "12345678:abcdefghijklmnopqrstuvwxyzABCDEF";

describe("examples/basic-runtime smoke (TT-041)", () => {
  it("runs register → subscribe → inbound → outbound with harness", async () => {
    const harness = createBasicRuntimeHarness();
    const received: Array<{ text?: string }> = [];

    const handle = await runBasicRuntime({
      botToken: BOT_TOKEN,
      botId: "smoke-bot",
      bindingId: "smoke-binding",
      chatId: -1001234567890n,
      greetingText: "smoke-outbound",
      harness,
      onMessage: (event) => {
        received.push({ text: event.text });
      },
    });

    expect(harness.sendCalls).toHaveLength(1);
    expect(harness.sendCalls[0]?.text).toBe("smoke-outbound");

    await harness.emitInbound("smoke-binding", {
      botId: "smoke-bot",
      chatId: "-1001234567890",
      messageId: 99,
      text: "smoke-inbound",
      date: new Date("2026-01-01T00:00:00.000Z"),
      raw: {},
    });

    expect(received).toEqual([{ text: "smoke-inbound" }]);

    await handle.shutdown();
  });
});
