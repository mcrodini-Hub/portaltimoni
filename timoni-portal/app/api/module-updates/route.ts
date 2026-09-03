import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  isUpdateModule,
  listPendingModuleUpdates,
  markModuleUpdatesRead,
  recordModuleUpdateSafely,
} from "@/lib/module-updates";
import { listTeamMessages } from "@/lib/espaco-equipe";
import { listAvisoLeituras } from "@/lib/aviso-leituras";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MANAGEMENT_EMAILS = new Set(["mcrodini@gmail.com", "mrodini@gmail.com"]);

async function managementSession() {
  const session = await auth();
  if (!session?.user?.email) return null;
  const email = session.user.email.trim().toLowerCase();
  return MANAGEMENT_EMAILS.has(email) ? { session, email } : null;
}

export async function GET() {
  const current = await managementSession();
  if (!current) {
    return NextResponse.json({ error: "Acesso exclusivo da gestão." }, { status: 403 });
  }

  try {
    const [messages, noticeReads] = await Promise.all([
      listTeamMessages(current.session.accessToken),
      listAvisoLeituras(current.session.accessToken ?? ""),
    ]);
    await Promise.all([
      ...messages
        .filter((item) => (item.status || "Novo").toLowerCase() === "novo")
        .map((item) => recordModuleUpdateSafely(
          "espaco-equipe",
          "colaborador",
          "Nova mensagem anônima recebida.",
          `espaco-equipe:${item.date}`,
        )),
      ...noticeReads.slice(0, 200).map((read) => recordModuleUpdateSafely(
        "avisos",
        read.portalEmail || "colaborador",
        `${read.employee} confirmou a leitura de ${read.title || "um aviso"}.`,
        `aviso-leitura:${read.avisoId}:${read.unit}:${read.employee}`,
      )),
    ]);
    return NextResponse.json(
      { ok: true, updates: await listPendingModuleUpdates(current.email) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("[module-updates][GET]", error);
    return NextResponse.json({ error: "Não foi possível carregar as atualizações." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const current = await managementSession();
  if (!current) {
    return NextResponse.json({ error: "Acesso exclusivo da gestão." }, { status: 403 });
  }

  try {
    const body = await request.json();
    if (!isUpdateModule(body?.module)) {
      return NextResponse.json({ error: "Módulo inválido." }, { status: 400 });
    }
    await markModuleUpdatesRead(body.module, String(body?.through || ""), current.email);
    return NextResponse.json({ ok: true, readAt: new Date().toISOString() });
  } catch (error) {
    console.error("[module-updates][POST]", error);
    return NextResponse.json({ error: "Não foi possível confirmar a leitura." }, { status: 500 });
  }
}
