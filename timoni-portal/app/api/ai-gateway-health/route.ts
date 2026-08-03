import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const envKey = process.env.AI_GATEWAY_API_KEY;
  const envOidc = process.env.VERCEL_OIDC_TOKEN;
  const headerOidc = request.headers.get("x-vercel-oidc-token");
  const token = envKey || envOidc || headerOidc;
  const source = envKey ? "api-key" : envOidc ? "env-oidc" : headerOidc ? "header-oidc" : "none";

  if (!token) {
    return NextResponse.json(
      { ok: false, source, error: "Nenhuma credencial do AI Gateway foi disponibilizada à função." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    const response = await fetch("https://ai-gateway.vercel.sh/v1/credits", {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });

    const payload = await response.json().catch(() => ({}));
    const balance = Number((payload as { balance?: string | number }).balance);

    return NextResponse.json(
      {
        ok: response.ok,
        source,
        gatewayStatus: response.status,
        hasCredits: Number.isFinite(balance) ? balance > 0 : null,
        error: response.ok
          ? null
          : (payload as { error?: { message?: string }; message?: string }).error?.message ||
            (payload as { message?: string }).message ||
            "Falha ao autenticar no AI Gateway.",
      },
      { status: response.ok ? 200 : 502, headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        source,
        error: error instanceof Error ? error.message : "Falha inesperada no teste do AI Gateway.",
      },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  }
}
