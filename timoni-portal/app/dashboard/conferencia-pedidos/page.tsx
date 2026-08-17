import type { Metadata } from "next";
import ConferenciaPedidosClient from "./ConferenciaPedidosClient";

export const metadata: Metadata = {
  title: "Conferência de Preços",
};

export default function ConferenciaPedidosPage() {
  return (
    <div className="pb-10">
      <section className="rounded-3xl border border-cyan-100 bg-white p-6 shadow-sm">
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

      </section>

      <section className="mt-5">
        <ConferenciaPedidosClient />
      </section>
    </div>
  );
}
