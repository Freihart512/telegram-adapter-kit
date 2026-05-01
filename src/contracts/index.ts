/**
 * Typed contracts for the public SDK and internal Telegram adapter boundary (TT-010).
 * Implementation modules (`core/`, `adapters/`) consume these types; they stay free of provider SDKs.
 */

export type {
  BotApiCredentials,
  BotCredentials,
  MtprotoCredentials,
  TelegramRuntimeKind,
} from "./credentials.js";

export type { TelegramAdapterCapabilities } from "./capabilities.js";

export type { TelegramAdapterResolver, TelegramProviderAdapter } from "./adapter.js";

export type { BotLifecycleStatus, BotStateEvent } from "./lifecycle.js";

export type {
  BotStateHandler,
  ErrorHandler,
  IncomingMessageEvent,
  MessageHandler,
  TelegramRuntimeError,
  UnsubscribeFn,
} from "./events.js";

export type {
  OperationOptions,
  RegisterBotInput,
  RegisterSubscriptionInput,
  SendMessageInput,
  SendMessageResult,
} from "./operations.js";

export type { TelegramRuntimeSdk } from "./sdk.js";
