---
"telegram-adapter-kit": minor
---

Add configurable retry with exponential backoff for transient failures (TT-026). Introduces `withRetry`, `RetryPolicy`, and `DEFAULT_RETRY_POLICY`; `RuntimeManager` applies retries on adapter operations via `RuntimeManagerDeps.retryPolicy`.
