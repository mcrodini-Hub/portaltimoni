import { auth } from "@/lib/auth";
import { hasModuleAccess } from "@/lib/access-control";
import { syncPortalTrelloDocs } from "@/lib/portal-trello-docs";
import {
  getStoredTrelloCredentials,
  normalizeTrelloText,
  trelloFetch,
  TRELLO_BOARD_SHORT_LINK,
} from "@/lib/trello";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface TrelloList {
  id: string;
  name: string;
  closed?: boolean;
}

interface TrelloLabel {
  id: string;
  name: string;
  color?: string;
}

interface TrelloCard {
  id: string;
  name: string;
  idList: string;
  labels?: TrelloLabel[];
  url?: string;
  dateLastActivity?: string;
  start?: string | null;
  due?: string | null;
  closed?: boolean;
}

function sentOrder(card: TrelloCard, unit: "rio_claro" | "araras") {
  return {
    id: card.id,
    nome: card.name,
    url: card.url || "",
    enviadoEm: card.start || "",
    previsaoEntrega: card.due || "",
    unidade: unit,
  };
}

function cardTimestamp(card: TrelloCard) {
  const sentAt = Date.parse(card.start || "");
  if (Number.isFinite(sentAt)) return sentAt;
  const activityAt = Date.parse(card.dateLastActivity || "");
  if (Number.isFinite(activityAt)) return activityAt;
  return cardCreatedAt(card);
}

function uniqueSentCards(cards: TrelloCard[]) {
  const unique = new Map<string, TrelloCard>();
  for (const card of [...cards].sort((a, b) => cardTimestamp(b) - cardTimestamp(a))) {
    const key = normalizeTrelloText(card.name);
    if (!unique.has(key)) unique.set(key, card);
  }
  return [...unique.values()];
}

interface TrelloBoard {
  id: string;
  name: string;
  lists?: TrelloList[];
  cards?: TrelloCard[];
  labels?: TrelloLabel[];
}

async function authorize() {
  const session = await auth();
  if (!session?.user?.email) {
    return {
      response: NextResponse.json(
        { error: "Sessão expirada. Entre novamente no Portal." },
        { status: 401 },
      ),
    };
  }
  if (!hasModuleAccess(session.user.email, "compras", session.portalUser)) {
    return {
      response: NextResponse.json(
        { error: "Acesso não autorizado ao módulo Compras." },
        { status: 403 },
      ),
    };
  }
  return { response: null };
}

function hasAllTokens(value: string, tokens: string[]) {
  const normalized = normalizeTrelloText(value);
  return tokens.every((token) => normalized.includes(token));
}

function cardCreatedAt(card: TrelloCard) {
  if (/^[0-9a-f]{24}$/i.test(card.id)) {
    return parseInt(card.id.slice(0, 8), 16) * 1000;
  }
  const fallback = Date.parse(card.dateLastActivity || "");
  return Number.isFinite(fallback) ? fallback : Number.MAX_SAFE_INTEGER;
}

function labelNames(card: TrelloCard) {
  return (card.labels || []).map((label) => normalizeTrelloText(label.name || ""));
}

export async function GET() {
  const { response: unauthorized } = await authorize();
  if (unauthorized) return unauthorized;

  const credentials = await getStoredTrelloCredentials();
  if (!credentials) {
    return NextResponse.json(
      { configured: false },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  let portalDocsSync: Awaited<ReturnType<typeof syncPortalTrelloDocs>> | { error: string } | null = null;
  try {
    portalDocsSync = await syncPortalTrelloDocs(credentials);
  } catch (error) {
    portalDocsSync = {
      error: error instanceof Error ? error.message : "Não foi possível sincronizar a documentação do Portal Timoni.",
    };
  }

  try {
    const board = await trelloFetch<TrelloBoard>(`/boards/${TRELLO_BOARD_SHORT_LINK}`, {
      params: {
        fields: "name",
        lists: "open",
        list_fields: "name,closed",
        cards: "open",
        card_fields: "name,idList,labels,url,dateLastActivity,start,due,closed",
        labels: "all",
        label_fields: "name,color",
      },
    });

    const lists = (board.lists || []).filter((list) => !list.closed);
    const cards = (board.cards || []).filter((card) => !card.closed);
    const pendingList = lists.find((list) =>
      hasAllTokens(list.name, ["pedidos", "pendentes"]),
    );
    const sentRioClaroList = lists.find((list) =>
      hasAllTokens(list.name, ["pedidos", "enviado", "rio", "claro"]),
    );
    const sentArarasList = lists.find((list) =>
      hasAllTokens(list.name, ["pedidos", "enviado", "araras"]),
    );

    const pendingCards = pendingList
      ? cards.filter((card) => card.idList === pendingList.id)
      : [];
    const sentRioClaro = uniqueSentCards(sentRioClaroList
      ? cards.filter((card) => card.idList === sentRioClaroList.id)
      : []);
    const sentAraras = uniqueSentCards(sentArarasList
      ? cards.filter((card) => card.idList === sentArarasList.id)
      : []);

    const suppliers = pendingCards
      .map((card) => {
        const labels = labelNames(card);
        const urgent = labels.some((label) => label.includes("urgente"));
        const rioClaro = labels.some((label) => label.includes("rio claro"));
        const araras = labels.some((label) => label.includes("araras"));
        return {
          id: card.id,
          name: card.name,
          url: card.url || "",
          urgent,
          unit: araras ? "araras" : rioClaro ? "rio_claro" : "nao_informada",
          labels: (card.labels || []).map((label) => ({
            id: label.id,
            name: label.name,
            color: label.color || "",
          })),
          createdAt: cardCreatedAt(card),
        };
      })
      .sort((a, b) => {
        if (a.urgent !== b.urgent) return a.urgent ? -1 : 1;
        if (a.unit !== b.unit) {
          if (a.unit === "rio_claro") return -1;
          if (b.unit === "rio_claro") return 1;
        }
        return a.createdAt - b.createdAt;
      });

    return NextResponse.json(
      {
        configured: true,
        boardName: board.name,
        summary: {
          pedidosParaFazer: pendingCards.length,
          urgentes: suppliers.filter((supplier) => supplier.urgent).length,
          enviadosRioClaro: sentRioClaro.length,
          enviadosAraras: sentAraras.length,
        },
        suppliers,
        pedidosEnviados: {
          rio_claro: sentRioClaro.map((card) => sentOrder(card, "rio_claro")),
          araras: sentAraras.map((card) => sentOrder(card, "araras")),
        },
        destinations: {
          rio_claro: sentRioClaroList?.id || null,
          araras: sentArarasList?.id || null,
        },
        portalDocsSync,
        updatedAt: new Date().toISOString(),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return NextResponse.json(
      {
        configured: true,
        portalDocsSync,
        error:
          error instanceof Error
            ? `Não foi possível ler o Trello: ${error.message}`
            : "Não foi possível ler o Trello.",
      },
      { status: 502 },
    );
  }
}
