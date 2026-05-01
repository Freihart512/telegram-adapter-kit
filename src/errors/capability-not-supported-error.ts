import { TelegramSdkError } from "./base.js";

export class CapabilityNotSupportedError extends TelegramSdkError {
  readonly code = "CAPABILITY_NOT_SUPPORTED";
}
