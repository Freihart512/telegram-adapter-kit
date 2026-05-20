import { describe, expect, it } from "vitest";
import type { TelegramProviderAdapter } from "../../src/contracts/adapter.js";

/** Methods required by {@link TelegramProviderAdapter} (TRD §10.2, TT-027). */
const ADAPTER_CONTRACT_METHODS = [
  "registerBot",
  "unregisterBot",
  "startBot",
  "stopBot",
  "sendMessage",
  "bindIncomingMessages",
  "unbindIncomingMessages",
  "cleanupBot",
] as const satisfies readonly (keyof TelegramProviderAdapter)[];

const ADAPTER_CONTRACT_FILES = [
  {
    file: "gramjs-mtproto-lifecycle.contract.test.ts",
    methods: ["registerBot", "unregisterBot", "startBot", "stopBot", "cleanupBot"],
  },
  {
    file: "gramjs-mtproto-incoming.contract.test.ts",
    methods: ["bindIncomingMessages", "unbindIncomingMessages", "cleanupBot"],
  },
  {
    file: "gramjs-mtproto-send.contract.test.ts",
    methods: ["sendMessage"],
  },
  {
    file: "gramjs-mtproto-errors.contract.test.ts",
    methods: ["startBot", "sendMessage"],
  },
  {
    file: "grammy-bot-api-lifecycle.contract.test.ts",
    methods: ["registerBot", "unregisterBot", "startBot", "stopBot", "cleanupBot"],
  },
  {
    file: "grammy-bot-api-incoming.contract.test.ts",
    methods: ["bindIncomingMessages", "unbindIncomingMessages"],
  },
  {
    file: "grammy-bot-api-send.contract.test.ts",
    methods: ["sendMessage"],
  },
] as const;

describe("TelegramProviderAdapter contract suite (TT-027 / TT-028)", () => {
  it("lists all adapter contract methods", () => {
    expect(ADAPTER_CONTRACT_METHODS).toHaveLength(8);
  });

  it("maps every contract method to at least one adapter contract file", () => {
    const covered = new Set<string>();
    for (const entry of ADAPTER_CONTRACT_FILES) {
      for (const method of entry.methods) {
        covered.add(method);
      }
    }
    for (const method of ADAPTER_CONTRACT_METHODS) {
      expect(covered.has(method), `missing contract coverage for ${method}`).toBe(true);
    }
  });
});
