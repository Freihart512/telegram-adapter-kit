---
"telegram-adapter-kit": patch
---

Add secret masking for logs and SDK errors (TT-034).

- New `secret-masking` utilities (`maskBotToken`, `maskApiHash`, `maskStringSession`, `sanitizeLogMeta`, `sanitizeString`) with contextual `apiHash` / `api_hash` redaction in free-form text.
- `createSafeLogger` sanitizes both log `message` and `meta` before emission.
- `RuntimeManager` and Telegram adapters use the safe logger; `TelegramSdkError` and `mapUnknownToSdkError` sanitize messages and metadata.
- Policy doc: `Documentacion/SECRETS-MASKING.md`; README and operations guide cross-links.
