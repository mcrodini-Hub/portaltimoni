import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import { hasModuleAccess } from "@/lib/access-control";
import ComprasClient from "./ComprasClient";

export const metadata: Metadata = { title: "Compras" };

export default async function ComprasPage() {
  const session = await auth();
  const canViewOrders = hasModuleAccess(session?.user?.email, "pedido-de-compra", session?.portalUser);
  return (
    <div className="compras-page pb-10">
      <div className="mb-4 flex justify-end gap-3">
        {canViewOrders && <a href="/dashboard/pedido-de-compra" className="inline-flex min-h-11 items-center justify-center rounded-xl border border-blue-300 bg-white px-5 text-sm font-semibold text-blue-800 shadow-sm hover:bg-blue-50">Pedidos de Compra</a>}
        <a
          href="/dashboard/compras/configurar"
          className="inline-flex min-h-11 items-center justify-center rounded-xl border border-blue-300 bg-white px-5 text-sm font-semibold text-blue-800 shadow-sm hover:bg-blue-50"
        >
          Configurar Trello
        </a>
      </div>

      <ComprasClient />
    </div>
  );
}

