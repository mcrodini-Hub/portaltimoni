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
    <div className="mx-auto w-full max-w-5xl space-y-5">
      <section className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-5">
        <CalendarView initialEvents={initialEvents} initialError={loadError} />
      </section>

      <section className="rounded-2xl border border-blue-100 bg-blue-50/70 p-4 sm:p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-700">Como usar</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl bg-white/80 p-3">
            <p className="font-semibold text-slate-900">1. Escolha a visualização</p>
            <p className="mt-1 text-sm leading-5 text-slate-600">Use Próximos 7 eventos, Mês ou Ano conforme a consulta.</p>
          </div>
          <div className="rounded-xl bg-white/80 p-3">
            <p className="font-semibold text-slate-900">2. Consulte os compromissos</p>
            <p className="mt-1 text-sm leading-5 text-slate-600">Toque no dia ou navegue pelos períodos para ver os eventos.</p>
          </div>
          <div className="rounded-xl bg-white/80 p-3">
            <p className="font-semibold text-slate-900">3. Atualize a agenda</p>
            <p className="mt-1 text-sm leading-5 text-slate-600">Use Novo evento para incluir e os botões do compromisso para editar ou concluir.</p>
          </div>
        </div>
      </section>
    </div>
  );
}
