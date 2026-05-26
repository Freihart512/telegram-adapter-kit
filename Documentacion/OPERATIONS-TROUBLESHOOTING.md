# Guia de operacion y troubleshooting (TT-043)

Guia practica para operar el SDK en produccion y reducir MTTR ante incidencias frecuentes.

**UC:** `UC-007`, `UC-008`, `UC-009`  
**Relacionado:** [README](../README.md), [RECONCILIATION-LIFECYCLE.md](RECONCILIATION-LIFECYCLE.md) (TT-047), [ADAPTER-RESOLVER.md](ADAPTER-RESOLVER.md), [BOT-API-ADAPTER.md](BOT-API-ADAPTER.md), ejemplos [basic-runtime](../examples/basic-runtime/) / [mtproto-runtime](../examples/mtproto-runtime/).

---

## 1. Checklist rapido de diagnostico

Cuando algo falla, recorre este orden:

1. **Estado del bot** — `onBotStateChange` / registry: `registered` → `starting` → `started` (o `error`).
2. **Codigo de error** — `error.code` en `onError` o en el `catch` (ver tabla §4).
3. **Credenciales** — tipo correcto (`mtproto` vs `botApi`), variables de entorno cargadas, sin secretos truncados.
4. **Destino** — `chatId` en forma Telegram (`-100…` canal, `-…` grupo, positivo usuario); `topicId` solo si el chat es foro y el adapter lo soporta.
5. **Adapter / registry** — mismo `BotRegistry` en resolver y runtime ([ADAPTER-RESOLVER.md](ADAPTER-RESOLVER.md)).
6. **Logs / `onError`** — inyectar `Logger` (§3); para handlers de app, revisar primero `runtime.onError` (`HANDLER_EXECUTION_FAILED`). Buscar tambien `runtime operation failed`, `message send failed`.
7. **Timeout / cancel** — si usas `options.timeoutMs` o `AbortSignal`, revisar reconciliacion en [RECONCILIATION-LIFECYCLE.md](RECONCILIATION-LIFECYCLE.md).

---

## 2. Observabilidad

### Logger inyectado

Sin logger, el SDK usa `NoopLogger`. En staging/produccion, pasa un logger estructurado:

```ts
const runtime = createRuntimeManager(resolver, {
  botRegistry: bots,
  logger: myLogger,
});
```

### Eventos del runtime

| Hook | Uso |
|------|-----|
| `onError` | Errores tipados (`TelegramSdkError`) con `code` y `meta` (sin secretos). |
| `onBotStateChange` | Transiciones de lifecycle (`starting`, `started`, `stopping`, `stopped`, `error`). |
| `onMessage` | Mensajes entrantes normalizados (`IncomingMessageEvent`). |

### Mensajes de log habituales

| Mensaje (nivel) | Significado |
|-----------------|-------------|
| `registerBot requested` / `bot registered` | Alta en registry + adapter. |
| `startBot skipped because bot is already started` | Idempotencia; no es fallo. |
| `bot started` / `bot stopped` | Lifecycle OK. |
| `subscription registered` / `subscription unregistered` | Binding dinamico OK. |
| `message sent` | Envio saliente OK. |
| `runtime operation failed` | Operacion en `guard()` fallo; revisar `meta.operation` y `error.code`. |
| `binding handler error` | Fallo en el callback del adapter (p. ej. `bindIncomingMessages` directo). Con `RuntimeManager`, un `runtime.onMessage` que lanza suele ir a `onError` como `HANDLER_EXECUTION_FAILED` sin este log (ver §5.7). |
| `mtproto message send failed` / `bot-api message send failed` | Fallo de proveedor mapeado a SDK. |
| `best-effort adapter cleanup failed after operational interruption` | Tras timeout/cancel en `startBot`; revisar TT-047. |

**Seguridad:** no loguear `botToken`, `apiHash`, `stringSession` completos. El SDK evita incluirlos en `meta`; tu app debe hacer lo mismo.

---

## 3. Estados de lifecycle

```
registered ──startBot──► starting ──► started
     │                      │ fail
     │                      ▼
     │                    error ◄── markError
     │
     └── stopBot (desde started/error) ──► stopping ──► stopped
```

