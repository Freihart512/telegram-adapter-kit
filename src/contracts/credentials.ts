/** How a registered identity is wired to a Telegram transport (TRD §5.3, §7.9). */
export type TelegramRuntimeKind = "mtproto" | "botApi";

export type MtprotoCredentials = {
  kind: "mtproto";
  apiId: number;
  apiHash: string;
  stringSession: string;
};

export type BotApiCredentials = {
  kind: "botApi";
  botToken: string;
};

export type BotCredentials = MtprotoCredentials | BotApiCredentials;
