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
  HandlerExecutionError,
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

export { BotLifecycle, BotRegistry } from "./core/bot-registry.js";
export type { BotRecord } from "./core/bot-registry.js";
export { EventBus } from "./core/event-bus.js";
export type { EventChannel, EventMap } from "./core/event-bus.js";
export { SubscriptionRegistry } from "./core/subscription-registry.js";
export type { SubscriptionBinding } from "./core/subscription-registry.js";
export { RuntimeManager, createRuntimeManager } from "./core/runtime-manager.js";
export type { RuntimeManagerDeps } from "./core/runtime-manager.js";
export {
  MAX_MESSAGE_TEXT_LENGTH,
  validateBindingId,
  validateBotId,
  validateChatId,
  validateCredentials,
  validateHandler,
  validateOperationOptions,
  validateRegisterBotInput,
  validateRegisterSubscriptionInput,
  validateSendMessageInput,
  validateTopicId,
} from "./core/validators.js";

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
