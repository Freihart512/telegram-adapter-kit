import { describe, expect, it, vi } from "vitest";
import type {
  GramJsSendMessageRawResult,
  SendMessageInput,
} from "../../src/index.js";
import {
  BotNotFoundError,
  BotNotStartedError,
  CapabilityNotSupportedError,
  GramJsMtprotoAdapter,
  SendMessageError,
} from "../../src/index.js";
import type { GramJsMtprotoClient } from "../../src/adapters/telegram/mtproto/gramjs-adapter.js";

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

function createMockClient(
  sendResult?: GramJsSendMessageRawResult,
  sendError?: Error,
): GramJsMtprotoClient & { sendMessage: ReturnType<typeof vi.fn> } {
  return {
    connect: vi.fn(async () => {}),
    disconnect: vi.fn(async () => {}),
    addEventHandler: vi.fn(),
    removeEventHandler: vi.fn(),
    sendMessage: vi.fn(async () => {
      if (sendError) throw sendError;
      return sendResult ?? { id: 1, date: 1700000000 };
    }),
  };
}

function sendInput(botId: string, overrides?: Partial<SendMessageInput>): SendMessageInput {
  return {
    botId,
    chatId: 100n,
    text: "hello",
    ...overrides,
  };
}

describe("GramJsMtprotoAdapter sendMessage (TT-023)", () => {
  it("sends message and returns normalized result", async () => {
    const client = createMockClient({ id: 99, date: 1700000000 });
    const adapter = new GramJsMtprotoAdapter(() => client);
    await adapter.registerBot(mtprotoInput("b1"));
    await adapter.startBot("b1");

    const result = await adapter.sendMessage(sendInput("b1"));

    expect(result).toMatchObject({
      botId: "b1",
      chatId: "100",
      messageId: 99,
    });
    expect(result.date).toBeInstanceOf(Date);
    expect(result.date!.getTime()).toBe(1700000000 * 1000);
    expect(result.raw).toEqual({ id: 99, date: 1700000000 });
  });

  it("passes parseMode to client", async () => {
    const client = createMockClient();
    const adapter = new GramJsMtprotoAdapter(() => client);
    await adapter.registerBot(mtprotoInput("b1"));
    await adapter.startBot("b1");

    await adapter.sendMessage(sendInput("b1", { parseMode: "html" }));

    expect(client.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({ parseMode: "html" }),
    );
  });

  it("passes replyToMessageId to client as replyTo", async () => {
    const client = createMockClient();
    const adapter = new GramJsMtprotoAdapter(() => client);
    await adapter.registerBot(mtprotoInput("b1"));
    await adapter.startBot("b1");

    await adapter.sendMessage(sendInput("b1", { replyToMessageId: 42 }));

    expect(client.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({ replyTo: 42 }),
    );
  });

  it("maps disableLinkPreview to linkPreview: false", async () => {
    const client = createMockClient();
    const adapter = new GramJsMtprotoAdapter(() => client);
    await adapter.registerBot(mtprotoInput("b1"));
    await adapter.startBot("b1");

    await adapter.sendMessage(sendInput("b1", { disableLinkPreview: true }));

    expect(client.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({ linkPreview: false }),
    );
  });

  it("does not set linkPreview when disableLinkPreview is not specified", async () => {
    const client = createMockClient();
    const adapter = new GramJsMtprotoAdapter(() => client);
    await adapter.registerBot(mtprotoInput("b1"));
    await adapter.startBot("b1");

    await adapter.sendMessage(sendInput("b1"));

    expect(client.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({ linkPreview: undefined }),
    );
  });

  it("handles different chatId formats consistently", async () => {
    const client = createMockClient({ id: 1, date: 1700000000 });
    const adapter = new GramJsMtprotoAdapter(() => client);
    await adapter.registerBot(mtprotoInput("b1"));
    await adapter.startBot("b1");

    const bigintResult = await adapter.sendMessage(sendInput("b1", { chatId: 100n }));
    const numberResult = await adapter.sendMessage(sendInput("b1", { chatId: 100 }));
    const stringResult = await adapter.sendMessage(sendInput("b1", { chatId: "100" }));

    expect(bigintResult.chatId).toBe("100");
    expect(numberResult.chatId).toBe("100");
    expect(stringResult.chatId).toBe("100");
  });

  it("rejects send when bot is not found", async () => {
    const adapter = new GramJsMtprotoAdapter(() => createMockClient());

    await expect(
      adapter.sendMessage(sendInput("missing")),
    ).rejects.toBeInstanceOf(BotNotFoundError);
  });

  it("rejects send when bot is not started", async () => {
    const adapter = new GramJsMtprotoAdapter(() => createMockClient());
    await adapter.registerBot(mtprotoInput("b1"));

    await expect(
      adapter.sendMessage(sendInput("b1")),
    ).rejects.toBeInstanceOf(BotNotStartedError);
  });

  it("rejects send when client lacks sendMessage capability", async () => {
    const adapter = new GramJsMtprotoAdapter(() => ({
      connect: vi.fn(async () => {}),
      disconnect: vi.fn(async () => {}),
    }));
    await adapter.registerBot(mtprotoInput("b1"));
    await adapter.startBot("b1");

    await expect(
      adapter.sendMessage(sendInput("b1")),
    ).rejects.toBeInstanceOf(CapabilityNotSupportedError);
  });

  it("wraps client send failure in SendMessageError", async () => {
    const client = createMockClient(undefined, new Error("permission denied"));
    const adapter = new GramJsMtprotoAdapter(() => client);
    await adapter.registerBot(mtprotoInput("b1"));
    await adapter.startBot("b1");

    const err = await adapter.sendMessage(sendInput("b1")).catch((e: unknown) => e);

    expect(err).toBeInstanceOf(SendMessageError);
    expect((err as SendMessageError).message).toBe("Failed to send message");
    expect((err as SendMessageError).cause).toBeInstanceOf(Error);
  });

  it("logs success on send", async () => {
    const client = createMockClient({ id: 10, date: 1700000000 });
    const logger = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    const adapter = new GramJsMtprotoAdapter(() => client, { logger });
    await adapter.registerBot(mtprotoInput("b1"));
    await adapter.startBot("b1");

    await adapter.sendMessage(sendInput("b1"));

    expect(logger.info).toHaveBeenCalledWith(
      "mtproto message sent",
      expect.objectContaining({ botId: "b1", messageId: 10 }),
    );
  });

  it("logs failure on send error", async () => {
    const client = createMockClient(undefined, new Error("fail"));
    const logger = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    const adapter = new GramJsMtprotoAdapter(() => client, { logger });
    await adapter.registerBot(mtprotoInput("b1"));
    await adapter.startBot("b1");

    await adapter.sendMessage(sendInput("b1")).catch(() => {});

    expect(logger.error).toHaveBeenCalledWith(
      "mtproto message send failed",
      expect.objectContaining({ botId: "b1" }),
    );
  });

  it("returns result with no date when raw result lacks date", async () => {
    const client = createMockClient({ id: 5 });
    const adapter = new GramJsMtprotoAdapter(() => client);
    await adapter.registerBot(mtprotoInput("b1"));
    await adapter.startBot("b1");

    const result = await adapter.sendMessage(sendInput("b1"));

    expect(result.messageId).toBe(5);
    expect(result.date).toBeUndefined();
  });
});
