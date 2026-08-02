export default function ColaboradoresPage() {
  return (
    <div className="pb-10">
      <header className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-700">
          Comunicação interna
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
          Painel Timoni
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
          Informações essenciais para a equipe, sem excesso de conteúdo.
        </p>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <article
          id="comunicados"
          className="rounded-3xl border border-blue-200 bg-blue-50 p-6 shadow-sm"
        >
          <p className="text-xs font-semibold uppercase tracking-wider text-blue-700">
            Comunicados novos
          </p>
          <h2 className="mt-3 text-xl font-semibold text-slate-950">
            Painel Timoni em implantação
          </h2>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Este será o canal oficial para avisos e orientações importantes da Casa Timoni.
          </p>
          <p className="mt-5 text-xs font-medium text-slate-500">
            Publicado em 02/08/2026
          </p>
        </article>

        <article
          id="reuniao"
          className="rounded-3xl border border-violet-200 bg-violet-50 p-6 shadow-sm"
        >
          <p className="text-xs font-semibold uppercase tracking-wider text-violet-700">
            Próxima reunião
          </p>
          <h2 className="mt-3 text-xl font-semibold text-slate-950">
            Reunião de resultados — Rio Claro
          </h2>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Consulte o convite oficial para horário, participantes e pauta.
          </p>
          <p className="mt-5 text-sm font-semibold text-violet-800">
            08/08/2026
          </p>
        </article>

        <article
          id="aniversariante"
          className="rounded-3xl border border-pink-200 bg-pink-50 p-6 shadow-sm"
        >
          <p className="text-xs font-semibold uppercase tracking-wider text-pink-700">
            Aniversariante
          </p>
          <h2 className="mt-3 text-xl font-semibold text-slate-950">
            Nenhum aniversariante informado
          </h2>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            O próximo aniversariante da equipe aparecerá aqui.
          </p>
        </article>

        <article
          id="ferias"
          className="rounded-3xl border border-emerald-200 bg-emerald-50 p-6 shadow-sm"
        >
          <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">
            Férias
          </p>
          <h2 className="mt-3 text-xl font-semibold text-slate-950">
            Nenhuma férias programada
          </h2>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Os próximos períodos de férias da equipe aparecerão aqui.
          </p>
        </article>
      </section>
    </div>
  );
}
