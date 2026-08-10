import { auth } from "@/lib/auth";
import { hasModuleAccess } from "@/lib/access-control";
import { getStoredTrelloCredentials, TRELLO_API_KEY, validateTrelloCredentials } from "@/lib/trello";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function authorize() {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json(
      { error: "Sessão expirada. Entre novamente no Portal." },
      { status: 401 },
    );
  }
  if (!hasModuleAccess(session.user.email, "compras")) {
    return NextResponse.json(
      { error: "Acesso não autorizado ao módulo Compras." },
      { status: 403 },
    );
  }
  return null;
}

export async function GET() {
  const unauthorized = await authorize();
  if (unauthorized) return unauthorized;
  const credentials = await getStoredTrelloCredentials();
  return NextResponse.json(
    { configured: Boolean(credentials) },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(request: Request) {
  const unauthorized = await authorize();
  if (unauthorized) return unauthorized;

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

    const board = await validateTrelloCredentials({ key, token });
    const cookieStore = await cookies();
    const cookieOptions = {
      httpOnly: true,
      secure: true,
      sameSite: "lax" as const,
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    };
    cookieStore.set("timoni_trello_key", key, cookieOptions);
    cookieStore.set("timoni_trello_token", token, cookieOptions);

    return NextResponse.json({ ok: true, boardName: board.name });
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
  const unauthorized = await authorize();
  if (unauthorized) return unauthorized;

  const cookieStore = await cookies();
  const clearOptions = {
    httpOnly: true,
    secure: true,
    sameSite: "lax" as const,
    path: "/",
    maxAge: 0,
  };
  cookieStore.set("timoni_trello_key", "", clearOptions);
  cookieStore.set("timoni_trello_token", "", clearOptions);
  return NextResponse.json({ ok: true });
}
