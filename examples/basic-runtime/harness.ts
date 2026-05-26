import type { TelegramAdapterResolver, TelegramProviderAdapter } from "../../src/contracts/adapter.js";
import type { IncomingMessageEvent } from "../../src/contracts/events.js";
import type { RegisterSubscriptionInput } from "../../src/contracts/operations.js";

export type OutboundCall = Readonly<{ botId: string; chatId: string; text: string }>;

/** In-memory adapter for smoke tests and local dry-runs (no live Telegram). */
export type BasicRuntimeHarness = Readonly<{
  resolver: TelegramAdapterResolver;
  adapter: TelegramProviderAdapter;
  sendCalls: OutboundCall[];
  emitInbound: (bindingId: string, event: IncomingMessageEvent) => Promise<void>;
}>;

export function createBasicRuntimeHarness(): BasicRuntimeHarness {
  const inboundHandlers = new Map<string, (event: IncomingMessageEvent) => void | Promise<void>>();
  const sendCalls: OutboundCall[] = [];

  const adapter: TelegramProviderAdapter = {
    kind: "botApi",
    capabilities: Object.freeze({
      supportsOutgoingForumTopics: true,
      supportsIncomingForumTopics: true,
      supportsDynamicSubscriptions: true,
    }),
    registerBot: async () => {},
    unregisterBot: async () => {},
    startBot: async () => {},
    stopBot: async () => {},
    sendMessage: async (input) => {
      sendCalls.push({
        botId: input.botId,
        chatId: String(input.chatId),
        text: input.text,
      });
      return {
        botId: input.botId,
        chatId: String(input.chatId),
        messageId: sendCalls.length,
        date: new Date("2026-01-01T00:00:00.000Z"),
        raw: {},
      };
    },
    bindIncomingMessages: async (binding: RegisterSubscriptionInput, onMessage) => {
      inboundHandlers.set(binding.bindingId, onMessage);
    },
    unbindIncomingMessages: async (bindingId: string) => {
      inboundHandlers.delete(bindingId);
    },
    cleanupBot: async () => {},
  };

  const resolver: TelegramAdapterResolver = {
    resolve: () => adapter,
    resolveByBotId: () => adapter,
  };

  return {
    resolver,
    adapter,
    sendCalls,
    async emitInbound(bindingId: string, event: IncomingMessageEvent): Promise<void> {
      const handler = inboundHandlers.get(bindingId);
      if (!handler) {
        throw new Error(`No inbound handler for binding: ${bindingId}`);
      }
      await handler(event);
    },
  };
}
