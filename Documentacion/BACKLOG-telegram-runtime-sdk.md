# Backlog Tecnico - Telegram Adapter Kit

Repositorio y nombre de producto: `telegram-adapter-kit`.

## 1) Convenciones de Identificadores

- Casos de uso: `UC-XXX`
- Epicas tecnicas: `EP-XXX`
- Tareas tecnicas: `TT-XXX`
- Historias tecnicas (opcional): `HT-XXX`
- Criterios de aceptacion de backlog: `AC-XXX`

Regla de trazabilidad:
- Cada `TT-XXX` debe referenciar al menos un `UC-XXX`.
- Las tareas transversales (setup, CI, calidad) usan `UC-PLT-001`.

## 2) Casos de Uso (Producto)

### UC-PLT-001 - Plataforma Base Operable
El equipo necesita un repositorio listo para desarrollo profesional (lint, test, pipeline, release) para construir y mantener **telegram-adapter-kit**.

### UC-001 - Registrar Bot en Runtime
Como desarrollador, quiero registrar instancias runtime de Telegram dinamicamente para evitar configuracion fija y redeploys, manteniendo `botId` como API publica aunque internamente la instancia pueda ser MTProto o Bot API.

### UC-002 - Gestionar Lifecycle de Bots
Como desarrollador, quiero iniciar/detener bots por `botId` para controlar disponibilidad y consumo de recursos.

### UC-003 - Registrar Suscripciones Dinamicas
Como desarrollador, quiero agregar/quitar subscriptions de lectura en runtime para cambiar fuentes sin reiniciar.

### UC-004 - Consumir Mensajes Entrantes
Como desarrollador, quiero recibir eventos normalizados de Telegram para integrar mi logica de negocio.

### UC-005 - Enviar Mensajes a Canal/Chat
Como desarrollador, quiero publicar mensajes a un chat o canal via API tipada.

### UC-006 - Enviar Mensajes a Topic
Como desarrollador, quiero enviar mensajes a un tema especifico dentro de un canal/supergrupo compatible.

### UC-007 - Manejo de Errores Tipados
Como desarrollador, quiero errores consistentes para diagnosticar y reaccionar segun tipo de falla.

### UC-008 - Observabilidad y Operacion
Como operador, quiero logs/eventos de estado para monitorear ejecucion y troubleshooting.

### UC-009 - Publicar y Consumir el Paquete
Como equipo plataforma, quiero publicar **telegram-adapter-kit** con versionado semantico y documentacion para adopcion en otros proyectos.

## 3) Epicas Tecnicas

### EP-001 - Foundation del Repositorio
Cobertura: `UC-PLT-001`, `UC-009`

### EP-002 - Core Runtime (Registries + Manager + Event Bus)
Cobertura: `UC-001`, `UC-002`, `UC-003`, `UC-004`, `UC-007`, `UC-008`

### EP-003 - Telegram Adapters (GramJS MTProto + Bot API)
Cobertura: `UC-001`, `UC-002`, `UC-003`, `UC-004`, `UC-005`, `UC-006`, `UC-007`

### EP-004 - Calidad, CI/CD y Release
Cobertura: `UC-PLT-001`, `UC-007`, `UC-008`, `UC-009`

### EP-005 - Documentacion y Ejemplos de Integracion
Cobertura: `UC-009`, `UC-005`, `UC-006`, `UC-004`

## 4) Backlog de Tareas Tecnicas (Trazable)

## EP-001 - Foundation del Repositorio

- `TT-001` Inicializar repo del paquete (`package.json`, `src/`, `tests/`).
  - UC: `UC-PLT-001`
  - Entregable: estructura base operativa.

- `TT-002` Configurar TypeScript (`tsconfig`, paths, strict mode).
  - UC: `UC-PLT-001`
  - Entregable: compilacion TS estable.

- `TT-003` Configurar lint y formato (`eslint`, `prettier`, scripts npm).
  - UC: `UC-PLT-001`
  - Entregable: estandar de codigo automatizado.

- `TT-004` Configurar framework de pruebas (`vitest`) y test bootstrap.
  - UC: `UC-PLT-001`
  - Entregable: primer test ejecutable en CI.

- `TT-005` Configurar build de libreria (`tsup` ESM/CJS/types).
  - UC: `UC-PLT-001`, `UC-009`
  - Entregable: artefactos `dist`.

- `TT-006` Definir convenciones de commits/versionado (semver + changesets).
  - UC: `UC-009`
  - Entregable: politica de release documentada.

## EP-002 - Core Runtime

- `TT-010` Implementar contratos base en `contracts/*` (SDK, events, messages).
  - UC: `UC-001`, `UC-003`, `UC-004`, `UC-005`, `UC-006`, `UC-007`
  - Dependencias: `TT-002`

- `TT-011` Implementar jerarquia de errores tipados del SDK.
  - UC: `UC-007`
  - Dependencias: `TT-010`

- `TT-012` Implementar `BotRegistry` con estados y validaciones.
  - UC: `UC-001`, `UC-002`, `UC-007`
  - Dependencias: `TT-010`, `TT-011`

- `TT-013` Implementar `SubscriptionRegistry` dinamico.
  - UC: `UC-003`, `UC-007`
  - Dependencias: `TT-010`, `TT-011`

- `TT-014` Implementar `EventBus` interno y API `onMessage/onError/onBotStateChange`.
  - UC: `UC-004`, `UC-008`
  - Dependencias: `TT-010`

- `TT-015` Implementar `RuntimeManager` (fachada publica).
  - UC: `UC-001`, `UC-002`, `UC-003`, `UC-004`, `UC-005`, `UC-006`
  - Dependencias: `TT-012`, `TT-013`, `TT-014`

- `TT-016` Implementar validadores de input runtime.
  - UC: `UC-001`, `UC-003`, `UC-005`, `UC-006`, `UC-007`
  - Dependencias: `TT-010`, `TT-011`

- `TT-017` Implementar logger inyectable + noop logger.
  - UC: `UC-008`
  - Dependencias: `TT-010`

- `TT-018` Unit tests para core runtime.
  - UC: `UC-001`, `UC-002`, `UC-003`, `UC-004`, `UC-007`, `UC-008`
  - Dependencias: `TT-012` a `TT-017`

### Detalle de Ejecucion - Foundation del Repositorio

#### TT-001 - Inicializar repo del paquete

**UC relacionados:** `UC-PLT-001`  
**Objetivo:** Establecer la base del paquete reusable con estructura y scripts iniciales.

**Descripcion detallada**
- Crear estructura inicial del paquete (`src`, `tests`, `examples`, `.github`).
- Inicializar `package.json` con metadata base del SDK.
- Definir scripts iniciales (`build`, `test`, `lint`, `typecheck` placeholder si aplica).
- Agregar `.gitignore` y archivos base de proyecto.

**Criterios de aceptacion**
- La estructura minima del repositorio existe y esta versionada.
- `npm install`/`npm ci` ejecuta correctamente.
- Scripts base definidos en `package.json` sin rutas rotas.

**Definicion de completado (DoD)**
- Repositorio clonable y ejecutable por cualquier miembro del equipo.
- Se documenta bootstrap inicial en README.
- No hay archivos temporales/sensibles versionados.

