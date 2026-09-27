import { NextRequest, NextResponse } from "next/server";
import {
  clearConversationForUser,
  createChatMessage,
  deleteChatMessage,
  ensureConversation,
  getConversationBetween,
  listConversationMessages,
  listConversationsForUser,
  listRecentMessages,
  listUnreadMessages,
  markConversationRead,
  type ChatMessage,
  updateChatMessage,
} from "@/lib/internal-chat";
import { auth } from "@/lib/auth";
import { hasModuleAccess, normalizeEmail } from "@/lib/access-control";
import { getEffectiveCollaborators, getEffectivePortalUser, listConfiguredPortalUsers } from "@/lib/portal-config";

export const dynamic = "force-dynamic";

type ChatParticipant = { id: string; name: string; email: string; unit?: string };
type ChatUser = ChatParticipant;

const MANAGEMENT_EMAILS = new Set(["mcrodini@gmail.com", "mrodini@gmail.com"]);
const LEGACY_CHAT_IDS = new Map<string, string>([
  ["estoquetimoni@gmail.com::lucas", "estoquetimoni@gmail.com"],
  ["carolina@casatimoni.com.br::carolina", "carolina@casatimoni.com.br"],
  ["comercialrc@casatimoni.com.br::jeovana", "comercialrc@casatimoni.com.br"],
]);

function legacyId(email: string, name: string) {
  return LEGACY_CHAT_IDS.get(`${normalizeEmail(email)}::${name.trim().toLocaleLowerCase("pt-BR")}`) || "";
}

async function getChatParticipants(accessToken?: string): Promise<ChatParticipant[]> {
  if (!accessToken) return [
    { id: "mcrodini@gmail.com", name: "Ciça", email: "mcrodini@gmail.com", unit: "Geral" },
    { id: "mrodini@gmail.com", name: "Marcelo Rodini", email: "mrodini@gmail.com", unit: "Geral" },
  ];

  const [users, collaborators] = await Promise.all([
    listConfiguredPortalUsers(accessToken),
    getEffectiveCollaborators(accessToken),
  ]);

  const participants: ChatParticipant[] = users
    .filter((user) => user.active !== false && MANAGEMENT_EMAILS.has(normalizeEmail(user.email)) && hasModuleAccess(user.email, "chat", user))
    .map((user) => ({
      id: normalizeEmail(user.email),
      name: user.email === "mcrodini@gmail.com" ? "Ciça" : user.name,
      email: normalizeEmail(user.email),
      unit: user.unit || "Geral",
    }));

  for (const member of collaborators) {
    const email = normalizeEmail(member.accessEmail);
    if (!member.active || member.chatEnabled === false || !email) continue;
    const user = users.find((item) => normalizeEmail(item.email) === email && item.active !== false);
    if (!user || !hasModuleAccess(email, "chat", user)) continue;
    const id = legacyId(email, member.name) || `colaborador:${member.id}`;
    participants.push({ id, name: member.name, email, unit: member.unit });
  }

  const unique = new Map<string, ChatParticipant>();
  for (const participant of participants) unique.set(participant.id, participant);
  return [...unique.values()];
}

async function baseContext() {
  const session = await auth();
  const email = normalizeEmail(session?.user?.email);
  if (!email) return null;
  const effectiveUser = await getEffectivePortalUser(session?.accessToken, email);
  if (!hasModuleAccess(email, "chat", effectiveUser)) return null;
  const participants = await getChatParticipants(session?.accessToken);
  const identities = participants.filter((participant) => participant.email === email);
  return { session, email, participants, identities };
}

async function context(actorId?: string | null, peerId?: string | null) {
  const base = await baseContext();
  if (!base) return null;
  const actor = base.identities.find((participant) => participant.id === String(actorId || ""));
  if (!actor) return { ...base, me: null, peer: null };
  const me: ChatUser = actor;
  if (!peerId) return { ...base, me, peer: null };
  const peer = base.participants.find((participant) => participant.id === String(peerId) && participant.id !== me.id) || null;
  return { ...base, me, peer };
}

function errorResponse(action: string, error: unknown) {
  console.error("[internal-chat][" + action + "]", error);
  const databaseUnavailable = error instanceof Error && error.message.includes("DATABASE_URL");
  return NextResponse.json(
    { error: databaseUnavailable ? "Chat temporariamente indisponível. A base do Portal não está configurada." : "Chat temporariamente indisponível. Tente novamente." },
    { status: 503 },
  );
}

async function totalUnreadFor(identities: ChatParticipant[]) {
  const unreadLists = await Promise.all(identities.map((identity) => listUnreadMessages(identity.id)));
  return unreadLists.reduce((total, list) => total + list.length, 0);
}

