import type { Metadata } from "next";
import ComprasClient from "./ComprasClient";

export const metadata: Metadata = { title: "Compras" };

export default function ComprasPage() {
  return (
    <div className="compras-page pb-10">
      <div className="mb-4 flex justify-end">
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