**Pruebas requeridas**
- Smoke test: clonar repo limpio e instalar dependencias.
- Smoke test: ejecutar scripts base y validar que respondan.

#### TT-002 - Configurar TypeScript

**UC relacionados:** `UC-PLT-001`  
**Objetivo:** Garantizar una base TypeScript estricta y mantenible.

**Descripcion detallada**
- Crear `tsconfig.json` con `strict: true`.
- Configurar target/module acordes al build final.
- Definir include/exclude correctos para `src` y `tests`.
- Preparar soporte de tipos para Node y testing.

**Criterios de aceptacion**
- `typecheck` corre sin errores con scaffold actual.
- Configuracion evita `any` implicito donde aplique.
- Archivos de test y source quedan correctamente separados.

**Definicion de completado (DoD)**
- Configuracion TS documentada en README/contributing.
- Sin warnings relevantes de compilacion base.
- Equipo puede compilar local sin ajustes manuales.

**Pruebas requeridas**
- Ejecutar `npm run typecheck`.
- Prueba negativa: introducir error de tipo y confirmar fallo.

#### TT-003 - Configurar lint y formato

**UC relacionados:** `UC-PLT-001`  
**Objetivo:** Estandarizar calidad de codigo y estilo automaticamente.

**Descripcion detallada**
- Integrar `eslint` con reglas TS.
- Integrar `prettier` y conflicto-resolver con eslint si aplica.
- Crear scripts `lint` y `lint:fix` (opcional).
- Definir archivos de configuracion y ignores.

**Criterios de aceptacion**
- `npm run lint` analiza `src` y `tests`.
- Reglas de estilo son consistentes para todo el equipo.
- No hay conflictos activos entre eslint y prettier.

**Definicion de completado (DoD)**
- Configuracion versionada y reproducible.
- Lint limpio en rama principal.
- Reglas clave documentadas brevemente.

**Pruebas requeridas**
- Prueba positiva: `npm run lint` verde.
- Prueba negativa: introducir infraccion y validar fallo.

#### TT-004 - Configurar framework de pruebas

**UC relacionados:** `UC-PLT-001`  
**Objetivo:** Tener infraestructura de pruebas automatizadas desde el inicio.

**Descripcion detallada**
- Configurar `vitest` (o framework acordado) para unit tests.
- Crear archivo de configuracion de tests.
- Agregar test bootstrap inicial (smoke test).
- Definir script `test` y `test:watch` (opcional).

**Criterios de aceptacion**
- Tests ejecutan localmente y en entorno CI.
- Existe al menos un test base pasando.
- Estructura de tests separa unit y contract.

**Definicion de completado (DoD)**
- Runner estable y documentado.
- Nuevas tareas pueden agregar tests sin friccion.
- Error de test rompe pipeline de pruebas.

**Pruebas requeridas**
- Prueba positiva: suite base pasa.
- Prueba negativa: test forzado a fallar para validar salida no-cero.

#### TT-005 - Configurar build de libreria

**UC relacionados:** `UC-PLT-001`, `UC-009`  
**Objetivo:** Generar artefactos distributivos del SDK.

**Descripcion detallada**
- Configurar `tsup` (o equivalente) para salida ESM/CJS.
- Generar tipos `.d.ts`.
- Definir carpeta `dist` y limpiar previo a build.
- Alinear `package.json` (`main`, `module`, `types`, `exports`).

**Criterios de aceptacion**
- `npm run build` genera artefactos esperados.
- Consumidor ESM y CJS puede importar el paquete.
- Tipos publicados son resolubles.

**Definicion de completado (DoD)**
- Build reproducible local y en CI.
- Sin warnings criticos en empaquetado.
- Resultado de build documentado para consumidores.

**Pruebas requeridas**
- Smoke test de import ESM.
- Smoke test de require CJS.
- Validacion de definiciones de tipos en proyecto sandbox.

#### TT-006 - Definir convenciones de versionado y release

**UC relacionados:** `UC-009`  
**Objetivo:** Establecer proceso consistente de versionado y publicacion.

**Descripcion detallada**
- Definir estrategia semver para cambios `major/minor/patch`.
- Configurar herramienta de versionado (ej. changesets).
- Definir politica de changelog y notas de release.
- Documentar flujo de release para maintainers.

**Criterios de aceptacion**
- Existe proceso documentado de bump de version.
- Changelog se actualiza en cada release.
- El equipo entiende cuando aplicar major/minor/patch.

**Definicion de completado (DoD)**
- Guia de release versionada.
- Simulacion de release completada sin ambiguedad.
- Alineacion con pipeline de release (`TT-032`).

**Pruebas requeridas**
- Dry-run de versionado.
- Verificar generacion de changelog.
- Verificar consistencia de version entre artefactos y metadata.

## EP-003 - Telegram Adapters (GramJS MTProto + Bot API)

- `TT-020` Definir interfaz `TelegramProviderAdapter` y capabilities por adapter.
  - UC: `UC-001`, `UC-002`, `UC-003`, `UC-004`, `UC-005`, `UC-006`
  - Dependencias: `TT-010`

- `TT-021` Implementar base de `GramJsMtprotoAdapter` para lifecycle y cleanup operativo.
  - UC: `UC-001`, `UC-002`
  - Dependencias: `TT-020`

- `TT-022` Implementar `GramJsMtprotoAdapter` con binding/unbinding de mensajes entrantes por subscription.
  - UC: `UC-003`, `UC-004`
  - Dependencias: `TT-020`, `TT-021`

- `TT-023` Implementar `sendMessage` a chat/canal en adapter MTProto.
  - UC: `UC-005`
  - Dependencias: `TT-020`, `TT-021`

- `TT-024` Implementar `sendMessage` a topic en adapter MTProto (soporte `topicId`).
  - UC: `UC-006`
  - Dependencias: `TT-023`

- `TT-025` Implementar mapping de errores provider -> errores SDK para MTProto y Bot API.
  - UC: `UC-007`
  - Dependencias: `TT-011`, `TT-021`, `TT-023`, `TT-024`

- `TT-026` Implementar retry/backoff configurable, timeoutMs y cancelacion operacional para errores transitorios.
  - UC: `UC-007`, `UC-008`
  - Dependencias: `TT-021` a `TT-025`

- `TT-027` Contract tests de adapters (MTProto y Bot API cuando aplique).
  - UC: `UC-004`, `UC-005`, `UC-006`, `UC-007`
  - Dependencias: `TT-021` a `TT-026`


- `TT-028` Implementar `BotApiAdapter` para bots clasicos con `botToken`.
  - UC: `UC-001`, `UC-002`, `UC-003`, `UC-004`, `UC-005`, `UC-006`, `UC-007`
  - Dependencias: `TT-020`, `TT-025`, `TT-026`

- `TT-029` Implementar `TelegramAdapterResolver` para seleccionar adapter interno por `credentials.kind`.
  - UC: `UC-001`, `UC-002`, `UC-005`, `UC-006`, `UC-007`
  - Dependencias: `TT-020`, `TT-021`, `TT-028`

- `TT-039` Implementar lifecycle con estados intermedios e idempotencia documentada.
  - UC: `UC-001`, `UC-002`, `UC-007`, `UC-008`
  - Dependencias: `TT-012`, `TT-015`, `TT-020`

