import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getPortalUser } from "@/lib/access-control";
import {
  createMeeting,
  deleteMeeting,
  listMeetings,
  updateMeeting,
  type MeetingUnit,
} from "@/lib/reunioes";

const ADMIN_EMAIL = "mcrodini@gmail.com";
const VALID_UNITS = new Set<MeetingUnit>(["Araras", "Rio Claro"]);

function normalizeEmail(value?: string | null) {
  return value?.trim().toLowerCase() || "";
}

async function getContext() {
  const session = await auth();
  const email = normalizeEmail(session?.user?.email);
  if (!email || !getPortalUser(email) || !session?.accessToken) return null;
  return { email, accessToken: session.accessToken };
}

function parseInput(body: Record<string, unknown>) {
  const input = {
    unit: String(body.unit || "") as MeetingUnit,
    date: String(body.date || ""),
    time: String(body.time || ""),
    secondDate: String(body.secondDate || ""),
    secondTime: String(body.secondTime || ""),
    frequency: String(body.frequency || "Mensal"),
    leaders: String(body.leaders || ""),
    pautaUrl: String(body.pautaUrl || ""),
    ataUrl: String(body.ataUrl || ""),
    slidesUrl: String(body.slidesUrl || ""),
  };
  if (
    !VALID_UNITS.has(input.unit) || !input.date || !input.time ||
    !input.secondDate || !input.secondTime || input.secondDate < input.date
  ) {
    throw new Error("Preencha as duas datas e horários corretamente.");
  }
  return input;
}

export async function GET() {
  const context = await getContext();
  if (!context) return NextResponse.json({ error: "Acesso não autorizado." }, { status: 401 });
  try {
    const items = await listMeetings(context.accessToken);
    return NextResponse.json({ ok: true, items, canManage: context.email === ADMIN_EMAIL });
  } catch (error) {
    console.error("[reunioes][GET]", error);
    return NextResponse.json({ error: "Não foi possível carregar as reuniões." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const context = await getContext();
  if (!context || context.email !== ADMIN_EMAIL) {
    return NextResponse.json({ error: "Acesso exclusivo da Ciça." }, { status: 403 });
  }
  try {
    const input = parseInput(await request.json());
    const id = await createMeeting(context.accessToken, input);
    return NextResponse.json({ ok: true, id });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Não foi possível criar." }, { status: 400 });
  }
}

export async function PATCH(request: Request) {
  const context = await getContext();
  if (!context || context.email !== ADMIN_EMAIL) {
    return NextResponse.json({ error: "Acesso exclusivo da Ciça." }, { status: 403 });
  }
  try {
    const body = await request.json();
    const id = String(body.id || "");
    if (!id) throw new Error("Reunião inválida.");
    if (body.action === "complete") {
      await updateMeeting(context.accessToken, id, { status: "concluida" });
    } else {
      await updateMeeting(context.accessToken, id, parseInput(body));
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Não foi possível atualizar." }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  const context = await getContext();
  if (!context || context.email !== ADMIN_EMAIL) {
    return NextResponse.json({ error: "Acesso exclusivo da Ciça." }, { status: 403 });
  }
  try {
    const body = await request.json();
    const id = String(body.id || "");
    if (!id) throw new Error("Reunião inválida.");
    await deleteMeeting(context.accessToken, id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Não foi possível excluir." }, { status: 400 });
  }
}
