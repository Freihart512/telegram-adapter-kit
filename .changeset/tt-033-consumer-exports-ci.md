---
"telegram-adapter-kit": patch
---

Add ESM/CJS consumer export smoke tests in CI (TT-033). Minimal downstream apps install the `npm pack` tarball, validate `package.json` exports, runtime import/require, and TypeScript resolution via `npm run verify:consumers`.
