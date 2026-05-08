import { describe, expect, it } from "vitest";
import {
  MAX_MESSAGE_TEXT_LENGTH,
  ValidationError,
  validateBindingId,
  validateBotId,
  validateChatId,
  validateCredentials,
  validateHandler,
  validateOperationOptions,
  validateRegisterBotInput,
  validateRegisterSubscriptionInput,
  validateSendMessageInput,
  validateTopicId,
} from "../../src/index.js";

const VALID_BOT_TOKEN = "12345678:abcdefghijklmnopqrstuvwxyzABCDEF";

describe("validators (TT-016)", () => {
  describe("validateBotId", () => {
    it("accepts non-empty strings", () => {
      expect(() => validateBotId("bot-1")).not.toThrow();
    });

    it.each([undefined, null, "", "  ", 0, 123, {}])("rejects %p", (value) => {
      expect(() => validateBotId(value)).toThrow(ValidationError);
    });
  });

  describe("validateBindingId", () => {
    it("accepts non-empty strings", () => {
      expect(() => validateBindingId("b-1")).not.toThrow();
    });

    it("rejects empty strings", () => {
      expect(() => validateBindingId("")).toThrow(ValidationError);
    });
  });

  describe("validateChatId", () => {
    it("accepts non-zero bigint", () => {
      expect(() => validateChatId(-100n)).not.toThrow();
      expect(() => validateChatId(1n)).not.toThrow();
    });

    it("accepts non-zero integer numbers", () => {
      expect(() => validateChatId(-100)).not.toThrow();
      expect(() => validateChatId(42)).not.toThrow();
    });

    it("accepts non-empty strings", () => {
      expect(() => validateChatId("@channel")).not.toThrow();
    });

    it.each([0, 0n, "", "   ", 1.5, NaN, undefined, null, {}])("rejects %p", (value) => {
      expect(() => validateChatId(value)).toThrow(ValidationError);
    });
  });

  describe("validateTopicId", () => {
    it("allows undefined", () => {
      expect(() => validateTopicId(undefined)).not.toThrow();
    });

    it("requires positive integer when defined", () => {
      expect(() => validateTopicId(1)).not.toThrow();
      expect(() => validateTopicId(0)).toThrow(ValidationError);
      expect(() => validateTopicId(-1)).toThrow(ValidationError);
      expect(() => validateTopicId(1.5)).toThrow(ValidationError);
      expect(() => validateTopicId("1")).toThrow(ValidationError);
    });
  });

  describe("validateCredentials", () => {
    it("accepts a well-formed mtproto payload", () => {
      expect(() =>
        validateCredentials({
          kind: "mtproto",
          apiId: 1,
          apiHash: "abc",
          stringSession: "session",
        }),
      ).not.toThrow();
    });

    it("accepts a well-formed botApi token", () => {
      expect(() =>
        validateCredentials({ kind: "botApi", botToken: VALID_BOT_TOKEN }),
      ).not.toThrow();
    });

    it("rejects mtproto with non-positive apiId", () => {
      expect(() =>
        validateCredentials({
          kind: "mtproto",
          apiId: 0,
          apiHash: "abc",
          stringSession: "x",
        }),
      ).toThrow(ValidationError);
    });

    it("rejects mtproto with empty apiHash or stringSession", () => {
      expect(() =>
        validateCredentials({ kind: "mtproto", apiId: 1, apiHash: "", stringSession: "x" }),
      ).toThrow(ValidationError);
      expect(() =>
        validateCredentials({ kind: "mtproto", apiId: 1, apiHash: "x", stringSession: "" }),
      ).toThrow(ValidationError);
    });

    it("rejects botApi with malformed token", () => {
      expect(() => validateCredentials({ kind: "botApi", botToken: "stub-token" })).toThrow(
        ValidationError,
      );
      expect(() => validateCredentials({ kind: "botApi", botToken: "" })).toThrow(ValidationError);
    });

    it("rejects unknown credentials.kind", () => {
      expect(() => validateCredentials({ kind: "other" })).toThrow(ValidationError);
      expect(() => validateCredentials(null)).toThrow(ValidationError);
    });
  });

  describe("validateRegisterBotInput", () => {
    it("accepts a valid input", () => {
      expect(() =>
        validateRegisterBotInput({
          botId: "b1",
          credentials: { kind: "botApi", botToken: VALID_BOT_TOKEN },
        }),
      ).not.toThrow();
    });

    it("rejects missing botId or invalid credentials", () => {
      expect(() =>
        validateRegisterBotInput({
          botId: "",
          credentials: { kind: "botApi", botToken: VALID_BOT_TOKEN },
        }),
      ).toThrow(ValidationError);
      expect(() =>
        validateRegisterBotInput({ botId: "b1", credentials: { kind: "botApi", botToken: "" } }),
      ).toThrow(ValidationError);
    });

    it("rejects non-object metadata", () => {
      expect(() =>
        validateRegisterBotInput({
          botId: "b1",
          credentials: { kind: "botApi", botToken: VALID_BOT_TOKEN },
          metadata: "nope" as unknown,
        }),
      ).toThrow(ValidationError);
    });
  });

  describe("validateRegisterSubscriptionInput", () => {
    it("accepts a valid input", () => {
      expect(() =>
        validateRegisterSubscriptionInput({
          bindingId: "b",
          botId: "bot",
          chatId: -100n,
        }),
      ).not.toThrow();
    });

    it("validates filters.textIncludes when provided", () => {
      expect(() =>
        validateRegisterSubscriptionInput({
          bindingId: "b",
          botId: "bot",
          chatId: 1,
          filters: { textIncludes: [] },
        }),
      ).toThrow(ValidationError);
      expect(() =>
        validateRegisterSubscriptionInput({
          bindingId: "b",
          botId: "bot",
          chatId: 1,
          filters: { textIncludes: [""] },
        }),
      ).toThrow(ValidationError);
      expect(() =>
        validateRegisterSubscriptionInput({
          bindingId: "b",
          botId: "bot",
          chatId: 1,
          filters: { textIncludes: ["ping"] },
        }),
      ).not.toThrow();
    });
  });

  describe("validateSendMessageInput", () => {
    const base = { botId: "bot", chatId: 1, text: "hello" };

    it("accepts a valid payload", () => {
      expect(() => validateSendMessageInput(base)).not.toThrow();
    });

    it("rejects empty text", () => {
      expect(() => validateSendMessageInput({ ...base, text: "" })).toThrow(ValidationError);
    });

    it("rejects text above the maximum length", () => {
      const long = "x".repeat(MAX_MESSAGE_TEXT_LENGTH + 1);
      expect(() => validateSendMessageInput({ ...base, text: long })).toThrow(ValidationError);
    });

    it("rejects unknown parseMode", () => {
      expect(() =>
        validateSendMessageInput({ ...base, parseMode: "rtf" as unknown as "html" }),
      ).toThrow(ValidationError);
    });

    it("rejects non-positive replyToMessageId", () => {
      expect(() => validateSendMessageInput({ ...base, replyToMessageId: 0 })).toThrow(
        ValidationError,
      );
    });

    it("rejects non-boolean disableLinkPreview", () => {
      expect(() =>
        validateSendMessageInput({ ...base, disableLinkPreview: "yes" as unknown as boolean }),
      ).toThrow(ValidationError);
    });
  });

  describe("validateHandler", () => {
    it("accepts a function", () => {
      expect(() => validateHandler(() => {}, "onMessage handler")).not.toThrow();
    });

    it.each([undefined, null, "fn", 1, {}, []])("rejects %p", (value) => {
      expect(() => validateHandler(value, "handler")).toThrow(ValidationError);
    });
  });

  describe("validateOperationOptions", () => {
    it("accepts undefined", () => {
      expect(() => validateOperationOptions(undefined)).not.toThrow();
    });

    it("accepts an empty object", () => {
      expect(() => validateOperationOptions({})).not.toThrow();
    });

    it("accepts a positive integer timeoutMs", () => {
      expect(() => validateOperationOptions({ timeoutMs: 1000 })).not.toThrow();
    });

    it.each([0, -1, 1.5, "1", NaN])("rejects timeoutMs %p", (value) => {
      expect(() => validateOperationOptions({ timeoutMs: value as unknown as number })).toThrow(
        ValidationError,
      );
    });

    it("accepts an AbortSignal-like object", () => {
      const controller = new AbortController();
      expect(() => validateOperationOptions({ signal: controller.signal })).not.toThrow();
    });

    it.each([null, "signal", { aborted: false }])("rejects malformed signal %p", (value) => {
      expect(() => validateOperationOptions({ signal: value as unknown as AbortSignal })).toThrow(
        ValidationError,
      );
    });

    it("rejects non-object options", () => {
      expect(() => validateOperationOptions("nope" as unknown)).toThrow(ValidationError);
    });
  });
});
