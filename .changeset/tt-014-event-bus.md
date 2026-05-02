---
"telegram-adapter-kit": patch
---

Add internal EventBus with message/error/botStateChange channels, safe handler invocation that emits `HandlerExecutionError` on subscriber failures (non-error channel), and unit tests (TT-014).
