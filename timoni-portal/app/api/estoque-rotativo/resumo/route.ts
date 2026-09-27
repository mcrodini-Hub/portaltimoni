import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { hasModuleAccess } from "@/lib/access-control";
import { getRotatingStockPendingUpdateCount } from "@/lib/rotating-stock";
import { getStoredTrelloCredentials, normalizeTrelloText, trelloFetch, TRELLO_BOARD_SHORT_LINK } from "@/lib/trello";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type TrelloList = { id: string; name: string; closed?: boolean };
type TrelloCard = { closed?: boolean; dueComplete?: boolean };
type TrelloBoard = { lists?: TrelloList[] };

function hasAllTokens(value: string, tokens: string[]) {
  const normalized = normalizeTrelloText(value);
  return tokens.every((token) => normalized.includes(token));
}

async function getTrelloPendingCount() {
  const credentials = await getStoredTrelloCredentials();
  if (!credentials) return 0;

  const board = await trelloFetch<TrelloBoard>(`/boards/${TRELLO_BOARD_SHORT_LINK}`, {
    credentials,
    params: { fields: "name", lists: "open", list_fields: "name,closed" },
  });

  const target = (board.lists || []).find(
    (list) => !list.closed && hasAllTokens(list.name, ["estoque", "rotativo", "lucas", "carol"]),
  );
  if (!target) return 0;

  const cards = await trelloFetch<TrelloCard[]>(`/lists/${target.id}/cards`, {
    credentials,
    params: { fields: "closed,dueComplete", filter: "all" },
  });

  return cards.filter((card) => !card.closed && !card.dueComplete).length;
}

export async function GET() {
  const session = await auth();
  const email = session?.user?.email?.trim().toLowerCase() || "";

  if (!email) {
    return NextResponse.json({ error: "Sessão expirada." }, { status: 401 });
  }
  if (!hasModuleAccess(email, "estoque-rotativo", session.portalUser)) {
    return NextResponse.json({ error: "Acesso não autorizado ao Rotativo." }, { status: 403 });
  }

  try {
    const [registeredCount, trelloCount] = await Promise.all([
      getRotatingStockPendingUpdateCount(),
      getTrelloPendingCount(),
    ]);

    return NextResponse.json(
      {
        ok: true,
        pending: trelloCount || registeredCount,
        registeredCount,
        trelloCount,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Não foi possível carregar o resumo do Rotativo.",
      },
      { status: 502 },
    );
  }
}
