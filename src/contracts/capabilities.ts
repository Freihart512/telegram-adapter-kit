/**
 * Declares what an adapter can do so the core can fail fast with capability errors (TRD §7.9).
 * Fields are intentionally minimal for v1; extend in minor releases as features stabilize.
 */
export type TelegramAdapterCapabilities = Readonly<{
  /** Bot can send to a forum topic when `topicId` is set. */
  supportsOutgoingForumTopics: boolean;
  /** Incoming events may include `topicId` for forum threads. */
  supportsIncomingForumTopics: boolean;
  /** Runtime can add/remove read bindings without process restart. */
  supportsDynamicSubscriptions: boolean;
}>;
