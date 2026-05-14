import { describe, expect, it } from "vitest";
import {
  GramJsMtprotoAdapter,
  mapGramJsProviderError,
  SendMessageError,
  TransientNetworkError,
  ValidationError,
} from "../../src/index.js";

describe("mapGramJsProviderError (TT-025)", () => {
  it("passes through existing TelegramSdkError unchanged when no context", () => {
    const err = new ValidationError("already typed", { meta: { field: "x" } });
    expect(mapGramJsProviderError(err)).toBe(err);
  });

  it("merges context meta into existing TelegramSdkError preserving subclass", () => {
    const err = new ValidationError("already typed", { meta: { field: "x" } });
    const mapped = mapGramJsProviderError(err, { operation: "sendMessage", botId: "b2" });
    expect(mapped).not.toBe(err);
    expect(mapped).toBeInstanceOf(ValidationError);
    expect(mapped.meta).toMatchObject({
      field: "x",
      operation: "sendMessage",
      botId: "b2",
      provider: "gramjs",
    });
    expect(mapped.message).toBe(err.message);
    expect(mapped.cause).toBe(err.cause);
  });

  it("maps GramJS-style RPC object PEER_ID_INVALID to ValidationError", () => {
    const mapped = mapGramJsProviderError(
      { errorMessage: "PEER_ID_INVALID" },
      { operation: "sendMessage", botId: "b1" },
    );
    expect(mapped).toBeInstanceOf(ValidationError);
    expect(mapped.code).toBe("VALIDATION_ERROR");
    expect(mapped.meta).toMatchObject({ provider: "gramjs", providerCode: "PEER_ID_INVALID", botId: "b1" });
    expect(mapped.cause).toEqual({ errorMessage: "PEER_ID_INVALID" });
  });

  it("maps FLOOD_WAIT to TransientNetworkError", () => {
    const mapped = mapGramJsProviderError({ errorMessage: "FLOOD_WAIT_10" });
    expect(mapped).toBeInstanceOf(TransientNetworkError);
    expect(mapped.meta?.providerCode).toBe("FLOOD_WAIT_10");
  });

  it("maps CHAT_WRITE_FORBIDDEN to SendMessageError", () => {
    const mapped = mapGramJsProviderError({ errorMessage: "CHAT_WRITE_FORBIDDEN" });
    expect(mapped).toBeInstanceOf(SendMessageError);
    expect(mapped.code).toBe("SEND_MESSAGE_FAILED");
  });

  it("maps TOPIC_CLOSED to SendMessageError", () => {
    const mapped = mapGramJsProviderError({ errorMessage: "TOPIC_CLOSED" });
    expect(mapped).toBeInstanceOf(SendMessageError);
  });

  it("maps MESSAGE_TOO_LONG to ValidationError", () => {
    const mapped = mapGramJsProviderError({ errorMessage: "MESSAGE_TOO_LONG" });
    expect(mapped).toBeInstanceOf(ValidationError);
  });

  it("extracts code from Error message when entire message is RPC token", () => {
    const mapped = mapGramJsProviderError(new Error("USERNAME_NOT_OCCUPIED"));
    expect(mapped).toBeInstanceOf(ValidationError);
  });

  it("falls back to mapUnknown for unrecognized Error message", () => {
    const mapped = mapGramJsProviderError(new Error("something went wrong"));
    expect(mapped).toBeInstanceOf(TransientNetworkError);
    expect(mapped.message).toContain("something went wrong");
  });
});

describe("GramJsMtprotoAdapter + mapGramJsProviderError integration (TT-025)", () => {
  it("startBot maps RPC FLOOD_WAIT to TransientNetworkError", async () => {
    const adapter = new GramJsMtprotoAdapter(() => ({
      connect: async () => {
        throw { errorMessage: "FLOOD_WAIT_5" };
      },
      disconnect: async () => {},
    }));
    await adapter.registerBot({
      botId: "f1",
      credentials: { kind: "mtproto", apiId: 1, apiHash: "h", stringSession: "s" },
    });
    await expect(adapter.startBot("f1")).rejects.toBeInstanceOf(TransientNetworkError);
  });

  it("sendMessage maps PEER_ID_INVALID to ValidationError", async () => {
    const adapter = new GramJsMtprotoAdapter(() => ({
      connect: async () => {},
      disconnect: async () => {},
      addEventHandler: () => {},
      removeEventHandler: () => {},
      sendMessage: async () => {
        throw { errorMessage: "PEER_ID_INVALID" };
      },
    }));
    await adapter.registerBot({
      botId: "s1",
      credentials: { kind: "mtproto", apiId: 1, apiHash: "h", stringSession: "s" },
    });
    await adapter.startBot("s1");
    await expect(
      adapter.sendMessage({ botId: "s1", chatId: 1n, text: "hi" }),
    ).rejects.toBeInstanceOf(ValidationError);
  });
});
