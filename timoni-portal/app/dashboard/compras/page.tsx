import type { Metadata } from "next";
import Link from "next/link";
import ComprasLiveSummary from "./ComprasLiveSummary";

export const metadata: Metadata = { title: "Compras" };
export const dynamic = "force-dynamic";

const TRELLO_URL = "https://trello.com/b/UfPrTr1H/compras";

type ComprasResumo = {
  paraFazer: number;
  urgentes: number;
  enviadosRioClaro: number;
  enviadosAraras: number;
  atualizadoEm?: string | null;
};

async function getComprasResumo(): Promise<ComprasResumo | null> {
  const baseUrl = process.env.COMPRAS_WEB_APP_URL;
  if (!baseUrl) return null;

  try {
    const url = new URL(baseUrl);
    url.searchParams.set("action", "estado");
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) return null;
    const payload = await response.json();
    const estado = payload?.estado;
    if (!payload?.ok || !estado?.resumoComprasJson) return null;
    const resumo = JSON.parse(estado.resumoComprasJson);
    return {
      paraFazer: Number(resumo.paraFazer) || 0,
      urgentes: Number(resumo.urgentes) || 0,
      enviadosRioClaro: Number(resumo.enviadosRioClaro) || 0,
      enviadosAraras: Number(resumo.enviadosAraras) || 0,
      atualizadoEm: resumo.atualizadoEm || estado.atualizadoEm || null,
    };
  } catch {
    return null;
  }
}

export default async function ComprasPage() {
  const resumo = await getComprasResumo();

  return (
    <div className="pb-10">
      <section className="rounded-3xl border border-blue-100 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wider text-blue-700">Módulo operacional</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Compras</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
          Pendências, urgências e pedidos enviados em um único lugar, direto no Portal Timoni.
        </p>
        <ComprasLiveSummary initialResumo={resumo} />
      </section>

      <section className="mt-5 grid gap-4 lg:grid-cols-[1.35fr_1fr]">
        <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-blue-700">Fluxo de compras</p>
          <h2 className="mt-2 text-xl font-semibold text-slate-950">Operação pelo Portal</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            O módulo não depende mais de extensão. Use esta página para acompanhar o fluxo e abra o Trello somente quando precisar alterar os cartões.
          </p>
          <a
            href={TRELLO_URL}
            target="_blank"
            rel="noreferrer"
            className="mt-5 inline-flex rounded-xl bg-[#0b1f5e] px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-800"
          >
            Abrir pedidos no Trello
          </a>
        </article>

        <article className="rounded-3xl border border-cyan-100 bg-cyan-50 p-6">
          <p className="text-xs font-semibold uppercase tracking-wider text-cyan-800">Processo separado</p>
          <h2 className="mt-2 text-xl font-semibold text-slate-950">Conferência de pedidos</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Upload dos documentos, comparação automática e geração do Excel.
          </p>
          <Link
            href="/dashboard/conferencia-pedidos"
            className="mt-5 inline-flex rounded-xl bg-cyan-800 px-5 py-3 text-sm font-semibold text-white transition hover:bg-cyan-900"
          >
            Abrir Conferência
          </Link>
        </article>
      </section>
    </div>
  );
}
