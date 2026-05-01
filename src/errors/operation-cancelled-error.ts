import { TelegramSdkError } from "./base.js";

export class OperationCancelledError extends TelegramSdkError {
  readonly code = "OPERATION_CANCELLED";
}