### Detalle de Ejecucion - Core Runtime

#### TT-010 - Implementar contratos base en `contracts/*`

**UC relacionados:** `UC-001`, `UC-003`, `UC-004`, `UC-005`, `UC-006`, `UC-007`  
**Objetivo:** Definir una superficie API tipada y estable para el SDK.

**Descripcion detallada**
- Crear tipos e interfaces publicas para:
  - operaciones runtime,
  - eventos de mensajes,
  - payloads de envio,
  - estados de bot,
  - handlers y callbacks.
- Separar contratos publicos (SDK) de contratos internos (adapter).
- Evitar `any` en superficie publica.

**Criterios de aceptacion**
- Todos los casos de uso funcionales tienen contratos tipados asociados.
- No hay ambiguedad en campos obligatorios/opcionales.
- Contratos se exportan desde el entrypoint del paquete.

**Definicion de completado (DoD)**
- Contratos versionados y revisados por al menos 1 reviewer.
- Documentacion breve de cada contrato clave.
- No hay breaking changes sin justificacion en la rama de trabajo.

**Pruebas requeridas**
- Type tests basicos de compilacion.
- Prueba negativa de tipos invalidos en payloads criticos.

#### TT-011 - Implementar jerarquia de errores tipados del SDK

**UC relacionados:** `UC-007`  
**Objetivo:** Estandarizar el manejo de fallos para consumidores del SDK.

**Descripcion detallada**
- Crear clase base de error del SDK.
- Implementar clases derivadas definidas en TRD/PRD.
- Incluir `code`, `message`, `cause` y metadata relevante.
- Definir helper para mapping de errores externos a errores del SDK.

**Criterios de aceptacion**
- Cada categoria de fallo operacional mapea a un error tipado.
- Errores incluyen contexto util sin exponer secretos.
- Consumidor puede discriminar errores por tipo o `code`.

**Definicion de completado (DoD)**
- Jerarquia consolidada y documentada.
- Uso consistente en core runtime.
- Sin throws de `Error` generico en rutas criticas.

**Pruebas requeridas**
- Unit tests por cada clase de error.
- Tests de mapping de errores externos -> internos.

#### TT-012 - Implementar `BotRegistry` con estados y validaciones

**UC relacionados:** `UC-001`, `UC-002`, `UC-007`  
**Objetivo:** Gestionar bots registrados y su lifecycle de forma segura.

**Descripcion detallada**
- Implementar almacenamiento en memoria (`Map`) por `botId`.
- Definir estados (`registered`, `starting`, `started`, `stopping`, `stopped`, `error`).
- Definir reglas de idempotencia para `startBot` y `stopBot`.
- Validar duplicados y transiciones invalidas.
- Exponer operaciones CRUD/lifecycle para uso del manager.

**Criterios de aceptacion**
- No se permite registrar dos veces el mismo `botId`.
- Las transiciones de estado invalidas retornan error tipado.
- Consultas de estado devuelven informacion consistente.

**Definicion de completado (DoD)**
- API interna estable para registrar, iniciar, detener y remover.
- Cobertura de tests para transiciones principales y edge cases.
- Sin memory leaks evidentes en alta rotacion de bots.

**Pruebas requeridas**
- Unit tests de registro/duplicado/remocion.
- Unit tests de transiciones validas/invalidas.
- Prueba de concurrencia basica (llamadas rapidas secuenciales).

#### TT-013 - Implementar `SubscriptionRegistry` dinamico

**UC relacionados:** `UC-003`, `UC-007`  
**Objetivo:** Administrar bindings de lectura en runtime por `bindingId`.

**Descripcion detallada**
- Implementar registro de subscriptions con `bindingId` unico.
- Asociar cada binding a `botId`, `chatId` y filtros opcionales.
- Soportar alta/baja dinamica sin reiniciar.
- Validar que bot de destino exista antes de bind final.

**Criterios de aceptacion**
- Se pueden agregar/remover bindings en caliente.
- Duplicados por `bindingId` son rechazados.
- Errores de binding inexistente devuelven error tipado.

**Definicion de completado (DoD)**
- API de registry estable para manager y adapter.
- Estructura de datos optimizada para lookup por `bindingId` y `botId`.
- Documentacion de constraints de `binding`.

**Pruebas requeridas**
- Unit tests de alta/baja/listado de subscriptions.
- Pruebas negativas de duplicado e inexistente.

#### TT-014 - Implementar `EventBus` interno y API de eventos

**UC relacionados:** `UC-004`, `UC-008`  
**Objetivo:** Publicar eventos del runtime de manera desacoplada y segura.

**Descripcion detallada**
- Implementar bus minimo con `subscribe`, `publish`, `unsubscribe`.
- Crear canales de evento:
  - `message`,
  - `error`,
  - `botStateChange`.
- Proteger ejecucion de handlers con aislamiento de errores.
- Integrar con metodos publicos `onMessage`, `onError`, `onBotStateChange`.

**Criterios de aceptacion**
- Multiples handlers pueden suscribirse y recibir eventos.
- Un handler que falla no rompe el despacho a otros handlers.
- `unsubscribe` corta efectivamente la recepcion de eventos.

**Definicion de completado (DoD)**
- Event bus reusable por manager y adapter.
- Sin dependencias externas innecesarias.
- Comportamiento documentado para orden y manejo de fallos.

**Pruebas requeridas**
- Unit tests de publish-subscribe.
- Test de aislamiento ante excepcion en handler.
- Test de unsubscribe.

#### TT-015 - Implementar `RuntimeManager` (fachada publica)

**UC relacionados:** `UC-001`, `UC-002`, `UC-003`, `UC-004`, `UC-005`, `UC-006`  
**Objetivo:** Exponer el entrypoint principal del SDK y orquestar core + adapter.

**Descripcion detallada**
- Implementar metodos publicos definidos por contrato:
  - bots (`register/start/stop/unregister`),
  - subscriptions (`register/unregister`),
  - envio (`sendMessage`),
  - hooks (`onMessage/onError/onBotStateChange`).
- Coordinar registries, adapter y event bus.
- Enforzar validaciones de lifecycle antes de operaciones sensibles.

**Criterios de aceptacion**
- La fachada publica cubre todos los casos de uso del MVP.
- Errores se propagan tipados y consistentes.
- Operaciones se comportan deterministicamente con input valido.

**Definicion de completado (DoD)**
- `RuntimeManager` documentado como API principal.
- Cobertura de pruebas de flujo end-to-end simulado (con adapter mock).
- Sin dependencia directa de detalles del provider en consumidor.

**Pruebas requeridas**
- Unit tests de flujos happy path por caso de uso.
- Pruebas negativas por lifecycle invalido.
- Pruebas con adapter mockeado para aislar core.

#### TT-016 - Implementar validadores de input runtime

**UC relacionados:** `UC-001`, `UC-003`, `UC-005`, `UC-006`, `UC-007`  
**Objetivo:** Prevenir errores operativos mediante validacion temprana de datos.

**Descripcion detallada**
- Crear validadores para:
  - `botId`,
  - credenciales,
  - `chatId`,
  - `topicId`,
  - payload de `sendMessage`,
  - bindings de subscription.
