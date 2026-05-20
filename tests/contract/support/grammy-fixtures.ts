import { vi } from "vitest";
import type {
  GrammyBotClient,
  GrammyMessageContext,
  GrammyMessageHandler,
  GrammySendMessageRawResult,
} from "../../../src/adapters/telegram/bot-api/bot-api-adapter.js";
import type { RegisterBotInput, SendMessageInput } from "../../../src/index.js";

export function botApiRegisterInput(
  botId: string,
  botToken = "12345678:abcdefghijklmnopqrstuvwxyzABCDEF",
): RegisterBotInput {
  return {
    botId,
    credentials: {
      kind: "botApi",
      botToken,
    },
  };
}

export function sendMessageInput(
  botId: string,
  overrides?: Partial<SendMessageInput>,
): SendMessageInput {
  return {
    botId,
    chatId: 100,
    text: "hello",
    ...overrides,
  };
}

export type MockGrammyClient = GrammyBotClient & {
  dispatcher: GrammyMessageHandler | null;
  emit(ctx: GrammyMessageContext): Promise<void>;
  sendMessage: ReturnType<typeof vi.fn>;
};

export function createMockGrammyClient(options?: {
  sendResult?: GrammySendMessageRawResult;
  sendError?: unknown;
  initError?: unknown;
}): MockGrammyClient {
  let dispatcher: GrammyMessageHandler | null = null;

  return {
    get dispatcher() {
      return dispatcher;
    },
    init: vi.fn(async () => {
      if (options?.initError) throw options.initError;
    }),
    beginPolling: vi.fn(),
    stopPolling: vi.fn(async () => {}),
    setMessageDispatcher(handler) {
      dispatcher = handler;
    },
    async emit(ctx) {
      if (dispatcher) await dispatcher(ctx);
    },
    sendMessage: vi.fn(async () => {
      if (options?.sendError) throw options.sendError;
      return options?.sendResult ?? { message_id: 1, date: 1700000000 };
    }),
  };
}
