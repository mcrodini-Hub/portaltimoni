export type CalendarKey = "principal" | "timoni";

// Rótulos exibidos na UI — mantidos aqui (sem depender de "googleapis") para
// poderem ser importados por componentes client.
export const CALENDAR_LABELS: Record<CalendarKey, string> = {
  principal: "Principal",
  timoni: "TIMONI AGENDA",
};

export interface CalendarEventInput {
  summary: string;
  description?: string;
  location?: string;
  start: string; // ISO 8601
  end: string; // ISO 8601
}

export interface CalendarEventDTO {
  id: string;
  summary: string;
  description?: string;
  location?: string;
  start: string;
  end: string;
  htmlLink?: string;
  calendarKey: CalendarKey;
  calendarLabel: string;
}
