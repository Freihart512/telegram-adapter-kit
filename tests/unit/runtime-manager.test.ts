import { afterEach, describe, expect, it, vi } from "vitest";
import type { TelegramAdapterResolver } from "../../src/contracts/adapter.js";
import type { TelegramProviderAdapter } from "../../src/contracts/adapter.js";
import type { IncomingMessageEvent } from "../../src/contracts/events.js";
import type {
  RegisterBotInput,
  RegisterSubscriptionInput,
} from "../../src/contracts/operations.js";
import type { Logger } from "../../src/index.js";
import { BotRegistry } from "../../src/core/bot-registry.js";
import { SubscriptionRegistry } from "../../src/core/subscription-registry.js";
import {
  BotAlreadyExistsError,
  BotNotFoundError,
  BotNotStartedError,
  createRuntimeManager,
  LifecycleConflictError,
  RuntimeManager,
  SubscriptionAlreadyExistsError,
  SubscriptionNotFoundError,
  OperationCancelledError,
  OperationTimeoutError,
  TransientNetworkError,
  ValidationError,
} from "../../src/index.js";

const credentials = {
  kind: "botApi" as const,
  botToken: "12345678:abcdefghijklmnopqrstuvwxyzABCDEF",
};

const registerInput = (botId: string): RegisterBotInput => ({
  botId,
  credentials,
});

function createMockAdapter(): {
  adapter: TelegramProviderAdapter;
  getInbound(bindingId: string): ((e: IncomingMessageEvent) => void | Promise<void>) | undefined;
} {
  const inboundHandlers = new Map<string, (event: IncomingMessageEvent) => void | Promise<void>>();

  const adapter: TelegramProviderAdapter = {
    kind: "botApi",
    capabilities: Object.freeze({
      supportsOutgoingForumTopics: true,
      supportsIncomingForumTopics: true,
      supportsDynamicSubscriptions: true,
    }),
    registerBot: vi.fn(async () => {}),
    unregisterBot: vi.fn(async () => {}),
    startBot: vi.fn(async () => {}),
    stopBot: vi.fn(async () => {}),
    sendMessage: vi.fn(async (input) => ({
      botId: input.botId,
      chatId: String(input.chatId),
      messageId: 1,
      date: new Date("2026-01-01T00:00:00.000Z"),
      raw: {},
    })),
    bindIncomingMessages: vi.fn(async (binding: RegisterSubscriptionInput, onMessage) => {
      inboundHandlers.set(binding.bindingId, onMessage);
    }),
    unbindIncomingMessages: vi.fn(async (bindingId: string) => {
      inboundHandlers.delete(bindingId);
    }),
    cleanupBot: vi.fn(async () => {}),
  };

  return {
    adapter,
    getInbound(bindingId: string) {
      return inboundHandlers.get(bindingId);
    },
  };
}

function createMockLogger(): Logger {
  return {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };
}

function resolverFor(adapter: TelegramProviderAdapter): TelegramAdapterResolver {
  return {
    resolve: () => adapter,
    resolveByBotId: () => adapter,
  };
}