- Integrar validadores en manager y registries.
- Retornar `ValidationError` con contexto claro.

**Criterios de aceptacion**
- Inputs invalidos nunca llegan al adapter/provider.
- Mensajes de error permiten corregir rapidamente el payload.
- Validadores reutilizables y cubiertos por tests.

**Definicion de completado (DoD)**
- Todas las rutas publicas del SDK validan su input.
- Validaciones duplicadas minimizadas por utilidades compartidas.
- Documentacion de constraints de parametros.

**Pruebas requeridas**
- Suite de unit tests de validadores (casos validos e invalidos).
- Pruebas integradas en manager para validar fail-fast.

#### TT-017 - Implementar logger inyectable + noop logger

**UC relacionados:** `UC-008`  
**Objetivo:** Habilitar observabilidad configurable sin acoplar el SDK a `console`.

**Descripcion detallada**
- Definir interfaz `Logger` del SDK.
- Implementar `NoopLogger` por defecto.
- Permitir inyeccion de logger personalizado en inicializacion del SDK.
- Estandarizar eventos de log en puntos clave (lifecycle, binding, send, error).

**Criterios de aceptacion**
- SDK funciona sin logger externo (noop).
- Consumidor puede inyectar logger propio sin adapters extra.
- Mensajes de log no filtran secretos.

**Definicion de completado (DoD)**
- Logger integrado en runtime manager y adapter boundary.
- Nivel minimo de logs definido (`debug/info/warn/error`).
- Ejemplo de integracion con logger custom documentado.

**Pruebas requeridas**
- Unit tests de inyeccion de logger.
- Verificacion de llamados esperados por nivel en flujos principales.

#### TT-018 - Unit tests para core runtime

**UC relacionados:** `UC-001`, `UC-002`, `UC-003`, `UC-004`, `UC-007`, `UC-008`  
**Objetivo:** Asegurar estabilidad del nucleo del SDK con cobertura automatizada.

**Descripcion detallada**
- Crear suite completa para:
  - registries,
  - manager,
  - event bus,
  - validadores,
  - errores.
- Estructurar tests por modulo y por comportamiento.
- Incluir tests positivos, negativos y edge cases.

**Criterios de aceptacion**
- Suite core corre de forma confiable y repetible.
- Cobertura minima acordada (objetivo >= 80% lineas en core).
- Casos criticos de lifecycle y validaciones cubiertos.

**Definicion de completado (DoD)**
- Todos los tests core en verde local y CI.
- Flaky tests eliminados o estabilizados.
- Reporte de cobertura accesible para revisiones.

**Pruebas requeridas**
- Ejecucion completa de `test` y `coverage`.
- Pruebas de regresion para bugs detectados durante desarrollo.

## EP-004 - Calidad, CI/CD y Release

- `TT-030` Configurar pipeline CI (lint + typecheck + test + build).
  - UC: `UC-PLT-001`, `UC-009`
  - Dependencias: `TT-003`, `TT-004`, `TT-005`

- `TT-031` Agregar quality gates (coverage minima, test fail on threshold).
  - UC: `UC-PLT-001`, `UC-007`
  - Dependencias: `TT-018`, `TT-027`, `TT-030`

- `TT-032` Configurar release pipeline (versionado y publish controlado).
  - UC: `UC-009`
  - Dependencias: `TT-006`, `TT-030`

- `TT-033` Agregar validacion de consumo ESM/CJS en CI.
  - UC: `UC-009`
  - Dependencias: `TT-005`, `TT-030`

- `TT-034` Seguridad de secretos en logs y masking.
  - UC: `UC-008`, `UC-007`
  - Dependencias: `TT-017`, `TT-021`

- `TT-035` Configurar GitHub Actions para PR checks (`pull_request`).
  - UC: `UC-PLT-001`, `UC-009`
  - Entregable: workflow en `.github/workflows/pr-checks.yml` con lint, typecheck, test y build.
  - Dependencias: `TT-003`, `TT-004`, `TT-005`, `TT-030`

- `TT-036` Configurar GitHub Actions para release (`push tags`/manual dispatch).
  - UC: `UC-009`
  - Entregable: workflow en `.github/workflows/release.yml` con validaciones, versionado y publish.
  - Dependencias: `TT-032`, `TT-035`

- `TT-037` Crear template de Pull Request estandar.
  - UC: `UC-PLT-001`, `UC-009`
  - Entregable: `.github/pull_request_template.md` con secciones de contexto, cambios, pruebas, riesgos y checklist.
  - Dependencias: `TT-030`

- `TT-038` Configurar CODEOWNERS y reglas base de branch protection.
  - UC: `UC-PLT-001`, `UC-009`
  - Entregable: `.github/CODEOWNERS` y documento de reglas requeridas en rama principal.
  - Dependencias: `TT-035`, `TT-037`

### Detalle de Ejecucion - Telegram Adapter (GramJS)

#### TT-020 - Definir interfaz `TelegramProviderAdapter`

**UC relacionados:** `UC-001`, `UC-002`, `UC-003`, `UC-004`, `UC-005`, `UC-006`  
**Objetivo:** Establecer contrato estable entre core runtime y proveedor Telegram.

**Descripcion detallada**
- Diseñar interfaz interna para operaciones del provider:
  - registro/inicio/parada/remocion de bot,
  - bind/unbind de mensajes entrantes,
  - envio de mensajes (chat/topic).
- Separar tipos de adapter de tipos publicos del SDK cuando sea necesario.
- Definir comportamiento esperado (errores, retornos, idempotencia basica).

**Criterios de aceptacion**
- El core runtime puede operar sin conocer detalles de GramJS.
- Contrato cubre todos los casos de uso Telegram del MVP.
- Metodos y payloads del adapter quedan tipados y documentados.

**Definicion de completado (DoD)**
- Interfaz versionada en `contracts/adapter`.
- Revisión tecnica de compatibilidad con `RuntimeManager`.
- No hay acoplamiento circular con modulos de core.

**Pruebas requeridas**
- Type tests de implementación contra interfaz.
- Validacion de contract completeness frente a casos de uso.

#### TT-021 - Implementar `GramJsMtprotoAdapter` (registro e inicio de bots)

**UC relacionados:** `UC-001`, `UC-002`  
**Objetivo:** Implementar conectividad y lifecycle de bots con GramJS.

**Descripcion detallada**
- Integrar cliente GramJS por `botId`.
- Implementar `registerBot`, `startBot`, `stopBot`, `unregisterBot`.
- Manejar sesiones y conexiones por instancia.
- Proteger lifecycle contra operaciones invalidas o duplicadas.

**Criterios de aceptacion**
- Se pueden registrar e iniciar multiples bots independientes.
- `stopBot` detiene listeners/conexion del bot objetivo.
- Operaciones invalidas retornan errores tipados del SDK.

**Definicion de completado (DoD)**
- Adapter maneja ciclo de vida sin fugas de recursos.
- Logs operacionales minimos presentes (sin secretos).
- Compatibilidad validada con runtime manager.

**Pruebas requeridas**
- Contract tests de lifecycle (register/start/stop/unregister).
- Pruebas negativas para duplicados y estados invalidos.

