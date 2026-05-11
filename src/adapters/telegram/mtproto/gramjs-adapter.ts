import type { TelegramProviderAdapter } from "../../../contracts/adapter.js";
import type { TelegramAdapterCapabilities } from "../../../contracts/capabilities.js";
import type { MtprotoCredentials } from "../../../contracts/credentials.js";
import type { OperationOptions, RegisterBotInput, SendMessageResult } from "../../../contracts/operations.js";
import { BotAlreadyExistsError } from "../../../errors/bot-already-exists-error.js";
import { BotNotFoundError } from "../../../errors/bot-not-found-error.js";
import { CapabilityNotSupportedError } from "../../../errors/capability-not-supported-error.js";
import { LifecycleConflictError } from "../../../errors/lifecycle-conflict-error.js";
import { mapUnknownToSdkError } from "../../../errors/map-external.js";
import type { Logger } from "../../../observability/logger.js";
import { NoopLogger } from "../../../observability/noop-logger.js";
import { BotLifecycle } from "../../../core/bot-registry.js";

export type GramJsMtprotoClient = {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  destroy?(): Promise<void> | void;
};

export type GramJsMtprotoClientFactory = (
  credentials: MtprotoCredentials,
  options?: OperationOptions,
) => Promise<GramJsMtprotoClient> | GramJsMtprotoClient;

type AdapterRecord = {
  credentials: MtprotoCredentials;
  client?: GramJsMtprotoClient;
  status: typeof BotLifecycle.Registered | typeof BotLifecycle.Started;
};

const DEFAULT_CAPABILITIES: TelegramAdapterCapabilities = Object.freeze({
  supportsOutgoingForumTopics: false,
  supportsIncomingForumTopics: false,
  supportsDynamicSubscriptions: false,
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

  async bindIncomingMessages(): Promise<void> {
    throw new CapabilityNotSupportedError("bindIncomingMessages is not available until TT-022", {
      meta: { runtimeKind: this.kind },
    });
  }

  async unbindIncomingMessages(): Promise<void> {
    throw new CapabilityNotSupportedError("unbindIncomingMessages is not available until TT-022", {
      meta: { runtimeKind: this.kind },
    });
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

  private async cleanupRecord(botId: string, rec: AdapterRecord): Promise<void> {
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
