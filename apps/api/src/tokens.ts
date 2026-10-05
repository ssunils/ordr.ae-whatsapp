/** Injection tokens. Every constructor uses explicit @Inject so no decorator metadata is needed. */
export const TOKENS = {
  Config: Symbol("Config"),
  TenantRepository: Symbol("TenantRepository"),
  ConversationRepository: Symbol("ConversationRepository"),
  SessionStore: Symbol("SessionStore"),
  DedupeStore: Symbol("DedupeStore"),
  MessageSender: Symbol("MessageSender"),
  ActionRegistry: Symbol("ActionRegistry"),
  BlueprintRegistry: Symbol("BlueprintRegistry"),
} as const;
