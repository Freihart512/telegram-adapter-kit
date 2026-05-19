import { describe, expect, it } from "vitest";
import type { TelegramAdapterResolver } from "../../src/contracts/adapter.js";
import { GramJsMtprotoAdapter } from "../../src/adapters/telegram/mtproto/gramjs-adapter.js";
import { BotNotFoundError, RuntimeManager } from "../../src/index.js";
import { createMockGramJsClient, mtprotoRegisterInput } from "./support/gramjs-fixtures.js";

function resolverFor(adapter: GramJsMtprotoAdapter): TelegramAdapterResolver {
  return { resolve: () => adapter, resolveByBotId: () => adapter };
}

describe("RuntimeManager + GramJsMtprotoAdapter integration (TT-027)", () => {
  it("register → bind → start → stop → unregister completes without error", async () => {
    const client = createMockGramJsClient();
    const adapter = new GramJsMtprotoAdapter(() => client);
    const mgr = new RuntimeManager(resolverFor(adapter));

    await mgr.registerBot(mtprotoRegisterInput("int-1"));
    await mgr.startBot("int-1");
    await mgr.registerSubscription({
      bindingId: "sub-1",
      botId: "int-1",
      chatId: 100n,
    });
    await mgr.stopBot("int-1");
    await expect(mgr.unregisterBot("int-1")).resolves.toBeUndefined();

    await expect(mgr.startBot("int-1")).rejects.toBeInstanceOf(BotNotFoundError);
  });

  it("unregisterSubscription after stopBot succeeds when adapter bindings were cleared", async () => {
    const client = createMockGramJsClient();
    const adapter = new GramJsMtprotoAdapter(() => client);
    const mgr = new RuntimeManager(resolverFor(adapter));

    await mgr.registerBot(mtprotoRegisterInput("int-2"));
    await mgr.startBot("int-2");
    await mgr.registerSubscription({
      bindingId: "sub-2",
      botId: "int-2",
      chatId: 200n,
    });
    await mgr.stopBot("int-2");

    await expect(mgr.unregisterSubscription("sub-2")).resolves.toBeUndefined();
  });
});
