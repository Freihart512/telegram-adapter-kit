# MTProto runtime example (TT-041)

Runnable **MTProto (GramJS)** flow with `stringSession`: register → start → subscribe → incoming → send. Same shape as [basic-runtime](../basic-runtime/) but `credentials.kind: "mtproto"`.

## Prerequisites

- Node.js **20+**, `npm install`
- **apiId / apiHash** from [my.telegram.org/apps](https://my.telegram.org/apps)
- **string session** — generate once:

```bash
export TG_API_ID=...
export TG_API_HASH=...
npm run script:gramjs-session
```

- **Chat/channel** where your **user account** (not a bot) can read and post
- For forum topics: `TG_TOPIC_ID` (e.g. link `t.me/c/2593336332/35` → `TG_CHAT_ID=-1002593336332`, `TG_TOPIC_ID=35`)

> **Bot API vs MTProto:** [@BotFather](https://t.me/BotFather) tokens are for `npm run example:basic`. This example uses your **user session** via GramJS.

## Configure

```bash
cp examples/mtproto-runtime/.env.example examples/mtproto-runtime/.env
# TG_API_ID, TG_API_HASH, TG_STRING_SESSION, TG_CHAT_ID, TG_TOPIC_ID
```

Or reuse MTProto block from repo root `.env` and add chat/topic vars.

| Variable | Required | Description |
| -------- | -------- | ----------- |
| `TG_API_ID` | yes | [my.telegram.org/apps](https://my.telegram.org/apps) |
| `TG_API_HASH` | yes | Same app |
| `TG_STRING_SESSION` | yes | `npm run script:gramjs-session` |
| `TG_CHAT_ID` | yes | e.g. `-1002593336332` |
| `TG_TOPIC_ID` | no | Forum topic (e.g. `35`) |

`TG_BOT_TOKEN` is **not** used here — that is for [basic-runtime](../basic-runtime/).

## Run (live Telegram)

```bash
set -a && source examples/mtproto-runtime/.env && set +a
npm run example:mtproto
```

Expect a greeting message in the target chat/topic and `[incoming]` logs when messages arrive.

## Incoming chat id note

Subscription listens to the **whole channel** (`TG_CHAT_ID`). `TG_TOPIC_ID` is used for **send** only — GramJS often does not expose a reliable `reply_to_top_id` on live forum updates, so topic-scoped subscribe would drop messages like your manual replies.

Optional: filter in `onMessage` if `event.topicId` is present:

```ts
if (env.topicId && event.topicId && event.topicId !== env.topicId) return;
```

## Smoke test (CI, no Telegram)

```bash
npm test -- tests/smoke/mtproto-runtime-example.smoke.test.ts
```

## Shutdown

**Ctrl+C** — unregister subscription, stop, unregister bot.
