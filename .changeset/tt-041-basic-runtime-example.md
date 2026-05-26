---
"telegram-adapter-kit": minor
---

Add runnable Bot API and MTProto runtime examples with smoke tests, session helper script, and MTProto incoming fixes (TT-041).

- `examples/basic-runtime` and `examples/mtproto-runtime` with `npm run example:basic` / `example:mtproto`
- Live GramJS client factory with robust peer-id mapping for incoming events
- Replace `normalizeChatIdKey` with type-preserving `canonicalPeerId` for subscription matching (channels `-100{id}`, groups `-{id}`, users `{id}`)
