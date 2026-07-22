import { NextRequest, NextResponse } from "next/server";
import { requireAuthorizedSession } from "@/lib/auth-guard";
import { deleteEvent, toApiError, updateEvent } from "@/lib/google-calendar";
import type { CalendarEventInput } from "@/lib/types";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const { session, errorResponse } = await requireAuthorizedSession();
  if (errorResponse) return errorResponse;

  const { eventId } = await params;
  const body = (await request.json().catch(() => null)) as Partial<CalendarEventInput> | null;
  if (!body) {
    return NextResponse.json({ error: "Corpo da requisição inválido." }, { status: 400 });
  }
  if (body.start && body.end && new Date(body.end) <= new Date(body.start)) {
    return NextResponse.json({ error: "O fim do evento deve ser depois do início." }, { status: 400 });
  }

  try {
    const event = await updateEvent(session!.accessToken!, eventId, body);
    return NextResponse.json({ event });
  } catch (error) {
    const { message, status } = toApiError(error);
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const { session, errorResponse } = await requireAuthorizedSession();
  if (errorResponse) return errorResponse;

  const { eventId } = await params;

  try {
    await deleteEvent(session!.accessToken!, eventId);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    const { message, status } = toApiError(error);
    return NextResponse.json({ error: message }, { status });
  }
}
