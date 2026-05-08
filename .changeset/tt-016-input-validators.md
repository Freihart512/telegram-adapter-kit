---
"telegram-adapter-kit": patch
---

Add reusable input validators (`validateBotId`, `validateBindingId`, `validateChatId`, `validateTopicId`, `validateCredentials`, `validateRegisterBotInput`, `validateRegisterSubscriptionInput`, `validateSendMessageInput`) and `MAX_MESSAGE_TEXT_LENGTH`. `RuntimeManager` runs them at the public boundary so invalid inputs throw `ValidationError` before reaching the adapter (`TT-016`).
