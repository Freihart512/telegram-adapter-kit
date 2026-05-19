import { TelegramSdkError, type SdkErrorMeta } from "../../../errors/base.js";
import { mapUnknownToSdkError } from "../../../errors/map-external.js";
import { SendMessageError } from "../../../errors/send-message-error.js";
import { TransientNetworkError } from "../../../errors/transient-network-error.js";
import { ValidationError } from "../../../errors/validation-error.js";

/**
 * Optional, non-secret context merged into mapped error `meta` (TT-025).
 */
export type GramJsErrorMapContext = Readonly<{
  operation?: string;
  botId?: string;
  bindingId?: string;
  chatId?: string;
  topicId?: number;
}>;

/**
 * ## GramJS / MTProto provider → SDK error mapping (TT-025)
 *
 * | Provider signal | SDK type | Notes |
 * |-----------------|----------|--------|
 * | `FLOOD_WAIT*`, `FLOOD_PREMIUM*`, `MSG_WAIT*` | {@link TransientNetworkError} | Rate limits / wait |
 * | `TIMEOUT`, `ETIMEDOUT`, `ECONNRESET`, `ENOTFOUND`, `RPC_CALL_FAIL` | {@link TransientNetworkError} | Network / RPC transport |
 * | `PEER_ID_INVALID`, `USERNAME_INVALID`, `USERNAME_NOT_OCCUPIED` | {@link ValidationError} | Bad peer / handle |
 * | `MESSAGE_TOO_LONG`, `MESSAGE_EMPTY` | {@link ValidationError} | Invalid payload (treated as input validation, not send transport) |
 * | `CHAT_WRITE_FORBIDDEN`, `USER_BANNED_IN_CHANNEL`, `CHANNEL_PRIVATE`, `CHAT_ADMIN_REQUIRED`, `USER_RESTRICTED`, `TOPIC_*` | {@link SendMessageError} | Send / topic / permission |
 * | (unmatched) | Via {@link mapUnknownToSdkError} | Preserves `cause` |
 *
 * Recognizes GramJS-style `{ errorMessage: string }` RPC payloads and `Error.message` when it is a single `UPPER_SNAKE` token.
 */
export function mapGramJsProviderError(
  cause: unknown,
  context?: GramJsErrorMapContext,
): TelegramSdkError {
  if (cause instanceof TelegramSdkError) {
    const extra = buildMeta(context, undefined);
    return extra ? attachMetaIfNeeded(cause, extra) : cause;
  }

  const providerCode = extractProviderCode(cause);
  const meta = buildMeta(context, providerCode);

  if (!providerCode) {
    return attachMetaIfNeeded(mapUnknownToSdkError(cause), meta);
  }

  if (isTransientProviderCode(providerCode)) {
    return new TransientNetworkError(
      "Telegram rate limit, timeout, or transient provider failure",
      {
        cause,
        meta,
      },
    );
  }

  if (isValidationProviderCode(providerCode)) {
    return new ValidationError(`Telegram rejected input (${providerCode})`, { cause, meta });
  }

  if (isSendProviderCode(providerCode)) {
    return new SendMessageError(`Telegram send failed (${providerCode})`, { cause, meta });
  }

  return attachMetaIfNeeded(mapUnknownToSdkError(cause), meta);
}

function buildMeta(
  context: GramJsErrorMapContext | undefined,
  providerCode: string | undefined,
): Record<string, unknown> | undefined {
  const out: Record<string, unknown> = {};
  if (context) {
    for (const [k, v] of Object.entries(context)) {
      if (v !== undefined) out[k] = v;
    }
  }
  if (providerCode) out.providerCode = providerCode;
  if (Object.keys(out).length === 0) {
    return undefined;
  }
  out.provider = "gramjs";
  return out;
}

function extractProviderCode(cause: unknown): string | undefined {
  if (typeof cause === "string") {
    const t = cause.trim().toUpperCase();
    return t.length ? t : undefined;
  }
  if (cause && typeof cause === "object" && "errorMessage" in cause) {
    const em = (cause as { errorMessage?: unknown }).errorMessage;
    if (typeof em === "string" && em.trim().length) {
      return em.trim().toUpperCase();
    }
  }
  if (cause instanceof Error && cause.message) {
    const m = cause.message.trim().toUpperCase();
    if (/^[A-Z][A-Z0-9_]+$/.test(m)) {
      return m;
    }
    const embedded = m.match(/\b([A-Z][A-Z0-9_]{4,})\b/);
    return embedded ? embedded[1] : undefined;
  }
  return undefined;
}

function isTransientProviderCode(code: string): boolean {
  if (code.startsWith("FLOOD_WAIT") || code.startsWith("FLOOD_PREMIUM")) return true;
  if (code.startsWith("MSG_WAIT")) return true;
  if (
    code === "RPC_CALL_FAIL" ||
    code === "TIMEOUT" ||
    code === "ETIMEDOUT" ||
    code === "ECONNRESET" ||
    code === "ENOTFOUND" ||
    code === "NETWORK_ERROR" ||
    code === "INTERNAL_SERVER_ERROR"
  ) {
    return true;
  }
  return false;
}

function isValidationProviderCode(code: string): boolean {
  return (
    code === "PEER_ID_INVALID" ||
    code === "USERNAME_INVALID" ||
    code === "USERNAME_NOT_OCCUPIED" ||
    code === "MESSAGE_TOO_LONG" ||
    code === "MESSAGE_EMPTY"
  );
}

function isSendProviderCode(code: string): boolean {
  if (code.startsWith("TOPIC_")) return true;
  return (
    code === "CHAT_WRITE_FORBIDDEN" ||
    code === "USER_BANNED_IN_CHANNEL" ||
    code === "CHANNEL_PRIVATE" ||
    code === "CHAT_ADMIN_REQUIRED" ||
    code === "USER_RESTRICTED" ||
    code === "CHAT_SEND_PLAIN_FORBIDDEN" ||
    code === "CHAT_SEND_MEDIA_FORBIDDEN" ||
    code === "TOPIC_ID_INVALID" ||
    code === "TOPIC_NOT_SUPPORTED"
  );
}

function attachMetaIfNeeded(
  err: TelegramSdkError,
  meta: Record<string, unknown> | undefined,
): TelegramSdkError {
  if (!meta || !Object.keys(meta).length) {
    return err;
  }
  const merged: SdkErrorMeta = Object.freeze({
    ...(err.meta ?? {}),
    ...meta,
  });
  const Constructor = err.constructor as new (
    message: string,
    options?: { cause?: unknown; meta?: SdkErrorMeta },
  ) => TelegramSdkError;
  return new Constructor(err.message, { cause: err.cause, meta: merged });
}
