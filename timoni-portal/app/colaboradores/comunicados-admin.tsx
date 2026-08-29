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

type AvisoLeitura = { avisoId: string; employee: string; unit: string; portalEmail: string; readAt: string; title: string };
type FuncionarioAviso = { employee: string; unit: string; pinConfigured: boolean };

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
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [reads, setReads] = useState<AvisoLeitura[]>([]);
  const [employees, setEmployees] = useState<FuncionarioAviso[]>([]);
  const [pinEmployee, setPinEmployee] = useState("");
  const [newPin, setNewPin] = useState("");
  const [pinFeedback, setPinFeedback] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [noticesResponse, readsResponse] = await Promise.all([
        fetch("/api/comunicados", { cache: "no-store" }),
        fetch("/api/avisos-leituras", { cache: "no-store" }),
      ]);
      const data = await noticesResponse.json();
      if (!noticesResponse.ok) throw new Error(data?.error || "Erro ao carregar avisos.");
      setItems(data.items || []);
      if (readsResponse.ok) {
        const readsData = await readsResponse.json();
        setReads(readsData.reads || []);
        setEmployees(readsData.employees || []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar avisos.");
    } finally {
      setLoading(false);
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

  async function archive(id: string) {
    setError("");
    const response = await fetch("/api/comunicados", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action: "archive" }),
    });
    const data = await response.json();
    if (!response.ok) {
      setError(data?.error || "Não foi possível concluir.");
      return;
    }
    if (form.id === id) setForm(EMPTY_FORM);
    await load();
    window.dispatchEvent(new Event("comunicados:changed"));
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

  async function savePin(event: React.FormEvent) {
    event.preventDefault();
    const selected = employees.find((item) => `${item.unit}::${item.employee}` === pinEmployee);
    if (!selected || !/^\d{4}$/.test(newPin)) {
      setPinFeedback("Selecione o funcionário e informe uma senha de 4 números.");
      return;
    }
    setSaving(true);
    setPinFeedback("");
    try {
      const response = await fetch("/api/avisos-leituras", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "set_pin", employee: selected.employee, unit: selected.unit, pin: newPin }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "Não foi possível salvar a senha.");
      setPinFeedback(`Senha definida para ${selected.employee}.`);
      setNewPin("");
      await load();
    } catch (err) {
      setPinFeedback(err instanceof Error ? err.message : "Não foi possível salvar a senha.");
    } finally {
      setSaving(false);
    }
  }

  function edit(item: Comunicado) {
    setForm({ id: item.id, unit: item.unit, title: item.title, message: item.message, startsAt: toLocalInput(item.startsAt), expiresAt: toLocalInput(item.expiresAt) });
    window.setTimeout(() => document.getElementById("novo-comunicado")?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
  }

  return (
    <section className="mt-6 rounded-3xl border border-blue-200 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-blue-700">Gerenciar avisos</p>
          <h2 className="mt-2 text-2xl font-semibold text-slate-950">Avisos do Painel</h2>
          <p className="mt-2 text-sm text-slate-600">Somente no seu acesso. Escolha Geral, Araras ou Rio Claro.</p>
        </div>
      </div>

      <form id="novo-comunicado" onSubmit={submit} className="mt-5 grid gap-4 rounded-2xl bg-blue-50 p-4 lg:grid-cols-[180px_1fr]">
        <label className="text-sm font-medium text-slate-700">
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

        <label className="text-sm font-medium text-slate-700">
          Título
          <input
            value={form.title}
            onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
            className="mt-1 w-full rounded-xl border border-blue-200 bg-white px-3 py-2.5 outline-none focus:border-blue-500"
            placeholder="Ex.: Reunião dia 03"
            required
          />
        </label>

        <label className="text-sm font-medium text-slate-700">
          Início da exibição
          <BrazilianDateTimeInput
            value={form.startsAt}
            onChange={(value) => setForm((current) => ({ ...current, startsAt: value }))}
            className="mt-1 w-full rounded-xl border border-blue-200 bg-white px-3 py-2.5 outline-none focus:border-blue-500"
          />
          <span className="mt-1 block text-xs font-normal text-slate-500">Em branco: começa imediatamente.</span>
        </label>

        <label className="text-sm font-medium text-slate-700">
          Exibir até
          <BrazilianDateTimeInput
            value={form.expiresAt}
            onChange={(value) => setForm((current) => ({ ...current, expiresAt: value }))}
            className="mt-1 w-full rounded-xl border border-blue-200 bg-white px-3 py-2.5 outline-none focus:border-blue-500"
          />
          <span className="mt-1 block text-xs font-normal text-slate-500">Em branco: permanece ativo até ser concluído.</span>
        </label>

        <label className="text-sm font-medium text-slate-700 lg:col-span-2">
          Aviso
          <textarea
            value={form.message}
            onChange={(event) => setForm((current) => ({ ...current, message: event.target.value }))}
            className="mt-1 min-h-32 w-full rounded-xl border border-blue-200 bg-white px-3 py-2.5 outline-none focus:border-blue-500"
            placeholder="Digite o aviso para a equipe"
            required
          />
        </label>

        <div className="flex flex-wrap gap-2 lg:col-span-2">
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

      <div className="mt-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Ativos</p>
        {loading ? (
          <p className="mt-3 text-sm text-slate-500">Carregando...</p>
        ) : active.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">Nenhum aviso ativo.</p>
        ) : (
          <div className="mt-3 grid gap-3">
            {active.map((item) => (
              <article key={item.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-blue-700">{unitLabel(item.unit)} · {formatDate(item.createdAt)}</p>
                    <h3 className="mt-1 text-lg font-semibold text-slate-950">{item.title}</h3>
                    <p className="mt-1 text-xs text-slate-500">{item.expiresAt ? `Ativo até ${formatDate(item.expiresAt)}` : "Ativo até retirada manual"}</p>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{item.message}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => edit(item)} className="rounded-lg border border-blue-200 bg-white px-3 py-2 text-xs font-semibold text-blue-800">Editar</button>
                    <button type="button" onClick={() => archive(item.id)} className="rounded-lg border border-emerald-200 bg-white px-3 py-2 text-xs font-semibold text-emerald-800">Concluir</button>
                    <button type="button" onClick={() => remove(item.id)} className="rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-semibold text-red-700">Excluir</button>
                  </div>
                </div>
                <details className="mt-4 border-t border-slate-200 pt-3">
                  <summary className="cursor-pointer text-sm font-semibold text-blue-800">
                    Ver leituras ({reads.filter((read) => read.avisoId === item.id).length})
                  </summary>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {reads.filter((read) => read.avisoId === item.id).length === 0 ? (
                      <p className="text-sm text-slate-500">Nenhuma leitura registrada.</p>
                    ) : reads.filter((read) => read.avisoId === item.id).map((read) => (
                      <div key={`${read.avisoId}-${read.unit}-${read.employee}`} className="rounded-lg bg-white p-3 text-sm">
                        <p className="font-semibold text-slate-900">{read.employee} · {read.unit}</p>
                        <p className="mt-1 text-xs text-slate-500">{formatDate(read.readAt)}</p>
                      </div>
                    ))}
                  </div>
                </details>
              </article>
            ))}
          </div>
        )}
      </div>

      <details className="mt-6 border-t border-slate-200 pt-4">
        <summary className="cursor-pointer text-sm font-semibold text-slate-700">Arquivados ({archived.length})</summary>
        <div className="mt-3 grid gap-3">
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

      <details className="mt-6 border-t border-slate-200 pt-4">
        <summary className="cursor-pointer text-sm font-semibold text-slate-700">Senhas de confirmação dos funcionários</summary>
        <form onSubmit={savePin} className="mt-4 grid gap-3 rounded-2xl bg-slate-50 p-4 sm:grid-cols-[minmax(220px,1fr)_160px_auto] sm:items-end">
          <label className="text-sm font-semibold text-slate-700">
            Funcionário
            <select value={pinEmployee} onChange={(event) => setPinEmployee(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5">
              <option value="">Selecione</option>
              {employees.map((item) => (
                <option key={`${item.unit}-${item.employee}`} value={`${item.unit}::${item.employee}`}>
                  {item.employee} · {item.unit}{item.pinConfigured ? " · senha definida" : " · sem senha"}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-semibold text-slate-700">
            Senha de 4 números
            <input value={newPin} onChange={(event) => setNewPin(event.target.value.replace(/\D/g, "").slice(0, 4))} inputMode="numeric" type="password" maxLength={4} className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5" />
          </label>
          <button type="submit" disabled={saving} className="rounded-xl bg-blue-800 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">Definir senha</button>
        </form>
        {pinFeedback && <p className={`mt-2 text-sm font-medium ${pinFeedback.startsWith("Senha definida") ? "text-emerald-700" : "text-red-700"}`}>{pinFeedback}</p>}
      </details>
    </section>
  );
}
