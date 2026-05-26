# Consumer export smoke tests (TT-033)

Minimal **downstream** projects that install the SDK from a **`npm pack` tarball** (publishable `files` + `exports`) — not a workspace symlink or direct `dist/` imports.

| Folder | Module system | Runtime | Types |
|--------|---------------|---------|-------|
| `esm/` | ESM (`import`) | `node run.mjs` | `tsc --noEmit` (`NodeNext`) on `typecheck.ts` |
| `cjs/` | CJS (`require`) | `node run.cjs` | `tsc --noEmit` (`Node16`) on `typecheck.cts` |

From repo root (requires `dist/` — `verify:consumers` runs `build` and `npm pack` if needed):

```bash
npm run verify:consumers
```

CI runs this after `npm run build` in [`.github/workflows/pr-checks.yml`](../../.github/workflows/pr-checks.yml).

The script writes the tarball under `tests/consumers/.pack/` (gitignored) and installs it into each consumer. These fixtures are excluded from root ESLint (`tests/consumers/**`).
