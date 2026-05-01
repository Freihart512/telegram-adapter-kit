import { TelegramSdkError } from "./base.js";

export class SubscriptionAlreadyExistsError extends TelegramSdkError {
  readonly code = "SUBSCRIPTION_ALREADY_EXISTS";
}
