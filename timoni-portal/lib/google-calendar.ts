import { google, calendar_v3 } from "googleapis";
import type { CalendarEventDTO, CalendarEventInput } from "@/lib/types";

const TIME_ZONE = "America/Sao_Paulo";
const CALENDAR_ID = "primary"; // agenda Principal — fixo, nunca configurável na UI

function getCalendarClient(accessToken: string) {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  return google.calendar({ version: "v3", auth });
}

function toDTO(event: calendar_v3.Schema$Event): CalendarEventDTO | null {
  if (!event.id || !event.start || !event.end) return null;
  const start = event.start.dateTime ?? event.start.date;
  const end = event.end.dateTime ?? event.end.date;
  if (!start || !end) return null;

  return {
    id: event.id,
    summary: event.summary || "(sem título)",
    description: event.description ?? undefined,
    location: event.location ?? undefined,
    start,
    end,
    htmlLink: event.htmlLink ?? undefined,
  };
}

export async function listUpcomingEvents(
  accessToken: string,
  opts: { timeMin: string; timeMax?: string; maxResults?: number }
): Promise<CalendarEventDTO[]> {
  const calendar = getCalendarClient(accessToken);
  const res = await calendar.events.list({
    calendarId: CALENDAR_ID,
    timeMin: opts.timeMin,
    timeMax: opts.timeMax,
    maxResults: opts.maxResults ?? 50,
    singleEvents: true,
    orderBy: "startTime",
  });

  return (res.data.items ?? [])
    .map(toDTO)
    .filter((e): e is CalendarEventDTO => e !== null);
}

export async function createEvent(
  accessToken: string,
  input: CalendarEventInput
): Promise<CalendarEventDTO> {
  const calendar = getCalendarClient(accessToken);
  const res = await calendar.events.insert({
    calendarId: CALENDAR_ID,
    requestBody: {
      summary: input.summary,
      description: input.description,
      location: input.location,
      start: { dateTime: input.start, timeZone: TIME_ZONE },
      end: { dateTime: input.end, timeZone: TIME_ZONE },
    },
  });

  const dto = toDTO(res.data);
  if (!dto) throw new Error("Resposta inesperada do Google Calendar ao criar evento.");
  return dto;
}

export async function updateEvent(
  accessToken: string,
  eventId: string,
  input: Partial<CalendarEventInput>
): Promise<CalendarEventDTO> {
  const calendar = getCalendarClient(accessToken);
  const res = await calendar.events.patch({
    calendarId: CALENDAR_ID,
    eventId,
    requestBody: {
      summary: input.summary,
      description: input.description,
      location: input.location,
      ...(input.start ? { start: { dateTime: input.start, timeZone: TIME_ZONE } } : {}),
      ...(input.end ? { end: { dateTime: input.end, timeZone: TIME_ZONE } } : {}),
    },
  });

  const dto = toDTO(res.data);
  if (!dto) throw new Error("Resposta inesperada do Google Calendar ao editar evento.");
  return dto;
}

export async function deleteEvent(accessToken: string, eventId: string): Promise<void> {
  const calendar = getCalendarClient(accessToken);
  await calendar.events.delete({ calendarId: CALENDAR_ID, eventId });
}

// Traduz erros da Calendar API para uma mensagem segura de expor ao client
// (nunca vaza stacktrace/detalhes internos do Google).
export function toApiError(error: unknown): { message: string; status: number } {
  const status = (error as { code?: number })?.code ?? 500;
  if (status === 401) return { message: "Sessão expirada. Faça login novamente.", status: 401 };
  if (status === 403) return { message: "Sem permissão para acessar a agenda.", status: 403 };
  if (status === 404) return { message: "Evento não encontrado.", status: 404 };
  return { message: "Erro ao falar com o Google Calendar. Tente novamente.", status: 500 };
}
