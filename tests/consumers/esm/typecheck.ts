import type { BotApiCredentials, TelegramRuntimeSdk } from "telegram-adapter-kit";
import { LIBRARY_NAME, createRuntimeManager } from "telegram-adapter-kit";

const sdk: TelegramRuntimeSdk = createRuntimeManager({
  resolve: () => {
    throw new Error("stub");
  },
  resolveByBotId: () => {
    throw new Error("stub");
  },
});

const creds: BotApiCredentials = {
  kind: "botApi",
  botToken: "12345678:AAxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
};

void sdk;
void creds;
void LIBRARY_NAME;
