import type { Metadata } from "next";
import ConferenciaPedidosClient from "./ConferenciaPedidosClient";

export const metadata: Metadata = { title: "Conferência de Pedidos" };

export default function ConferenciaPedidosPage() {
  return (
    <div className="pb-10">
      <header className="mb-4">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-700">Conferência</p>
        <h1 className="mt-1.5 text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">Conferência de Pedidos</h1>
      </header>
      <ConferenciaPedidosClient />
    </div>
  );
}
