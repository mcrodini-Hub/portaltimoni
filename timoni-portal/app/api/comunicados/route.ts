import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  createComunicado,
  deleteComunicado,
  listComunicados,
  updateComunicado,
  type ComunicadoUnidade,
} from "@/lib/comunicados";
import { getPortalUser } from "@/lib/access-control";

const ADMIN_EMAIL = "mcrodini@gmail.com";
const VALID_UNITS = new Set<ComunicadoUnidade>(["geral", "araras", "rio claro"]);

function normalizeEmail(value?: string | null) {
  return value?.trim().toLowerCase() ?? "";
}

async function getSessionContext() {
  const session = await auth();
  const email = normalizeEmail(session?.user?.email);
  if (!email || !getPortalUser(email)) return null;
  return { session, email, accessToken: session?.accessToken ?? "" };
}

export async function GET() {
  const context = await getSessionContext();
  if (!context) return NextResponse.json({ error: "Acesso não autorizado." }, { status: 401 });

  try {
    const items = await listComunicados(context.accessToken);
    return NextResponse.json({ ok: true, items, isAdmin: context.email === ADMIN_EMAIL });
  } catch (error) {
    console.error("[comunicados][GET]", error);
    return NextResponse.json({ error: "Não foi possível carregar os comunicados." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const context = await getSessionContext();
  if (!context || context.email !== ADMIN_EMAIL) {
    return NextResponse.json({ error: "Acesso não autorizado." }, { status: 403 });
  }

  try {
    const body = await request.json();
    const unit = String(body?.unit ?? "").trim().toLowerCase() as ComunicadoUnidade;
    const title = String(body?.title ?? "").trim();
    const message = String(body?.message ?? "").trim();
    const startsAt = String(body?.startsAt ?? "").trim();
    const expiresAt = String(body?.expiresAt ?? "").trim();
    if (expiresAt && Number.isNaN(Date.parse(expiresAt))) return NextResponse.json({ error: "Prazo final inválido." }, { status: 400 });
    if (startsAt && expiresAt && Date.parse(expiresAt) < Date.parse(startsAt)) return NextResponse.json({ error: "O prazo final deve ser posterior ao início." }, { status: 400 });
    if (!VALID_UNITS.has(unit) || title.length < 3 || message.length < 3) {
      return NextResponse.json({ error: "Preencha unidade, título e mensagem." }, { status: 400 });
    }
    const id = await createComunicado(context.accessToken, { unit, title, message, startsAt, expiresAt });
    return NextResponse.json({ ok: true, id });
  } catch (error) {
    console.error("[comunicados][POST]", error);
    return NextResponse.json({ error: "Não foi possível registrar o comunicado." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const context = await getSessionContext();
  if (!context || context.email !== ADMIN_EMAIL) {
    return NextResponse.json({ error: "Acesso não autorizado." }, { status: 403 });
  }

  try {
    const body = await request.json();
    const id = String(body?.id ?? "").trim();
    const action = String(body?.action ?? "edit");
    if (!id) return NextResponse.json({ error: "Comunicado inválido." }, { status: 400 });

    if (action === "archive") {
      await updateComunicado(context.accessToken, id, { status: "arquivado" });
      return NextResponse.json({ ok: true });
    }

    const unit = String(body?.unit ?? "").trim().toLowerCase() as ComunicadoUnidade;
    const title = String(body?.title ?? "").trim();
    const message = String(body?.message ?? "").trim();
    const startsAt = String(body?.startsAt ?? "").trim();
    const expiresAt = String(body?.expiresAt ?? "").trim();
    if (expiresAt && Number.isNaN(Date.parse(expiresAt))) return NextResponse.json({ error: "Prazo final inválido." }, { status: 400 });
    if (startsAt && expiresAt && Date.parse(expiresAt) < Date.parse(startsAt)) return NextResponse.json({ error: "O prazo final deve ser posterior ao início." }, { status: 400 });
    if (!VALID_UNITS.has(unit) || title.length < 3 || message.length < 3) {
      return NextResponse.json({ error: "Preencha unidade, título e mensagem." }, { status: 400 });
    }
    await updateComunicado(context.accessToken, id, { unit, title, message, startsAt, expiresAt });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[comunicados][PATCH]", error);
    return NextResponse.json({ error: "Não foi possível atualizar o comunicado." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const context = await getSessionContext();
  if (!context || context.email !== ADMIN_EMAIL) {
    return NextResponse.json({ error: "Acesso não autorizado." }, { status: 403 });
  }

  try {
    const body = await request.json();
    const id = String(body?.id ?? "").trim();
    if (!id) return NextResponse.json({ error: "Comunicado inválido." }, { status: 400 });
    await deleteComunicado(context.accessToken, id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[comunicados][DELETE]", error);
    return NextResponse.json({ error: "Não foi possível excluir o comunicado." }, { status: 500 });
  }
}
