import { describe, expectTypeOf, it } from "vitest";
import type {
  IncomingMessageEvent,
  RegisterSubscriptionInput,
  SendMessageInput,
  TelegramAdapterCapabilities,
  TelegramProviderAdapter,
} from "../../src/index.js";

describe("adapter contracts (TT-020)", () => {
  it("requires adapter capabilities shape for runtime feature gating", () => {
    expectTypeOf({
      supportsOutgoingForumTopics: true,
      supportsIncomingForumTopics: false,
      supportsDynamicSubscriptions: true,
    } satisfies TelegramAdapterCapabilities).toMatchTypeOf<TelegramAdapterCapabilities>();
  });

  it("requires lifecycle, messaging and binding methods on TelegramProviderAdapter", () => {
    const adapter = {
      kind: "botApi",
      capabilities: {
        supportsOutgoingForumTopics: true,
        supportsIncomingForumTopics: true,
        supportsDynamicSubscriptions: true,
      },
      registerBot: async () => {},
      unregisterBot: async () => {},
      startBot: async () => {},
      stopBot: async () => {},
      sendMessage: async (input: SendMessageInput) => ({
        botId: input.botId,
        chatId: String(input.chatId),
        messageId: 1,
      }),
      bindIncomingMessages: async (
        _: RegisterSubscriptionInput,
        onMessage: (event: IncomingMessageEvent) => void,
      ) => {
        void onMessage;
      },
      unbindIncomingMessages: async () => {},
      cleanupBot: async () => {},
    } satisfies TelegramProviderAdapter;

    expectTypeOf(adapter).toMatchTypeOf<TelegramProviderAdapter>();
  });

  it("requires bind callback to receive normalized IncomingMessageEvent", () => {
    type BindCallback = Parameters<TelegramProviderAdapter["bindIncomingMessages"]>[1];
    expectTypeOf<BindCallback>().toEqualTypeOf<(event: IncomingMessageEvent) => void>();
  });
});
