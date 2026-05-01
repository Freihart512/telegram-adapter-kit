import { TelegramSdkError } from "./base.js";

export class TransientNetworkError extends TelegramSdkError {
  readonly code = "TRANSIENT_NETWORK";
}