describe("RuntimeManager (TT-015)", () => {
  it("registerBot invokes adapter then start/stop/unregister with cleanup", async () => {
    const { adapter } = createMockAdapter();
    const mgr = createRuntimeManager(resolverFor(adapter));

    await mgr.registerBot(registerInput("bot-1"));
    expect(adapter.registerBot).toHaveBeenCalledTimes(1);

    await mgr.startBot("bot-1");
    expect(adapter.startBot).toHaveBeenCalledTimes(1);

    await mgr.stopBot("bot-1");
    expect(adapter.stopBot).toHaveBeenCalledTimes(1);

    await mgr.unregisterBot("bot-1");
    expect(adapter.unregisterBot).toHaveBeenCalledTimes(1);
    expect(adapter.cleanupBot).toHaveBeenCalledTimes(1);
  });

  it("supports injected logger and records key flow events", async () => {
    const { adapter } = createMockAdapter();
    const logger = createMockLogger();
    const mgr = new RuntimeManager(resolverFor(adapter), { logger });

    await mgr.registerBot(registerInput("logs"));
    await mgr.startBot("logs");
    await mgr.registerSubscription({ bindingId: "logs-b", botId: "logs", chatId: 1 });
    await mgr.sendMessage({ botId: "logs", chatId: 1, text: "hello logs" });
    await mgr.unregisterSubscription("logs-b");
    await mgr.stopBot("logs");
    await mgr.unregisterBot("logs");

    expect(logger.debug).toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalled();
    expect(logger.warn).not.toHaveBeenCalled();
    expect(logger.error).not.toHaveBeenCalled();
  });

  it("logs and emits runtime error when adapter call fails", async () => {
    const { adapter } = createMockAdapter();
    const logger = createMockLogger();
    adapter.startBot = vi.fn(async () => {
      throw new Error("boom start");
    });
    const mgr = new RuntimeManager(resolverFor(adapter), { logger });
    const onError = vi.fn();
    mgr.onError(onError);

    await mgr.registerBot(registerInput("err-log"));
    await expect(mgr.startBot("err-log")).rejects.toBeInstanceOf(TransientNetworkError);

    expect(logger.error).toHaveBeenCalledWith(
      "runtime operation failed",
      expect.objectContaining({
        operation: "startBot",
        code: "TRANSIENT_NETWORK",
        botId: "err-log",
      }),
    );
    expect(onError).toHaveBeenCalledWith(expect.any(TransientNetworkError));
  });

  it("rolls back bot registry when adapter.registerBot throws, then register works", async () => {
    const { adapter } = createMockAdapter();
    const registerMock = vi
      .fn()
      .mockRejectedValueOnce(new Error("provider failed"))
      .mockResolvedValue(undefined);
    adapter.registerBot = registerMock;
    const mgr = new RuntimeManager(resolverFor(adapter));

    await expect(mgr.registerBot(registerInput("x"))).rejects.toBeInstanceOf(TransientNetworkError);

    await mgr.registerBot(registerInput("x"));
    await mgr.startBot("x");
    await mgr.stopBot("x");
    await mgr.unregisterBot("x");

    expect(registerMock).toHaveBeenCalledTimes(2);
  });

  it("sendMessage requires started bot", async () => {
    const { adapter } = createMockAdapter();
    const mgr = new RuntimeManager(resolverFor(adapter));

    await mgr.registerBot(registerInput("b"));
    await expect(
      mgr.sendMessage({ botId: "b", chatId: -100n, text: "nope" }),
    ).rejects.toBeInstanceOf(BotNotStartedError);

    await mgr.startBot("b");
    await expect(mgr.sendMessage({ botId: "b", chatId: -100n, text: "ok" })).resolves.toMatchObject(
      {
        messageId: 1,
      },
    );
    expect(adapter.sendMessage).toHaveBeenCalledOnce();
  });

  it("unregisterBot runs adapter unregister/cleanup before clearing local subscription index", async () => {
    const bots = new BotRegistry();
    const subs = new SubscriptionRegistry((id) => bots.get(id) !== undefined);
    const order: string[] = [];
    const { adapter } = createMockAdapter();

    adapter.unbindIncomingMessages = vi.fn(async () => {
      order.push("unbind");
    });
    adapter.unregisterBot = vi.fn(async () => {
      order.push("adapterUnregisterBot");
    });
    adapter.cleanupBot = vi.fn(async () => {
      order.push("cleanupBot");
    });

    const origUnregisterByBot = subs.unregisterByBotId.bind(subs);
    vi.spyOn(subs, "unregisterByBotId").mockImplementation((id) => {
      order.push("localUnregisterByBotId");
      return origUnregisterByBot(id);
    });

    const mgr = new RuntimeManager(resolverFor(adapter), {
      botRegistry: bots,
      subscriptionRegistry: subs,
    });

    await mgr.registerBot(registerInput("ord"));
    await mgr.startBot("ord");
    await mgr.registerSubscription({ bindingId: "b-a", botId: "ord", chatId: 1 });
    await mgr.registerSubscription({ bindingId: "b-b", botId: "ord", chatId: 2 });
    await mgr.stopBot("ord");
    await mgr.unregisterBot("ord");

    expect(order).toEqual(["cleanupBot", "adapterUnregisterBot", "localUnregisterByBotId"]);
  });

  it("unregisterBot after stopBot skips adapter unbind and runs cleanup then unregister", async () => {
    const { adapter, getInbound } = createMockAdapter();
    const mgr = new RuntimeManager(resolverFor(adapter));

    await mgr.registerBot(registerInput("multi"));
    await mgr.startBot("multi");
    await mgr.registerSubscription({
      bindingId: "s1",
      botId: "multi",
      chatId: -100n,
    });
    await mgr.registerSubscription({
      bindingId: "s2",
      botId: "multi",
      chatId: -200n,
    });
    expect(getInbound("s1")).toBeDefined();
    expect(getInbound("s2")).toBeDefined();

    await mgr.stopBot("multi");
    await mgr.unregisterBot("multi");

    expect(adapter.unbindIncomingMessages).not.toHaveBeenCalled();
    expect(adapter.cleanupBot).toHaveBeenCalledOnce();
    expect(adapter.unregisterBot).toHaveBeenCalledOnce();
  });

  it("registerSubscription forwards filtered messages to onMessage", async () => {
    const { adapter, getInbound } = createMockAdapter();
    const mgr = new RuntimeManager(resolverFor(adapter));
    const onMessage = vi.fn();

    mgr.onMessage(onMessage);
    await mgr.registerBot(registerInput("feed"));
    await mgr.startBot("feed");
    await mgr.registerSubscription({
      bindingId: "b1",
      botId: "feed",
      chatId: -100n,
      filters: { textIncludes: ["ping"] },
    });

    const deliver = getInbound("b1");

    expect(deliver).toBeDefined();

    await deliver!({
      botId: "feed",
      chatId: "-100",
      messageId: 1,
      text: "ignored",
      date: new Date(),
      raw: {},
    });
    expect(onMessage).not.toHaveBeenCalled();

    await deliver!({
      botId: "feed",
      chatId: "-100",
      messageId: 2,
      text: "got ping!",
      date: new Date(),
      raw: {},
    });
    expect(onMessage).toHaveBeenCalledTimes(1);
    expect(onMessage.mock.calls[0]![0]!.messageId).toBe(2);
  });

  it("registerSubscription rolls back registry when bind fails", async () => {
    const { adapter } = createMockAdapter();
    const bindMock = vi
      .fn()
      .mockRejectedValueOnce(new Error("bind failed"))
      .mockResolvedValue(undefined);
    adapter.bindIncomingMessages = bindMock;

    const mgr = new RuntimeManager(resolverFor(adapter));

    await mgr.registerBot(registerInput("rollback"));
    await mgr.startBot("rollback");

    await expect(
      mgr.registerSubscription({
        bindingId: "lost",
        botId: "rollback",
        chatId: 1,
      }),
    ).rejects.toBeInstanceOf(TransientNetworkError);

    await mgr.registerSubscription({
      bindingId: "lost",
      botId: "rollback",
      chatId: 1,
    });

    expect(bindMock).toHaveBeenCalledTimes(2);

    await mgr.unregisterSubscription("lost");
    await mgr.stopBot("rollback");
    await mgr.unregisterBot("rollback");
  });

  it("unregisterSubscription unbinds then removes registry entry", async () => {
    const { adapter, getInbound } = createMockAdapter();
    const mgr = new RuntimeManager(resolverFor(adapter));

    await mgr.registerBot(registerInput("solo"));
    await mgr.startBot("solo");
    await mgr.registerSubscription({ bindingId: "one", botId: "solo", chatId: 1 });
    expect(getInbound("one")).toBeDefined();

    await mgr.unregisterSubscription("one");
    expect(adapter.unbindIncomingMessages).toHaveBeenCalledWith("one", undefined);
    expect(getInbound("one")).toBeUndefined();
  });

  it("unregisterSubscription throws SubscriptionNotFoundError for unknown id", async () => {
    const { adapter } = createMockAdapter();
    const mgr = new RuntimeManager(resolverFor(adapter));
    await mgr.registerBot(registerInput("e"));
    await mgr.startBot("e");

    await expect(mgr.unregisterSubscription("missing")).rejects.toBeInstanceOf(
      SubscriptionNotFoundError,
    );
    expect(adapter.unbindIncomingMessages).not.toHaveBeenCalled();
  });

  it("unregisterBot rejects when bot is still started without adapter cleanup", async () => {
    const { adapter } = createMockAdapter();
    const mgr = new RuntimeManager(resolverFor(adapter));

    await mgr.registerBot(registerInput("run"));
    await mgr.startBot("run");
    await expect(mgr.unregisterBot("run")).rejects.toBeInstanceOf(LifecycleConflictError);
    expect(adapter.cleanupBot).not.toHaveBeenCalled();
    expect(adapter.unregisterBot).not.toHaveBeenCalled();

    await mgr.stopBot("run");
    await expect(mgr.unregisterBot("run")).resolves.toBeUndefined();
    expect(adapter.cleanupBot).toHaveBeenCalledOnce();
    expect(adapter.unregisterBot).toHaveBeenCalledOnce();
  });

  it("unregisterBot rejects from error without touching adapter", async () => {
    const bots = new BotRegistry();
    const { adapter } = createMockAdapter();
    adapter.stopBot = vi.fn(async () => {
      throw new Error("stop failed");
    });
    const mgr = new RuntimeManager(resolverFor(adapter), { botRegistry: bots });

    await mgr.registerBot(registerInput("err-unreg"));
    await mgr.startBot("err-unreg");
    await expect(mgr.stopBot("err-unreg")).rejects.toThrow("stop failed");
    expect(bots.get("err-unreg")?.status).toBe("error");

    await expect(mgr.unregisterBot("err-unreg")).rejects.toBeInstanceOf(LifecycleConflictError);
    expect(adapter.cleanupBot).not.toHaveBeenCalled();
    expect(adapter.unregisterBot).not.toHaveBeenCalled();
  });

  it("unregisterSubscription unbinds from adapter when bot is in error", async () => {
    const bots = new BotRegistry();
    const { adapter } = createMockAdapter();
    adapter.stopBot = vi.fn(async () => {
      throw new Error("stop failed");
    });
    const mgr = new RuntimeManager(resolverFor(adapter), { botRegistry: bots });

    await mgr.registerBot(registerInput("err-sub"));
    await mgr.startBot("err-sub");
    await mgr.registerSubscription({ bindingId: "bind-err", botId: "err-sub", chatId: 1n });
    await expect(mgr.stopBot("err-sub")).rejects.toThrow("stop failed");
    expect(bots.get("err-sub")?.status).toBe("error");

    await mgr.unregisterSubscription("bind-err");
    expect(adapter.unbindIncomingMessages).toHaveBeenCalledWith("bind-err", undefined);
  });

  it("emits bot state changes on register and start (including starting)", async () => {
    const { adapter } = createMockAdapter();
    const mgr = new RuntimeManager(resolverFor(adapter));
    const onState = vi.fn();

    mgr.onBotStateChange(onState);

    await mgr.registerBot(registerInput("s"));
    expect(onState).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ botId: "s", status: "registered" }),
    );

    await mgr.startBot("s");
    expect(onState).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ botId: "s", status: "starting", previousStatus: "registered" }),
    );
    expect(onState).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({ botId: "s", status: "started", previousStatus: "starting" }),
    );
  });

  it("emits stopping then stopped when stopping a started bot", async () => {
    const { adapter } = createMockAdapter();
    const mgr = new RuntimeManager(resolverFor(adapter));
    const onState = vi.fn();

    mgr.onBotStateChange(onState);

    await mgr.registerBot(registerInput("st"));
    await mgr.startBot("st");
    onState.mockClear();

    await mgr.stopBot("st");

    expect(onState).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ botId: "st", status: "stopping", previousStatus: "started" }),
    );
    expect(onState).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ botId: "st", status: "stopped", previousStatus: "stopping" }),
    );
  });

  it("maps string throws from adapter to ValidationError", async () => {
    const { adapter } = createMockAdapter();
    adapter.registerBot = vi.fn(async () => {
      throw "bad";
    });
    const mgr = new RuntimeManager(resolverFor(adapter));

    await expect(mgr.registerBot(registerInput("bad-str"))).rejects.toBeInstanceOf(ValidationError);
  });

  it("reject duplicate bot registration via registry", async () => {
    const { adapter } = createMockAdapter();
    const mgr = new RuntimeManager(resolverFor(adapter));

    await mgr.registerBot(registerInput("dup"));
    await expect(mgr.registerBot(registerInput("dup"))).rejects.toBeInstanceOf(
      BotAlreadyExistsError,
    );
    expect(adapter.registerBot).toHaveBeenCalledTimes(1);
  });

  it("reject duplicate subscription id", async () => {
    const { adapter } = createMockAdapter();
    const mgr = new RuntimeManager(resolverFor(adapter));

    await mgr.registerBot(registerInput("subbot"));
    await mgr.startBot("subbot");
    await mgr.registerSubscription({ bindingId: "same", botId: "subbot", chatId: 1 });

    await expect(
      mgr.registerSubscription({ bindingId: "same", botId: "subbot", chatId: 1 }),
    ).rejects.toBeInstanceOf(SubscriptionAlreadyExistsError);
  });

  it("reject unknown bot for startBot", async () => {
    const { adapter } = createMockAdapter();
    const mgr = new RuntimeManager(resolverFor(adapter));

    await expect(mgr.startBot("nope")).rejects.toBeInstanceOf(BotNotFoundError);
    expect(adapter.startBot).not.toHaveBeenCalled();
  });

  it("startBot emits error state when adapter.startBot fails", async () => {
    const { adapter } = createMockAdapter();
    adapter.startBot = vi.fn(async () => {
      throw new Error("cannot start");
    });
    const mgr = new RuntimeManager(resolverFor(adapter));
    const onState = vi.fn();

    mgr.onBotStateChange(onState);

    await mgr.registerBot(registerInput("err"));
    await expect(mgr.startBot("err")).rejects.toThrow();

    expect(adapter.startBot).toHaveBeenCalledOnce();
    expect(onState).toHaveBeenLastCalledWith(
      expect.objectContaining({ botId: "err", status: "error", previousStatus: "starting" }),
    );
  });

  describe("input validation (TT-016)", () => {
    it("registerBot rejects invalid input before calling adapter", async () => {
      const { adapter } = createMockAdapter();
      const mgr = new RuntimeManager(resolverFor(adapter));

      await expect(
        mgr.registerBot({ botId: "", credentials } as RegisterBotInput),
      ).rejects.toBeInstanceOf(ValidationError);
      await expect(
        mgr.registerBot({
          botId: "bot",
          credentials: { kind: "botApi", botToken: "stub" },
        } as RegisterBotInput),
      ).rejects.toBeInstanceOf(ValidationError);

      expect(adapter.registerBot).not.toHaveBeenCalled();
    });

    it("startBot, stopBot and unregisterBot reject empty botId", async () => {
      const { adapter } = createMockAdapter();
      const mgr = new RuntimeManager(resolverFor(adapter));

      await expect(mgr.startBot("")).rejects.toBeInstanceOf(ValidationError);
      await expect(mgr.stopBot("")).rejects.toBeInstanceOf(ValidationError);
      await expect(mgr.unregisterBot("")).rejects.toBeInstanceOf(ValidationError);
      expect(adapter.startBot).not.toHaveBeenCalled();
      expect(adapter.stopBot).not.toHaveBeenCalled();
      expect(adapter.unregisterBot).not.toHaveBeenCalled();
    });

    it("registerSubscription rejects invalid binding before calling adapter", async () => {
      const { adapter } = createMockAdapter();
      const mgr = new RuntimeManager(resolverFor(adapter));

      await mgr.registerBot(registerInput("v"));
      await mgr.startBot("v");

      await expect(
        mgr.registerSubscription({ bindingId: "", botId: "v", chatId: 1 }),
      ).rejects.toBeInstanceOf(ValidationError);
      await expect(
        mgr.registerSubscription({ bindingId: "b", botId: "v", chatId: 0 }),
      ).rejects.toBeInstanceOf(ValidationError);
      await expect(
        mgr.registerSubscription({ bindingId: "b", botId: "v", chatId: 1, topicId: 0 }),
      ).rejects.toBeInstanceOf(ValidationError);

      expect(adapter.bindIncomingMessages).not.toHaveBeenCalled();
    });

    it("unregisterSubscription rejects empty bindingId", async () => {
      const { adapter } = createMockAdapter();
      const mgr = new RuntimeManager(resolverFor(adapter));
      await expect(mgr.unregisterSubscription("")).rejects.toBeInstanceOf(ValidationError);
      expect(adapter.unbindIncomingMessages).not.toHaveBeenCalled();
    });

    it("sendMessage rejects invalid payload before calling adapter", async () => {
      const { adapter } = createMockAdapter();
      const mgr = new RuntimeManager(resolverFor(adapter));

      await mgr.registerBot(registerInput("s"));
      await mgr.startBot("s");

      await expect(mgr.sendMessage({ botId: "s", chatId: 1, text: "" })).rejects.toBeInstanceOf(
        ValidationError,
      );
      await expect(mgr.sendMessage({ botId: "", chatId: 1, text: "hi" })).rejects.toBeInstanceOf(
        ValidationError,
      );

      expect(adapter.sendMessage).not.toHaveBeenCalled();
    });

    it("on* handlers reject non-functions", () => {
      const { adapter } = createMockAdapter();
      const mgr = new RuntimeManager(resolverFor(adapter));

      expect(() => mgr.onMessage("nope" as unknown as () => void)).toThrow(ValidationError);
      expect(() => mgr.onError(null as unknown as () => void)).toThrow(ValidationError);
      expect(() => mgr.onBotStateChange(undefined as unknown as () => void)).toThrow(
        ValidationError,
      );
    });

    it("public methods reject malformed OperationOptions", async () => {
      const { adapter } = createMockAdapter();
      const mgr = new RuntimeManager(resolverFor(adapter));

      await expect(mgr.registerBot(registerInput("opt"), { timeoutMs: -1 })).rejects.toBeInstanceOf(
        ValidationError,
      );
      await expect(
        mgr.startBot("opt", { signal: "bad" as unknown as AbortSignal }),
      ).rejects.toBeInstanceOf(ValidationError);

      expect(adapter.registerBot).not.toHaveBeenCalled();
      expect(adapter.startBot).not.toHaveBeenCalled();
    });

    it("filter is taken from the registry snapshot, not from the caller's mutable input", async () => {
      const { adapter, getInbound } = createMockAdapter();
      const mgr = new RuntimeManager(resolverFor(adapter));
      const onMessage = vi.fn();
      mgr.onMessage(onMessage);

      await mgr.registerBot(registerInput("filter"));
      await mgr.startBot("filter");

      const input = {
        bindingId: "f1",
        botId: "filter",
        chatId: 1,
        filters: { textIncludes: ["ping"] },
      };
      await mgr.registerSubscription(input);
      input.filters.textIncludes.push("pong");

      const deliver = getInbound("f1")!;

      await deliver({
        botId: "filter",
        chatId: "1",
        messageId: 1,
        text: "pong",
        date: new Date(),
        raw: {},
      });
      expect(onMessage).not.toHaveBeenCalled();

      await deliver({
        botId: "filter",
        chatId: "1",
        messageId: 2,
        text: "ping!",
        date: new Date(),
        raw: {},
      });
      expect(onMessage).toHaveBeenCalledTimes(1);
    });
  });
});