| Estado | Que hacer si te quedas ahi |
|--------|----------------------------|
| `starting` | Esperar o revisar timeout. Si fallo → `error` (ver RECONCILIATION). |
| `stopping` | Esperar `stopBot` o timeout/cancel → revierte a `started`/`error`. |
| `error` | **No** `unregisterBot` directo. Ver recuperacion §3.1 (`stopBot` → `stopped` → `startBot` **o** `unregisterBot` + `registerBot`). |
| `started` sin incoming | Revisar binding `chatId`, factory GramJS, filtros `topicId` (§5.3). |

Detalle de timeout/cancel: [RECONCILIATION-LIFECYCLE.md](RECONCILIATION-LIFECYCLE.md).

### 3.1 Recuperacion desde `error`

Tras `startBot` fallido (timeout, cancel, etc.) el registry queda en `error`. **No** llames `unregisterBot` desde `error` (rechaza con `LIFECYCLE_CONFLICT`).

**Paso comun:** `stopBot` → `stopped`.

Luego elige **una** ruta:

| Ruta | Cuando usarla | Secuencia |
|------|---------------|-----------|
| **Reinicio sin desregistrar** | Mismas credenciales/config; quieres conservar el `botId` y volver a conectar. | `stopBot` → `stopped` → corregir causa → `startBot` → re-`registerSubscription` si hicieron falta. |
| **Baja y alta de nuevo** | Cambias credenciales, `botId`, o quieres limpiar por completo. | `stopBot` → `stopped` → `unregisterBot` → `registerBot` → `startBot` → `registerSubscription`. |

**Importante:** despues de `unregisterBot`, `startBot` falla con `BOT_NOT_FOUND` — debes **`registerBot` otra vez** antes de `startBot`.

No mezcles las rutas: `stopBot` → `stopped` → `unregisterBot` → `startBot` **no es valido**.

---

## 4. Errores tipados del SDK

Todos extienden `TelegramSdkError` (`error.code`, `error.meta`, `error.cause`).

| `code` | Causa tipica | Accion correctiva |
|--------|--------------|-------------------|
| `VALIDATION_ERROR` | Input invalido, token 401, peer/chat mal formado | Validar `chatId`, credenciales, payload. MTProto: `PEER_ID_INVALID`. Bot API: `401`. |
| `TRANSIENT_NETWORK` | Flood wait, timeout, HTTP/RPC transitorio | Reintentar con backoff; respetar `retry_after` del proveedor. `startBot`/`stopBot` pueden reintentar (no `sendMessage` por defecto). |
| `SEND_MESSAGE_FAILED` | Sin permiso de escritura, canal privado, topic invalido | Verificar membresia, admin, `topicId`, tipo de chat. |
| `OPERATION_TIMEOUT` | `options.timeoutMs` agotado por intento | Aumentar timeout, revisar red, ver reconciliacion lifecycle. |
| `OPERATION_CANCELLED` | `AbortSignal` abortado | Reintentar operacion o revertir segun operacion (TT-047). |
| `BOT_NOT_FOUND` | `botId` no registrado | `registerBot` primero. |
| `BOT_ALREADY_EXISTS` | `registerBot` duplicado | Usar otro `botId` o `unregisterBot` previo. |
| `BOT_NOT_STARTED` | `bind` / `send` sin `startBot` | `startBot` antes de subscribe/send. |
| `LIFECYCLE_CONFLICT` | Transicion ilegal (ej. `stop` mientras `starting`) | Consultar estado actual; seguir tabla §3. |
| `SUBSCRIPTION_ALREADY_EXISTS` | `bindingId` duplicado | Otro `bindingId` o `unregisterSubscription`. |
| `SUBSCRIPTION_NOT_FOUND` | `unbind` de id inexistente | Verificar `bindingId`. |
| `CAPABILITY_NOT_SUPPORTED` | Adapter sin feature (ej. topics entrantes MTProto) | Ajustar expectativa o usar Bot API. |
| `HANDLER_EXECUTION_FAILED` | `runtime.onMessage` / `onError` / `onBotStateChange` lanzo | Suscribir `runtime.onError`; corregir handler. No confundir con log `binding handler error` (ruta adapter directa). |

Mapping proveedor → SDK: `src/adapters/telegram/mtproto/map-gramjs-error.ts`, `src/adapters/telegram/bot-api/map-bot-api-error.ts`.

---

## 5. Playbooks por sintoma

