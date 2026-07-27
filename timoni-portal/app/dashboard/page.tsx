import Link from "next/link";

const modules = [
  {
    name: "Agenda da Ciça",
    description: "Consulte, crie e edite seus compromissos.",
    status: "Disponível",
    href: "/agenda",
    color: "bg-violet-600",
    icon: "A",
  },
  {
    name: "Compras",
    description: "Pedidos, fornecedores, conferências e pendências.",
    status: "Em integração",
    color: "bg-blue-600",
    icon: "C",
  },
  {
    name: "Estoque",
    description: "Necessidades, rupturas e produtos aguardando compra.",
    status: "Em integração",
    color: "bg-emerald-600",
    icon: "E",
  },
  {
    name: "Motorista",
    description: "Agenda de entregas, retiradas e rotas.",
    status: "Em integração",
    color: "bg-amber-600",
    icon: "M",
  },
  {
    name: "Reuniões",
    description: "Decisões, anotações e pendências de acompanhamento.",
    status: "Próxima etapa",
    color: "bg-rose-600",
    icon: "R",
  },
  {
    name: "Marketing",
    description: "Planejamento, campanhas e calendário de conteúdo.",
    status: "Próxima etapa",
    color: "bg-pink-600",
    icon: "M",
  },
];

export default function DashboardPage() {
  return (
    <div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-blue-600">Visão geral</p>
          <h1 className="text-2xl font-semibold tracking-tight">Olá, Ciça</h1>
          <p className="mt-1 text-sm text-slate-500">
            Seus módulos e prioridades em um único lugar.
          </p>
        </div>
        <p className="text-xs text-slate-400">Acesso exclusivo</p>
      </div>

      <section className="mt-6 grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">Atenção</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">—</p>
          <p className="text-sm text-slate-500">Alertas serão conectados na próxima etapa.</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Hoje</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">Agenda</p>
          <Link href="/agenda" className="text-sm font-medium text-blue-600 hover:text-blue-700">
            Ver compromissos →
          </Link>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Prioridade</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">Compras</p>
          <p className="text-sm text-slate-500">Primeiro módulo a integrar.</p>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold">Módulos</h2>
        <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {modules.map((module) => {
            const content = (
              <>
                <div className="flex items-start justify-between gap-3">
                  <span
                    className={`flex h-10 w-10 items-center justify-center rounded-xl ${module.color} text-sm font-bold text-white`}
                  >
                    {module.icon}
                  </span>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-500">
                    {module.status}
                  </span>
                </div>
                <h3 className="mt-4 font-semibold text-slate-900">{module.name}</h3>
                <p className="mt-1 text-sm leading-5 text-slate-500">{module.description}</p>
              </>
            );

            return module.href ? (
              <Link
                key={module.name}
                href={module.href}
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md"
              >
                {content}
              </Link>
            ) : (
              <article key={module.name} className="rounded-2xl border border-slate-200 bg-white p-5">
                {content}
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}
