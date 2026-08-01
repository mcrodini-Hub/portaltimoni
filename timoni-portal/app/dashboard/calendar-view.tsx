"use client";

import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import clsx from "clsx";
import { Button } from "@/components/ui/button";
import { EventCard, getUrgency } from "@/components/event-card";
import { EventForm } from "./event-form";
import type { CalendarEventDTO } from "@/lib/types";

const POLL_INTERVAL_MS = 60_000;
const TICK_INTERVAL_MS = 30_000;
const SAO_PAULO_OFFSET_MS = -3 * 60 * 60 * 1000;

const DAY_LABELS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
const CALENDAR_DAY_LABELS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
const MINI_DAY_LABELS = ["S", "T", "Q", "Q", "S", "S", "D"];
type ViewMode = "week" | "month" | "year";

interface CalendarDay {
  key: string;
  day: number;
  inMonth: boolean;
}

function saoPauloParts(date: Date) {
  const shifted = new Date(date.getTime() + SAO_PAULO_OFFSET_MS);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth(),
    day: shifted.getUTCDate(),
  };
}

function dateKey(year: number, month: number, day: number) {
  return [
    year,
    String(month + 1).padStart(2, "0"),
    String(day).padStart(2, "0"),
  ].join("-");
}

function periodRange(view: ViewMode, offset: number) {
  if (view === "week") {
    const current = saoPauloParts(new Date());
    const start = new Date(Date.UTC(current.year, current.month, current.day, 3));
    const end = new Date(Date.UTC(current.year + 1, current.month, current.day, 3));
    return { start, end };
  }

  const current = saoPauloParts(new Date());
  if (view === "month") {
    const start = new Date(Date.UTC(current.year, current.month + offset, 1, 3));
    const end = new Date(Date.UTC(current.year, current.month + offset + 1, 1, 3));
    return { start, end };
  }

  const start = new Date(Date.UTC(current.year + offset, 0, 1, 3));
  const end = new Date(Date.UTC(current.year + offset + 1, 0, 1, 3));
  return { start, end };
}

function eventDateKey(iso: string) {
  if (!iso.includes("T")) return iso.slice(0, 10);
  const shifted = new Date(new Date(iso).getTime() + SAO_PAULO_OFFSET_MS);
  return dateKey(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate());
}

function dateFromKey(key: string) {
  return new Date(`${key}T12:00:00-03:00`);
}

function monthGrid(year: number, month: number): CalendarDay[] {
  const firstWeekDay = new Date(Date.UTC(year, month, 1)).getUTCDay();
  const daysBefore = (firstWeekDay + 6) % 7;

  return Array.from({ length: 42 }, (_, index) => {
    const value = new Date(Date.UTC(year, month, 1 - daysBefore + index));
    const cellYear = value.getUTCFullYear();
    const cellMonth = value.getUTCMonth();
    const day = value.getUTCDate();
    return {
      key: dateKey(cellYear, cellMonth, day),
      day,
      inMonth: cellYear === year && cellMonth === month,
    };
  });
}

