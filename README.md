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
4. Tests ([TT-004](Documentacion/BACKLOG-telegram-runtime-sdk.md)): `npm run test` runs **Vitest** once (`vitest run`); `npm run test:watch` keeps the runner open. Unit specs live under `tests/unit/`; adapter contract tests will live under `tests/contract/` (bootstrap file present until [TT-027](Documentacion/BACKLOG-telegram-runtime-sdk.md)).
5. Build ([TT-005](Documentacion/BACKLOG-telegram-runtime-sdk.md)): `npm run build` runs **tsup** and writes `dist/index.mjs` (ESM), `dist/index.cjs` (CJS), source maps, `dist/index.d.ts` / `dist/index.d.cts`, and related maps. The `dist/` folder is gitignored; publishable files are listed in `package.json` `files`. After a build, `npm run verify:dist` smoke-imports both ESM and CJS outputs from the repo root.
6. TypeScript: `npm run typecheck` runs `tsc` with strict settings over `src/**/*.ts` and `tests/**/*.ts` (see `tsconfig.json`). Source lives under `src/`; tests under `tests/`.

**Negative typecheck check:** introduce a deliberate type error in any included `.ts` file and confirm `npm run typecheck` exits with a non-zero status, then revert.

**Negative lint check:** introduce a clear ESLint violation in `src/` or `tests/` (for example an unused binding) and confirm `npm run lint` fails, then revert.

**Negative test check:** change an assertion in a `*.test.ts` file so it fails and confirm `npm run test` exits with a non-zero status, then revert.

## Installation

_Package name and registry TBD._ Planned npm name:

```bash
npm install @your-scope/telegram-adapter-kit
```

## Quick start (illustrative)

The public API is built around **`createRuntimeManager` / `RuntimeManager`** (`TelegramRuntimeSdk`, **TT-015**) and a **`TelegramAdapterResolver`** that wires GramJS/Bot API adapters (**TT-027+**). Example shape:

```ts
import {
  createRuntimeManager,
  type TelegramAdapterResolver,
} from "@your-scope/telegram-adapter-kit";

const resolver = {
  resolve: (input) => myAdapterFor(input.credentials.kind),
  resolveByBotId: (botId) => adapterFor(botId),
} satisfies TelegramAdapterResolver;

const runtime = createRuntimeManager(resolver);

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

await runtime.sendMessage({
  botId: "alerts-bot",
  chatId: -1009876543210n,
  text: "Hello from telegram-adapter-kit",
  topicId: 42,
});
```

## Documentation

| Document                                                 | Purpose                                                                                                                                                                                                                                                                  |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [PRD](Documentacion/PRD-telegram-runtime-sdk.md)         | Vision, MVP scope, acceptance criteria                                                                                                                                                                                                                                   |
| [TRD](Documentacion/TRD-telegram-runtime-sdk.md)         | Architecture, adapters, testing, release                                                                                                                                                                                                                                 |
| [Backlog](Documentacion/BACKLOG-telegram-runtime-sdk.md) | Traceable tasks (UC / TT)                                                                                                                                                                                                                                                |
| [RELEASING.md](RELEASING.md)                             | Semver, Changesets, maintainer release flow (**TT-006**)                                                                                                                                                                                                                 |
| [CHANGELOG.md](CHANGELOG.md)                             | Release history (updated by Changesets)                                                                                                                                                                                                                                  |
| Contracts (`src/contracts/`)                             | Public SDK + internal adapter types (**TT-010**, TRD §5)                                                                                                                                                                                                                 |
| Errors (`src/errors/`)                                   | Typed `TelegramSdkError` hierarchy + `mapUnknownToSdkError` (**TT-011**, PRD RF-07)                                                                                                                                                                                      |
| Core (`src/core/`)                                       | `RuntimeManager` / `createRuntimeManager` (**TT-015**) implement the public facade; `BotRegistry`, `SubscriptionRegistry`, and `EventBus` (**TT-012**–**TT-014**) back orchestration. `SubscriptionRegistry.unregisterByBotId()` supports `unregisterBot` cleanup flows. |

## Security

- Never commit `apiHash`, `stringSession`, or `botToken`.
- Use environment variables or a secret manager.
- The kit masks secrets in logs by design; your app should still avoid logging full credentials.

## Contributing

- **Pull requests:** GitHub applies [`.github/pull_request_template.md`](.github/pull_request_template.md) (**TT-037**) for context, UC/TT traceability, tests, and checklist.
- **CI on PRs:** [`.github/workflows/pr-checks.yml`](.github/workflows/pr-checks.yml) runs `npm ci`, then **lint**, **typecheck**, **test**, **build**, and **verify:dist** on Node 20 (**TT-035**; satisfies the intent of **TT-030** until a separate doc-only follow-up is needed). Enable **branch protection** to require this check on `master` (**TT-038**).
- **Releases:** [RELEASING.md](RELEASING.md) (**Changesets**, semver). Publish automation is **TT-032** / **TT-036**.

## License

MIT — see `package.json` `license` field.
