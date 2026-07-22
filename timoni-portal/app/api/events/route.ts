import { NextRequest, NextResponse } from "next/server";
import { requireAuthorizedSession } from "@/lib/auth-guard";
import { createEvent, listUpcomingEvents, toApiError } from "@/lib/google-calendar";
import type { CalendarEventInput } from "@/lib/types";

export async function GET(request: NextRequest) {
  const { session, errorResponse } = await requireAuthorizedSession();
  if (errorResponse) return errorResponse;

  const { searchParams } = new URL(request.url);
  const timeMin = searchParams.get("timeMin") ?? new Date().toISOString();
  const timeMax = searchParams.get("timeMax") ?? undefined;

  try {
    const events = await listUpcomingEvents(session!.accessToken!, { timeMin, timeMax });
    return NextResponse.json({ events });
  } catch (error) {
    const { message, status } = toApiError(error);
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(request: NextRequest) {
  const { session, errorResponse } = await requireAuthorizedSession();
  if (errorResponse) return errorResponse;

  const body = (await request.json().catch(() => null)) as Partial<CalendarEventInput> | null;
  if (!body?.summary?.trim()) {
    return NextResponse.json({ error: "Título do evento é obrigatório." }, { status: 400 });
  }
  if (!body.start || !body.end) {
    return NextResponse.json({ error: "Data/hora de início e fim são obrigatórias." }, { status: 400 });
  }
  if (new Date(body.end) <= new Date(body.start)) {
    return NextResponse.json({ error: "O fim do evento deve ser depois do início." }, { status: 400 });
  }

  try {
    const event = await createEvent(session!.accessToken!, {
      summary: body.summary.trim(),
      description: body.description,
      location: body.location,
      start: body.start,
      end: body.end,
    });
    return NextResponse.json({ event }, { status: 201 });
  } catch (error) {
    const { message, status } = toApiError(error);
    return NextResponse.json({ error: message }, { status });
  }
}