describe("RuntimeManager retry (TT-026)", () => {
  it("retries transient startBot failures then succeeds", async () => {
    const { adapter } = createMockAdapter();
    const logger = createMockLogger();
    adapter.startBot = vi
      .fn()
      .mockRejectedValueOnce(new TransientNetworkError("transient"))
      .mockResolvedValue(undefined);

    const mgr = new RuntimeManager(resolverFor(adapter), {
      logger,
      retryPolicy: { maxRetries: 2, baseDelayMs: 1 },
    });
    const onError = vi.fn();
    mgr.onError(onError);

    await mgr.registerBot(registerInput("retry"));
    await mgr.startBot("retry");

    expect(adapter.startBot).toHaveBeenCalledTimes(2);
    expect(logger.warn).toHaveBeenCalledWith(
      "retrying transient operation failure",
      expect.objectContaining({ operation: "startBot", botId: "retry" }),
    );
    expect(onError).not.toHaveBeenCalled();
  });

  it("does not retry validation errors from adapter", async () => {
    const { adapter } = createMockAdapter();
    adapter.startBot = vi.fn(async () => {
      throw new ValidationError("bad input");
    });

    const mgr = new RuntimeManager(resolverFor(adapter), {
      retryPolicy: { maxRetries: 3, baseDelayMs: 1 },
    });

    await mgr.registerBot(registerInput("no-retry"));
    await expect(mgr.startBot("no-retry")).rejects.toBeInstanceOf(ValidationError);
    expect(adapter.startBot).toHaveBeenCalledTimes(1);
  });

  it("does not retry when retryPolicy maxRetries is 0", async () => {
    const { adapter } = createMockAdapter();
    adapter.startBot = vi.fn(async () => {
      throw new TransientNetworkError("transient");
    });

    const mgr = new RuntimeManager(resolverFor(adapter), {
      retryPolicy: { maxRetries: 0, baseDelayMs: 1 },
    });

    await mgr.registerBot(registerInput("no-retry-policy"));
    await expect(mgr.startBot("no-retry-policy")).rejects.toBeInstanceOf(TransientNetworkError);
    expect(adapter.startBot).toHaveBeenCalledTimes(1);
  });
});