### 5.1 Credenciales invalidas

**Sintomas:** `VALIDATION_ERROR`, `401`, sesion no autorizada, `GramJS session is not authorized`.

| Modo | Verificacion | Correccion |
|------|--------------|------------|
| **Bot API** | Token de [@BotFather](https://t.me/BotFather); `credentials.kind: "botApi"`. | Regenerar token; `examples/basic-runtime/.env` → `TG_BOT_TOKEN`. |
| **MTProto** | `apiId`, `apiHash`, `stringSession` de [my.telegram.org](https://my.telegram.org/apps). | `npm run script:gramjs-session`; actualizar `TG_STRING_SESSION`. |

**Validacion rapida:** ejecutar `npm run example:basic` o `npm run example:mtproto` con el mismo `.env`.

---

### 5.2 Permisos insuficientes

**Sintomas:** `SEND_MESSAGE_FAILED`, `CHAT_WRITE_FORBIDDEN`, `403`, bot no admin en canal.

1. Confirmar que la identidad (bot o usuario MTProto) esta en el chat/canal.
2. En canales: permisos de publicar; en foros: permiso de topics si aplica.
3. Bot API: el bot debe ser miembro; MTProto: la cuenta de la sesion debe poder escribir.

**Validacion:** enviar un mensaje manual desde la misma cuenta en el cliente Telegram al mismo `chatId` / `topicId`.

---

### 5.3 Chat / topic no compatible

**Sintomas:** mensaje no llega a `onMessage`, envio falla con topic, binding silencioso.

| Problema | Diagnostico | Correccion |
|----------|-------------|------------|
| `chatId` incorrecto | Link `t.me/c/X/Y` → `TG_CHAT_ID=-100X`, `TG_TOPIC_ID=Y`. | Alinear `.env` con la tabla del ejemplo MTProto. |
| Canal vs grupo vs usuario | Matching usa `canonicalPeerId` (`-100{id}`, `-{id}`, `{id}`). | Binding debe usar el id Telegram completo, no mezclar tipos. |
| Topic en subscribe MTProto | GramJS a menudo no expone `reply_to_top_id` en vivo. | No filtrar por `topicId` en `registerSubscription`; filtrar en `onMessage` o solo en send ([mtproto-runtime README](../examples/mtproto-runtime/README.md)). |
| Topic en send | Chat sin foros o `topicId` inexistente. | Quitar `topicId` o usar chat con topics habilitados. |

**Validacion:** subscription a canal completo; enviar mensaje de prueba; ver `[incoming]` en `npm run example:mtproto`.

---

### 5.4 Red, rate limits y reintentos

**Sintomas:** `TRANSIENT_NETWORK`, `FLOOD_WAIT`, `429`, intermitencia.

1. Revisar `error.meta.providerCode` si existe.
2. Esperar `retry_after` (Telegram) antes de saturar.
3. Recordar: **`sendMessage` no reintenta por defecto** (evitar duplicados — TT-046). Lifecycle (`startBot`, etc.) si usa la politica global de `retryPolicy`.
4. Ajustar `RuntimeManagerDeps.retryPolicy` solo si entiendes el riesgo por operacion.

**Validacion:** repetir operacion tras espera; confirmar en logs si hubo reintentos (`withRetry`).

---

### 5.5 Timeout y cancelacion operacional

**Sintomas:** `OPERATION_TIMEOUT`, `OPERATION_CANCELLED`, bot en `error` o revierte de `stopping`.

| Operacion | Comportamiento | Que hacer |
|-----------|----------------|-----------|
| `startBot` + timeout/cancel | Estado → `error`; cleanup en background. | §3.1: `stopBot` → `stopped` → `startBot` (sin desregistrar) **o** `unregisterBot` + `registerBot` + `startBot`. |
| `stopBot` + timeout/cancel | Revierte a `started` o `error`. | Reintentar `stopBot`. |
| Cualquier op con `timeoutMs` | Limite **por intento** de retry, no global. | Subir `timeoutMs` en `OperationOptions` o reducir carga. |

```ts
await runtime.startBot("main", {
  timeoutMs: 30_000,
  signal: abortController.signal,
});
```

---

### 5.6 Incoming no aparece (MTProto)

**Sintomas:** envio OK, sin `[incoming]` en consola.

1. `startBot` completado (`started`).
2. `registerSubscription` con `chatId` canonico (`-100…` para canales).
3. Factory live (`gramjs-client.ts`) mapea `peerId` (numero/Long/`chatId` del evento).
4. No exigir `topicId` en subscription si los mensajes no traen `reply_to_top_id`.
5. Mismo `BotRegistry` en resolver y runtime.

**Validacion:** ejemplo `npm run example:mtproto` + mensaje en el topic; logs `subscription registered` y `[incoming]`.

---

### 5.7 Errores en handlers de aplicacion

**Sintomas:** un mensaje no se procesa; handler que lanza.

**Ruta habitual (`RuntimeManager`):**

```ts
runtime.onError((err) => {
  if (err.code === "HANDLER_EXECUTION_FAILED") {
    // err.meta?.channel === "message" | "botStateChange"
    // err.cause — excepcion original del handler
  }
});
```

`EventBus` captura fallos en `runtime.onMessage` y emite `HANDLER_EXECUTION_FAILED` por `onError`. El proceso **no** cae.

**Ruta adapter directa** (`adapter.bindIncomingMessages(..., handler)` sin runtime): el adapter registra `binding handler error` en el `Logger` inyectado y traga la excepcion.

| Integracion | Donde mirar primero |
|-------------|---------------------|
| `createRuntimeManager` + `runtime.onMessage` | `runtime.onError` (`HANDLER_EXECUTION_FAILED`) |
| Binding directo al adapter | Log `binding handler error` + `Logger` del adapter |

Opcional: try/catch dentro del handler y metricas propias; `onError` sigue siendo la red de seguridad del SDK.

---

## 6. Control operacional (timeout / cancel / retry)

| Parametro | Donde | Notas |
|-----------|-------|-------|
| `timeoutMs` | `OperationOptions` en cada llamada al runtime | Por intento dentro de `withRetry`. |
| `signal` | `OperationOptions` | Cancelacion cooperativa cuando el adapter lo soporta. |
| `retryPolicy` | `RuntimeManagerDeps` | Global salvo `sendMessage` (`maxRetries: 0`). |

Referencias: `src/utils/operation-control.ts`, `src/utils/operation-retry-policy.ts`.

---

## 7. Ejercicios de incidente simulado

Usar estos escenarios para validar la guia (staging o local).

### Ejercicio A — Token Bot API invalido

1. Poner `TG_BOT_TOKEN=invalid` en `examples/basic-runtime/.env`.
2. `npm run example:basic`.
3. **Esperado:** fallo al `startBot` o primer contacto; `VALIDATION_ERROR` / 401 en logs.
4. **Resolucion:** restaurar token valido; reiniciar.

### Ejercicio B — `startBot` con timeout corto

1. En app de prueba, `startBot(id, { timeoutMs: 1 })`.
2. **Esperado:** `OPERATION_TIMEOUT`, estado `error`.
3. **Resolucion:** §3.1 — `stopBot` → `stopped` → `startBot` (o `registerBot` si hiciste `unregisterBot`).

### Ejercicio C — `chatId` de canal mal escrito

1. Binding con id positivo `2593336332` pero eventos de canal interno.
2. **Esperado:** sin eventos en `onMessage`.
3. **Resolucion:** binding `-1002593336332` o peer tipado coherente (§5.3).

**Criterio de exito:** cada ejercicio termina en causa identificada + accion documentada, o escalamiento claro (§8).

---

## 8. Cuando escalar a desarrollo

Escala si:

- El error no aparece en la tabla §4 ni en mapping de proveedor.
- Estado `error` persistente tras seguir RECONCILIATION.
- Crash del proceso (no capturado como `TelegramSdkError`).
- Regresion reproducible con version pinneada y pasos minimos.

Incluir: `botId`, `operation`, `error.code`, `error.meta` (sin secretos), estado lifecycle, adapter (`mtproto` / `botApi`), version del paquete.

---

## 9. Mantenimiento de esta guia

Tras cada incidente nuevo en produccion:

1. Anadir sintoma + playbook a §5 si es recurrente.
2. Enlazar tests o ejemplos que reproduzcan el caso.
3. Actualizar tabla §4 si se introduce un `code` nuevo.

**Tareas fuente:** TT-043 · **Dependencias documentadas:** TT-025, TT-026, TT-040, TT-045, TT-047.
