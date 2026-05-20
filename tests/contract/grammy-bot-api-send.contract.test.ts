import { describe, expect, it } from "vitest";
import {
  BotApiAdapter,
  BotNotStartedError,
  CapabilityNotSupportedError,
  SendMessageError,
} from "../../src/index.js";
import {
  botApiRegisterInput,
  createMockGrammyClient,
  sendMessageInput,
} from "./support/grammy-fixtures.js";

describe("BotApiAdapter sendMessage (TT-028)", () => {
  it("sends message and returns normalized result", async () => {
    const client = createMockGrammyClient({ sendResult: { message_id: 99, date: 1700000000 } });
    const adapter = new BotApiAdapter(() => client);
    await adapter.registerBot(botApiRegisterInput("b1"));
    await adapter.startBot("b1");

    const result = await adapter.sendMessage(sendMessageInput("b1"));

    expect(result).toMatchObject({ botId: "b1", chatId: "100", messageId: 99 });
    expect(result.date).toBeInstanceOf(Date);
    expect(client.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({ chatId: 100, text: "hello" }),
    );
  });

  it("passes bigint chatId as string without precision loss", async () => {
    const largeChatId = 9007199254740993n;
    const client = createMockGrammyClient();
    const adapter = new BotApiAdapter(() => client);
    await adapter.registerBot(botApiRegisterInput("big"));
    await adapter.startBot("big");

    await adapter.sendMessage(sendMessageInput("big", { chatId: largeChatId }));

    expect(client.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({ chatId: "9007199254740993" }),
    );
  });

  it("passes topicId and parseMode to client", async () => {
    const client = createMockGrammyClient();
    const adapter = new BotApiAdapter(() => client);
    await adapter.registerBot(botApiRegisterInput("b1"));
    await adapter.startBot("b1");

    await adapter.sendMessage(sendMessageInput("b1", { topicId: 7, parseMode: "html" }));

    expect(client.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({ topicId: 7, parseMode: "html" }),
    );
  });

  it("rejects send when bot is not started", async () => {
    const adapter = new BotApiAdapter(() => createMockGrammyClient());
    await adapter.registerBot(botApiRegisterInput("b1"));
    await expect(adapter.sendMessage(sendMessageInput("b1"))).rejects.toBeInstanceOf(
      BotNotStartedError,
    );
  });

  it("rejects topic send when capabilities disable forum topics", async () => {
    const adapter = new BotApiAdapter(() => createMockGrammyClient(), {
      capabilities: {
        supportsOutgoingForumTopics: false,
        supportsIncomingForumTopics: true,
        supportsDynamicSubscriptions: true,
      },
    });
    await adapter.registerBot(botApiRegisterInput("b1"));
    await adapter.startBot("b1");

    await expect(
      adapter.sendMessage(sendMessageInput("b1", { topicId: 3 })),
    ).rejects.toBeInstanceOf(CapabilityNotSupportedError);
  });

  it("maps provider send failure to SendMessageError", async () => {
    const client = createMockGrammyClient({
      sendError: Object.assign(new Error("Forbidden"), {
        error_code: 403,
        description: "Forbidden",
        ok: false,
        method: "sendMessage",
      }),
    });
    const adapter = new BotApiAdapter(() => client);
    await adapter.registerBot(botApiRegisterInput("b1"));
    await adapter.startBot("b1");

    await expect(adapter.sendMessage(sendMessageInput("b1"))).rejects.toBeInstanceOf(
      SendMessageError,
    );
  });
});