#### TT-022 - Implementar binding/unbinding de mensajes entrantes

**UC relacionados:** `UC-003`, `UC-004`  
**Objetivo:** Permitir suscripciones dinamicas a mensajes entrantes por canal/chat.

**Descripcion detallada**
- Implementar `bindIncomingMessages` por `bindingId`.
- Filtrar por `chatId` y aplicar filtros opcionales definidos en subscription.
- Implementar `unbindIncomingMessages`.
- Mapear payload nativo de Telegram a `IncomingMessageEvent` normalizado.

**Criterios de aceptacion**
- Alta/baja dinamica de bindings funciona sin reiniciar bots.
- Mensajes entrantes llegan al handler correcto con metadata completa.
- Unbinding deja de emitir eventos para el binding removido.

**Definicion de completado (DoD)**
- Mapeo de evento documentado y estable.
- Manejo de errores aislado por binding.
- Sin duplicidad artificial de eventos por mismo binding.

**Pruebas requeridas**
- Contract tests de bind/unbind.
- Test de filtrado por chat.
- Test de normalizacion de evento entrante.

#### TT-023 - Implementar `sendMessage` a chat/canal

**UC relacionados:** `UC-005`  
**Objetivo:** Habilitar envio confiable de mensajes a chat/canal.

**Descripcion detallada**
- Implementar metodo de envio para destino de chat/canal.
- Soportar parametros comunes:
  - `text`,
  - `parseMode`,
  - `replyToMessageId`,
  - `disableLinkPreview` (si aplica).
- Retornar resultado normalizado (`messageId`, metadata basica).

**Criterios de aceptacion**
- Envio exitoso devuelve resultado tipado.
- Falla de envio retorna error tipado y accionable.
- Comportamiento consistente para distintos formatos de `chatId`.

**Definicion de completado (DoD)**
- Integracion estable con runtime manager.
- Logs de envio y fallo disponibles.
- Semantica de retorno documentada.

**Pruebas requeridas**
- Contract test de envio exitoso.
- Prueba negativa de chat invalido/permisos insuficientes.
- Test de parseMode y replyTo cuando aplique.

#### TT-024 - Implementar `sendMessage` a topic (soporte `topicId`)

**UC relacionados:** `UC-006`  
**Objetivo:** Soportar publicacion a temas de supergrupos/canales compatibles.

**Descripcion detallada**
- Extender envio para incluir `topicId`.
- Resolver mapping del `topicId` al parametro provider correcto.
- Validar combinaciones invalidas (`topicId` en chat no compatible).
- Mantener backward compatibility del envio sin topic.

**Criterios de aceptacion**
- Envio a topic funcional en escenarios compatibles.
- Errores de topic incompatibles son explicitos y tipados.
- Envio normal (sin topic) no se ve afectado.

**Definicion de completado (DoD)**
- Feature documentada con ejemplo de uso.
- Validaciones preventivas integradas antes de enviar.
- Evidencia de pruebas en chat/topic reales o entorno simulado confiable.

**Pruebas requeridas**
- Contract test de envio a topic valido.
- Prueba negativa de topicId en destino no soportado.
- Regresion: envio normal sigue funcionando.

#### TT-025 - Implementar mapping de errores provider -> errores SDK

**UC relacionados:** `UC-007`  
**Objetivo:** Unificar semantica de errores para consumidores del SDK.

**Descripcion detallada**
- Identificar errores relevantes de GramJS/Telegram.
- Crear mapper centralizado hacia clases de error del SDK.
- Conservar `cause` original para debugging interno.
- Incluir codigos/metadata para diagnostico (sin exponer secretos).

**Criterios de aceptacion**
- Errores frecuentes del provider se traducen consistentemente.
- Core/runtime no propaga errores crudos del provider.
- Consumidor puede manejar errores por clase o `code`.

**Definicion de completado (DoD)**
- Tabla de mapeo documentada.
- Mapper cubre rutas criticas (lifecycle, incoming, send).
- Comportamiento consistente validado en pruebas.

**Pruebas requeridas**
- Tests unitarios del mapper con mocks de errores provider.
- Tests integrados validando tipo final de error emitido.

#### TT-026 - Implementar retry/backoff configurable

**UC relacionados:** `UC-007`, `UC-008`  
**Objetivo:** Mejorar resiliencia frente a fallos transitorios de red/proveedor.

**Descripcion detallada**
- Implementar utilidad de retry con politica configurable:
  - `maxRetries`,
  - `baseDelayMs`,
  - estrategia exponencial.
- Aplicar retry solo en errores catalogados como transitorios.
- Agregar trazas de intentos al logger para observabilidad.

**Criterios de aceptacion**
- Fallos transitorios se reintentan segun politica configurada.
- Fallos no transitorios fallan rapido (sin retries innecesarios).
- Agotamiento de retries devuelve error tipado final.

**Definicion de completado (DoD)**
- Politica por defecto razonable definida.
- Comportamiento configurable desde inicializacion del SDK.
- Sin loops infinitos de reintentos.

**Pruebas requeridas**
- Unit tests de estrategia de retry y backoff.
- Prueba de agotamiento de reintentos.
- Prueba de bypass en errores no transitorios.

#### TT-027 - Contract tests del adapter (chat y topic)

**UC relacionados:** `UC-004`, `UC-005`, `UC-006`, `UC-007`  
**Objetivo:** Verificar que la implementacion GramJS cumple el contrato del adapter.

**Descripcion detallada**
- Diseñar suite de contract tests para:
  - lifecycle,
  - incoming binding,
  - envio chat,
  - envio topic,
  - mapping de errores.
- Ejecutar sobre adapter real (cuando sea viable) o harness controlado.
- Asegurar trazabilidad entre pruebas y casos de uso.

**Criterios de aceptacion**
- Suite cubre todos los metodos del contrato adapter.
- Resultados consistentes en ejecuciones repetidas.
- Fallas de contrato bloquean release.

**Definicion de completado (DoD)**
- Contract suite integrada al pipeline CI.
- Evidencia de cobertura de escenarios positivos/negativos.
- Documentacion de precondiciones para correr pruebas.

**Pruebas requeridas**
- Ejecucion completa de suite contract.
- Pruebas negativas (credenciales invalidas, permisos, topic invalido).
- Regresion minima antes de release candidate.

### Detalle de Ejecucion - Pipeline y Gobierno de PR

#### TT-035 - Configurar GitHub Actions para PR checks

**UC relacionados:** `UC-PLT-001`, `UC-009`  
**Objetivo:** Validar calidad tecnica automaticamente en cada Pull Request.

**Descripcion detallada**
- Crear workflow `.github/workflows/pr-checks.yml` disparado en `pull_request`.
- Definir jobs para:
  - instalacion de dependencias,
  - `lint`,
  - `typecheck`,
  - `test`,
  - `build`.
- Configurar cache de dependencias para acelerar ejecuciones.
- Publicar estado de cada job en el PR.

**Criterios de aceptacion**
- Todo PR ejecuta automaticamente el workflow.
- Si falla `lint`, `typecheck`, `test` o `build`, el check global falla.
- El tiempo de pipeline se mantiene razonable con cache habilitada.

