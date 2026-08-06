import Link from "next/link";
import { auth } from "@/lib/auth";
import { hasModuleAccess } from "@/lib/access-control";
import { listEventsInRange } from "@/lib/google-calendar";
import type { CalendarEventDTO } from "@/lib/types";

type PanelStore = "geral" | "rio claro" | "araras";

type FixedMeeting = {
  summary: string;
  start: string;
  label: string;
};

type PanelDateItem = {
  id: string;
  summary: string;
  start: string;
  end?: string;
};

function normalizeText(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function normalizeMeetingTitle(value: string) {
  return normalizeText(value).replace(/\s+/g, " ").trim();
}

function getPanelStore(email: string): PanelStore {
  const normalized = email.trim().toLowerCase();

  if (["mcrodini@gmail.com", "mrodini@gmail.com"].includes(normalized)) {
    return "geral";
  }

  if (["reginaldo@casatimoni.com.br", "comercialara@casatimoni.com.br", "fotoscasatimoni@gmail.com"].includes(normalized)) {
    return "araras";
  }

  return "rio claro";
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

function formatFixedMeetingDateTime(meeting: FixedMeeting) {
  const date = parseEventDate(meeting.start);
  const weekday = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    weekday: "long",
  }).format(date);
  const time = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);

  return `${formatDate(date)} · ${weekday} · ${time}`;
}

function formatMeetingTitle(summary: string) {
  return summary.replace(/^ci[cç]a\s*[-–—]\s*/i, "").trim();
}

function nextEvent(events: CalendarEventDTO[], predicate: (event: CalendarEventDTO) => boolean) {
  return events
    .filter(predicate)
    .sort((a, b) => parseEventDate(a.start).getTime() - parseEventDate(b.start).getTime())[0];
}

function upcomingEvents(events: CalendarEventDTO[], predicate: (event: CalendarEventDTO) => boolean, limit = 4) {
  const now = new Date();
  return events
    .filter((event) => predicate(event) && parseEventDate(event.start) >= now)
    .sort((a, b) => parseEventDate(a.start).getTime() - parseEventDate(b.start).getTime())
    .slice(0, limit);
}

function isBirthday(event: CalendarEventDTO) {
  const title = normalizeText(event.summary);
  return title.includes("aniversario") || title.includes("aniversariante") || title.includes("birthday");
}

function isVacation(event: CalendarEventDTO) {
  const title = normalizeText(event.summary);
  return title.includes("ferias") || title.includes("férias");
}

function calendarEventToPanelItem(event: CalendarEventDTO): PanelDateItem {
  return {
    id: `${event.calendarKey}-${event.id}`,
    summary: event.summary,
    start: event.start,
    end: event.end,
  };
}

