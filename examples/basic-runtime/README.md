# Basic runtime example (TT-041)

Runnable **Bot API** flow (see [mtproto-runtime](../mtproto-runtime/) for `stringSession` / GramJS).

## Prerequisites

- Node.js **20+**
- Dependencies installed: `npm install` (includes `tsx` for `npm run example:basic`)
- **Bot API (this example):** bot token from [@BotFather](https://t.me/BotFather) → `TG_BOT_TOKEN`
- Chat/channel id where the bot can read and post (`TG_CHAT_ID`)

## Configure

```bash
cp examples/basic-runtime/.env.example examples/basic-runtime/.env
# Bot API only: TG_BOT_TOKEN, TG_CHAT_ID, TG_TOPIC_ID
```

| Variable | Required | Description |
| -------- | -------- | ----------- |
| `TG_BOT_TOKEN` | yes | Bot API token (@BotFather) |
| `TG_CHAT_ID` | yes | e.g. `-1002593336332` for `t.me/c/2593336332/...` |
| `TG_TOPIC_ID` | no | Forum topic (e.g. `35`) |
| `TG_BOT_ID` | no | SDK `botId` (default `demo-bot`) |
| `TG_BINDING_ID` | no | Subscription id |
| `TG_GREETING_TEXT` | no | Outbound message on start |

MTProto vars (`TG_API_ID`, `TG_STRING_SESSION`, …) belong in [mtproto-runtime](../mtproto-runtime/) or root `.env`, not here.

## 2. Run (live Telegram)

```bash
# From repo root — load env (bash/zsh example)
set -a && source examples/basic-runtime/.env && set +a
npm run example:basic
```

The process logs incoming normalized events and sends a greeting message. Stop with **Ctrl+C** (graceful unregister/stop).

## 3. What the example does

1. `createDefaultTelegramAdapterResolverForRegistry` + shared `BotRegistry` ([ADAPTER-RESOLVER.md](../../Documentacion/ADAPTER-RESOLVER.md))
2. `registerBot` / `startBot` with `kind: "botApi"`
3. `registerSubscription` for `TG_CHAT_ID`
4. `onMessage` handler (console log)
5. `sendMessage` with optional greeting text
6. On shutdown: `unregisterSubscription` → `stopBot` → `unregisterBot`

Core logic lives in `run.ts` (importable by smoke tests).

## 4. Smoke test (no Telegram)

CI runs an in-memory harness that simulates inbound + outbound:

```bash
npm test -- tests/smoke/basic-runtime-example.smoke.test.ts
```

## Troubleshooting

| Issue | Check |
| ----- | ----- |
| `BOT_NOT_FOUND` after register | Same `BotRegistry` for resolver and runtime |
| `BOT_NOT_STARTED` | `startBot` completed; inspect `onBotStateChange` |
| Bot does not receive messages | Bot added to chat; `TG_CHAT_ID` matches; privacy mode / admin rights |
| Send fails | Bot can post in target chat; id is correct (use string/bigint for large ids) |
