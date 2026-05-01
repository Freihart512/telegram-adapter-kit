import { describe, expectTypeOf, it } from "vitest";
import type {
  BotCredentials,
  RegisterBotInput,
  SendMessageInput,
  SendMessageResult,
  TelegramRuntimeSdk,
} from "../../src/index.js";

describe("contracts (TT-010)", () => {
  it("narrows BotCredentials by discriminant", () => {
    expectTypeOf({
      kind: "mtproto",
      apiId: 1,
      apiHash: "x",
      stringSession: "y",
    } satisfies BotCredentials).toMatchTypeOf<BotCredentials>();
    expectTypeOf({
      kind: "botApi",
      botToken: "z",
    } satisfies BotCredentials).toMatchTypeOf<BotCredentials>();
  });

  it("requires core fields on RegisterBotInput and SendMessageInput", () => {
    expectTypeOf({
      botId: "a",
      credentials: { kind: "botApi", botToken: "t" },
    } satisfies RegisterBotInput).toMatchTypeOf<RegisterBotInput>();
    expectTypeOf({
      botId: "b",
      chatId: -100n,
      text: "hi",
    } satisfies SendMessageInput).toMatchTypeOf<SendMessageInput>();
  });

  it("TelegramRuntimeSdk async methods resolve to expected types", () => {
    expectTypeOf<ReturnType<TelegramRuntimeSdk["registerBot"]>>().toEqualTypeOf<Promise<void>>();
    expectTypeOf<ReturnType<TelegramRuntimeSdk["sendMessage"]>>().toEqualTypeOf<
      Promise<SendMessageResult>
    >();
  });
});
