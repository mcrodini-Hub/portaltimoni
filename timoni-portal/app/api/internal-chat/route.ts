import { NextRequest, NextResponse } from "next/server";
import { INTERNAL_CHAT_PARTICIPANTS, ensureConversation, getConversationBetween, getDbUserByEmail, requireInternalChatSession, supabaseAdminFetch, type ChatMessage } from "@/lib/internal-chat";
import { normalizeEmail } from "@/lib/access-control";

export const dynamic = "force-dynamic";

async function context(peerEmail?: string | null) {
  const authorized = await requireInternalChatSession();
  if (!authorized) return null;
  const me = await getDbUserByEmail(authorized.email);
  if (!me) return null;
  if (!peerEmail) return { authorized, me, peer: null };
  const email = normalizeEmail(peerEmail);
  if (!INTERNAL_CHAT_PARTICIPANTS.some((p) => p.email === email) || email === authorized.email) return null;
  const peer = await getDbUserByEmail(email);
  return peer ? { authorized, me, peer } : null;
}

export async function GET(request: NextRequest) {
  try {
    const ctx = await context(request.nextUrl.searchParams.get("peer"));
    if (!ctx) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    if (ctx.peer) {
      const conversation = await getConversationBetween(ctx.me.id, ctx.peer.id);
      if (!conversation) return NextResponse.json({ currentUserId: ctx.me.id, conversationId: null, messages: [] });
      const res = await supabaseAdminFetch(`chat_messages?conversation_id=eq.${conversation.id}&select=id,conversation_id,sender_user_id,recipient_user_id,body,created_at,read_at&order=created_at.asc&limit=300`);
      return NextResponse.json({ currentUserId: ctx.me.id, conversationId: conversation.id, messages: await res.json() });
    }

    const convRes = await supabaseAdminFetch(`chat_conversations?or=(user_a.eq.${ctx.me.id},user_b.eq.${ctx.me.id})&select=id,user_a,user_b`);
    const conversations = await convRes.json() as Array<{ id: string }>;
    let unread: ChatMessage[] = [];
    if (conversations.length) {
      const ids = conversations.map((c) => c.id).join(",");
      const unreadRes = await supabaseAdminFetch(`chat_messages?conversation_id=in.(${ids})&recipient_user_id=eq.${ctx.me.id}&read_at=is.null&select=id,conversation_id,sender_user_id,recipient_user_id,body,created_at,read_at`);
      unread = await unreadRes.json() as ChatMessage[];
    }
    const usersRes = await supabaseAdminFetch("chat_users?select=id,email,name&active=eq.true");
    const users = await usersRes.json() as Array<{ id: string; email: string }>;
    const idsByEmail = new Map(users.map((u) => [normalizeEmail(u.email), u.id]));
    const counts = new Map<string, number>();
    unread.forEach((m) => counts.set(m.sender_user_id, (counts.get(m.sender_user_id) ?? 0) + 1));
    const contacts = INTERNAL_CHAT_PARTICIPANTS.filter((p) => p.email !== ctx.authorized.email).map((p) => ({ ...p, unread: counts.get(idsByEmail.get(p.email) ?? "") ?? 0 }));
    return NextResponse.json({ currentUser: { email: ctx.authorized.email, name: ctx.me.name }, contacts, totalUnread: unread.length });
  } catch (error) {
    console.error("[internal-chat][GET]", error);
    return NextResponse.json({ error: "Falha ao carregar o chat" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as { peer?: string; message?: string };
    const ctx = await context(body.peer);
    if (!ctx?.peer) return NextResponse.json({ error: "Destinatário inválido" }, { status: 400 });
    const message = String(body.message ?? "").trim();
    if (!message || message.length > 4000) return NextResponse.json({ error: "Mensagem inválida" }, { status: 400 });
    const conversation = await ensureConversation(ctx.me.id, ctx.peer.id);
    const res = await supabaseAdminFetch("chat_messages?select=id,conversation_id,sender_user_id,recipient_user_id,body,created_at,read_at", { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify({ conversation_id: conversation.id, sender_user_id: ctx.me.id, recipient_user_id: ctx.peer.id, body: message }) });
    const rows = await res.json();
    return NextResponse.json({ message: rows[0] }, { status: 201 });
  } catch (error) {
    console.error("[internal-chat][POST]", error);
    return NextResponse.json({ error: "Falha ao enviar a mensagem" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json() as { peer?: string };
    const ctx = await context(body.peer);
    if (!ctx?.peer) return NextResponse.json({ error: "Destinatário inválido" }, { status: 400 });
    const conversation = await getConversationBetween(ctx.me.id, ctx.peer.id);
    if (!conversation) return NextResponse.json({ ok: true });
    await supabaseAdminFetch(`chat_messages?conversation_id=eq.${conversation.id}&recipient_user_id=eq.${ctx.me.id}&sender_user_id=eq.${ctx.peer.id}&read_at=is.null`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ read_at: new Date().toISOString() }) });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[internal-chat][PATCH]", error);
    return NextResponse.json({ error: "Falha ao atualizar leitura" }, { status: 500 });
  }
}
