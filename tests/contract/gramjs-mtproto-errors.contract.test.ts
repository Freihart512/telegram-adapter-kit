import { describe, expect, it } from "vitest";
import {
  GramJsMtprotoAdapter,
  SendMessageError,
  TransientNetworkError,
  ValidationError,
} from "../../src/index.js";
import {
  createMockGramJsClient,
  mtprotoRegisterInput,
  sendMessageInput,
} from "./support/gramjs-fixtures.js";

/**
 * Adapter-boundary error mapping (TT-027 / UC-007).
 * Uses a controlled GramJS client harness — no live Telegram credentials.
 */
describe("GramJsMtprotoAdapter error mapping contracts (TT-027)", () => {
  it("maps connect auth/session failures to typed SDK errors", async () => {
    const client = createMockGramJsClient({
      connectError: { errorMessage: "AUTH_KEY_UNHEALTHY" },
    });
    const adapter = new GramJsMtprotoAdapter(() => client);
    await adapter.registerBot(mtprotoRegisterInput("auth-fail"));

    await expect(adapter.startBot("auth-fail")).rejects.toBeInstanceOf(TransientNetworkError);
  });

  it("maps FLOOD_WAIT on startBot to TransientNetworkError", async () => {
    const client = createMockGramJsClient({
      connectError: { errorMessage: "FLOOD_WAIT_5" },
    });
    const adapter = new GramJsMtprotoAdapter(() => client);
    await adapter.registerBot(mtprotoRegisterInput("flood"));

    const err = await adapter.startBot("flood").catch((e: unknown) => e);
    expect(err).toBeInstanceOf(TransientNetworkError);
    expect((err as TransientNetworkError).meta?.providerCode).toBe("FLOOD_WAIT_5");
  });

  it("maps PEER_ID_INVALID on sendMessage to ValidationError", async () => {
    const client = createMockGramJsClient({
      sendError: { errorMessage: "PEER_ID_INVALID" },
    });
    const adapter = new GramJsMtprotoAdapter(() => client);
    await adapter.registerBot(mtprotoRegisterInput("peer"));
    await adapter.startBot("peer");

    await expect(adapter.sendMessage(sendMessageInput("peer"))).rejects.toBeInstanceOf(
      ValidationError,
    );
  });

  it("maps CHAT_WRITE_FORBIDDEN on sendMessage to SendMessageError", async () => {
    const client = createMockGramJsClient({
      sendError: { errorMessage: "CHAT_WRITE_FORBIDDEN" },
    });
    const adapter = new GramJsMtprotoAdapter(() => client);
    await adapter.registerBot(mtprotoRegisterInput("perm"));
    await adapter.startBot("perm");

    await expect(adapter.sendMessage(sendMessageInput("perm"))).rejects.toBeInstanceOf(
      SendMessageError,
    );
  });

  it("maps invalid topic provider codes to SendMessageError", async () => {
    const client = createMockGramJsClient({
      sendError: { errorMessage: "TOPIC_ID_INVALID" },
    });
    const adapter = new GramJsMtprotoAdapter(() => client);
    await adapter.registerBot(mtprotoRegisterInput("topic"));
    await adapter.startBot("topic");

    await expect(
      adapter.sendMessage(sendMessageInput("topic", { topicId: 42 })),
    ).rejects.toBeInstanceOf(SendMessageError);
  });
});
