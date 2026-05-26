import { describe, expect, it } from "vitest";
import { canonicalPeerId } from "../../src/adapters/telegram/mtproto/gramjs-adapter.js";

describe("canonicalPeerId", () => {
  it("maps channel peers to -100{id}", () => {
    expect(canonicalPeerId({ channelId: 2593336332n })).toBe("-1002593336332");
    expect(canonicalPeerId(-1002593336332n)).toBe("-1002593336332");
  });

  it("maps basic group peers to -{id}", () => {
    expect(canonicalPeerId({ chatId: 123n })).toBe("-123");
    expect(canonicalPeerId(-123n)).toBe("-123");
  });

  it("maps user peers to positive ids", () => {
    expect(canonicalPeerId({ userId: 456n })).toBe("456");
    expect(canonicalPeerId(456n)).toBe("456");
  });

  it("does not collapse group and user ids with the same numeric value", () => {
    expect(canonicalPeerId(-123n)).not.toBe(canonicalPeerId({ userId: 123n }));
    expect(canonicalPeerId({ chatId: 123n })).not.toBe(canonicalPeerId({ userId: 123n }));
  });
});
