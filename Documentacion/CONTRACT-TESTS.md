# Contract tests de adapters (TT-027)

Validacion del contrato interno `TelegramProviderAdapter` (TRD §10.2, §7.10) sin acoplar el core a GramJS/grammY.

## Ejecucion

```bash
npm run test:contract   # solo tests/contract/**
npm test                # unit + contract (CI)
```

No se requieren credenciales de Telegram: la suite usa un **harness** con cliente GramJS simulado (`vi.fn`). Las pruebas son deterministicas y aptas para CI.

## Alcance v1 (esta tarea)

| Adapter | Estado | Ubicacion |
|---------|--------|-----------|
| GramJS MTProto | Cubierto | `tests/contract/gramjs-mtproto-*.contract.test.ts` |
| Bot API (grammY) | Pendiente (`TT-028`) | Se anadira cuando exista `BotApiAdapter` |

## Trazabilidad UC → escenarios

| UC | Escenario | Archivo de contract |
|----|-----------|---------------------|
| UC-004 | Lifecycle register/start/stop/unregister, conflictos, cleanup | `gramjs-mtproto-lifecycle.contract.test.ts` |
| UC-005 | Envio chat/canal, opciones parseMode/replyTo, chat invalido | `gramjs-mtproto-send.contract.test.ts` |
| UC-006 | Envio con `topicId`, capability forum, topic invalido | `gramjs-mtproto-send.contract.test.ts` |
| UC-007 | Mapping errores provider → SDK (auth, flood, permisos, peer/topic) | `gramjs-mtproto-errors.contract.test.ts` + send/lifecycle |
| UC-004 | Incoming bind/unbind, filtros chat/topic, aislamiento multi-bot | `gramjs-mtproto-incoming.contract.test.ts` |

Indice de archivos por metodo (no sustituye tests de comportamiento): `tests/contract/telegram-adapter.contract.test.ts`.

Integracion **RuntimeManager + GramJsMtprotoAdapter** (orquestacion real): `tests/contract/runtime-gramjs-integration.contract.test.ts`.

## Metodos del contrato

| Metodo | Cubierto por |
|--------|----------------|
| `registerBot` | lifecycle |
| `unregisterBot` | lifecycle |
| `startBot` | lifecycle, errors |
| `stopBot` | lifecycle |
| `sendMessage` | send, errors |
| `bindIncomingMessages` | incoming |
| `unbindIncomingMessages` | incoming |
| `cleanupBot` | lifecycle, incoming |

## Escenarios negativos (harness)

- Credenciales/sesion: `AUTH_KEY_UNHEALTHY` en `connect` → error tipado en `startBot`
- Rate limit: `FLOOD_WAIT_*` en `connect` → `TransientNetworkError`
- Permisos de envio: `CHAT_WRITE_FORBIDDEN` → `SendMessageError`
- Chat/peer invalido: `PEER_ID_INVALID` → `ValidationError`
- Topic invalido: `TOPIC_ID_INVALID` / `TOPIC_*` → `SendMessageError`
- Lifecycle invalido, bot no iniciado, capabilities no soportadas: ver lifecycle/incoming/send

Mapping puro de codigos RPC: tests unitarios en `tests/unit/map-gramjs-provider-error.test.ts` (TT-025). Los contract tests verifican el mismo mapping **a traves del adapter**.

## Integracion RuntimeManager + adapter

| Escenario | Archivo |
|-----------|---------|
| register → bind → start → stop → unregister | `runtime-gramjs-integration.contract.test.ts` |
| stop → unregisterSubscription (bindings ya limpiados en adapter) | `runtime-gramjs-integration.contract.test.ts` |

## Fixtures compartidos

`tests/contract/support/gramjs-fixtures.ts` — inputs MTProto y mock de cliente para nuevos contract tests.

## CI

El workflow `pr-checks` ejecuta `npm run test:coverage`, que incluye `tests/contract/**`. Un fallo de contrato bloquea el PR igual que un unit test.
