import type { TelegramRuntimeError } from "../contracts/events.js";

/** Optional, non-secret diagnostic fields (no tokens or session material). */
export type SdkErrorMeta = Readonly<Record<string, unknown>>;

/**
 * Base class for all SDK errors. Implements the structural `TelegramRuntimeError` contract
 * used by `onError` handlers (TT-011).
 */
export abstract class TelegramSdkError extends Error implements TelegramRuntimeError {
  abstract readonly code: string;

  readonly meta?: SdkErrorMeta;

  constructor(message: string, options?: { cause?: unknown; meta?: SdkErrorMeta }) {
    super(message, options?.cause !== undefined ? { cause: options.cause } : undefined);
    this.name = new.target.name;
    this.meta = options?.meta;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
