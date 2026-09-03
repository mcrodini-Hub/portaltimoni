"use client";

import { useEffect, useMemo, useState } from "react";
import { BrazilianDateTimeInput } from "@/components/ui/brazilian-date-input";

type Comunicado = {
  id: string;
  createdAt: string;
  unit: "geral" | "araras" | "rio claro";
  title: string;
  message: string;
  status: "ativo" | "arquivado";
  updatedAt: string;
  startsAt: string;
  expiresAt: string;
};

type FormState = {
  id: string;
  unit: Comunicado["unit"];
  title: string;
  message: string;
  startsAt: string;
  expiresAt: string;
};

const EMPTY_FORM: FormState = { id: "", unit: "geral", title: "", message: "", startsAt: "", expiresAt: "" };

function toLocalInput(value: string) {
  if (!value) return "";
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function formatDate(value: string) {
  if (!value) return "";
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function unitLabel(unit: Comunicado["unit"]) {
  if (unit === "araras") return "Araras";
  if (unit === "rio claro") return "Rio Claro";
  return "Geral";
}

export default function ComunicadosAdmin() {
  const [items, setItems] = useState<Comunicado[]>([]);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    setError("");
    try {
      const noticesResponse = await fetch("/api/comunicados", { cache: "no-store" });
      const data = await noticesResponse.json();
      if (!noticesResponse.ok) throw new Error(data?.error || "Erro ao carregar avisos.");
      setItems(data.items || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar avisos.");
    }
  }

  useEffect(() => {
    load();
    const startEdit = (event: Event) => {
      const item = (event as CustomEvent<Comunicado>).detail;
      if (!item) return;
      edit(item);
    };
    const refresh = () => load();
    window.addEventListener("comunicado:edit", startEdit);
    window.addEventListener("comunicados:changed", refresh);
    return () => {
      window.removeEventListener("comunicado:edit", startEdit);
      window.removeEventListener("comunicados:changed", refresh);
    };
  }, []);

  const active = useMemo(() => items.filter((item) => item.status === "ativo"), [items]);
  const archived = useMemo(() => items.filter((item) => item.status === "arquivado"), [items]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/comunicados", {
        method: form.id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: form.id || undefined,
          unit: form.unit,
          title: form.title,
          message: form.message,
          startsAt: form.startsAt ? new Date(form.startsAt).toISOString() : "",
          expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : "",
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "Não foi possível salvar.");
      setForm(EMPTY_FORM);
      await load();
      window.dispatchEvent(new Event("comunicados:changed"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível salvar.");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    if (!window.confirm("Excluir este aviso definitivamente?")) return;
    setError("");
    const response = await fetch("/api/comunicados", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    const data = await response.json();
    if (!response.ok) {
      setError(data?.error || "Não foi possível excluir.");
      return;
    }
    if (form.id === id) setForm(EMPTY_FORM);
    await load();
    window.dispatchEvent(new Event("comunicados:changed"));
  }

  function edit(item: Comunicado) {
    setForm({ id: item.id, unit: item.unit, title: item.title, message: item.message, startsAt: toLocalInput(item.startsAt), expiresAt: toLocalInput(item.expiresAt) });
    window.setTimeout(() => document.getElementById("novo-comunicado")?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
  }

  return (
    <section className="mt-6 rounded-3xl border border-blue-200 bg-white p-6 shadow-sm lg:p-8">
      <div className="flex flex-wrap items-start justify-between gap-3 lg:items-center">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-blue-700">Gerenciar avisos</p>
          <h2 className="mt-2 text-2xl font-semibold text-slate-950">Avisos do Painel</h2>
          <p className="mt-2 text-sm text-slate-600">Somente no seu acesso. Escolha Geral, Araras ou Rio Claro.</p>
        </div>
        <div className="hidden items-center gap-3 lg:flex">
          <div className="min-w-28 rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-center">
            <p className="text-2xl font-bold text-blue-900">{active.length}</p>
            <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">Ativos</p>
          </div>
          <div className="min-w-28 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-center">
            <p className="text-2xl font-bold text-slate-700">{archived.length}</p>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Arquivados</p>
          </div>
        </div>
      </div>

      <form id="novo-comunicado" onSubmit={submit} className="mt-5 grid gap-4 rounded-2xl bg-blue-50 p-4 lg:grid-cols-12 lg:border lg:border-blue-100 lg:p-6">
        <div className="hidden lg:col-span-12 lg:block">
          <p className="text-sm font-semibold text-blue-950">{form.id ? "Editar aviso" : "Cadastrar novo aviso"}</p>
          <p className="mt-1 text-xs text-blue-700">Defina o público, o período de exibição e o conteúdo.</p>
        </div>

        <label className="text-sm font-medium text-slate-700 lg:col-span-3">
          Público
          <select
            value={form.unit}
            onChange={(event) => setForm((current) => ({ ...current, unit: event.target.value as Comunicado["unit"] }))}
            className="mt-1 w-full rounded-xl border border-blue-200 bg-white px-3 py-2.5 outline-none focus:border-blue-500"
          >
            <option value="geral">Geral</option>
            <option value="araras">Araras</option>
            <option value="rio claro">Rio Claro</option>
          </select>
        </label>

        <label className="text-sm font-medium text-slate-700 lg:col-span-9">
          Título
          <input
            value={form.title}
            onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
            className="mt-1 w-full rounded-xl border border-blue-200 bg-white px-3 py-2.5 outline-none focus:border-blue-500"
            placeholder="Ex.: Reunião dia 03"
            required
          />
        </label>

        <label className="text-sm font-medium text-slate-700 lg:col-span-6">
          Início da exibição
          <BrazilianDateTimeInput
            value={form.startsAt}
            onChange={(value) => setForm((current) => ({ ...current, startsAt: value }))}
            className="mt-1 w-full rounded-xl border border-blue-200 bg-white px-3 py-2.5 outline-none focus:border-blue-500"
          />
          <span className="mt-1 block text-xs font-normal text-slate-500">Em branco: começa imediatamente.</span>
        </label>

        <label className="text-sm font-medium text-slate-700 lg:col-span-6">
          Exibir até
          <BrazilianDateTimeInput
            value={form.expiresAt}
            onChange={(value) => setForm((current) => ({ ...current, expiresAt: value }))}
            className="mt-1 w-full rounded-xl border border-blue-200 bg-white px-3 py-2.5 outline-none focus:border-blue-500"
          />
          <span className="mt-1 block text-xs font-normal text-slate-500">Em branco: permanece ativo até ser concluído.</span>
        </label>

        <label className="text-sm font-medium text-slate-700 lg:col-span-12">
          Aviso
          <textarea
            value={form.message}
            onChange={(event) => setForm((current) => ({ ...current, message: event.target.value }))}
            className="mt-1 min-h-32 w-full rounded-xl border border-blue-200 bg-white px-3 py-2.5 outline-none focus:border-blue-500"
            placeholder="Digite o aviso para a equipe"
            required
          />
        </label>

        <div className="flex flex-wrap gap-2 lg:col-span-12 lg:justify-end">
          <button type="submit" disabled={saving} className="rounded-xl bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
            {saving ? "Salvando..." : form.id ? "Salvar edição" : "Registrar"}
          </button>
          {form.id && (
            <button type="button" onClick={() => setForm(EMPTY_FORM)} className="rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700">
              Cancelar edição
            </button>
          )}
        </div>
      </form>

      {error && <p className="mt-4 text-sm font-medium text-red-700">{error}</p>}

      <details className="mt-6 border-t border-slate-200 pt-4 lg:mt-8 lg:pt-5">
        <summary className="cursor-pointer text-sm font-semibold text-slate-700">Avisos desativados ({archived.length})</summary>
        <div className="mt-3 grid gap-3 xl:grid-cols-2">
          {archived.length === 0 ? (
            <p className="text-sm text-slate-500">Nenhum aviso arquivado.</p>
          ) : archived.map((item) => (
            <article key={item.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 opacity-80">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{unitLabel(item.unit)} · {formatDate(item.createdAt)}</p>
              <h3 className="mt-1 font-semibold text-slate-900">{item.title}</h3>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">{item.message}</p>
              <button type="button" onClick={() => remove(item.id)} className="mt-3 rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-semibold text-red-700">Excluir</button>
            </article>
          ))}
        </div>
      </details>

    </section>
  );
}
