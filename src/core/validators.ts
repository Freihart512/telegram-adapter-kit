import type { BotCredentials } from "../contracts/credentials.js";
import type {
  OperationOptions,
  RegisterBotInput,
  RegisterSubscriptionInput,
  SendMessageInput,
} from "../contracts/operations.js";
import { ValidationError } from "../errors/validation-error.js";

/** Maximum Telegram outgoing message text length (Bot API & MTProto). */
export const MAX_MESSAGE_TEXT_LENGTH = 4096;

/** Loose Telegram bot token shape: `<numeric id>:<token body>` (TRD §5.3). */
const BOT_TOKEN_PATTERN = /^\d{3,}:[A-Za-z0-9_-]{20,}$/;

/** Allowed parse modes for `sendMessage`. */
const PARSE_MODES: readonly NonNullable<SendMessageInput["parseMode"]>[] = ["markdown", "html"];

type FieldMeta = Readonly<Record<string, unknown>>;

function fail(message: string, meta?: FieldMeta): never {
  throw new ValidationError(message, { meta });
}

function ensure(condition: boolean, message: string, meta?: FieldMeta): asserts condition {
  if (!condition) {
    fail(message, meta);
  }
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

export function validateHandler<T extends (...args: never[]) => unknown>(
  handler: unknown,
  label: string,
): asserts handler is T {
  ensure(typeof handler === "function", `${label} must be a function`, {
    field: label,
    receivedType: typeof handler,
  });
}

export function validateOperationOptions(options: unknown): asserts options is OperationOptions {
  if (options === undefined) {
    return;
  }
  ensure(
    typeof options === "object" && options !== null && !Array.isArray(options),
    "options must be an object when provided",
    { field: "options" },
  );
  const o = options as { timeoutMs?: unknown; signal?: unknown };
  if (o.timeoutMs !== undefined) {
    ensure(
      isPositiveInteger(o.timeoutMs),
      "options.timeoutMs must be a positive integer when provided",
      { field: "options.timeoutMs", received: o.timeoutMs },
    );
  }
  if (o.signal !== undefined) {
    ensure(
      typeof o.signal === "object" &&
        o.signal !== null &&
        typeof (o.signal as { aborted?: unknown }).aborted === "boolean" &&
        typeof (o.signal as { addEventListener?: unknown }).addEventListener === "function",
      "options.signal must be an AbortSignal-like object when provided",
      { field: "options.signal" },
    );
  }
}

export function validateBotId(botId: unknown): asserts botId is string {
  ensure(isNonEmptyString(botId), "botId must be a non-empty string", {
    field: "botId",
    received: botId,
  });
}

export function validateBindingId(bindingId: unknown): asserts bindingId is string {
  ensure(isNonEmptyString(bindingId), "bindingId must be a non-empty string", {
    field: "bindingId",
    received: bindingId,
  });
}

export function validateChatId(chatId: unknown): asserts chatId is bigint | number | string {
  if (typeof chatId === "bigint") {
    ensure(chatId !== 0n, "chatId must not be zero", { field: "chatId" });
    return;
  }
  if (typeof chatId === "number") {
    ensure(
      Number.isInteger(chatId) && chatId !== 0,
      "chatId must be a non-zero integer when provided as number",
      { field: "chatId", received: chatId },
    );
    return;
  }
  if (typeof chatId === "string") {
    ensure(chatId.trim().length > 0, "chatId must be a non-empty string", { field: "chatId" });
    return;
  }
  fail("chatId must be bigint, integer number, or non-empty string", {
    field: "chatId",
    receivedType: typeof chatId,
  });
}

export function validateTopicId(topicId: unknown): void {
  if (topicId === undefined) {
    return;
  }
  ensure(isPositiveInteger(topicId), "topicId must be a positive integer when provided", {
    field: "topicId",
    received: topicId,
  });
}

export function validateCredentials(credentials: unknown): asserts credentials is BotCredentials {
  ensure(typeof credentials === "object" && credentials !== null, "credentials must be provided", {
    field: "credentials",
  });

  const kind = (credentials as { kind?: unknown }).kind;
  if (kind === "mtproto") {
    const c = credentials as { apiId?: unknown; apiHash?: unknown; stringSession?: unknown };
    ensure(isPositiveInteger(c.apiId), "credentials.apiId must be a positive integer", {
      field: "credentials.apiId",
    });
    ensure(isNonEmptyString(c.apiHash), "credentials.apiHash must be a non-empty string", {
      field: "credentials.apiHash",
    });
    ensure(
      isNonEmptyString(c.stringSession),
      "credentials.stringSession must be a non-empty string",
      { field: "credentials.stringSession" },
    );
    return;
  }
  if (kind === "botApi") {
    const c = credentials as { botToken?: unknown };
    ensure(isNonEmptyString(c.botToken), "credentials.botToken must be a non-empty string", {
      field: "credentials.botToken",
    });
    ensure(BOT_TOKEN_PATTERN.test(c.botToken), "credentials.botToken format is invalid", {
      field: "credentials.botToken",
    });
    return;
  }
  fail('credentials.kind must be "mtproto" or "botApi"', {
    field: "credentials.kind",
    received: kind,
  });
}

export function validateRegisterBotInput(input: unknown): asserts input is RegisterBotInput {
  ensure(typeof input === "object" && input !== null, "registerBot input must be an object", {
    field: "input",
  });
  const i = input as { botId?: unknown; credentials?: unknown; metadata?: unknown };
  validateBotId(i.botId);
  validateCredentials(i.credentials);
  if (i.metadata !== undefined) {
    ensure(
      typeof i.metadata === "object" && i.metadata !== null && !Array.isArray(i.metadata),
      "metadata must be a plain object when provided",
      { field: "metadata" },
    );
  }
}

export function validateRegisterSubscriptionInput(
  input: unknown,
): asserts input is RegisterSubscriptionInput {
  ensure(
    typeof input === "object" && input !== null,
    "registerSubscription input must be an object",
    { field: "input" },
  );
  const i = input as {
    bindingId?: unknown;
    botId?: unknown;
    chatId?: unknown;
    topicId?: unknown;
    filters?: unknown;
  };
  validateBindingId(i.bindingId);
  validateBotId(i.botId);
  validateChatId(i.chatId);
  validateTopicId(i.topicId);
  if (i.filters !== undefined) {
    ensure(
      typeof i.filters === "object" && i.filters !== null && !Array.isArray(i.filters),
      "filters must be a plain object when provided",
      { field: "filters" },
    );
    const f = i.filters as { textIncludes?: unknown };
    if (f.textIncludes !== undefined) {
      ensure(
        Array.isArray(f.textIncludes) && f.textIncludes.length > 0,
        "filters.textIncludes must be a non-empty array when provided",
        { field: "filters.textIncludes" },
      );
      for (const fragment of f.textIncludes) {
        ensure(
          isNonEmptyString(fragment),
          "filters.textIncludes entries must be non-empty strings",
          { field: "filters.textIncludes" },
        );
      }
    }
  }
}

export function validateSendMessageInput(input: unknown): asserts input is SendMessageInput {
  ensure(typeof input === "object" && input !== null, "sendMessage input must be an object", {
    field: "input",
  });
  const i = input as {
    botId?: unknown;
    chatId?: unknown;
    text?: unknown;
    topicId?: unknown;
    parseMode?: unknown;
    replyToMessageId?: unknown;
    disableLinkPreview?: unknown;
  };
  validateBotId(i.botId);
  validateChatId(i.chatId);
  validateTopicId(i.topicId);
  ensure(typeof i.text === "string" && i.text.length > 0, "text must be a non-empty string", {
    field: "text",
  });
  ensure(
    (i.text as string).length <= MAX_MESSAGE_TEXT_LENGTH,
    `text exceeds maximum length of ${MAX_MESSAGE_TEXT_LENGTH} characters`,
    { field: "text", maxLength: MAX_MESSAGE_TEXT_LENGTH },
  );
  if (i.parseMode !== undefined) {
    ensure(
      typeof i.parseMode === "string" && (PARSE_MODES as readonly string[]).includes(i.parseMode),
      'parseMode must be "markdown" or "html" when provided',
      { field: "parseMode", received: i.parseMode },
    );
  }
  if (i.replyToMessageId !== undefined) {
    ensure(
      isPositiveInteger(i.replyToMessageId),
      "replyToMessageId must be a positive integer when provided",
      { field: "replyToMessageId", received: i.replyToMessageId },
    );
  }
  if (i.disableLinkPreview !== undefined) {
    ensure(
      typeof i.disableLinkPreview === "boolean",
      "disableLinkPreview must be a boolean when provided",
      { field: "disableLinkPreview" },
    );
  }
}
