import { NextRequest, NextResponse } from "next/server";
import {
  INTERNAL_CHAT_PARTICIPANTS,
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
import { loadPortalConfiguration } from "@/lib/portal-config";

export const dynamic = "force-dynamic";

type ChatParticipant = { name: string; email: string };
type ChatUser = ChatParticipant & { id: string };

const MARCELO_CHAT_PARTICIPANT: ChatParticipant = { name: "Marcelo Rodini", email: "mrodini@gmail.com" };

function fallbackParticipants(): ChatParticipant[] {
  const participants = [...INTERNAL_CHAT_PARTICIPANTS, MARCELO_CHAT_PARTICIPANT];
  const unique = new Map<string, ChatParticipant>();
  for (const participant of participants) unique.set(normalizeEmail(participant.email), { ...participant, email: normalizeEmail(participant.email) });
  return [...unique.values()];
}

async function getChatParticipants(accessToken?: string): Promise<ChatParticipant[]> {
  if (!accessToken) return fallbackParticipants();
  try {
    const configuration = await loadPortalConfiguration(accessToken);
    return configuration.users
      .filter((user) => user.active !== false && hasModuleAccess(user.email, "chat", user))
      .map((user) => ({ name: user.name, email: normalizeEmail(user.email) }));
  } catch (error) {
    console.warn("[internal-chat] Não foi possível carregar participantes dinâmicos; usando base segura.", error);
    return fallbackParticipants();
  }
}

async function context(peerEmail?: string | null) {
  const session = await auth();
  const email = normalizeEmail(session?.user?.email);
  if (!email || !hasModuleAccess(email, "chat", session?.portalUser)) return null;

  const participants = await getChatParticipants(session?.accessToken);
  const meParticipant = participants.find((participant) => participant.email === email);
  if (!meParticipant) return null;

  const me: ChatUser = { ...meParticipant, id: meParticipant.email };
  if (!peerEmail) return { authorized: { session, email }, me, peer: null, participants };

  const peerNormalized = normalizeEmail(peerEmail);
  const peerParticipant = participants.find((participant) => participant.email === peerNormalized && participant.email !== email);
  if (!peerParticipant) return null;
  const peer: ChatUser = { ...peerParticipant, id: peerParticipant.email };
  return { authorized: { session, email }, me, peer, participants };
}

function errorResponse(action: string, error: unknown) {
  console.error("[internal-chat][" + action + "]", error);
  const databaseUnavailable = error instanceof Error && error.message.includes("DATABASE_URL");
  return NextResponse.json(
    {
      error: databaseUnavailable
        ? "Chat temporariamente indisponível. A base do Portal não está configurada."
        : "Chat temporariamente indisponível. Tente novamente.",
    },
    { status: 503 },
  );
}

export async function GET(request: NextRequest) {
  try {
    const ctx = await context(request.nextUrl.searchParams.get("peer"));
    if (!ctx) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    if (ctx.peer) {
      const conversation = await getConversationBetween(ctx.me.id, ctx.peer.id);
      if (!conversation) {
        return NextResponse.json({ currentUserId: ctx.me.id, conversationId: null, messages: [] });
      }
      const messages = await listConversationMessages(conversation.id, ctx.me.id);
      return NextResponse.json({ currentUserId: ctx.me.id, conversationId: conversation.id, messages });
    }

    const conversations = await listConversationsForUser(ctx.me.id);
    const unread = await listUnreadMessages(ctx.me.id);
    const recentMessages = await listRecentMessages(ctx.me.id);
    const counts = new Map<string, number>();
    unread.forEach((message) => counts.set(message.sender_user_id, (counts.get(message.sender_user_id) ?? 0) + 1));

    const latestByConversation = new Map<string, ChatMessage>();
    for (const message of recentMessages) {
      if (!latestByConversation.has(message.conversation_id)) latestByConversation.set(message.conversation_id, message);
    }

    const conversationByPeerEmail = new Map<string, { id: string }>();
    for (const conversation of conversations) {
      const peerEmail = conversation.user_a === ctx.me.id ? conversation.user_b : conversation.user_a;
      conversationByPeerEmail.set(peerEmail, { id: conversation.id });
    }

    const contacts = ctx.participants
      .filter((participant) => participant.email !== ctx.authorized.email)
      .map((participant) => {
        const conversation = conversationByPeerEmail.get(participant.email);
        const latest = conversation ? latestByConversation.get(conversation.id) : undefined;
        return {
          ...participant,
          unread: counts.get(participant.email) ?? 0,
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

    return NextResponse.json(
      { currentUser: { email: ctx.authorized.email, name: ctx.me.name }, contacts, totalUnread: unread.length },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return errorResponse("GET", error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as { peer?: string; message?: string };
    const ctx = await context(body.peer);
    if (!ctx?.peer) return NextResponse.json({ error: "Destinatário inválido" }, { status: 400 });

    const message = String(body.message ?? "").trim();
    if (!message || message.length > 4000) {
      return NextResponse.json({ error: "Mensagem inválida" }, { status: 400 });
    }

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
    const body = await request.json() as { peer?: string; action?: "read" | "edit"; messageId?: string; message?: string };
    const ctx = await context(body.peer);
    if (!ctx?.peer) return NextResponse.json({ error: "Destinatário inválido" }, { status: 400 });

    const conversation = await getConversationBetween(ctx.me.id, ctx.peer.id);
    if (body.action === "edit") {
      const message = String(body.message ?? "").trim();
      if (!conversation || !body.messageId || !message || message.length > 4000) {
        return NextResponse.json({ error: "Mensagem inválida" }, { status: 400 });
      }
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
    const body = await request.json() as { peer?: string; action?: "conversation" | "message"; messageId?: string };
    const ctx = await context(body.peer);
    if (!ctx?.peer) {
      return NextResponse.json({ error: "Conversa inválida" }, { status: 400 });
    }

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
