import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const DEFAULT_WEBAPP_URL =
  "https://script.google.com/macros/s/AKfycbwy9QfpEbdGtTIiC2OFuZAUx0jIPFsXPLZKedfGp79VJ6mlzLYus_wjI2IvFPoeE6Pc/exec";
const MAX_DAYS = 14;
const REQUEST_TIMEOUT_MS = 12_000;

function periodoValido(inicio: string, quantidade: number) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(inicio)) return null;

  const [ano, mes, dia] = inicio.split("-").map(Number);
  const base = new Date(Date.UTC(ano, mes - 1, dia));

  if (
    base.getUTCFullYear() !== ano ||
    base.getUTCMonth() !== mes - 1 ||
    base.getUTCDate() !== dia
  ) {
    return null;
  }

  return Array.from({ length: quantidade }, (_, indice) => {
    const data = new Date(base);
    data.setUTCDate(data.getUTCDate() + indice);
    return data.toISOString().slice(0, 10);
  });
}

async function buscarDia(webAppUrl: string, data: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const url = new URL(webAppUrl);
    url.searchParams.set("action", "dia");
    url.searchParams.set("data", data);

    const resposta = await fetch(url, {
      method: "GET",
      redirect: "follow",
      cache: "no-store",
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });

    if (!resposta.ok) {
      throw new Error(`Agenda respondeu com status ${resposta.status}.`);
    }

    const dados = await resposta.json();

    if (!dados || dados.ok !== true) {
      throw new Error(dados?.erro || "Resposta inválida da agenda.");
    }

    return Array.isArray(dados.viagens) ? dados.viagens : [];
  } finally {
    clearTimeout(timeout);
  }
}

function mensagemErro(erro: unknown) {
  if (erro instanceof Error && erro.name === "AbortError") {
    return "A agenda demorou demais para responder.";
  }

  if (erro instanceof Error && erro.message) return erro.message;
  return "Não foi possível carregar este dia.";
}

export async function GET(request: NextRequest) {
  const inicio = request.nextUrl.searchParams.get("inicio") || "";
  const quantidadeInformada = Number(request.nextUrl.searchParams.get("dias") || "7");
  const quantidade = Number.isInteger(quantidadeInformada)
    ? Math.min(Math.max(quantidadeInformada, 1), MAX_DAYS)
    : 7;
  const datas = periodoValido(inicio, quantidade);

  if (!datas) {
    return NextResponse.json(
      { error: "Período inválido. Use uma data no formato AAAA-MM-DD." },
      { status: 400 },
    );
  }

  const webAppUrl = process.env.MOTORISTA_WEBAPP_URL || DEFAULT_WEBAPP_URL;
  const resultados = await Promise.allSettled(
    datas.map((data) => buscarDia(webAppUrl, data)),
  );

  const dias = resultados.map((resultado, indice) => {
    if (resultado.status === "fulfilled") {
      return { data: datas[indice], viagens: resultado.value };
    }

    return {
      data: datas[indice],
      viagens: [],
      erro: mensagemErro(resultado.reason),
    };
  });

  const falhas = dias.filter((dia) => "erro" in dia).length;

  if (falhas === dias.length) {
    return NextResponse.json(
      {
        error:
          dias[0] && "erro" in dias[0]
            ? dias[0].erro
            : "Não foi possível carregar a agenda.",
      },
      { status: 502 },
    );
  }

  return NextResponse.json(
    { ok: true, dias, parcial: falhas > 0 },
    { headers: { "Cache-Control": "no-store, max-age=0" } },
  );
}
