import { TelegramSdkError } from "./base.js";

export class OperationTimeoutError extends TelegramSdkError {
  readonly code = "OPERATION_TIMEOUT";
}
