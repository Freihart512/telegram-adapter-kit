---
"telegram-adapter-kit": minor
---

Implement sendMessage in GramJsMtprotoAdapter (TT-023). Supports text, parseMode, replyToMessageId, and disableLinkPreview with normalized SendMessageResult. Wraps client failures in typed SendMessageError with logging.
