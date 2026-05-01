import type { TelegramRuntimeKind } from "../contracts/credentials.js";
import type { BotLifecycleStatus } from "../contracts/lifecycle.js";
import type { RegisterBotInput } from "../contracts/operations.js";
import { BotAlreadyExistsError } from "../errors/bot-already-exists-error.js";
import { BotNotFoundError } from "../errors/bot-not-found-error.js";
import { LifecycleConflictError } from "../errors/lifecycle-conflict-error.js";

export const BotLifecycle = {
  Registered: "registered",
  Starting: "starting",
  Started: "started",
  Stopping: "stopping",
  Stopped: "stopped",
  Error: "error",
} as const;


export type BotRecord = Readonly<{
  botId: string;
  runtimeKind: TelegramRuntimeKind;
  status: BotLifecycleStatus;
  metadata?: Readonly<Record<string, unknown>>;
}>;

type MutableBotRecord = {
  botId: string;
  runtimeKind: TelegramRuntimeKind;
  status: BotLifecycleStatus;
  metadata?: Record<string, unknown>;
};

type TransitionDecision =
  | { kind: "noop" }
  | { kind: "transition"; next: BotLifecycleStatus }
  | { kind: "conflict"; message: string };

const START_TRANSITIONS: Record<BotLifecycleStatus, TransitionDecision> = {
  [BotLifecycle.Registered]: {
    kind: "transition",
    next: BotLifecycle.Starting,
  },
  [BotLifecycle.Stopped]: {
    kind: "transition",
    next: BotLifecycle.Starting,
  },
  [BotLifecycle.Error]: {
    kind: "transition",
    next: BotLifecycle.Starting,
  },
  [BotLifecycle.Started]: {
    kind: "noop",
  },
  [BotLifecycle.Starting]: {
    kind: "conflict",
    message: "start already in progress",
  },
  [BotLifecycle.Stopping]: {
    kind: "conflict",
    message: "Cannot start while stopping",
  },
};

const COMPLETE_START_TRANSITIONS: Record<BotLifecycleStatus, TransitionDecision> =
  {
    [BotLifecycle.Starting]: {
      kind: "transition",
      next: BotLifecycle.Started,
    },
    [BotLifecycle.Registered]: {
      kind: "conflict",
      message: "completeStart requires status starting",
    },
    [BotLifecycle.Started]: {
      kind: "conflict",
      message: "completeStart requires status starting",
    },
    [BotLifecycle.Stopping]: {
      kind: "conflict",
      message: "completeStart requires status starting",
    },
    [BotLifecycle.Stopped]: {
      kind: "conflict",
      message: "completeStart requires status starting",
    },
    [BotLifecycle.Error]: {
      kind: "conflict",
      message: "completeStart requires status starting",
    },
  };

const STOP_TRANSITIONS: Record<BotLifecycleStatus, TransitionDecision> = {
  [BotLifecycle.Started]: {
    kind: "transition",
    next: BotLifecycle.Stopping,
  },
  [BotLifecycle.Error]: {
    kind: "transition",
    next: BotLifecycle.Stopping,
  },
  [BotLifecycle.Registered]: {
    kind: "transition",
    next: BotLifecycle.Stopped,
  },
  [BotLifecycle.Stopped]: {
    kind: "noop",
  },
  [BotLifecycle.Stopping]: {
    kind: "conflict",
    message: "stop already in progress",
  },
  [BotLifecycle.Starting]: {
    kind: "conflict",
    message: "Cannot stop while starting",
  },
};

const COMPLETE_STOP_TRANSITIONS: Record<BotLifecycleStatus, TransitionDecision> =
  {
    [BotLifecycle.Stopping]: {
      kind: "transition",
      next: BotLifecycle.Stopped,
    },
    [BotLifecycle.Stopped]: {
      kind: "noop",
    },
    [BotLifecycle.Registered]: {
      kind: "conflict",
      message: "completeStop requires status stopping or stopped",
    },
    [BotLifecycle.Starting]: {
      kind: "conflict",
      message: "completeStop requires status stopping or stopped",
    },
    [BotLifecycle.Started]: {
      kind: "conflict",
      message: "completeStop requires status stopping or stopped",
    },
    [BotLifecycle.Error]: {
      kind: "conflict",
      message: "completeStop requires status stopping or stopped",
    },
  };

