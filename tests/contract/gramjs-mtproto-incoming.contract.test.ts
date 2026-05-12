import { describe, expect, it, vi } from "vitest";
import type {
  GramJsRawEvent,
  IncomingMessageEvent,
  RegisterSubscriptionInput,
} from "../../src/index.js";
import {
  BotNotStartedError,
  CapabilityNotSupportedError,
  GramJsMtprotoAdapter,
  SubscriptionAlreadyExistsError,
  SubscriptionNotFoundError,
} from "../../src/index.js";
import type { GramJsEventHandler, GramJsMtprotoClient } from "../../src/adapters/telegram/mtproto/gramjs-adapter.js";

function mtprotoInput(botId: string) {
  return {
    botId,
    credentials: {
      kind: "mtproto" as const,
      apiId: 123456,
      apiHash: "api-hash",
      stringSession: "string-session",
    },
  };
}

type MockClient = GramJsMtprotoClient & {
  handlers: GramJsEventHandler[];
  emit(event: GramJsRawEvent): void;
};

function createMockClient(): MockClient {
  const handlers: GramJsEventHandler[] = [];
  return {
    handlers,
    connect: vi.fn(async () => {}),
    disconnect: vi.fn(async () => {}),
    addEventHandler: vi.fn((h: GramJsEventHandler) => {
      handlers.push(h);
    }),
    removeEventHandler: vi.fn((h: GramJsEventHandler) => {
      const idx = handlers.indexOf(h);
      if (idx >= 0) handlers.splice(idx, 1);
    }),
    emit(event: GramJsRawEvent) {
      for (const h of [...handlers]) h(event);
    },
  };
}

function makeRawEvent(overrides?: Partial<NonNullable<GramJsRawEvent["message"]>>): GramJsRawEvent {
  return {
    message: {
      id: 42,
      message: "hello world",
      date: 1700000000,
      peerId: { channelId: 100n },
      ...overrides,
    },
  };
}

function binding(botId: string, bindingId: string, chatId: bigint | number | string = 100n): RegisterSubscriptionInput {
  return { bindingId, botId, chatId };
}

