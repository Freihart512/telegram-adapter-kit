import { describe, expect, it, vi } from "vitest";
import {
  BotAlreadyExistsError,
  BotNotFoundError,
  GramJsMtprotoAdapter,
  LifecycleConflictError,
  TransientNetworkError,
} from "../../src/index.js";

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

describe("GramJsMtprotoAdapter lifecycle contracts (TT-021)", () => {
  it("runs register -> start -> stop -> unregister", async () => {
    const connect = vi.fn(async () => {});
    const disconnect = vi.fn(async () => {});
    const adapter = new GramJsMtprotoAdapter(() => ({ connect, disconnect }));

    await adapter.registerBot(mtprotoInput("mt-1"));
    await adapter.startBot("mt-1");
    await adapter.stopBot("mt-1");
    await adapter.unregisterBot("mt-1");

    expect(connect).toHaveBeenCalledTimes(1);
    expect(disconnect).toHaveBeenCalledTimes(1);
  });

  it("rejects duplicate register with typed error", async () => {
    const adapter = new GramJsMtprotoAdapter(() => ({
      connect: async () => {},
      disconnect: async () => {},
    }));
    await adapter.registerBot(mtprotoInput("dup"));
    await expect(adapter.registerBot(mtprotoInput("dup"))).rejects.toBeInstanceOf(
      BotAlreadyExistsError,
    );
  });

  it("isolates multiple bots and only stops target bot connection", async () => {
    const disconnectA = vi.fn(async () => {});
    const disconnectB = vi.fn(async () => {});
    const adapter = new GramJsMtprotoAdapter((credentials) => {
      if (credentials.apiId === 1) {
        return {
          connect: async () => {},
          disconnect: disconnectA,
        };
      }
      return {
        connect: async () => {},
        disconnect: disconnectB,
      };
    });

    await adapter.registerBot({
      botId: "a",
      credentials: { kind: "mtproto", apiId: 1, apiHash: "h1", stringSession: "s1" },
    });
    await adapter.registerBot({
      botId: "b",
      credentials: { kind: "mtproto", apiId: 2, apiHash: "h2", stringSession: "s2" },
    });
    await adapter.startBot("a");
    await adapter.startBot("b");
    await adapter.stopBot("a");

    expect(disconnectA).toHaveBeenCalledTimes(1);
    expect(disconnectB).toHaveBeenCalledTimes(0);
  });

  it("rejects invalid lifecycle operations with typed errors", async () => {
    const adapter = new GramJsMtprotoAdapter(() => ({
      connect: async () => {},
      disconnect: async () => {},
    }));

    await expect(adapter.startBot("missing")).rejects.toBeInstanceOf(BotNotFoundError);

    await adapter.registerBot(mtprotoInput("state"));
    await expect(adapter.stopBot("state")).rejects.toBeInstanceOf(LifecycleConflictError);
    await adapter.startBot("state");
    await expect(adapter.startBot("state")).rejects.toBeInstanceOf(LifecycleConflictError);
    await expect(adapter.unregisterBot("state")).rejects.toBeInstanceOf(LifecycleConflictError);
  });

  it("maps client failures to SDK typed errors", async () => {
    const adapter = new GramJsMtprotoAdapter(() => ({
      connect: async () => {
        throw new Error("cannot connect");
      },
      disconnect: async () => {},
    }));
    await adapter.registerBot(mtprotoInput("err"));
    await expect(adapter.startBot("err")).rejects.toBeInstanceOf(TransientNetworkError);
  });

  it("attempts best-effort cleanup when connect fails after client creation", async () => {
    const disconnect = vi.fn(async () => {});
    const destroy = vi.fn(async () => {});
    const adapter = new GramJsMtprotoAdapter(() => ({
      connect: async () => {
        throw new Error("connect failed");
      },
      disconnect,
      destroy,
    }));

    await adapter.registerBot(mtprotoInput("partial"));
    await expect(adapter.startBot("partial")).rejects.toBeInstanceOf(TransientNetworkError);
    expect(disconnect).toHaveBeenCalledTimes(1);
    expect(destroy).toHaveBeenCalledTimes(1);
  });

  it("cleanupBot still clears adapter state even when disconnect fails", async () => {
    const destroy = vi.fn(async () => {});
    const adapter = new GramJsMtprotoAdapter(() => ({
      connect: async () => {},
      disconnect: async () => {
        throw new Error("disconnect failed");
      },
      destroy,
    }));

    await adapter.registerBot(mtprotoInput("cleanup-fail"));
    await adapter.startBot("cleanup-fail");
    await expect(adapter.cleanupBot("cleanup-fail")).rejects.toBeInstanceOf(TransientNetworkError);
    expect(destroy).toHaveBeenCalledTimes(1);
    await expect(adapter.stopBot("cleanup-fail")).rejects.toBeInstanceOf(LifecycleConflictError);
  });

  it("cleanupBot disconnects active resources without unregistering record", async () => {
    const disconnect = vi.fn(async () => {});
    const adapter = new GramJsMtprotoAdapter(() => ({
      connect: async () => {},
      disconnect,
    }));
    await adapter.registerBot(mtprotoInput("clean"));
    await adapter.startBot("clean");

    await adapter.cleanupBot("clean");
    expect(disconnect).toHaveBeenCalledTimes(1);

    await expect(adapter.stopBot("clean")).rejects.toBeInstanceOf(LifecycleConflictError);
  });
});
