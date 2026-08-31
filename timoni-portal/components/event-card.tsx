"use client";

import clsx from "clsx";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { CalendarEventDTO } from "@/lib/types";
import { Button } from "@/components/ui/button";

type Urgency = "urgent" | "today" | "future";

const CALENDAR_COLOR_FALLBACKS: Record<CalendarEventDTO["calendarKey"], string> = {
  principal: "#7986CB",
  timoni: "#F6BF26",
};

function colorWithAlpha(color: string, alpha: number) {
  const value = color.replace("#", "");
  if (!/^[0-9a-f]{6}$/i.test(value)) return `rgba(100, 116, 139, ${alpha})`;
  const red = Number.parseInt(value.slice(0, 2), 16);
  const green = Number.parseInt(value.slice(2, 4), 16);
  const blue = Number.parseInt(value.slice(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

export function getUrgency(startIso: string, endIso: string, nowMs: number): Urgency {
  const startMs = new Date(startIso).getTime();
  const endMs = new Date(endIso).getTime();
  const twoHoursMs = 2 * 60 * 60 * 1000;

  const isOngoing = startMs <= nowMs && nowMs < endMs;
  const startsWithinTwoHours = startMs > nowMs && startMs - nowMs <= twoHoursMs;
  if (isOngoing || startsWithinTwoHours) return "urgent";

  const isToday = new Date(startMs).toDateString() === new Date(nowMs).toDateString();
  return isToday ? "today" : "future";
}

export function EventCard({
  event,
  onEdit,
  onComplete,
  onDelete,
}: {
  event: CalendarEventDTO;
  onEdit: (event: CalendarEventDTO) => void;
  onComplete: (event: CalendarEventDTO) => void;
  onDelete: (event: CalendarEventDTO) => void;
}) {
  const isAllDay = !event.start.includes("T");
  const calendarColor = event.calendarColor || CALENDAR_COLOR_FALLBACKS[event.calendarKey];

  const timeLabel = isAllDay
    ? `${event.start.slice(8, 10)}/${event.start.slice(5, 7)}`
    : `${format(new Date(event.start), "dd/MM HH:mm", { locale: ptBR })}–${format(
        new Date(event.end),
        "HH:mm",
        { locale: ptBR }
      )}`;

  return (
    <div
      className="min-w-0 rounded-xl border p-3 sm:p-4"
      style={{
        backgroundColor: colorWithAlpha(calendarColor, 0.1),
        borderColor: colorWithAlpha(calendarColor, 0.42),
      }}
    >
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: calendarColor }} />
            <span className="text-sm text-slate-500">{timeLabel}</span>
            <span
              className="inline-flex max-w-full items-center break-words rounded-full px-2 py-0.5 text-xs text-slate-600"
              style={{ backgroundColor: colorWithAlpha(calendarColor, 0.16) }}
            >
              {event.calendarLabel}
            </span>
          </div>
          <p className={clsx("mt-2 break-words font-medium", event.completed && "text-slate-500 line-through")}>
            {event.summary}
          </p>
          {event.location && <p className="mt-1 break-words text-sm text-slate-500">{event.location}</p>}
        </div>
        <div className="grid w-full grid-cols-3 items-center gap-2 sm:flex sm:w-auto sm:shrink-0 sm:flex-wrap sm:items-center">
          <button
            type="button"
            onClick={() => onComplete(event)}
            className={clsx(
              "inline-flex min-h-9 min-w-0 items-center justify-center rounded-lg px-2 py-2 text-xs font-medium transition sm:px-3 sm:text-sm",
              event.completed
                ? "bg-green-600 text-white hover:bg-green-700"
                : "bg-green-50 text-green-700 hover:bg-green-100"
            )}
          >
            ✓ {event.completed ? "Concluído" : "Concluir"}
          </button>
          <Button className="inline-flex min-h-9 min-w-0 items-center justify-center px-2 text-xs sm:px-3 sm:text-sm" variant="secondary" onClick={() => onEdit(event)}>
            Editar
          </Button>
          <Button className="inline-flex min-h-9 min-w-0 items-center justify-center px-2 text-xs sm:px-3 sm:text-sm" variant="danger" onClick={() => onDelete(event)}>
            Cancelar
          </Button>
        </div>
      </div>
    </div>
  );
}
