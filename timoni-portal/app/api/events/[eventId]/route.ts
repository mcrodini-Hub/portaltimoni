import { NextRequest, NextResponse } from "next/server";
import { requireAuthorizedSession } from "@/lib/auth-guard";
import { deleteEvent, isCalendarKey, toApiError, updateEvent } from "@/lib/google-calendar";
import type { CalendarEventInput } from "@/lib/types";
import { recordModuleUpdateSafely } from "@/lib/module-updates";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const { session, errorResponse } = await requireAuthorizedSession();
  if (errorResponse) return errorResponse;

  const { eventId } = await params;
  const calendarKey = new URL(request.url).searchParams.get("calendarKey");
  if (!isCalendarKey(calendarKey)) {
    return NextResponse.json({ error: "Agenda do evento não informada." }, { status: 400 });
  }

  const body = (await request.json().catch(() => null)) as Partial<CalendarEventInput> | null;
  if (!body) {
    return NextResponse.json({ error: "Corpo da requisição inválido." }, { status: 400 });
  }
  if (body.start && body.end && new Date(body.end) <= new Date(body.start)) {
    return NextResponse.json({ error: "O fim do evento deve ser depois do início." }, { status: 400 });
  }

  try {
    const event = await updateEvent(session!.accessToken!, calendarKey, eventId, body);
    await recordModuleUpdateSafely("agenda", session?.user?.email, `Evento atualizado: ${body.summary || "compromisso"}.`);
    return NextResponse.json({ event });
  } catch (error) {
    const { message, status } = toApiError(error);
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const { session, errorResponse } = await requireAuthorizedSession();
  if (errorResponse) return errorResponse;

  const { eventId } = await params;
  const calendarKey = new URL(request.url).searchParams.get("calendarKey");
  if (!isCalendarKey(calendarKey)) {
    return NextResponse.json({ error: "Agenda do evento não informada." }, { status: 400 });
  }

  try {
    await deleteEvent(session!.accessToken!, calendarKey, eventId);
    await recordModuleUpdateSafely("agenda", session?.user?.email, "Evento removido da agenda.");
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    const { message, status } = toApiError(error);
    return NextResponse.json({ error: message }, { status });
  }
}
