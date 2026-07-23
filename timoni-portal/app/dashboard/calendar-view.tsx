"use client";

import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import clsx from "clsx";
import { Button } from "@/components/ui/button";
import { EventCard, getUrgency } from "@/components/event-card";
import { EventForm } from "./event-form";
import { getWeekRange, saoPauloDayIndex, type WeekDay } from "@/lib/week";
import type { CalendarEventDTO } from "@/lib/types";

const POLL_INTERVAL_MS = 60_000;
const TICK_INTERVAL_MS = 30_000;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

const DAY_LABELS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

export function CalendarView({
  initialEvents,
  initialError,
}: {
  initialEvents: CalendarEventDTO[];
  initialError: string | null;
}) {
  const [events, setEvents] = useState(initialEvents);
  const [weekDays, setWeekDays] = useState<WeekDay[]>(() => getWeekRange().days);
  const [weekOffset, setWeekOffset] = useState(0);
  const [error, setError] = useState(initialError);
  const [now, setNow] = useState(() => Date.now());
  const [formOpen, setFormOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEventDTO | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function refreshEvents(offset: number) {
    const reference = new Date(Date.now() + offset * WEEK_MS);
    const { start, end, days } = getWeekRange(reference);
    try {
      const res = await fetch(
        `/api/events?timeMin=${encodeURIComponent(start.toISOString())}&timeMax=${encodeURIComponent(end.toISOString())}`
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Não foi possível atualizar os eventos.");
        return;
      }
      setEvents(data.events ?? []);
      setWeekDays(days);
      setError(null);
    } catch {
      setError("Falha de conexão ao atualizar os eventos.");
    }
  }

  useEffect(() => {
    refreshEvents(weekOffset);
    const poll = setInterval(() => refreshEvents(weekOffset), POLL_INTERVAL_MS);
    return () => clearInterval(poll);
  }, [weekOffset]);

  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), TICK_INTERVAL_MS);
    return () => clearInterval(tick);
  }, []);

  const urgentCount = useMemo(
    () => events.filter((e) => getUrgency(e.start, e.end, now) === "urgent").length,
    [events, now]
  );

  useEffect(() => {
    document.title = urgentCount > 0 ? `(${urgentCount}) Timoni Portal` : "Timoni Portal";
  }, [urgentCount]);

  const todayIndex = saoPauloDayIndex(new Date(now).toISOString());

  // Na semana atual, esconde os dias que já passaram — só mostra de hoje em
  // diante. Em outras semanas (navegando com os botões), mostra os 7 dias.
  const visibleDays = weekOffset === 0 ? weekDays.filter((d) => d.dayIndex >= todayIndex) : weekDays;

  const eventsByDay = useMemo(() => {
    const grouped: CalendarEventDTO[][] = Array.from({ length: 7 }, () => []);
    for (const event of events) {
      const dayIndex = saoPauloDayIndex(event.start);
      if (dayIndex >= 0 && dayIndex < 7) grouped[dayIndex].push(event);
    }
    return grouped;
  }, [events]);

  async function handleDelete(event: CalendarEventDTO) {
    const confirmed = window.confirm(`Cancelar o evento "${event.summary}"?`);
    if (!confirmed) return;

    setDeletingId(event.id);
    try {
      const res = await fetch(`/api/events/${event.id}?calendarKey=${event.calendarKey}`, {
        method: "DELETE",
      });
      if (!res.ok && res.status !== 204) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Não foi possível cancelar o evento.");
        return;
      }
      await refreshEvents(weekOffset);
    } catch {
      setError("Falha de conexão ao cancelar o evento.");
    } finally {
      setDeletingId(null);
    }
  }

  const rangeLabel =
    visibleDays.length > 0
      ? `${format(visibleDays[0].date, "dd/MM", { locale: ptBR })} – ${format(
          visibleDays[visibleDays.length - 1].date,
          "dd/MM",
          { locale: ptBR }
        )}`
      : "";

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Agenda</h1>
          <p className="text-sm text-slate-400">{rangeLabel}</p>
        </div>
        <Button
          onClick={() => {
            setEditingEvent(null);
            setFormOpen(true);
          }}
        >
          + Novo evento
        </Button>
      </div>

      <div className="mt-4 flex items-center gap-2">
        <Button variant="secondary" onClick={() => setWeekOffset((o) => o - 1)}>
          ← Semana anterior
        </Button>
        <Button variant="secondary" onClick={() => setWeekOffset(0)}>
          Hoje
        </Button>
        <Button variant="secondary" onClick={() => setWeekOffset((o) => o + 1)}>
          Semana seguinte →
        </Button>
      </div>

      {error && (
        <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      {visibleDays.map((day) => {
        const dayEvents = eventsByDay[day.dayIndex] ?? [];
        const isToday = day.dayIndex === todayIndex && weekOffset === 0;

        return (
          <section key={day.dayIndex} className="mt-6">
            <h2
              className={clsx(
                "flex items-center gap-2 text-xs font-semibold uppercase tracking-wide",
                isToday ? "text-slate-900" : "text-slate-400"
              )}
            >
              {DAY_LABELS[day.dayIndex]} {format(day.date, "dd/MM", { locale: ptBR })}
              {isToday && (
                <span className="rounded-full bg-slate-900 px-2 py-0.5 text-[10px] text-white">
                  Hoje
                </span>
              )}
            </h2>
            <div className="mt-2 space-y-3">
              {dayEvents.length === 0 && (
                <p className="text-sm text-slate-400">Nenhum evento.</p>
              )}
              {dayEvents.map((event) => (
                <EventCard
                  key={`${event.calendarKey}-${event.id}`}
                  event={event}
                  nowMs={now}
                  onEdit={(e) => {
                    setEditingEvent(e);
                    setFormOpen(true);
                  }}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          </section>
        );
      })}

      {formOpen && (
        <EventForm
          event={editingEvent}
          onClose={() => setFormOpen(false)}
          onSaved={() => refreshEvents(weekOffset)}
        />
      )}

      {deletingId && (
        <p className="fixed bottom-4 right-4 rounded-lg bg-slate-900 px-3 py-2 text-sm text-white">
          Cancelando evento…
        </p>
      )}
    </div>
  );
}
