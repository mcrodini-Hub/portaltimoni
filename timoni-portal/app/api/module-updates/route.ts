import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  isUpdateModule,
  listPendingModuleUpdates,
  markModuleUpdatesRead,
  recordModuleUpdateSafely,
} from "@/lib/module-updates";
import { listTeamMessages } from "@/lib/espaco-equipe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CICA_EMAIL = "mcrodini@gmail.com";

async function cicaSession() {
  const session = await auth();
  return session?.user?.email?.trim().toLowerCase() === CICA_EMAIL ? session : null;
}

export async function GET() {
  const session = await cicaSession();
  if (!session) {
    return NextResponse.json({ error: "Acesso exclusivo da Ciça." }, { status: 403 });
  }

  try {
    const messages = await listTeamMessages(session.accessToken);
    await Promise.all(messages
      .filter((item) => (item.status || "Novo").toLowerCase() === "novo")
      .map((item) => recordModuleUpdateSafely(
        "espaco-equipe",
        "colaborador",
        "Nova mensagem anônima recebida.",
        `espaco-equipe:${item.date}`,
      )));
    return NextResponse.json(
      { ok: true, updates: await listPendingModuleUpdates() },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("[module-updates][GET]", error);
    return NextResponse.json({ error: "Não foi possível carregar as atualizações." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!(await cicaSession())) {
    return NextResponse.json({ error: "Acesso exclusivo da Ciça." }, { status: 403 });
  }

  try {
    const body = await request.json();
    if (!isUpdateModule(body?.module)) {
      return NextResponse.json({ error: "Módulo inválido." }, { status: 400 });
    }
    await markModuleUpdatesRead(body.module, String(body?.through || ""));
    return NextResponse.json({ ok: true, readAt: new Date().toISOString() });
  } catch (error) {
    console.error("[module-updates][POST]", error);
    return NextResponse.json({ error: "Não foi possível confirmar a leitura." }, { status: 500 });
  }
}
