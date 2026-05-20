# Bot API adapter (grammY) — TT-028

Implementacion: `src/adapters/telegram/bot-api/bot-api-adapter.ts`.

## Transporte v1: long polling

- `startBot` → `bot.init()` + `bot.start()` en background (no bloquea el caller del SDK).
- `stopBot` / `cleanupBot` → `bot.stop()` y espera el cierre del loop de polling.
- **Webhook**: fuera de alcance v1; documentar en integraciones futuras si el consumidor necesita URL publica.

## Capabilities por defecto

| Flag | Valor |
|------|-------|
| `supportsOutgoingForumTopics` | `true` (`message_thread_id`) |
| `supportsIncomingForumTopics` | `true` (`message_thread_id` en updates) |
| `supportsDynamicSubscriptions` | `true` |

## Secretos

Los logs usan `maskBotToken` (primeros 4 caracteres + `****`). Nunca se registra el `botToken` completo.

## Errores

Mapping en `map-bot-api-error.ts` (grammY `GrammyError`, `HttpError` → errores tipados del SDK).

## Tests

Ver `Documentacion/CONTRACT-TESTS.md` — prefijo `grammy-bot-api-*.contract.test.ts`.
