import Link from "next/link";
import { auth } from "@/lib/auth";
import { hasModuleAccess } from "@/lib/access-control";
import { listEventsInRange } from "@/lib/google-calendar";
import type { CalendarEventDTO } from "@/lib/types";

function normalizeText(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function normalizeMeetingTitle(value: string) {
  return normalizeText(value).replace(/\s+/g, " ").trim();
}

function isPanelMeeting(event: CalendarEventDTO) {
  const title = normalizeMeetingTitle(event.summary);
  return (
    title.startsWith("reuniao ") &&
    (title.endsWith(" araras") || title.endsWith(" rio claro"))
  );
}

function isMeetingForUnit(event: CalendarEventDTO, unit: "rio claro" | "araras") {
  return isPanelMeeting(event) && normalizeMeetingTitle(event.summary).endsWith(` ${unit}`);
}

function parseEventDate(value: string) {
  return new Date(value.includes("T") ? value : `${value}T12:00:00-03:00`);
}

function formatDate(value: string | Date) {
  const date = typeof value === "string" ? parseEventDate(value) : value;
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function formatDateTime(event: CalendarEventDTO) {
  if (!event.start.includes("T")) return formatDate(event.start);
  const time = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
  }).format(parseEventDate(event.start));
  return `${formatDate(event.start)} às ${time}`;
}

function formatMeetingTitle(summary: string) {
  return summary.replace(/^ci[cç]a\s*[-–—]\s*/i, "").trim();
}

function nextEvent(events: CalendarEventDTO[], predicate: (event: CalendarEventDTO) => boolean) {
  return events
    .filter(predicate)
    .sort((a, b) => parseEventDate(a.start).getTime() - parseEventDate(b.start).getTime())[0];
}

function nextMeetings(events: CalendarEventDTO[], now: Date) {
  const ordered = events
    .filter((event) => isPanelMeeting(event) && parseEventDate(event.start) >= now)
    .sort((a, b) => parseEventDate(a.start).getTime() - parseEventDate(b.start).getTime());

  const unique = new Map<string, CalendarEventDTO>();
  for (const event of ordered) {
    const key = `${normalizeMeetingTitle(event.summary)}|${event.start}`;
    if (!unique.has(key)) unique.set(key, event);
  }

  return Array.from(unique.values()).slice(0, 2);
}

