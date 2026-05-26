/**
 * Obtiene la connection string de GramJS (`stringSession` / TG_STRING_SESSION) para MTProto.
 *
 * No genera bot tokens — esos vienen de @BotFather y van en credentials.kind "botApi".
 *
 * Usage:
 *   TG_API_ID=12345 TG_API_HASH=your_hash npm run script:gramjs-session
 *
 * See scripts/README.md
 */
import * as readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions/index.js";

function parseApiId(raw: string | undefined): number {
  if (!raw?.trim()) {
    throw new Error("Missing TG_API_ID. Get it from https://my.telegram.org/apps");
  }
  const apiId = Number.parseInt(raw.trim(), 10);
  if (!Number.isFinite(apiId) || apiId <= 0) {
    throw new Error(`Invalid TG_API_ID: ${raw}`);
  }
  return apiId;
}

function parseApiHash(raw: string | undefined): string {
  const apiHash = raw?.trim();
  if (!apiHash) {
    throw new Error("Missing TG_API_HASH. Get it from https://my.telegram.org/apps");
  }
  return apiHash;
}

async function main(): Promise<void> {
  const rl = readline.createInterface({ input, output });
  const ask = async (question: string): Promise<string> => {
    const answer = await rl.question(question);
    return answer.trim();
  };

  console.log("GramJS string session generator (MTProto connection string)\n");
  console.log("Prerequisites: apiId + apiHash from https://my.telegram.org/apps");
  console.log("Output: TG_STRING_SESSION for credentials.stringSession in the SDK.\n");

  try {
    const apiId = parseApiId(
      process.env.TG_API_ID ?? (await ask("TG_API_ID (number): ")),
    );
    const apiHash = parseApiHash(
      process.env.TG_API_HASH ?? (await ask("TG_API_HASH: ")),
    );

    const existingSession = process.env.TG_STRING_SESSION?.trim() ?? "";
    const session = new StringSession(existingSession);
    const client = new TelegramClient(session, apiId, apiHash, {
      connectionRetries: 5,
    });

    console.log("\nStarting Telegram login (phone + code; 2FA password if enabled)...\n");

    await client.start({
      phoneNumber: async () => ask("Phone number (international, e.g. +34...): "),
      phoneCode: async () => ask("Code from Telegram app/SMS: "),
      password: async () => ask("2FA password (leave empty if none): "),
      onError: (err) => console.error(err),
    });

    const stringSession = client.session.save() as unknown as string;

    console.log("\n--- Copy to .env (do not commit) ---\n");
    console.log(`TG_API_ID=${apiId}`);
    console.log(`TG_API_HASH=${apiHash}`);
    console.log(`TG_STRING_SESSION=${stringSession}`);
    console.log("\n--- End ---");
    console.log("\nUse stringSession in RegisterBotInput.credentials (kind: mtproto).");
    console.log("Reuse TG_STRING_SESSION on next runs; login again only if the session expires.");

    await client.disconnect();
  } finally {
    rl.close();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
