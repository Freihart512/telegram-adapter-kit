import { describe, expect, it } from "vitest";
import type { TelegramRuntimeError } from "../../src/index.js";
import {
  BotAlreadyExistsError,
  BotNotFoundError,
  BotNotStartedError,
  CapabilityNotSupportedError,
  LifecycleConflictError,
  mapUnknownToSdkError,
  OperationCancelledError,
  OperationTimeoutError,
  SendMessageError,
  SubscriptionNotFoundError,
  TelegramSdkError,
  TransientNetworkError,
  ValidationError,
} from "../../src/index.js";

describe("errors (TT-011)", () => {
  const cases: { Class: new (message: string) => TelegramSdkError; code: string }[] = [
    { Class: ValidationError, code: "VALIDATION_ERROR" },
    { Class: BotNotFoundError, code: "BOT_NOT_FOUND" },
    { Class: BotAlreadyExistsError, code: "BOT_ALREADY_EXISTS" },
    { Class: BotNotStartedError, code: "BOT_NOT_STARTED" },
    { Class: SubscriptionNotFoundError, code: "SUBSCRIPTION_NOT_FOUND" },
    { Class: SendMessageError, code: "SEND_MESSAGE_FAILED" },
    { Class: TransientNetworkError, code: "TRANSIENT_NETWORK" },
    { Class: OperationTimeoutError, code: "OPERATION_TIMEOUT" },
    { Class: OperationCancelledError, code: "OPERATION_CANCELLED" },
    { Class: CapabilityNotSupportedError, code: "CAPABILITY_NOT_SUPPORTED" },
    { Class: LifecycleConflictError, code: "LIFECYCLE_CONFLICT" },
  ];

  it.each(cases)("exposes stable code for $Class.name", ({ Class, code }) => {
    const err = new Class("boom");
    expect(err).toBeInstanceOf(TelegramSdkError);
    expect(err).toBeInstanceOf(Error);
    expect(err.code).toBe(code);
    expect(err.message).toBe("boom");
    const surface: TelegramRuntimeError = err;
    expect(surface.name).toBe(err.name);
    expect(surface.code).toBe(code);
  });

  it("preserves SdkError instances in mapUnknownToSdkError", () => {
    const inner = new ValidationError("bad input");
    expect(mapUnknownToSdkError(inner)).toBe(inner);
  });

  it("maps string throws to ValidationError", () => {
    const err = mapUnknownToSdkError("plain string");
    expect(err).toBeInstanceOf(ValidationError);
    expect(err.message).toBe("plain string");
  });

  it("maps generic Error to TransientNetworkError with cause", () => {
    const cause = new Error("upstream");
    const err = mapUnknownToSdkError(cause);
    expect(err).toBeInstanceOf(TransientNetworkError);
    expect(err.cause).toBe(cause);
  });

  it("maps non-Error values to TransientNetworkError", () => {
    const err = mapUnknownToSdkError({ code: 123 });
    expect(err).toBeInstanceOf(TransientNetworkError);
    expect(err.cause).toEqual({ code: 123 });
  });

  it("supports optional meta without leaking secrets in API", () => {
    const err = new BotNotFoundError("missing", {
      meta: { botId: "bot-1" },
    });
    expect(err.meta).toEqual({ botId: "bot-1" });
  });
});
