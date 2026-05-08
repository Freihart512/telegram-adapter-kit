import type { Logger } from "./logger.js";

/** Default logger used when consumers do not inject one (TT-017). */
export class NoopLogger implements Logger {
  debug(): void {}
  info(): void {}
  warn(): void {}
  error(): void {}
}
