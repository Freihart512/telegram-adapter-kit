import { vi } from "vitest";
import type {
  GramJsSendMessageRawResult,
  RegisterBotInput,
  SendMessageInput,
} from "../../../src/index.js";
import type {
  GramJsEventHandler,
  GramJsMtprotoClient,
} from "../../../src/adapters/telegram/mtproto/gramjs-adapter.js";

export function mtprotoRegisterInput(botId: string): RegisterBotInput {
  return {
    botId,
    credentials: {
      kind: "mtproto",
      apiId: 123456,
      apiHash: "api-hash",
      stringSession: "string-session",
    },
  };
}

export function sendMessageInput(
  botId: string,
  overrides?: Partial<SendMessageInput>,
): SendMessageInput {
  return {
    botId,
    chatId: 100n,
    text: "hello",
    ...overrides,
  };
}

export type MockGramJsClient = GramJsMtprotoClient & {
  sendMessage: ReturnType<typeof vi.fn>;
  handlers?: GramJsEventHandler[];
  emit?: (event: unknown) => void;
};

export function createMockGramJsClient(options?: {
  sendResult?: GramJsSendMessageRawResult;
  sendError?: unknown;
  connectError?: unknown;
}): MockGramJsClient {
  return {
    connect: vi.fn(async () => {
      if (options?.connectError) throw options.connectError;
    }),
    disconnect: vi.fn(async () => {}),
    addEventHandler: vi.fn(),
    removeEventHandler: vi.fn(),
    sendMessage: vi.fn(async () => {
      if (options?.sendError) throw options.sendError;
      return options?.sendResult ?? { id: 1, date: 1700000000 };
    }),
  };
}
