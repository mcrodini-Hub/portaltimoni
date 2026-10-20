import { auth } from "@/lib/auth";
import { getEffectivePortalUser } from "@/lib/portal-config";
import { hasModuleAccess } from "@/lib/access-control";
import { normalizeTrelloText, trelloFetch, TRELLO_BOARD_SHORT_LINK } from "@/lib/trello";
import { normalizePurchaseOrders, readPurchaseOrdersSnapshot, savePurchaseOrdersSnapshot, type PurchaseOrder } from "@/lib/purchase-orders";
import { NextResponse } from "next/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type SentOrder = PurchaseOrder;
type TrelloList = { id: string; name: string; closed?: boolean };
type TrelloCard = { id: string; name: string; idList: string; start?: string | null; due?: string | null; closed?: boolean; dateLastActivity?: string };
type TrelloBoard = { lists?: TrelloList[]; cards?: TrelloCard[] };
function hasAllTokens(value: string, tokens: string[]) {
  const normalized = normalizeTrelloText(value);
  return tokens.every((token) => normalized.includes(token));
}
async function readSentOrders(): Promise<SentOrder[]> {
  const board = await trelloFetch<TrelloBoard>(`/boards/${TRELLO_BOARD_SHORT_LINK}`, {
    params: {
      fields: "name",
      lists: "open",
      list_fields: "name,closed",
      cards: "open",
      card_fields: "name,idList,start,due,dateLastActivity,closed",
    },
  });
  const lists = (board.lists || []).filter((list) => !list.closed);
  const cards = (board.cards || []).filter((card) => !card.closed);
  const sentRioClaroList = lists.find((list) => hasAllTokens(list.name, ["pedidos", "enviado", "rio", "claro"]));
  const sentArarasList = lists.find((list) => hasAllTokens(list.name, ["pedidos", "enviado", "araras"]));

  const toOrders = (list: TrelloList | undefined, unidade: "rio_claro" | "araras"): SentOrder[] =>
    list
      ? cards
          .filter((card) => card.idList === list.id)
          .map((card) => ({
            id: card.id,
            nome: card.name,
            enviadoEm: card.start || "",
            previsaoEntrega: card.due || "",
            unidade,
            activityAt: card.dateLastActivity,
          }))
      : [];

  return normalizePurchaseOrders([
    ...toOrders(sentRioClaroList, "rio_claro"),
    ...toOrders(sentArarasList, "araras"),
  ]);
}

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ ok: false, error: "Sessão expirada. Entre novamente no Portal." }, { status: 401 });
  try {
    const portalUser = await getEffectivePortalUser(session.accessToken, session.user.email);
    if (!hasModuleAccess(session.user.email, "pedido-de-compra", portalUser)) return NextResponse.json({ ok: false, error: "Acesso não autorizado a Pedidos de Compra." }, { status: 403 });
    const snapshot = await readPurchaseOrdersSnapshot();
    const force = new URL(request.url).searchParams.get("refresh") === "1";
    let pedidosEnviados = snapshot?.orders;
    let stale = false;
    if (!snapshot?.fresh || force) {
      const startedAt = new Date().toISOString();
      try {
        const orders = await readSentOrders();
        await savePurchaseOrdersSnapshot(orders, startedAt);
        pedidosEnviados = orders;
      } catch (error) {
        if (!snapshot) throw error;
        stale = true;
      }
    }
    return NextResponse.json({ ok: true, pedidosEnviados, stale }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Falha ao carregar os pedidos." }, { status: 502 });
  }
}
