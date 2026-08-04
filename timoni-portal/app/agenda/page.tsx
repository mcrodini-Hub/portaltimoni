import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import { listEventsInRange } from "@/lib/google-calendar";
import { getWeekRange } from "@/lib/week";
import { CalendarView } from "@/app/dashboard/calendar-view";
import type { CalendarEventDTO } from "@/lib/types";

export const metadata: Metadata = {
  title: "Agenda Ciça",
};

export default async function AgendaPage() {
  const session = await auth();

  let initialEvents: CalendarEventDTO[] = [];
  let loadError: string | null = null;

  if (session?.accessToken && session.error !== "RefreshAccessTokenError") {
    try {
      const { start, end } = getWeekRange();
      initialEvents = await listEventsInRange(session.accessToken, {
        timeMin: start.toISOString(),
        timeMax: end.toISOString(),
        maxResults: 100,
      });
    } catch {
      loadError = "Não foi possível carregar os eventos agora.";
    }
  } else {
    loadError = "Sessão expirada. Saia e entre novamente.";
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-3 sm:space-y-5">
      <section className="min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white p-2 shadow-sm sm:rounded-2xl sm:p-5 [&_button]:px-2.5 [&_button]:py-1.5 [&_button]:text-xs sm:[&_button]:px-4 sm:[&_button]:py-2 sm:[&_button]:text-sm [&_section]:mt-4 sm:[&_section]:mt-6 [&_.space-y-3]:space-y-2 sm:[&_.space-y-3]:space-y-3">
        <CalendarView initialEvents={initialEvents} initialError={loadError} />
      </section>

      <section className="rounded-xl border border-blue-100 bg-blue-50/70 p-3 sm:rounded-2xl sm:p-5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-blue-700 sm:text-xs">Como usar</p>
        <div className="mt-2 grid gap-2 sm:mt-4 sm:grid-cols-3 sm:gap-3">
          <div className="rounded-lg bg-white/80 p-2.5 sm:rounded-xl sm:p-3">
            <p className="text-sm font-semibold text-slate-900">1. Escolha a visualização</p>
            <p className="mt-0.5 text-xs leading-4 text-slate-600 sm:mt-1 sm:text-sm sm:leading-5">Use Próximos 7 eventos, Mês ou Ano conforme a consulta.</p>
          </div>
          <div className="rounded-lg bg-white/80 p-2.5 sm:rounded-xl sm:p-3">
            <p className="text-sm font-semibold text-slate-900">2. Consulte os compromissos</p>
            <p className="mt-0.5 text-xs leading-4 text-slate-600 sm:mt-1 sm:text-sm sm:leading-5">Toque no dia ou navegue pelos períodos para ver os eventos.</p>
          </div>
          <div className="rounded-lg bg-white/80 p-2.5 sm:rounded-xl sm:p-3">
            <p className="text-sm font-semibold text-slate-900">3. Atualize a agenda</p>
            <p className="mt-0.5 text-xs leading-4 text-slate-600 sm:mt-1 sm:text-sm sm:leading-5">Use Novo evento para incluir e os botões do compromisso para editar ou concluir.</p>
          </div>
        </div>
      </section>
    </div>
  );
}
