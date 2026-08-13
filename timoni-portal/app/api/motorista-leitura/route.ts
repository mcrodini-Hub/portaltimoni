import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const WEBAPP_URL =
  "https://script.google.com/macros/s/AKfycbwy9QfpEbdGtTIiC2OFuZAUx0jIPFsXPLZKedfGp79VJ6mlzLYus_wjI2IvFPoeE6Pc/exec";
const REQUEST_TIMEOUT_MS = 30_000;

async function encaminhar(url: string, init: RequestInit) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const resposta = await fetch(url, {
      ...init,
      redirect: "follow",
      cache: "no-store",
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        ...(init.headers || {}),
      },
    });
    const texto = await resposta.text();
    return new NextResponse(texto, {
      status: resposta.status,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store, max-age=0",
      },
    });
  } catch (erro) {
    const mensagem =
      erro instanceof Error && erro.name === "AbortError"
        ? "A agenda demorou demais para responder."
        : "Não foi possível acessar a agenda.";
    return NextResponse.json({ ok: false, erro: mensagem }, { status: 502 });
  } finally {
    clearTimeout(timeout);
  }
}

export async function GET(request: NextRequest) {
  const action = request.nextUrl.searchParams.get("action");
  if (action !== "dia") {
    return NextResponse.json({ ok: false, erro: "Consulta não permitida." }, { status: 400 });
  }

  const destino = new URL(WEBAPP_URL);
  request.nextUrl.searchParams.forEach((valor, chave) => destino.searchParams.set(chave, valor));
  return encaminhar(destino.toString(), { method: "GET" });
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const id = typeof body?.id === "string" ? body.id.trim() : "";
  if (!id) {
    return NextResponse.json({ ok: false, erro: "Viagem não informada." }, { status: 400 });
  }

  const notasJson = JSON.stringify({
    status: "concluida",
    concluidoEm: new Date().toISOString(),
  });
  const payload = new URLSearchParams({ action: "atualizar", id, notasJson });

  return encaminhar(WEBAPP_URL, {
    method: "POST",
    body: payload.toString(),
    headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
  });
}
