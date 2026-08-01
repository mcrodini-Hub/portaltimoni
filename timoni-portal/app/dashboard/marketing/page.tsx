import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Marketing",
};

const TRELLO_URL = "https://trello.com/";
const DRIVE_URL = "https://drive.google.com/drive/my-drive";
const WHATSAPP_URL = "https://web.whatsapp.com/";

const frentes = [
  {
    title: "Campanhas",
    description: "Organize campanhas em andamento, responsáveis, prazo e objetivo.",
    action: "Abrir Trello",
    href: TRELLO_URL,
  },
  {
    title: "Conteúdo",
    description: "Acesse artes, fotos, vídeos, textos e materiais aprovados.",
    action: "Abrir Drive",
    href: DRIVE_URL,
  },
  {
    title: "Comunicação",
    description: "Acompanhe aprovações, retornos e alinhamentos rápidos da equipe.",
    action: "Abrir WhatsApp",
    href: WHATSAPP_URL,
  },
];

const rotina = [
  "Definir produtos e prioridades da semana",
  "Confirmar responsáveis e prazos",
  "Produzir e revisar os materiais",
  "Publicar e registrar o que foi concluído",
  "Revisar resultados e próximos passos",
];

export default function MarketingPage() {
  return (
    <div className="pb-10">
      <section className="rounded-3xl border border-pink-100 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-pink-700">
              Módulo operacional
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
              Marketing
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
              Central de acesso para campanhas, conteúdo, materiais e comunicação da Casa Timoni.
            </p>
          </div>

          <span className="w-fit rounded-full bg-pink-100 px-3 py-1.5 text-xs font-semibold text-pink-800">
            Disponível
          </span>
        </div>
      </section>

      <section className="mt-5 grid gap-4 md:grid-cols-3">
        {frentes.map((frente) => (
          <article
            key={frente.title}
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
          >
            <h2 className="font-semibold text-slate-900">{frente.title}</h2>
            <p className="mt-2 min-h-16 text-sm leading-5 text-slate-500">
              {frente.description}
            </p>
            <a
              href={frente.href}
              target="_blank"
              rel="noreferrer"
              className="mt-4 inline-flex rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-pink-700"
            >
              {frente.action}
            </a>
          </article>
        ))}
      </section>

      <section className="mt-5 grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-pink-700">
            Rotina recomendada
          </p>
          <h2 className="mt-2 text-xl font-semibold text-slate-900">
            Fluxo semanal de marketing
          </h2>
          <ol className="mt-4 space-y-3">
            {rotina.map((item, index) => (
              <li key={item} className="flex gap-3 text-sm text-slate-600">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-pink-100 text-xs font-semibold text-pink-700">
                  {index + 1}
                </span>
                <span className="pt-0.5">{item}</span>
              </li>
            ))}
          </ol>
        </article>

        <article className="rounded-2xl border border-blue-100 bg-blue-50 p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-blue-700">
            Próxima evolução
          </p>
          <h2 className="mt-2 text-xl font-semibold text-slate-900">
            Indicadores e integração
          </h2>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            O próximo nível será conectar campanhas a vendas, estoque e produtos prioritários para orientar decisões com dados reais.
          </p>
        </article>
      </section>
    </div>
  );
}
