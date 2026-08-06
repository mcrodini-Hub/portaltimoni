const DRIVE_URL = "https://drive.google.com/drive/folders/1a90BS_9nnf_9_o9VZyNDICfPyAxxyYOg";
const MODEL_URL = "https://docs.google.com/document/d/1D5W1Yu-8Ic54YQSNpOM6y2blyU0Pn1X19Lb2xkchPGM";

const meeting = {
  unit: "Araras",
  pautaUrl: "https://docs.google.com/document/d/1NoZASmMc-ptrqFy8zbvtGgCJjLJxX8GsORM-F4N799k",
  date: "07/08/2026",
  day: "Sexta-feira",
  time: "7h30",
  frequency: "Mensal",
  leaders: "Ciça e Marcelo",
  url: "https://docs.google.com/document/d/1S9dQlOGwFE8RwNnjw1PFy08DH9a6k1_9kugQEBgmxHQ",
  slidesUrl: "https://docs.google.com/presentation/d/1zN_tU03-tq8Y6Ewo4GasboPTjRHXnpjXB0bbSrjHaWI",
  style: "border-amber-200 bg-amber-50",
};

export default function ReunioesPage() {
  return (
    <div className="pb-10">
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-rose-600">Gestão e acompanhamento</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">Reuniões Araras</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              Pauta, ata, apresentação e registros oficiais das reuniões de Araras.
            </p>
          </div>
          <a href={DRIVE_URL} target="_blank" rel="noreferrer" className="inline-flex shrink-0 items-center justify-center rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700">
            Abrir pasta oficial
          </a>
        </div>
      </section>

      <section className="mt-5">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-blue-600">Próximo registro</p>
            <h2 className="mt-1 text-xl font-semibold text-slate-900">Reunião agendada</h2>
          </div>
          <a href={MODEL_URL} target="_blank" rel="noreferrer" className="text-sm font-semibold text-blue-700 hover:text-blue-900">
            Modelo de informações →
          </a>
        </div>

        <div className="mt-3 grid gap-4 md:grid-cols-1">
          <article className={`rounded-3xl border p-5 ${meeting.style}`}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{meeting.day}</p>
                <h3 className="mt-1 text-2xl font-semibold text-slate-900">{meeting.unit}</h3>
              </div>
              <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700">{meeting.frequency}</span>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-white/80 p-3">
                <p className="text-xs text-slate-500">Data</p>
                <p className="mt-1 font-semibold text-slate-900">{meeting.date}</p>
              </div>
              <div className="rounded-2xl bg-white/80 p-3">
                <p className="text-xs text-slate-500">Horário</p>
                <p className="mt-1 font-semibold text-slate-900">{meeting.time}</p>
              </div>
            </div>
            <p className="mt-4 text-sm text-slate-600">Condução: <strong>{meeting.leaders}</strong></p>
            <div className="mt-4 flex flex-wrap gap-4">
              <a href={meeting.pautaUrl} target="_blank" rel="noreferrer" className="text-sm font-semibold text-emerald-700 hover:text-emerald-900">Abrir pauta →</a>
              <a href={meeting.url} target="_blank" rel="noreferrer" className="text-sm font-semibold text-blue-700 hover:text-blue-900">Abrir ata →</a>
              <a href={meeting.slidesUrl} target="_blank" rel="noreferrer" className="text-sm font-semibold text-rose-700 hover:text-rose-900">Abrir apresentação →</a>
            </div>
          </article>
        </div>
      </section>

      <section className="mt-5 grid gap-4 lg:grid-cols-[1.35fr_1fr]">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-emerald-600">Fluxo padrão</p>
          <h2 className="mt-1 text-xl font-semibold text-slate-900">Como a reunião será tratada</h2>
          <div className="mt-4 space-y-3">
            {[
              ["1", "Preparar", "Reunir pauta, resultados e pendências anteriores."],
              ["2", "Registrar", "Anotar os apontamentos dentro dos tópicos da pauta."],
              ["3", "Consolidar", "Finalizar a ata e manter os arquivos na pasta oficial de Araras."],
            ].map(([step, title, description]) => (
              <div key={step} className="flex gap-3 rounded-2xl bg-slate-50 p-4">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-900 text-sm font-semibold text-white">{step}</span>
                <div>
                  <p className="font-semibold text-slate-900">{title}</p>
                  <p className="mt-0.5 text-sm leading-5 text-slate-500">{description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-3xl border border-blue-100 bg-blue-50 p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-blue-700">Arquivos oficiais</p>
          <h2 className="mt-1 text-xl font-semibold text-slate-900">Tudo organizado para Araras</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">Pauta para impressão, apresentação e ata ficam disponíveis na pasta oficial de Reuniões Araras.</p>
          <a href={DRIVE_URL} target="_blank" rel="noreferrer" className="mt-4 inline-flex text-sm font-semibold text-blue-700 hover:text-blue-900">Abrir Google Drive →</a>
        </div>
      </section>
    </div>
  );
}
