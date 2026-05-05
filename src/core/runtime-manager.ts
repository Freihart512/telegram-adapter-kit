import type { TelegramAdapterResolver } from "../contracts/adapter.js";
import type { BotLifecycleStatus } from "../contracts/lifecycle.js";
import type {
  BotStateHandler,
  ErrorHandler,
  IncomingMessageEvent,
  MessageHandler,
  UnsubscribeFn,
} from "../contracts/events.js";
import type {
  OperationOptions,
  RegisterBotInput,
  RegisterSubscriptionInput,
  SendMessageInput,
  SendMessageResult,
} from "../contracts/operations.js";
import type { TelegramRuntimeSdk } from "../contracts/sdk.js";
import { BotNotFoundError } from "../errors/bot-not-found-error.js";
import { BotNotStartedError } from "../errors/bot-not-started-error.js";
import { mapUnknownToSdkError } from "../errors/map-external.js";
import { SubscriptionNotFoundError } from "../errors/subscription-not-found-error.js";
import { BotLifecycle, BotRegistry } from "./bot-registry.js";
import { EventBus } from "./event-bus.js";
import { SubscriptionRegistry } from "./subscription-registry.js";

export type RuntimeManagerDeps = Readonly<{
  botRegistry?: BotRegistry;
  subscriptionRegistry?: SubscriptionRegistry;
  eventBus?: EventBus;
}>;

/** Orchestrates registries, event bus and provider adapter (`TelegramRuntimeSdk`, TRD §5.1, TT-015). */
export class RuntimeManager implements TelegramRuntimeSdk {
  private readonly bots: BotRegistry;
  private readonly subscriptions: SubscriptionRegistry;
  private readonly bus: EventBus;

  constructor(
    private readonly resolver: TelegramAdapterResolver,
    deps?: RuntimeManagerDeps,
  ) {
    this.bots = deps?.botRegistry ?? new BotRegistry();
    this.bus = deps?.eventBus ?? new EventBus();
    this.subscriptions =
      deps?.subscriptionRegistry ??
      new SubscriptionRegistry((botId) => this.bots.get(botId) !== undefined);
  }

  async registerBot(input: RegisterBotInput, options?: OperationOptions): Promise<void> {
    const adapter = this.adapterForRegister(input);

    this.bots.register(input);
    try {
      await this.guard(adapter.registerBot(input, options));
    } catch (cause) {
      this.bots.unregister(input.botId);
      throw cause;
    }
    this.notifyBotState(input.botId, BotLifecycle.Registered, undefined);
  }

  async unregisterBot(botId: string, options?: OperationOptions): Promise<void> {
    this.requireBot(botId);
    const adapter = this.adapterForBot(botId);
    const bindings = this.subscriptions.listByBotId(botId);

    for (const binding of bindings) {
      await this.guard(adapter.unbindIncomingMessages(binding.bindingId, options));
    }

    await this.guard(adapter.unregisterBot(botId, options));
    await this.guard(adapter.cleanupBot(botId, options));
    this.subscriptions.unregisterByBotId(botId);
    this.bots.unregister(botId);
  }

  async startBot(botId: string, options?: OperationOptions): Promise<void> {
    const rec = this.requireBot(botId);
    if (rec.status === BotLifecycle.Started) {
      return;
    }

    const adapter = this.adapterForBot(botId);
    const previousBeforeStart = rec.status;
    this.bots.beginStart(botId);
    this.notifyBotState(botId, BotLifecycle.Starting, previousBeforeStart);
    const afterBegin = this.requireBot(botId);

    try {
      await this.guard(adapter.startBot(botId, options));
    } catch (cause) {
      this.bots.markError(botId);
      this.notifyBotState(botId, BotLifecycle.Error, afterBegin.status);
      throw cause;
    }

    this.bots.completeStart(botId);
    this.notifyBotState(botId, BotLifecycle.Started, BotLifecycle.Starting);
  }

