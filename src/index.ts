/**
 * Public library entry: contracts (TT-010) and package metadata.
 * Runtime implementation follows in EP-002 (RuntimeManager, registries, adapters).
 */
export const LIBRARY_NAME = "telegram-adapter-kit" as const;

export {
  BotAlreadyExistsError,
  BotNotFoundError,
  BotNotStartedError,
  CapabilityNotSupportedError,
  LifecycleConflictError,
  mapUnknownToSdkError,
  OperationCancelledError,
  OperationTimeoutError,
  SendMessageError,
  SubscriptionAlreadyExistsError,
  SubscriptionNotFoundError,
  TelegramSdkError,
  TransientNetworkError,
  ValidationError,
} from "./errors/index.js";
export type { SdkErrorMeta } from "./errors/index.js";

export { BotRegistry } from "./core/bot-registry.js";
export type { BotRecord } from "./core/bot-registry.js";
export { SubscriptionRegistry } from "./core/subscription-registry.js";
export type { SubscriptionBinding } from "./core/subscription-registry.js";

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
