import Link from "next/link";

const comunicados = [
  {
    tipo: "Importante",
    titulo: "Painel Timoni em implantação",
    texto:
      "Este espaço será o ponto oficial para comunicados, reuniões, regras internas, feriados e atualizações dos processos da Casa Timoni.",
    data: "02/08/2026",
    publico: "Todas as unidades",
  },
  {
    tipo: "Informativo",
    titulo: "Processos serão organizados por área",
    texto:
      "As orientações de Vendas, Estoque, Compras, Entregas e Administrativo serão publicadas de forma simples e atualizada.",
    data: "Em preparação",
    publico: "Todos os setores",
  },
];

const processos = [
  { nome: "Atendimento e Vendas", sigla: "VE", status: "Em organização" },
  { nome: "Estoque", sigla: "ES", status: "Em organização" },
  { nome: "Compras", sigla: "CO", status: "Em organização" },
  { nome: "Motorista e Entregas", sigla: "ME", status: "Em organização" },
  { nome: "Caixa e Administrativo", sigla: "AD", status: "Em organização" },
  { nome: "Marketing", sigla: "MK", status: "Em organização" },
];

function todayLabel() {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date());
}

export default function ColaboradoresPage() {
  return (
    <div className="pb-12">
      <section className="grid gap-5 lg:grid-cols-[1.45fr_0.8fr]">
        <article className="overflow-hidden rounded-3xl bg-[#0b1f5e] p-6 text-white shadow-lg sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-blue-200">
            Comunicação interna
          </p>
          <h1 className="mt-3 max-w-3xl text-3xl font-semibold tracking-tight sm:text-4xl">
            Informações claras para toda a equipe.
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-blue-100 sm:text-base">
            Comunicados, reuniões, regras internas, feriados e processos da Casa Timoni em um único lugar.
          </p>

          <div className="mt-7 flex flex-wrap gap-3">
            <a
              href="#comunicados"
              className="rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-[#0b1f5e] transition hover:bg-blue-50"
            >
              Ver comunicados
            </a>
            <a
              href="#processos"
              className="rounded-xl border border-white/25 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10"
            >
              Consultar processos
            </a>
          </div>
        </article>

        <aside className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-blue-700">
            Hoje
          </p>
          <p className="mt-2 text-xl font-semibold capitalize text-slate-950">
            {todayLabel()}
          </p>

          <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-amber-800">
              Implantação
            </p>
            <p className="mt-2 text-sm font-semibold text-slate-900">
              Conteúdo inicial em organização
            </p>
            <p className="mt-2 text-sm leading-5 text-slate-600">
              Novos comunicados e documentos serão incluídos gradualmente.
            </p>
          </div>
        </aside>
      </section>

      <section id="comunicados" className="mt-7 scroll-mt-24">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-blue-700">
              Quadro de avisos
            </p>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">
              Comunicados recentes
            </h2>
          </div>
          <div className="flex gap-2 overflow-x-auto">
            {['Todos', 'Rio Claro', 'Araras'].map((item) => (
              <span
                key={item}
                className="whitespace-nowrap rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600"
              >
                {item}
              </span>
            ))}
          </div>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          {comunicados.map((comunicado, index) => (
            <article
              key={comunicado.titulo}
              className={`rounded-3xl border p-5 shadow-sm ${
                index === 0
                  ? "border-blue-200 bg-blue-50"
                  : "border-slate-200 bg-white"
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="rounded-full bg-white px-3 py-1 text-[11px] font-semibold text-blue-800 shadow-sm">
                  {comunicado.tipo}
                </span>
                <span className="text-xs font-medium text-slate-500">{comunicado.data}</span>
              </div>
              <h3 className="mt-4 text-lg font-semibold text-slate-950">{comunicado.titulo}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">{comunicado.texto}</p>
              <p className="mt-4 text-xs font-semibold text-slate-500">Público: {comunicado.publico}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="agenda" className="mt-7 scroll-mt-24">
        <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-violet-700">
                  Próxima reunião
                </p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
                  Reunião de resultados — Rio Claro
                </h2>
              </div>
              <span className="rounded-xl bg-violet-50 px-3 py-2 text-sm font-semibold text-violet-800">
                08/08/2026
              </span>
            </div>
            <p className="mt-4 text-sm leading-6 text-slate-600">
              Os detalhes de horário, participantes e pauta devem ser consultados no convite oficial da agenda.
            </p>
            <Link
              href="/dashboard/reunioes"
              className="mt-5 inline-flex rounded-xl bg-[#0b1f5e] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-800"
            >
              Abrir reuniões
            </Link>
          </article>

          <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">
              Feriados e horários especiais
            </p>
            <h2 className="mt-2 text-xl font-semibold text-slate-950">
              Nenhuma alteração publicada
            </h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Quando houver mudança no funcionamento de Rio Claro ou Araras, ela aparecerá neste quadro.
            </p>
          </article>
        </div>
      </section>

      <section id="processos" className="mt-7 scroll-mt-24">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-blue-700">
            Regras e procedimentos
          </p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">
            Processos internos por área
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            Cada área terá uma versão oficial, responsável e data de atualização para evitar instruções antigas ou desencontradas.
          </p>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {processos.map((processo) => (
            <article
              key={processo.nome}
              className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50 text-sm font-bold text-blue-800">
                  {processo.sigla}
                </span>
                <span className="rounded-full bg-amber-50 px-3 py-1 text-[11px] font-semibold text-amber-800">
                  {processo.status}
                </span>
              </div>
              <h3 className="mt-5 text-base font-semibold text-slate-950">{processo.nome}</h3>
              <p className="mt-2 text-sm text-slate-500">Versão oficial será publicada neste painel.</p>
            </article>
          ))}
        </div>
      </section>

      <section id="pessoas" className="mt-7 scroll-mt-24">
        <div className="grid gap-4 lg:grid-cols-2">
          <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-pink-700">
              Boas-vindas
            </p>
            <h2 className="mt-2 text-xl font-semibold text-slate-950">
              Novos integrantes aparecerão aqui
            </h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Nome, função, unidade e data de início poderão ser apresentados para facilitar a integração da equipe.
            </p>
          </article>

          <article className="rounded-3xl border border-blue-100 bg-blue-50 p-6">
            <p className="text-xs font-semibold uppercase tracking-wider text-blue-700">
              Links úteis
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Link
                href="/dashboard"
                className="rounded-2xl bg-white p-4 text-sm font-semibold text-slate-900 shadow-sm transition hover:shadow-md"
              >
                Portal Timoni →
              </Link>
              <Link
                href="/dashboard/reunioes"
                className="rounded-2xl bg-white p-4 text-sm font-semibold text-slate-900 shadow-sm transition hover:shadow-md"
              >
                Reuniões →
              </Link>
            </div>
          </article>
        </div>
      </section>
    </div>
  );
}