function uniqueDateItems(items: PanelDateItem[], limit = 6) {
  const seen = new Set<string>();

  return items
    .sort((a, b) => parseEventDate(a.start).getTime() - parseEventDate(b.start).getTime())
    .filter((item) => {
      const key = `${normalizeText(item.summary)}-${formatDate(item.start)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, limit);
}

const fixedArarasMeeting: FixedMeeting = {
  summary: "Reunião Araras",
  start: "2026-09-08T07:30:00-03:00",
  label: "Próxima reunião já agendada",
};

const fixedPanelBirthdays: PanelDateItem[] = [
  { id: "reinaldo-araras", summary: "Reinaldo (Araras)", start: "2026-08-13" },
  { id: "thais", summary: "Thais", start: "2026-08-19" },
  { id: "maria-carolina-araras", summary: "Maria Carolina (Araras)", start: "2026-08-30" },
  { id: "joao-aniversario-loja", summary: "João aniversário de loja", start: "2026-09-01" },
];

const fixedPanelVacations: PanelDateItem[] = [
  { id: "leopoldo", summary: "Leopoldo", start: "2026-08-03", end: "2026-08-23" },
];

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

function StockFlow() {
  return (
    <div className="mt-6 border-t border-emerald-200 pt-5">
      <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">Fluxo do Estoque</p>
      <h3 className="mt-2 text-base font-semibold text-slate-950">Solicitação de produto</h3>
      <ol className="mt-3 space-y-2 text-sm leading-6 text-slate-700">
        <li><strong>1.</strong> Consultar pelo código ou descrição.</li>
        <li><strong>2.</strong> Informar quantidade e unidade.</li>
        <li><strong>3.</strong> Registrar a necessidade.</li>
        <li><strong>4.</strong> Acompanhar o status até finalizar.</li>
      </ol>
    </div>
  );
}

function AnnouncementCard({ store, compact = false }: { store: "rio claro" | "araras"; compact?: boolean }) {
  const isRioClaro = store === "rio claro";

  return (
    <article className={`rounded-3xl border border-blue-200 bg-blue-50 p-6 shadow-sm ${compact ? "" : "md:col-span-2 xl:col-span-3"}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-blue-700">Comunicados</p>
          <h2 className="mt-3 text-xl font-semibold text-slate-950">
            {isRioClaro ? "Vendas Empresas" : "Araras"}
          </h2>
        </div>
        <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-blue-800 shadow-sm">
          {isRioClaro ? "Rio Claro · 06/08/2026" : "Araras"}
        </span>
      </div>

      {isRioClaro ? (
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
      ) : (
        <div className="mt-4 rounded-2xl bg-white/70 p-4 text-sm leading-6 text-slate-700">
          Nenhum comunicado publicado para Araras neste momento.
        </div>
      )}
    </article>
  );
}

function MeetingCard({ title, meeting, fixedMeeting }: { title: string; meeting?: CalendarEventDTO; fixedMeeting?: FixedMeeting }) {
  return (
    <article className="rounded-3xl border border-violet-200 bg-violet-50 p-6 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wider text-violet-700">Reuniões</p>
      <h2 className="mt-3 text-xl font-semibold text-slate-950">{title}</h2>
      {meeting ? (
        <>
          <p className="mt-3 text-sm font-semibold text-violet-800">{formatDateTime(meeting)}</p>
          <p className="mt-2 text-sm leading-6 text-slate-600">{formatMeetingTitle(meeting.summary)}</p>
        </>
      ) : fixedMeeting ? (
        <>
          <p className="mt-3 text-sm font-semibold text-violet-800">{formatFixedMeetingDateTime(fixedMeeting)}</p>
          <p className="mt-2 text-sm leading-6 text-slate-600">{fixedMeeting.label}</p>
        </>
      ) : (
        <p className="mt-3 text-sm leading-6 text-slate-600">Nenhuma reunião programada.</p>
      )}
    </article>
  );
}

function EventListCard({
  title,
  tone,
  events,
  emptyMessage,
  formatSummary,
}: {
  title: string;
  tone: "pink" | "amber";
  events: PanelDateItem[];
  emptyMessage: string;
  formatSummary: (summary: string) => string;
}) {
  const toneClass = tone === "pink"
    ? "border-pink-200 bg-pink-50 text-pink-700"
    : "border-amber-200 bg-amber-50 text-amber-700";

  return (
    <article className={`rounded-3xl border p-6 shadow-sm ${toneClass}`}>
      <p className="text-xs font-semibold uppercase tracking-wider">{title}</p>
      {events.length ? (
        <ul className="mt-3 space-y-3">
          {events.map((event) => (
            <li key={event.id} className="rounded-2xl bg-white/70 p-3 text-slate-700">
              <p className="text-base font-semibold text-slate-950">{formatSummary(event.summary)}</p>
              <p className="mt-1 text-sm text-slate-600">
                {title === "Férias" && event.end ? `${formatDate(event.start)} a ${formatDate(event.end)}` : formatDate(event.start)}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <h2 className="mt-3 text-xl font-semibold text-slate-950">{emptyMessage}</h2>
      )}
    </article>
  );
}

function StoreLabel({ store }: { store: PanelStore }) {
  if (store === "geral") return <span>Visão geral · Rio Claro e Araras</span>;
  return <span>Loja: {store === "araras" ? "Araras" : "Rio Claro"}</span>;
}

export default async function ColaboradoresPage() {
  const session = await auth();
  const email = session?.user?.email ?? "";
  const panelStore = getPanelStore(email);
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
  const calendarBirthdays = upcomingEvents(timoniEvents, isBirthday).map(calendarEventToPanelItem);
  const calendarVacations = timoniEvents
    .filter((event) => isVacation(event) && parseEventDate(event.end) > now)
    .sort((a, b) => parseEventDate(a.start).getTime() - parseEventDate(b.start).getTime())
    .map(calendarEventToPanelItem);
  const birthdays = uniqueDateItems([...fixedPanelBirthdays, ...calendarBirthdays]);
  const vacations = uniqueDateItems([...fixedPanelVacations, ...calendarVacations]);

  const canAccessStock = hasModuleAccess(email, "estoque");
  const showRioClaro = panelStore === "geral" || panelStore === "rio claro";
  const showAraras = panelStore === "geral" || panelStore === "araras";
  const mainStore = panelStore === "araras" ? "araras" : "rio claro";

  return (
    <div className="pb-10">
      <header className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-700">Comunicação interna</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Painel Timoni</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
          <StoreLabel store={panelStore} />
        </p>
      </header>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <AnnouncementCard store={mainStore} />

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
            <StockFlow />
          </Link>
        ) : (
          <article className="rounded-3xl border border-emerald-200 bg-emerald-50 p-6 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">Estoque</p>
            <h2 className="mt-3 text-xl font-semibold text-slate-950">Consulta de produtos</h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">Acesso disponível conforme liberação do Portal.</p>
            <StockFlow />
          </article>
        )}

        {panelStore === "geral" && <AnnouncementCard store="araras" compact />}
        {showAraras && <MeetingCard title="Araras" meeting={nextArarasMeeting} fixedMeeting={fixedArarasMeeting} />}
        {showRioClaro && <MeetingCard title="Rio Claro" meeting={nextRioClaroMeeting} />}

        <EventListCard
          title="Aniversários"
          tone="pink"
          events={birthdays}
          emptyMessage="Nenhum aniversariante informado"
          formatSummary={(summary) => summary.replace(/^anivers[aá]rio\s*/i, "")}
        />

        <EventListCard
          title="Férias"
          tone="amber"
          events={vacations}
          emptyMessage="Nenhum período programado"
          formatSummary={(summary) => summary.replace(/\s*-\s*f[eé]rias\s*$/i, "")}
        />
      </section>

      <p className="mt-10 text-center text-xs text-slate-400">
        Idealizado por Ciça Rodini para fortalecer a comunicação interna da Casa Timoni.
      </p>
    </div>
  );
}
