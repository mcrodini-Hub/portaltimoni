import type { Metadata } from "next";
import Link from "next/link";
import ConferenciaPedidosClient from "./ConferenciaPedidosClient";

export const metadata: Metadata = {
  title: "Conferência de Preços",
};

export default function ConferenciaPedidosPage() {
  return (
    <div className="pb-10">
      <section className="rounded-3xl border border-cyan-100 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-cyan-800">
              Módulo de compras
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
              Conferência de Preços
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
              Envie o pedido MCR/Rodini e o documento do fornecedor. O módulo lê PDFs, fotos, prints e anotações manuscritas, apresenta a conferência em texto e gera o Excel automaticamente.
            </p>
          </div>

          <div className="flex flex-col items-start gap-2 sm:items-end">
            <span className="w-fit rounded-full bg-emerald-100 px-3 py-1.5 text-xs font-semibold text-emerald-800">
              Alternativa gratuita
            </span>
            <Link
              href="/dashboard/conferencia-pedidos/configurar"
              className="rounded-xl border border-emerald-700 bg-white px-4 py-2 text-sm font-semibold text-emerald-800 hover:bg-emerald-50"
            >
              Configurar análise gratuita
            </Link>
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          {[
            ["1. Enviar", "PDF, foto, print ou manuscrito."],
            ["2. Conferir", "Itens, quantidades, preços, totais e condições."],
            ["3. Receber", "Resposta em texto e planilha Excel formatada."],
          ].map(([title, description]) => (
            <article key={title} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
              <p className="mt-1 text-sm leading-5 text-slate-500">{description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mt-5">
        <ConferenciaPedidosClient />
      </section>
    </div>
  );
}
