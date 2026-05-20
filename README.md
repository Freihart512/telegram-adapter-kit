# telegram-adapter-kit

TypeScript toolkit for **Telegram** with a stable runtime API: register bots and channel subscriptions at runtime, receive normalized incoming messages, and send to chats, channels, and **forum topics**. Supports **MTProto** (via [GramJS](https://github.com/gram-js/gramjs)) and **Bot API** bots (via [grammY](https://grammy.dev/)) behind one public surface.

> Product specs: [`Documentacion/`](Documentacion/) (PRD, TRD, backlog).

## Features

- **Runtime registration** of multiple Telegram identities using a public `botId` (MTProto session or Bot API token).
- **Dynamic subscriptions** to incoming messages (add/remove bindings without a static config file).
- **Outgoing messages** to chat/channel, including **topics** where supported.
- **Typed errors**, optional timeouts/cancellation, automatic retries on **`TRANSIENT_NETWORK`** (with operation-specific rules), and contract-testable adapters.
- **Domain-agnostic** core: your app supplies business logic; the kit handles Telegram wiring.

## Requirements

| Requirement | Detail |
| ----------- | ------ |
| **Node.js** | **20+** LTS (`engines` in `package.json`) |
| **TypeScript** | **5.x** recommended for consumers using strict types |
| **Telegram MTProto** | `apiId`, `apiHash` from [my.telegram.org](https://my.telegram.org/apps), plus a GramJS `stringSession` for the user account |
| **Telegram Bot API** | Bot token from [@BotFather](https://t.me/BotFather) (`kind: "botApi"`) |

Install from npm when published (name TBD). Local development: clone, `npm install`, `npm run build`.

```bash
npm install @your-scope/telegram-adapter-kit
```

## Quick start

The public entrypoint is **`createRuntimeManager`** implementing **`TelegramRuntimeSdk`**. Use the default resolver so MTProto and Bot API can coexist without importing GramJS/grammY in application code (**TT-029**).

### Bot API only (no GramJS factory)

For a classic bot token, the default resolver creates a **Bot API** adapter internally; you do **not** need `mtprotoClientFactory`.

```ts
import {
  BotRegistry,
  createDefaultTelegramAdapterResolverForRegistry,
  createRuntimeManager,
  type IncomingMessageEvent,
} from "@your-scope/telegram-adapter-kit";

// One BotRegistry for resolver + runtime (required — see ADAPTER-RESOLVER.md).
const bots = new BotRegistry();
const resolver = createDefaultTelegramAdapterResolverForRegistry(bots);
const runtime = createRuntimeManager(resolver, { botRegistry: bots });

// 1) Register and start
await runtime.registerBot({
  botId: "alerts-bot",
  credentials: { kind: "botApi", botToken: process.env.TG_BOT_TOKEN! },
});
await runtime.startBot("alerts-bot");

// 2) Subscribe to incoming messages (bot must be started)
await runtime.registerSubscription({
  bindingId: "signals-1",
  botId: "alerts-bot",
  chatId: -1001234567890n,
  filters: { textIncludes: ["ALERT"] },
});

const offMessage = runtime.onMessage((event: IncomingMessageEvent) => {
  console.log(event.botId, event.chatId, event.text);
});

runtime.onError((err) => {
  console.error(err.code, err.message, err);
});

// 3) Send (forum topic optional)
await runtime.sendMessage({
  botId: "alerts-bot",
  chatId: -1001234567890n,
  text: "Hello from telegram-adapter-kit",
  topicId: 42,
});

// 4) Shutdown
offMessage();
await runtime.unregisterSubscription("signals-1");
await runtime.stopBot("alerts-bot");
await runtime.unregisterBot("alerts-bot");
```

> **Shared `BotRegistry`:** pass the **same** `bots` instance to `createDefaultTelegramAdapterResolverForRegistry` and `createRuntimeManager({ botRegistry: bots })`. Two instances cause `BOT_NOT_FOUND` on `startBot` after a successful `registerBot`. Details: [ADAPTER-RESOLVER.md](Documentacion/ADAPTER-RESOLVER.md).

### MTProto (GramJS user session)

Same runtime flow with `credentials.kind: "mtproto"` (`apiId`, `apiHash`, `stringSession`). The resolver needs **`mtprotoClientFactory`** or an injected **`mtprotoAdapter`** — there is no default GramJS client in the kit.

```ts
const resolver = createDefaultTelegramAdapterResolverForRegistry(bots, {
  mtprotoClientFactory: (credentials) => createGramJsClient(credentials), // your wiring
});
```

Implement the factory against exported types **`GramJsMtprotoClientFactory`** / **`GramJsMtprotoAdapter`** (`src/adapters/telegram/mtproto/gramjs-adapter.ts`). Behavior covered by GramJS contract tests: [CONTRACT-TESTS.md](Documentacion/CONTRACT-TESTS.md) (`gramjs-mtproto-*.contract.test.ts`). A dedicated MTProto setup guide may follow in a later doc task.

## Public API (`TelegramRuntimeSdk`)

Implemented by `RuntimeManager` / `createRuntimeManager`.

| Method | Description |
| ------ | ----------- |
| `registerBot(input, options?)` | Register `botId` + credentials; persists `runtimeKind` in `BotRegistry`. |
| `unregisterBot(botId, options?)` | Cleanup adapter resources, remove bot and its subscriptions. Allowed from `registered` or `stopped` (not from `error` without prior recovery — see lifecycle). |
| `startBot(botId, options?)` | Connect / start polling; idempotent if already `started`. |
| `stopBot(botId, options?)` | Stop provider; idempotent if already `stopped`. |
| `registerSubscription(input, options?)` | Bind incoming handler for `chatId` (optional `topicId`, `filters`). Requires bot `started`. |
| `unregisterSubscription(bindingId, options?)` | Remove binding and adapter listener. |
| `sendMessage(input, options?)` | Send text to chat/channel; optional `topicId`, `parseMode`, `replyToMessageId`. Requires bot `started`. |
| `onMessage(handler)` | Normalized inbound events; returns `UnsubscribeFn`. |
| `onError(handler)` | Runtime / handler errors (`TelegramRuntimeError`). |
| `onBotStateChange(handler)` | Lifecycle transitions (`BotStateEvent`). |

Optional **`OperationOptions`** on async methods: `timeoutMs`, `signal` (AbortSignal). See [Retries and timeouts](#retries-and-timeouts).

## Key types

| Type | Role |
| ---- | ---- |
| `RegisterBotInput` | `{ botId, credentials, metadata? }` |
| `BotCredentials` | `MtprotoCredentials` \| `BotApiCredentials` (discriminated by `kind`) |
| `RegisterSubscriptionInput` | `{ bindingId, botId, chatId, topicId?, filters? }` |
| `SendMessageInput` | `{ botId, chatId, text, topicId?, parseMode?, replyToMessageId?, disableLinkPreview? }` |
| `SendMessageResult` | `{ botId, chatId, messageId, date?, raw? }` |
| `IncomingMessageEvent` | `{ botId, chatId, messageId, text?, date, topicId?, raw }` |
| `BotLifecycleStatus` | `registered` \| `starting` \| `started` \| `stopping` \| `stopped` \| `error` |
| `OperationOptions` | `{ timeoutMs?, signal? }` |
| `RetryPolicy` | `{ maxRetries, baseDelayMs, maxDelayMs?, jitter? }` — see `DEFAULT_RETRY_POLICY`, `RETRY_POLICY_PRESETS` |

`chatId` accepts `bigint`, `number`, or `string` (large IDs should use `bigint` or string to avoid precision loss).

## Bot lifecycle

Typical happy path:

```text
registerBot → registered → startBot → starting → started → stopBot → stopping → stopped → unregisterBot
```

- **`registerSubscription` / `sendMessage`** require status **`started`** (`BOT_NOT_STARTED` otherwise).
- **`unregisterBot`** from **`error`**: call **`stopBot`** first until **`stopped`**, then unregister ([RECONCILIATION-LIFECYCLE.md](Documentacion/RECONCILIATION-LIFECYCLE.md)).
- **`startBot` timeout/cancel** while `starting`: registry moves to **`error`**; retry policy documented in reconciliation doc.
- **`stopBot` timeout/cancel** while `stopping`: state **reverts** to previous (`started` or `error`); retry `stopBot` if needed.

Subscribe to transitions:

```ts
runtime.onBotStateChange(({ botId, status, previousStatus, at }) => {
  console.log(botId, previousStatus, "→", status, at.toISOString());
});
```

## Typed errors

All SDK errors extend **`TelegramSdkError`** (`name`, `code`, `message`, optional `meta`, `cause`). Use **`instanceof`** or `error.code` in `onError` / `catch`.

| Class | `code` | When | Handling |
| ----- | ------ | ---- | -------- |
| `ValidationError` | `VALIDATION_ERROR` | Invalid input before adapter call | Fix caller input; not retryable |
| `BotNotFoundError` | `BOT_NOT_FOUND` | Unknown `botId` or resolver routing | Register bot; check shared `BotRegistry` |
| `BotAlreadyExistsError` | `BOT_ALREADY_EXISTS` | Duplicate `registerBot` | Use another `botId` or `unregisterBot` first |
| `BotNotStartedError` | `BOT_NOT_STARTED` | Send/subscribe while not `started` | `startBot` |
| `SubscriptionNotFoundError` | `SUBSCRIPTION_NOT_FOUND` | Unknown `bindingId` | Register subscription |
| `SubscriptionAlreadyExistsError` | `SUBSCRIPTION_ALREADY_EXISTS` | Duplicate `bindingId` | Unregister or use new id |
| `LifecycleConflictError` | `LIFECYCLE_CONFLICT` | Illegal transition (e.g. unregister from `error`) | Follow lifecycle / reconciliation doc |
| `CapabilityNotSupportedError` | `CAPABILITY_NOT_SUPPORTED` | Adapter lacks feature | Check `TelegramAdapterCapabilities` or credential kind |
| `SendMessageError` | `SEND_MESSAGE_FAILED` | Provider rejected send | Inspect `meta`; map provider cause |
| `TransientNetworkError` | `TRANSIENT_NETWORK` | Network / rate-style transient | Retried only when the operation’s policy allows it (not `sendMessage` by default) |
| `OperationTimeoutError` | `OPERATION_TIMEOUT` | `timeoutMs` exceeded | Increase timeout or retry; lifecycle rules apply |
| `OperationCancelledError` | `OPERATION_CANCELLED` | `AbortSignal` aborted | User cancel; lifecycle rules apply |
| `HandlerExecutionError` | `HANDLER_EXECUTION_FAILED` | `onMessage` handler threw | Fix handler; event bus isolates failures |

Wrap unknown throws with **`mapUnknownToSdkError`**. Provider errors from GramJS/grammY are mapped before they cross the public API.

```ts
import { BotNotStartedError } from "@your-scope/telegram-adapter-kit";

try {
  await runtime.sendMessage({ botId, chatId, text: "hi" });
} catch (err) {
  if (err instanceof BotNotStartedError) {
    await runtime.startBot(botId); // then retry send when status is started
  } else {
    throw err;
  }
}
```

## Retries and timeouts

Runtime operations go through `withOperationControl` (retry + per-attempt timeout). Defaults match the implementation in `src/utils/operation-control.ts` and `src/utils/operation-retry-policy.ts`:

| Topic | Actual behavior |
| ----- | ---------------- |
| **What is retried** | Only errors that satisfy `isTransientSdkError` → **`TransientNetworkError`** (`TRANSIENT_NETWORK`). Validation, lifecycle, timeout, and cancel errors are **not** auto-retried. |
| **Default policy** | `DEFAULT_RETRY_POLICY`: `maxRetries: 3`, `baseDelayMs: 250` → up to **4 attempts** per operation (when retryable). Override via `createRuntimeManager(resolver, { retryPolicy })`. |
| **`sendMessage`** | **`maxRetries: 0`** always (no automatic retries) to avoid duplicate messages on ambiguous failures. |
| **`timeoutMs`** | Applied **per attempt**, not as a single global budget across retries. Omit `timeoutMs` for no SDK-side timeout on that call. |
| **Backoff overlays (TT-048)** | `applyOperationBackoffOverlays` on `RuntimeManagerDeps` defaults to **`false`**. Set `true` only if you want per-operation `maxDelayMs` / jitter overlays (`OPERATION_BACKOFF_OVERLAYS`). |
| **App-level retry** | Safe for idempotent reads; for sends, prefer explicit app logic — the SDK does not retry `sendMessage` by default. |

## Observability

Inject a **`Logger`** via `RuntimeManagerDeps` (`debug` / `info` / `warn` / `error`). Default: **`NoopLogger`**. Secrets (`apiHash`, `stringSession`, `botToken`) are never logged in full.

```ts
import { createRuntimeManager, type Logger } from "@your-scope/telegram-adapter-kit";

const logger: Logger = {
  debug: (message, meta) => console.debug(message, meta),
  info: (message, meta) => console.info(message, meta),
  warn: (message, meta) => console.warn(message, meta),
  error: (message, meta) => console.error(message, meta),
};

const runtime = createRuntimeManager(resolver, { botRegistry: bots, logger });
```

## Troubleshooting

| Symptom | Likely cause | What to do |
| ------- | ------------- | ---------- |
| `BOT_NOT_FOUND` right after `registerBot` | Resolver and runtime use different `BotRegistry` instances | Use one `bots` reference (see [ADAPTER-RESOLVER.md](Documentacion/ADAPTER-RESOLVER.md)) |
| `BOT_NOT_STARTED` on send/subscribe | `startBot` not called or failed | Check `onBotStateChange`; call `startBot` when `registered` |
| `LIFECYCLE_CONFLICT` on `unregisterBot` | Bot in `error` or still `started` | From `error`: `stopBot` → `stopped` → `unregisterBot` |
| `VALIDATION_ERROR` on credentials | Wrong shape / token format | See validators: positive `apiId`, non-empty session, Bot API token pattern |
| MTProto “adapter is not configured” | Resolver without `mtprotoClientFactory` / `mtprotoAdapter` | Pass factory when using `kind: "mtproto"` |
| Duplicate binding | Same `bindingId` twice | `unregisterSubscription` or pick a new id |
| Handler errors in logs | Thrown inside `onMessage` | Fix handler; SDK emits `HANDLER_EXECUTION_FAILED` via `onError` |
| Timeouts on slow networks | `timeoutMs` set too low for provider latency | Raise `timeoutMs` in `OperationOptions` (per attempt); remember lifecycle reconciliation on timeout |

## Documentation map

| Document | Purpose |
| -------- | ------- |
| [PRD](Documentacion/PRD-telegram-runtime-sdk.md) | Vision, MVP, acceptance criteria |
| [TRD](Documentacion/TRD-telegram-runtime-sdk.md) | Architecture, adapters, testing |
| [Backlog](Documentacion/BACKLOG-telegram-runtime-sdk.md) | UC / TT traceability |
| [Adapter resolver](Documentacion/ADAPTER-RESOLVER.md) | Default resolver; shared `BotRegistry` (**TT-029**) |
| [Bot API adapter](Documentacion/BOT-API-ADAPTER.md) | grammY long polling v1 (**TT-028**) |
| GramJS MTProto adapter (`src/adapters/telegram/mtproto/`) | `GramJsMtprotoAdapter`, `GramJsMtprotoClientFactory`; contract coverage in [CONTRACT-TESTS.md](Documentacion/CONTRACT-TESTS.md) |
| [Lifecycle reconciliation](Documentacion/RECONCILIATION-LIFECYCLE.md) | Timeout/cancel on start/stop (**TT-047**) |
| [Contract tests](Documentacion/CONTRACT-TESTS.md) | Adapter harness specs (**TT-027**) |
| [RELEASING.md](RELEASING.md) | Semver, Changesets (**TT-006**) |
| [CHANGELOG.md](CHANGELOG.md) | Release history |

Contracts: `src/contracts/`. Errors: `src/errors/`. Core runtime: `src/core/`.

## Bootstrap (contributors)

1. Clone and `npm install` (or `npm ci`).
2. `npm run lint` / `npm run format:check` — ESLint + Prettier.
3. `npm run test` — Vitest unit tests; `npm run test:contract` — adapter contracts (no live Telegram).
4. `npm run test:coverage` — thresholds **≥ 80%** on `src/core/**` and `src/errors/**`.
5. `npm run build` then `npm run verify:dist` — ESM + CJS + types in `dist/`.
6. `npm run typecheck` — strict `tsc` over `src/` and `tests/`.

## Security

- Never commit `apiHash`, `stringSession`, or `botToken`.
- Use environment variables or a secret manager.
- The kit masks secrets in logs; avoid logging full credentials in application code.

## Contributing

- **Pull requests:** [`.github/pull_request_template.md`](.github/pull_request_template.md) (**TT-037**).
- **CI on PRs:** [`.github/workflows/pr-checks.yml`](.github/workflows/pr-checks.yml) — format, lint, typecheck, test, build, verify:dist on Node 20 (**TT-035**).
- **Releases:** [RELEASING.md](RELEASING.md) (Changesets). Publish automation: **TT-032** / **TT-036**.

## License

MIT — see `package.json` `license` field.
