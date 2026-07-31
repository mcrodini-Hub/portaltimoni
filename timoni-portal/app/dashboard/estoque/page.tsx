import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Estoque",
};

const DOWNLOAD_URL =
  "https://drive.google.com/uc?export=download&id=1AM0XXO7fIuMdVw-7YJVMjPbuIEV2XKqn";

const PLANILHA_URL =
  "https://docs.google.com/spreadsheets/d/1cESMTRx98e6AbY5vxPCcT7VrqYAbgH0xGUk87ybqHUo/edit";

export default function EstoquePage() {
  return (
    <div className="pb-10">
      <section className="rounded-3xl border border-emerald-100 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">
              Módulo concluído
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
              Estoque CT
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
              Consulta de produtos e acompanhamento das necessidades até a chegada e finalização no histórico.
            </p>
          </div>

          <span className="w-fit rounded-full bg-emerald-100 px-3 py-1.5 text-xs font-semibold text-emerald-800">
            Versão 1.0.1
          </span>
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <a
            href={DOWNLOAD_URL}
            target="_blank"
            rel="noreferrer"
            className="rounded-xl bg-emerald-700 px-5 py-3 text-center text-sm font-semibold text-white transition hover:bg-emerald-800"
          >
            Baixar módulo do Estoque
          </a>
          <a
            href={PLANILHA_URL}
            target="_blank"
            rel="noreferrer"
            className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-center text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Abrir planilha do Estoque
          </a>
        </div>
      </section>

      <section className="mt-5 grid gap-4 md:grid-cols-3">
        {[
          ["Ciça", "Acesso total a necessidades, produtos e histórico."],
          ["Estoque", "Lucas, Jeovana e Reinaldo atualizam as necessidades até a chegada."],
          ["Marcelo", "Gestão somente leitura."],
        ].map(([title, description]) => (
          <article key={title} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="font-semibold text-slate-900">{title}</h2>
            <p className="mt-2 text-sm leading-5 text-slate-500">{description}</p>
          </article>
        ))}
      </section>
    </div>
  );
}
