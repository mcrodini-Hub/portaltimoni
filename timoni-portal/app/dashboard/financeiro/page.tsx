import type { Metadata } from "next";

export const metadata: Metadata = { title: "Financeiro" };

const FINANCE_FOLDER_URL = "https://drive.google.com/drive/folders/1_aU4UjcElg1EtOYSorNXQ5aJGPsrwCGg";
const CONTROL_SHEET_URL = "https://docs.google.com/spreadsheets/d/1THfzF8pKm0SoNAUlKahJbcT4taKCfewRjEgRj9qCRcg";

const activities = [
  "Acompanhar pagamentos e vencimentos",
  "Registrar atrasos, devoluções e ajustes",
  "Conferir bonificações de fornecedores",
  "Manter documentos e comprovantes na pasta oficial",
];

export default function FinanceiroPage() {
  return (
    <div className="pb-10">
      <section className="rounded-3xl border border-lime-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wider text-lime-700">Módulo operacional</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Financeiro</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">Acesso centralizado aos controles e documentos financeiros da Casa Timoni.</p>
      </section>

      <section className="mt-5 grid gap-4 md:grid-cols-2">
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-lime-700">Controle</p>
          <h2 className="mt-2 text-xl font-semibold text-slate-950">Planilha financeira</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">Abra o controle principal para consultar e atualizar as informações.</p>
          <a href={CONTROL_SHEET_URL} target="_blank" rel="noreferrer" className="mt-4 inline-flex min-h-11 items-center rounded-xl bg-lime-700 px-5 text-sm font-semibold text-white hover:bg-lime-800">Abrir controle financeiro</a>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-blue-700">Documentos</p>
          <h2 className="mt-2 text-xl font-semibold text-slate-950">Pasta oficial</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">Comprovantes, documentos e materiais ficam organizados no Google Drive.</p>
          <a href={FINANCE_FOLDER_URL} target="_blank" rel="noreferrer" className="mt-4 inline-flex min-h-11 items-center rounded-xl bg-blue-800 px-5 text-sm font-semibold text-white hover:bg-blue-900">Abrir pasta Financeiro</a>
        </article>
      </section>

      <section className="mt-5 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-600">Fluxo de uso</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {activities.map((activity, index) => (
            <div key={activity} className="flex gap-3 rounded-2xl bg-slate-50 p-4">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-900 text-sm font-semibold text-white">{index + 1}</span>
              <p className="pt-1 text-sm font-medium text-slate-700">{activity}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
