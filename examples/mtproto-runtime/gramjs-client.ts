import { TelegramClient, utils } from "telegram";
import { NewMessage } from "telegram/events/index.js";
import { StringSession } from "telegram/sessions/index.js";
import type { MtprotoCredentials } from "../../src/contracts/credentials.js";
import type {
  GramJsEventHandler,
  GramJsMtprotoClient,
  GramJsMtprotoClientFactory,
  GramJsRawEvent,
  GramJsSendMessageParams,
} from "../../src/adapters/telegram/mtproto/gramjs-adapter.js";

type GramJsWrappedHandler = (event: unknown) => void;

const newMessageFilter = new NewMessage({});

function toOptionalNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "bigint") {
    return Number(value);
  }
  return undefined;
}

function toOptionalBigInt(value: unknown): bigint | undefined {
  if (typeof value === "bigint") {
    return value;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return BigInt(Math.trunc(value));
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (/^-?\d+$/.test(trimmed)) {
      return BigInt(trimmed);
    }
  }
  if (value !== null && typeof value === "object") {
    const record = value as Record<string, unknown>;
    if ("value" in record) {
      return toOptionalBigInt(record.value);
    }
    if (typeof record.toString === "function") {
      const asString = record.toString();
      if (typeof asString === "string" && /^-?\d+$/.test(asString)) {
        return BigInt(asString);
      }
    }
  }
  return undefined;
}

function peerIdFromResolvedChatId(
  chatId: unknown,
): { channelId?: bigint; chatId?: bigint; userId?: bigint } | undefined {
  const id = toOptionalBigInt(chatId);
  if (id === undefined) {
    return undefined;
  }
  const normalized = id.toString();
  if (normalized.startsWith("-100") && normalized.length > 4) {
    return { channelId: BigInt(normalized.slice(4)) };
  }
  if (id < 0n) {
    return { chatId: -id };
  }
  return { userId: id };
}

function extractPeerId(
  peerId: unknown,
): { channelId?: bigint; chatId?: bigint; userId?: bigint } | undefined {
  if (peerId === null || peerId === undefined) {
    return undefined;
  }
  try {
    const resolved = utils.getPeerId(peerId as never);
    const fromResolved = peerIdFromResolvedChatId(resolved);
    if (fromResolved) {
      return fromResolved;
    }
  } catch {
    // Not a GramJS peer object; try manual field extraction below.
  }
  if (typeof peerId !== "object") {
    return undefined;
  }
  const peer = peerId as Record<string, unknown>;
  const channelId = toOptionalBigInt(peer.channelId);
  const chatId = toOptionalBigInt(peer.chatId);
  const userId = toOptionalBigInt(peer.userId);
  if (channelId !== undefined) {
    return { channelId };
  }
  if (chatId !== undefined) {
    return { chatId };
  }
  if (userId !== undefined) {
    return { userId };
  }
  return undefined;
}

function extractReplyTo(
  replyTo: unknown,
): { replyToTopId?: number; replyToMsgId?: number } | undefined {
  if (replyTo === null || replyTo === undefined || typeof replyTo !== "object") {
    return undefined;
  }
  const r = replyTo as Record<string, unknown>;
  const replyToTopId = toOptionalNumber(r.replyToTopId);
  const replyToMsgId = toOptionalNumber(r.replyToMsgId);
  if (replyToTopId === undefined && replyToMsgId === undefined) {
    return undefined;
  }
  return { replyToTopId, replyToMsgId };
}

function readMessageText(message: Record<string, unknown>): string | undefined {
  if (typeof message.message === "string") {
    return message.message;
  }
  if (typeof message.text === "string") {
    return message.text;
  }
  return undefined;
}

function toGramJsRawEvent(message: unknown, eventContext?: unknown): GramJsRawEvent {
  if (message === null || message === undefined || typeof message !== "object") {
    return {};
  }
  const m = message as Record<string, unknown> & { chatId?: unknown };
  const ctx = eventContext as { chatId?: unknown } | undefined;
  const peerId =
    extractPeerId(m.peerId) ??
    peerIdFromResolvedChatId(m.chatId) ??
    (ctx?.chatId !== undefined ? peerIdFromResolvedChatId(ctx.chatId) : undefined);
  return {
    message: {
      id: toOptionalNumber(m.id),
      message: readMessageText(m),
      date: toOptionalNumber(m.date),
      peerId,
      replyTo: extractReplyTo(m.replyTo),
    },
  };
}

/**
 * Production GramJS client factory for `createDefaultTelegramAdapterResolverForRegistry`.
 * Uses `credentials.stringSession` from env (generate via `npm run script:gramjs-session`).
 */
export function createLiveGramJsClientFactory(): GramJsMtprotoClientFactory {
  const handlerMap = new Map<GramJsEventHandler, GramJsWrappedHandler>();

  return async (credentials: MtprotoCredentials): Promise<GramJsMtprotoClient> => {
    const session = new StringSession(credentials.stringSession);
    const client = new TelegramClient(session, credentials.apiId, credentials.apiHash, {
      connectionRetries: 5,
    });

    return {
      async connect(): Promise<void> {
        await client.connect();
        if (!(await client.checkAuthorization())) {
          throw new Error(
            "GramJS session is not authorized. Run npm run script:gramjs-session to obtain TG_STRING_SESSION.",
          );
        }
        await client.getMe();
      },
      async disconnect(): Promise<void> {
        await client.disconnect();
      },
      async destroy(): Promise<void> {
        await client.destroy();
      },
      addEventHandler(handler: GramJsEventHandler): void {
        const wrapped: GramJsWrappedHandler = (event: unknown) => {
          const update = event as { message?: unknown };
          if (!update.message) {
            return;
          }
          const raw = toGramJsRawEvent(update.message, update);
          handler(raw);
        };
        handlerMap.set(handler, wrapped);
        client.addEventHandler(wrapped, newMessageFilter);
      },
      removeEventHandler(handler: GramJsEventHandler): void {
        const wrapped = handlerMap.get(handler);
        if (!wrapped) {
          return;
        }
        client.removeEventHandler(wrapped, newMessageFilter);
        handlerMap.delete(handler);
      },
      async sendMessage(params: GramJsSendMessageParams) {
        const peer =
          typeof params.peer === "bigint" ? params.peer.toString() : params.peer;
        const result = await client.sendMessage(peer, {
          message: params.message,
          parseMode: params.parseMode,
          replyTo: params.topicId ?? params.replyTo,
          linkPreview: params.linkPreview,
        });
        return {
          id: result.id,
          date: result.date,
        };
      },
    };
  };
}
