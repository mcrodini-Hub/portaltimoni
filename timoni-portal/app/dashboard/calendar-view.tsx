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
const SAO_PAULO_OFFSET_MS = -3 * 60 * 60 * 1000;

const DAY_LABELS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
type ViewMode = "week" | "month" | "year";

function saoPauloParts(date: Date) {
  const shifted = new Date(date.getTime() + SAO_PAULO_OFFSET_MS);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth(),
  };
}

function periodRange(view: ViewMode, offset: number) {
  if (view === "week") {
    const reference = new Date(Date.now() + offset * WEEK_MS);
    return getWeekRange(reference);
  }

  const current = saoPauloParts(new Date());
  if (view === "month") {
    const start = new Date(Date.UTC(current.year, current.month + offset, 1, 3));
    const end = new Date(Date.UTC(current.year, current.month + offset + 1, 1, 3));
    return { start, end, days: [] as WeekDay[] };
  }

  const start = new Date(Date.UTC(current.year + offset, 0, 1, 3));
  const end = new Date(Date.UTC(current.year + offset + 1, 0, 1, 3));
  return { start, end, days: [] as WeekDay[] };
}

function eventDateKey(iso: string) {
  if (!iso.includes("T")) return iso.slice(0, 10);
  const shifted = new Date(new Date(iso).getTime() + SAO_PAULO_OFFSET_MS);
  return [
    shifted.getUTCFullYear(),
    String(shifted.getUTCMonth() + 1).padStart(2, "0"),
    String(shifted.getUTCDate()).padStart(2, "0"),
  ].join("-");
}

function dateFromKey(key: string) {
  return new Date(`${key}T12:00:00-03:00`);
}