**Definicion de completado (DoD)**
- Workflow versionado y documentado en README interno de contribucion.
- Al menos 1 PR real validado con checks verdes.
- No existen pasos manuales ocultos para ejecutar validaciones.

**Pruebas requeridas**
- Prueba funcional: abrir PR de prueba y verificar ejecucion completa.
- Prueba negativa: introducir error de lint y confirmar fail del job.
- Prueba negativa: romper tipos/test y confirmar fail correspondiente.

#### TT-036 - Configurar GitHub Actions para release

**UC relacionados:** `UC-009`  
**Objetivo:** Automatizar release seguro y repetible del paquete.

**Descripcion detallada**
- Crear workflow `.github/workflows/release.yml`.
- Definir trigger por `workflow_dispatch` y/o `push` de tags.
- Incluir validaciones previas (`lint`, `typecheck`, `test`, `build`) antes de publicar.
- Integrar versionado (p. ej. changesets) y publicacion controlada a registry.
- Configurar uso de secretos de CI para autenticacion de publish.

**Criterios de aceptacion**
- El release solo ocurre si todas las validaciones tecnicas pasan.
- El workflow genera version consistente con semver.
- El artefacto publicado puede instalarse en proyecto externo.

**Definicion de completado (DoD)**
- Workflow release versionado y documentado.
- Release dry-run exitoso.
- Primer release candidate publicado en entorno objetivo.

**Pruebas requeridas**
- Dry-run de release con validacion de artefactos generados.
- Prueba de instalacion del paquete publicado en proyecto sandbox.
- Prueba negativa con token invalido para validar manejo de fallo seguro.

#### TT-037 - Crear template de Pull Request estandar

**UC relacionados:** `UC-PLT-001`, `UC-009`  
**Objetivo:** Estandarizar el contenido de PRs para mejorar revision y trazabilidad.

**Descripcion detallada**
- Crear `.github/pull_request_template.md`.
- Incluir secciones obligatorias:
  - contexto/problema,
  - cambios principales,
  - casos de uso (`UC-XXX`) impactados,
  - tareas (`TT-XXX`) cubiertas,
  - plan de pruebas ejecutadas,
  - riesgos y rollback,
  - checklist DoD.
- Alinear secciones con el backlog tecnico actual.

**Criterios de aceptacion**
- Todo PR nuevo precarga el template automaticamente.
- El template contiene secciones de trazabilidad UC/TT.
- El equipo puede revisar PR sin pedir informacion basica adicional.

**Definicion de completado (DoD)**
- Template versionado en rama principal.
- Ejemplo real de PR usando todas las secciones.
- Feedback inicial del equipo incorporado (si aplica).

**Pruebas requeridas**
- Crear PR de prueba y validar que el template se aplique.
- Verificar claridad de checklist con un reviewer tecnico.

#### TT-038 - Configurar CODEOWNERS y branch protection base

**UC relacionados:** `UC-PLT-001`, `UC-009`  
**Objetivo:** Asegurar gobernanza minima de cambios en ramas criticas.

**Descripcion detallada**
- Crear archivo `.github/CODEOWNERS` con responsables por carpetas clave.
- Definir politicas base de branch protection para rama principal:
  - PR obligatorio,
  - checks requeridos (`TT-035`),
  - minimo 1 aprobacion,
  - bloquear merge con checks fallidos.
- Documentar reglas de proteccion en backlog o guia de contribucion.

**Criterios de aceptacion**
- Los code owners se solicitan automaticamente en PRs relevantes.
- No se puede mergear a rama principal sin checks requeridos.
- Reglas de proteccion estan documentadas y aplicadas.

**Definicion de completado (DoD)**
- `CODEOWNERS` versionado y validado.
- Branch protection habilitado en repositorio objetivo.
- Verificacion con PR de prueba confirmando enforcement.

**Pruebas requeridas**
- PR de prueba que toca carpeta con owner y dispara reviewer automatico.
- Prueba negativa intentando merge con checks fallidos.
- Prueba negativa intentando merge sin aprobacion requerida.

## EP-005 - Documentacion y Ejemplos

- `TT-040` Escribir README tecnico (quickstart, API, errores, lifecycle).
  - UC: `UC-009`
  - Dependencias: `TT-015`, `TT-027`

- `TT-041` Crear ejemplo runnable de runtime basico.
  - UC: `UC-001`, `UC-002`, `UC-003`, `UC-004`, `UC-005`
  - Dependencias: `TT-015`, `TT-023`

- `TT-042` Crear ejemplo runnable con envio a topic.
  - UC: `UC-006`, `UC-009`
  - Dependencias: `TT-024`

- `TT-043` Guia de operacion y troubleshooting.
  - UC: `UC-007`, `UC-008`, `UC-009`
  - Dependencias: `TT-025`, `TT-026`, `TT-040`

### Detalle de Ejecucion - Calidad, CI/CD y Release

#### TT-030 - Configurar pipeline CI (lint + typecheck + test + build)

**UC relacionados:** `UC-PLT-001`, `UC-009`  
**Objetivo:** Garantizar validacion automatica de calidad tecnica en cada cambio.

**Descripcion detallada**
- Definir pipeline CI con etapas secuenciales o paralelas para:
  - `lint`,
  - `typecheck`,
  - `test`,
  - `build`.
- Configurar entorno de ejecucion consistente (version Node fija).
- Asegurar que el pipeline se ejecute en PRs y ramas principales.

**Criterios de aceptacion**
- Cada push/PR ejecuta pipeline completo.
- Fallo en cualquier etapa marca el pipeline como fallido.
- El equipo tiene visibilidad clara de logs y estado por etapa.

**Definicion de completado (DoD)**
- Pipeline versionado en repositorio.
- Estabilidad validada en al menos 3 ejecuciones consecutivas.
- Documentacion de ejecucion y debugging basico del pipeline.

**Pruebas requeridas**
- Ejecucion positiva con rama limpia.
- Pruebas negativas forzando fallo de lint, typecheck, test y build.

#### TT-031 - Agregar quality gates (coverage minima y fail on threshold)

**UC relacionados:** `UC-PLT-001`, `UC-007`  
**Objetivo:** Forzar nivel minimo de calidad y reducir regresiones.

**Descripcion detallada**
- Configurar cobertura minima (lineas/branches/functions) para core.
- Configurar falla automatica cuando cobertura caiga bajo umbral.
- Publicar reporte de cobertura como artefacto o resumen CI.

**Criterios de aceptacion**
- CI falla automaticamente si cobertura esta por debajo del umbral.
- Umbrales quedan documentados y versionados.
- Reporte de cobertura accesible para reviewers.

**Definicion de completado (DoD)**
- Quality gates activos en rama principal.
- Equipo alineado en politica de cobertura.
- Sin bypass manual no documentado.

**Pruebas requeridas**
- Prueba positiva con cobertura por encima del umbral.
- Prueba negativa reduciendo cobertura para validar bloqueo.

#### TT-032 - Configurar release pipeline (versionado y publish controlado)

**UC relacionados:** `UC-009`  
**Objetivo:** Publicar releases reproducibles y seguros del paquete.

**Descripcion detallada**
- Integrar flujo de release con versionado semantico (changesets u otro).
- Configurar pasos de validacion previos al publish.
- Publicar paquete al registry objetivo con autentificacion por secreto.
- Generar changelog/release notes automatizadas.

