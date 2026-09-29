import { getToken } from "next-auth/jwt";
import { NextResponse } from "next/server";
import { AUTH_SECRET } from "@/lib/auth";
import { getPortalConfigurationRevision } from "@/lib/portal-config-revision";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const token = await getToken({
    req: request,
    secret: AUTH_SECRET,
    secureCookie: process.env.NODE_ENV === "production",
  });
  if (!token?.email) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  try {
    const currentRevision = await getPortalConfigurationRevision();
    const sessionRevision = String(token.portalConfigRevision || "");
    return NextResponse.json(
      { revision: currentRevision, sessionRevision },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("[configuracoes/version][GET]", error);
    return NextResponse.json({ error: "Não foi possível verificar alterações." }, { status: 503 });
  }
}
