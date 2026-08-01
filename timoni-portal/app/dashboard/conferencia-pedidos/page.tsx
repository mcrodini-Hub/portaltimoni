import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Conferência de pedidos",
};

export default function ConferenciaPedidosPage() {
  return (
    <div className="pb-10">
      <section className="rounded-3xl border border-cyan-100 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-cyan-800">
              Módulo separado
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
              Conferência de pedidos
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
              Comparação entre o pedido MCR e o documento do fornecedor, com geração da planilha Excel no padrão Casa Timoni.
            </p>
          </div>

          <span className="w-fit rounded-full bg-amber-100 px-3 py-1.5 text-xs font-semibold text-amber-800">
            Integração em andamento
          </span>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {[
            ["1. Enviar documentos", "Pedido MCR e documento recebido do fornecedor."],
            ["2. Analisar", "Comparação automática de itens, quantidades, preços e condições."],
            ["3. Baixar Excel", "Preço divergente em amarelo e demais divergências em laranja."],
          ].map(([title, description]) => (
            <article key={title} className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <h2 className="font-semibold text-slate-900">{title}</h2>
              <p className="mt-2 text-sm leading-5 text-slate-500">{description}</p>
            </article>
          ))}
        </div>

        <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <p className="text-sm font-semibold text-amber-900">Ainda não enviar documentos por esta tela.</p>
          <p className="mt-1 text-sm leading-6 text-amber-800">
            A rota já está separada do módulo Compras, mas o processamento automático e a geração do Excel ainda serão conectados antes da liberação.
          </p>
        </div>
      </section>
    </div>
  );
}
