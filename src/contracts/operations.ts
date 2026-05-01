import type { BotCredentials } from "./credentials.js";

/** Timeout and cancellation for async SDK and adapter calls (PRD §11.3, TRD §7.8). */
export type OperationOptions = {
  timeoutMs?: number;
  signal?: AbortSignal;
};

export type RegisterBotInput = {
  botId: string;
  credentials: BotCredentials;
  metadata?: Record<string, unknown>;
};

export type RegisterSubscriptionInput = {
  bindingId: string;
  botId: string;
  chatId: bigint | number | string;
  topicId?: number;
  filters?: {
    textIncludes?: string[];
  };
};

export type SendMessageInput = {
  botId: string;
  chatId: bigint | number | string;
  text: string;
  topicId?: number;
  parseMode?: "markdown" | "html";
  replyToMessageId?: number;
  disableLinkPreview?: boolean;
};

/** Normalized send result (TRD §5.3). */
export type SendMessageResult = {
  botId: string;
  chatId: string;
  messageId: number;
  date?: Date;
  raw?: unknown;
};
