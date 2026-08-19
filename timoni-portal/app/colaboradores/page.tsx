import { auth } from "@/lib/auth";
import { listEventsInRange } from "@/lib/google-calendar";
import type { CalendarEventDTO } from "@/lib/types";
import ComunicadosFeed from "@/app/colaboradores/comunicados-feed";
import ComunicadosAdmin from "@/app/colaboradores/comunicados-admin";

type PanelStore = "geral" | "rio claro" | "araras";
type Store = "rio claro" | "araras";
type AnnouncementVariant = "large" | "compact" | "full";

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

function getPanelStore(email: string): PanelStore {
  const normalized = email.trim().toLowerCase();
  if (["mcrodini@gmail.com", "mrodini@gmail.com"].includes(normalized)) return "geral";
  if ([
    "estoqueararascasatimoni@gmail.com",
    "comercialara@casatimoni.com.br",
    "fotoscasatimoni@gmail.com",
    "reginaldo@casatimoni.com.br",
    "casatimoniararas@gmail.com",
  ].includes(normalized)) return "araras";
  return "rio claro";
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
  return normalizeText(event.summary).includes("ferias");
}

function calendarEventToPanelItem(event: CalendarEventDTO): PanelDateItem {
  return {
    id: `${event.calendarKey}-${event.id}`,
    summary: event.summary,
    start: event.start,
    end: event.end,
  };
}

function cleanPanelSummary(summary: string) {
  return summary
    .replace(/^anivers[aá]rio\s*/i, "")
    .replace(/\s*-\s*f[eé]rias\s*$/i, "")
    .trim();
}

