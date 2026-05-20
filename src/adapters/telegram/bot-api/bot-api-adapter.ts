import { Bot } from "grammy";
import type { TelegramProviderAdapter } from "../../../contracts/adapter.js";
import type { TelegramAdapterCapabilities } from "../../../contracts/capabilities.js";
import type { BotApiCredentials } from "../../../contracts/credentials.js";
import type { IncomingMessageEvent } from "../../../contracts/events.js";
import type {
  OperationOptions,
  RegisterBotInput,
  RegisterSubscriptionInput,
  SendMessageInput,
  SendMessageResult,
} from "../../../contracts/operations.js";
import { BotLifecycle } from "../../../core/bot-registry.js";
import { validateSendMessageInput } from "../../../core/validators.js";
import { BotAlreadyExistsError } from "../../../errors/bot-already-exists-error.js";
import { BotNotFoundError } from "../../../errors/bot-not-found-error.js";
import { BotNotStartedError } from "../../../errors/bot-not-started-error.js";
import { CapabilityNotSupportedError } from "../../../errors/capability-not-supported-error.js";
import { LifecycleConflictError } from "../../../errors/lifecycle-conflict-error.js";
import { SubscriptionAlreadyExistsError } from "../../../errors/subscription-already-exists-error.js";
import { SubscriptionNotFoundError } from "../../../errors/subscription-not-found-error.js";
import type { Logger } from "../../../observability/logger.js";
import { NoopLogger } from "../../../observability/noop-logger.js";
import { mapBotApiProviderError } from "./map-bot-api-error.js";

/**
 * Normalized grammY message context used by the adapter harness (TT-028).
 * v1 incoming transport: **long polling** via `bot.start()` (webhook out of scope).
 */
export type GrammyMessageContext = Readonly<{
  chat: { id: number };
  message: {
    message_id: number;
    text?: string;
    date: number;
    message_thread_id?: number;
  };
}>;

export type GrammySendMessageParams = Readonly<{
  chatId: number | string;
  text: string;
  parseMode?: "markdown" | "html";
  replyToMessageId?: number;
  disableLinkPreview?: boolean;
  topicId?: number;
}>;

export type GrammySendMessageRawResult = Readonly<{
  message_id: number;
  date: number;
}>;

export type GrammyMessageHandler = (ctx: GrammyMessageContext) => void | Promise<void>;

export type GrammyBotClient = {
  init(): Promise<void>;
  /** Starts long polling without blocking the caller (TT-028). */
  beginPolling(): void;
  stopPolling(): Promise<void>;
  /** Routes all incoming messages to the adapter dispatcher (one per bot instance). */
  setMessageDispatcher(handler: GrammyMessageHandler | null): void;
  sendMessage(params: GrammySendMessageParams): Promise<GrammySendMessageRawResult>;
};

export type GrammyBotClientFactory = (
  credentials: BotApiCredentials,
  options?: OperationOptions,
) => GrammyBotClient | Promise<GrammyBotClient>;

type BindingRecord = {
  binding: RegisterSubscriptionInput;
  onMessage: (event: IncomingMessageEvent) => void;
};

type AdapterRecord = {
  credentials: BotApiCredentials;
  client?: GrammyBotClient;
  status: typeof BotLifecycle.Registered | typeof BotLifecycle.Started;
  bindings: Map<string, BindingRecord>;
};

const DEFAULT_CAPABILITIES: TelegramAdapterCapabilities = Object.freeze({
  supportsOutgoingForumTopics: true,
  supportsIncomingForumTopics: true,
  supportsDynamicSubscriptions: true,
});

function maskBotToken(token: string): string {
  if (token.length <= 8) return "****";
  return `${token.slice(0, 4)}****`;
}

function toApiChatId(chatId: bigint | number | string): number | string {
  if (typeof chatId === "bigint") {
    return chatId.toString();
  }
  return chatId;
}

function wrapGrammyBot(bot: Bot): GrammyBotClient {
  let pollingPromise: Promise<void> | undefined;
  let installed = false;
  const routeState: { handler: GrammyMessageHandler | null } = { handler: null };

  return {
    async init() {
      await bot.init();
    },
    beginPolling() {
      if (pollingPromise) return;
      pollingPromise = bot.start();
      void pollingPromise.catch(() => {
        /* surfaced via stopPolling or operational errors */
      });
    },
    async stopPolling() {
      await bot.stop();
      if (pollingPromise) {
        try {
          await pollingPromise;
        } catch {
          // Polling loop may reject when stopped.
        }
        pollingPromise = undefined;
      }
    },
    setMessageDispatcher(handler) {
      routeState.handler = handler;
      if (!installed) {
        installed = true;
        bot.on("message", async (ctx) => {
          const route = routeState.handler;
          if (!ctx.message || !route) return;
          await route({
            chat: { id: ctx.chat.id },
            message: {
              message_id: ctx.message.message_id,
              text: ctx.message.text,
              date: ctx.message.date,
              message_thread_id: ctx.message.message_thread_id,
            },
          });
        });
      }
    },
    async sendMessage(params) {
      const raw = await bot.api.sendMessage(params.chatId, params.text, {
        parse_mode:
          params.parseMode === "html"
            ? "HTML"
            : params.parseMode === "markdown"
              ? "Markdown"
              : undefined,
        reply_parameters: params.replyToMessageId
          ? { message_id: params.replyToMessageId }
          : undefined,
        message_thread_id: params.topicId,
        link_preview_options: params.disableLinkPreview ? { is_disabled: true } : undefined,
      });
      return { message_id: raw.message_id, date: raw.date };
    },
  };
}

