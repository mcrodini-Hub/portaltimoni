import { auth } from "@/lib/auth";
import { hasModuleAccess } from "@/lib/access-control";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function authorize() {
  const session = await auth();
  if (!session?.user?.email) {
    return {
      error: NextResponse.json(
        { error: "Sessão expirada. Entre novamente no Portal." },
        { status: 401 },
      ),
    };
  }
  if (!hasModuleAccess(session.user.email, "conferencia")) {
    return {
      error: NextResponse.json(
        { error: "Acesso não autorizado a este módulo." },
        { status: 403 },
      ),
    };
  }
  return { error: null };
}

export async function GET() {
  const authorization = await authorize();
  if (authorization.error) return authorization.error;

  const cookieStore = await cookies();
  return NextResponse.json(
    { configured: Boolean(cookieStore.get("timoni_gemini_key")?.value) },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(request: Request) {
  const authorization = await authorize();
  if (authorization.error) return authorization.error;

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
      maxAge: 60 * 60 * 24 * 30,
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
  const authorization = await authorize();
  if (authorization.error) return authorization.error;

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
