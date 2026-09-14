import { NextRequest, NextResponse } from "next/server";
import {
  INTERNAL_CHAT_PARTICIPANTS,
  ensureConversation,
  getConversationBetween,
  getDbUserByEmail,
  requireInternalChatSession,
  supabaseAdminFetch,
  type ChatMessage,
} from "@/lib/internal-chat";
import { normalizeEmail } from "@/lib/access-control";

export const dynamic = "force-dynamic";

async function resolveContext(peerEmail?: string | null) {
  const authorized = await requireInternalChatSession();
  if (!authorized) return { error: NextResponse.json({ error: "Não autorizado" }, { status: 401 }) } as const;

  const me = await getDbUserByEmail(authorized.email);
  if (!me) return { error: NextResponse.json({ error: "Usuário do chat não configurado" }, { status: 403 }) } as const;

  if (!peerEmail) return { authorized, me } as const;
  const normalizedPeer = normalizeEmail(peerEmail);
  const listed = INTERNAL_CHAT_PARTICIPANTS.find((participant) => participant.email === normalizedPeer);
  if (!listed || normalizedPeer === authorized.email) {
    return { error: NextResponse.json({ error: "Destinatário inválido" }, { status: 400 }) } as const;
  }
  const peer = await getDbUserByEmail(normalizedPeer);
  if (!peer) return { error: NextResponse.json({ error: "Destinatário não configurado" }, { status: 400 }) } as const;
  return { authorized, me, peer } as const;
}

export async function GET(request: NextRequest) {
  try {
    const peerEmail = request.nextUrl.searchParams.get("peer");
    const context = await resolveContext(peerEmail);
    if ("error" in context) return context.error;

    if (context.peer) {
      const conversation = await getConversationBetween(context.me.id, context.peer.id);
      if (!conversation) {
        return NextResponse.json({ conversationId: null, messages: [] });
      }
      const response = await supabaseAdminFetch(
        `chat_messages?conversation_id=eq.${conversation.id}&select=id,conversation_id,sender_user_id,recipient_user_id,body,created_at,read_at&order=created_at.asc&limit=300`,
      );
      const messages = (await response.json()) as ChatMessage[];
      return NextResponse.json({ conversationId: conversation.id, messages });
    }

    const conversationsResponse = await supabaseAdminFetch(
      `chat_conversations?or=(user_a.eq.${context.me.id},user_b.eq.${context.me.id})&select=id,user_a,user_b`,
    );
    const conversations = (await conversationsResponse.json()) as Array<{ id: string; user_a: string; user_b: string }>;
    const ids = conversations.map((conversation) => conversation.id);
    let unreadMessages: ChatMessage[] = [];
    if (ids.length) {
      const unreadResponse = await supabaseAdminFetch(
        `chat_messages?conversation_id=in.(${ids.join(",")})&recipient_user_id=eq.${context.me.id}&read_at=is.null&select=id,conversation_id,sender_user_id,recipient_user_id,body,created_at,read_at`,
      );
      unreadMessages = (await unreadResponse.json()) as ChatMessage[];
    }

    const dbUsersResponse = await supabaseAdminFetch("chat_users?select=id,email,name&active=eq.true");
    const dbUsers = (await dbUsersResponse.json()) as Array<{ id: string; email: string; name: string }>;
    const idByEmail = new Map(dbUsers.map((user) => [normalizeEmail(user.email), user.id]));
    const unreadBySender = new Map<string, number>();
    for (const message of unreadMessages) {
      unreadBySender.set(message.sender_user_id, (unreadBySender.get(message.sender_user_id) ?? 0) + 1);
    }

    const contacts = INTERNAL_CHAT_PARTICIPANTS
      .filter((participant) => participant.email !== context.authorized.email)
      .map((participant) => ({
        ...participant,
        unread: unreadBySender.get(idByEmail.get(participant.email) ?? "") ?? 0,
      }));

    return NextResponse.json({
      currentUser: { email: context.authorized.email, name: context.me.name },
      contacts,
      totalUnread: unreadMessages.length,
    });
  } catch (error) {
    console.error("[internal-chat][GET]", error);
    return NextResponse.json({ error: "Falha ao carregar o chat" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { peer?: string; message?: string };
    const context = await resolveContext(body.peer);
    if ("error" in context) return context.error;
    if (!context.peer) return NextResponse.json({ error: "Destinatário obrigatório" }, { status: 400 });

    const message = String(body.message ?? "").trim();
    if (!message || message.length > 4000) {
      return NextResponse.json({ error: "Mensagem vazia ou muito longa" }, { status: 400 });
    }

    const conversation = await ensureConversation(context.me.id, context.peer.id);
    const response = await supabaseAdminFetch("chat_messages?select=id,conversation_id,sender_user_id,recipient_user_id,body,created_at,read_at", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        conversation_id: conversation.id,
        sender_user_id: context.me.id,
        recipient_user_id: context.peer.id,
        body: message,
      }),
    });
    const rows = (await response.json()) as ChatMessage[];
    return NextResponse.json({ message: rows[0] }, { status: 201 });
  } catch (error) {
    console.error("[internal-chat][POST]", error);
    return NextResponse.json({ error: "Falha ao enviar a mensagem" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = (await request.json()) as { peer?: string };
    const context = await resolveContext(body.peer);
    if ("error" in context) return context.error;
    if (!context.peer) return NextResponse.json({ error: "Destinatário obrigatório" }, { status: 400 });

    const conversation = await getConversationBetween(context.me.id, context.peer.id);
    if (!conversation) return NextResponse.json({ ok: true });

    await supabaseAdminFetch(
      `chat_messages?conversation_id=eq.${conversation.id}&recipient_user_id=eq.${context.me.id}&sender_user_id=eq.${context.peer.id}&read_at=is.null`,
      {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ read_at: new Date().toISOString() }),
      },
    );
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[internal-chat][PATCH]", error);
    return NextResponse.json({ error: "Falha ao atualizar leitura" }, { status: 500 });
  }
}
