import { TelegramSdkError } from "./base.js";

export class BotNotFoundError extends TelegramSdkError {
  readonly code = "BOT_NOT_FOUND";
}
