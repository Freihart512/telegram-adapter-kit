import type { TelegramProviderAdapter } from "../../../contracts/adapter.js";
import type { TelegramAdapterCapabilities } from "../../../contracts/capabilities.js";
import type { MtprotoCredentials } from "../../../contracts/credentials.js";
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
import { mapGramJsProviderError } from "./map-gramjs-error.js";
import type { Logger } from "../../../observability/logger.js";
import { NoopLogger } from "../../../observability/noop-logger.js";

/** Raw GramJS event payload passed to event handlers. */
export type GramJsRawEvent = {
  message?: {
    id?: number;
    message?: string;
    date?: number;
    peerId?: { channelId?: bigint; chatId?: bigint; userId?: bigint };
    replyTo?: { replyToTopId?: number; replyToMsgId?: number };
  };
};

export type GramJsEventHandler = (event: GramJsRawEvent) => void;

/** Parameters for the low-level GramJS sendMessage call. */
export type GramJsSendMessageParams = {
  peer: bigint | number | string;
  message: string;
  parseMode?: "markdown" | "html";
  replyTo?: number;
  linkPreview?: boolean;
  /** Forum topic id (supergroups/channels with topics); maps to provider thread semantics. */
  topicId?: number;
};

/** Raw result returned by the GramJS sendMessage call. */
export type GramJsSendMessageRawResult = {
  id?: number;
  date?: number;
};

export type GramJsMtprotoClient = {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  destroy?(): Promise<void> | void;
  addEventHandler?(handler: GramJsEventHandler): void;
  removeEventHandler?(handler: GramJsEventHandler): void;
  sendMessage?(params: GramJsSendMessageParams): Promise<GramJsSendMessageRawResult>;
};

export type GramJsMtprotoClientFactory = (
  credentials: MtprotoCredentials,
  options?: OperationOptions,
) => Promise<GramJsMtprotoClient> | GramJsMtprotoClient;

type BindingRecord = {
  binding: RegisterSubscriptionInput;
  rawHandler: GramJsEventHandler;
};

type AdapterRecord = {
  credentials: MtprotoCredentials;
  client?: GramJsMtprotoClient;
  status: typeof BotLifecycle.Registered | typeof BotLifecycle.Started;
  bindings: Map<string, BindingRecord>;
};

const DEFAULT_CAPABILITIES: TelegramAdapterCapabilities = Object.freeze({
  supportsOutgoingForumTopics: true,
  supportsIncomingForumTopics: false,
  supportsDynamicSubscriptions: true,
});

/**
 * MTProto adapter: lifecycle (TT-021), incoming bindings (TT-022),
 * outgoing messages (TT-023), and forum topic sends (TT-024).
 */
export class GramJsMtprotoAdapter implements TelegramProviderAdapter {
  readonly kind = "mtproto" as const;
  readonly capabilities: TelegramAdapterCapabilities;
  private readonly records = new Map<string, AdapterRecord>();
  private readonly logger: Logger;

  constructor(
    private readonly clientFactory: GramJsMtprotoClientFactory,
    deps?: { capabilities?: TelegramAdapterCapabilities; logger?: Logger },
  ) {
    this.capabilities = deps?.capabilities ?? DEFAULT_CAPABILITIES;
    this.logger = deps?.logger ?? new NoopLogger();
  }

  async registerBot(input: RegisterBotInput): Promise<void> {
    const { botId } = input;
    if (input.credentials.kind !== "mtproto") {
      throw new CapabilityNotSupportedError(
        "GramJsMtprotoAdapter only supports mtproto credentials",
        {
          meta: { botId, providedKind: input.credentials.kind },
        },
      );
    }
    if (this.records.has(botId)) {
      throw new BotAlreadyExistsError(`Bot already registered: ${botId}`, { meta: { botId } });
    }
    this.records.set(botId, {
      credentials: input.credentials,
      status: BotLifecycle.Registered,
      bindings: new Map(),
    });
    this.logger.info("mtproto client registered", { botId, runtimeKind: this.kind });
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
    this.logger.info("mtproto client unregistered", { botId });
  }

  async startBot(botId: string, options?: OperationOptions): Promise<void> {
    const rec = this.require(botId);
    if (rec.status === BotLifecycle.Started) {
      throw new LifecycleConflictError("Bot is already started", {
        meta: { botId, status: rec.status },
      });
    }

    let client: GramJsMtprotoClient | undefined;
    try {
      client = await this.clientFactory(rec.credentials, options);
      await client.connect();
      rec.client = client;
      rec.status = BotLifecycle.Started;
      this.logger.info("mtproto client started", { botId });
    } catch (cause) {
      if (client) {
        try {
          await client.disconnect();
        } catch {
          // Best-effort cleanup when connect fails partway.
        }
        try {
          await client.destroy?.();
        } catch {
          // Best-effort cleanup when connect fails partway.
        }
      }
      throw mapGramJsProviderError(cause, { operation: "startBot", botId });
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
      await rec.client.disconnect();
      rec.status = BotLifecycle.Registered;
      rec.client = undefined;
      this.logger.info("mtproto client stopped", { botId });
    } catch (cause) {
      throw mapGramJsProviderError(cause, { operation: "stopBot", botId });
    }
  }

