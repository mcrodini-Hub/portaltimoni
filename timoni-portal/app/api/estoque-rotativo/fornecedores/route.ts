import { auth } from "@/lib/auth";
import { hasModuleAccess } from "@/lib/access-control";
import { getStoredTrelloCredentials, trelloFetch } from "@/lib/trello";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Lista confirmada no quadro COMPRAS. Não buscar outras listas por nome.
const ROTATIVO_LIST_ID = "68c40e2928bd40a8a2b3086b";
const ROTATIVO_LIST_NAME = "ESTOQUE ROTATIVO LUCAS/CAROL";
const headers = { "Cache-Control": "no-store, max-age=0" };

type TrelloCard = { id: string; name: string; url?: string; closed?: boolean; dueComplete?: boolean; isTemplate?: boolean };

export async function GET() {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "Sessão expirada." }, { status: 401, headers });
  if (!hasModuleAccess(session.user.email, "estoque-rotativo", session.portalUser)) return NextResponse.json({ error: "Acesso não autorizado ao Rotativo." }, { status: 403, headers });
  const credentials = await getStoredTrelloCredentials();
  if (!credentials) return NextResponse.json({ configured: false, suppliers: [] }, { headers });
  try {
    const cards = await trelloFetch<TrelloCard[]>(`/lists/${ROTATIVO_LIST_ID}/cards`, {
      credentials,
      params: { fields: "name,url,closed,dueComplete,isTemplate", filter: "open" },
    });
    const activeCards = cards.filter((card) => !card.closed);
    const mapCard = (card: TrelloCard) => ({ id: card.id, name: card.name, url: card.url || "", isTemplate: Boolean(card.isTemplate) });
    return NextResponse.json({
      configured: true,
      listId: ROTATIVO_LIST_ID,
      listName: ROTATIVO_LIST_NAME,
      suppliers: activeCards.filter((card) => !card.dueComplete).map(mapCard),
    }, { headers });
  } catch (error) {
    return NextResponse.json({ configured: true, error: error instanceof Error ? error.message : "Não foi possível ler a lista ESTOQUE ROTATIVO LUCAS/CAROL." }, { status: 502, headers });
  }
}
