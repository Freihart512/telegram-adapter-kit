import type { Logger } from "./logger.js";
import { sanitizeLogMeta, sanitizeString } from "./secret-masking.js";

/**
 * Wraps a {@link Logger} so every `meta` payload is sanitized before emission (TT-034).
 */
export function createSafeLogger(logger: Logger): Logger {
  const emit =
    (level: "debug" | "info" | "warn" | "error") =>
    (message: string, meta?: Readonly<Record<string, unknown>>): void => {
      logger[level](sanitizeString(message), sanitizeLogMeta(meta));
    };

  return {
    debug: emit("debug"),
    info: emit("info"),
    warn: emit("warn"),
    error: emit("error"),
  };
}
