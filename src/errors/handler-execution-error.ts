import { TelegramSdkError } from "./base.js";

/** Thrown or emitted when an EventBus subscriber throws while handling a non-error channel. */
export class HandlerExecutionError extends TelegramSdkError {
  readonly code = "HANDLER_EXECUTION_FAILED";
}
