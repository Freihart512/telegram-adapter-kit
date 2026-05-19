---
"telegram-adapter-kit": patch
---

Reconcile bot registry state after operational timeout or cancellation on lifecycle operations (TT-047). `startBot` interruptions set `error` and run best-effort `cleanupBot`; `stopBot` interruptions revert to pre-stop status. Documents rules in `Documentacion/RECONCILIATION-LIFECYCLE.md`.
