import { describe, expect, it } from "vitest";
import { createMtprotoRuntimeHarness } from "../../examples/mtproto-runtime/harness.js";
import { runMtprotoRuntime } from "../../examples/mtproto-runtime/run.js";

const credentials = {
  kind: "mtproto" as const,
  apiId: 1,
  apiHash: "hash",
  stringSession: "session",
};

describe("examples/mtproto-runtime smoke (TT-041)", () => {
  it("runs register → subscribe → inbound → outbound with harness", async () => {
    const harness = createMtprotoRuntimeHarness();
    const received: Array<{ text?: string }> = [];
    const chatId = -100100n;

    const handle = await runMtprotoRuntime({
      credentials,
      botId: "smoke-mtproto",
      bindingId: "smoke-mtproto-binding",
      chatId,
      greetingText: "smoke-mtproto-outbound",
      harness,
      onMessage: (event) => {
        received.push({ text: event.text });
      },
    });

    expect(harness.sendCalls).toHaveLength(1);
    expect(harness.sendCalls[0]?.text).toBe("smoke-mtproto-outbound");

    harness.client.emit({
      message: {
        id: 99,
        message: "smoke-mtproto-inbound",
        date: 1_700_000_000,
        peerId: { channelId: 100n },
      },
    });

    expect(received).toEqual([{ text: "smoke-mtproto-inbound" }]);

    await handle.shutdown();
  });
});