export function CalendarView({
  initialEvents,
  initialError,
}: {
  initialEvents: CalendarEventDTO[];
  initialError: string | null;
}) {
  const [events, setEvents] = useState(initialEvents);
  const [view, setView] = useState<ViewMode>("week");
  const [periodOffset, setPeriodOffset] = useState(0);
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null);
  const [error, setError] = useState(initialError);
  const [now, setNow] = useState(() => Date.now());
  const [formOpen, setFormOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEventDTO | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function refreshEvents(currentView: ViewMode, offset: number) {
    const { start, end } = periodRange(currentView, offset);
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

  const todayParts = saoPauloParts(new Date(now));
  const todayKey = dateKey(todayParts.year, todayParts.month, todayParts.day);

  const eventsByDate = useMemo(() => {
    const grouped = new Map<string, CalendarEventDTO[]>();
    for (const event of events) {
      const key = eventDateKey(event.start);
      const current = grouped.get(key) ?? [];
      current.push(event);
      grouped.set(key, current);
    }
    return grouped;
  }, [events]);

  const range = periodRange(view, periodOffset);
  const rangeStartKey = eventDateKey(range.start.toISOString());
  const rangeEndKey = eventDateKey(range.end.toISOString());

  useEffect(() => {
    if (view !== "month") return;
    if (
      selectedDateKey &&
      selectedDateKey >= rangeStartKey &&
      selectedDateKey < rangeEndKey
    ) {
      return;
    }
    setSelectedDateKey(periodOffset === 0 ? todayKey : rangeStartKey);
  }, [view, periodOffset, rangeStartKey, rangeEndKey, selectedDateKey, todayKey]);

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

  const upcomingEvents = useMemo(
    () =>
      events
        .filter((event) => eventDateKey(event.start) >= todayKey)
        .slice(periodOffset * 7, periodOffset * 7 + 7),
    [events, periodOffset, todayKey]
  );

  const upcomingGroups = useMemo(() => {
    const grouped = new Map<string, CalendarEventDTO[]>();
    for (const event of upcomingEvents) {
      const key = eventDateKey(event.start);
      grouped.set(key, [...(grouped.get(key) ?? []), event]);
    }
    return Array.from(grouped.entries());
  }, [upcomingEvents]);

  const rangeLabel =
    view === "week"
      ? upcomingEvents.length > 0
        ? `${format(dateFromKey(eventDateKey(upcomingEvents[0].start)), "dd/MM", { locale: ptBR })} – ${format(
            dateFromKey(eventDateKey(upcomingEvents[upcomingEvents.length - 1].start)),
            "dd/MM",
            { locale: ptBR }
          )}`
        : "Nenhum compromisso futuro"
      : view === "month"
        ? format(range.start, "MMMM 'de' yyyy", { locale: ptBR })
        : format(range.start, "yyyy", { locale: ptBR });

  const previousLabel =
    view === "week" ? "← 7 eventos anteriores" : view === "month" ? "← Mês anterior" : "← Ano anterior";
  const nextLabel =
    view === "week" ? "Próximos 7 eventos →" : view === "month" ? "Mês seguinte →" : "Ano seguinte →";

  function changeView(nextView: ViewMode) {
    setView(nextView);
    setPeriodOffset(0);
  }

  function openYearDate(year: number, month: number, day: CalendarDay) {
    if (!day.inMonth) return;
    const current = saoPauloParts(new Date());
    setSelectedDateKey(day.key);
    setPeriodOffset((year - current.year) * 12 + (month - current.month));
    setView("month");
  }

  function openMonthDate(day: CalendarDay, year: number, month: number) {
    setSelectedDateKey(day.key);
    if (day.inMonth) return;

    const selected = saoPauloParts(dateFromKey(day.key));
    const current = saoPauloParts(new Date());
    setPeriodOffset((selected.year - current.year) * 12 + (selected.month - current.month));
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

  function renderEventDots(key: string, compact = false) {
    const count = eventsByDate.get(key)?.length ?? 0;
    if (count === 0) return null;
    return compact ? (
      <span className="mt-0.5 h-1 w-1 rounded-full bg-blue-600" aria-label={`${count} evento(s)`} />
    ) : (
      <span className="mt-1 rounded-full bg-blue-100 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700">
        {count} {count === 1 ? "evento" : "eventos"}
      </span>
    );
  }

  const monthParts = saoPauloParts(range.start);
  const selectedEvents = selectedDateKey ? eventsByDate.get(selectedDateKey) ?? [] : [];

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
            {mode === "week" ? "Próximos 7 eventos" : mode === "month" ? "Mês" : "Ano"}
          </Button>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button
          variant="secondary"
          disabled={view === "week" && periodOffset === 0}
          onClick={() => setPeriodOffset((offset) => view === "week" ? Math.max(0, offset - 1) : offset - 1)}
        >
          {previousLabel}
        </Button>
        <Button variant="secondary" onClick={() => setPeriodOffset(0)}>
          Hoje
        </Button>
        <Button
          variant="secondary"
          disabled={view === "week" && events.length <= (periodOffset + 1) * 7}
          onClick={() => setPeriodOffset((offset) => offset + 1)}
        >
          {nextLabel}
        </Button>
      </div>

      {error && (
        <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      {view === "week" && (
        upcomingGroups.length > 0 ? (
          upcomingGroups.map(([dayKey, dayEvents]) => {
            const day = dateFromKey(dayKey);
            const isToday = dayKey === todayKey;
            return (
              <section key={dayKey} className="mt-6">
                <h2
                  className={clsx(
                    "flex items-center gap-2 text-xs font-semibold uppercase tracking-wide",
                    isToday ? "text-slate-900" : "text-slate-400"
                  )}
                >
                  {DAY_LABELS[day.getDay()]} {format(day, "dd/MM", { locale: ptBR })}
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
        ) : (
          <p className="mt-6 text-sm text-slate-400">Nenhum compromisso futuro.</p>
        )
      )}

      {view === "month" && (
        <>
          <div className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white">
            <div className="grid grid-cols-7 bg-slate-800 text-center text-xs font-semibold text-white">
              {CALENDAR_DAY_LABELS.map((label) => (
                <div key={label} className="px-1 py-2">{label}</div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {monthGrid(monthParts.year, monthParts.month).map((day) => {
                const isToday = day.key === todayKey;
                const isSelected = day.key === selectedDateKey;
                return (
                  <button
                    key={day.key}
                    type="button"
                    onClick={() => openMonthDate(day, monthParts.year, monthParts.month)}
                    className={clsx(
                      "flex min-h-20 flex-col items-center border-b border-r border-slate-200 px-1 py-2 text-sm transition hover:bg-blue-50",
                      !day.inMonth && "bg-slate-50 text-slate-300",
                      day.inMonth && "text-slate-700",
                      isSelected && "bg-blue-100",
                      isToday && "font-bold text-blue-700"
                    )}
                  >
                    <span
                      className={clsx(
                        "flex h-7 w-7 items-center justify-center rounded-full",
                        isToday && "bg-blue-600 text-white"
                      )}
                    >
                      {day.day}
                    </span>
                    {renderEventDots(day.key)}
                  </button>
                );
              })}
            </div>
          </div>

          {selectedDateKey && (
            <section className="mt-6">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                {format(dateFromKey(selectedDateKey), "EEEE, dd 'de' MMMM", { locale: ptBR })}
              </h2>
              <div className="mt-2 space-y-3">
                {selectedEvents.length === 0 && (
                  <p className="text-sm text-slate-400">Nenhum evento.</p>
                )}
                {selectedEvents.map(renderEvent)}
              </div>
            </section>
          )}
        </>
      )}

      {view === "year" && (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 12 }, (_, month) => (
            <section key={month} className="rounded-xl border border-slate-200 bg-white p-3">
              <h2 className="mb-2 text-center text-sm font-semibold capitalize text-slate-800">
                {format(new Date(Date.UTC(monthParts.year, month, 1, 12)), "MMMM", { locale: ptBR })}
              </h2>
              <div className="grid grid-cols-7 text-center text-[9px] font-semibold text-slate-400">
                {MINI_DAY_LABELS.map((label, index) => (
                  <div key={`${label}-${index}`} className="py-1">{label}</div>
                ))}
              </div>
              <div className="grid grid-cols-7">
                {monthGrid(monthParts.year, month).map((day) =>
                  day.inMonth ? (
                    <button
                      key={day.key}
                      type="button"
                      onClick={() => openYearDate(monthParts.year, month, day)}
                      className={clsx(
                        "flex aspect-square flex-col items-center justify-center rounded text-[10px] text-slate-600 hover:bg-blue-50",
                        day.key === todayKey && "bg-blue-600 font-bold text-white"
                      )}
                    >
                      <span>{day.day}</span>
                      {renderEventDots(day.key, true)}
                    </button>
                  ) : (
                    <span key={day.key} className="aspect-square" />
                  )
                )}
              </div>
            </section>
          ))}
        </div>
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
