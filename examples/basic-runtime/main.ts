import { loadConfigFromEnv, runBasicRuntime, shutdownOnSignals } from "./run.js";

async function main(): Promise<void> {
  const env = loadConfigFromEnv();
  const handle = await runBasicRuntime({
    botToken: env.botToken,
    botId: env.botId,
    bindingId: env.bindingId,
    chatId: env.chatId,
    topicId: env.topicId,
    greetingText: env.greetingText ?? "Hello from telegram-adapter-kit basic-runtime example",
    onMessage: (event) => {
      console.log("[incoming]", {
        botId: event.botId,
        chatId: event.chatId,
        messageId: event.messageId,
        text: event.text,
      });
    },
  });

  console.log("Runtime ready. Press Ctrl+C to stop.");
  console.log({ botId: handle.botId, bindingId: handle.bindingId, chatId: env.chatId.toString() });

  await shutdownOnSignals(handle);
  console.log("Shutdown complete.");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