  /**
   * Sends a message to a chat or channel. When `input.topicId` is set, forwards it to the client
   * as `GramJsSendMessageParams.topicId` (forum thread). Requires `capabilities.supportsOutgoingForumTopics`
   * for topic sends; override capabilities in constructor deps to disable.
   */
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
    if (!rec.client.sendMessage) {
      throw new CapabilityNotSupportedError("Client does not support sendMessage", {
        meta: { botId: input.botId },
      });
    }

    const params: GramJsSendMessageParams = {
      peer: input.chatId,
      message: input.text,
      parseMode: input.parseMode,
      replyTo: input.replyToMessageId,
      linkPreview: input.disableLinkPreview === true ? false : undefined,
      ...(input.topicId !== undefined ? { topicId: input.topicId } : {}),
    };

    try {
      const raw = await rec.client.sendMessage(params);
      const result: SendMessageResult = {
        botId: input.botId,
        chatId: String(input.chatId),
        messageId: raw.id ?? 0,
        date: raw.date ? new Date(raw.date * 1000) : undefined,
        raw,
      };
      this.logger.info("mtproto message sent", {
        botId: input.botId,
        chatId: String(input.chatId),
        messageId: result.messageId,
        topicId: input.topicId,
      });
      return result;
    } catch (cause) {
      const mapped = mapGramJsProviderError(cause, {
        operation: "sendMessage",
        botId: input.botId,
        chatId: String(input.chatId),
        topicId: input.topicId,
      });
      this.logger.error("mtproto message send failed", {
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

    const rawHandler: GramJsEventHandler = (event) => {
      try {
        const normalized = this.normalizeEvent(binding.botId, binding, event);
        if (!normalized) return;
        onMessage(normalized);
      } catch (err) {
        this.logger.error("binding handler error", {
          botId: binding.botId,
          bindingId: binding.bindingId,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    };

    if (!rec.client.addEventHandler) {
      throw new CapabilityNotSupportedError("Client does not support addEventHandler", {
        meta: { botId: binding.botId, bindingId: binding.bindingId },
      });
    }

    rec.client.addEventHandler(rawHandler);
    rec.bindings.set(binding.bindingId, { binding, rawHandler });

    this.logger.info("mtproto binding created", {
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
    const br = rec.bindings.get(bindingId)!;
    rec.client?.removeEventHandler?.(br.rawHandler);
    rec.bindings.delete(bindingId);

    this.logger.info("mtproto binding removed", { bindingId });
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
    for (const [id, br] of rec.bindings) {
      try {
        rec.client?.removeEventHandler?.(br.rawHandler);
      } catch (err) {
        this.logger.warn("failed to remove event handler during cleanup", {
          bindingId: id,
          error: err instanceof Error ? err.message : String(err),
        });
      }
      this.logger.debug("mtproto binding removed during cleanup", { bindingId: id });
    }
    rec.bindings.clear();
  }

  /**
   * Normalizes a raw GramJS event into `IncomingMessageEvent`.
   * Returns `undefined` if the event doesn't match the binding's chat or filters.
   */
  private normalizeEvent(
    botId: string,
    binding: RegisterSubscriptionInput,
    raw: GramJsRawEvent,
  ): IncomingMessageEvent | undefined {
    const msg = raw.message;
    if (!msg) return undefined;

    const chatId = this.resolveChatId(msg.peerId);
    if (chatId === undefined) return undefined;

    if (String(binding.chatId) !== String(chatId)) return undefined;

    const topicId = msg.replyTo?.replyToTopId;
    if (binding.topicId !== undefined && topicId !== binding.topicId) return undefined;

    const text = msg.message ?? undefined;
    if (binding.filters?.textIncludes?.length) {
      if (!text) return undefined;
      const matches = binding.filters.textIncludes.some((needle) => text.includes(needle));
      if (!matches) return undefined;
    }

    return {
      botId,
      chatId: String(chatId),
      messageId: msg.id ?? 0,
      text,
      date: msg.date ? new Date(msg.date * 1000) : new Date(),
      topicId,
      raw,
    };
  }

  private resolveChatId(peerId?: {
    channelId?: bigint;
    chatId?: bigint;
    userId?: bigint;
  }): bigint | undefined {
    if (!peerId) return undefined;
    return peerId.channelId ?? peerId.chatId ?? peerId.userId;
  }

  private async cleanupRecord(botId: string, rec: AdapterRecord): Promise<void> {
    this.removeAllBindings(rec);
    if (!rec.client) {
      return;
    }
    const client = rec.client;
    try {
      await client.disconnect();
    } catch (cause) {
      throw mapGramJsProviderError(cause, { operation: "cleanupBot", botId });
    } finally {
      try {
        await client.destroy?.();
      } finally {
        rec.client = undefined;
        rec.status = BotLifecycle.Registered;
        this.logger.debug("mtproto client cleanup complete", { botId });
      }
    }
  }
}
