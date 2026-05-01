/** Bot lifecycle states including intermediate transitions (TRD §7.6). */
export type BotLifecycleStatus =
  | "registered"
  | "starting"
  | "started"
  | "stopping"
  | "stopped"
  | "error";

/** Emitted by `onBotStateChange` when a bot transitions lifecycle. */
export type BotStateEvent = {
  botId: string;
  status: BotLifecycleStatus;
  at: Date;
  previousStatus?: BotLifecycleStatus;
};
