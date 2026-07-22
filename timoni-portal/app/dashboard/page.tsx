import { auth } from "@/lib/auth";
import { listUpcomingEvents } from "@/lib/google-calendar";
import { CalendarView } from "./calendar-view";
import type { CalendarEventDTO } from "@/lib/types";

export default async function DashboardPage() {
  const session = await auth();

  let initialEvents: CalendarEventDTO[] = [];
  let loadError: string | null = null;

  if (session?.accessToken && session.error !== "RefreshAccessTokenError") {
    try {
      initialEvents = await listUpcomingEvents(session.accessToken, {
        timeMin: new Date().toISOString(),
      });
    } catch {
      loadError = "Não foi possível carregar os eventos agora.";
    }
  } else {
    loadError = "Sessão expirada. Saia e entre novamente.";
  }

  return <CalendarView initialEvents={initialEvents} initialError={loadError} />;
}
