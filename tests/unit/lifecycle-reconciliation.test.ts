import { describe, expect, it } from "vitest";
import {
  isOperationalInterruption,
  isStopAbortRevertTarget,
  STOP_ABORT_REVERT_TARGETS,
} from "../../src/core/lifecycle-reconciliation.js";
import {
  OperationCancelledError,
  OperationTimeoutError,
  ValidationError,
} from "../../src/index.js";

describe("lifecycle reconciliation (TT-047)", () => {
  it("detects operational interruptions", () => {
    expect(isOperationalInterruption(new OperationTimeoutError("t"))).toBe(true);
    expect(isOperationalInterruption(new OperationCancelledError("c"))).toBe(true);
    expect(isOperationalInterruption(new ValidationError("v"))).toBe(false);
  });

  it("validates stop abort revert targets from STOP_ABORT_REVERT_TARGETS", () => {
    for (const status of STOP_ABORT_REVERT_TARGETS) {
      expect(isStopAbortRevertTarget(status)).toBe(true);
    }
    expect(isStopAbortRevertTarget("registered")).toBe(false);
  });
});
