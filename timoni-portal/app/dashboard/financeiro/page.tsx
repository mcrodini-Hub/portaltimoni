import type { Metadata } from "next";

export const metadata: Metadata = { title: "Financeiro" };

const FINANCE_FOLDER_URL = "https://drive.google.com/drive/folders/1_aU4UjcElg1EtOYSorNXQ5aJGPsrwCGg";

const categories = [
  {
    title: "Comprovantes de pagamento",
    description: "Arquivar comprovantes de PIX e demais pagamentos feitos aos fornecedores.",
    icon: "💳",
  },
  {
    title: "Notas de devolução",
    description: "Registrar documentos e acompanhar devoluções pendentes com fornecedores.",
    icon: "↩️",
  },
  {
    title: "Problemas no recebimento",
    description: "Centralizar faltas, avarias, divergências e demais ocorrências de entrega.",
    icon: "📦",
  },
  {
    title: "Clientes com pagamento em atraso",
    description: "Registrar pendências para bloquear novas vendas até a regularização.",
    icon: "⚠️",
  },
];

const checklist = [
  "Registrar a pendência no momento em que for identificada.",
  "Anexar comprovantes, notas, fotos ou documentos relacionados.",
  "Informar responsável, data e próxima ação.",
  "Marcar como concluído somente depois da resolução.",
];

export default function FinanceiroPage() {
  return (
    <div className="pb-8">
      <section className="rounded-2xl border border-lime-200 bg-white p-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wider text-lime-700">Módulo operacional</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">Financeiro</h1>
        <p className="mt-2 max-w-3xl text-sm leading-5 text-slate-600">
          Repositório de documentos e checklist de pendências financeiras da Casa Timoni.
        </p>
        <a
          href={FINANCE_FOLDER_URL}
          target="_blank"
          rel="noreferrer"
          className="mt-4 inline-flex min-h-10 items-center rounded-xl bg-blue-800 px-4 text-sm font-semibold text-white hover:bg-blue-900"
        >
          Abrir pasta Financeiro
        </a>
      </section>

      <section className="mt-4 grid gap-3 sm:grid-cols-2">
        {categories.map((category) => (
          <article key={category.title} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-xl">
                {category.icon}
              </span>
              <div>
                <h2 className="text-base font-semibold text-slate-950">{category.title}</h2>
                <p className="mt-1 text-sm leading-5 text-slate-600">{category.description}</p>
              </div>
            </div>
          </article>
        ))}
      </section>

      <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-600">Checklist de pendências</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {checklist.map((item, index) => (
            <div key={item} className="flex gap-3 rounded-xl bg-slate-50 p-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white">
                {index + 1}
              </span>
              <p className="pt-0.5 text-sm text-slate-700">{item}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
