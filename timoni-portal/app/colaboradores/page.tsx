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

function isMeetingForUnit(event: CalendarEventDTO, unit: "araras" | "rio claro") {
  const title = normalizeMeetingTitle(event.summary);
  return isPanelMeeting(event) && title.endsWith(` ${unit}`);
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

const empresasAtendimentoInterno = [
  "Brascabos",
  "Caprem",
  "Carbifibras",
  "Chemson",
  "Delta",
  "Embramaco",
  "Fastenal",
  "Jaw",
  "Owens Corning - Brasil GR",
  "Potencial",
  "Riclan",
  "Ruy Rocha",
  "Santa Casa",
  "Scoda",
  "Tigre",
  "Villagres",
  "Whirlpool",
];

function MeetingCard({ title, meeting }: { title: string; meeting?: CalendarEventDTO }) {
  return (
    <article className="rounded-3xl border border-violet-200 bg-violet-50 p-6 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wider text-violet-700">Reuniões</p>
      <h2 className="mt-3 text-xl font-semibold text-slate-950">{title}</h2>
      {meeting ? (
        <>
          <p className="mt-3 text-sm font-semibold text-violet-800">{formatDateTime(meeting)}</p>
          <p className="mt-2 text-sm leading-6 text-slate-600">{formatMeetingTitle(meeting.summary)}</p>
        </>
      ) : (
        <p className="mt-3 text-sm leading-6 text-slate-600">Nenhuma reunião programada.</p>
      )}
    </article>
  );
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

  const nextArarasMeeting = nextEvent(
    allEvents,
    (event) => isMeetingForUnit(event, "araras") && parseEventDate(event.start) >= now,
  );
  const nextRioClaroMeeting = nextEvent(
    allEvents,
    (event) => isMeetingForUnit(event, "rio claro") && parseEventDate(event.start) >= now,
  );
  const nextBirthday = nextEvent(
    timoniEvents,
    (event) => normalizeText(event.summary).includes("aniversario") && parseEventDate(event.start) >= now,
  );
  const nextVacation = nextEvent(
    timoniEvents,
    (event) => normalizeText(event.summary).includes("ferias") && parseEventDate(event.end) > now,
  );

  const canAccessStock = hasModuleAccess(email, "estoque");

  return (
    <div className="pb-10">
      <header className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-700">Comunicação interna</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Painel Timoni</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
          Informações essenciais para a equipe, sem excesso de conteúdo.
        </p>
      </header>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-3xl border border-blue-200 bg-blue-50 p-6 shadow-sm md:col-span-2 xl:col-span-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-blue-700">Comunicados</p>
              <h2 className="mt-3 text-xl font-semibold text-slate-950">Vendas Empresas</h2>
            </div>
            <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-blue-800 shadow-sm">Rio Claro · 06/08/2026</span>
          </div>
          <div className="mt-4 space-y-3 text-sm leading-6 text-slate-700">
            <p>
              As empresas relacionadas abaixo são atendidas exclusivamente por vendas internas e devem ser direcionadas para Jaqueline.
            </p>
            <p className="font-semibold text-slate-900">
              Qualquer orçamento que for passado pelo Balcão será desconsiderado.
            </p>
            <p>Esta orientação se deve à complexidade do atendimento destes clientes:</p>
            <ul className="list-disc space-y-1 pl-5">
              <li>Definição de produtos/serviços.</li>
              <li>Resposta direta no Portal.</li>
              <li>Negociação de preços com autorização exclusiva da Ciça, Marcelo ou Sérgio.</li>
            </ul>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-blue-700">Empresas</p>
              <ul className="mt-2 grid gap-x-4 gap-y-1 sm:grid-cols-2 lg:grid-cols-3">
                {empresasAtendimentoInterno.map((empresa) => (
                  <li key={empresa} className="rounded-lg bg-white/70 px-2 py-1 text-xs font-semibold text-slate-700">
                    {empresa}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </article>

        {canAccessStock ? (
          <Link
            href="/dashboard/estoque"
            className="rounded-3xl border border-emerald-200 bg-emerald-50 p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">Estoque</p>
            <h2 className="mt-3 text-xl font-semibold text-slate-950">Consulta de produtos</h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Consultar produtos e registrar necessidades da unidade.
            </p>
            <p className="mt-5 text-sm font-semibold text-blue-800">Acessar Estoque →</p>
          </Link>
        ) : (
          <article className="rounded-3xl border border-emerald-200 bg-emerald-50 p-6 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">Estoque</p>
            <h2 className="mt-3 text-xl font-semibold text-slate-950">Consulta de produtos</h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">Acesso disponível conforme liberação do Portal.</p>
          </article>
        )}

        <article className="min-h-44 rounded-3xl border border-blue-200 bg-blue-50 p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-blue-700">Comunicados</p>
              <h2 className="mt-3 text-xl font-semibold text-slate-950">Araras</h2>
            </div>
            <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-blue-800 shadow-sm">Araras</span>
          </div>
        </article>

        <MeetingCard title="Araras" meeting={nextArarasMeeting} />
        <MeetingCard title="Rio Claro" meeting={nextRioClaroMeeting} />

        <article className="rounded-3xl border border-pink-200 bg-pink-50 p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-pink-700">Aniversários</p>
          <h2 className="mt-3 text-xl font-semibold text-slate-950">
            {nextBirthday ? nextBirthday.summary.replace(/^anivers[aá]rio\s*/i, "") : "Nenhum aniversariante informado"}
          </h2>
          {nextBirthday && <p className="mt-3 text-sm text-slate-600">{formatDate(nextBirthday.start)}</p>}
        </article>

        <article className="rounded-3xl border border-amber-200 bg-amber-50 p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-amber-700">Férias</p>
          <h2 className="mt-3 text-xl font-semibold text-slate-950">
            {nextVacation ? nextVacation.summary.replace(/\s*-\s*f[eé]rias\s*$/i, "") : "Nenhum período programado"}
          </h2>
          {nextVacation && <p className="mt-3 text-sm text-slate-600">{formatDate(nextVacation.start)} a {formatDate(nextVacation.end)}</p>}
        </article>
      </section>

      <p className="mt-10 text-center text-xs text-slate-400">
        Idealizado por Ciça Rodini para fortalecer a comunicação interna da Casa Timoni.
      </p>
    </div>
  );
}