export async function GET(request: NextRequest) {
  try {
    const actorId = request.nextUrl.searchParams.get("actor");
    const peerId = request.nextUrl.searchParams.get("peer");
    const ctx = await context(actorId, peerId);
    if (!ctx) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    if (!ctx.me) {
      return NextResponse.json({
        currentAccessEmail: ctx.email,
        identities: ctx.identities,
        totalUnread: await totalUnreadFor(ctx.identities),
      }, { headers: { "Cache-Control": "private, no-store" } });
    }

    if (ctx.peer) {
      const conversation = await getConversationBetween(ctx.me.id, ctx.peer.id);
      if (!conversation) return NextResponse.json({ currentUserId: ctx.me.id, conversationId: null, messages: [] });
      const messages = await listConversationMessages(conversation.id, ctx.me.id);
      return NextResponse.json({ currentUserId: ctx.me.id, conversationId: conversation.id, messages });
    }

    const conversations = await listConversationsForUser(ctx.me.id);
    const unread = await listUnreadMessages(ctx.me.id);
    const recentMessages = await listRecentMessages(ctx.me.id);
    const counts = new Map<string, number>();
    unread.forEach((message) => counts.set(message.sender_user_id, (counts.get(message.sender_user_id) ?? 0) + 1));

    const latestByConversation = new Map<string, ChatMessage>();
    for (const message of recentMessages) if (!latestByConversation.has(message.conversation_id)) latestByConversation.set(message.conversation_id, message);

    const conversationByPeerId = new Map<string, { id: string }>();
    for (const conversation of conversations) {
      const id = conversation.user_a === ctx.me.id ? conversation.user_b : conversation.user_a;
      conversationByPeerId.set(id, { id: conversation.id });
    }

    const contacts = ctx.participants
      .filter((participant) => participant.id !== ctx.me!.id)
      .map((participant) => {
        const conversation = conversationByPeerId.get(participant.id);
        const latest = conversation ? latestByConversation.get(conversation.id) : undefined;
        return {
          ...participant,
          unread: counts.get(participant.id) ?? 0,
          lastMessageAt: latest?.created_at ?? null,
          lastMessagePreview: latest?.body ?? "",
        };
      })
      .sort((a, b) => {
        if (a.lastMessageAt && b.lastMessageAt) return new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime();
        if (a.lastMessageAt) return -1;
        if (b.lastMessageAt) return 1;
        return a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" });
      });

    return NextResponse.json({
      currentAccessEmail: ctx.email,
      identities: ctx.identities,
      currentUser: { id: ctx.me.id, email: ctx.email, name: ctx.me.name },
      contacts,
      totalUnread: unread.length,
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return errorResponse("GET", error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as { actor?: string; peer?: string; message?: string };
    const ctx = await context(body.actor, body.peer);
    if (!ctx?.me || !ctx.peer) return NextResponse.json({ error: "Destinatário ou colaborador inválido" }, { status: 400 });
    const message = String(body.message ?? "").trim();
    if (!message || message.length > 4000) return NextResponse.json({ error: "Mensagem inválida" }, { status: 400 });
    const conversation = await ensureConversation(ctx.me.id, ctx.peer.id);
    const created = await createChatMessage(conversation.id, ctx.me.id, ctx.peer.id, message);
    if (!created) throw new Error("A mensagem não foi gravada.");
    return NextResponse.json({ message: created }, { status: 201 });
  } catch (error) {
    return errorResponse("POST", error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json() as { actor?: string; peer?: string; action?: "read" | "edit"; messageId?: string; message?: string };
    const ctx = await context(body.actor, body.peer);
    if (!ctx?.me || !ctx.peer) return NextResponse.json({ error: "Destinatário ou colaborador inválido" }, { status: 400 });
    const conversation = await getConversationBetween(ctx.me.id, ctx.peer.id);
    if (body.action === "edit") {
      const message = String(body.message ?? "").trim();
      if (!conversation || !body.messageId || !message || message.length > 4000) return NextResponse.json({ error: "Mensagem inválida" }, { status: 400 });
      const updated = await updateChatMessage(body.messageId, conversation.id, ctx.me.id, message);
      if (!updated) return NextResponse.json({ error: "Mensagem não encontrada" }, { status: 404 });
      return NextResponse.json({ message: updated });
    }
    if (conversation) await markConversationRead(conversation.id, ctx.me.id, ctx.peer.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse("PATCH", error);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json() as { actor?: string; peer?: string; action?: "conversation" | "message"; messageId?: string };
    const ctx = await context(body.actor, body.peer);
    if (!ctx?.me || !ctx.peer) return NextResponse.json({ error: "Conversa inválida" }, { status: 400 });
    const conversation = await getConversationBetween(ctx.me.id, ctx.peer.id);
    if (!conversation) return NextResponse.json({ ok: true });
    if (body.action === "conversation") {
      await clearConversationForUser(conversation.id, ctx.me.id);
      return NextResponse.json({ ok: true });
    }
    if (!body.messageId) return NextResponse.json({ error: "Mensagem inválida" }, { status: 400 });
    const deleted = await deleteChatMessage(body.messageId, conversation.id, ctx.me.id);
    if (!deleted) return NextResponse.json({ error: "Mensagem não encontrada" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse("DELETE", error);
  }
}
