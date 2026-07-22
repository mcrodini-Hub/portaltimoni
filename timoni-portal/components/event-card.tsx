"use client";

import clsx from "clsx";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { CalendarEventDTO } from "@/lib/types";
import { Button } from "@/components/ui/button";

type Urgency = "urgent" | "today" | "future";

const URGENCY_CLASSES: Record<Urgency, string> = {
  urgent: "border-red-300 bg-red-50",
  today: "border-yellow-300 bg-yellow-50",
  future: "border-slate-200 bg-white",
};

const URGENCY_DOT: Record<Urgency, string> = {
  urgent: "bg-red-500",
  today: "bg-yellow-500",
  future: "bg-slate-300",
};

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
  nowMs,
  onEdit,
  onDelete,
}: {
  event: CalendarEventDTO;
  nowMs: number;
  onEdit: (event: CalendarEventDTO) => void;
  onDelete: (event: CalendarEventDTO) => void;
}) {
  const urgency = getUrgency(event.start, event.end, nowMs);
  const isAllDay = !event.start.includes("T");

  const timeLabel = isAllDay
    ? format(new Date(event.start), "dd/MM", { locale: ptBR })
    : `${format(new Date(event.start), "dd/MM HH:mm", { locale: ptBR })}–${format(
        new Date(event.end),
        "HH:mm",
        { locale: ptBR }
      )}`;

  return (
    <div className={clsx("rounded-xl border p-4", URGENCY_CLASSES[urgency])}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className={clsx("h-2 w-2 rounded-full", URGENCY_DOT[urgency])} />
            <span className="text-sm text-slate-500">{timeLabel}</span>
          </div>
          <p className="mt-1 font-medium">{event.summary}</p>
          {event.location && <p className="text-sm text-slate-500">{event.location}</p>}
        </div>
        <div className="flex shrink-0 gap-2">
          <Button variant="secondary" onClick={() => onEdit(event)}>
            Editar
          </Button>
          <Button variant="danger" onClick={() => onDelete(event)}>
            Cancelar
          </Button>
        </div>
      </div>
    </div>
  );
}
