import { describe, expect, it } from "vitest";
import type { GrammyMessageContext } from "../../src/adapters/telegram/bot-api/bot-api-adapter.js";
import {
  BotApiAdapter,
  BotNotStartedError,
  SubscriptionAlreadyExistsError,
} from "../../src/index.js";
import { botApiRegisterInput, createMockGrammyClient } from "./support/grammy-fixtures.js";

function makeCtx(
  overrides?: Partial<GrammyMessageContext["message"]> & { chatId?: number },
): GrammyMessageContext {
  return {
    chat: { id: overrides?.chatId ?? 100 },
    message: {
      message_id: 1,
      text: "hello",
      date: 1700000000,
      ...overrides,
    },
  };
}

describe("BotApiAdapter incoming bindings (TT-028)", () => {
  it("delivers normalized event to bound handler", async () => {
    const client = createMockGrammyClient();
    const adapter = new BotApiAdapter(() => client);
    const received: unknown[] = [];

    await adapter.registerBot(botApiRegisterInput("b1"));
    await adapter.startBot("b1");
    await adapter.bindIncomingMessages({ bindingId: "s1", botId: "b1", chatId: 100 }, (e) =>
      received.push(e),
    );

    await client.emit(makeCtx());

    expect(received).toHaveLength(1);
    expect(received[0]).toMatchObject({ botId: "b1", chatId: "100", messageId: 1 });
  });

  it("filters events by chatId and topicId", async () => {
    const client = createMockGrammyClient();
    const adapter = new BotApiAdapter(() => client);
    const received: unknown[] = [];

    await adapter.registerBot(botApiRegisterInput("b1"));
    await adapter.startBot("b1");
    await adapter.bindIncomingMessages(
      { bindingId: "s1", botId: "b1", chatId: 100, topicId: 5 },
      (e) => received.push(e),
    );

    await client.emit(makeCtx({ chatId: 200 }));
    await client.emit(makeCtx({ message_thread_id: 5 }));
    await client.emit(makeCtx({ message_thread_id: 9 }));

    expect(received).toHaveLength(1);
    expect((received[0] as { topicId?: number }).topicId).toBe(5);
  });

  it("unbinding stops event delivery", async () => {
    const client = createMockGrammyClient();
    const adapter = new BotApiAdapter(() => client);
    const received: unknown[] = [];

    await adapter.registerBot(botApiRegisterInput("b1"));
    await adapter.startBot("b1");
    await adapter.bindIncomingMessages({ bindingId: "s1", botId: "b1", chatId: 100 }, (e) =>
      received.push(e),
    );
    await client.emit(makeCtx());
    await adapter.unbindIncomingMessages("s1");
    await client.emit(makeCtx());

    expect(received).toHaveLength(1);
  });

  it("rejects bind when bot is not started", async () => {
    const adapter = new BotApiAdapter(() => createMockGrammyClient());
    await adapter.registerBot(botApiRegisterInput("b1"));
    await expect(
      adapter.bindIncomingMessages({ bindingId: "s1", botId: "b1", chatId: 100 }, () => {}),
    ).rejects.toBeInstanceOf(BotNotStartedError);
  });

  it("rejects duplicate binding", async () => {
    const client = createMockGrammyClient();
    const adapter = new BotApiAdapter(() => client);
    await adapter.registerBot(botApiRegisterInput("b1"));
    await adapter.startBot("b1");
    await adapter.bindIncomingMessages({ bindingId: "dup", botId: "b1", chatId: 100 }, () => {});
    await expect(
      adapter.bindIncomingMessages({ bindingId: "dup", botId: "b1", chatId: 100 }, () => {}),
    ).rejects.toBeInstanceOf(SubscriptionAlreadyExistsError);
  });
});
