import { neon } from "@neondatabase/serverless";
import { auth } from "@/lib/auth";
import { hasModuleAccess, normalizeEmail } from "@/lib/access-control";

export const INTERNAL_CHAT_PARTICIPANTS = [
  { name: "Ciça", email: "mcrodini@gmail.com" },
  { name: "Lucas", email: "estoquetimoni@gmail.com" },
  { name: "Carolina", email: "carolina@casatimoni.com.br" },
  { name: "Jeovana", email: "comercialrc@casatimoni.com.br" },
] as const;

export type InternalChatParticipant = (typeof INTERNAL_CHAT_PARTICIPANTS)[number];

export function isInternalChatParticipant(email?: string | null) {
  const normalized = normalizeEmail(email);
  return INTERNAL_CHAT_PARTICIPANTS.some((participant) => participant.email === normalized);
}

export function getInternalChatParticipant(email?: string | null) {
  const normalized = normalizeEmail(email);
  return INTERNAL_CHAT_PARTICIPANTS.find((participant) => participant.email === normalized) ?? null;
}

export async function requireInternalChatSession() {
  const session = await auth();
  const email = normalizeEmail(session?.user?.email);
  if (!email || !hasModuleAccess(email, "chat", session?.portalUser) || !isInternalChatParticipant(email)) {
    return null;
  }
  return { session, email };
}

let database: ReturnType<typeof neon> | null = null;
let schemaReady: Promise<void> | null = null;

function getDatabase() {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) throw new Error("DATABASE_URL não configurada no servidor.");
  if (!database) database = neon(databaseUrl);
  return database;
}

async function ensureSchema() {
  if (!schemaReady) {
    schemaReady = (async () => {
      const sql = getDatabase();
      await sql`
        CREATE TABLE IF NOT EXISTS portal_chat_conversations (
          id BIGSERIAL PRIMARY KEY,
          user_a TEXT NOT NULL,
          user_b TEXT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          CONSTRAINT portal_chat_distinct_users CHECK (user_a <> user_b)
        )
      `;
      await sql`
        CREATE UNIQUE INDEX IF NOT EXISTS portal_chat_unique_pair_idx
        ON portal_chat_conversations (LEAST(user_a, user_b), GREATEST(user_a, user_b))
      `;
      await sql`
        CREATE TABLE IF NOT EXISTS portal_chat_messages (
          id BIGSERIAL PRIMARY KEY,
          conversation_id BIGINT NOT NULL REFERENCES portal_chat_conversations(id) ON DELETE CASCADE,
          sender_user_id TEXT NOT NULL,
          recipient_user_id TEXT NOT NULL,
          body TEXT NOT NULL CHECK (CHAR_LENGTH(body) BETWEEN 1 AND 4000),
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          read_at TIMESTAMPTZ,
          CONSTRAINT portal_chat_message_distinct_users CHECK (sender_user_id <> recipient_user_id)
        )
      `;
      await sql`
        ALTER TABLE portal_chat_messages
        ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ
      `;
      await sql`
        CREATE INDEX IF NOT EXISTS portal_chat_messages_conversation_idx
        ON portal_chat_messages (conversation_id, created_at, id)
      `;
      await sql`
        CREATE INDEX IF NOT EXISTS portal_chat_messages_unread_idx
        ON portal_chat_messages (recipient_user_id, created_at DESC)
        WHERE read_at IS NULL
      `;
    })().catch((error) => {
      schemaReady = null;
      throw error;
    });
  }
  await schemaReady;
}

export type ChatDbUser = {
  id: string;
  email: string;
  name: string;
};

export type ChatConversation = {
  id: string;
  user_a: string;
  user_b: string;
};

export type ChatMessage = {
  id: string;
  conversation_id: string;
  sender_user_id: string;
  recipient_user_id: string;
  body: string;
  created_at: Date | string;
  read_at: Date | string | null;
  edited_at: Date | string | null;
};

function normalizeMessage(row: ChatMessage) {
  return {
    ...row,
    id: String(row.id),
    conversation_id: String(row.conversation_id),
    created_at: new Date(row.created_at).toISOString(),
    read_at: row.read_at ? new Date(row.read_at).toISOString() : null,
    edited_at: row.edited_at ? new Date(row.edited_at).toISOString() : null,
  };
}

export async function getDbUserByEmail(email: string): Promise<ChatDbUser | null> {
  await ensureSchema();
  const participant = getInternalChatParticipant(email);
  return participant ? { id: participant.email, email: participant.email, name: participant.name } : null;
}

export async function getConversationBetween(userA: string, userB: string) {
  await ensureSchema();
  const sql = getDatabase();
  const normalizedA = normalizeEmail(userA);
  const normalizedB = normalizeEmail(userB);
  const rows = await sql`
    SELECT id::TEXT AS id, user_a, user_b
    FROM portal_chat_conversations
    WHERE (user_a = ${normalizedA} AND user_b = ${normalizedB})
       OR (user_a = ${normalizedB} AND user_b = ${normalizedA})
    LIMIT 1
  ` as ChatConversation[];
  return rows[0] ?? null;
}

export async function ensureConversation(userA: string, userB: string) {
  const existing = await getConversationBetween(userA, userB);
  if (existing) return existing;

  const sql = getDatabase();
  const [canonicalA, canonicalB] = [normalizeEmail(userA), normalizeEmail(userB)].sort();
  await sql`
    INSERT INTO portal_chat_conversations (user_a, user_b)
    VALUES (${canonicalA}, ${canonicalB})
    ON CONFLICT DO NOTHING
  `;

  const created = await getConversationBetween(canonicalA, canonicalB);
  if (!created) throw new Error("Não foi possível criar a conversa.");
  return created;
}

