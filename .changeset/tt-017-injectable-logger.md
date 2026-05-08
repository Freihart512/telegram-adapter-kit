---
"telegram-adapter-kit": patch
---

Add SDK observability primitives with an injectable `Logger` interface and a default `NoopLogger`, wire logger injection through `RuntimeManagerDeps`, and emit structured logs across lifecycle, subscription, send, and adapter-boundary error flows. Also document custom logger setup in `README` and cover logger behavior with unit tests (`TT-017`).