  async stopBot(botId: string, options?: OperationOptions): Promise<void> {
    const rec = this.requireBot(botId);
    if (rec.status === BotLifecycle.Stopped) {
      return;
    }

    const adapter = this.adapterForBot(botId);

    if (rec.status === BotLifecycle.Registered) {
      const previousBeforeStop = rec.status;
      this.bots.beginStop(botId);
      this.notifyBotState(botId, BotLifecycle.Stopped, previousBeforeStop);
      return;
    }

    const previousBeforeStop = rec.status;
    this.bots.beginStop(botId);
    const mid = this.requireBot(botId);
    if (mid.status === BotLifecycle.Stopping) {
      this.notifyBotState(botId, BotLifecycle.Stopping, previousBeforeStop);
    }

    try {
      await this.guard(adapter.stopBot(botId, options));
    } catch (cause) {
      this.bots.markError(botId);
      this.notifyBotState(botId, BotLifecycle.Error, mid.status);
      throw cause;
    }

    this.bots.completeStop(botId);
    this.notifyBotState(botId, BotLifecycle.Stopped, BotLifecycle.Stopping);
  }

  async registerSubscription(
    input: RegisterSubscriptionInput,
    options?: OperationOptions,
  ): Promise<void> {
    this.assertBotStarted(input.botId);
    this.subscriptions.register(input);
    const adapter = this.adapterForBot(input.botId);
    const forward = (event: IncomingMessageEvent) => {
      if (!this.passesFilter(input, event)) {
        return;
      }
      this.bus.emitMessage(event);
    };

    try {
      await this.guard(adapter.bindIncomingMessages(input, forward, options));
    } catch (cause) {
      this.subscriptions.unregister(input.bindingId);
      throw cause;
    }
  }

  async unregisterSubscription(bindingId: string, options?: OperationOptions): Promise<void> {
    const binding = this.subscriptions.get(bindingId);
    if (!binding) {
      throw new SubscriptionNotFoundError(`Subscription not found: ${bindingId}`, {
        meta: { bindingId },
      });
    }

    const adapter = this.adapterForBot(binding.botId);
    await this.guard(adapter.unbindIncomingMessages(bindingId, options));
    this.subscriptions.unregister(bindingId);
  }

  async sendMessage(
    input: SendMessageInput,
    options?: OperationOptions,
  ): Promise<SendMessageResult> {
    this.assertBotStarted(input.botId);
    const adapter = this.adapterForBot(input.botId);
    return this.guard(adapter.sendMessage(input, options));
  }

  onMessage(handler: MessageHandler): UnsubscribeFn {
    return this.bus.onMessage(handler);
  }

  onError(handler: ErrorHandler): UnsubscribeFn {
    return this.bus.onError(handler);
  }

  onBotStateChange(handler: BotStateHandler): UnsubscribeFn {
    return this.bus.onBotStateChange(handler);
  }

  private adapterForRegister(input: RegisterBotInput) {
    return this.resolver.resolve(input);
  }

  private adapterForBot(botId: string) {
    return this.resolver.resolveByBotId(botId);
  }

  private requireBot(botId: string) {
    const rec = this.bots.get(botId);
    if (!rec) {
      throw new BotNotFoundError(`Bot not found: ${botId}`, { meta: { botId } });
    }
    return rec;
  }

  private assertBotStarted(botId: string): void {
    const rec = this.requireBot(botId);
    if (rec.status !== BotLifecycle.Started) {
      throw new BotNotStartedError(`Bot is not started: ${botId}`, {
        meta: { botId, status: rec.status },
      });
    }
  }

  private passesFilter(binding: RegisterSubscriptionInput, event: IncomingMessageEvent): boolean {
    const includes = binding.filters?.textIncludes;
    if (!includes?.length) {
      return true;
    }
    const text = event.text ?? "";
    return includes.some((fragment) => text.includes(fragment));
  }

  private notifyBotState(
    botId: string,
    status: BotLifecycleStatus,
    previousStatus: BotLifecycleStatus | undefined,
  ): void {
    this.bus.emitBotStateChange({
      botId,
      status,
      at: new Date(),
      previousStatus,
    });
  }

  private async guard<T>(promise: Promise<T>): Promise<T> {
    try {
      return await promise;
    } catch (cause) {
      throw mapUnknownToSdkError(cause);
    }
  }
}

/** Factory for {@link RuntimeManager} (entrypoint per TRD). */
export function createRuntimeManager(
  resolver: TelegramAdapterResolver,
  deps?: RuntimeManagerDeps,
): TelegramRuntimeSdk {
  return new RuntimeManager(resolver, deps);
}
