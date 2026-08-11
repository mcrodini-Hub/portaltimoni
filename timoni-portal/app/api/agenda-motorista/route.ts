import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { hasModuleAccess, isCicaAdmin, isReadOnlyUser } from "@/lib/access-control";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const WEBAPP_URL =
  "https://script.google.com/macros/s/AKfycbwy9QfpEbdGtTIiC2OFuZAUx0jIPFsXPLZKedfGp79VJ6mlzLYus_wjI2IvFPoeE6Pc/exec";
const REQUEST_TIMEOUT_MS = 30_000;

async function autorizado() {
  const session = await auth();
  const email = session?.user?.email;
  return Boolean(email && hasModuleAccess(email, "motorista"));
}

async function acessoLeitura() {
  const session = await auth();
  return isReadOnlyUser(session?.user?.email);
}

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
        ? "A planilha demorou demais para responder."
        : "Não foi possível acessar a planilha.";
    return NextResponse.json({ ok: false, erro: mensagem }, { status: 502 });
  } finally {
    clearTimeout(timeout);
  }
}

export async function GET(request: NextRequest) {
  if (!(await autorizado())) {
    return NextResponse.json({ ok: false, erro: "Não autorizado." }, { status: 401 });
  }

  const destino = new URL(WEBAPP_URL);
  request.nextUrl.searchParams.forEach((valor, chave) => destino.searchParams.set(chave, valor));
  return encaminhar(destino.toString(), { method: "GET" });
}

export async function POST(request: NextRequest) {
  if (!(await autorizado())) {
    return NextResponse.json({ ok: false, erro: "Não autorizado." }, { status: 401 });
  }
  if (await acessoLeitura()) {
    return NextResponse.json({ ok: false, erro: "Acesso somente leitura." }, { status: 403 });
  }

  const corpo = await request.text();
  const action = new URLSearchParams(corpo).get("action");
  if (action === "excluir") {
    const session = await auth();
    if (!isCicaAdmin(session?.user?.email)) {
      return NextResponse.json({ ok: false, erro: "Somente Ciça pode excluir viagens." }, { status: 403 });
    }
  }
  return encaminhar(WEBAPP_URL, {
    method: "POST",
    body: corpo,
    headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
  });
}
