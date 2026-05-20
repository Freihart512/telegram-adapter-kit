import { describe, expect, it, vi } from "vitest";
import type { TelegramProviderAdapter } from "../../src/contracts/adapter.js";
import type { RegisterBotInput } from "../../src/contracts/operations.js";
import {
  BotNotFoundError,
  BotRegistry,
  createRuntimeManager,
  DefaultTelegramAdapterResolver,
  createDefaultTelegramAdapterResolverForRegistry,
  ValidationError,
} from "../../src/index.js";

const mtprotoCredentials = {
  kind: "mtproto" as const,
  apiId: 1,
  apiHash: "hash",
  stringSession: "session",
};

const botApiCredentials = {
  kind: "botApi" as const,
  botToken: "12345678:abcdefghijklmnopqrstuvwxyzABCDEF",
};

function mockAdapter(kind: "mtproto" | "botApi"): TelegramProviderAdapter {
  return {
    kind,
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
    bindIncomingMessages: vi.fn(async () => {}),
    unbindIncomingMessages: vi.fn(async () => {}),
    cleanupBot: vi.fn(async () => {}),
  };
}

describe("DefaultTelegramAdapterResolver (TT-029)", () => {
  it("resolve returns mtproto adapter for mtproto credentials", () => {
    const mtproto = mockAdapter("mtproto");
    const botApi = mockAdapter("botApi");
    const resolver = new DefaultTelegramAdapterResolver({
      getRuntimeKind: () => undefined,
      mtprotoAdapter: mtproto,
      botApiAdapter: botApi,
    });

    expect(resolver.resolve({ botId: "a", credentials: mtprotoCredentials })).toBe(mtproto);
    expect(resolver.resolve({ botId: "b", credentials: botApiCredentials })).toBe(botApi);
  });

  it("resolveByBotId uses getRuntimeKind", () => {
    const mtproto = mockAdapter("mtproto");
    const botApi = mockAdapter("botApi");
    const kinds = new Map<string, "mtproto" | "botApi">([
      ["m", "mtproto"],
      ["b", "botApi"],
    ]);
    const resolver = new DefaultTelegramAdapterResolver({
      getRuntimeKind: (id) => kinds.get(id),
      mtprotoAdapter: mtproto,
      botApiAdapter: botApi,
    });

    expect(resolver.resolveByBotId("m")).toBe(mtproto);
    expect(resolver.resolveByBotId("b")).toBe(botApi);
  });

  it("resolveByBotId throws BotNotFoundError when kind is unknown", () => {
    const resolver = new DefaultTelegramAdapterResolver({
      getRuntimeKind: () => undefined,
      mtprotoAdapter: mockAdapter("mtproto"),
      botApiAdapter: mockAdapter("botApi"),
    });

    expect(() => resolver.resolveByBotId("missing")).toThrow(BotNotFoundError);
  });

  it("resolve throws ValidationError for unsupported kind", () => {
    const resolver = new DefaultTelegramAdapterResolver({
      getRuntimeKind: () => undefined,
      mtprotoAdapter: mockAdapter("mtproto"),
      botApiAdapter: mockAdapter("botApi"),
    });

    const input = {
      botId: "x",
      credentials: { kind: "unknown", botToken: "t" },
    } as unknown as RegisterBotInput;

    expect(() => resolver.resolve(input)).toThrow(ValidationError);
  });

  it("resolve throws when mtproto adapter is not configured", () => {
    const resolver = new DefaultTelegramAdapterResolver({
      getRuntimeKind: () => undefined,
      botApiAdapter: mockAdapter("botApi"),
    });

    expect(() => resolver.resolve({ botId: "m", credentials: mtprotoCredentials })).toThrow(
      /MTProto adapter is not configured/,
    );
  });

  it("createDefaultTelegramAdapterResolverForRegistry reads runtimeKind from registry", () => {
    const registry = new BotRegistry();
    registry.register({ botId: "m", credentials: mtprotoCredentials });
    const mtproto = mockAdapter("mtproto");
    const botApi = mockAdapter("botApi");
    const resolver = createDefaultTelegramAdapterResolverForRegistry(registry, {
      mtprotoAdapter: mtproto,
      botApiAdapter: botApi,
    });

    expect(resolver.resolveByBotId("m")).toBe(mtproto);
  });
});

describe("RuntimeManager + DefaultTelegramAdapterResolver (TT-029)", () => {
  it("fails startBot when resolver and runtime use different BotRegistry instances", async () => {
    const mtproto = mockAdapter("mtproto");
    const resolver = createDefaultTelegramAdapterResolverForRegistry(new BotRegistry(), {
      mtprotoAdapter: mtproto,
      botApiAdapter: mockAdapter("botApi"),
    });
    const runtime = createRuntimeManager(resolver, { botRegistry: new BotRegistry() });

    await runtime.registerBot({ botId: "m", credentials: mtprotoCredentials });

    await expect(runtime.startBot("m")).rejects.toThrow(BotNotFoundError);
    expect(mtproto.startBot).not.toHaveBeenCalled();
  });

  it("routes register/start to the adapter matching credentials.kind", async () => {
    const mtproto = mockAdapter("mtproto");
    const botApi = mockAdapter("botApi");
    const bots = new BotRegistry();
    const resolver = createDefaultTelegramAdapterResolverForRegistry(bots, {
      mtprotoAdapter: mtproto,
      botApiAdapter: botApi,
    });
    const runtime = createRuntimeManager(resolver, { botRegistry: bots });

    await runtime.registerBot({ botId: "m", credentials: mtprotoCredentials });
    await runtime.registerBot({ botId: "b", credentials: botApiCredentials });

    expect(mtproto.registerBot).toHaveBeenCalledOnce();
    expect(botApi.registerBot).toHaveBeenCalledOnce();

    await runtime.startBot("m");
    await runtime.startBot("b");

    expect(mtproto.startBot).toHaveBeenCalledWith("m", undefined);
    expect(botApi.startBot).toHaveBeenCalledWith("b", undefined);
  });
});
