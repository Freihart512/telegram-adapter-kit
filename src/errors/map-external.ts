import { TelegramSdkError } from "./base.js";
import { TransientNetworkError } from "./transient-network-error.js";
import { ValidationError } from "./validation-error.js";

/**
 * Normalizes unknown throws into a typed {@link TelegramSdkError} for `onError` and logging.
 * Provider-specific mapping (GramJS, Bot API) builds on this in adapter tasks.
 */
export function mapUnknownToSdkError(error: unknown): TelegramSdkError {
  if (error instanceof TelegramSdkError) {
    return error;
  }
  if (typeof error === "string") {
    return new ValidationError(error);
  }
  if (error instanceof Error) {
    return new TransientNetworkError(error.message || "Network or provider error", {
      cause: error,
    });
  }
  return new TransientNetworkError("Unknown failure", { cause: error });
}
