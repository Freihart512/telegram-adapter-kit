import { describe, expect, it } from "vitest";
import { HttpError } from "grammy";
import {
  mapBotApiProviderError,
  SendMessageError,
  TransientNetworkError,
  ValidationError,
} from "../../src/index.js";

function apiError(code: number, description: string): Error {
  return Object.assign(new Error(description), {
    error_code: code,
    description,
    ok: false,
    method: "sendMessage",
  });
}

describe("mapBotApiProviderError (TT-028)", () => {
  it("maps HttpError to TransientNetworkError", () => {
    const cause = new HttpError("network", { status: 503 });
    expect(mapBotApiProviderError(cause)).toBeInstanceOf(TransientNetworkError);
  });

  it("maps 401 Bot API payload to ValidationError", () => {
    expect(mapBotApiProviderError(apiError(401, "Unauthorized"))).toBeInstanceOf(ValidationError);
  });

  it("maps 429 Bot API payload to TransientNetworkError", () => {
    expect(mapBotApiProviderError(apiError(429, "Too Many Requests"))).toBeInstanceOf(
      TransientNetworkError,
    );
  });

  it("maps 403 Bot API payload to SendMessageError", () => {
    expect(mapBotApiProviderError(apiError(403, "Forbidden: bot is not a member"))).toBeInstanceOf(
      SendMessageError,
    );
  });
});
