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
    <div className="mx-auto w-full max-w-5xl">
      <section className="min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white p-2 shadow-sm sm:rounded-2xl sm:p-5 [&_button]:px-2.5 [&_button]:py-1.5 [&_button]:text-xs sm:[&_button]:px-4 sm:[&_button]:py-2 sm:[&_button]:text-sm [&_section]:mt-4 sm:[&_section]:mt-6 [&_.space-y-3]:space-y-2 sm:[&_.space-y-3]:space-y-3">
        <CalendarView initialEvents={initialEvents} initialError={loadError} />
      </section>
    </div>
  );
}