export default async function ColaboradoresPage() {
  const session = await auth();
  const email = session?.user?.email ?? "";
  const now = new Date();
  let allEvents: CalendarEventDTO[] = [];
  let timoniEvents: CalendarEventDTO[] = [];

  if (session?.accessToken && session.error !== "RefreshAccessTokenError") {
    try {
      const timeMin = new Date(now);
      timeMin.setDate(timeMin.getDate() - 45);
      const timeMax = new Date(now);
      timeMax.setFullYear(timeMax.getFullYear() + 1);
      allEvents = await listEventsInRange(session.accessToken, {
        timeMin: timeMin.toISOString(),
        timeMax: timeMax.toISOString(),
        maxResults: 500,
      });
      timoniEvents = allEvents.filter((event) => event.calendarKey === "timoni");
    } catch {
      allEvents = [];
      timoniEvents = [];
    }
  }

  const meetings = nextMeetings(allEvents, now);
  const nextBirthday = nextEvent(
    timoniEvents,
    (event) => normalizeText(event.summary).includes("aniversario") && parseEventDate(event.start) >= now,
  );
  const nextVacation = nextEvent(
    timoniEvents,
    (event) => normalizeText(event.summary).includes("ferias") && parseEventDate(event.end) > now,
  );
  const nextRioClaroMeeting = nextEvent(
    allEvents,
    (event) => isMeetingForUnit(event, "rio claro") && parseEventDate(event.start) >= now,
  );
  const nextArarasMeeting = nextEvent(
    allEvents,
    (event) => isMeetingForUnit(event, "araras") && parseEventDate(event.start) >= now,
  );

  const unitCards = [
    {
      title: "Rio Claro",
      meeting: nextRioClaroMeeting,
      description: "Comunicação, reunião e acompanhamento da operação de Rio Claro.",
      className: "border-blue-200 bg-blue-50",
    },
    {
      title: "Araras",
      meeting: nextArarasMeeting,
      description: "Comunicação, reunião e acompanhamento da operação de Araras.",
      className: "border-amber-200 bg-amber-50",
    },
  ];

  const quickLinks = [
    hasModuleAccess(email, "estoque") && {
      title: "Estoque",
      description: "Consultar produtos e registrar necessidades.",
      href: "/dashboard/estoque",
      className: "border-emerald-200 bg-emerald-50",
    },
    hasModuleAccess(email, "motorista") && {
      title: "Agenda do Motorista",
      description: "Organizar entregas, retiradas e viagens compartilhadas entre Rio Claro e Araras.",
      href: "/agenda-motorista/",
      className: "border-amber-200 bg-amber-50",
    },
  ].filter(Boolean) as Array<{ title: string; description: string; href: string; className: string }>;

  return (
    <div className="pb-10">
      <header className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-700">Comunicação interna</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Painel Timoni</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
          Informações essenciais para a equipe, separadas por unidade quando necessário.
        </p>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-3xl border border-blue-200 bg-blue-50 p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-blue-700">Comunicados novos</p>
          <h2 className="mt-3 text-xl font-semibold text-slate-950">Bem-vindo ao Painel Timoni</h2>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Este é o canal oficial de comunicação interna da Casa Timoni.
          </p>
          <p className="mt-5 text-xs font-medium text-slate-500">Publicado em 02/08/2026</p>
        </article>

        <article className="rounded-3xl border border-violet-200 bg-violet-50 p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-violet-700">Próximas reuniões</p>
          {meetings.length ? (
            <div className="mt-3 divide-y divide-violet-200">
              {meetings.map((meeting) => (
                <div key={`${meeting.id}-${meeting.start}`} className="py-3 first:pt-0 last:pb-0">
                  <h2 className="text-lg font-semibold text-slate-950">
                    {formatMeetingTitle(meeting.summary)}
                  </h2>
                  <p className="mt-2 text-sm font-semibold text-violet-800">{formatDateTime(meeting)}</p>
                </div>
              ))}
            </div>
          ) : (
            <h2 className="mt-3 text-xl font-semibold text-slate-950">Nenhuma reunião programada</h2>
          )}
        </article>

        <article className="rounded-3xl border border-pink-200 bg-pink-50 p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-pink-700">Aniversariante</p>
          <h2 className="mt-3 text-xl font-semibold text-slate-950">
            {nextBirthday ? nextBirthday.summary.replace(/^anivers[aá]rio\s*/i, "") : "Nenhum aniversariante informado"}
          </h2>
          {nextBirthday && <p className="mt-3 text-sm text-slate-600">{formatDate(nextBirthday.start)}</p>}
        </article>

        <article className="rounded-3xl border border-emerald-200 bg-emerald-50 p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">Férias</p>
          <h2 className="mt-3 text-xl font-semibold text-slate-950">
            {nextVacation ? nextVacation.summary.replace(/\s*-\s*f[eé]rias\s*$/i, "") : "Nenhum período programado"}
          </h2>
          {nextVacation && <p className="mt-3 text-sm text-slate-600">{formatDate(nextVacation.start)} a {formatDate(nextVacation.end)}</p>}
        </article>
      </section>

      <section className="mt-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-blue-700">Unidades</p>
        <div className="mt-3 grid gap-4 md:grid-cols-2">
          {unitCards.map((item) => (
            <article key={item.title} className={`rounded-3xl border p-6 shadow-sm ${item.className}`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-600">Unidade</p>
                  <h2 className="mt-2 text-2xl font-semibold text-slate-950">{item.title}</h2>
                </div>
                <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-blue-800 shadow-sm">Painel</span>
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-600">{item.description}</p>
              <div className="mt-5 rounded-2xl bg-white/70 p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Próxima reunião</p>
                {item.meeting ? (
                  <>
                    <h3 className="mt-2 text-base font-semibold text-slate-950">{formatMeetingTitle(item.meeting.summary)}</h3>
                    <p className="mt-1 text-sm font-semibold text-blue-800">{formatDateTime(item.meeting)}</p>
                  </>
                ) : (
                  <p className="mt-2 text-sm font-semibold text-slate-700">Nenhuma reunião programada</p>
                )}
              </div>
            </article>
          ))}
        </div>
      </section>

      {quickLinks.length > 0 && (
        <section className="mt-6">
          <p className="text-xs font-semibold uppercase tracking-wider text-blue-700">Acessos rápidos</p>
          <div className="mt-3 grid gap-4 md:grid-cols-2">
            {quickLinks.map((item) => (
              <Link
                key={item.title}
                href={item.href}
                className={`rounded-3xl border p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${item.className}`}
              >
                <h2 className="text-xl font-semibold text-slate-950">{item.title}</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">{item.description}</p>
                <p className="mt-5 text-sm font-semibold text-blue-800">Acessar módulo →</p>
              </Link>
            ))}
          </div>
        </section>
      )}

      <p className="mt-10 text-center text-xs text-slate-400">
        Idealizado por Ciça Rodini para fortalecer a comunicação interna da Casa Timoni.
      </p>
    </div>
  );
}
