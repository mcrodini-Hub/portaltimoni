import type { Metadata } from "next";
import ConferenciaPedidosClient from "./ConferenciaPedidosClient";

export const metadata: Metadata = {
  title: "Conferência de Pedidos",
};

export default function ConferenciaPedidosPage() {
  return (
    <div className="pb-10">
      <h1 className="mb-5 text-3xl font-semibold tracking-tight text-slate-950">
        Conferência de Pedidos
      </h1>
      <ConferenciaPedidosClient />
    </div>
  );
}
