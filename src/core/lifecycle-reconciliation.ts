import type { BotLifecycleStatus } from "../contracts/lifecycle.js";
import { OperationCancelledError } from "../errors/operation-cancelled-error.js";
import { OperationTimeoutError } from "../errors/operation-timeout-error.js";

/** Failures that trigger lifecycle reconciliation (TT-047) instead of generic `markError`. */
export function isOperationalInterruption(
  error: unknown,
): error is OperationTimeoutError | OperationCancelledError {
  return error instanceof OperationTimeoutError || error instanceof OperationCancelledError;
}

/** Allowed revert targets after interrupted `stopBot` (RECONCILIATION-LIFECYCLE.md). */
export const STOP_ABORT_REVERT_TARGETS: readonly BotLifecycleStatus[] = [
  "started",
  "error",
] as const;

export function isStopAbortRevertTarget(status: BotLifecycleStatus): boolean {
  return (STOP_ABORT_REVERT_TARGETS as readonly string[]).includes(status);
}
