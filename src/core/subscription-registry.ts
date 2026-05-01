import type { RegisterSubscriptionInput } from "../contracts/operations.js";
import { BotNotFoundError } from "../errors/bot-not-found-error.js";
import { SubscriptionAlreadyExistsError } from "../errors/subscription-already-exists-error.js";
import { SubscriptionNotFoundError } from "../errors/subscription-not-found-error.js";

export type SubscriptionBinding = Readonly<{
  bindingId: string;
  botId: string;
  chatId: bigint | number | string;
  topicId?: number;
  filters?: Readonly<{
    textIncludes?: readonly string[];
  }>;
}>;

type MutableSubscriptionBinding = {
  bindingId: string;
  botId: string;
  chatId: bigint | number | string;
  topicId?: number;
  filters?: {
    textIncludes?: string[];
  };
};

export class SubscriptionRegistry {
  private readonly bindingsById = new Map<string, MutableSubscriptionBinding>();
  private readonly bindingIdsByBotId = new Map<string, Set<string>>();

  constructor(private readonly botExists: (botId: string) => boolean) {}

  register(input: RegisterSubscriptionInput): void {
    if (this.bindingsById.has(input.bindingId)) {
      throw new SubscriptionAlreadyExistsError(`Subscription already exists: ${input.bindingId}`, {
        meta: { bindingId: input.bindingId },
      });
    }

    if (!this.botExists(input.botId)) {
      throw new BotNotFoundError(`Bot not found: ${input.botId}`, {
        meta: {
          botId: input.botId,
          bindingId: input.bindingId,
        },
      });
    }

    const binding: MutableSubscriptionBinding = {
      bindingId: input.bindingId,
      botId: input.botId,
      chatId: input.chatId,
      topicId: input.topicId,
      filters: input.filters
        ? {
            textIncludes: input.filters.textIncludes ? [...input.filters.textIncludes] : undefined,
          }
        : undefined,
    };

    this.bindingsById.set(binding.bindingId, binding);
    this.addToBotIndex(binding.botId, binding.bindingId);
  }

  unregister(bindingId: string): void {
    const existing = this.require(bindingId);

    this.bindingsById.delete(bindingId);
    this.removeFromBotIndex(existing.botId, bindingId);
  }

  /**
   * Removes all bindings associated to a bot and returns the removed snapshot list.
   * Intended for runtime cleanup flows such as `unregisterBot`.
   */
  unregisterByBotId(botId: string): SubscriptionBinding[] {
    const existing = this.listByBotId(botId);

    for (const binding of existing) {
      this.unregister(binding.bindingId);
    }

    return existing;
  }

  get(bindingId: string): SubscriptionBinding | undefined {
    const binding = this.bindingsById.get(bindingId);
    return binding ? this.toReadonly(binding) : undefined;
  }

  list(): SubscriptionBinding[] {
    return [...this.bindingsById.values()].map((binding) => this.toReadonly(binding));
  }

  listByBotId(botId: string): SubscriptionBinding[] {
    const bindingIds = this.bindingIdsByBotId.get(botId);

    if (!bindingIds) {
      return [];
    }

    return [...bindingIds]
      .map((bindingId) => this.bindingsById.get(bindingId))
      .filter((binding): binding is MutableSubscriptionBinding => Boolean(binding))
      .map((binding) => this.toReadonly(binding));
  }

  private require(bindingId: string): MutableSubscriptionBinding {
    const binding = this.bindingsById.get(bindingId);

    if (!binding) {
      throw new SubscriptionNotFoundError(`Subscription not found: ${bindingId}`, {
        meta: { bindingId },
      });
    }

    return binding;
  }

  private addToBotIndex(botId: string, bindingId: string): void {
    let bindingIds = this.bindingIdsByBotId.get(botId);

    if (!bindingIds) {
      bindingIds = new Set<string>();
      this.bindingIdsByBotId.set(botId, bindingIds);
    }

    bindingIds.add(bindingId);
  }

  private removeFromBotIndex(botId: string, bindingId: string): void {
    const bindingIds = this.bindingIdsByBotId.get(botId);

    if (!bindingIds) {
      return;
    }

    bindingIds.delete(bindingId);

    if (bindingIds.size === 0) {
      this.bindingIdsByBotId.delete(botId);
    }
  }

  private toReadonly(binding: MutableSubscriptionBinding): SubscriptionBinding {
    return Object.freeze({
      bindingId: binding.bindingId,
      botId: binding.botId,
      chatId: binding.chatId,
      topicId: binding.topicId,
      filters: binding.filters
        ? Object.freeze({
            textIncludes: binding.filters.textIncludes
              ? Object.freeze([...binding.filters.textIncludes])
              : undefined,
          })
        : undefined,
    });
  }
}
