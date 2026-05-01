import { describe, expect, it } from "vitest";
import { SubscriptionRegistry } from "../../src/core/subscription-registry.js";
import {
  BotNotFoundError,
  SubscriptionAlreadyExistsError,
  SubscriptionNotFoundError,
} from "../../src/index.js";

const binding = (bindingId: string, botId = "bot-a") => ({
  bindingId,
  botId,
  chatId: -100123n,
  topicId: 42,
  filters: {
    textIncludes: ["alpha", "beta"],
  },
});

describe("SubscriptionRegistry (TT-013)", () => {
  it("registers and lists bindings", () => {
    const reg = new SubscriptionRegistry(() => true);
    reg.register(binding("b1"));
    reg.register(binding("b2", "bot-b"));

    expect(reg.list()).toHaveLength(2);
    expect(reg.listByBotId("bot-a")).toHaveLength(1);
    expect(reg.listByBotId("bot-b")).toHaveLength(1);
  });

  it("rejects duplicate bindingId", () => {
    const reg = new SubscriptionRegistry(() => true);
    reg.register(binding("dup"));
    expect(() => reg.register(binding("dup"))).toThrow(SubscriptionAlreadyExistsError);
  });

  it("rejects registration when destination bot does not exist", () => {
    const reg = new SubscriptionRegistry((botId) => botId === "bot-a");
    expect(() => reg.register(binding("x", "missing-bot"))).toThrow(BotNotFoundError);
  });

  it("unregisters existing bindings", () => {
    const reg = new SubscriptionRegistry(() => true);
    reg.register(binding("rm"));
    reg.unregister("rm");
    expect(reg.get("rm")).toBeUndefined();
    expect(reg.listByBotId("bot-a")).toHaveLength(0);
  });

  it("throws typed error for unknown binding on unregister", () => {
    const reg = new SubscriptionRegistry(() => true);
    expect(() => reg.unregister("missing-binding")).toThrow(SubscriptionNotFoundError);
  });

  it("unregisterByBotId removes only selected bot bindings and returns removed list", () => {
    const reg = new SubscriptionRegistry(() => true);
    reg.register(binding("a-1", "bot-a"));
    reg.register(binding("a-2", "bot-a"));
    reg.register(binding("b-1", "bot-b"));

    const removed = reg.unregisterByBotId("bot-a");

    expect(removed).toHaveLength(2);
    expect(removed.map((b) => b.bindingId).sort()).toEqual(["a-1", "a-2"]);
    expect(reg.listByBotId("bot-a")).toHaveLength(0);
    expect(reg.listByBotId("bot-b")).toHaveLength(1);
    expect(reg.get("b-1")).toBeDefined();
  });

  it("unregisterByBotId is safe when bot has no bindings", () => {
    const reg = new SubscriptionRegistry(() => true);
    reg.register(binding("x-1", "bot-x"));

    const removed = reg.unregisterByBotId("bot-missing");

    expect(removed).toEqual([]);
    expect(reg.list()).toHaveLength(1);
  });

  it("returns immutable snapshots", () => {
    const reg = new SubscriptionRegistry(() => true);
    reg.register(binding("immut"));

    const item = reg.get("immut");
    expect(item).toBeDefined();

    if (!item) {
      return;
    }

    expect(Object.isFrozen(item)).toBe(true);
    expect(Object.isFrozen(item.filters)).toBe(true);
    expect(Array.isArray(item.filters?.textIncludes)).toBe(true);
  });

  it("handles rapid sequential add/remove cycles", () => {
    const reg = new SubscriptionRegistry(() => true);

    for (let i = 0; i < 60; i++) {
      const id = `binding-${i}`;
      reg.register(binding(id, `bot-${i % 4}`));
      reg.unregister(id);
    }

    expect(reg.list()).toHaveLength(0);
    expect(reg.listByBotId("bot-0")).toHaveLength(0);
  });
});