**Criterios de aceptacion**
- Release solo ocurre con validaciones tecnicas en verde.
- Version publicada coincide con metadata y changelog.
- Artefacto publicado es instalable en proyecto consumidor.

**Definicion de completado (DoD)**
- Pipeline release documentado y trazable.
- Dry-run exitoso previo al primer release real.
- Proceso de rollback de release documentado.

**Pruebas requeridas**
- Dry-run completo de release.
- Instalacion del paquete publicado en sandbox.
- Prueba negativa de publish con credencial invalida.

#### TT-033 - Agregar validacion de consumo ESM/CJS en CI

**UC relacionados:** `UC-009`  
**Objetivo:** Asegurar compatibilidad del SDK para consumidores con distintos module systems.

**Descripcion detallada**
- Crear checks de consumo en proyectos/minimal apps:
  - uno ESM,
  - uno CJS.
- Validar import/require del entrypoint y ejecucion basica.
- Verificar resolucion de tipos en ambos escenarios cuando aplique.

**Criterios de aceptacion**
- El paquete funciona correctamente en ESM y CJS.
- Fallos de compatibilidad rompen CI antes de release.
- `exports` en `package.json` queda validado por pruebas.

**Definicion de completado (DoD)**
- Pruebas de compatibilidad versionadas.
- Resultado de compatibilidad visible en pipeline.
- Documentacion de consumo ESM/CJS actualizada.

**Pruebas requeridas**
- Test de smoke de import ESM.
- Test de smoke de require CJS.
- Verificacion de tipos en escenario consumidor TypeScript.

#### TT-034 - Seguridad de secretos en logs y masking

**UC relacionados:** `UC-008`, `UC-007`  
**Objetivo:** Evitar exposicion de credenciales/sesiones en runtime y debugging.

**Descripcion detallada**
- Definir politica de redaccion/masking para secretos.
- Implementar utilidades de sanitizacion para logs y errores.
- Revisar puntos de log del core y adapter para cumplimiento.
- Documentar buenas practicas de manejo de secretos en integraciones.

**Criterios de aceptacion**
- Credenciales sensibles no aparecen en logs ni mensajes de error.
- Sanitizacion se aplica en rutas de error y debug.
- Revisiones de seguridad internas pasan sin hallazgos criticos.

**Definicion de completado (DoD)**
- Politica de masking versionada.
- Validacion automatica o checklist de revision aplicado.
- Evidencia de pruebas negativas de fuga de secretos.

**Pruebas requeridas**
- Test unitario de funciones de masking.
- Prueba negativa forzando error con secreto y validando redaccion.
- Revisión manual de logs en flujos principales.

### Detalle de Ejecucion - Documentacion y Ejemplos

#### TT-040 - Escribir README tecnico (quickstart, API, errores, lifecycle)

**UC relacionados:** `UC-009`  
**Objetivo:** Permitir adopcion rapida del SDK por equipos consumidores.

**Descripcion detallada**
- Documentar instalacion y prerequisitos.
- Incluir quickstart de registro de bot, subscriptions y envio.
- Documentar API publica y tipos clave.
- Documentar errores tipados y recomendaciones de manejo.

**Criterios de aceptacion**
- Un desarrollador nuevo puede integrar el SDK solo con README.
- README contiene ejemplos actualizados con API real.
- Secciones de troubleshooting basico estan presentes.

**Definicion de completado (DoD)**
- README revisado por al menos 1 consumidor potencial.
- Sin discrepancias entre docs y comportamiento real del SDK.
- Enlaces internos y snippets verificados.

**Pruebas requeridas**
- Prueba de onboarding: ejecutar quickstart desde cero.
- Validacion de snippets (compilan/ejecutan).

#### TT-041 - Crear ejemplo runnable de runtime basico

**UC relacionados:** `UC-001`, `UC-002`, `UC-003`, `UC-004`, `UC-005`  
**Objetivo:** Entregar referencia ejecutable de uso real sin topics.

**Descripcion detallada**
- Construir ejemplo minimal con:
  - registro de bot,
  - inicio de bot,
  - registro de subscription,
  - recepcion de mensajes,
  - envio a chat/canal.
- Parametrizar con variables de entorno.
- Incluir instrucciones de ejecucion paso a paso.

**Criterios de aceptacion**
- Ejemplo corre local con configuracion valida.
- Demuestra de extremo a extremo lectura + escritura.
- No contiene hardcode de secretos.

**Definicion de completado (DoD)**
- Ejemplo versionado en `examples/`.
- README referencia y explica su uso.
- Equipo puede reproducir resultado sin soporte ad hoc.

**Pruebas requeridas**
- Smoke test de ejecucion del ejemplo.
- Prueba de recepcion de mensaje entrante.
- Prueba de envio de mensaje saliente.

#### TT-042 - Crear ejemplo runnable con envio a topic

**UC relacionados:** `UC-006`, `UC-009`  
**Objetivo:** Demostrar implementacion practica de envio a topics.

**Descripcion detallada**
- Crear ejemplo dedicado con `topicId`.
- Mostrar diferencias respecto al envio normal.
- Documentar prerequisitos del destino (chat compatible con topics).
- Incluir manejo de errores por incompatibilidad de topic.

**Criterios de aceptacion**
- Ejemplo envia correctamente a topic en entorno compatible.
- Errores de incompatibilidad quedan claramente documentados.
- API de `topicId` queda demostrada en codigo real.

**Definicion de completado (DoD)**
- Ejemplo runnable y referenciado desde README.
- Validado por al menos una ejecucion completa.
- Sin duplicar logica innecesaria con el ejemplo basico.

**Pruebas requeridas**
- Smoke test de envio a topic valido.
- Prueba negativa de `topicId` invalido/no soportado.

#### TT-043 - Guia de operacion y troubleshooting

**UC relacionados:** `UC-007`, `UC-008`, `UC-009`  
**Objetivo:** Reducir MTTR operacional con guia practica de diagnostico.

**Descripcion detallada**
- Documentar fallos comunes:
  - credenciales invalidas,
  - permisos insuficientes,
  - chat/topic no compatible,
  - problemas de red/rate limits.
- Definir playbooks de respuesta y pasos de validacion.
- Incluir seccion de observabilidad (logs/eventos clave).

**Criterios de aceptacion**
- Guia cubre los errores mas probables de v1.
- Incluye pasos de diagnostico y acciones correctivas concretas.
- Equipo puede resolver incidencias frecuentes sin escalar a desarrollo.

**Definicion de completado (DoD)**
- Documento publicado y versionado con el paquete.
- Validado en al menos un ejercicio de incidente simulado.
- Actualizable facilmente tras nuevos hallazgos operativos.

**Pruebas requeridas**
- Simulacion de 2-3 incidentes comunes usando la guia.
- Verificacion de que los pasos llevan a una resolucion o escalamiento claro.


### Detalle Adicional - Lifecycle, Idempotencia y Dual Adapter

#### TT-021 - Implementar base de `GramJsMtprotoAdapter` (lifecycle + cleanup)

