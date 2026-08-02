import Link from "next/link";
import { auth } from "@/lib/auth";
import { listEventsInRange } from "@/lib/google-calendar";
import type { CalendarEventDTO } from "@/lib/types";

type Module = {
  name: string;
  description: string;
  status: string;
  href: string;
  external?: boolean;
  accent: string;
};

const modules: Module[] = [
  {
    name: "Agenda da Ciça",
    description: "Compromissos, reuniões e atividades da semana.",
    status: "Disponível",
    href: "/agenda",
    accent: "border-violet-200 bg-violet-50",
  },
  {
    name: "Compras",
    description: "Pendências, pedidos enviados e acesso ao módulo de compras.",
    status: "Disponível",
    href: "/dashboard/compras",
    accent: "border-blue-200 bg-blue-50",
  },
  {
    name: "Conferência de pedidos",
    description: "Comparação de documentos e geração da planilha Excel.",
    status: "Em integração",
    href: "/dashboard/conferencia-pedidos",
    accent: "border-cyan-200 bg-cyan-50",
  },
  {
    name: "Estoque",
    description: "Produtos, necessidades, planilha e módulo da equipe.",
    status: "Disponível",
    href: "/dashboard/estoque",
    accent: "border-emerald-200 bg-emerald-50",
  },
  {
    name: "Motorista",
    description: "Entregas, retiradas, agenda e organização de rotas.",
    status: "Disponível",
    href: "https://mcrodini-hub.github.io/portaltimoni/agenda-motorista/",
    external: true,
    accent: "border-amber-200 bg-amber-50",
  },
  {
    name: "Reuniões",
    description: "Decisões, registros e pendências de acompanhamento.",
    status: "Disponível",
    href: "/dashboard/reunioes",
    accent: "border-rose-200 bg-rose-50",
  },
  {
    name: "Marketing",
    description: "Campanhas, conteúdo, materiais e comunicação.",
    status: "Disponível",
    href: "/dashboard/marketing",
    accent: "border-pink-200 bg-pink-50",
  },
];

function getTodayRange() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const date = `${value.year}-${value.month}-${value.day}`;
  const tomorrowDate = new Date(
    Date.UTC(Number(value.year), Number(value.month) - 1, Number(value.day) + 1),
  );

  return {
    timeMin: `${date}T00:00:00-03:00`,
    timeMax: `${tomorrowDate.toISOString().slice(0, 10)}T00:00:00-03:00`,
  };
}

function formatEventTime(event: CalendarEventDTO) {
  if (!event.start.includes("T")) return "Dia inteiro";

  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(event.start));
}

export default async function DashboardPage() {
  const session = await auth();
  let todayEvents: CalendarEventDTO[] = [];

  if (session?.accessToken && session.error !== "RefreshAccessTokenError") {
    try {
      const { timeMin, timeMax } = getTodayRange();
      todayEvents = await listEventsInRange(session.accessToken, {
        timeMin,
        timeMax,
        maxResults: 20,
      });
    } catch {
      todayEvents = [];
    }
  }

  return (
    <div className="pb-10">
      <section className="grid gap-4 lg:grid-cols-[1.35fr_1fr]">
        <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-violet-700">
                Agenda de hoje
              </p>
              <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
                {todayEvents.length === 0
                  ? "Nenhum compromisso hoje"
                  : `${todayEvents.length} ${todayEvents.length === 1 ? "compromisso" : "compromissos"}`}
              </h1>
            </div>
            <Link
              href="/agenda"
              className="rounded-xl bg-[#0b1f5e] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-800"
            >
              Abrir agenda
            </Link>
          </div>

          <div className="mt-4 space-y-2">
            {todayEvents.slice(0, 3).map((event) => (
              <div
                key={`${event.calendarKey}-${event.id}`}
                className="flex items-center gap-3 rounded-xl bg-slate-50 px-4 py-3"
              >
                <span className="w-16 shrink-0 text-sm font-semibold text-violet-700">
                  {formatEventTime(event)}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-900">{event.summary}</p>
                  <p className="truncate text-xs text-slate-400">
                    {event.location || event.calendarLabel}
                  </p>
                </div>
              </div>
            ))}

            {todayEvents.length === 0 && (
              <div className="rounded-xl border border-dashed border-slate-200 px-4 py-6 text-sm text-slate-400">
                O dia está livre na Agenda Google.
              </div>
            )}
          </div>
        </article>

        <article className="rounded-3xl border border-blue-100 bg-blue-50 p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-blue-700">
            Portal operacional
          </p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
            Módulos disponíveis
          </h2>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Compras agora possui página própria; Trello e extensão ficam como ações internas.
          </p>
          <div className="mt-5 grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-white p-4 shadow-sm">
              <p className="text-2xl font-semibold text-slate-950">6</p>
              <p className="mt-1 text-xs text-slate-500">módulos ativos</p>
            </div>
            <div className="rounded-xl bg-white p-4 shadow-sm">
              <p className="text-2xl font-semibold text-emerald-700">Online</p>
              <p className="mt-1 text-xs text-slate-500">acesso centralizado</p>
            </div>
          </div>
        </article>
      </section>

      <section className="mt-6 overflow-hidden rounded-3xl bg-[#0b1f5e] px-6 py-7 text-white shadow-lg sm:px-8">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-blue-200">
          Marco da implantação · Agosto de 2026
        </p>
        <blockquote className="mt-3 max-w-4xl text-xl font-semibold leading-relaxed tracking-tight sm:text-2xl">
          “A Casa Timoni inicia uma nova etapa: mais integrada, mais organizada e preparada para crescer com processos próprios.”
        </blockquote>
        <p className="mt-4 text-sm text-blue-100">
          Portal Timoni · Idealizado e conduzido por Ciça Rodini
        </p>
      </section>

      <section className="mt-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-blue-700">
            Acesso rápido
          </p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">
            Seus módulos
          </h2>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {modules.map((module) => {
            const className = `group rounded-3xl border p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-lg ${module.accent}`;
            const content = (
              <>
                <div className="flex items-start justify-between gap-3">
                  <span className="rounded-full bg-white px-3 py-1 text-[11px] font-semibold text-slate-600 shadow-sm">
                    {module.status}
                  </span>
                </div>
                <h3 className="mt-6 text-lg font-semibold text-slate-950">{module.name}</h3>
                <p className="mt-2 min-h-10 text-sm leading-5 text-slate-600">{module.description}</p>
                <p className="mt-5 text-xs font-semibold text-blue-800">Acessar módulo →</p>
              </>
            );

            return module.external ? (
              <a
                key={module.name}
                href={module.href}
                target="_blank"
                rel="noreferrer"
                className={className}
              >
                {content}
              </a>
            ) : (
              <Link key={module.name} href={module.href} className={className}>
                {content}
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
