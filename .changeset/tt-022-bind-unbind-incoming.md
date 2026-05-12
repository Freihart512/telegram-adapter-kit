---
"telegram-adapter-kit": minor
---

Implement bindIncomingMessages/unbindIncomingMessages in GramJsMtprotoAdapter (TT-022). Adds dynamic subscription binding with chat/topic/text filtering, event normalization to IncomingMessageEvent, and full cleanup on stop/unregister.
