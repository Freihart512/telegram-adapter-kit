import { describe, expect, it } from "vitest";
import { BotLifecycle, LIBRARY_NAME } from "../../src/index.js";

describe("telegram-adapter-kit", () => {
  it("exports a stable library name", () => {
    expect(LIBRARY_NAME).toBe("telegram-adapter-kit");
  });

  it("re-exports BotLifecycle for consumer comparisons", () => {
    expect(BotLifecycle.Started).toBe("started");
  });
});
