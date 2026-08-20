import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CepResult = {
  cep: string;
  logradouro: string;
  bairro: string;
  cidade: string;
  uf: string;
};

const TIMEOUT_MS = 8_000;

async function consultar(url: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const resposta = await fetch(url, {
      cache: "no-store",
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
    if (!resposta.ok) return null;
    return await resposta.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export async function GET(request: NextRequest) {
  const cep = (request.nextUrl.searchParams.get("cep") || "").replace(/\D/g, "");
  if (cep.length !== 8) {
    return NextResponse.json(
      { ok: false, erro: "Digite um CEP válido (8 dígitos)." },
      { status: 400 },
    );
  }

  const viaCep = await consultar(`https://viacep.com.br/ws/${cep}/json/`);
  if (viaCep && !viaCep.erro) {
    const endereco: CepResult = {
      cep,
      logradouro: String(viaCep.logradouro || "").trim(),
      bairro: String(viaCep.bairro || "").trim(),
      cidade: String(viaCep.localidade || "").trim(),
      uf: String(viaCep.uf || "").trim().toUpperCase(),
    };
    return NextResponse.json({ ok: true, endereco });
  }

  const brasilApi = await consultar(`https://brasilapi.com.br/api/cep/v2/${cep}`);
  if (brasilApi && (brasilApi.city || brasilApi.street)) {
    const endereco: CepResult = {
      cep,
      logradouro: String(brasilApi.street || "").trim(),
      bairro: String(brasilApi.neighborhood || "").trim(),
      cidade: String(brasilApi.city || "").trim(),
      uf: String(brasilApi.state || "").trim().toUpperCase(),
    };
    return NextResponse.json({ ok: true, endereco });
  }

  return NextResponse.json(
    { ok: false, erro: "CEP não encontrado. Confira os números digitados." },
    { status: 404 },
  );
}
