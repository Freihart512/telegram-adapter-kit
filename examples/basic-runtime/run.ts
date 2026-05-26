import {
  BotRegistry,
  createDefaultTelegramAdapterResolverForRegistry,
  createRuntimeManager,
  type IncomingMessageEvent,
  type MessageHandler,
  type TelegramAdapterResolver,
  type TelegramRuntimeSdk,
} from "../../src/index.js";
import type { BasicRuntimeHarness } from "./harness.js";

export type BasicRuntimeConfig = Readonly<{
  botToken: string;
  botId?: string;
  bindingId?: string;
  chatId: bigint;
  /** Forum topic thread id (optional). */
  topicId?: number;
  /** Outbound text sent once after subscribe (optional). */
  greetingText?: string;
  onMessage?: MessageHandler;
  /** When set, skips live Bot API and uses the in-memory harness (smoke tests). */
  harness?: BasicRuntimeHarness;
}>;

export type BasicRuntimeHandle = Readonly<{
  runtime: TelegramRuntimeSdk;
  botId: string;
  bindingId: string;
  shutdown: () => Promise<void>;
}>;

const DEFAULT_BOT_ID = "demo-bot";
const DEFAULT_BINDING_ID = "demo-binding";

/**
 * Minimal end-to-end flow: register → start → subscribe → onMessage → optional send (TT-041).
 */
export async function runBasicRuntime(config: BasicRuntimeConfig): Promise<BasicRuntimeHandle> {
  const botId = config.botId ?? DEFAULT_BOT_ID;
  const bindingId = config.bindingId ?? DEFAULT_BINDING_ID;
  const bots = new BotRegistry();

  const resolver: TelegramAdapterResolver =
    config.harness?.resolver ?? createDefaultTelegramAdapterResolverForRegistry(bots);

  const runtime = createRuntimeManager(resolver, { botRegistry: bots });

  await runtime.registerBot({
    botId,
    credentials: { kind: "botApi", botToken: config.botToken },
  });
  await runtime.startBot(botId);

  await runtime.registerSubscription({
    bindingId,
    botId,
    chatId: config.chatId,
    ...(config.topicId !== undefined ? { topicId: config.topicId } : {}),
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
}

export type EnvConfig = Readonly<{
  botToken: string;
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

export function loadConfigFromEnv(env: NodeJS.ProcessEnv = process.env): EnvConfig {
  const botToken = env.TG_BOT_TOKEN?.trim();
  const chatIdRaw = env.TG_CHAT_ID?.trim();

  if (!botToken) {
    throw new Error("Missing TG_BOT_TOKEN (Bot API token from @BotFather).");
  }
  if (!chatIdRaw) {
    throw new Error("Missing TG_CHAT_ID (target chat/channel id, e.g. -1001234567890).");
  }

  let chatId: bigint;
  try {
    chatId = BigInt(chatIdRaw);
  } catch {
    throw new Error(`Invalid TG_CHAT_ID: ${chatIdRaw}`);
  }

  const greetingText = env.TG_GREETING_TEXT?.trim() || undefined;
  const topicId = parseOptionalTopicId(env.TG_TOPIC_ID);

  return {
    botToken,
    botId: env.TG_BOT_ID?.trim() || DEFAULT_BOT_ID,
    bindingId: env.TG_BINDING_ID?.trim() || DEFAULT_BINDING_ID,
    chatId,
    topicId,
    greetingText,
  };
}

export function shutdownOnSignals(handle: BasicRuntimeHandle): Promise<void> {
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
