import { TelegramSdkError } from "./base.js";

export class LifecycleConflictError extends TelegramSdkError {
  readonly code = "LIFECYCLE_CONFLICT";
}
