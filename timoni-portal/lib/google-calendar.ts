import { google, calendar_v3 } from "googleapis";
import { CALENDAR_LABELS, type CalendarEventDTO, type CalendarEventInput, type CalendarKey } from "@/lib/types";

export const TIME_ZONE = "America/Sao_Paulo";

export const CALENDARS: Record<CalendarKey, { id: string; label: string }> = {
  principal: { id: "primary", label: CALENDAR_LABELS.principal },
  timoni: {
    id:
      process.env.TIMONI_CALENDAR_ID ||
      "28fddf65c061d4f277f8ee4ddee48d5118d71dadf3e45de3443a3fd898b79356@group.calendar.google.com",
    label: CALENDAR_LABELS.timoni,
  },
};

function getCalendarClient(accessToken: string) {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  return google.calendar({ version: "v3", auth });
}

export async function getAccessTokenFromRefreshToken(): Promise<string> {
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;
  if (!refreshToken) throw new Error("GOOGLE_REFRESH_TOKEN não configurado no servidor.");
  const auth = new google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET);
  auth.setCredentials({ refresh_token: refreshToken });
  const { token } = await auth.getAccessToken();
  if (!token) throw new Error("Não foi possível renovar o access_token a partir do refresh_token salvo.");
  return token;
}

function toDTO(event: calendar_v3.Schema$Event, calendarKey: CalendarKey): CalendarEventDTO | null {
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
    calendarKey,
    calendarLabel: CALENDARS[calendarKey].label,
    completed: event.extendedProperties?.private?.completed === "true",
  };
}

export async function listEventsInRange(
  accessToken: string,
  opts: { timeMin: string; timeMax?: string; maxResults?: number }
): Promise<CalendarEventDTO[]> {
  const calendar = getCalendarClient(accessToken);
  const calendarKeys = Object.keys(CALENDARS) as CalendarKey[];
  const results = await Promise.all(
    calendarKeys.map((key) =>
      calendar.events.list({
        calendarId: CALENDARS[key].id,
        timeMin: opts.timeMin,
        timeMax: opts.timeMax,
        maxResults: opts.maxResults ?? 50,
        singleEvents: true,
        orderBy: "startTime",
      })
    )
  );
  const events = calendarKeys.flatMap((key, i) =>
    (results[i].data.items ?? [])
      .map((event) => toDTO(event, key))
      .filter((event): event is CalendarEventDTO => event !== null)
  );
  return events.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
}

export async function createEvent(
  accessToken: string,
  calendarKey: CalendarKey,
  input: CalendarEventInput
): Promise<CalendarEventDTO> {
  const calendar = getCalendarClient(accessToken);
  const res = await calendar.events.insert({
    calendarId: CALENDARS[calendarKey].id,
    requestBody: {
      summary: input.summary,
      description: input.description,
      location: input.location,
      start: { dateTime: input.start, timeZone: TIME_ZONE },
      end: { dateTime: input.end, timeZone: TIME_ZONE },
      recurrence: input.recurrence,
    },
  });
  const dto = toDTO(res.data, calendarKey);
  if (!dto) throw new Error("Resposta inesperada do Google Calendar ao criar evento.");
  return dto;
}

export async function updateEvent(
  accessToken: string,
  calendarKey: CalendarKey,
  eventId: string,
  input: Partial<CalendarEventInput>
): Promise<CalendarEventDTO> {
  const calendar = getCalendarClient(accessToken);
  const res = await calendar.events.patch({
    calendarId: CALENDARS[calendarKey].id,
    eventId,
    requestBody: {
      summary: input.summary,
      description: input.description,
      location: input.location,
      ...(input.start ? { start: { dateTime: input.start, timeZone: TIME_ZONE } } : {}),
      ...(input.end ? { end: { dateTime: input.end, timeZone: TIME_ZONE } } : {}),
      ...(input.completed !== undefined
        ? { extendedProperties: { private: { completed: String(input.completed) } } }
        : {}),
    },
  });
  const dto = toDTO(res.data, calendarKey);
  if (!dto) throw new Error("Resposta inesperada do Google Calendar ao editar evento.");
  return dto;
}

export async function deleteEvent(
  accessToken: string,
  calendarKey: CalendarKey,
  eventId: string
): Promise<void> {
  const calendar = getCalendarClient(accessToken);
  await calendar.events.delete({ calendarId: CALENDARS[calendarKey].id, eventId });
}

export function toApiError(error: unknown): { message: string; status: number } {
  const status = (error as { code?: number })?.code ?? 500;
  if (status === 401) return { message: "Sessão expirada. Faça login novamente.", status: 401 };
  if (status === 403) return { message: "Sem permissão para acessar a agenda.", status: 403 };
  if (status === 404) return { message: "Evento não encontrado.", status: 404 };
  return { message: "Erro ao falar com o Google Calendar. Tente novamente.", status: 500 };
}

export function isCalendarKey(value: unknown): value is CalendarKey {
  return value === "principal" || value === "timoni";
}
