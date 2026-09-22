import { auth } from "@/lib/auth";
import { hasModuleAccess } from "@/lib/access-control";
import { getStoredTrelloCredentials, normalizeTrelloText, trelloFetch, TRELLO_BOARD_SHORT_LINK } from "@/lib/trello";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type TrelloList = { id: string; name: string; closed?: boolean };
type TrelloCard = { id: string; name: string; idList?: string; url?: string; closed?: boolean; isTemplate?: boolean };
type TrelloBoard = { lists?: TrelloList[] };

function hasAllTokens(value: string, tokens: string[]) {
  const normalized = normalizeTrelloText(value);
  return tokens.every((token) => normalized.includes(token));
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "Sessão expirada." }, { status: 401 });
  if (!hasModuleAccess(session.user.email, "estoque-rotativo", session.portalUser)) return NextResponse.json({ error: "Acesso não autorizado ao Estoque Rotativo." }, { status: 403 });
  const credentials = await getStoredTrelloCredentials();
  if (!credentials) return NextResponse.json({ configured: false, suppliers: [] }, { headers: { "Cache-Control": "no-store" } });
  try {
    const board = await trelloFetch<TrelloBoard>(`/boards/${TRELLO_BOARD_SHORT_LINK}`, {
      credentials,
      params: { fields: "name", lists: "open", list_fields: "name,closed" },
    });
    const target = (board.lists || []).find(
      (list) => !list.closed && hasAllTokens(list.name, ["estoque", "rotativo", "lucas", "carol"]),
    );
    const cards = target
      ? await trelloFetch<TrelloCard[]>(`/lists/${target.id}/cards`, {
          credentials,
          params: { fields: "name,url,closed,isTemplate", filter: "all" },
        })
      : [];
    const suppliers = cards
      .filter((card) => !card.closed)
      .map((card) => ({ id: card.id, name: card.name, url: card.url || "", isTemplate: Boolean(card.isTemplate) }));
    return NextResponse.json({ configured: true, listName: target?.name || null, suppliers }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ configured: true, suppliers: [], error: error instanceof Error ? error.message : "Não foi possível ler a lista ESTOQUE ROTATIVO LUCAS/CAROL." }, { status: 502 });
  }
}
