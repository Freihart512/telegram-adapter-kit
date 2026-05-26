/** Telegram Bot API token shape (`123456789:AA...`). */
const BOT_TOKEN_IN_TEXT = /\d{6,10}:[A-Za-z0-9_-]{20,}/g;

/** Long opaque strings typical of GramJS `stringSession` material. */
const OPAQUE_SESSION_LIKE = /[A-Za-z0-9+/=_-]{48,}/g;

/** MTProto `apiHash` in free-form text (`apiHash=…`, `api_hash: …`, etc.). */
const API_HASH_IN_TEXT = /((?:api[_-]?hash|apiHash)\s*[=:]\s*["']?)([a-fA-F0-9]{32})(["']?)/gi;

const SENSITIVE_KEY =
  /^(.*\.)?(botToken|apiHash|stringSession|password|secret|authorization|authToken|accessToken|refreshToken|session|token)$/i;

const SENSITIVE_KEY_SUBSTRING = /(botToken|apiHash|stringSession|password|secret)/i;

/**
 * Masks a secret string for logs (TRD §11, TT-034).
 * Shows a short prefix only when length allows; never returns the full value.
 */
export function maskSecret(value: string, visiblePrefix = 4): string {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return "****";
  }
  if (trimmed.length <= visiblePrefix) {
    return "****";
  }
  return `${trimmed.slice(0, visiblePrefix)}****`;
}

/** Masks a Bot API `botToken` (BotFather format). */
export function maskBotToken(token: string): string {
  return maskSecret(token, 4);
}

/** Masks MTProto `apiHash` (never log the full hash). */
export function maskApiHash(apiHash: string): string {
  return maskSecret(apiHash, 2);
}

/** Masks MTProto `stringSession` (never log the full session). */
export function maskStringSession(session: string): string {
  if (session.length <= 12) {
    return "****";
  }
  return `${session.slice(0, 4)}…${session.slice(-4)}`;
}

function isSensitiveKey(key: string): boolean {
  return SENSITIVE_KEY.test(key) || SENSITIVE_KEY_SUBSTRING.test(key);
}

/**
 * Redacts known secret patterns embedded in free-form text (error messages, etc.).
 */
export function sanitizeString(text: string): string {
  if (!text) {
    return text;
  }
  let out = text.replace(BOT_TOKEN_IN_TEXT, (match) => maskBotToken(match));
  out = out.replace(API_HASH_IN_TEXT, (_match, prefix, hash, suffix) => {
    return `${prefix}${maskApiHash(hash)}${suffix}`;
  });
  out = out.replace(OPAQUE_SESSION_LIKE, (match) => maskStringSession(match));
  return out;
}

function sanitizeValue(value: unknown, key?: string): unknown {
  if (key !== undefined && isSensitiveKey(key) && typeof value === "string") {
    if (/botToken/i.test(key)) {
      return maskBotToken(value);
    }
    if (/apiHash/i.test(key)) {
      return maskApiHash(value);
    }
    if (/stringSession/i.test(key)) {
      return maskStringSession(value);
    }
    return maskSecret(value);
  }

  if (typeof value === "string") {
    return sanitizeString(value);
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeValue(item));
  }

  if (value !== null && typeof value === "object") {
    return sanitizeLogMeta(value as Record<string, unknown>);
  }

  return value;
}

/**
 * Deep-clones log/error metadata and redacts sensitive keys and inline secret patterns.
 */
export function sanitizeLogMeta(
  meta: Readonly<Record<string, unknown>> | undefined,
): Record<string, unknown> | undefined {
  if (!meta) {
    return undefined;
  }

  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(meta)) {
    out[key] = sanitizeValue(value, key);
  }
  return out;
}
