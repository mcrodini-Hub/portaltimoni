import { auth } from "@/lib/auth";
import { listEventsInRange } from "@/lib/google-calendar";
import type { CalendarEventDTO } from "@/lib/types";

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function parseEventDate(value: string) {
  return new Date(value.includes("T") ? value : `${value}T12:00:00-03:00`);
}

function startOfToday() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return new Date(`${values.year}-${values.month}-${values.day}T00:00:00-03:00`);
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
  const date = formatDate(event.start);
  if (!event.start.includes("T")) return date;

  const time = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
  }).format(parseEventDate(event.start));

  return `${date} às ${time}`;
}

function formatVacationPeriod(event: CalendarEventDTO) {
  const end = parseEventDate(event.end);
  if (!event.end.includes("T")) end.setDate(end.getDate() - 1);
  return `${formatDate(event.start)} a ${formatDate(end)}`;
}

function birthdayName(summary: string) {
  return summary
    .replace(/^anivers[aá]rio\s*/i, "")
    .replace(/^aivers[aá]rio\s*/i, "")
    .trim();
}

function vacationName(summary: string) {
  return summary.replace(/\s*-\s*f[eé]rias\s*$/i, "").trim();
}

function nextEvent(
  events: CalendarEventDTO[],
  predicate: (event: CalendarEventDTO) => boolean,
) {
  return events
    .filter(predicate)
    .sort((a, b) => parseEventDate(a.start).getTime() - parseEventDate(b.start).getTime())[0];
}

export default async function ColaboradoresPage() {
  const session = await auth();
  const now = new Date();
  const today = startOfToday();
  let timoniEvents: CalendarEventDTO[] = [];

  if (session?.accessToken && session.error !== "RefreshAccessTokenError") {
    try {
      const timeMin = new Date(now);
      timeMin.setDate(timeMin.getDate() - 45);

      const timeMax = new Date(now);
      timeMax.setFullYear(timeMax.getFullYear() + 1);
      timeMax.setDate(timeMax.getDate() + 10);

      const events = await listEventsInRange(session.accessToken, {
        timeMin: timeMin.toISOString(),
        timeMax: timeMax.toISOString(),
        maxResults: 500,
      });

      timoniEvents = events.filter((event) => event.calendarKey === "timoni");
    } catch {
      timoniEvents = [];
    }
  }

  const nextMeeting = nextEvent(
    timoniEvents,
    (event) =>
      normalizeText(event.summary).includes("reuniao") &&
      parseEventDate(event.start).getTime() >= now.getTime(),
  );

  const nextBirthday = nextEvent(timoniEvents, (event) => {
    const title = normalizeText(event.summary);
    return (
      (title.includes("aniversario") || title.includes("aiversario")) &&
      !title.includes("loja") &&
      parseEventDate(event.start).getTime() >= today.getTime()
    );
  });

  const nextVacation = nextEvent(
    timoniEvents,
    (event) =>
      normalizeText(event.summary).includes("ferias") &&
      parseEventDate(event.end).getTime() > now.getTime(),
  );

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
        <p className="mt-1 text-xs text-slate-400">
          Reuniões, aniversários e férias atualizados pela TIMONI AGENDA.
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
            {nextMeeting?.summary || "Nenhuma reunião programada"}
          </h2>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            {nextMeeting
              ? nextMeeting.location || "Consulte a TIMONI AGENDA para os detalhes."
              : "As próximas reuniões aparecerão aqui."}
          </p>
          {nextMeeting && (
            <p className="mt-5 text-sm font-semibold text-violet-800">
              {formatDateTime(nextMeeting)}
            </p>
          )}
        </article>

        <article
          id="aniversariante"
          className="rounded-3xl border border-pink-200 bg-pink-50 p-6 shadow-sm"
        >
          <p className="text-xs font-semibold uppercase tracking-wider text-pink-700">
            Aniversariante
          </p>
          <h2 className="mt-3 text-xl font-semibold text-slate-950">
            {nextBirthday ? birthdayName(nextBirthday.summary) : "Nenhum aniversariante informado"}
          </h2>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            {nextBirthday
              ? `Próximo aniversário em ${formatDate(nextBirthday.start)}.`
              : "O próximo aniversariante da equipe aparecerá aqui."}
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
            {nextVacation ? vacationName(nextVacation.summary) : "Nenhum período programado"}
          </h2>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            {nextVacation
              ? formatVacationPeriod(nextVacation)
              : "Os próximos períodos de férias da equipe aparecerão aqui."}
          </p>
        </article>
      </section>

      <section className="mt-4 grid gap-4 md:grid-cols-2">
        <article
          id="processos"
          className="rounded-3xl border border-amber-200 bg-amber-50 p-5 shadow-sm"
        >
          <p className="text-xs font-semibold uppercase tracking-wider text-amber-800">
            Processos
          </p>
          <h2 className="mt-2 text-lg font-semibold text-slate-950">
            Regras e orientações internas
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Os processos oficiais serão publicados de forma resumida e atualizada.
          </p>
        </article>

        <article
          id="boas-vindas"
          className="rounded-3xl border border-cyan-200 bg-cyan-50 p-5 shadow-sm"
        >
          <p className="text-xs font-semibold uppercase tracking-wider text-cyan-800">
            Boas-vindas
          </p>
          <h2 className="mt-2 text-lg font-semibold text-slate-950">
            Nenhum novo colaborador informado
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Novos integrantes serão apresentados aqui com nome, função e unidade.
          </p>
        </article>
      </section>
    </div>
  );
}
