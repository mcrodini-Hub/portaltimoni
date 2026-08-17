import type { Metadata } from "next";

export const metadata: Metadata = { title: "Marketing" };

const TRELLO_URL = "https://trello.com/b/6HcTFpSp/ct-marketing";
const DRIVE_URL = "https://drive.google.com/open?id=1zSvHeO4YmWOSRp4i_CBTSxleBBIzfdPD&usp=drive_fs";

const frentes = [
  { title: "Campanhas", description: "Organize campanhas em andamento, responsáveis, prazo e objetivo.", action: "Abrir Trello do Marketing", href: TRELLO_URL },
  { title: "Conteúdo", description: "Acesse artes, fotos, vídeos, textos e materiais aprovados.", action: "Abrir pasta do Drive", href: DRIVE_URL },
];

export default function MarketingPage() {
  return (
    <div className="pb-10">
      <section className="rounded-3xl border border-pink-100 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-pink-700">Módulo operacional</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Marketing</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">Central de acesso para campanhas, conteúdo, materiais e comunicação da Casa Timoni.</p>
          </div>
          <span className="w-fit rounded-full bg-pink-100 px-3 py-1.5 text-xs font-semibold text-pink-800">Disponível</span>
        </div>
      </section>

      <section className="mt-5 grid gap-4 md:grid-cols-2">
        {frentes.map((frente) => (
          <article key={frente.title} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="font-semibold text-slate-900">{frente.title}</h2>
            <p className="mt-2 min-h-16 text-sm leading-5 text-slate-500">{frente.description}</p>
            <a href={frente.href} target="_blank" rel="noreferrer" className="mt-4 inline-flex rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-pink-700">{frente.action}</a>
          </article>
        ))}
      </section>

      <section className="mt-5">
        <article className="rounded-2xl border border-blue-100 bg-blue-50 p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-blue-700">Acompanhamento</p>
          <h2 className="mt-2 text-xl font-semibold text-slate-900">Bruno MKT</h2>
          <p className="mt-3 text-sm leading-6 text-slate-600">Reuniões quinzenais e alinhamentos ficam registrados no Trello e no grupo oficial do WhatsApp.</p>
        </article>
      </section>
    </div>
  );
}