export async function listConversationsForUser(userEmail: string) {
  await ensureSchema();
  const sql = getDatabase();
  const email = normalizeEmail(userEmail);
  return await sql`
    SELECT id::TEXT AS id, user_a, user_b
    FROM portal_chat_conversations
    WHERE user_a = ${email} OR user_b = ${email}
  ` as ChatConversation[];
}

export async function listUnreadMessages(userEmail: string) {
  await ensureSchema();
  const sql = getDatabase();
  const email = normalizeEmail(userEmail);
  const rows = await sql`
    SELECT
      messages.id::TEXT AS id,
      messages.conversation_id::TEXT AS conversation_id,
      messages.sender_user_id,
      messages.recipient_user_id,
      messages.body,
      messages.created_at,
      messages.read_at,
      messages.edited_at
    FROM portal_chat_messages messages
    INNER JOIN portal_chat_conversations conversations ON conversations.id = messages.conversation_id
    WHERE messages.recipient_user_id = ${email}
      AND messages.read_at IS NULL
      AND (conversations.user_a = ${email} OR conversations.user_b = ${email})
    ORDER BY messages.created_at DESC, messages.id DESC
  ` as ChatMessage[];
  return rows.map(normalizeMessage);
}

export async function listRecentMessages(userEmail: string) {
  await ensureSchema();
  const sql = getDatabase();
  const email = normalizeEmail(userEmail);
  const rows = await sql`
    SELECT DISTINCT ON (messages.conversation_id)
      messages.id::TEXT AS id,
      messages.conversation_id::TEXT AS conversation_id,
      messages.sender_user_id,
      messages.recipient_user_id,
      messages.body,
      messages.created_at,
      messages.read_at,
      messages.edited_at
    FROM portal_chat_messages messages
    INNER JOIN portal_chat_conversations conversations ON conversations.id = messages.conversation_id
    WHERE conversations.user_a = ${email} OR conversations.user_b = ${email}
    ORDER BY messages.conversation_id, messages.created_at DESC, messages.id DESC
  ` as ChatMessage[];
  return rows.map(normalizeMessage);
}

export async function listConversationMessages(conversationId: string) {
  await ensureSchema();
  const sql = getDatabase();
  const rows = await sql`
    SELECT *
    FROM (
      SELECT
        id::TEXT AS id,
        conversation_id::TEXT AS conversation_id,
        sender_user_id,
        recipient_user_id,
        body,
        created_at,
        read_at,
        edited_at
      FROM portal_chat_messages
      WHERE conversation_id = ${conversationId}::BIGINT
      ORDER BY created_at DESC, id DESC
      LIMIT 300
    ) recent
    ORDER BY created_at ASC, id ASC
  ` as ChatMessage[];
  return rows.map(normalizeMessage);
}

export async function createChatMessage(conversationId: string, senderEmail: string, recipientEmail: string, body: string) {
  await ensureSchema();
  const sql = getDatabase();
  const rows = await sql`
    INSERT INTO portal_chat_messages (conversation_id, sender_user_id, recipient_user_id, body)
    VALUES (
      ${conversationId}::BIGINT,
      ${normalizeEmail(senderEmail)},
      ${normalizeEmail(recipientEmail)},
      ${body}
    )
    RETURNING
      id::TEXT AS id,
      conversation_id::TEXT AS conversation_id,
      sender_user_id,
      recipient_user_id,
      body,
      created_at,
      read_at,
      edited_at
  ` as ChatMessage[];
  return rows[0] ? normalizeMessage(rows[0]) : null;
}

export async function markConversationRead(conversationId: string, recipientEmail: string, senderEmail: string) {
  await ensureSchema();
  const sql = getDatabase();
  await sql`
    UPDATE portal_chat_messages
    SET read_at = NOW()
    WHERE conversation_id = ${conversationId}::BIGINT
      AND recipient_user_id = ${normalizeEmail(recipientEmail)}
      AND sender_user_id = ${normalizeEmail(senderEmail)}
      AND read_at IS NULL
  `;
}

export async function updateChatMessage(messageId: string, conversationId: string, senderEmail: string, body: string) {
  await ensureSchema();
  const sql = getDatabase();
  const rows = await sql`
    UPDATE portal_chat_messages
    SET body = ${body}, edited_at = NOW()
    WHERE id = ${messageId}::BIGINT
      AND conversation_id = ${conversationId}::BIGINT
      AND sender_user_id = ${normalizeEmail(senderEmail)}
    RETURNING
      id::TEXT AS id,
      conversation_id::TEXT AS conversation_id,
      sender_user_id,
      recipient_user_id,
      body,
      created_at,
      read_at,
      edited_at
  ` as ChatMessage[];
  return rows[0] ? normalizeMessage(rows[0]) : null;
}

export async function deleteChatMessage(messageId: string, conversationId: string, senderEmail: string) {
  await ensureSchema();
  const sql = getDatabase();
  const rows = await sql`
    DELETE FROM portal_chat_messages
    WHERE id = ${messageId}::BIGINT
      AND conversation_id = ${conversationId}::BIGINT
      AND sender_user_id = ${normalizeEmail(senderEmail)}
    RETURNING id::TEXT AS id
  ` as Array<{ id: string }>;
  return rows[0] ?? null;
}
