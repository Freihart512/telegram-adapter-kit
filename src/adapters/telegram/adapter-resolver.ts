import type { TelegramAdapterResolver, TelegramProviderAdapter } from "../../contracts/adapter.js";
import type { RegisterBotInput } from "../../contracts/operations.js";
import type { TelegramRuntimeKind } from "../../contracts/credentials.js";
import { BotRegistry } from "../../core/bot-registry.js";
import { BotNotFoundError } from "../../errors/bot-not-found-error.js";
import { ValidationError } from "../../errors/validation-error.js";
import type { Logger } from "../../observability/logger.js";
import { BotApiAdapter } from "./bot-api/bot-api-adapter.js";
import { GramJsMtprotoAdapter, type GramJsMtprotoClientFactory } from "./mtproto/gramjs-adapter.js";

export type DefaultTelegramAdapterResolverDeps = Readonly<{
  /** Resolves `runtimeKind` for {@link resolveByBotId} (typically from {@link BotRegistry}). */
  getRuntimeKind: (botId: string) => TelegramRuntimeKind | undefined;
  /** Override MTProto adapter (tests) or production {@link GramJsMtprotoAdapter}. */
  mtprotoAdapter?: TelegramProviderAdapter;
  /** Override Bot API adapter (tests) or production {@link BotApiAdapter}. */
  botApiAdapter?: TelegramProviderAdapter;
  /** Used when {@link mtprotoAdapter} is omitted. */
  mtprotoClientFactory?: GramJsMtprotoClientFactory;
  logger?: Logger;
}>;

/**
 * Selects {@link GramJsMtprotoAdapter} or {@link BotApiAdapter} by `credentials.kind` / `runtimeKind` (TRD §7.9, TT-029).
 * Keeps GramJS/grammY types off the core surface; {@link RuntimeManager} depends only on {@link TelegramAdapterResolver}.
 */
export class DefaultTelegramAdapterResolver implements TelegramAdapterResolver {
  private readonly getRuntimeKind: (botId: string) => TelegramRuntimeKind | undefined;
  private readonly mtproto: TelegramProviderAdapter | undefined;
  private readonly botApi: TelegramProviderAdapter;

  constructor(deps: DefaultTelegramAdapterResolverDeps) {
    this.getRuntimeKind = deps.getRuntimeKind;
    this.botApi = deps.botApiAdapter ?? new BotApiAdapter(undefined, { logger: deps.logger });
    if (deps.mtprotoAdapter) {
      this.mtproto = deps.mtprotoAdapter;
    } else if (deps.mtprotoClientFactory) {
      this.mtproto = new GramJsMtprotoAdapter(deps.mtprotoClientFactory, { logger: deps.logger });
    } else {
      this.mtproto = undefined;
    }
  }

  resolve(input: RegisterBotInput): TelegramProviderAdapter {
    return this.adapterForKind(input.credentials.kind);
  }

  resolveByBotId(botId: string): TelegramProviderAdapter {
    const kind = this.getRuntimeKind(botId);
    if (!kind) {
      throw new BotNotFoundError(`No adapter routing for bot: ${botId}`, { meta: { botId } });
    }
    return this.adapterForKind(kind);
  }

  private adapterForKind(kind: TelegramRuntimeKind): TelegramProviderAdapter {
    if (kind === "mtproto") {
      if (!this.mtproto) {
        throw new ValidationError(
          "MTProto adapter is not configured: provide mtprotoAdapter or mtprotoClientFactory",
          { meta: { kind } },
        );
      }
      return this.mtproto;
    }
    if (kind === "botApi") {
      return this.botApi;
    }
    throw new ValidationError('credentials.kind must be "mtproto" or "botApi"', {
      meta: { kind },
    });
  }
}

/**
 * Builds a resolver that reads `runtimeKind` from a {@link BotRegistry} instance.
 *
 * @remarks Pass the **same** `BotRegistry` reference to {@link createRuntimeManager}
 * (`{ botRegistry: registry }`). A different instance breaks `resolveByBotId` after
 * `registerBot` (manager updates one map; resolver reads another). See
 * `Documentacion/ADAPTER-RESOLVER.md`.
 */
export function createDefaultTelegramAdapterResolverForRegistry(
  registry: BotRegistry,
  deps?: Omit<DefaultTelegramAdapterResolverDeps, "getRuntimeKind">,
): DefaultTelegramAdapterResolver {
  return new DefaultTelegramAdapterResolver({
    ...deps,
    getRuntimeKind: (botId) => registry.get(botId)?.runtimeKind,
  });
}
