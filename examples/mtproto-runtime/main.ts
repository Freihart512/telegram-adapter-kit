import { loadMtprotoConfigFromEnv, runMtprotoRuntime, shutdownOnSignals } from "./run.js";

async function main(): Promise<void> {
  const env = loadMtprotoConfigFromEnv();
  const handle = await runMtprotoRuntime({
    credentials: env.credentials,
    botId: env.botId,
    bindingId: env.bindingId,
    chatId: env.chatId,
    topicId: env.topicId,
    greetingText:
      env.greetingText ?? "Hello from telegram-adapter-kit mtproto-runtime example (GramJS)",
    onMessage: (event) => {
      if (
        env.topicId !== undefined &&
        event.topicId !== undefined &&
        event.topicId !== env.topicId
      ) {
        return;
      }
      console.log("[incoming]", {
        botId: event.botId,
        chatId: event.chatId,
        messageId: event.messageId,
        text: event.text,
        topicId: event.topicId,
      });
    },
  });

  console.log("MTProto runtime ready. Press Ctrl+C to stop.");
  console.log({
    botId: handle.botId,
    bindingId: handle.bindingId,
    chatId: env.chatId.toString(),
    topicId: env.topicId,
  });

  await shutdownOnSignals(handle);
  console.log("Shutdown complete.");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
