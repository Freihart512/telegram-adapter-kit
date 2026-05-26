# telegram-adapter-kit

TypeScript toolkit for **Telegram** with a stable runtime API: register bots and channel subscriptions at runtime, receive normalized incoming messages, and send to chats, channels, and **forum topics**. Supports **MTProto** (via [GramJS](https://github.com/gram-js/gramjs)) and **Bot API** bots (via [grammY](https://grammy.dev/)) behind one public surface.

> **Note:** Product specs live in [`Documentacion/`](Documentacion/).

## Features

- **Runtime registration** of multiple Telegram identities using a public `botId` (MTProto session or Bot API token).
- **Dynamic subscriptions** to incoming messages (add/remove bindings without a static config file).
- **Outgoing messages** to chat/channel, including **topics** where supported.
- **Typed errors**, optional timeouts/cancellation, and contract-testable adapters.
- **Domain-agnostic** core: your app supplies business logic; the kit handles Telegram wiring.

## Requirements

- Node.js **LTS** (see `engines` in `package.json`).
- TypeScript **5.x** (declared in `devDependencies`; `npm run typecheck` uses [TT-002](Documentacion/BACKLOG-telegram-runtime-sdk.md) `tsconfig.json`).

## Bootstrap (local)

1. Clone the repository and open the project root.
2. Install dependencies: `npm install` (or `npm ci` when `package-lock.json` is present).
3. Lint and format ([TT-003](Documentacion/BACKLOG-telegram-runtime-sdk.md)): `npm run lint` runs ESLint on `src/` and `tests/` (`eslint.config.js`, `typescript-eslint`, `eslint-config-prettier`). Use `npm run lint:fix` to auto-fix where possible. `npm run format` / `npm run format:check` run Prettier on TypeScript and selected config JSON/JS.
4. Tests ([TT-004](Documentacion/BACKLOG-telegram-runtime-sdk.md), [TT-018](Documentacion/BACKLOG-telegram-runtime-sdk.md), [TT-031](Documentacion/BACKLOG-telegram-runtime-sdk.md), [TT-027](Documentacion/BACKLOG-telegram-runtime-sdk.md)): `npm run test` runs **Vitest** once (`vitest run`); `npm run test:watch` keeps the runner open; `npm run test:contract` runs only adapter contract specs under `tests/contract/`. Use `npm run test:coverage` to generate a coverage report (console + `coverage/index.html`). Coverage thresholds for core quality gates are enforced at `>= 80%` for lines/branches/functions/statements on `src/core/**` and `src/errors/**`; CI fails when thresholds are not met. Unit specs: `tests/unit/`. Adapter contracts (GramJS harness, no live Telegram): `tests/contract/` — see [CONTRACT-TESTS.md](Documentacion/CONTRACT-TESTS.md).
5. Build ([TT-005](Documentacion/BACKLOG-telegram-runtime-sdk.md)): `npm run build` runs **tsup** and writes `dist/index.mjs` (ESM), `dist/index.cjs` (CJS), source maps, `dist/index.d.ts` / `dist/index.d.cts`, and related maps. The `dist/` folder is gitignored; publishable files are listed in `package.json` `files`. After a build, `npm run verify:dist` smoke-imports both outputs from the repo root; `npm run verify:consumers` packs the publishable tarball and installs minimal ESM/CJS apps that import via `package.json` **`exports`** ([CONSUMER-EXPORTS.md](Documentacion/CONSUMER-EXPORTS.md), **TT-033**).
6. TypeScript: `npm run typecheck` runs `tsc` with strict settings over `src/**/*.ts` and `tests/**/*.ts`, excluding `tests/consumers/` (see `tsconfig.json` `exclude`). Source lives under `src/`; tests under `tests/`. Consumer export fixtures under `tests/consumers/` are typechecked separately via `npm run verify:consumers` (**TT-033**).

**Negative typecheck check:** introduce a deliberate type error in any included `.ts` file and confirm `npm run typecheck` exits with a non-zero status, then revert.

**Negative lint check:** introduce a clear ESLint violation in `src/` or `tests/` (for example an unused binding) and confirm `npm run lint` fails, then revert.

**Negative test check:** change an assertion in a `*.test.ts` file so it fails and confirm `npm run test` exits with a non-zero status, then revert.

## Installation

_Package name and registry TBD._ Planned npm name:

```bash
npm install @your-scope/telegram-adapter-kit
```

## Quick start (illustrative)

The public API is built around **`createRuntimeManager` / `RuntimeManager`** (`TelegramRuntimeSdk`, **TT-015**) and a **`TelegramAdapterResolver`** that wires GramJS/Bot API adapters (**TT-029**). Example with the default resolver:

```ts
import {
  BotRegistry,
  createDefaultTelegramAdapterResolverForRegistry,
  createRuntimeManager,
} from "@your-scope/telegram-adapter-kit";

// One BotRegistry for both resolver and runtime (required — see ADAPTER-RESOLVER.md).
const bots = new BotRegistry();
const resolver = createDefaultTelegramAdapterResolverForRegistry(bots, {
  mtprotoClientFactory: (credentials) => createGramJsClient(credentials),
});
const runtime = createRuntimeManager(resolver, { botRegistry: bots });

// MTProto (GramJS)
await runtime.registerBot({
  botId: "main-account",
  credentials: {
    kind: "mtproto",
    apiId: 123456,
    apiHash: process.env.TG_API_HASH!,
    stringSession: process.env.TG_STRING_SESSION!,
  },
});
await runtime.startBot("main-account");

// Bot API (grammY)
await runtime.registerBot({
  botId: "alerts-bot",
  credentials: { kind: "botApi", botToken: process.env.TG_BOT_TOKEN! },
});
await runtime.startBot("alerts-bot");

await runtime.registerSubscription({
  bindingId: "signals-1",
  botId: "main-account",
  chatId: -1001234567890n,
});

runtime.onMessage((event) => {
  // normalized incoming event
});

> **Important:** `bots` must be the **same** `BotRegistry` passed to `createDefaultTelegramAdapterResolverForRegistry` and to `createRuntimeManager`. Using two instances breaks adapter routing after `registerBot`.

await runtime.sendMessage({
  botId: "alerts-bot",
  chatId: -1009876543210n,
  text: "Hello from telegram-adapter-kit",
  topicId: 42,
});
```

## Observability (TT-017)

`RuntimeManager` accepts an optional injected logger (`debug/info/warn/error`) through `RuntimeManagerDeps`.
If omitted, the SDK uses `NoopLogger`, so behavior is unchanged.

```ts
import { createRuntimeManager, type Logger } from "@your-scope/telegram-adapter-kit";

const logger: Logger = {
  debug: (message, meta) => console.debug(message, meta),
  info: (message, meta) => console.info(message, meta),
  warn: (message, meta) => console.warn(message, meta),
  error: (message, meta) => console.error(message, meta),
};

const runtime = createRuntimeManager(resolver, { logger });
```

## Examples

| Example                                      | Description                                                                       |
| -------------------------------------------- | --------------------------------------------------------------------------------- |
| [basic-runtime](examples/basic-runtime/)     | Bot API: register, start, subscribe, send (`npm run example:basic`) — **TT-041**  |
| [mtproto-runtime](examples/mtproto-runtime/) | MTProto + `stringSession`: same E2E flow (`npm run example:mtproto`) — **TT-041** |
| [GramJS string session](scripts/README.md)   | Generate `TG_STRING_SESSION`: `npm run script:gramjs-session`                     |

## Documentation

| Document                                                                    | Purpose                                                                                                                                                                                                                                                                                                                                                                                 |
| --------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [PRD](Documentacion/PRD-telegram-runtime-sdk.md)                            | Vision, MVP scope, acceptance criteria                                                                                                                                                                                                                                                                                                                                                  |
| [TRD](Documentacion/TRD-telegram-runtime-sdk.md)                            | Architecture, adapters, testing, release                                                                                                                                                                                                                                                                                                                                                |
| [Backlog](Documentacion/BACKLOG-telegram-runtime-sdk.md)                    | Traceable tasks (UC / TT)                                                                                                                                                                                                                                                                                                                                                               |
| [Adapter resolver](Documentacion/ADAPTER-RESOLVER.md)                       | Default resolver wiring; **shared `BotRegistry`** requirement (**TT-029**)                                                                                                                                                                                                                                                                                                              |
| [Operations & troubleshooting](Documentacion/OPERATIONS-TROUBLESHOOTING.md) | Runbooks, error codes, lifecycle recovery, observability (**TT-043**)                                                                                                                                                                                                                                                                                                                   |
| [Secrets masking](Documentacion/SECRETS-MASKING.md)                         | Log/error redaction policy and integrator checklist (**TT-034**)                                                                                                                                                                                                                                                                                                                        |
| [Consumer exports (ESM/CJS)](Documentacion/CONSUMER-EXPORTS.md)             | Downstream import/require validation and TypeScript resolution (**TT-033**)                                                                                                                                                                                                                                                                                                               |
| [Lifecycle reconciliation](Documentacion/RECONCILIATION-LIFECYCLE.md)       | Timeout/cancel on `startBot` / `stopBot` (**TT-047**)                                                                                                                                                                                                                                                                                                                                   |
| [RELEASING.md](RELEASING.md)                                                | Semver, Changesets, maintainer release flow (**TT-006**)                                                                                                                                                                                                                                                                                                                                |
| [CHANGELOG.md](CHANGELOG.md)                                                | Release history (updated by Changesets)                                                                                                                                                                                                                                                                                                                                                 |
| Contracts (`src/contracts/`)                                                | Public SDK + internal adapter types (**TT-010**, TRD §5)                                                                                                                                                                                                                                                                                                                                |
| Errors (`src/errors/`)                                                      | Typed `TelegramSdkError` hierarchy + `mapUnknownToSdkError` (**TT-011**, PRD RF-07)                                                                                                                                                                                                                                                                                                     |
| Core (`src/core/`)                                                          | `RuntimeManager` / `createRuntimeManager` (**TT-015**) implement the public facade; `BotRegistry`, `SubscriptionRegistry`, and `EventBus` (**TT-012**–**TT-014**) back orchestration. `SubscriptionRegistry.unregisterByBotId()` supports `unregisterBot` cleanup flows. Reusable input validators (**TT-016**) live in `core/validators.ts` and run fail-fast before any adapter call. |

## Security

- Never commit `apiHash`, `stringSession`, or `botToken`.
- Use environment variables or a secret manager.
- The kit masks secrets in logs and error `meta` via `createSafeLogger` and `sanitizeLogMeta` (**TT-034**); see [SECRETS-MASKING.md](Documentacion/SECRETS-MASKING.md).
- Your app should still avoid placing credentials in custom log fields or serializing raw `error.cause` without review.

## Contributing

- **Pull requests:** GitHub applies [`.github/pull_request_template.md`](.github/pull_request_template.md) (**TT-037**) for context, UC/TT traceability, tests, and checklist.
- **CI on PRs:** [`.github/workflows/pr-checks.yml`](.github/workflows/pr-checks.yml) runs `npm ci`, then **format:check**, **lint**, **typecheck**, **test**, **build**, **verify:dist**, and **verify:consumers** (**TT-033**) on Node 24 (**TT-035**). Enable **branch protection** to require this check on `master` (**TT-038**).
- **Releases:** [RELEASING.md](RELEASING.md) (**Changesets**, semver). Publish automation is **TT-032** / **TT-036**.

## License

MIT — see `package.json` `license` field.