describe("GramJsMtprotoAdapter incoming bindings (TT-022)", () => {
  it("delivers normalized event to bound handler", async () => {
    const client = createMockClient();
    const adapter = new GramJsMtprotoAdapter(() => client);
    await adapter.registerBot(mtprotoInput("b1"));
    await adapter.startBot("b1");

    const received: IncomingMessageEvent[] = [];
    await adapter.bindIncomingMessages(binding("b1", "sub-1"), (e) => received.push(e));

    client.emit(makeRawEvent());

    expect(received).toHaveLength(1);
    expect(received[0]).toMatchObject({
      botId: "b1",
      chatId: "100",
      messageId: 42,
      text: "hello world",
    });
    expect(received[0]!.date).toBeInstanceOf(Date);
    expect(received[0]!.raw).toBeDefined();
  });

  it("filters events by chatId", async () => {
    const client = createMockClient();
    const adapter = new GramJsMtprotoAdapter(() => client);
    await adapter.registerBot(mtprotoInput("b1"));
    await adapter.startBot("b1");

    const received: IncomingMessageEvent[] = [];
    await adapter.bindIncomingMessages(binding("b1", "s1", 200n), (e) => received.push(e));

    client.emit(makeRawEvent({ peerId: { channelId: 100n } }));
    client.emit(makeRawEvent({ peerId: { channelId: 200n } }));

    expect(received).toHaveLength(1);
    expect(received[0]!.chatId).toBe("200");
  });

  it("filters events by topicId when specified", async () => {
    const client = createMockClient();
    const adapter = new GramJsMtprotoAdapter(() => client);
    await adapter.registerBot(mtprotoInput("b1"));
    await adapter.startBot("b1");

    const received: IncomingMessageEvent[] = [];
    const sub: RegisterSubscriptionInput = { bindingId: "s1", botId: "b1", chatId: 100n, topicId: 5 };
    await adapter.bindIncomingMessages(sub, (e) => received.push(e));

    client.emit(makeRawEvent({ replyTo: { replyToTopId: 5, replyToMsgId: 1 } }));
    client.emit(makeRawEvent({ replyTo: { replyToTopId: 9, replyToMsgId: 2 } }));
    client.emit(makeRawEvent());

    expect(received).toHaveLength(1);
    expect(received[0]!.topicId).toBe(5);
  });

  it("applies textIncludes filter", async () => {
    const client = createMockClient();
    const adapter = new GramJsMtprotoAdapter(() => client);
    await adapter.registerBot(mtprotoInput("b1"));
    await adapter.startBot("b1");

    const received: IncomingMessageEvent[] = [];
    const sub: RegisterSubscriptionInput = {
      bindingId: "s1",
      botId: "b1",
      chatId: 100n,
      filters: { textIncludes: ["important"] },
    };
    await adapter.bindIncomingMessages(sub, (e) => received.push(e));

    client.emit(makeRawEvent({ message: "not relevant" }));
    client.emit(makeRawEvent({ message: "this is important data" }));

    expect(received).toHaveLength(1);
    expect(received[0]!.text).toBe("this is important data");
  });

  it("unbinding stops event delivery", async () => {
    const client = createMockClient();
    const adapter = new GramJsMtprotoAdapter(() => client);
    await adapter.registerBot(mtprotoInput("b1"));
    await adapter.startBot("b1");

    const received: IncomingMessageEvent[] = [];
    await adapter.bindIncomingMessages(binding("b1", "s1"), (e) => received.push(e));

    client.emit(makeRawEvent());
    expect(received).toHaveLength(1);

    await adapter.unbindIncomingMessages("s1");

    client.emit(makeRawEvent());
    expect(received).toHaveLength(1);
    expect(client.removeEventHandler).toHaveBeenCalledTimes(1);
  });

  it("rejects bind when bot is not started", async () => {
    const adapter = new GramJsMtprotoAdapter(() => createMockClient());
    await adapter.registerBot(mtprotoInput("b1"));

    await expect(
      adapter.bindIncomingMessages(binding("b1", "s1"), () => {}),
    ).rejects.toBeInstanceOf(BotNotStartedError);
  });

  it("rejects duplicate binding with typed error", async () => {
    const client = createMockClient();
    const adapter = new GramJsMtprotoAdapter(() => client);
    await adapter.registerBot(mtprotoInput("b1"));
    await adapter.startBot("b1");

    await adapter.bindIncomingMessages(binding("b1", "dup"), () => {});
    await expect(
      adapter.bindIncomingMessages(binding("b1", "dup"), () => {}),
    ).rejects.toBeInstanceOf(SubscriptionAlreadyExistsError);
  });

  it("rejects unbind for unknown binding", async () => {
    const adapter = new GramJsMtprotoAdapter(() => createMockClient());
    await expect(
      adapter.unbindIncomingMessages("does-not-exist"),
    ).rejects.toBeInstanceOf(SubscriptionNotFoundError);
  });

  it("stopBot removes all bindings", async () => {
    const client = createMockClient();
    const adapter = new GramJsMtprotoAdapter(() => client);
    await adapter.registerBot(mtprotoInput("b1"));
    await adapter.startBot("b1");

    const received: IncomingMessageEvent[] = [];
    await adapter.bindIncomingMessages(binding("b1", "s1"), (e) => received.push(e));
    await adapter.bindIncomingMessages(binding("b1", "s2", 200n), (e) => received.push(e));

    await adapter.stopBot("b1");

    expect(client.removeEventHandler).toHaveBeenCalledTimes(2);
  });

  it("cleanupBot removes bindings and client", async () => {
    const client = createMockClient();
    const adapter = new GramJsMtprotoAdapter(() => client);
    await adapter.registerBot(mtprotoInput("b1"));
    await adapter.startBot("b1");

    await adapter.bindIncomingMessages(binding("b1", "s1"), () => {});
    await adapter.cleanupBot("b1");

    expect(client.removeEventHandler).toHaveBeenCalledTimes(1);
    expect(client.disconnect).toHaveBeenCalledTimes(1);
  });

  it("handles multiple bots with isolated bindings", async () => {
    const clientA = createMockClient();
    const clientB = createMockClient();
    let counter = 0;
    const adapter = new GramJsMtprotoAdapter(() => {
      counter++;
      return counter === 1 ? clientA : clientB;
    });

    await adapter.registerBot(mtprotoInput("a"));
    await adapter.registerBot({
      botId: "b",
      credentials: { kind: "mtproto", apiId: 2, apiHash: "h2", stringSession: "s2" },
    });
    await adapter.startBot("a");
    await adapter.startBot("b");

    const eventsA: IncomingMessageEvent[] = [];
    const eventsB: IncomingMessageEvent[] = [];

    await adapter.bindIncomingMessages(binding("a", "sa", 100n), (e) => eventsA.push(e));
    await adapter.bindIncomingMessages(binding("b", "sb", 200n), (e) => eventsB.push(e));

    clientA.emit(makeRawEvent({ peerId: { channelId: 100n } }));
    clientB.emit(makeRawEvent({ peerId: { channelId: 200n } }));

    expect(eventsA).toHaveLength(1);
    expect(eventsB).toHaveLength(1);
    expect(eventsA[0]!.botId).toBe("a");
    expect(eventsB[0]!.botId).toBe("b");
  });

  it("ignores raw events without message payload", async () => {
    const client = createMockClient();
    const adapter = new GramJsMtprotoAdapter(() => client);
    await adapter.registerBot(mtprotoInput("b1"));
    await adapter.startBot("b1");

    const received: IncomingMessageEvent[] = [];
    await adapter.bindIncomingMessages(binding("b1", "s1"), (e) => received.push(e));

    client.emit({});
    client.emit({ message: undefined });

    expect(received).toHaveLength(0);
  });

  it("resolves chatId from different peerId variants", async () => {
    const client = createMockClient();
    const adapter = new GramJsMtprotoAdapter(() => client);
    await adapter.registerBot(mtprotoInput("b1"));
    await adapter.startBot("b1");

    const received: IncomingMessageEvent[] = [];
    await adapter.bindIncomingMessages(binding("b1", "s1", 55n), (e) => received.push(e));

    client.emit(makeRawEvent({ peerId: { chatId: 55n } }));
    expect(received).toHaveLength(1);
    expect(received[0]!.chatId).toBe("55");
  });

  it("rejects bind when client lacks addEventHandler", async () => {
    const adapter = new GramJsMtprotoAdapter(() => ({
      connect: vi.fn(async () => {}),
      disconnect: vi.fn(async () => {}),
    }));
    await adapter.registerBot(mtprotoInput("b1"));
    await adapter.startBot("b1");

    await expect(
      adapter.bindIncomingMessages(binding("b1", "s1"), () => {}),
    ).rejects.toBeInstanceOf(CapabilityNotSupportedError);
  });

  it("does not store binding if addEventHandler throws", async () => {
    const adapter = new GramJsMtprotoAdapter(() => ({
      connect: vi.fn(async () => {}),
      disconnect: vi.fn(async () => {}),
      addEventHandler: vi.fn(() => {
        throw new Error("handler registration failed");
      }),
      removeEventHandler: vi.fn(),
    }));
    await adapter.registerBot(mtprotoInput("b1"));
    await adapter.startBot("b1");

    await expect(
      adapter.bindIncomingMessages(binding("b1", "s1"), () => {}),
    ).rejects.toThrow();

    await expect(
      adapter.unbindIncomingMessages("s1"),
    ).rejects.toBeInstanceOf(SubscriptionNotFoundError);
  });

  it("removeAllBindings continues even if removeEventHandler throws", async () => {
    const client = createMockClient();
    client.removeEventHandler = vi.fn(() => {
      throw new Error("remove failed");
    });
    const logger = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    const adapter = new GramJsMtprotoAdapter(() => client, { logger });
    await adapter.registerBot(mtprotoInput("b1"));
    await adapter.startBot("b1");

    await adapter.bindIncomingMessages(binding("b1", "s1"), () => {});
    await adapter.bindIncomingMessages(binding("b1", "s2", 200n), () => {});

    await adapter.stopBot("b1");

    expect(client.removeEventHandler).toHaveBeenCalledTimes(2);
    expect(logger.warn).toHaveBeenCalledTimes(2);
  });

  it("handler error is caught and logged, does not crash adapter", async () => {
    const client = createMockClient();
    const logger = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    const adapter = new GramJsMtprotoAdapter(() => client, { logger });
    await adapter.registerBot(mtprotoInput("b1"));
    await adapter.startBot("b1");

    const onMessage = vi.fn(() => {
      throw new Error("handler boom");
    });
    await adapter.bindIncomingMessages(binding("b1", "s1"), onMessage);

    expect(() => client.emit(makeRawEvent())).not.toThrow();
    expect(logger.error).toHaveBeenCalledWith(
      "binding handler error",
      expect.objectContaining({ bindingId: "s1" }),
    );
  });
});
