import { NextResponse } from "next/server";
import { requireAuthorizedSession } from "@/lib/auth-guard";
import { hasModuleAccess } from "@/lib/access-control";
import { listEventsInRange } from "@/lib/google-calendar";
import type { CalendarKey } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  const { session, errorResponse } = await requireAuthorizedSession();
  if (errorResponse) return errorResponse;
  const email = session!.user!.email!;
  const keys: CalendarKey[] = [];
  if (hasModuleAccess(email, "agenda", session!.portalUser)) keys.push("principal");
  if (hasModuleAccess(email, "agenda-ct", session!.portalUser)) keys.push("timoni");
  if (!keys.length) return NextResponse.json({ events: [] }, { headers: { "Cache-Control": "private, no-store" } });
  const now = Date.now();
  const end = now + 2 * 60 * 60 * 1000;
  try {
    const events = await listEventsInRange(session!.accessToken!, {
      timeMin: new Date(now).toISOString(), timeMax: new Date(end).toISOString(), maxResults: 500,
    }, keys);
    return NextResponse.json({ events: events.filter(event => {
      const start = new Date(event.start).getTime();
      return !event.completed && ((start <= now && now < new Date(event.end).getTime()) || (start > now && start <= end));
    }).sort((a,b) => a.start.localeCompare(b.start)).map(({id,summary,start,end,calendarKey,calendarLabel}) => ({id,summary,start,end,calendarKey,calendarLabel})) },
    { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ error: "Não foi possível carregar os compromissos em alerta." }, { status: 503 });
  }
}
