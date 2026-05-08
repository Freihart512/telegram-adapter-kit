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
import { NoopLogger } from "../observability/noop-logger.js";
import type { Logger } from "../observability/logger.js";
import { BotLifecycle, BotRegistry } from "./bot-registry.js";
import { EventBus } from "./event-bus.js";
import { SubscriptionRegistry, type SubscriptionBinding } from "./subscription-registry.js";
import {
  validateBindingId,
  validateBotId,
  validateHandler,
  validateOperationOptions,
  validateRegisterBotInput,
  validateRegisterSubscriptionInput,
  validateSendMessageInput,
} from "./validators.js";

export type RuntimeManagerDeps = Readonly<{
  botRegistry?: BotRegistry;
  subscriptionRegistry?: SubscriptionRegistry;
  eventBus?: EventBus;
  logger?: Logger;
}>;

/** Orchestrates registries, event bus and provider adapter (`TelegramRuntimeSdk`, TRD §5.1, TT-015). */
export class RuntimeManager implements TelegramRuntimeSdk {
  private readonly bots: BotRegistry;
  private readonly subscriptions: SubscriptionRegistry;
  private readonly bus: EventBus;
  private readonly logger: Logger;

  constructor(
    private readonly resolver: TelegramAdapterResolver,
    deps?: RuntimeManagerDeps,
  ) {
    this.bots = deps?.botRegistry ?? new BotRegistry();
    this.bus = deps?.eventBus ?? new EventBus();
    this.logger = deps?.logger ?? new NoopLogger();
    this.subscriptions =
      deps?.subscriptionRegistry ??
      new SubscriptionRegistry((botId) => this.bots.get(botId) !== undefined);
  }

  async registerBot(input: RegisterBotInput, options?: OperationOptions): Promise<void> {
    validateRegisterBotInput(input);
    validateOperationOptions(options);
    const adapter = this.adapterForRegister(input);
    this.logger.debug("registerBot requested", {
      botId: input.botId,
      runtimeKind: input.credentials.kind,
    });

    this.bots.register(input);
    try {
      await this.guard(adapter.registerBot(input, options), "registerBot", {
        botId: input.botId,
      });
    } catch (cause) {
      this.bots.unregister(input.botId);
      throw cause;
    }
    this.logger.info("bot registered", {
      botId: input.botId,
      runtimeKind: input.credentials.kind,
    });
    this.notifyBotState(input.botId, BotLifecycle.Registered, undefined);
  }

  async unregisterBot(botId: string, options?: OperationOptions): Promise<void> {
    validateBotId(botId);
    validateOperationOptions(options);
    this.requireBot(botId);
    const adapter = this.adapterForBot(botId);
    const bindings = this.subscriptions.listByBotId(botId);
    this.logger.debug("unregisterBot requested", { botId, bindingCount: bindings.length });

    for (const binding of bindings) {
      await this.guard(adapter.unbindIncomingMessages(binding.bindingId, options), "unbindIncomingMessages", {
        botId,
        bindingId: binding.bindingId,
      });
    }

    await this.guard(adapter.unregisterBot(botId, options), "unregisterBot", { botId });
    await this.guard(adapter.cleanupBot(botId, options), "cleanupBot", { botId });
    this.subscriptions.unregisterByBotId(botId);
    this.bots.unregister(botId);
    this.logger.info("bot unregistered", { botId });
  }

  async startBot(botId: string, options?: OperationOptions): Promise<void> {
    validateBotId(botId);
    validateOperationOptions(options);
    const rec = this.requireBot(botId);
    if (rec.status === BotLifecycle.Started) {
      this.logger.warn("startBot skipped because bot is already started", { botId });
      return;
    }

    const adapter = this.adapterForBot(botId);
    const previousBeforeStart = rec.status;
    this.bots.beginStart(botId);
    this.notifyBotState(botId, BotLifecycle.Starting, previousBeforeStart);
    const afterBegin = this.requireBot(botId);

    try {
      await this.guard(adapter.startBot(botId, options), "startBot", { botId });
    } catch (cause) {
      this.bots.markError(botId);
      this.notifyBotState(botId, BotLifecycle.Error, afterBegin.status);
      throw cause;
    }

    this.bots.completeStart(botId);
    this.logger.info("bot started", { botId });
    this.notifyBotState(botId, BotLifecycle.Started, BotLifecycle.Starting);
  }

