"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { EventCard, getUrgency } from "@/components/event-card";
import { EventForm } from "./event-form";
import type { CalendarEventDTO } from "@/lib/types";

const POLL_INTERVAL_MS = 60_000;
const TICK_INTERVAL_MS = 30_000;

export function CalendarView({
  initialEvents,
  initialError,
}: {
  initialEvents: CalendarEventDTO[];
  initialError: string | null;
}) {
  const [events, setEvents] = useState(initialEvents);
  const [error, setError] = useState(initialError);
  const [now, setNow] = useState(() => Date.now());
  const [formOpen, setFormOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEventDTO | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function refreshEvents() {
    try {
      const res = await fetch(`/api/events?timeMin=${encodeURIComponent(new Date().toISOString())}`);
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
    const poll = setInterval(refreshEvents, POLL_INTERVAL_MS);
    const tick = setInterval(() => setNow(Date.now()), TICK_INTERVAL_MS);
    return () => {
      clearInterval(poll);
      clearInterval(tick);
    };
  }, []);

  const urgentCount = useMemo(
    () => events.filter((e) => getUrgency(e.start, e.end, now) === "urgent").length,
    [events, now]
  );

  useEffect(() => {
    document.title = urgentCount > 0 ? `(${urgentCount}) Timoni Portal` : "Timoni Portal";
  }, [urgentCount]);

  const { todayEvents, futureEvents } = useMemo(() => {
    const today: CalendarEventDTO[] = [];
    const future: CalendarEventDTO[] = [];
    for (const event of events) {
      const urgency = getUrgency(event.start, event.end, now);
      if (urgency === "urgent" || urgency === "today") {
        today.push(event);
      } else {
        future.push(event);
      }
    }
    return { todayEvents: today, futureEvents: future };
  }, [events, now]);

  async function handleDelete(event: CalendarEventDTO) {
    const confirmed = window.confirm(`Cancelar o evento "${event.summary}"?`);
    if (!confirmed) return;

    setDeletingId(event.id);
    try {
      const res = await fetch(`/api/events/${event.id}`, { method: "DELETE" });
      if (!res.ok && res.status !== 204) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Não foi possível cancelar o evento.");
        return;
      }
      await refreshEvents();
    } catch {
      setError("Falha de conexão ao cancelar o evento.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Agenda</h1>
        <Button
          onClick={() => {
            setEditingEvent(null);
            setFormOpen(true);
          }}
        >
          + Novo evento
        </Button>
      </div>

      {error && (
        <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      <section className="mt-6">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Hoje</h2>
        <div className="mt-2 space-y-3">
          {todayEvents.length === 0 && (
            <p className="text-sm text-slate-400">Nenhum evento para hoje.</p>
          )}
          {todayEvents.map((event) => (
            <EventCard
              key={event.id}
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

      <section className="mt-8">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          Próximos dias
        </h2>
        <div className="mt-2 space-y-3">
          {futureEvents.length === 0 && (
            <p className="text-sm text-slate-400">Nenhum evento futuro encontrado.</p>
          )}
          {futureEvents.map((event) => (
            <EventCard
              key={event.id}
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

      {formOpen && (
        <EventForm
          event={editingEvent}
          onClose={() => setFormOpen(false)}
          onSaved={refreshEvents}
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
