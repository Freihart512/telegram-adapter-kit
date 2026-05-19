# Reconciliacion de lifecycle ante timeout o cancelacion (TT-047)

Contrato operativo del SDK cuando una operacion de lifecycle se interrumpe por `OperationTimeoutError` u `OperationCancelledError` (PRD §11.3, TRD §7.8).

Implementacion: `src/core/lifecycle-reconciliation.ts`, `BotRegistry.abortStop`, `RuntimeManager.startBot` / `stopBot`.

## Tabla de reconciliacion

| Operacion | Estado intermedio | Tipos de fallo | Estado final en registry | Acciones adicionales | Eventos |
|-----------|-------------------|----------------|--------------------------|----------------------|---------|
| `startBot` | `starting` | `OPERATION_TIMEOUT`, `OPERATION_CANCELLED` | `error` (`markError`) **antes** de cleanup | Best-effort `adapter.cleanupBot` en background (timeout interno 5s, no bloquea el rechazo) | `onError` + `onBotStateChange` → `error` |
| `startBot` | `starting` | Otros errores tipados | `error` (`markError`) | — | `onError` + `onBotStateChange` → `error` |
| `stopBot` | `stopping` | `OPERATION_TIMEOUT`, `OPERATION_CANCELLED` | Revertir al estado **previo a `beginStop`** (`started` o `error`) | — | `onError` + `onBotStateChange` al estado revertido |
| `stopBot` | `stopping` | Otros errores tipados | `error` (`markError`) | — | `onError` + `onBotStateChange` → `error` |
| `registerSubscription` | bind pendiente | Cualquier fallo en `bindIncomingMessages` | Eliminar binding del registry (rollback) | — | `onError` |

## Politica de reintento (v1)

### `startBot` tras timeout/cancel

No se revierte a `registered`/`stopped`: el registry queda en `error` para evitar un segundo `startBot` mientras el adapter puede seguir conectando en background.

El consumidor debe:

1. Revisar el error (`OPERATION_TIMEOUT` / `OPERATION_CANCELLED`).
2. Si necesita limpiar el provider: llamar `stopBot` (desde `error` el registry permite `beginStop` → `stopping`). Cuando el bot este `stopped`, llamar `unregisterBot`.
3. **No** llamar `unregisterBot` directamente desde `error` — el registry lo rechaza (`Resolve error state before unregistering`).
4. Llamar `startBot` de nuevo solo cuando el estado y el adapter esten listos.

### `stopBot` tras timeout/cancel

Se revierte al estado previo (`started` o `error`) porque el stop no completo implica que el bot puede seguir conectado; el consumidor debe reintentar `stopBot` si aun necesita detenerlo.

## Notas

- La operacion subyacente del adapter puede seguir ejecutandose si el provider no soporta cancelacion cooperativa (ver `withTimeout`).
- `cleanupBot` tras `startBot` interrumpido es fire-and-forget: no retrasa el rechazo al caller ni enmascara el error original.
- `sendMessage` y otras operaciones no lifecycle no alteran el estado del `BotRegistry`.

## Trazabilidad tests

| Fila | Test |
|------|------|
| `startBot` + timeout → `error` (cleanup no bloquea) | `runtime-manager.test.ts` — TT-047 `marks error on startBot timeout without waiting for cleanup` |
| `startBot` + cleanup colgado | `runtime-manager.test.ts` — TT-047 `rejects startBot timeout when cleanupBot hangs` |
| `startBot` + otro error → `error` | `runtime-manager.test.ts` — TT-047 `marks error on non-operational startBot failure` |
| `stopBot` + cancel → revert | `runtime-manager.test.ts` — TT-047 `reverts to started on stopBot cancellation` |
| `stopBot` + otro error → `error` | `runtime-manager.test.ts` — TT-047 `marks error on non-operational stopBot failure` |
| `registerSubscription` rollback | `runtime-manager.test.ts` — TT-047 `rolls back registerSubscription when bind fails` |
| Registry `abortStop` / targets | `bot-registry.test.ts` — `abortStop`, `lifecycle-reconciliation.test.ts` |
