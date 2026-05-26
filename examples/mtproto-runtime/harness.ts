import type { TelegramAdapterResolver } from "../../src/contracts/adapter.js";
import { GramJsMtprotoAdapter } from "../../src/adapters/telegram/mtproto/gramjs-adapter.js";
import type {
  GramJsEventHandler,
  GramJsMtprotoClient,
  GramJsRawEvent,
} from "../../src/adapters/telegram/mtproto/gramjs-adapter.js";

export type OutboundCall = Readonly<{ chatId: string; text: string }>;

export type MtprotoRuntimeHarness = Readonly<{
  resolver: TelegramAdapterResolver;
  client: GramJsMtprotoClient & { emit(event: GramJsRawEvent): void };
  sendCalls: OutboundCall[];
}>;

/** In-memory GramJS client for CI smoke tests (no live Telegram). */
export function createMtprotoRuntimeHarness(): MtprotoRuntimeHarness {
  const gramHandlers: GramJsEventHandler[] = [];
  const sendCalls: OutboundCall[] = [];

  const client: GramJsMtprotoClient & { emit(event: GramJsRawEvent): void } = {
    connect: async () => {},
    disconnect: async () => {},
    addEventHandler(handler: GramJsEventHandler) {
      gramHandlers.push(handler);
    },
    removeEventHandler(handler: GramJsEventHandler) {
      const idx = gramHandlers.indexOf(handler);
      if (idx >= 0) {
        gramHandlers.splice(idx, 1);
      }
    },
    async sendMessage(input) {
      sendCalls.push({
        chatId: String(input.peer),
        text: input.message,
      });
      return { id: sendCalls.length, date: 1_700_000_000 };
    },
    emit(event: GramJsRawEvent) {
      for (const handler of [...gramHandlers]) {
        handler(event);
      }
    },
  };

  const adapter = new GramJsMtprotoAdapter(async () => client);
  const resolver: TelegramAdapterResolver = {
    resolve: () => adapter,
    resolveByBotId: () => adapter,
  };

  return { resolver, client, sendCalls };
}
