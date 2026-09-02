import { auth } from "@/lib/auth";
import { hasModuleAccess } from "@/lib/access-control";
import {
  clearStoredTrelloCredentials,
  getStoredTrelloCredentials,
  persistTrelloCredentials,
  TRELLO_API_KEY,
  validateTrelloCredentials,
} from "@/lib/trello";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function authorize() {
  const session = await auth();
  if (!session?.user?.email) {
    return {
      response: NextResponse.json(
        { error: "Sessão expirada. Entre novamente no Portal." },
        { status: 401 },
      ),
      session: null,
    };
  }
  if (!hasModuleAccess(session.user.email, "compras", session.portalUser)) {
    return {
      response: NextResponse.json(
        { error: "Acesso não autorizado ao módulo Compras." },
        { status: 403 },
      ),
      session: null,
    };
  }
  return { response: null, session };
}

export async function GET() {
  const { response: unauthorized } = await authorize();
  if (unauthorized) return unauthorized;
  const credentials = await getStoredTrelloCredentials();
  return NextResponse.json(
    { configured: Boolean(credentials) },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(request: Request) {
  const { response: unauthorized, session } = await authorize();
  if (unauthorized || !session) return unauthorized!;

  try {
    const body = (await request.json()) as { token?: string; key?: string };
    const token = body.token?.trim();
    const key = body.key?.trim() || TRELLO_API_KEY;

    if (!token) {
      return NextResponse.json(
        { error: "Cole a chave de conexão do Trello." },
        { status: 400 },
      );
    }

    const credentials = { key, token };
    const board = await validateTrelloCredentials(credentials);
    const { cloudSaved } = await persistTrelloCredentials(credentials, session.accessToken);

    return NextResponse.json({
      ok: true,
      boardName: board.name,
      persistent: cloudSaved,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? `O Trello não aceitou a chave: ${error.message}`
            : "Não foi possível validar o Trello.",
      },
      { status: 400 },
    );
  }
}

export async function DELETE() {
  const { response: unauthorized, session } = await authorize();
  if (unauthorized || !session) return unauthorized!;

  await clearStoredTrelloCredentials(session.accessToken);
  return NextResponse.json({ ok: true });
}
