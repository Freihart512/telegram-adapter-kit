import type { TelegramAdapterCapabilities } from "./capabilities.js";
import type { TelegramRuntimeKind } from "./credentials.js";
import type { IncomingMessageEvent } from "./events.js";
import type {
  OperationOptions,
  RegisterBotInput,
  RegisterSubscriptionInput,
  SendMessageInput,
  SendMessageResult,
} from "./operations.js";

/** Internal provider contract; core depends on this, not on GramJS/grammY (TRD §5.2). */
export interface TelegramProviderAdapter {
  readonly kind: TelegramRuntimeKind;
  readonly capabilities: TelegramAdapterCapabilities;

  registerBot(input: RegisterBotInput, options?: OperationOptions): Promise<void>;
  unregisterBot(botId: string, options?: OperationOptions): Promise<void>;
  startBot(botId: string, options?: OperationOptions): Promise<void>;
  stopBot(botId: string, options?: OperationOptions): Promise<void>;

  sendMessage(input: SendMessageInput, options?: OperationOptions): Promise<SendMessageResult>;

  bindIncomingMessages(
    binding: RegisterSubscriptionInput,
    onMessage: (event: IncomingMessageEvent) => void,
    options?: OperationOptions,
  ): Promise<void>;

  unbindIncomingMessages(bindingId: string, options?: OperationOptions): Promise<void>;

  cleanupBot(botId: string, options?: OperationOptions): Promise<void>;
}

/** Selects the concrete adapter from registration input or `botId` (TRD §7.9). */
export interface TelegramAdapterResolver {
  resolve(input: RegisterBotInput): TelegramProviderAdapter;
  resolveByBotId(botId: string): TelegramProviderAdapter;
}
