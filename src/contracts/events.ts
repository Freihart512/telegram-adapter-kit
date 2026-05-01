import type { BotStateEvent } from "./lifecycle.js";

/**
 * Structural shape for `onError`. The runtime emits `TelegramSdkError` subclasses from `src/errors/` (TT-011),
 * which satisfy this contract via `name`, `code`, `message`, and optional `cause`.
 */
export type TelegramRuntimeError = {
  readonly name: string;
  readonly code: string;
  readonly message: string;
  readonly cause?: unknown;
};

/** Normalized inbound message (PRD RF-04, TRD §5.2). */
export type IncomingMessageEvent = {
  botId: string;
  chatId: string;
  messageId: number;
  text?: string;
  date: Date;
  topicId?: number;
  raw: unknown;
};

export type UnsubscribeFn = () => void;

export type MessageHandler = (event: IncomingMessageEvent) => void;

export type ErrorHandler = (error: TelegramRuntimeError) => void;

export type BotStateHandler = (event: BotStateEvent) => void;
