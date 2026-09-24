import { auth } from "@/lib/auth";
import { hasModuleAccess } from "@/lib/access-control";
import { loadPortalConfiguration } from "@/lib/portal-config";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  const email = session?.user?.email?.trim().toLowerCase();

  if (!email || !hasModuleAccess(email, "motorista", session.portalUser)) {
    return NextResponse.json({ ok: false, error: "Acesso não autorizado." }, { status: 403 });
  }
  if (!session.accessToken) {
    return NextResponse.json({ ok: false, error: "Sessão expirada." }, { status: 401 });
  }

  try {
    const configuration = await loadPortalConfiguration(session.accessToken);
    const responsaveis = configuration.users
      .filter((user) =>
        user.active !== false &&
        user.readOnly !== true &&
        user.modules.includes("motorista")
      )
      .map((user) => ({ email: user.email, name: user.name, unit: user.unit || "Geral" }))
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" }));

    return NextResponse.json(
      { ok: true, responsaveis },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Não foi possível carregar os responsáveis." },
      { status: 500 },
    );
  }
}