describe("RuntimeManager per-operation retry (TT-046)", () => {
  it("does not retry sendMessage on TransientNetworkError even with global retries", async () => {
    const { adapter } = createMockAdapter();
    adapter.sendMessage = vi.fn(async () => {
      throw new TransientNetworkError("ambiguous send failure");
    });

    const mgr = new RuntimeManager(resolverFor(adapter), {
      retryPolicy: { maxRetries: 3, baseDelayMs: 1 },
    });

    await mgr.registerBot(registerInput("send-once"));
    await mgr.startBot("send-once");

    await expect(
      mgr.sendMessage({ botId: "send-once", chatId: 1, text: "hi" }),
    ).rejects.toBeInstanceOf(TransientNetworkError);

    expect(adapter.sendMessage).toHaveBeenCalledTimes(1);
  });

  it("still retries startBot according to global retry policy", async () => {
    const { adapter } = createMockAdapter();
    adapter.startBot = vi
      .fn()
      .mockRejectedValueOnce(new TransientNetworkError("transient"))
      .mockResolvedValue(undefined);

    const mgr = new RuntimeManager(resolverFor(adapter), {
      retryPolicy: { maxRetries: 2, baseDelayMs: 1 },
    });

    await mgr.registerBot(registerInput("start-retry"));
    await mgr.startBot("start-retry");

    expect(adapter.startBot).toHaveBeenCalledTimes(2);
  });
});

