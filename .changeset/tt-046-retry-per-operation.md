---
"telegram-adapter-kit": patch
---

Apply per-operation retry policy in RuntimeManager (TT-046). `sendMessage` uses no automatic retries by default to avoid duplicate sends on ambiguous transient failures; lifecycle and binding operations keep the global `retryPolicy`.
