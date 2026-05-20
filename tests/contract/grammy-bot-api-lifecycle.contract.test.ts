import { describe, expect, it } from "vitest";
import {
  BotAlreadyExistsError,
  BotApiAdapter,
  BotNotFoundError,
  LifecycleConflictError,
  ValidationError,
} from "../../src/index.js";
import { botApiRegisterInput, createMockGrammyClient } from "./support/grammy-fixtures.js";

describe("BotApiAdapter lifecycle contracts (TT-028)", () => {
  it("runs register -> start -> stop -> unregister", async () => {
    const client = createMockGrammyClient();
    const adapter = new BotApiAdapter(() => client);

    await adapter.registerBot(botApiRegisterInput("ba-1"));
    await adapter.startBot("ba-1");
    await adapter.stopBot("ba-1");
    await adapter.unregisterBot("ba-1");

    expect(client.init).toHaveBeenCalledTimes(1);
    expect(client.beginPolling).toHaveBeenCalledTimes(1);
    expect(client.stopPolling).toHaveBeenCalledTimes(1);
  });

  it("rejects duplicate register with typed error", async () => {
    const adapter = new BotApiAdapter(() => createMockGrammyClient());
    await adapter.registerBot(botApiRegisterInput("dup"));
    await expect(adapter.registerBot(botApiRegisterInput("dup"))).rejects.toBeInstanceOf(
      BotAlreadyExistsError,
    );
  });

  it("rejects invalid lifecycle operations with typed errors", async () => {
    const adapter = new BotApiAdapter(() => createMockGrammyClient());

    await expect(adapter.startBot("missing")).rejects.toBeInstanceOf(BotNotFoundError);

    await adapter.registerBot(botApiRegisterInput("state"));
    await expect(adapter.stopBot("state")).rejects.toBeInstanceOf(LifecycleConflictError);
    await adapter.startBot("state");
    await expect(adapter.startBot("state")).rejects.toBeInstanceOf(LifecycleConflictError);
    await expect(adapter.unregisterBot("state")).rejects.toBeInstanceOf(LifecycleConflictError);
  });

  it("cleanupBot clears dispatcher so further events are not delivered", async () => {
    const client = createMockGrammyClient();
    const adapter = new BotApiAdapter(() => client);
    const received: unknown[] = [];

    await adapter.registerBot(botApiRegisterInput("clean"));
    await adapter.startBot("clean");
    await adapter.bindIncomingMessages({ bindingId: "s1", botId: "clean", chatId: 100 }, (e) =>
      received.push(e),
    );

    await client.emit({
      chat: { id: 100 },
      message: { message_id: 1, text: "before", date: 1700000000 },
    });
    expect(received).toHaveLength(1);
    expect(client.dispatcher).not.toBeNull();

    await adapter.cleanupBot("clean");
    expect(client.dispatcher).toBeNull();

    await client.emit({
      chat: { id: 100 },
      message: { message_id: 2, text: "after", date: 1700000001 },
    });
    expect(received).toHaveLength(1);
  });

  it("stopBot clears dispatcher after removing bindings", async () => {
    const client = createMockGrammyClient();
    const adapter = new BotApiAdapter(() => client);
    const received: unknown[] = [];

    await adapter.registerBot(botApiRegisterInput("stop"));
    await adapter.startBot("stop");
    await adapter.bindIncomingMessages({ bindingId: "s1", botId: "stop", chatId: 100 }, (e) =>
      received.push(e),
    );
    expect(client.dispatcher).not.toBeNull();

    await adapter.stopBot("stop");
    expect(client.dispatcher).toBeNull();

    await client.emit({
      chat: { id: 100 },
      message: { message_id: 1, text: "late", date: 1700000000 },
    });
    expect(received).toHaveLength(0);
  });

  it("maps invalid token on startBot to ValidationError", async () => {
    const client = createMockGrammyClient({
      initError: Object.assign(new Error("Unauthorized"), {
        error_code: 401,
        description: "Unauthorized",
        ok: false,
        method: "getMe",
      }),
    });
    const adapter = new BotApiAdapter(() => client);
    await adapter.registerBot(botApiRegisterInput("auth"));
    await expect(adapter.startBot("auth")).rejects.toBeInstanceOf(ValidationError);
    expect(client.stopPolling).toHaveBeenCalled();
  });
});
