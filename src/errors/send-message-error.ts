import { TelegramSdkError } from "./base.js";

export class SendMessageError extends TelegramSdkError {
  readonly code = "SEND_MESSAGE_FAILED";
}
