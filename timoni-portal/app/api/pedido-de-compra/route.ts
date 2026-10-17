import { auth } from "@/lib/auth";
import { getEffectivePortalUser } from "@/lib/portal-config";
import { hasModuleAccess } from "@/lib/access-control";
import { normalizeTrelloText, trelloFetch, TRELLO_BOARD_SHORT_LINK } from "@/lib/trello";
import { google } from "googleapis";
import { NextResponse } from "next/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const SPREADSHEET_ID = "1cESMTRx98e6AbY5vxPCcT7VrqYAbgH0xGUk87ybqHUo";
const SENT_ORDERS_CACHE_RANGE = "Necessidades!Q:W";

type SentOrder = {
  id: string;
  nome: string;
  enviadoEm: string;
  previsaoEntrega: string;
  recebidoEm: string;
  unidade: "rio_claro" | "araras";
  situacao: "enviado" | "recebido";
};
type TrelloList = { id: string; name: string; closed?: boolean };
type TrelloBoard = { lists?: TrelloList[]; cards?: TrelloCard[] };
type TrelloCard = {
  id: string;
  name: string;
  idList: string;
  start?: string | null;
  due?: string | null;
  dateLastActivity?: string | null;
  closed?: boolean;
};

function value(row: unknown[], index: number) {
  const current = row[index];
  return current === null || current === undefined ? "" : String(current);
}

function rowsToCachedOrders(rows: unknown[][]): SentOrder[] {
  return rows
    .slice(1)
    .map((row) => ({
      id: value(row, 0),
      nome: value(row, 1),
      enviadoEm: value(row, 2),
      previsaoEntrega: value(row, 3),
      recebidoEm: value(row, 4),
      unidade: value(row, 5) === "araras" ? "araras" as const : "rio_claro" as const,
      situacao: value(row, 6) === "recebido" ? "recebido" as const : "enviado" as const,
    }))
    .filter((order) => Boolean(order.id && order.nome))
    .filter((order) => order.situacao === "enviado");
}

function hasAllTokens(value: string, tokens: string[]) {
  const normalized = normalizeTrelloText(value);
  return tokens.every((token) => normalized.includes(token));
}

function dedupeOrders(orders: SentOrder[]) {
  const unique = new Map<string, SentOrder>();
  const prioritized = [...orders].sort((a, b) => {
    const aTime = new Date(a.enviadoEm || a.recebidoEm || "").getTime();
    const bTime = new Date(b.enviadoEm || b.recebidoEm || "").getTime();
    return (Number.isNaN(bTime) ? 0 : bTime) - (Number.isNaN(aTime) ? 0 : aTime);
  });
  for (const order of prioritized) {
    const key = `${normalizeTrelloText(order.nome)}|${order.unidade}`;
    if (!unique.has(key)) unique.set(key, order);
  }
  return [...unique.values()];
}

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

function isWithinLast30Days(value: string) {
  if (!value) return false;
  const time = new Date(value).getTime();
  if (Number.isNaN(time)) return false;
  return time >= Date.now() - THIRTY_DAYS_MS;
}

function sortOrders(orders: SentOrder[]) {
  return dedupeOrders(orders)
    .filter((order) => isWithinLast30Days(order.enviadoEm))
    .sort((a, b) => {
    const aTime = new Date(a.enviadoEm || a.recebidoEm || "").getTime();
    const bTime = new Date(b.enviadoEm || b.recebidoEm || "").getTime();
    const safeATime = Number.isNaN(aTime) ? 0 : aTime;
    const safeBTime = Number.isNaN(bTime) ? 0 : bTime;
      if (safeATime !== safeBTime) return safeBTime - safeATime;
      return a.nome.localeCompare(b.nome, "pt-BR");
    });
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
            recebidoEm: "",
            unidade,
            situacao: "enviado" as const,
          }))
      : [];

  return sortOrders([
    ...toOrders(sentRioClaroList, "rio_claro"),
    ...toOrders(sentArarasList, "araras"),
  ]);
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ ok: false, error: "Sessão expirada. Entre novamente no Portal." }, { status: 401 });
  try {
    const portalUser = await getEffectivePortalUser(session.accessToken, session.user.email);
    if (!hasModuleAccess(session.user.email, "pedido-de-compra", portalUser)) return NextResponse.json({ ok: false, error: "Acesso não autorizado a Pedidos de Compra." }, { status: 403 });
    let pedidosEnviados: SentOrder[];
    try {
      pedidosEnviados = await readSentOrders();
      // O painel apenas lê; a manutenção do cache pertence ao processo em background.
    } catch (error) {
      if (!session.accessToken || session.error === "RefreshAccessTokenError") throw error;
      const oauth = new google.auth.OAuth2();
      oauth.setCredentials({ access_token: session.accessToken });
      const sheets = google.sheets({ version: "v4", auth: oauth });
      const response = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: SENT_ORDERS_CACHE_RANGE, valueRenderOption: "FORMATTED_VALUE" });
      pedidosEnviados = sortOrders(rowsToCachedOrders((response.data.values || []) as unknown[][]));
    }
    return NextResponse.json({ ok: true, pedidosEnviados }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Falha ao carregar os pedidos." }, { status: 502 }); }
}