/** Default factory: real grammY `Bot` with long-polling transport (TT-028). */
export function defaultGrammyBotClientFactory(credentials: BotApiCredentials): GrammyBotClient {
  return wrapGrammyBot(new Bot(credentials.botToken));
}

/**
 * Bot API adapter via grammY (TT-028): lifecycle, incoming bindings, send (chat/topic).
 */
export class BotApiAdapter implements TelegramProviderAdapter {
  readonly kind = "botApi" as const;
  readonly capabilities: TelegramAdapterCapabilities;
  private readonly records = new Map<string, AdapterRecord>();
  private readonly logger: Logger;

  constructor(
    private readonly clientFactory: GrammyBotClientFactory = defaultGrammyBotClientFactory,
    deps?: { capabilities?: TelegramAdapterCapabilities; logger?: Logger },
  ) {
    this.capabilities = deps?.capabilities ?? DEFAULT_CAPABILITIES;
    this.logger = deps?.logger ?? new NoopLogger();
  }

  async registerBot(input: RegisterBotInput): Promise<void> {
    const { botId } = input;
    if (input.credentials.kind !== "botApi") {
      throw new CapabilityNotSupportedError("BotApiAdapter only supports botApi credentials", {
        meta: { botId, providedKind: input.credentials.kind },
      });
    }
    if (this.records.has(botId)) {
      throw new BotAlreadyExistsError(`Bot already registered: ${botId}`, { meta: { botId } });
    }
    this.records.set(botId, {
      credentials: input.credentials,
      status: BotLifecycle.Registered,
      bindings: new Map(),
    });
    this.logger.info("bot-api client registered", {
      botId,
      runtimeKind: this.kind,
      botToken: maskBotToken(input.credentials.botToken),
    });
  }

  async unregisterBot(botId: string): Promise<void> {
    const rec = this.require(botId);
    if (rec.status === BotLifecycle.Started) {
      throw new LifecycleConflictError("Stop the bot before unregistering", {
        meta: { botId, status: rec.status },
      });
    }
    await this.cleanupRecord(botId, rec);
    this.records.delete(botId);
    this.logger.info("bot-api client unregistered", { botId });
  }

  async startBot(botId: string, options?: OperationOptions): Promise<void> {
    const rec = this.require(botId);
    if (rec.status === BotLifecycle.Started) {
      throw new LifecycleConflictError("Bot is already started", {
        meta: { botId, status: rec.status },
      });
    }

    let client: GrammyBotClient | undefined;
    try {
      client = await this.clientFactory(rec.credentials, options);
      await client.init();
      client.beginPolling();
      rec.client = client;
      rec.status = BotLifecycle.Started;
      this.logger.info("bot-api client started (long polling)", { botId });
    } catch (cause) {
      if (client) {
        try {
          await client.stopPolling();
        } catch {
          // Best-effort cleanup when init/start fails partway.
        }
      }
      throw mapBotApiProviderError(cause, { operation: "startBot", botId });
    }
  }

  async stopBot(botId: string, options?: OperationOptions): Promise<void> {
    void options;
    const rec = this.require(botId);
    if (rec.status !== BotLifecycle.Started || !rec.client) {
      throw new LifecycleConflictError("Bot is not started", {
        meta: { botId, status: rec.status },
      });
    }

    this.removeAllBindings(rec);

    try {
      await rec.client.stopPolling();
      rec.status = BotLifecycle.Registered;
      rec.client = undefined;
      this.logger.info("bot-api client stopped", { botId });
    } catch (cause) {
      throw mapBotApiProviderError(cause, { operation: "stopBot", botId });
    }
  }

