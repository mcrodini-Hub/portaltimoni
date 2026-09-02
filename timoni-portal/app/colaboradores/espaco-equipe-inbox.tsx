import { listTeamMessages, type TeamMessage } from "@/lib/espaco-equipe";

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

function MessageBox({ item, index }: { item: TeamMessage; index: number }) {
  return (
    <article
      key={`${item.date}-${item.employee}-${index}`}
      className="rounded-2xl border border-blue-100 bg-white/80 p-4 shadow-sm"
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-semibold uppercase tracking-wider text-blue-700">
        <span>{formatMessageDate(item.date)}</span>
        <span className="text-slate-300">•</span>
        <span>{item.employee}</span>
      </div>
      <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">{item.message}</p>
    </article>
  );
}

export default async function EspacoEquipeInbox({ accessToken }: { accessToken?: string }) {
  let messages: TeamMessage[] = [];

  try {
    messages = await listTeamMessages(accessToken);
  } catch {
    messages = [];
  }

  return (
    <section className="mt-6 rounded-3xl border border-blue-200 bg-blue-50 p-6 shadow-sm">
      <div className="max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-wider text-blue-700">Espaço Equipe</p>
        <h2 className="mt-2 text-xl font-semibold text-slate-950">Sua contribuição ajuda a melhorar nosso dia a dia</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Use este espaço para enviar sugestões, reclamações, dificuldades ou ideias de melhoria. Os registros serão analisados pela gestão e poderão ser considerados nas pautas das reuniões.
        </p>
      </div>

      <div className="mt-5 border-t border-blue-200 pt-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-blue-700">Mensagens recebidas</p>
      </div>

      {messages.length ? (
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          {messages.map((item, index) => (
            <MessageBox key={`${item.date}-${item.employee}-${index}`} item={item} index={index} />
          ))}
        </div>
      ) : (
        <p className="mt-3 rounded-2xl bg-white/80 p-4 text-sm text-slate-600">
          Nenhuma mensagem registrada ainda.
        </p>
      )}
    </section>
  );
}
