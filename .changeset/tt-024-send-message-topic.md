---
"telegram-adapter-kit": minor
---

Implement `sendMessage` with optional `topicId` for MTProto (TT-024): `GramJsSendMessageParams.topicId`, capability gate `supportsOutgoingForumTopics`, input validation via `validateSendMessageInput`, and typed errors. Default capabilities enable outgoing forum topics; disable via adapter constructor deps when needed.
