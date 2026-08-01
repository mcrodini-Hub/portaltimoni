import type { Metadata } from "next";
import Link from "next/link";
import ComprasLiveSummary from "./ComprasLiveSummary";
import OpenComprasButton from "./OpenComprasButton";

export const metadata: Metadata = {
  title: "Compras",
};

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
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-blue-700">
            Módulo operacional
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
            Compras
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
            Pendências, pedidos enviados e acesso ao fluxo de compras. O Trello não abre automaticamente.
          </p>
        </div>

        <ComprasLiveSummary initialResumo={resumo} />
      </section>

      <section className="mt-5 grid gap-4 lg:grid-cols-[1.35fr_1fr]">
        <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-blue-700">
            Fluxo de compras
          </p>
          <h2 className="mt-2 text-xl font-semibold text-slate-950">
            Abrir a extensão instalada
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            O botão abre a lateral do módulo Compras no Chrome. A extensão precisa estar instalada e atualizada neste computador.
          </p>

          <div className="mt-5">
            <OpenComprasButton />
          </div>

          <div className="mt-5 border-t border-slate-100 pt-5">
            <a
              href={TRELLO_URL}
              target="_blank"
              rel="noreferrer"
              className="inline-flex rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Abrir Trello
            </a>
            <p className="mt-2 text-xs text-slate-400">Acesso secundário, somente quando necessário.</p>
          </div>
        </article>

        <article className="rounded-3xl border border-cyan-100 bg-cyan-50 p-6">
          <p className="text-xs font-semibold uppercase tracking-wider text-cyan-800">
            Processo separado
          </p>
          <h2 className="mt-2 text-xl font-semibold text-slate-950">
            Conferência de pedidos
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Upload dos documentos, comparação automática e geração do Excel ficam fora do fluxo operacional de Compras.
          </p>
          <Link
            href="/dashboard/conferencia-pedidos"
            className="mt-5 inline-flex rounded-xl bg-cyan-800 px-5 py-3 text-sm font-semibold text-white transition hover:bg-cyan-900"
          >
            Abrir Conferência de pedidos
          </Link>
        </article>
      </section>
    </div>
  );
}
