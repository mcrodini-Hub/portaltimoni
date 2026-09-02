import { auth } from "@/lib/auth";
import { hasModuleAccess } from "@/lib/access-control";
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

  if (!hasModuleAccess(session.user.email, "conferencia", session.portalUser)) {
    return NextResponse.json(
      { error: "Acesso não autorizado a este módulo." },
      { status: 403 },
    );
  }

  return null;
}

export async function GET() {
  const unauthorized = await authorize();
  if (unauthorized) return unauthorized;

  const cookieStore = await cookies();
  const serverConfigured = Boolean(
    process.env.GEMINI_API_KEY?.trim() ||
      process.env.GOOGLE_AI_STUDIO_API_KEY?.trim(),
  );
  const browserConfigured = Boolean(
    cookieStore.get("timoni_gemini_key")?.value?.trim(),
  );

  return NextResponse.json(
    {
      configured: serverConfigured || browserConfigured,
      source: serverConfigured ? "server" : browserConfigured ? "browser" : "none",
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(request: Request) {
  const unauthorized = await authorize();
  if (unauthorized) return unauthorized;

  try {
    const body = (await request.json()) as { apiKey?: string };
    const apiKey = body.apiKey?.trim();
    if (!apiKey) {
      return NextResponse.json(
        { error: "Cole a chave do Google AI Studio." },
        { status: 400 },
      );
    }

    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models",
      {
        headers: { "x-goog-api-key": apiKey },
        cache: "no-store",
      },
    );

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message =
        (payload as { error?: { message?: string } })?.error?.message ||
        "A chave não foi aceita pelo Google AI Studio.";
      return NextResponse.json({ error: message }, { status: 400 });
    }

    const cookieStore = await cookies();
    cookieStore.set("timoni_gemini_key", apiKey, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Não foi possível salvar a configuração.",
      },
      { status: 400 },
    );
  }
}

export async function DELETE() {
  const unauthorized = await authorize();
  if (unauthorized) return unauthorized;

  const cookieStore = await cookies();
  cookieStore.set("timoni_gemini_key", "", {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });

  return NextResponse.json({ ok: true });
}
