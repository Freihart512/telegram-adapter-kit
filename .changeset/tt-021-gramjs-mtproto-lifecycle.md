---
"telegram-adapter-kit": minor
---

Add a base `GramJsMtprotoAdapter` implementation with per-`botId` lifecycle management (`registerBot`, `startBot`, `stopBot`, `unregisterBot`) and cleanup support, plus contract lifecycle tests for positive and negative paths (`TT-021`).
