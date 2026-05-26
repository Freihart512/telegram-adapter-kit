# Validacion de consumo ESM / CJS (TT-033)

Garantiza que el paquete publicado funciona como lo instalaria un adopcador via `package.json` **`exports`**, no importando rutas internas de `dist/`.

**UC:** `UC-009`

---

## Mapa de salidas (`package.json`)

| Consumidor | Campo `exports` | Artefacto | Tipos |
|------------|-----------------|-----------|-------|
| ESM (`import`) | `import.default` | `dist/index.mjs` | `dist/index.d.ts` |
| CJS (`require`) | `require.default` | `dist/index.cjs` | `dist/index.d.cts` |

`npm run build` (tsup) genera estos artefactos. `sideEffects: false` permite tree-shaking en bundlers ESM.

---

## Checks locales

```bash
npm run build
npm run verify:dist          # smoke directo a dist/ (TT-005)
npm run verify:consumers     # smoke via exports + tipos (TT-033)
```

### Que valida `verify:consumers`

1. Ejecuta `npm pack` en la raiz (respeta `files` y el layout publicable).
2. Instala el `.tgz` en dos mini-proyectos bajo `tests/consumers/` (no symlink `file:` al workspace).
3. **ESM:** `import { LIBRARY_NAME, createRuntimeManager, … } from "telegram-adapter-kit"`.
4. **CJS:** `require("telegram-adapter-kit")` con los mismos simbolos.
5. **TypeScript:** `tsc --noEmit` en cada consumidor; CJS además exige resolucion a `index.d.cts` (`--traceResolution`).

Script: [`scripts/verify-consumer-exports.mjs`](../scripts/verify-consumer-exports.mjs).

---

## CI

El workflow **PR checks** (`.github/workflows/pr-checks.yml`) ejecuta `verify:consumers` despues de `build` y `verify:dist`. Un fallo de compatibilidad ESM/CJS rompe el pipeline antes de release.

---

## Integracion en apps consumidoras

### ESM (recomendado en Node 20+)

```json
{ "type": "module" }
```

```ts
import { createRuntimeManager, BotRegistry } from "telegram-adapter-kit";
```

### CommonJS

```js
const { createRuntimeManager, BotRegistry } = require("telegram-adapter-kit");
```

### TypeScript

- Proyecto ESM: `"module": "NodeNext"`, `"moduleResolution": "NodeNext"`, fuente `.ts` (condicion `import` → `index.d.ts`).
- Proyecto CJS: fuente **`.cts`** con `"module": "Node16"`, `"moduleResolution": "Node16"`; los tipos se resuelven via `exports.require.types` → `index.d.cts`.

---

## Troubleshooting

| Sintoma | Causa probable | Accion |
|---------|----------------|--------|
| `Cannot find module 'telegram-adapter-kit'` | Sin `dist/` o paquete no instalado | `npm run build`; reinstalar dependencia |
| Tipos no resueltos en CJS | `moduleResolution` antiguo (`Node10`) o fuente ESM (`.ts` con `import`) | Usar `.cts` + `Node16` para ejercitar `exports.require.types` |
| CI falla solo en `verify:consumers` | `exports` desalineado con tsup | Revisar `package.json` `exports` y salida de build |

---

**Tarea:** TT-033 · **Relacionado:** README (Bootstrap / CI), RELEASING.md, TRD § build.
