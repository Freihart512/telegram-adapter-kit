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
export { GramJsMtprotoAdapter } from "./adapters/telegram/mtproto/gramjs-adapter.js";
export type {
  GramJsEventHandler,
  GramJsMtprotoClient,
  GramJsMtprotoClientFactory,
  GramJsRawEvent,
  GramJsSendMessageParams,
  GramJsSendMessageRawResult,
} from "./adapters/telegram/mtproto/gramjs-adapter.js";
export type { GramJsErrorMapContext } from "./adapters/telegram/mtproto/map-gramjs-error.js";
export { mapGramJsProviderError } from "./adapters/telegram/mtproto/map-gramjs-error.js";
export { NoopLogger } from "./observability/noop-logger.js";
export type { Logger } from "./observability/logger.js";
export {
  computeBackoffDelayMs,
  DEFAULT_RETRY_POLICY,
  isTransientSdkError,
  normalizeRetryPolicy,
  RETRY_POLICY_PRESETS,
  withRetry,
} from "./utils/retry.js";
export type {
  ComputeBackoffDelayOptions,
  JitterStrategy,
  RetryPolicy,
  WithRetryOptions,
} from "./utils/retry.js";
export {
  applyOperationBackoffOverlay,
  OPERATION_BACKOFF_OVERLAYS,
  resolveRetryPolicyForOperation,
  SEND_MESSAGE_RETRY_POLICY,
} from "./utils/operation-retry-policy.js";
export type { RuntimeOperationKind } from "./utils/operation-retry-policy.js";
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
