import type { BotStateHandler, ErrorHandler, MessageHandler, UnsubscribeFn } from "./events.js";
import type {
  OperationOptions,
  RegisterBotInput,
  RegisterSubscriptionInput,
  SendMessageInput,
  SendMessageResult,
} from "./operations.js";

/** Public facade implemented by the runtime manager (TRD §5.1). */
export interface TelegramRuntimeSdk {
  registerBot(input: RegisterBotInput, options?: OperationOptions): Promise<void>;
  unregisterBot(botId: string, options?: OperationOptions): Promise<void>;
  startBot(botId: string, options?: OperationOptions): Promise<void>;
  stopBot(botId: string, options?: OperationOptions): Promise<void>;

  registerSubscription(input: RegisterSubscriptionInput, options?: OperationOptions): Promise<void>;
  unregisterSubscription(bindingId: string, options?: OperationOptions): Promise<void>;

  sendMessage(input: SendMessageInput, options?: OperationOptions): Promise<SendMessageResult>;

  onMessage(handler: MessageHandler): UnsubscribeFn;
  onError(handler: ErrorHandler): UnsubscribeFn;
  onBotStateChange(handler: BotStateHandler): UnsubscribeFn;
}
