import type { TelegramProviderAdapter } from "../../../contracts/adapter.js";
import type { TelegramAdapterCapabilities } from "../../../contracts/capabilities.js";
import type { MtprotoCredentials } from "../../../contracts/credentials.js";
import type { IncomingMessageEvent } from "../../../contracts/events.js";
import type {
  OperationOptions,
  RegisterBotInput,
  RegisterSubscriptionInput,
  SendMessageResult,
} from "../../../contracts/operations.js";
import { BotAlreadyExistsError } from "../../../errors/bot-already-exists-error.js";
import { BotNotFoundError } from "../../../errors/bot-not-found-error.js";
import { BotNotStartedError } from "../../../errors/bot-not-started-error.js";
import { CapabilityNotSupportedError } from "../../../errors/capability-not-supported-error.js";
import { LifecycleConflictError } from "../../../errors/lifecycle-conflict-error.js";
import { SubscriptionAlreadyExistsError } from "../../../errors/subscription-already-exists-error.js";
import { SubscriptionNotFoundError } from "../../../errors/subscription-not-found-error.js";
import { mapUnknownToSdkError } from "../../../errors/map-external.js";
import type { Logger } from "../../../observability/logger.js";
import { NoopLogger } from "../../../observability/noop-logger.js";
import { BotLifecycle } from "../../../core/bot-registry.js";

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

export type GramJsMtprotoClient = {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  destroy?(): Promise<void> | void;
  addEventHandler?(handler: GramJsEventHandler): void;
  removeEventHandler?(handler: GramJsEventHandler): void;
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
  supportsOutgoingForumTopics: false,
  supportsIncomingForumTopics: false,
  supportsDynamicSubscriptions: true,
});

/**
 * Base MTProto adapter for lifecycle and cleanup (TT-021).
 * Incoming bindings and send operations are completed in follow-up tasks.
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
      throw new CapabilityNotSupportedError("GramJsMtprotoAdapter only supports mtproto credentials", {
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
      throw mapUnknownToSdkError(cause);
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
      throw mapUnknownToSdkError(cause);
    }
  }

  async sendMessage(): Promise<SendMessageResult> {
    throw new CapabilityNotSupportedError("sendMessage is not available until TT-023", {
      meta: { runtimeKind: this.kind },
    });
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
      throw new SubscriptionAlreadyExistsError(
        `Binding already exists: ${binding.bindingId}`,
        { meta: { botId: binding.botId, bindingId: binding.bindingId } },
      );
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
      throw new CapabilityNotSupportedError(
        "Client does not support addEventHandler",
        { meta: { botId: binding.botId, bindingId: binding.bindingId } },
      );
    }

    rec.client.addEventHandler(rawHandler);
    rec.bindings.set(binding.bindingId, { binding, rawHandler });

    this.logger.info("mtproto binding created", {
      botId: binding.botId,
      bindingId: binding.bindingId,
      chatId: String(binding.chatId),
    });
  }

  async unbindIncomingMessages(
    bindingId: string,
    options?: OperationOptions,
  ): Promise<void> {
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

  private resolveChatId(
    peerId?: { channelId?: bigint; chatId?: bigint; userId?: bigint },
  ): bigint | undefined {
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
      throw mapUnknownToSdkError(cause);
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
