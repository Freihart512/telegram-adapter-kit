import { describe, expect, it } from "vitest";
import { LIBRARY_NAME } from "../../src/index.js";

describe("telegram-adapter-kit", () => {
  it("exports a stable library name", () => {
    expect(LIBRARY_NAME).toBe("telegram-adapter-kit");
  });
});
