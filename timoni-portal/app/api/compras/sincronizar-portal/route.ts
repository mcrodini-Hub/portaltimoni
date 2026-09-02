import { auth } from "@/lib/auth";
import { hasModuleAccess } from "@/lib/access-control";
import { getStoredTrelloCredentials } from "@/lib/trello";
import { syncPortalTrelloDocs } from "@/lib/portal-trello-docs";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  const email = session?.user?.email;

  if (!email) {
    return NextResponse.json(
      { ok: false, error: "Sessão expirada. Entre novamente no Portal Timoni." },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }

  if (!hasModuleAccess(email, "compras", session.portalUser)) {
    return NextResponse.json(
      { ok: false, error: "Acesso não autorizado ao módulo Compras." },
      { status: 403, headers: { "Cache-Control": "no-store" } },
    );
  }

  const credentials = await getStoredTrelloCredentials();
  if (!credentials) {
    return NextResponse.json(
      {
        ok: false,
        error: "O Trello não está configurado neste navegador. Abra primeiro o módulo Compras no Chrome onde a conexão já funciona.",
      },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    const result = await syncPortalTrelloDocs(credentials);
    return NextResponse.json(
      { ok: true, ...result },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Falha ao sincronizar o Trello Portal Timoni.",
      },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  }
}
