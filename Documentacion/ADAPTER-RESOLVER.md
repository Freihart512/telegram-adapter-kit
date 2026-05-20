# Adapter resolver (TT-029)

`DefaultTelegramAdapterResolver` routes operations to **GramJS MTProto** or **Bot API (grammY)** by `credentials.kind` at register time and by `runtimeKind` stored in `BotRegistry` for later calls (`startBot`, `sendMessage`, etc.).

## Shared `BotRegistry` (required)

`createDefaultTelegramAdapterResolverForRegistry(registry, …)` reads `runtimeKind` from the **`registry` instance you pass in**. `RuntimeManager` maintains bot lifecycle in the **`botRegistry` you pass to `createRuntimeManager`**.

Those two references **must be the same object**. If you use two different `BotRegistry` instances:

- `registerBot` updates only the manager’s registry.
- `resolveByBotId` still sees an empty resolver registry → `BotNotFoundError` on `startBot` / `sendMessage` / etc.

### Correct wiring

```ts
const bots = new BotRegistry();

const resolver = createDefaultTelegramAdapterResolverForRegistry(bots, {
  mtprotoClientFactory: (credentials) => createGramJsClient(credentials),
});

const runtime = createRuntimeManager(resolver, { botRegistry: bots });
```

### Anti-pattern

```ts
// Wrong: two registries — routing breaks after registerBot
const resolver = createDefaultTelegramAdapterResolverForRegistry(new BotRegistry(), { ... });
const runtime = createRuntimeManager(resolver, { botRegistry: new BotRegistry() });
```

If you inject a custom `botRegistry` into `createRuntimeManager`, pass **that same instance** into `createDefaultTelegramAdapterResolverForRegistry`.

## Custom resolver

You may implement `TelegramAdapterResolver` yourself (tests, multi-tenant routing). Keep `resolveByBotId` consistent with wherever `RuntimeManager` stores `runtimeKind` for each `botId`.

## See also

- TRD §7.9 — adapter resolution rules
- `src/adapters/telegram/adapter-resolver.ts`
- README quick start
