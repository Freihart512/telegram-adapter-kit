# Politica de masking de secretos (TT-034)

Contrato operativo para evitar fugas de credenciales en **logs**, **metadatos de error** y mensajes derivados del SDK (TRD §11, PRD RF-07).

**UC:** `UC-007`, `UC-008`

---

## 1. Material sensible (v1)

| Campo | Origen | Regla de log |
|-------|--------|--------------|
| `botToken` | Bot API (`credentials.kind: "botApi"`) | Prefijo corto + `****` (`maskBotToken`) |
| `apiHash` | MTProto | Prefijo 2 chars + `****` (`maskApiHash`) |
| `stringSession` | MTProto GramJS | `abcd…wxyz` (`maskStringSession`) |
| Otros (`password`, `secret`, `token`, `authorization`, …) | Integraciones | `maskSecret` generico |

**Nunca** registrar valores completos en texto plano. `apiId` numerico no se considera secreto.

---

## 2. Donde se aplica el masking

| Capa | Mecanismo |
|------|-----------|
| **Logger** | `createSafeLogger(logger)` envuelve `RuntimeManager` y adapters; sanitiza `message` y `meta` en `debug/info/warn/error`. |
| **Errores SDK** | `TelegramSdkError` sanitiza `message` y `meta` en el constructor. |
| **Errores desconocidos** | `mapUnknownToSdkError` redacta patrones en `message` (`sanitizeString`). |
| **Texto libre** | `sanitizeString` detecta tokens Bot API, `apiHash`/`api_hash` contextuales (32 hex), y blobs largos tipo sesion. |

Implementacion: `src/observability/secret-masking.ts`, `src/observability/safe-logger.ts`.

---

## 3. Buenas practicas para integradores

1. **No** pasar `botToken`, `apiHash` ni `stringSession` en `error.meta` ni campos custom de log; usar `botId`, `operation`, `providerCode`.
2. Inyectar un `Logger` propio; el SDK lo envuelve con `createSafeLogger` internamente cuando usas `RuntimeManager` / adapters oficiales.
3. Si construyes logs fuera del SDK, usa `sanitizeLogMeta` / `maskBotToken` exportados para metadatos arbitrarios.
4. Mantener secretos en variables de entorno o secret manager; ver ejemplos `.env.example` (nunca commitear `.env`).
5. En `onError`, confiar en `error.meta` ya sanitizado; no serializar `error.cause` completo a logs sin revisar (el `cause` original puede contener respuestas del proveedor).

```ts
import { createSafeLogger, sanitizeLogMeta } from "@your-scope/telegram-adapter-kit";

const logger = createSafeLogger(myBackendLogger);
const runtime = createRuntimeManager(resolver, { logger });

// Log manual seguro
logger.info("custom event", sanitizeLogMeta({ botId: "x", botToken: process.env.TG_BOT_TOKEN }));
```

---

## 4. Checklist de revision (PR / release)

- [ ] Ningun log nuevo incluye credenciales en claro.
- [ ] Metadatos de error limitados a campos no sensibles.
- [ ] Ejemplos y docs usan placeholders (`TG_BOT_TOKEN`, `…`).
- [ ] Tests negativos: `tests/unit/secret-masking.test.ts`, `tests/unit/safe-logger.test.ts`, `tests/unit/errors.test.ts` (TT-034).

---

## 5. Limitaciones conocidas

- El **`cause`** encadenado de `Error` no se reescribe; evita loguear `String(err.cause)` sin filtrar.
- Patrones heuristcos en `sanitizeString` pueden no detectar formatos de secreto personalizados.
- Logs del **proveedor** (GramJS/grammY internos) quedan fuera del SDK; configurar nivel de log del provider con cuidado.

---

**Tarea:** TT-034 · **Relacionado:** [OPERATIONS-TROUBLESHOOTING.md](OPERATIONS-TROUBLESHOOTING.md), [README](../README.md) (Security).
