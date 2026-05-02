import type {
  BotStateEvent,
  IncomingMessageEvent,
  TelegramRuntimeError,
  UnsubscribeFn,
} from "../contracts/index.js";
import { HandlerExecutionError } from "../errors/index.js";

export const EventChannels = {
  Message: "message",
  Error: "error",
  BotStateChange: "botStateChange",
} as const;

export type EventChannel = (typeof EventChannels)[keyof typeof EventChannels];

export type EventMap = {
  [EventChannels.Message]: IncomingMessageEvent;
  [EventChannels.Error]: TelegramRuntimeError;
  [EventChannels.BotStateChange]: BotStateEvent;
};

type Handler<K extends EventChannel> = (event: EventMap[K]) => void;

export class EventBus {
  private readonly subscribers: {
    [K in EventChannel]: Set<Handler<K>>;
  } = {
    [EventChannels.Message]: new Set<Handler<typeof EventChannels.Message>>(),
    [EventChannels.Error]: new Set<Handler<typeof EventChannels.Error>>(),
    [EventChannels.BotStateChange]: new Set<Handler<typeof EventChannels.BotStateChange>>(),
  };

  subscribe<K extends EventChannel>(channel: K, handler: Handler<K>): UnsubscribeFn {
    this.subscribers[channel].add(handler);

    return () => {
      this.subscribers[channel].delete(handler);
    };
  }

  publish<K extends EventChannel>(channel: K, event: EventMap[K]): void {
    const handlers = [...this.subscribers[channel]];

    for (const handler of handlers) {
      this.safeInvoke(channel, handler, event);
    }
  }

  onMessage(handler: Handler<typeof EventChannels.Message>): UnsubscribeFn {
    return this.subscribe(EventChannels.Message, handler);
  }

  onError(handler: Handler<typeof EventChannels.Error>): UnsubscribeFn {
    return this.subscribe(EventChannels.Error, handler);
  }

  onBotStateChange(handler: Handler<typeof EventChannels.BotStateChange>): UnsubscribeFn {
    return this.subscribe(EventChannels.BotStateChange, handler);
  }

  emitMessage(event: IncomingMessageEvent): void {
    this.publish(EventChannels.Message, event);
  }

  emitError(event: TelegramRuntimeError): void {
    this.publish(EventChannels.Error, event);
  }

  emitBotStateChange(event: BotStateEvent): void {
    this.publish(EventChannels.BotStateChange, event);
  }

  private safeInvoke<K extends EventChannel>(
    channel: K,
    handler: Handler<K>,
    event: EventMap[K],
  ): void {
    try {
      handler(event);
    } catch (cause) {
      this.reportHandlerFailure(channel, cause);
    }
  }

  private reportHandlerFailure(channel: EventChannel, cause: unknown): void {
    if (channel === EventChannels.Error) {
      return;
    }

    const error = new HandlerExecutionError("Event handler execution failed", {
      cause,
      meta: { channel },
    });

    this.emitError(error);
  }
}
