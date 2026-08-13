"use client";

import { useEffect, useMemo, useState } from "react";

type Meeting = {
  id: string;
  unit: "Araras" | "Rio Claro";
  date: string;
  time: string;
  secondDate: string;
  secondTime: string;
  frequency: string;
  leaders: string;
  pautaUrl: string;
  ataUrl: string;
  slidesUrl: string;
  status: "agendada" | "concluida";
};

type FormState = Omit<Meeting, "status">;
const EMPTY: FormState = {
  id: "", unit: "Araras", date: "", time: "07:40", secondDate: "",
  secondTime: "07:40", frequency: "Mensal", leaders: "",
  pautaUrl: "", ataUrl: "", slidesUrl: "",
};

function formatDate(value: string) {
  if (!value) return "";
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

function formatTime(value: string) {
  return value ? value.replace(/^0/, "") : "";
}

function MeetingCard({
  meeting, canManage, onEdit, onComplete, onDelete,
}: {
  meeting: Meeting;
  canManage: boolean;
  onEdit: (meeting: Meeting) => void;
  onComplete: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const color = meeting.unit === "Araras" ? "border-amber-200 bg-amber-50" : "border-blue-200 bg-blue-50";
  return (
    <article className={`rounded-3xl border p-5 ${color}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Próximas reuniões</p>
          <h3 className="mt-1 text-2xl font-semibold text-slate-900">{meeting.unit}</h3>
        </div>
        <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700">{meeting.frequency}</span>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-white/80 p-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Próxima</p>
          <p className="mt-1 font-semibold text-slate-900">{formatDate(meeting.date)}</p>
          <p className="text-xs text-slate-500">{formatTime(meeting.time)}</p>
        </div>
        <div className="rounded-2xl bg-white/80 p-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Seguinte</p>
          <p className="mt-1 font-semibold text-slate-900">{formatDate(meeting.secondDate)}</p>
          <p className="text-xs text-slate-500">{formatTime(meeting.secondTime)}</p>
        </div>
      </div>

      {meeting.leaders && <p className="mt-4 text-sm text-slate-600">Condução: <strong>{meeting.leaders}</strong></p>}
      <div className="mt-4 flex flex-wrap gap-4">
        {meeting.pautaUrl && <a href={meeting.pautaUrl} target="_blank" rel="noreferrer" className="text-sm font-semibold text-emerald-700">Abrir pauta →</a>}
        {meeting.ataUrl && <a href={meeting.ataUrl} target="_blank" rel="noreferrer" className="text-sm font-semibold text-blue-700">Abrir ata →</a>}
        {meeting.slidesUrl && <a href={meeting.slidesUrl} target="_blank" rel="noreferrer" className="text-sm font-semibold text-rose-700">Abrir apresentação →</a>}
      </div>

      {canManage && (
        <div className="mt-5 flex flex-wrap gap-2 border-t border-slate-200/80 pt-4">
          <button onClick={() => onEdit(meeting)} className="rounded-lg border border-blue-200 bg-white px-3 py-2 text-xs font-semibold text-blue-800">Editar</button>
          <button onClick={() => onComplete(meeting.id)} className="rounded-lg border border-emerald-200 bg-white px-3 py-2 text-xs font-semibold text-emerald-800">Concluir</button>
          <button onClick={() => onDelete(meeting.id)} className="rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-semibold text-red-700">Excluir</button>
        </div>
      )}
    </article>
  );
}

export default function ReunioesClient({
  isGestao, canManage,
}: {
  isGestao: boolean;
  canManage: boolean;
}) {
  const [items, setItems] = useState<Meeting[]>([]);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/reunioes", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Erro ao carregar reuniões.");
      setItems(data.items || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar reuniões.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  const visible = useMemo(
    () => items.filter((item) => item.status === "agendada" && (isGestao || item.unit === "Araras")),
    [items, isGestao],
  );
  const history = useMemo(
    () => items.filter((item) => item.status === "concluida" && (isGestao || item.unit === "Araras")),
    [items, isGestao],
  );

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function startNew() {
    setForm(EMPTY);
    setShowForm(true);
  }

  function edit(meeting: Meeting) {
    const { status: _status, ...editable } = meeting;
    setForm(editable);
    setShowForm(true);
    window.setTimeout(() => document.getElementById("form-reuniao")?.scrollIntoView({ behavior: "smooth" }), 0);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/reunioes", {
        method: form.id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Não foi possível salvar.");
      setForm(EMPTY);
      setShowForm(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível salvar.");
    } finally {
      setSaving(false);
    }
  }

  async function mutate(id: string, action: "complete" | "delete") {
    if (action === "delete" && !window.confirm("Excluir esta reunião definitivamente?")) return;
    setError("");
    const response = await fetch("/api/reunioes", {
      method: action === "delete" ? "DELETE" : "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action }),
    });
    const data = await response.json();
    if (!response.ok) {
      setError(data.error || "Não foi possível concluir a operação.");
      return;
    }
    await load();
  }

  return (
    <>
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-rose-600">Gestão e acompanhamento</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">{isGestao ? "Reuniões" : "Reuniões Araras"}</h1>
            <p className="mt-2 text-sm leading-6 text-slate-600">Pautas, atas, apresentações e duas datas futuras por loja.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {canManage && <button onClick={startNew} className="rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white">+ Nova reunião</button>}
            <a href="https://drive.google.com/drive/folders/1a90BS_9nnf_9_o9VZyNDICfPyAxxyYOg" target="_blank" rel="noreferrer" className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white">Abrir pasta oficial</a>
          </div>
        </div>
      </section>

      {canManage && showForm && (
        <form id="form-reuniao" onSubmit={submit} className="mt-5 grid gap-4 rounded-3xl border border-blue-200 bg-blue-50 p-5 md:grid-cols-2">
          <h2 className="text-xl font-semibold text-slate-900 md:col-span-2">{form.id ? "Editar reunião" : "Nova reunião"}</h2>
          <label className="text-sm font-medium text-slate-700">Loja
            <select value={form.unit} onChange={(e) => setField("unit", e.target.value as Meeting["unit"])} className="mt-1 w-full rounded-xl border border-blue-200 bg-white px-3 py-2.5">
              <option>Araras</option><option>Rio Claro</option>
            </select>
          </label>
          <label className="text-sm font-medium text-slate-700">Periodicidade
            <input value={form.frequency} onChange={(e) => setField("frequency", e.target.value)} className="mt-1 w-full rounded-xl border border-blue-200 px-3 py-2.5" required />
          </label>
          <label className="text-sm font-medium text-slate-700">Primeira data
            <input type="date" value={form.date} onChange={(e) => setField("date", e.target.value)} className="mt-1 w-full rounded-xl border border-blue-200 px-3 py-2.5" required />
          </label>
          <label className="text-sm font-medium text-slate-700">Primeiro horário
            <input type="time" value={form.time} onChange={(e) => setField("time", e.target.value)} className="mt-1 w-full rounded-xl border border-blue-200 px-3 py-2.5" required />
          </label>
          <label className="text-sm font-medium text-slate-700">Segunda data
            <input type="date" value={form.secondDate} onChange={(e) => setField("secondDate", e.target.value)} className="mt-1 w-full rounded-xl border border-blue-200 px-3 py-2.5" required />
          </label>
          <label className="text-sm font-medium text-slate-700">Segundo horário
            <input type="time" value={form.secondTime} onChange={(e) => setField("secondTime", e.target.value)} className="mt-1 w-full rounded-xl border border-blue-200 px-3 py-2.5" required />
          </label>
          <label className="text-sm font-medium text-slate-700 md:col-span-2">Condução
            <input value={form.leaders} onChange={(e) => setField("leaders", e.target.value)} placeholder="Ex.: Ciça e Marcelo" className="mt-1 w-full rounded-xl border border-blue-200 px-3 py-2.5" />
          </label>
          <label className="text-sm font-medium text-slate-700 md:col-span-2">Link da pauta
            <input type="url" value={form.pautaUrl} onChange={(e) => setField("pautaUrl", e.target.value)} className="mt-1 w-full rounded-xl border border-blue-200 px-3 py-2.5" />
          </label>
          <label className="text-sm font-medium text-slate-700 md:col-span-2">Link da ata
            <input type="url" value={form.ataUrl} onChange={(e) => setField("ataUrl", e.target.value)} className="mt-1 w-full rounded-xl border border-blue-200 px-3 py-2.5" />
          </label>
          <label className="text-sm font-medium text-slate-700 md:col-span-2">Link da apresentação
            <input type="url" value={form.slidesUrl} onChange={(e) => setField("slidesUrl", e.target.value)} className="mt-1 w-full rounded-xl border border-blue-200 px-3 py-2.5" />
          </label>
          <div className="flex gap-2 md:col-span-2">
            <button disabled={saving} className="rounded-xl bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{saving ? "Salvando..." : "Salvar reunião"}</button>
            <button type="button" onClick={() => setShowForm(false)} className="rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700">Cancelar</button>
          </div>
        </form>
      )}

      {error && <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm font-medium text-red-700">{error}</p>}

      <section className="mt-5">
        <h2 className="text-xl font-semibold text-slate-900">Reuniões agendadas</h2>
        {loading ? <p className="mt-3 text-sm text-slate-500">Carregando...</p> :
          visible.length ? <div className={`mt-3 grid gap-4 ${isGestao ? "md:grid-cols-2" : ""}`}>
            {visible.map((meeting) => <MeetingCard key={meeting.id} meeting={meeting} canManage={canManage} onEdit={edit} onComplete={(id) => void mutate(id, "complete")} onDelete={(id) => void mutate(id, "delete")} />)}
          </div> : <p className="mt-3 text-sm text-slate-500">Nenhuma reunião agendada.</p>}
      </section>

      <details className="mt-6 rounded-2xl border border-slate-200 bg-white p-4">
        <summary className="cursor-pointer text-sm font-semibold text-slate-700">Histórico de concluídas ({history.length})</summary>
        <div className="mt-4 grid gap-3">
          {history.length ? history.map((meeting) => (
            <div key={meeting.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50 p-3">
              <p className="text-sm text-slate-700"><strong>{meeting.unit}</strong> · {formatDate(meeting.date)} · {formatTime(meeting.time)}</p>
              {canManage && <button onClick={() => void mutate(meeting.id, "delete")} className="text-xs font-semibold text-red-700">Excluir</button>}
            </div>
          )) : <p className="text-sm text-slate-500">Nenhuma reunião concluída.</p>}
        </div>
      </details>
    </>
  );
}
