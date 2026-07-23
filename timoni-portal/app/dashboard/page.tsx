import { auth } from "@/lib/auth";
import { listEventsInRange } from "@/lib/google-calendar";
import { getWeekRange } from "@/lib/week";
import { CalendarView } from "./calendar-view";
import type { CalendarEventDTO } from "@/lib/types";

export default async function DashboardPage() {
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

  return <CalendarView initialEvents={initialEvents} initialError={loadError} />;
}
