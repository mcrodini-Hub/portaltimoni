export type CalendarKey = "principal" | "timoni";

export const CALENDAR_LABELS: Record<CalendarKey, string> = {
  principal: "Principal",
  timoni: "TIMONI AGENDA",
};

export interface CalendarEventInput {
  summary: string;
  description?: string;
  location?: string;
  start: string;
  end: string;
  recurrence?: string[];
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
