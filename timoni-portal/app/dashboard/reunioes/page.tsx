import { auth } from "@/lib/auth";
import { listTeamMessages, type TeamMessage } from "@/lib/espaco-equipe";

const DRIVE_URL = "https://drive.google.com/drive/folders/1a90BS_9nnf_9_o9VZyNDICfPyAxxyYOg";
const ESPACO_EQUIPE_URL = "https://docs.google.com/spreadsheets/d/1aLAj_PJv8MjDpzKkGqyLnALCiP_uJfe9udj9_Yk0X-I/edit";

const GESTAO_EMAILS = new Set(["mcrodini@gmail.com", "mrodini@gmail.com"]);

type MeetingUnit = "Araras" | "Rio Claro";

type Meeting = {
  unit: MeetingUnit;
  pautaUrl: string;
  date: string;
  day: string;
  time: string;
  secondDate: string;
  secondDay: string;
  secondTime: string;
  frequency: string;
  leaders: string;
  url: string;
  slidesUrl: string;
  style: string;
};

const meetings: Meeting[] = [
  {
    unit: "Araras",
    pautaUrl: "https://docs.google.com/document/d/1NoZASmMc-ptrqFy8zbvtGgCJjLJxX8GsORM-F4N799k",
    date: "08/09/2026",
    day: "Terça-feira",
    time: "7h40",
    secondDate: "09/10/2026",
    secondDay: "Sexta-feira",
    secondTime: "7h40",
    frequency: "Mensal",
    leaders: "Ciça e Marcelo",
    url: "https://docs.google.com/document/d/1S9dQlOGwFE8RwNnjw1PFy08DH9a6k1_9kugQEBgmxHQ",
    slidesUrl: "https://docs.google.com/presentation/d/1zN_tU03-tq8Y6Ewo4GasboPTjRHXnpjXB0bbSrjHaWI",
    style: "border-amber-200 bg-amber-50",
  },
  {
    unit: "Rio Claro",
    pautaUrl: "https://docs.google.com/document/d/1qlgMtkqkg-LlS-LtdxDHYKcNXWbAbgWjARDtNRLHBe8",
    date: "08/08/2026",
    day: "Sábado",
    time: "7h30",
    secondDate: "03/09/2026",
    secondDay: "Quinta-feira",
    secondTime: "7h30",
    frequency: "Mensal",
    leaders: "Ciça, Marcelo e Jeovana",
    url: "https://docs.google.com/document/d/1rVOOEsR4dkqj51O8iRc14X5Iy2ywCEn0hxXz_jBKmyQ",
    slidesUrl: "https://docs.google.com/presentation/d/1VblTWAcgvrEdWBf5PMq97sr23NNdtT7vQg8Hmza_JPM",
    style: "border-blue-200 bg-blue-50",
  },
];

