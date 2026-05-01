import { TelegramSdkError } from "./base.js";

export class ValidationError extends TelegramSdkError {
  readonly code = "VALIDATION_ERROR";
}
