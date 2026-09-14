import { auth } from "@/lib/auth";
import { hasModuleAccess, normalizeEmail } from "@/lib/access-control";

export const INTERNAL_CHAT_PARTICIPANTS = [
  { name: "Ciça", email: "mcrodini@gmail.com" },
  { name: "Marcelo", email: "mrodini@gmail.com" },
  { name: "Lucas", email: "estoquetimoni@gmail.com" },
  { name: "Carolina", email: "carolina@casatimoni.com.br" },
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

function getSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  const secretKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !secretKey) throw new Error("Supabase do chat interno não configurado.");
  return { url, secretKey };
}

export async function supabaseAdminFetch(path: string, init: RequestInit = {}) {
  const { url, secretKey } = getSupabaseConfig();
  const headers = new Headers(init.headers);
  headers.set("apikey", secretKey);
  headers.set("Content-Type", "application/json");
  const response = await fetch(`${url}/rest/v1/${path}`, {
    ...init,
    headers,
    cache: "no-store",
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Supabase ${response.status}: ${detail}`);
  }
  return response;
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
  created_at: string;
  read_at: string | null;
};

export async function getDbUserByEmail(email: string) {
  const response = await supabaseAdminFetch(`chat_users?email=eq.${encodeURIComponent(normalizeEmail(email))}&select=id,email,name&limit=1`);
  const users = (await response.json()) as ChatDbUser[];
  return users[0] ?? null;
}

export async function getConversationBetween(userA: string, userB: string) {
  const pairA = `and(user_a.eq.${userA},user_b.eq.${userB})`;
  const pairB = `and(user_a.eq.${userB},user_b.eq.${userA})`;
  const response = await supabaseAdminFetch(`chat_conversations?or=(${encodeURIComponent(pairA)},${encodeURIComponent(pairB)})&select=id,user_a,user_b&limit=1`);
  const conversations = (await response.json()) as ChatConversation[];
  return conversations[0] ?? null;
}

export async function ensureConversation(userA: string, userB: string) {
  const existing = await getConversationBetween(userA, userB);
  if (existing) return existing;
  const response = await supabaseAdminFetch("chat_conversations?select=id,user_a,user_b", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({ user_a: userA, user_b: userB }),
  });
  const rows = (await response.json()) as ChatConversation[];
  return rows[0];
}
