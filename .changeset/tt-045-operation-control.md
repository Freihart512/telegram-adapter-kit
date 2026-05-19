---
"telegram-adapter-kit": minor
---

Wire `timeoutMs` and `AbortSignal` into RuntimeManager via `withOperationControl` (TT-045). Each retry attempt runs under `withTimeout`; per-operation retry policy from TT-046 is preserved. Fulfills PRD CA-10 for public runtime operations.
