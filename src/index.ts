/**
 * Public library entry: contracts (TT-010) and package metadata.
 * Runtime implementation follows in EP-002 (RuntimeManager, registries, adapters).
 */
export const LIBRARY_NAME = "telegram-adapter-kit" as const;

export type {
  BotApiCredentials,
  BotCredentials,
  BotLifecycleStatus,
  BotStateEvent,
  BotStateHandler,
  ErrorHandler,
  IncomingMessageEvent,
  MessageHandler,
  MtprotoCredentials,
  OperationOptions,
  RegisterBotInput,
  RegisterSubscriptionInput,
  SendMessageInput,
  SendMessageResult,
  TelegramAdapterCapabilities,
  TelegramAdapterResolver,
  TelegramProviderAdapter,
  TelegramRuntimeError,
  TelegramRuntimeKind,
  TelegramRuntimeSdk,
  UnsubscribeFn,
} from "./contracts/index.js";
