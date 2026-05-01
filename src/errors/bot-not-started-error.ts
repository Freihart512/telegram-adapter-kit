import { TelegramSdkError } from "./base.js";

export class BotNotStartedError extends TelegramSdkError {
  readonly code = "BOT_NOT_STARTED";
}
