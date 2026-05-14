---
"telegram-adapter-kit": minor
---

Add centralized GramJS provider error mapping (TT-025): `mapGramJsProviderError` maps common RPC codes to `TransientNetworkError`, `ValidationError`, and `SendMessageError`, with optional context meta and fallback to `mapUnknownToSdkError`. `GramJsMtprotoAdapter` uses it for lifecycle, cleanup, and send paths.