describe("RuntimeManager operation control (TT-045)", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("startBot rejects with OperationTimeoutError when an attempt hangs", async () => {
    vi.useFakeTimers();
    const { adapter } = createMockAdapter();
    adapter.startBot = vi.fn(
      () =>
        new Promise<void>(() => {
          /* hang */
        }),
    );

    const mgr = new RuntimeManager(resolverFor(adapter), {
      retryPolicy: { maxRetries: 0, baseDelayMs: 1 },
    });

    await mgr.registerBot(registerInput("timeout-bot"));
    const pending = mgr.startBot("timeout-bot", { timeoutMs: 1000 });
    const assertion = expect(pending).rejects.toBeInstanceOf(OperationTimeoutError);

    await vi.advanceTimersByTimeAsync(1000);
    await assertion;
    expect(adapter.startBot).toHaveBeenCalledTimes(1);
  });

  it("sendMessage rejects with OperationCancelledError when aborted in flight", async () => {
    const { adapter } = createMockAdapter();
    const controller = new AbortController();
    adapter.sendMessage = vi.fn(
      () =>
        new Promise<never>(() => {
          /* hang */
        }),
    );

    const mgr = new RuntimeManager(resolverFor(adapter));
    await mgr.registerBot(registerInput("cancel-send"));
    await mgr.startBot("cancel-send");

    const pending = mgr.sendMessage(
      { botId: "cancel-send", chatId: 1, text: "hi" },
      { signal: controller.signal },
    );
    controller.abort();

    await expect(pending).rejects.toBeInstanceOf(OperationCancelledError);
    expect(adapter.sendMessage).toHaveBeenCalledTimes(1);
  });

  it("succeeds when timeoutMs is generous", async () => {
    const { adapter } = createMockAdapter();
    const mgr = new RuntimeManager(resolverFor(adapter));

    await mgr.registerBot(registerInput("ok-timeout"));
    await mgr.startBot("ok-timeout", { timeoutMs: 60_000 });
    const result = await mgr.sendMessage(
      { botId: "ok-timeout", chatId: 1, text: "hello" },
      { timeoutMs: 60_000 },
    );

    expect(result.messageId).toBe(1);
    expect(adapter.sendMessage).toHaveBeenCalledTimes(1);
  });

  it("retries startBot with timeoutMs applied per attempt", async () => {
    const { adapter } = createMockAdapter();
    adapter.startBot = vi
      .fn()
      .mockRejectedValueOnce(new TransientNetworkError("transient"))
      .mockResolvedValue(undefined);

    const mgr = new RuntimeManager(resolverFor(adapter), {
      retryPolicy: { maxRetries: 1, baseDelayMs: 1 },
    });

    await mgr.registerBot(registerInput("retry-timeout"));
    await mgr.startBot("retry-timeout", { timeoutMs: 5000 });

    expect(adapter.startBot).toHaveBeenCalledTimes(2);
  });
});

