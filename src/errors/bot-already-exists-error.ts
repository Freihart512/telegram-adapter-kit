import { TelegramSdkError } from "./base.js";

/** Thrown when `registerBot` is called with a duplicate `botId` (TRD §7.7). */
export class BotAlreadyExistsError extends TelegramSdkError {
  readonly code = "BOT_ALREADY_EXISTS";
}
