import type { Metadata } from "next";
import ComprasClient from "./ComprasClient";

export const metadata: Metadata = { title: "Compras" };

const etapas = [
  "Selecione o fornecedor na relação de pedidos pendentes, com os urgentes primeiro.",
  "Abra a pasta do fornecedor e cole o link da planilha no Portal.",
  "Extraia somente código, descrição e quantidade da coluna informada.",
  "Lance o pedido no Bessani e informe o título final, envio e entrega.",
  "Finalize: o Portal atualiza, etiqueta, anexa e move o cartão no Trello.",
  "Envie o pedido ao fornecedor e solicite a previsão de entrega pelo WhatsApp.",
];

export default function ComprasPage() {
  return (
    <div className="compras-page pb-10">
      <style>{`
        .compras-page > .space-y-5 > section:last-of-type {
          display: none;
        }
      `}</style>

      <div className="mb-4 flex justify-end">
        <a
          href="/dashboard/compras/configurar"
          className="inline-flex min-h-11 items-center justify-center rounded-xl border border-blue-300 bg-white px-5 text-sm font-semibold text-blue-800 shadow-sm hover:bg-blue-50"
        >
          Configurar Trello
        </a>
      </div>

      <ComprasClient />

      <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wider text-blue-700">Fluxo oficial</p>
        <h2 className="mt-2 text-xl font-semibold text-slate-950">Pedido por fornecedor</h2>
        <ol className="mt-5 space-y-3">
          {etapas.map((etapa, index) => (
            <li key={etapa} className="flex gap-3 text-sm leading-6 text-slate-700">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-800">
                {index + 1}
              </span>
              <span>{etapa}</span>
            </li>
          ))}
        </ol>
        <p className="mt-5 rounded-2xl border border-cyan-200 bg-cyan-50 px-4 py-3 text-sm leading-6 text-cyan-900">
          A Conferência de Preços permanece em módulo separado. O Compras não classifica pedidos como aprovar, revisar ou bloquear.
        </p>
      </section>
    </div>
  );
}