**UC relacionados:** `UC-001`, `UC-002`, `UC-003`, `UC-004`, `UC-005`, `UC-006`
**Objetivo:** Implementar el nucleo operacional del adapter MTProto con lifecycle seguro y limpieza garantizada.

**Descripcion detallada**
- Implementar `registerBot`, `startBot`, `stopBot`, `unregisterBot` en el adapter MTProto.
- Administrar instancia de cliente GramJS por `botId`.
- Asegurar cleanup al detener o desregistrar:
  - remover handlers/listeners activos,
  - cerrar conexion/sesion runtime,
  - limpiar referencias internas del adapter.
- Integrar logging operacional sin exponer secretos.
- Mantener compatibilidad con la resolucion de adapter por `credentials.kind`.

**Criterios de aceptacion**
- Se pueden iniciar y detener bots MTProto de forma repetible sin fugas evidentes.
- `unregisterBot` ejecuta cleanup completo antes de remover estado interno.
- Operaciones invalidas de lifecycle retornan errores tipados consistentes.
- Implementacion alineada con el cierre de spike documentado en TRD 7.10.

**Pruebas requeridas**
- Contract tests de lifecycle (`register/start/stop/unregister`).
- Prueba de regresion de cleanup (`stop/unregister` no deja handlers activos).
- Pruebas negativas de credenciales invalidas y permisos insuficientes.

#### TT-028 - Implementar `BotApiAdapter`

**UC relacionados:** `UC-001`, `UC-002`, `UC-003`, `UC-004`, `UC-005`, `UC-006`, `UC-007`
**Objetivo:** Soportar bots clasicos basados en `botToken` sin cambiar la API publica del SDK.

**Descripcion detallada**
- Implementar adapter compatible con `TelegramProviderAdapter`.
- Implementar adapter sobre `grammY` para operaciones Bot API.
- Soportar register/start/stop/unregister con `botToken`.
- Soportar envio a chat/canal y topic cuando Bot API lo permita.
- Definir estrategia de lectura: polling o webhook quedan como decision tecnica documentada para v1.
- Mapear errores HTTP/Bot API a errores SDK.

**Criterios de aceptacion**
- `registerBot({ credentials: { kind: "botApi", botToken } })` funciona sin alterar el contrato publico.
- Operaciones no soportadas retornan `CapabilityNotSupportedError`.
- Secretos se enmascaran en logs y errores.

**Pruebas requeridas**
- Contract tests de lifecycle.
- Contract tests de envio normal y topic si aplica.
- Tests de errores por token invalido/permisos insuficientes.

#### TT-029 - Implementar `TelegramAdapterResolver`

**UC relacionados:** `UC-001`, `UC-002`, `UC-005`, `UC-006`, `UC-007`
**Objetivo:** Encapsular la seleccion de adapter interno para mantener estable la API publica.

**Descripcion detallada**
- Resolver adapter por `credentials.kind`.
- Persistir `runtimeKind` por `botId` en `BotRegistry`.
- Exponer resolucion por `botId` para operaciones posteriores.
- Evitar que `RuntimeManager` conozca detalles de GramJS o Bot API.

**Criterios de aceptacion**
- MTProto y Bot API se registran con el mismo metodo publico.
- Operaciones posteriores usan el adapter correcto sin input extra del consumidor.
- El core sigue dependiendo solo de contratos internos.

**Pruebas requeridas**
- Unit tests de resolucion por tipo.
- Tests negativos para `credentials.kind` invalido.
- Tests de flujo manager con adapters fake.

#### TT-039 - Lifecycle con estados intermedios e idempotencia

**UC relacionados:** `UC-001`, `UC-002`, `UC-007`, `UC-008`
**Objetivo:** Evitar condiciones de carrera y ambiguedades operacionales en start/stop/unregister.

**Descripcion detallada**
- Implementar estados `registered`, `starting`, `started`, `stopping`, `stopped`, `error`.
- Definir tabla de transiciones validas.
- Implementar politica de idempotencia por metodo publico.
- Agregar `LifecycleConflictError` para operaciones incompatibles concurrentes.
- Emitir eventos de estado intermedio en `onBotStateChange`.

**Criterios de aceptacion**
- `startBot` sobre `started` retorna OK sin duplicar conexion.
- `stopBot` sobre `stopped` retorna OK sin error.
- `startBot` durante `starting` no crea dos conexiones.
- `stopBot` durante `stopping` no ejecuta doble cleanup.
- `unregisterBot` ejecuta cleanup antes de remover estado.

**Pruebas requeridas**
- Unit tests de matriz de transiciones.
- Tests de llamadas concurrentes/secuenciales rapidas.
- Tests de eventos `bot_starting` y `bot_stopping`.

## 5) Orden de Implementacion Sugerido

1. `EP-001` completo.
2. Implementar `TT-021` (base lifecycle/cleanup MTProto) y validar via contract tests.
3. `EP-002` core completo con unit tests, incluyendo lifecycle/idempotencia `TT-039`.
4. `EP-003` adapters con resolver y contract tests.
5. `EP-004` CI/release hardening.
6. `EP-005` docs y ejemplos para adopcion.

## 6) Matriz Resumen UC -> Tareas

- `UC-PLT-001`: `TT-001` `TT-002` `TT-003` `TT-004` `TT-005` `TT-030` `TT-031` `TT-035` `TT-037` `TT-038`
- `UC-001`: `TT-010` `TT-012` `TT-015` `TT-016` `TT-020` `TT-021` `TT-028` `TT-029` `TT-039` `TT-041`
- `UC-002`: `TT-012` `TT-015` `TT-021` `TT-028` `TT-029` `TT-039` `TT-041`
- `UC-003`: `TT-013` `TT-015` `TT-016` `TT-022` `TT-028` `TT-041`
- `UC-004`: `TT-014` `TT-015` `TT-022` `TT-027` `TT-028` `TT-041`
- `UC-005`: `TT-010` `TT-015` `TT-016` `TT-023` `TT-027` `TT-028` `TT-029` `TT-041`
- `UC-006`: `TT-010` `TT-015` `TT-016` `TT-024` `TT-027` `TT-028` `TT-029` `TT-042`
- `UC-007`: `TT-011` `TT-016` `TT-018` `TT-025` `TT-026` `TT-028` `TT-029` `TT-031` `TT-039` `TT-043`
- `UC-008`: `TT-014` `TT-017` `TT-026` `TT-034` `TT-043`
- `UC-009`: `TT-005` `TT-006` `TT-030` `TT-032` `TT-033` `TT-035` `TT-036` `TT-037` `TT-038` `TT-040` `TT-042` `TT-043`

## 7) Definition of Done Global

- Todos los `TT-XXX` de una epica completados.
- Trazabilidad a `UC-XXX` valida.
- CI verde en rama principal.
- Documentacion actualizada.
- Sin secretos expuestos en logs o ejemplos.
- Version candidata publicable.


## 8) Nota de Ajuste Arquitectonico

Este backlog fue actualizado para soportar dos tipos de identidad Telegram sin cambiar la API publica principal:

- `mtproto`: cuenta/cliente mediante GramJS (`apiId`, `apiHash`, `stringSession`).
- `botApi`: bot clasico mediante `botToken`.

La seleccion se realiza internamente mediante `TelegramAdapterResolver` y `credentials.kind`.

