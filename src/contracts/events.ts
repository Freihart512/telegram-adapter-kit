import type { BotStateEvent } from "./lifecycle.js";

/**
 * Stable error surface for `onError` until concrete classes land in TT-011.
 * Implementations should extend this shape (discriminated `code`, no secrets in fields).
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
