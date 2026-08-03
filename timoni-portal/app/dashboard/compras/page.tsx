import type { Metadata } from "next";

export const metadata: Metadata = { title: "Compras" };

const TRELLO_URL = "https://trello.com/b/UfPrTr1H/compras";

const etapas = [
  "Priorizar urgentes e fornecedores de Rio Claro no Trello.",
  "Extrair da planilha somente código, descrição e quantidade do mês atual.",
  "Lançar o pedido manualmente no Bessani.",
  "Atualizar o cartão do Trello com número, datas, etiqueta e anexo quando aplicável.",
  "Enviar o pedido ao fornecedor e solicitar a previsão de entrega pelo WhatsApp.",
];

export default function ComprasPage() {
  return (
    <div className="pb-10">
      <section className="rounded-3xl border border-blue-100 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wider text-blue-700">Módulo operacional</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Compras</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
          O Trello permanece como fonte oficial dos pedidos. O Portal centraliza o acesso, sem exigir extensão nem duplicar o status dos cartões.
        </p>
      </section>

      <section className="mt-5">
        <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
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
          <a
            href={TRELLO_URL}
            target="_blank"
            rel="noreferrer"
            className="mt-6 inline-flex rounded-xl bg-[#0b1f5e] px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-800"
          >
            Abrir pedidos no Trello
          </a>

          <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-semibold text-slate-900">Mensagem padrão</p>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Olá, segue pedido de compra. Aguardo retorno com a previsão de entrega. Obrigada, Ciça.
            </p>
          </div>
        </article>
      </section>
    </div>
  );
}
