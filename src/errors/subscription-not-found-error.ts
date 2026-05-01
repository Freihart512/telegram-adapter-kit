import { TelegramSdkError } from "./base.js";

export class SubscriptionNotFoundError extends TelegramSdkError {
  readonly code = "SUBSCRIPTION_NOT_FOUND";
}
