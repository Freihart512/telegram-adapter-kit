import { sanitizeString } from "../observability/secret-masking.js";
import { TelegramSdkError } from "./base.js";
import { TransientNetworkError } from "./transient-network-error.js";
import { ValidationError } from "./validation-error.js";

/**
 * Normalizes unknown throws into a typed {@link TelegramSdkError} for `onError` and logging.
 * GramJS-specific RPC mapping is implemented by `mapGramJsProviderError` (TT-025).
 */
export function mapUnknownToSdkError(error: unknown): TelegramSdkError {
  if (error instanceof TelegramSdkError) {
    return error;
  }
  if (typeof error === "string") {
    return new ValidationError(sanitizeString(error));
  }
  if (error instanceof Error) {
    return new TransientNetworkError(sanitizeString(error.message || "Network or provider error"), {
      cause: error,
    });
  }
  return new TransientNetworkError("Unknown failure", { cause: error });
}