function MeetingCard({ meeting }: { meeting: Meeting }) {
  return (
    <article className={`rounded-3xl border p-5 ${meeting.style}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{meeting.day}</p>
          <h3 className="mt-1 text-2xl font-semibold text-slate-900">{meeting.unit}</h3>
        </div>
        <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700">{meeting.frequency}</span>
      </div>
      <div className="mt-5 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-white/80 p-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Próxima</p>
            <p className="mt-1 font-semibold text-slate-900">{meeting.date}</p>
            <p className="text-xs text-slate-500">{meeting.day}</p>
          </div>
          <div className="rounded-2xl bg-white/80 p-3">
            <p className="text-xs text-slate-500">Horário</p>
            <p className="mt-1 font-semibold text-slate-900">{meeting.time}</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-white/80 p-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Seguinte</p>
            <p className="mt-1 font-semibold text-slate-900">{meeting.secondDate}</p>
            <p className="text-xs text-slate-500">{meeting.secondDay}</p>
          </div>
          <div className="rounded-2xl bg-white/80 p-3">
            <p className="text-xs text-slate-500">Horário</p>
            <p className="mt-1 font-semibold text-slate-900">{meeting.secondTime}</p>
          </div>
        </div>
      </div>
      <p className="mt-4 text-sm text-slate-600">Condução: <strong>{meeting.leaders}</strong></p>
      <div className="mt-4 flex flex-wrap gap-4">
        <a href={meeting.pautaUrl} target="_blank" rel="noreferrer" className="text-sm font-semibold text-emerald-700 hover:text-emerald-900">Abrir pauta →</a>
        <a href={meeting.url} target="_blank" rel="noreferrer" className="text-sm font-semibold text-blue-700 hover:text-blue-900">Abrir ata →</a>
        <a href={meeting.slidesUrl} target="_blank" rel="noreferrer" className="text-sm font-semibold text-rose-700 hover:text-rose-900">Abrir apresentação →</a>
      </div>
    </article>
  );
}

function formatMessageDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function TeamMessages({ messages }: { messages: TeamMessage[] }) {
  return (
    <section className="mt-5 rounded-3xl border border-indigo-200 bg-indigo-50 p-5 shadow-sm sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-indigo-700">Espaço Equipe</p>
          <h2 className="mt-1 text-xl font-semibold text-slate-900">Demandas recebidas dos funcionários</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">Sugestões, reclamações e ideias para considerar na preparação das próximas pautas.</p>
        </div>
        <a href={ESPACO_EQUIPE_URL} target="_blank" rel="noreferrer" className="inline-flex shrink-0 items-center justify-center rounded-xl border border-indigo-200 bg-white px-4 py-2.5 text-sm font-semibold text-indigo-800 transition hover:bg-indigo-100">
          Abrir registros
        </a>
      </div>

      {messages.length ? (
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {messages.map((item, index) => (
            <article key={`${item.date}-${item.employee}-${index}`} className="rounded-2xl border border-indigo-100 bg-white p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-semibold text-slate-950">{item.employee}</p>
                  <p className="text-xs text-slate-500">{item.unit} · {formatMessageDate(item.date)}</p>
                </div>
                <span className="rounded-full bg-indigo-100 px-2.5 py-1 text-xs font-semibold text-indigo-800">{item.status || "Novo"}</span>
              </div>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">{item.message}</p>
              {item.note && <p className="mt-3 border-t border-slate-100 pt-3 text-xs text-slate-500">{item.note}</p>}
            </article>
          ))}
        </div>
      ) : (
        <p className="mt-4 rounded-2xl bg-white p-4 text-sm text-slate-600">Nenhuma mensagem registrada ainda.</p>
      )}
    </section>
  );
}

export default async function ReunioesPage() {
  const session = await auth();
  const email = session?.user?.email?.trim().toLowerCase() ?? "";
  const isGestao = GESTAO_EMAILS.has(email);
  const visibleMeetings = isGestao ? meetings : meetings.filter((meeting) => meeting.unit === "Araras");
  let teamMessages: TeamMessage[] = [];

  if (isGestao) {
    try {
      teamMessages = await listTeamMessages();
    } catch {
      teamMessages = [];
    }
  }

  return (
    <div className="pb-10">
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-rose-600">Gestão e acompanhamento</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">{isGestao ? "Reuniões" : "Reuniões Araras"}</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              {isGestao
                ? "Pautas, atas, apresentação, registros oficiais e demandas da equipe de Araras e Rio Claro."
                : "Pauta, ata, apresentação e registros oficiais das reuniões de Araras."}
            </p>
          </div>
          <a href={DRIVE_URL} target="_blank" rel="noreferrer" className="inline-flex shrink-0 items-center justify-center rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700">
            Abrir pasta oficial
          </a>
        </div>
      </section>

      {isGestao && <TeamMessages messages={teamMessages} />}

      <section className="mt-5">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-blue-600">{isGestao ? "Próximos registros" : "Próximo registro"}</p>
            <h2 className="mt-1 text-xl font-semibold text-slate-900">{isGestao ? "Reuniões agendadas" : "Reunião agendada"}</h2>
          </div>
        </div>

        <div className={`mt-3 grid gap-4 ${isGestao ? "md:grid-cols-2" : "md:grid-cols-1"}`}>
          {visibleMeetings.map((meeting) => <MeetingCard key={meeting.unit} meeting={meeting} />)}
        </div>
      </section>
    </div>
  );
}
