import { describe, expect, it } from "vitest";
import {
  maskApiHash,
  maskBotToken,
  maskSecret,
  maskStringSession,
  sanitizeLogMeta,
  sanitizeString,
} from "../../src/observability/secret-masking.js";

const BOT_TOKEN = "12345678:abcdefghijklmnopqrstuvwxyzABCDEF";
const API_HASH = "a75d5250e87ce585b9b34398912a1f4e";
const STRING_SESSION =
  "1AQAOMTQ5LjE1NC4xNzUuNjABu6AmOgpy+lcDA7vYc+QCkWfqRjXNGr5tCQPYL3vEKFBmHQY1PfD7o3E2LKXiJ76I778LK5PVBp0EUYPO3fI5VTT8EBbX7N9";

describe("secret-masking (TT-034)", () => {
  it("maskSecret redacts short and long values", () => {
    expect(maskSecret("")).toBe("****");
    expect(maskSecret("abc")).toBe("****");
    expect(maskSecret("abcdefgh")).toBe("abcd****");
  });

  it("maskBotToken shows only a short prefix", () => {
    const masked = maskBotToken(BOT_TOKEN);
    expect(masked).toBe("1234****");
    expect(masked).not.toContain("abcdefghijklmnopqrstuvwxyz");
  });

  it("maskApiHash and maskStringSession never return full material", () => {
    const hash = "a75d5250e87ce585b9b34398912a1f4e";
    expect(maskApiHash(hash)).not.toBe(hash);
    const sessionMasked = maskStringSession(STRING_SESSION);
    expect(sessionMasked).not.toBe(STRING_SESSION);
    expect(sessionMasked).toMatch(/^.{4}….{4}$/);
  });

  it("sanitizeString redacts inline bot tokens and long session blobs", () => {
    const text = `auth failed for token ${BOT_TOKEN} and session ${STRING_SESSION}`;
    const out = sanitizeString(text);
    expect(out).not.toContain(BOT_TOKEN);
    expect(out).not.toContain(STRING_SESSION);
    expect(out).toContain("1234****");
  });

  it("sanitizeString redacts contextual apiHash in free-form error text", () => {
    const variants = [
      `MTProto auth failed apiHash=${API_HASH}`,
      `config api_hash: ${API_HASH}`,
      `invalid api-hash='${API_HASH}'`,
    ];
    for (const text of variants) {
      const out = sanitizeString(text);
      expect(out).not.toContain(API_HASH);
      expect(out).toMatch(/api[_-]?hash\s*[=:]\s*["']?[a-f0-9]{2}\*{4}/i);
    }
  });

  it("sanitizeLogMeta redacts sensitive keys recursively", () => {
    const meta = sanitizeLogMeta({
      botId: "b1",
      botToken: BOT_TOKEN,
      nested: { apiHash: "a75d5250e87ce585b9b34398912a1f4e", ok: true },
      stringSession: STRING_SESSION,
      message: `leaked ${BOT_TOKEN}`,
    });

    expect(meta?.botId).toBe("b1");
    expect(meta?.botToken).toBe("1234****");
    expect((meta?.nested as { apiHash: string }).apiHash).not.toBe(
      "a75d5250e87ce585b9b34398912a1f4e",
    );
    expect(meta?.stringSession).not.toBe(STRING_SESSION);
    expect(meta?.message).not.toContain(BOT_TOKEN);
  });
});
