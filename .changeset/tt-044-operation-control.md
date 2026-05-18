---
"telegram-adapter-kit": minor
---

Add internal `withTimeout` helper (`src/utils/timeout.ts`) for per-call timeouts and AbortSignal cancellation (TT-044). Used by the runtime in TT-045; not exported from the package entrypoint yet. Rejects with `OperationTimeoutError` or `OperationCancelledError` and cleans up timers/listeners on all completion paths.