function uniqueDateItems(items: PanelDateItem[], limit = 6) {
  const seen = new Set<string>();
  return items
    .sort((a, b) => parseEventDate(a.start).getTime() - parseEventDate(b.start).getTime())
    .filter((item) => {
      const key = `${normalizeText(cleanPanelSummary(item.summary))}-${formatDate(item.start)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, limit);
}

const fixedMeetingSchedule: Record<Store, FixedMeeting[]> = {
  araras: [
    { summary: "Reunião Araras", start: "2026-09-08T07:40:00-03:00", label: "Próxima" },
    { summary: "Reunião Araras", start: "2026-10-09T07:40:00-03:00", label: "Seguinte" },
  ],
  "rio claro": [
    { summary: "Reunião Rio Claro", start: "2026-08-08T07:30:00-03:00", label: "Próxima" },
    { summary: "Reunião Rio Claro", start: "2026-09-03T07:30:00-03:00", label: "Seguinte" },
  ],
};

function getUpcomingFixedMeetings(reference: Date, unit: Store) {
  return fixedMeetingSchedule[unit]
    .filter((meeting) => new Date(parseEventDate(meeting.start).getTime() + 60 * 60 * 1000) > reference)
    .slice(0, 2);
}

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

const announcementByStore = {
  "rio claro": {
    label: "Rio Claro",
    title: "Comunicados Rio Claro",
    logins: [],
  },
  araras: {
    label: "Araras",
    title: "Comunicados Araras",
    logins: [
      "fotoscasatimoni@gmail.com",
      "estoqueararascasatimoni@gmail.com",
      "comercialara@casatimoni.com.br",
      "reginaldo@casatimoni.com.br",
      "casatimoniararas@gmail.com",
    ],
  },
} satisfies Record<Store, { label: string; title: string; logins: string[] }>;

function NewToolAnnouncement({ store }: { store: Store }) {
  const announcement = announcementByStore[store];

  return (
    <div className="rounded-2xl bg-white/70 p-4 text-sm leading-6 text-slate-700">
      <p className="text-xs font-semibold uppercase tracking-wider text-blue-700">Comunicado 1</p>
      <h3 className="mt-1 text-lg font-semibold text-slate-950">Nova Ferramenta: Painel Timoni</h3>
      <p className="mt-2 line-clamp-3">
        Esta é a nova comunicação interna da Casa Timoni para avisos e informações da equipe.
      </p>
      <details className="mt-3 group">
        <summary className="cursor-pointer text-sm font-semibold text-blue-800 marker:text-blue-800">Ver comunicado completo →</summary>
        <div className="mt-3 space-y-4 border-t border-blue-100 pt-3">
          <p className="font-semibold italic text-slate-950">Esta é a nova comunicação interna da Casa Timoni.</p>
          <p>
            O Painel Timoni passa a concentrar avisos, comunicados, reuniões, aniversários, férias e informações importantes para a equipe.
          </p>
          {announcement.logins.length > 0 && (
            <div>
              <p className="font-semibold text-slate-950">Logins de acesso:</p>
              <div className="mt-2 space-y-1 font-medium text-slate-800">
                {announcement.logins.map((login) => <p key={login}>{login}</p>)}
              </div>
            </div>
          )}
        </div>
      </details>
    </div>
  );
}

function VendasEmpresasCard() {
  return (
    <div className="rounded-2xl bg-white/70 p-4 text-sm leading-6 text-slate-700">
      <p className="text-xs font-semibold uppercase tracking-wider text-blue-700">Comunicado 2</p>
      <h3 className="mt-1 text-lg font-semibold text-slate-950">Vendas Empresas</h3>
      <p className="mt-2 line-clamp-3">As empresas relacionadas abaixo são atendidas exclusivamente por vendas internas.</p>
      <details className="mt-3 group">
        <summary className="cursor-pointer text-sm font-semibold text-blue-800 marker:text-blue-800">Ver comunicado completo →</summary>
        <div className="mt-3 space-y-3 border-t border-blue-100 pt-3">
          <p>As empresas relacionadas abaixo são atendidas exclusivamente por vendas internas.</p>
          <p>Todo atendimento, orçamento ou negociação destes clientes deve ser direcionado para <strong>Jaqueline</strong>.</p>
          <p className="font-semibold text-slate-900">Qualquer orçamento feito fora deste fluxo será desconsiderado.</p>
          <p>Esta orientação existe porque estes clientes exigem acompanhamento específico, definição correta de produtos/serviços e negociação de condições comerciais com autorização da gestão.</p>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-blue-700">Empresas</p>
            <ul className="mt-2 grid gap-x-4 gap-y-1 sm:grid-cols-2 lg:grid-cols-3">
              {empresasAtendimentoInterno.map((empresa) => (
                <li key={empresa} className="rounded-lg bg-white/70 px-2 py-1 text-xs font-semibold text-slate-700">{empresa}</li>
              ))}
            </ul>
          </div>
        </div>
      </details>
    </div>
  );
}

function AnnouncementCard({ store, variant = "large" }: { store: Store; variant?: AnnouncementVariant }) {
  const spanClass = variant === "full" ? "md:col-span-2 xl:col-span-4" : variant === "compact" ? "" : "md:col-span-2 xl:col-span-3";
  const announcement = announcementByStore[store];

  return (
    <article className={`rounded-3xl border border-blue-200 bg-blue-50 p-6 shadow-sm ${spanClass}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-blue-700">Comunicados</p>
          <h2 className="mt-3 text-xl font-semibold text-slate-950">{announcement.title}</h2>
        </div>
        <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-blue-800 shadow-sm">
          {announcement.label}
        </span>
      </div>

      <div className="mt-4 space-y-4">
        <NewToolAnnouncement store={store} />
        {store === "rio claro" && <VendasEmpresasCard />}
      </div>
    </article>
  );
}

function MeetingCard({ title, meetings }: { title: string; meetings: FixedMeeting[] }) {
  return (
    <article className="rounded-3xl border border-violet-200 bg-violet-50 p-6 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wider text-violet-700">Reuniões</p>
      <h2 className="mt-3 text-xl font-semibold text-slate-950">{title}</h2>
      {meetings.length ? (
        <div className="mt-3 space-y-3">
          {meetings.map((meeting, index) => (
            <div key={meeting.start} className={index ? "border-t border-violet-200 pt-3" : ""}>
              <p className="text-xs font-semibold uppercase tracking-wider text-violet-700">{index === 0 ? "Próxima" : "Seguinte"}</p>
              <p className="mt-1 text-sm font-semibold text-violet-800">{formatFixedMeetingDateTime(meeting)}</p>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-3 text-sm leading-6 text-slate-600">Nenhuma reunião programada.</p>
      )}
    </article>
  );
}

function MeetingSummaryCard({ araras, rioClaro }: { araras: FixedMeeting[]; rioClaro: FixedMeeting[] }) {
  const renderUnit = (title: string, meetings: FixedMeeting[]) => (
    <div>
      <h2 className="text-xl font-semibold text-slate-950">{title}</h2>
      {meetings.length ? (
        <div className="mt-3 space-y-3">
          {meetings.map((meeting, index) => (
            <div key={meeting.start} className={index ? "border-t border-violet-200 pt-3" : ""}>
              <p className="text-xs font-semibold uppercase tracking-wider text-violet-700">{index === 0 ? "Próxima" : "Seguinte"}</p>
              <p className="mt-1 text-sm font-semibold text-violet-800">{formatFixedMeetingDateTime(meeting)}</p>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-3 text-sm leading-6 text-slate-600">Nenhuma reunião programada.</p>
      )}
    </div>
  );

  return (
    <article className="rounded-3xl border border-violet-200 bg-violet-50 p-6 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wider text-violet-700">Reuniões</p>
      <div className="mt-3 space-y-4">
        {renderUnit("Reunião de Araras", araras)}
        <div className="border-t border-violet-200 pt-4">
          {renderUnit("Reunião de Rio Claro", rioClaro)}
        </div>
      </div>
    </article>
  );
}

function EventListCard({ title, tone, events, emptyMessage, formatSummary }: {
  title: string;
  tone: "pink" | "amber";
  events: PanelDateItem[];
  emptyMessage: string;
  formatSummary: (summary: string) => string;
}) {
  const toneClass = tone === "pink" ? "border-pink-200 bg-pink-50 text-pink-700" : "border-amber-200 bg-amber-50 text-amber-700";

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
  const normalizedEmail = email.trim().toLowerCase();
  const panelStore = getPanelStore(email);
  const isCica = normalizedEmail === "mcrodini@gmail.com";
  const now = new Date();
  let timoniEvents: CalendarEventDTO[] = [];

  if (session?.accessToken && session.error !== "RefreshAccessTokenError") {
    try {
      const timeMin = new Date(now);
      timeMin.setDate(timeMin.getDate() - 45);
      const timeMax = new Date(now);
      timeMax.setFullYear(timeMax.getFullYear() + 1);
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

  const nextArarasMeetings = getUpcomingFixedMeetings(now, "araras");
  const nextRioClaroMeetings = getUpcomingFixedMeetings(now, "rio claro");
  const calendarBirthdays = upcomingEvents(timoniEvents, isBirthday).map(calendarEventToPanelItem);
  const calendarVacations = timoniEvents
    .filter((event) => isVacation(event) && parseEventDate(event.end) > now)
    .sort((a, b) => parseEventDate(a.start).getTime() - parseEventDate(b.start).getTime())
    .map(calendarEventToPanelItem);
  const birthdays = uniqueDateItems([...fixedPanelBirthdays, ...calendarBirthdays]);
  const vacations = uniqueDateItems([...fixedPanelVacations, ...calendarVacations]);

  const showRioClaro = panelStore === "geral" || panelStore === "rio claro";
  const showAraras = panelStore === "geral" || panelStore === "araras";
  const mainStore: Store = panelStore === "araras" ? "araras" : "rio claro";

  return (
    <div className="pb-10">
      <header className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-700">Comunicação interna</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Painel Timoni</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600"><StoreLabel store={panelStore} /></p>
      </header>

      <ComunicadosFeed store={panelStore} />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {panelStore === "geral" ? (
          <>
            <AnnouncementCard store="rio claro" variant="full" />
            <AnnouncementCard store="araras" variant="full" />
          </>
        ) : (
          <AnnouncementCard store={mainStore} />
        )}

        {panelStore === "geral" ? (
          <MeetingSummaryCard araras={nextArarasMeetings} rioClaro={nextRioClaroMeetings} />
        ) : (
          <>
            {showAraras && <MeetingCard title="Reunião de Araras" meetings={nextArarasMeetings} />}
            {showRioClaro && <MeetingCard title="Reunião de Rio Claro" meetings={nextRioClaroMeetings} />}
          </>
        )}

        <EventListCard
          title="Aniversários"
          tone="pink"
          events={birthdays}
          emptyMessage="Nenhum aniversariante informado"
          formatSummary={cleanPanelSummary}
        />

        <EventListCard
          title="Férias"
          tone="amber"
          events={vacations}
          emptyMessage="Nenhum período programado"
          formatSummary={cleanPanelSummary}
        />
      </section>

      {isCica && <ComunicadosAdmin />}

      <p className="mt-10 text-center text-xs text-slate-400">
        Idealizado por Ciça Rodini para fortalecer a comunicação interna da Casa Timoni.
      </p>
    </div>
  );
}