export function CalendarView({
  initialEvents,
  initialError,
}: {
  initialEvents: CalendarEventDTO[];
  initialError: string | null;
}) {
  const [events, setEvents] = useState(initialEvents);
  const [weekDays, setWeekDays] = useState<WeekDay[]>(() => getWeekRange().days);
  const [view, setView] = useState<ViewMode>("week");
  const [periodOffset, setPeriodOffset] = useState(0);
  const [error, setError] = useState(initialError);
  const [now, setNow] = useState(() => Date.now());
  const [formOpen, setFormOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEventDTO | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function refreshEvents(currentView: ViewMode, offset: number) {
    const { start, end, days } = periodRange(currentView, offset);
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
      if (currentView === "week") setWeekDays(days);
      setError(null);
    } catch {
      setError("Falha de conexão ao atualizar os eventos.");
    }
  }

  useEffect(() => {
    refreshEvents(view, periodOffset);
    const poll = setInterval(() => refreshEvents(view, periodOffset), POLL_INTERVAL_MS);
    return () => clearInterval(poll);
  }, [view, periodOffset]);

  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), TICK_INTERVAL_MS);
    return () => clearInterval(tick);
  }, []);

  const urgentCount = useMemo(
    () => events.filter((event) => getUrgency(event.start, event.end, now) === "urgent").length,
    [events, now]
  );

  useEffect(() => {
    document.title = urgentCount > 0 ? `(${urgentCount}) Portal Timoni` : "Portal Timoni";
  }, [urgentCount]);

  const todayIndex = saoPauloDayIndex(new Date(now).toISOString());
  const todayKey = eventDateKey(new Date(now).toISOString());
  const visibleWeekDays = weekDays;

  const eventsByWeekDay = useMemo(() => {
    const grouped: CalendarEventDTO[][] = Array.from({ length: 7 }, () => []);
    for (const event of events) {
      const dayIndex = saoPauloDayIndex(event.start);
      if (dayIndex >= 0 && dayIndex < 7) grouped[dayIndex].push(event);
    }
    return grouped;
  }, [events]);

  const eventGroups = useMemo(() => {
    const grouped = new Map<string, CalendarEventDTO[]>();
    for (const event of events) {
      const key = eventDateKey(event.start);
      const current = grouped.get(key) ?? [];
      current.push(event);
      grouped.set(key, current);
    }
    return Array.from(grouped.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [events]);

  async function handleDelete(event: CalendarEventDTO) {
    if (!window.confirm(`Cancelar o evento "${event.summary}"?`)) return;
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
      await refreshEvents(view, periodOffset);
    } catch {
      setError("Falha de conexão ao cancelar o evento.");
    } finally {
      setDeletingId(null);
    }
  }

  const range = periodRange(view, periodOffset);
  const rangeLabel =
    view === "week"
      ? `${format(range.start, "dd/MM", { locale: ptBR })} – ${format(
          new Date(range.end.getTime() - 1),
          "dd/MM",
          { locale: ptBR }
        )}`
      : view === "month"
        ? format(range.start, "MMMM 'de' yyyy", { locale: ptBR })
        : format(range.start, "yyyy", { locale: ptBR });

  const previousLabel =
    view === "week" ? "← Semana anterior" : view === "month" ? "← Mês anterior" : "← Ano anterior";
  const nextLabel =
    view === "week" ? "Semana seguinte →" : view === "month" ? "Mês seguinte →" : "Ano seguinte →";

  function changeView(nextView: ViewMode) {
    setView(nextView);
    setPeriodOffset(0);
  }

  function renderEvent(event: CalendarEventDTO) {
    return (
      <EventCard
        key={`${event.calendarKey}-${event.id}`}
        event={event}
        nowMs={now}
        onEdit={(selected) => {
          setEditingEvent(selected);
          setFormOpen(true);
        }}
        onDelete={handleDelete}
      />
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold">Agenda</h1>
          <p className="capitalize text-sm text-slate-400">{rangeLabel}</p>
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

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {(["week", "month", "year"] as ViewMode[]).map((mode) => (
          <Button
            key={mode}
            variant={view === mode ? "primary" : "secondary"}
            onClick={() => changeView(mode)}
          >
            {mode === "week" ? "Semana" : mode === "month" ? "Mês" : "Ano"}
          </Button>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button variant="secondary" onClick={() => setPeriodOffset((offset) => offset - 1)}>
          {previousLabel}
        </Button>
        <Button variant="secondary" onClick={() => setPeriodOffset(0)}>
          Hoje
        </Button>
        <Button variant="secondary" onClick={() => setPeriodOffset((offset) => offset + 1)}>
          {nextLabel}
        </Button>
      </div>

      {error && (
        <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      {view === "week" ? (
        visibleWeekDays.map((day) => {
          const dayEvents = eventsByWeekDay[day.dayIndex] ?? [];
          const isToday = day.dayIndex === todayIndex && periodOffset === 0;
          return (
            <section key={day.date.toISOString()} className="mt-6">
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
                {dayEvents.length === 0 && <p className="text-sm text-slate-400">Nenhum evento.</p>}
                {dayEvents.map(renderEvent)}
              </div>
            </section>
          );
        })
      ) : eventGroups.length === 0 ? (
        <p className="mt-6 text-sm text-slate-400">Nenhum evento neste período.</p>
      ) : (
        eventGroups.map(([dateKey, dayEvents]) => {
          const date = dateFromKey(dateKey);
          const isToday = dateKey === todayKey;
          return (
            <section key={dateKey} className="mt-6">
              <h2
                className={clsx(
                  "flex items-center gap-2 text-xs font-semibold uppercase tracking-wide",
                  isToday ? "text-slate-900" : "text-slate-400"
                )}
              >
                {format(date, "EEEE, dd 'de' MMMM", { locale: ptBR })}
                {isToday && (
                  <span className="rounded-full bg-slate-900 px-2 py-0.5 text-[10px] text-white">
                    Hoje
                  </span>
                )}
              </h2>
              <div className="mt-2 space-y-3">{dayEvents.map(renderEvent)}</div>
            </section>
          );
        })
      )}

      {formOpen && (
        <EventForm
          event={editingEvent}
          onClose={() => setFormOpen(false)}
          onSaved={() => refreshEvents(view, periodOffset)}
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