describe("RuntimeManager lifecycle reconciliation (TT-047)", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("marks error on startBot timeout without waiting for cleanup", async () => {
    vi.useFakeTimers();
    const { adapter } = createMockAdapter();
    const bots = new BotRegistry();
    let resolveCleanup: (() => void) | undefined;
    adapter.startBot = vi.fn(
      () =>
        new Promise<void>(() => {
          /* hang */
        }),
    );
    adapter.cleanupBot = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveCleanup = resolve;
        }),
    );

    const mgr = new RuntimeManager(resolverFor(adapter), {
      botRegistry: bots,
      retryPolicy: { maxRetries: 0, baseDelayMs: 1 },
    });
    const onError = vi.fn();
    mgr.onError(onError);

    await mgr.registerBot(registerInput("reconcile-start"));
    const pending = mgr.startBot("reconcile-start", { timeoutMs: 1000 });
    const assertion = expect(pending).rejects.toBeInstanceOf(OperationTimeoutError);

    await vi.advanceTimersByTimeAsync(1000);
    await assertion;

    expect(bots.get("reconcile-start")?.status).toBe("error");
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ code: "OPERATION_TIMEOUT" }));
    expect(adapter.cleanupBot).toHaveBeenCalled();
    resolveCleanup?.();
    await vi.runOnlyPendingTimersAsync();
  });

  it("rejects startBot timeout when cleanupBot hangs", async () => {
    vi.useFakeTimers();
    const { adapter } = createMockAdapter();
    const bots = new BotRegistry();
    adapter.startBot = vi.fn(
      () =>
        new Promise<void>(() => {
          /* hang */
        }),
    );
    adapter.cleanupBot = vi.fn(
      () =>
        new Promise<void>(() => {
          /* hang forever */
        }),
    );

    const mgr = new RuntimeManager(resolverFor(adapter), {
      botRegistry: bots,
      retryPolicy: { maxRetries: 0, baseDelayMs: 1 },
    });

    await mgr.registerBot(registerInput("cleanup-hang"));
    const pending = mgr.startBot("cleanup-hang", { timeoutMs: 1000 });
    const assertion = expect(pending).rejects.toBeInstanceOf(OperationTimeoutError);

    await vi.advanceTimersByTimeAsync(1000);
    await assertion;

    expect(bots.get("cleanup-hang")?.status).toBe("error");
  });

  it("reverts to started on stopBot cancellation and emits onError", async () => {
    const { adapter } = createMockAdapter();
    const bots = new BotRegistry();
    const controller = new AbortController();
    adapter.stopBot = vi.fn(
      () =>
        new Promise<void>(() => {
          /* hang */
        }),
    );

    const mgr = new RuntimeManager(resolverFor(adapter), { botRegistry: bots });
    const onError = vi.fn();
    mgr.onError(onError);

    await mgr.registerBot(registerInput("reconcile-stop"));
    await mgr.startBot("reconcile-stop");

    const pending = mgr.stopBot("reconcile-stop", { signal: controller.signal });
    controller.abort();

    await expect(pending).rejects.toBeInstanceOf(OperationCancelledError);
    expect(bots.get("reconcile-stop")?.status).toBe("started");
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ code: "OPERATION_CANCELLED" }));
  });

  it("marks error on non-operational stopBot failure", async () => {
    const { adapter } = createMockAdapter();
    const bots = new BotRegistry();
    adapter.stopBot = vi.fn(async () => {
      throw new ValidationError("stop failed");
    });

    const mgr = new RuntimeManager(resolverFor(adapter), { botRegistry: bots });
    const onError = vi.fn();
    mgr.onError(onError);

    await mgr.registerBot(registerInput("stop-val"));
    await mgr.startBot("stop-val");

    await expect(mgr.stopBot("stop-val")).rejects.toBeInstanceOf(ValidationError);

    expect(bots.get("stop-val")?.status).toBe("error");
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ code: "VALIDATION_ERROR" }));
  });

  it("marks error on non-operational startBot failure", async () => {
    const { adapter } = createMockAdapter();
    const bots = new BotRegistry();
    adapter.startBot = vi.fn(async () => {
      throw new ValidationError("bad");
    });

    const mgr = new RuntimeManager(resolverFor(adapter), { botRegistry: bots });

    await mgr.registerBot(registerInput("start-val"));
    await expect(mgr.startBot("start-val")).rejects.toBeInstanceOf(ValidationError);

    expect(bots.get("start-val")?.status).toBe("error");
  });

  it("rolls back registerSubscription when bind fails", async () => {
    const { adapter } = createMockAdapter();
    const subs = new SubscriptionRegistry((botId) => botId === "sub-bot");
    adapter.bindIncomingMessages = vi.fn(async () => {
      throw new OperationTimeoutError("bind timed out");
    });

    const mgr = new RuntimeManager(resolverFor(adapter), {
      subscriptionRegistry: subs,
    });

    await mgr.registerBot(registerInput("sub-bot"));
    await mgr.startBot("sub-bot");

    await expect(
      mgr.registerSubscription({ bindingId: "b1", botId: "sub-bot", chatId: 1 }),
    ).rejects.toBeInstanceOf(OperationTimeoutError);

    expect(subs.get("b1")).toBeUndefined();
  });
});
