"use client";

import { useState, type FormEvent } from "react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { BrazilianDateInput, BrazilianDateTimeInput } from "@/components/ui/brazilian-date-input";
import { CALENDAR_LABELS, type CalendarEventDTO, type CalendarKey } from "@/lib/types";

const CALENDAR_OPTIONS = Object.entries(CALENDAR_LABELS) as [CalendarKey, string][];
type RecurrencePreset = "none" | "biweekly" | "monthly" | "yearly" | "custom";
type RecurrenceFrequency = "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY";
type EditScope = "occurrence" | "series";

function isDateOnly(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function toDatetimeLocal(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function toDateLocal(value: string) {
  if (isDateOnly(value)) return value;
  const d = new Date(value);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function addDays(dateValue: string, days: number) {
  const [year, month, day] = dateValue.split("-").map(Number);
  const date = new Date(year, month - 1, day, 12, 0, 0);
  date.setDate(date.getDate() + days);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function defaultTimes() {
  const start = new Date();
  start.setMinutes(0, 0, 0);
  start.setHours(start.getHours() + 1);
  const end = new Date(start.getTime() + 60 * 60 * 1000);
  return { start: toDatetimeLocal(start.toISOString()), end: toDatetimeLocal(end.toISOString()) };
}

function buildRecurrence(
  preset: RecurrencePreset,
  interval: number,
  frequency: RecurrenceFrequency
): string[] | undefined {
  if (preset === "none") return undefined;
  if (preset === "biweekly") return ["RRULE:FREQ=WEEKLY;INTERVAL=2"];
  if (preset === "monthly") return ["RRULE:FREQ=MONTHLY"];
  if (preset === "yearly") return ["RRULE:FREQ=YEARLY"];
  return [`RRULE:FREQ=${frequency};INTERVAL=${interval}`];
}

export function EventForm({
  event,
  onClose,
  onSaved,
}: {
  event?: CalendarEventDTO | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEditing = !!event;
  const defaults = defaultTimes();
  const initialAllDay = Boolean(event?.allDay || (event?.start && isDateOnly(event.start)));
  const [summary, setSummary] = useState(event?.summary ?? "");
  const [location, setLocation] = useState(event?.location ?? "");
  const [description, setDescription] = useState(event?.description ?? "");
  const [allDay, setAllDay] = useState(initialAllDay);
  const [start, setStart] = useState(
    event ? (initialAllDay ? toDateLocal(event.start) : toDatetimeLocal(event.start)) : defaults.start
  );
  const [end, setEnd] = useState(
    event ? (initialAllDay ? toDateLocal(event.end) : toDatetimeLocal(event.end)) : defaults.end
  );
  const [calendarKey, setCalendarKey] = useState<CalendarKey>(event?.calendarKey ?? "principal");
  const [recurrencePreset, setRecurrencePreset] = useState<RecurrencePreset>("none");
  const [customInterval, setCustomInterval] = useState(1);
  const [customFrequency, setCustomFrequency] = useState<RecurrenceFrequency>("WEEKLY");
  const [editScope, setEditScope] = useState<EditScope>("occurrence");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isRecurringInstance = Boolean(event?.recurringEventId);
  const editingSeries = isEditing && isRecurringInstance && editScope === "series";

  function handleAllDayChange(checked: boolean) {
    setAllDay(checked);
    if (checked) {
      const startDate = start.slice(0, 10);
      const endDate = end.slice(0, 10);
      setStart(startDate);
      setEnd(endDate > startDate ? endDate : addDays(startDate, 1));
    } else {
      const startDate = start.slice(0, 10);
      const endDate = end.slice(0, 10);
      setStart(`${startDate}T09:00`);
      setEnd(`${endDate}T10:00`);
    }
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (!summary.trim()) {
      setError("Título é obrigatório.");
      return;
    }
    if (customInterval < 1 || customInterval > 99) {
      setError("O intervalo deve ser de 1 a 99.");
      return;
    }

    const startValue = allDay ? start : new Date(start).toISOString();
    const endValue = allDay ? end : new Date(end).toISOString();
    if (new Date(endValue) <= new Date(startValue)) {
      setError("O fim deve ser depois do início.");
      return;
    }

    setSaving(true);
    try {
      const targetEventId =
        editingSeries && event?.recurringEventId ? event.recurringEventId : event?.id;
      const url = isEditing
        ? `/api/events/${encodeURIComponent(targetEventId!)}?calendarKey=${event!.calendarKey}`
        : "/api/events";
      const body = {
        summary: summary.trim(),
        location: location.trim() || undefined,
        description: description.trim() || undefined,
        ...(!editingSeries ? { start: startValue, end: endValue } : {}),
        ...(isEditing
          ? {}
          : {
              calendarKey,
              recurrence: buildRecurrence(recurrencePreset, customInterval, customFrequency),
            }),
      };
      const res = await fetch(url, {
        method: isEditing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Não foi possível salvar o evento.");
        return;
      }
      onSaved();
      onClose();
    } catch {
      setError("Falha de conexão. Tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title={isEditing ? "Editar evento" : "Novo evento"} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="block text-sm font-medium text-slate-700">Agenda</label>
          <select
            value={calendarKey}
            onChange={(e) => setCalendarKey(e.target.value as CalendarKey)}
            disabled={isEditing}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-100 disabled:text-slate-500"
          >
            {CALENDAR_OPTIONS.map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        </div>

        {isEditing && isRecurringInstance && (
          <div>
            <label className="block text-sm font-medium text-slate-700">Aplicar alteração</label>
            <select
              value={editScope}
              onChange={(e) => setEditScope(e.target.value as EditScope)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="occurrence">Somente esta ocorrência</option>
              <option value="series">Toda a série</option>
            </select>
            {editingSeries && (
              <p className="mt-1 text-xs leading-5 text-slate-500">
                Título, local e descrição serão alterados em toda a série. Datas e horários serão preservados.
              </p>
            )}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-slate-700">Título</label>
          <input
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            placeholder="Ex: Reunião fornecedor"
          />
        </div>

        <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
          <input
            type="checkbox"
            checked={allDay}
            disabled={editingSeries}
            onChange={(e) => handleAllDayChange(e.target.checked)}
            className="h-4 w-4 rounded border-slate-300"
          />
          Dia inteiro
        </label>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-slate-700">Início</label>
            {allDay ? (
              <BrazilianDateInput value={start} disabled={editingSeries} onChange={setStart} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-100 disabled:text-slate-500" />
            ) : (
              <BrazilianDateTimeInput value={start} disabled={editingSeries} onChange={setStart} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-100 disabled:text-slate-500" />
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Fim</label>
            {allDay ? (
              <BrazilianDateInput value={end} disabled={editingSeries} onChange={setEnd} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-100 disabled:text-slate-500" />
            ) : (
              <BrazilianDateTimeInput value={end} disabled={editingSeries} onChange={setEnd} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-100 disabled:text-slate-500" />
            )}
          </div>
        </div>

        {!isEditing && (
          <div>
            <label className="block text-sm font-medium text-slate-700">Repetição</label>
            <select
              value={recurrencePreset}
              onChange={(e) => setRecurrencePreset(e.target.value as RecurrencePreset)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="none">Não repetir</option>
              <option value="biweekly">Quinzenal</option>
              <option value="monthly">Mensal</option>
              <option value="yearly">Anual</option>
              <option value="custom">Personalizado</option>
            </select>
            {recurrencePreset === "custom" && (
              <div className="mt-2 grid grid-cols-[90px_1fr] gap-2">
                <input
                  type="number"
                  min={1}
                  max={99}
                  value={customInterval}
                  onChange={(e) => setCustomInterval(Number(e.target.value))}
                  aria-label="Intervalo da repetição"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
                <select
                  value={customFrequency}
                  onChange={(e) => setCustomFrequency(e.target.value as RecurrenceFrequency)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value="DAILY">dia(s)</option>
                  <option value="WEEKLY">semana(s)</option>
                  <option value="MONTHLY">mês(es)</option>
                  <option value="YEARLY">ano(s)</option>
                </select>
              </div>
            )}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-slate-700">Local (opcional)</label>
          <input value={location} onChange={(e) => setLocation(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700">Descrição (opcional)</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </div>

        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button type="submit" disabled={saving}>{saving ? "Salvando…" : "Salvar"}</Button>
        </div>
      </form>
    </Modal>
  );
}
