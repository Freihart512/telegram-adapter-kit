import {
  BotRegistry,
  createDefaultTelegramAdapterResolverForRegistry,
  createRuntimeManager,
  type IncomingMessageEvent,
  type MessageHandler,
  type MtprotoCredentials,
  type TelegramAdapterResolver,
  type TelegramRuntimeSdk,
} from "../../src/index.js";
import { createLiveGramJsClientFactory } from "./gramjs-client.js";
import type { MtprotoRuntimeHarness } from "./harness.js";

export type MtprotoRuntimeConfig = Readonly<{
  credentials: MtprotoCredentials;
  botId?: string;
  bindingId?: string;
  chatId: bigint;
  topicId?: number;
  greetingText?: string;
  onMessage?: MessageHandler;
  harness?: MtprotoRuntimeHarness;
}>;

export type MtprotoRuntimeHandle = Readonly<{
  runtime: TelegramRuntimeSdk;
  botId: string;
  bindingId: string;
  shutdown: () => Promise<void>;
}>;

const DEFAULT_BOT_ID = "demo-mtproto";
const DEFAULT_BINDING_ID = "demo-mtproto-binding";

/**
 * MTProto end-to-end flow: register → start → subscribe → onMessage → optional send (TT-041).
 */
export async function runMtprotoRuntime(
  config: MtprotoRuntimeConfig,
): Promise<MtprotoRuntimeHandle> {
  const botId = config.botId ?? DEFAULT_BOT_ID;
  const bindingId = config.bindingId ?? DEFAULT_BINDING_ID;
  const bots = new BotRegistry();

  const resolver: TelegramAdapterResolver =
    config.harness?.resolver ??
    createDefaultTelegramAdapterResolverForRegistry(bots, {
      mtprotoClientFactory: createLiveGramJsClientFactory(),
    });

  const runtime = createRuntimeManager(resolver, { botRegistry: bots });

  await runtime.registerBot({
    botId,
    credentials: config.credentials,
  });
  await runtime.startBot(botId);

  await runtime.registerSubscription({
    bindingId,
    botId,
    chatId: config.chatId,
    // Do not pass topicId here: GramJS often omits reply_to_top_id on live forum messages.
    // TG_TOPIC_ID still applies to sendMessage below.
  });

  const offMessage = runtime.onMessage(config.onMessage ?? (() => {}));

  if (config.greetingText) {
    await runtime.sendMessage({
      botId,
      chatId: config.chatId,
      text: config.greetingText,
      ...(config.topicId !== undefined ? { topicId: config.topicId } : {}),
    });
  }

  return {
    runtime,
    botId,
    bindingId,
    async shutdown() {
      offMessage();
      await runtime.unregisterSubscription(bindingId);
      await runtime.stopBot(botId);
      await runtime.unregisterBot(botId);
    },
  };
};

export type MtprotoEnvConfig = Readonly<{
  credentials: MtprotoCredentials;
  botId: string;
  bindingId: string;
  chatId: bigint;
  topicId?: number;
  greetingText?: string;
}>;

function parseOptionalTopicId(raw: string | undefined): number | undefined {
  const trimmed = raw?.trim();
  if (!trimmed) {
    return undefined;
  }
  const topicId = Number.parseInt(trimmed, 10);
  if (!Number.isFinite(topicId) || topicId <= 0) {
    throw new Error(`Invalid TG_TOPIC_ID: ${raw}`);
  }
  return topicId;
}

function parseApiId(raw: string | undefined): number {
  if (!raw?.trim()) {
    throw new Error("Missing TG_API_ID (https://my.telegram.org/apps).");
  }
  const apiId = Number.parseInt(raw.trim(), 10);
  if (!Number.isFinite(apiId) || apiId <= 0) {
    throw new Error(`Invalid TG_API_ID: ${raw}`);
  }
  return apiId;
}

function parseApiHash(raw: string | undefined): string {
  const apiHash = raw?.trim();
  if (!apiHash) {
    throw new Error("Missing TG_API_HASH (https://my.telegram.org/apps).");
  }
  return apiHash;
}

function parseStringSession(raw: string | undefined): string {
  const stringSession = raw?.trim();
  if (!stringSession) {
    throw new Error(
      "Missing TG_STRING_SESSION. Run: npm run script:gramjs-session (see scripts/README.md).",
    );
  }
  return stringSession;
}

export function loadMtprotoConfigFromEnv(env: NodeJS.ProcessEnv = process.env): MtprotoEnvConfig {
  const chatIdRaw = env.TG_CHAT_ID?.trim();
  if (!chatIdRaw) {
    throw new Error("Missing TG_CHAT_ID (target chat/channel id, e.g. -1001234567890).");
  }

  let chatId: bigint;
  try {
    chatId = BigInt(chatIdRaw);
  } catch {
    throw new Error(`Invalid TG_CHAT_ID: ${chatIdRaw}`);
  }

  return {
    credentials: {
      kind: "mtproto",
      apiId: parseApiId(env.TG_API_ID),
      apiHash: parseApiHash(env.TG_API_HASH),
      stringSession: parseStringSession(env.TG_STRING_SESSION),
    },
    botId: env.TG_BOT_ID?.trim() || DEFAULT_BOT_ID,
    bindingId: env.TG_BINDING_ID?.trim() || DEFAULT_BINDING_ID,
    chatId,
    topicId: parseOptionalTopicId(env.TG_TOPIC_ID),
    greetingText: env.TG_GREETING_TEXT?.trim() || undefined,
  };
}

export function shutdownOnSignals(handle: MtprotoRuntimeHandle): Promise<void> {
  const shutdown = async () => {
    await handle.shutdown();
  };

  return new Promise((resolve, reject) => {
    const onSignal = () => {
      void shutdown().then(resolve).catch(reject);
    };
    process.once("SIGINT", onSignal);
    process.once("SIGTERM", onSignal);
  });
}

export type { IncomingMessageEvent };
