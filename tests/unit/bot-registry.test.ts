import { describe, expect, it } from "vitest";
import { BotRegistry } from "../../src/core/bot-registry.js";
import {
  BotAlreadyExistsError,
  BotNotFoundError,
  LifecycleConflictError,
} from "../../src/index.js";

const botApiInput = (botId: string) =>
  ({
    botId,
    credentials: { kind: "botApi" as const, botToken: "test-token" },
  }) as const;

describe("BotRegistry (TT-012)", () => {
  it("rejects duplicate register", () => {
    const reg = new BotRegistry();
    reg.register(botApiInput("a"));
    expect(() => reg.register(botApiInput("a"))).toThrow(BotAlreadyExistsError);
  });

  it("throws BotNotFound for unknown bot", () => {
    const reg = new BotRegistry();
    expect(() => reg.beginStart("nope")).toThrow(BotNotFoundError);
  });

  it("runs register → start → stop → unregister", () => {
    const reg = new BotRegistry();
    reg.register(botApiInput("b"));
    reg.start("b");
    expect(reg.get("b")?.status).toBe("started");
    reg.stop("b");
    expect(reg.get("b")?.status).toBe("stopped");
    reg.unregister("b");
    expect(reg.get("b")).toBeUndefined();
  });

  it("is idempotent for start when started and stop when stopped", () => {
    const reg = new BotRegistry();
    reg.register(botApiInput("c"));
    reg.start("c");
    reg.start("c");
    expect(reg.get("c")?.status).toBe("started");
    reg.stop("c");
    reg.stop("c");
    expect(reg.get("c")?.status).toBe("stopped");
  });

  it("rejects second beginStart while starting", () => {
    const reg = new BotRegistry();
    reg.register(botApiInput("d"));
    reg.beginStart("d");
    expect(() => reg.beginStart("d")).toThrow(LifecycleConflictError);
    reg.completeStart("d");
  });

  it("rejects beginStop while starting", () => {
    const reg = new BotRegistry();
    reg.register(botApiInput("e"));
    reg.beginStart("e");
    expect(() => reg.beginStop("e")).toThrow(LifecycleConflictError);
    reg.completeStart("e");
    reg.stop("e");
  });

  it("rejects unregister while started", () => {
    const reg = new BotRegistry();
    reg.register(botApiInput("f"));
    reg.start("f");
    expect(() => reg.unregister("f")).toThrow(LifecycleConflictError);
  });

  it("allows unregister from registered without start", () => {
    const reg = new BotRegistry();
    reg.register(botApiInput("g"));
    reg.unregister("g");
    expect(reg.get("g")).toBeUndefined();
  });

  it("error then stop then unregister", () => {
    const reg = new BotRegistry();
    reg.register(botApiInput("h"));
    reg.start("h");
    reg.markError("h");
    expect(reg.get("h")?.status).toBe("error");
    reg.stop("h");
    expect(reg.get("h")?.status).toBe("stopped");
    reg.unregister("h");
  });

  it("rejects unregister while in error until stopped", () => {
    const reg = new BotRegistry();
    reg.register(botApiInput("err"));
    reg.start("err");
    reg.markError("err");
    expect(() => reg.unregister("err")).toThrow(LifecycleConflictError);
    reg.stop("err");
    reg.unregister("err");
  });

  it("rejects markError when not started or starting", () => {
    const reg = new BotRegistry();
    reg.register(botApiInput("x"));
    expect(() => reg.markError("x")).toThrow(LifecycleConflictError);
  });

  it("abortStop reverts from stopping to started (TT-047)", () => {
    const reg = new BotRegistry();
    reg.register(botApiInput("s"));
    reg.start("s");
    reg.beginStop("s");
    expect(reg.get("s")?.status).toBe("stopping");

    reg.abortStop("s", "started");
    expect(reg.get("s")?.status).toBe("started");
  });

  it("allows markError while stopping and keeps it idempotent on error", () => {
    const reg = new BotRegistry();
    reg.register(botApiInput("s"));
    reg.start("s");
    reg.beginStop("s");
    expect(reg.get("s")?.status).toBe("stopping");

    reg.markError("s");
    expect(reg.get("s")?.status).toBe("error");

    // Current transition table intentionally treats error -> markError as no-op.
    reg.markError("s");
    expect(reg.get("s")?.status).toBe("error");
  });

  it("stores mtproto runtimeKind", () => {
    const reg = new BotRegistry();
    reg.register({
      botId: "m",
      credentials: {
        kind: "mtproto",
        apiId: 1,
        apiHash: "h",
        stringSession: "s",
      },
    });
    expect(reg.get("m")?.runtimeKind).toBe("mtproto");
  });

  it("handles rapid sequential register/start/stop cycles", () => {
    const reg = new BotRegistry();
    for (let i = 0; i < 40; i++) {
      const id = `bot-${i}`;
      reg.register(botApiInput(id));
      reg.start(id);
      reg.stop(id);
      reg.unregister(id);
    }
    expect(reg.list()).toHaveLength(0);
  });
});
