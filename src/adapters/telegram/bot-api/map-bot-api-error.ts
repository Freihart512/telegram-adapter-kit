import { GrammyError, HttpError } from "grammy";
import { TelegramSdkError, type SdkErrorMeta } from "../../../errors/base.js";
import { mapUnknownToSdkError } from "../../../errors/map-external.js";
import { SendMessageError } from "../../../errors/send-message-error.js";
import { TransientNetworkError } from "../../../errors/transient-network-error.js";
import { ValidationError } from "../../../errors/validation-error.js";

/** Optional, non-secret context merged into mapped error `meta` (TT-025, TT-028). */
export type BotApiErrorMapContext = Readonly<{
  operation?: string;
  botId?: string;
  bindingId?: string;
  chatId?: string;
  topicId?: number;
}>;

/**
 * ## Bot API / grammY provider → SDK error mapping (TT-025, TT-028)
 *
 * | Provider signal | SDK type | Notes |
 * |-----------------|----------|--------|
 * | HTTP transport (`HttpError`) | {@link TransientNetworkError} | Network / 5xx |
 * | `429` / `retry_after` | {@link TransientNetworkError} | Rate limit |
 * | `401` | {@link ValidationError} | Invalid `botToken` |
 * | `400` chat/message validation | {@link ValidationError} | Bad input |
 * | `403` send / topic / permissions | {@link SendMessageError} | Forbidden / rights |
 * | (unmatched) | Via {@link mapUnknownToSdkError} | Preserves `cause` |
 */
export function mapBotApiProviderError(
  cause: unknown,
  context?: BotApiErrorMapContext,
): TelegramSdkError {
  if (cause instanceof TelegramSdkError) {
    const extra = buildMeta(context, undefined);
    return extra ? attachMetaIfNeeded(cause, extra) : cause;
  }

  if (cause instanceof HttpError) {
    return new TransientNetworkError("Telegram Bot API HTTP failure", {
      cause,
      meta: buildMeta(context, "HTTP_ERROR"),
    });
  }

  const apiError = cause instanceof GrammyError ? cause : readBotApiErrorShape(cause);
  if (apiError) {
    const code = String(apiError.error_code);
    const meta = buildMeta(context, code);
    const description = apiError.description ?? (cause instanceof Error ? cause.message : "");

    if (apiError.error_code === 429) {
      return new TransientNetworkError("Telegram Bot API rate limit", { cause, meta });
    }

    if (apiError.error_code === 401) {
      return new ValidationError("Invalid bot token or unauthorized Bot API call", {
        cause,
        meta,
      });
    }

    if (apiError.error_code === 400) {
      if (isSendDescription(description)) {
        return new SendMessageError(`Telegram send failed (${description})`, { cause, meta });
      }
      return new ValidationError(`Telegram rejected input (${description})`, { cause, meta });
    }

    if (apiError.error_code === 403) {
      return new SendMessageError(`Telegram send forbidden (${description})`, { cause, meta });
    }

    return attachMetaIfNeeded(mapUnknownToSdkError(cause), meta);
  }

  return attachMetaIfNeeded(mapUnknownToSdkError(cause), buildMeta(context, undefined));
}

function readBotApiErrorShape(
  cause: unknown,
): { error_code: number; description?: string } | undefined {
  if (!cause || typeof cause !== "object" || !("error_code" in cause)) {
    return undefined;
  }
  const code = (cause as { error_code?: unknown }).error_code;
  if (typeof code !== "number" || !Number.isFinite(code)) {
    return undefined;
  }
  const description = (cause as { description?: unknown }).description;
  return {
    error_code: code,
    ...(typeof description === "string" ? { description } : {}),
  };
}

function isSendDescription(description: string): boolean {
  const d = description.toLowerCase();
  return (
    d.includes("chat not found") ||
    d.includes("topic") ||
    d.includes("not enough rights") ||
    d.includes("forbidden")
  );
}

function buildMeta(
  context: BotApiErrorMapContext | undefined,
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
  out.provider = "grammy";
  return out;
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