  async stopBot(botId: string, options?: OperationOptions): Promise<void> {
    validateBotId(botId);
    validateOperationOptions(options);
    const rec = this.requireBot(botId);
    if (rec.status === BotLifecycle.Stopped) {
      this.logger.warn("stopBot skipped because bot is already stopped", { botId });
      return;
    }

    const adapter = this.adapterForBot(botId);

    if (rec.status === BotLifecycle.Registered) {
      const previousBeforeStop = rec.status;
      this.bots.beginStop(botId);
      this.logger.info("bot stopped from registered state", { botId });
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
      await this.guard(adapter.stopBot(botId, options), "stopBot", { botId });
    } catch (cause) {
      this.bots.markError(botId);
      this.notifyBotState(botId, BotLifecycle.Error, mid.status);
      throw cause;
    }

    this.bots.completeStop(botId);
    this.logger.info("bot stopped", { botId });
    this.notifyBotState(botId, BotLifecycle.Stopped, BotLifecycle.Stopping);
  }

  async registerSubscription(
    input: RegisterSubscriptionInput,
    options?: OperationOptions,
  ): Promise<void> {
    validateRegisterSubscriptionInput(input);
    validateOperationOptions(options);
    this.assertBotStarted(input.botId);
    this.subscriptions.register(input);
    const adapter = this.adapterForBot(input.botId);
    const bindingId = input.bindingId;
    this.logger.debug("registerSubscription requested", {
      bindingId,
      botId: input.botId,
      hasFilters: Boolean(input.filters?.textIncludes?.length),
    });
    const forward = (event: IncomingMessageEvent) => {
      const binding = this.subscriptions.get(bindingId);
      if (!binding) {
        return;
      }
      if (!this.passesFilter(binding, event)) {
        return;
      }
      this.bus.emitMessage(event);
    };

    try {
      await this.guard(adapter.bindIncomingMessages(input, forward, options), "bindIncomingMessages", {
        botId: input.botId,
        bindingId,
      });
    } catch (cause) {
      this.subscriptions.unregister(input.bindingId);
      throw cause;
    }
    this.logger.info("subscription registered", {
      bindingId: input.bindingId,
      botId: input.botId,
    });
  }

  async unregisterSubscription(bindingId: string, options?: OperationOptions): Promise<void> {
    validateBindingId(bindingId);
    validateOperationOptions(options);
    const binding = this.subscriptions.get(bindingId);
    if (!binding) {
      throw new SubscriptionNotFoundError(`Subscription not found: ${bindingId}`, {
        meta: { bindingId },
      });
    }

    const adapter = this.adapterForBot(binding.botId);
    await this.guard(adapter.unbindIncomingMessages(bindingId, options), "unbindIncomingMessages", {
      botId: binding.botId,
      bindingId,
    });
    this.subscriptions.unregister(bindingId);
    this.logger.info("subscription unregistered", { bindingId, botId: binding.botId });
  }

  async sendMessage(
    input: SendMessageInput,
    options?: OperationOptions,
  ): Promise<SendMessageResult> {
    validateSendMessageInput(input);
    validateOperationOptions(options);
    this.assertBotStarted(input.botId);
    const adapter = this.adapterForBot(input.botId);
    this.logger.debug("sendMessage requested", {
      botId: input.botId,
      hasTopicId: input.topicId !== undefined,
      parseMode: input.parseMode,
    });
    const result = await this.guard(adapter.sendMessage(input, options), "sendMessage", {
      botId: input.botId,
    });
    this.logger.info("message sent", {
      botId: result.botId,
      chatId: result.chatId,
      messageId: result.messageId,
    });
    return result;
  }

  onMessage(handler: MessageHandler): UnsubscribeFn {
    validateHandler<MessageHandler>(handler, "onMessage handler");
    return this.bus.onMessage(handler);
  }

  onError(handler: ErrorHandler): UnsubscribeFn {
    validateHandler<ErrorHandler>(handler, "onError handler");
    return this.bus.onError(handler);
  }

  onBotStateChange(handler: BotStateHandler): UnsubscribeFn {
    validateHandler<BotStateHandler>(handler, "onBotStateChange handler");
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

  private passesFilter(binding: SubscriptionBinding, event: IncomingMessageEvent): boolean {
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
    this.logger.debug("bot state changed", {
      botId,
      status,
      previousStatus,
    });
    this.bus.emitBotStateChange({
      botId,
      status,
      at: new Date(),
      previousStatus,
    });
  }

  private async guard<T>(
    promise: Promise<T>,
    operation: string,
    meta?: Readonly<Record<string, unknown>>,
  ): Promise<T> {
    try {
      return await promise;
    } catch (cause) {
      const mapped = mapUnknownToSdkError(cause);
      this.logger.error("runtime operation failed", {
        operation,
        code: mapped.code,
        ...meta,
      });
      this.bus.emitError(mapped);
      throw mapped;
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