  async sendMessage(
    input: SendMessageInput,
    options?: OperationOptions,
  ): Promise<SendMessageResult> {
    void options;
    validateSendMessageInput(input);

    if (input.topicId !== undefined && !this.capabilities.supportsOutgoingForumTopics) {
      throw new CapabilityNotSupportedError(
        "Outgoing forum topics are disabled for this adapter instance",
        { meta: { botId: input.botId, topicId: input.topicId } },
      );
    }

    const rec = this.require(input.botId);
    if (rec.status !== BotLifecycle.Started || !rec.client) {
      throw new BotNotStartedError("Bot must be started before sending messages", {
        meta: { botId: input.botId, chatId: String(input.chatId) },
      });
    }

    const params: GrammySendMessageParams = {
      chatId: toApiChatId(input.chatId),
      text: input.text,
      parseMode: input.parseMode,
      replyToMessageId: input.replyToMessageId,
      disableLinkPreview: input.disableLinkPreview,
      ...(input.topicId !== undefined ? { topicId: input.topicId } : {}),
    };

    try {
      const raw = await rec.client.sendMessage(params);
      const result: SendMessageResult = {
        botId: input.botId,
        chatId: String(input.chatId),
        messageId: raw.message_id,
        date: new Date(raw.date * 1000),
        raw,
      };
      this.logger.info("bot-api message sent", {
        botId: input.botId,
        chatId: String(input.chatId),
        messageId: result.messageId,
        topicId: input.topicId,
      });
      return result;
    } catch (cause) {
      const mapped = mapBotApiProviderError(cause, {
        operation: "sendMessage",
        botId: input.botId,
        chatId: String(input.chatId),
        topicId: input.topicId,
      });
      this.logger.error("bot-api message send failed", {
        botId: input.botId,
        chatId: String(input.chatId),
        topicId: input.topicId,
        error: mapped.message,
      });
      throw mapped;
    }
  }

  async bindIncomingMessages(
    binding: RegisterSubscriptionInput,
    onMessage: (event: IncomingMessageEvent) => void,
    options?: OperationOptions,
  ): Promise<void> {
    void options;
    const rec = this.require(binding.botId);
    if (rec.status !== BotLifecycle.Started || !rec.client) {
      throw new BotNotStartedError("Bot must be started before binding", {
        meta: { botId: binding.botId, bindingId: binding.bindingId },
      });
    }
    if (rec.bindings.has(binding.bindingId)) {
      throw new SubscriptionAlreadyExistsError(`Binding already exists: ${binding.bindingId}`, {
        meta: { botId: binding.botId, bindingId: binding.bindingId },
      });
    }

    rec.bindings.set(binding.bindingId, { binding, onMessage });

    if (rec.bindings.size === 1) {
      rec.client.setMessageDispatcher((ctx) => {
        for (const br of rec.bindings.values()) {
          try {
            const normalized = this.normalizeEvent(br.binding.botId, br.binding, ctx);
            if (!normalized) continue;
            br.onMessage(normalized);
          } catch (err) {
            this.logger.error("binding handler error", {
              botId: br.binding.botId,
              bindingId: br.binding.bindingId,
              error: err instanceof Error ? err.message : String(err),
            });
          }
        }
      });
    }

    this.logger.info("bot-api binding created", {
      botId: binding.botId,
      bindingId: binding.bindingId,
      chatId: String(binding.chatId),
    });
  }

  async unbindIncomingMessages(bindingId: string, options?: OperationOptions): Promise<void> {
    void options;
    const rec = this.findRecordByBindingId(bindingId);
    if (!rec) {
      throw new SubscriptionNotFoundError(`Binding not found: ${bindingId}`, {
        meta: { bindingId },
      });
    }
    rec.bindings.delete(bindingId);
    if (rec.bindings.size === 0) {
      rec.client?.setMessageDispatcher(null);
    }

    this.logger.info("bot-api binding removed", { bindingId });
  }

  async cleanupBot(botId: string): Promise<void> {
    const rec = this.require(botId);
    await this.cleanupRecord(botId, rec);
  }

  private require(botId: string): AdapterRecord {
    const rec = this.records.get(botId);
    if (!rec) {
      throw new BotNotFoundError(`Bot not found: ${botId}`, { meta: { botId } });
    }
    return rec;
  }

  private findRecordByBindingId(bindingId: string): AdapterRecord | undefined {
    for (const rec of this.records.values()) {
      if (rec.bindings.has(bindingId)) return rec;
    }
    return undefined;
  }

  private removeAllBindings(rec: AdapterRecord): void {
    rec.bindings.clear();
    rec.client?.setMessageDispatcher(null);
  }

  private normalizeEvent(
    botId: string,
    binding: RegisterSubscriptionInput,
    ctx: GrammyMessageContext,
  ): IncomingMessageEvent | undefined {
    const chatId = String(ctx.chat.id);
    if (String(binding.chatId) !== chatId) return undefined;

    const topicId = ctx.message.message_thread_id;
    if (binding.topicId !== undefined && topicId !== binding.topicId) return undefined;

    const text = ctx.message.text;
    if (binding.filters?.textIncludes?.length) {
      if (!text) return undefined;
      const matches = binding.filters.textIncludes.some((needle) => text.includes(needle));
      if (!matches) return undefined;
    }

    return {
      botId,
      chatId,
      messageId: ctx.message.message_id,
      text,
      date: new Date(ctx.message.date * 1000),
      topicId,
      raw: ctx,
    };
  }

  private async cleanupRecord(botId: string, rec: AdapterRecord): Promise<void> {
    this.removeAllBindings(rec);
    if (!rec.client) {
      return;
    }
    const client = rec.client;
    try {
      await client.stopPolling();
    } catch (cause) {
      throw mapBotApiProviderError(cause, { operation: "cleanupBot", botId });
    } finally {
      rec.client = undefined;
      rec.status = BotLifecycle.Registered;
      this.logger.debug("bot-api client cleanup complete", { botId });
    }
  }
}
