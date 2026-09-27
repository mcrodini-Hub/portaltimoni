import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Summary = {
  compras: number | null;
  solicitacoes: number | null;
  agenda: number | null;
  motorista: number | null;
  equipe: number | null;
  leads: number | null;
  estoqueRotativo: number | null;
};

type NotificationItem = { type?: string };
type CalendarEvent = { completed?: boolean };

function requestedModules(request: NextRequest) {
  return new Set(
    (request.nextUrl.searchParams.get("modules") || "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean),
  );
}

async function readJson(request: NextRequest, path: string) {
  const target = new URL(path, request.url);
  const cookie = request.headers.get("cookie") || "";
  const response = await fetch(target, {
    cache: "no-store",
    headers: cookie ? { cookie } : undefined,
  });
  if (!response.ok) throw new Error(`${target.pathname} respondeu ${response.status}`);
  return response.json();
}

export async function GET(request: NextRequest) {
  const modules = requestedModules(request);
  const equipe = request.nextUrl.searchParams.get("equipe") === "1";
  const timeMin = request.nextUrl.searchParams.get("timeMin") || "";
  const timeMax = request.nextUrl.searchParams.get("timeMax") || "";
  const today = request.nextUrl.searchParams.get("today") || "";

  const summary: Summary = {
    compras: null,
    solicitacoes: null,
    agenda: null,
    motorista: null,
    equipe: null,
    leads: null,
    estoqueRotativo: null,
  };

  const tasks = {
    compras: modules.has("compras")
      ? readJson(request, "/api/compras?summary=1")
      : null,
    solicitacoes: modules.has("estoque")
      ? readJson(request, "/api/painel-notifications?stockOnly=1")
      : null,
    agenda: modules.has("agenda") && timeMin && timeMax
      ? readJson(request, `/api/events?timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}`)
      : null,
    motorista: modules.has("motorista") && today
      ? readJson(request, `/api/motorista-leitura?action=dia&data=${encodeURIComponent(today)}`)
      : null,
    equipe: equipe
      ? readJson(request, "/api/espaco-equipe")
      : null,
    leads: modules.has("leads")
      ? readJson(request, "/api/leads?summary=1")
      : null,
    rotativo: modules.has("estoque-rotativo")
      ? readJson(request, "/api/estoque-rotativo/resumo")
      : null,
  };

  const entries = Object.entries(tasks).filter((entry): entry is [string, Promise<unknown>] => Boolean(entry[1]));
  const settled = await Promise.allSettled(entries.map(([, task]) => task));
  const values = new Map<string, unknown>();

  settled.forEach((result, index) => {
    if (result.status === "fulfilled") values.set(entries[index][0], result.value);
  });

  const compras = values.get("compras") as { summary?: { pedidosParaFazer?: number } } | undefined;
  if (compras) summary.compras = compras.summary?.pedidosParaFazer ?? 0;

  const notifications = values.get("solicitacoes") as { items?: NotificationItem[] } | undefined;
  if (notifications) summary.solicitacoes = (notifications.items ?? []).filter((item) => item.type === "estoque").length;

  const agenda = values.get("agenda") as { events?: CalendarEvent[] } | undefined;
  if (agenda) summary.agenda = (agenda.events ?? []).filter((event) => !event.completed).length;

  const motorista = values.get("motorista") as { viagens?: unknown[] } | undefined;
  if (motorista) summary.motorista = (motorista.viagens ?? []).length;

  const equipeData = values.get("equipe") as { pending?: number } | undefined;
  if (equipeData) summary.equipe = equipeData.pending ?? 0;

  const leads = values.get("leads") as { summary?: { pendentes?: number } } | undefined;
  if (leads) summary.leads = leads.summary?.pendentes ?? 0;

  const rotativo = values.get("rotativo") as { pending?: number } | undefined;
  if (rotativo) summary.estoqueRotativo = rotativo.pending ?? 0;

  return NextResponse.json(
    { ok: true, summary, updatedAt: new Date().toISOString() },
    { headers: { "Cache-Control": "no-store" } },
  );
}