const MARK_ERROR_TRANSITIONS: Record<BotLifecycleStatus, TransitionDecision> = {
  [BotLifecycle.Starting]: {
    kind: "transition",
    next: BotLifecycle.Error,
  },
  [BotLifecycle.Started]: {
    kind: "transition",
    next: BotLifecycle.Error,
  },
  [BotLifecycle.Stopping]: {
    kind: "transition",
    next: BotLifecycle.Error,
  },
  [BotLifecycle.Registered]: {
    kind: "conflict",
    message: "markError only applies to starting, started or stopping bots",
  },
  [BotLifecycle.Stopped]: {
    kind: "conflict",
    message: "markError only applies to starting, started or stopping bots",
  },
  [BotLifecycle.Error]: {
    kind: "noop",
  },
};

const UNREGISTER_TRANSITIONS: Record<BotLifecycleStatus, TransitionDecision> = {
  [BotLifecycle.Registered]: {
    kind: "transition",
    next: BotLifecycle.Registered,
  },
  [BotLifecycle.Stopped]: {
    kind: "transition",
    next: BotLifecycle.Stopped,
  },
  [BotLifecycle.Starting]: {
    kind: "conflict",
    message: "Stop the bot before unregistering",
  },
  [BotLifecycle.Started]: {
    kind: "conflict",
    message: "Stop the bot before unregistering",
  },
  [BotLifecycle.Stopping]: {
    kind: "conflict",
    message: "Stop the bot before unregistering",
  },
  [BotLifecycle.Error]: {
    kind: "conflict",
    message: "Resolve error state before unregistering",
  },
};

export class BotRegistry {
  private readonly bots = new Map<string, MutableBotRecord>();

  register(input: RegisterBotInput): void {
    if (this.bots.has(input.botId)) {
      throw new BotAlreadyExistsError(`Bot already registered: ${input.botId}`, {
        meta: { botId: input.botId },
      });
    }

    this.bots.set(input.botId, {
      botId: input.botId,
      runtimeKind: input.credentials.kind,
      status: BotLifecycle.Registered,
      metadata: input.metadata ? { ...input.metadata } : undefined,
    });
  }

  unregister(botId: string): void {
    const rec = this.require(botId);
    const decision = UNREGISTER_TRANSITIONS[rec.status];

    this.applyDecision(botId, rec, decision);

    this.bots.delete(botId);
  }

  get(botId: string): BotRecord | undefined {
    const rec = this.bots.get(botId);
    return rec ? this.toReadonlyRecord(rec) : undefined;
  }

  list(): BotRecord[] {
    return [...this.bots.values()].map((rec) => this.toReadonlyRecord(rec));
  }

  beginStart(botId: string): void {
    const rec = this.require(botId);
    const decision = START_TRANSITIONS[rec.status];

    this.applyDecision(botId, rec, decision);
  }

  completeStart(botId: string): void {
    const rec = this.require(botId);
    const decision = COMPLETE_START_TRANSITIONS[rec.status];

    this.applyDecision(botId, rec, decision);
  }

  start(botId: string): void {
    this.beginStart(botId);

    const rec = this.bots.get(botId);

    if (rec?.status === BotLifecycle.Starting) {
      this.completeStart(botId);
    }
  }

  beginStop(botId: string): void {
    const rec = this.require(botId);
    const decision = STOP_TRANSITIONS[rec.status];

    this.applyDecision(botId, rec, decision);
  }

  completeStop(botId: string): void {
    const rec = this.require(botId);
    const decision = COMPLETE_STOP_TRANSITIONS[rec.status];

    this.applyDecision(botId, rec, decision);
  }

  stop(botId: string): void {
    this.beginStop(botId);

    const rec = this.bots.get(botId);

    if (rec?.status === BotLifecycle.Stopping) {
      this.completeStop(botId);
    }
  }

  markError(botId: string): void {
    const rec = this.require(botId);
    const decision = MARK_ERROR_TRANSITIONS[rec.status];

    this.applyDecision(botId, rec, decision);
  }

  private applyDecision(
    botId: string,
    rec: MutableBotRecord,
    decision: TransitionDecision,
  ): void {
    if (decision.kind === "noop") {
      return;
    }

    if (decision.kind === "conflict") {
      throw new LifecycleConflictError(decision.message, {
        meta: { botId, status: rec.status },
      });
    }

    rec.status = decision.next;
  }

  private require(botId: string): MutableBotRecord {
    const rec = this.bots.get(botId);

    if (!rec) {
      throw new BotNotFoundError(`Bot not found: ${botId}`, {
        meta: { botId },
      });
    }

    return rec;
  }

  private toReadonlyRecord(rec: MutableBotRecord): BotRecord {
    return Object.freeze({
      botId: rec.botId,
      runtimeKind: rec.runtimeKind,
      status: rec.status,
      metadata: rec.metadata
        ? Object.freeze({ ...rec.metadata })
        : undefined,
    });
  }
}
