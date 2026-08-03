import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function extractError(payload: unknown) {
  const data = payload as { error?: { message?: string }; message?: string };
  return data.error?.message || data.message || "Falha no AI Gateway.";
}

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
    const url = new URL(request.url);
    const probe = url.searchParams.get("probe") === "1";

    if (probe) {
      const response = await fetch("https://ai-gateway.vercel.sh/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "anthropic/claude-sonnet-4.6",
          max_tokens: 1,
          temperature: 0,
          messages: [{ role: "user", content: "Responda apenas OK" }],
        }),
        cache: "no-store",
      });

      const payload = await response.json().catch(() => ({}));
      return NextResponse.json(
        {
          ok: response.ok,
          source,
          gatewayStatus: response.status,
          error: response.ok ? null : extractError(payload),
        },
        { status: response.ok ? 200 : 502, headers: { "Cache-Control": "no-store" } },
      );
    }

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
        error: response.ok ? null : extractError(payload),
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
