import Link from "next/link";
import { auth } from "@/lib/auth";
import { listEventsInRange } from "@/lib/google-calendar";
import type { CalendarEventDTO } from "@/lib/types";

type IconName = "calendar" | "cart" | "box" | "truck" | "users" | "megaphone";

const modules: Array<{
  name: string;
  description: string;
  status: string;
  href?: string;
  icon: IconName;
  iconClass: string;
  accentClass: string;
}> = [
  {
    name: "Agenda da Ciça",
    description: "Compromissos, reuniões e atividades da semana.",
    status: "Disponível",
    href: "/agenda",
    icon: "calendar",
    iconClass: "bg-violet-100 text-violet-700",
    accentClass: "group-hover:border-violet-200",
  },
  {
    name: "Compras",
    description: "Pedidos, fornecedores, conferências e pendências.",
    status: "Prioridade",
    icon: "cart",
    iconClass: "bg-blue-100 text-blue-700",
    accentClass: "group-hover:border-blue-200",
  },
  {
    name: "Estoque",
    description: "Necessidades, rupturas e produtos aguardando compra.",
    status: "Em integração",
    icon: "box",
    iconClass: "bg-emerald-100 text-emerald-700",
    accentClass: "group-hover:border-emerald-200",
  },
  {
    name: "Motorista",
    description: "Entregas, retiradas, agenda e organização de rotas.",
    status: "Em integração",
    icon: "truck",
    iconClass: "bg-amber-100 text-amber-700",
    accentClass: "group-hover:border-amber-200",
  },
  {
    name: "Reuniões",
    description: "Decisões, registros e pendências de acompanhamento.",
    status: "Próxima etapa",
    icon: "users",
    iconClass: "bg-rose-100 text-rose-700",
    accentClass: "group-hover:border-rose-200",
  },
  {
    name: "Marketing",
    description: "Planejamento, campanhas e calendário de conteúdo.",
    status: "Próxima etapa",
    icon: "megaphone",
    iconClass: "bg-pink-100 text-pink-700",
    accentClass: "group-hover:border-pink-200",
  },
];

function ModuleIcon({ name }: { name: IconName }) {
  const paths: Record<IconName, React.ReactNode> = {
    calendar: (
      <>
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M16 3v4M8 3v4M3 10h18M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01" />
      </>
    ),
    cart: (
      <>
        <circle cx="9" cy="20" r="1" />
        <circle cx="19" cy="20" r="1" />
        <path d="M3 4h2l2.4 11.2a2 2 0 0 0 2 1.6h7.8a2 2 0 0 0 2-1.6L21 8H6" />
      </>
    ),
    box: (
      <>
        <path d="m21 8-9-5-9 5 9 5 9-5Z" />
        <path d="m3 8 9 5 9-5M3 8v8l9 5 9-5V8M12 13v8" />
      </>
    ),
    truck: (
      <>
        <path d="M3 6h11v11H3zM14 10h4l3 3v4h-7z" />
        <circle cx="7" cy="18" r="2" />
        <circle cx="18" cy="18" r="2" />
      </>
    ),
    users: (
      <>
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8" />
      </>
    ),
    megaphone: (
      <>
        <path d="m3 11 18-5v12L3 14v-3Z" />
        <path d="M11.6 16.1 13 21H7l-1.8-6.2M21 10v4" />
      </>
    ),
  };

  return (
    <svg
      viewBox="0 0 24 24"
      className="h-6 w-6"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      {paths[name]}
    </svg>
  );
}

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
  const tomorrow = tomorrowDate.toISOString().slice(0, 10);

  return {
    timeMin: `${date}T00:00:00-03:00`,
    timeMax: `${tomorrow}T00:00:00-03:00`,
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
      <section className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-violet-600">
                Sua agenda
              </p>
              <h2 className="mt-1 text-xl font-semibold text-slate-900">
                {todayEvents.length === 0
                  ? "Nenhum compromisso hoje"
                  : `${todayEvents.length} ${
                      todayEvents.length === 1 ? "compromisso" : "compromissos"
                    } hoje`}
              </h2>
            </div>

            <Link
              href="/agenda"
              className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
            >
              Abrir agenda
            </Link>
          </div>

          <div className="mt-5 space-y-2">
            {todayEvents.slice(0, 3).map((event) => (
              <div
                key={`${event.calendarKey}-${event.id}`}
                className="flex items-center gap-3 rounded-2xl bg-slate-50 px-4 py-3"
              >
                <span className="w-14 text-sm font-semibold text-violet-700">
                  {formatEventTime(event)}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-900">
                    {event.summary}
                  </p>
                  <p className="truncate text-xs text-slate-400">
                    {event.location || event.calendarLabel}
                  </p>
                </div>
              </div>
            ))}

            {todayEvents.length === 0 && (
              <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-5 text-sm text-slate-400">
                Seu dia está livre na Agenda Google.
              </div>
            )}
          </div>
        </div>

        <div className="rounded-3xl border border-blue-100 bg-blue-50 p-6">
          <p className="text-xs font-semibold uppercase tracking-wider text-blue-700">
            Foco atual
          </p>
          <h2 className="mt-2 text-xl font-semibold text-slate-900">
            Estratégia de Compras
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Compras é o primeiro módulo a ser conectado aos dados reais do Portal Timoni.
          </p>
          <div className="mt-5 rounded-2xl bg-white px-4 py-3 shadow-sm">
            <p className="text-xs text-slate-400">Próxima integração</p>
            <p className="mt-1 text-sm font-medium text-slate-800">
              Pendências, pedidos e conferências
            </p>
          </div>
        </div>
      </section>

      <section className="mt-8">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-blue-600">
              Acesso rápido
            </p>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">
              Seus módulos
            </h2>
          </div>
          <span className="hidden text-xs text-slate-400 sm:inline">
            Acesso exclusivo
          </span>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {modules.map((module) => {
            const card = (
              <>
                <div className="flex items-start justify-between gap-3">
                  <span
                    className={`flex h-12 w-12 items-center justify-center rounded-2xl ${module.iconClass}`}
                  >
                    <ModuleIcon name={module.icon} />
                  </span>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-500">
                    {module.status}
                  </span>
                </div>

                <h3 className="mt-5 text-base font-semibold text-slate-900">
                  {module.name}
                </h3>
                <p className="mt-1.5 text-sm leading-5 text-slate-500">
                  {module.description}
                </p>
                <p className="mt-5 text-xs font-semibold text-blue-700">
                  {module.href ? "Acessar módulo →" : "Em preparação"}
                </p>
              </>
            );

            return module.href ? (
              <Link
                key={module.name}
                href={module.href}
                className={`group rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-lg ${module.accentClass}`}
              >
                {card}
              </Link>
            ) : (
              <article
                key={module.name}
                className="rounded-3xl border border-slate-200 bg-white p-5 opacity-90 shadow-sm"
              >
                {card}
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}
