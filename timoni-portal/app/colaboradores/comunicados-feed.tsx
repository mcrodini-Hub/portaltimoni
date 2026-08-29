"use client";

import { useEffect, useMemo, useState } from "react";
import type { TeamMember } from "@/lib/team-members";

type PanelStore = "geral" | "rio claro" | "araras";
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

function formatDate(value: string) {
  if (!value) return "";
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(value));
}

function isWithinDisplayEndDate(value: string, now = Date.now()) {
  if (!value) return true;

  const expiresAt = new Date(value);
  if (Number.isNaN(expiresAt.getTime())) return false;

  // "Exibir até" é uma data inclusiva: o comunicado deve permanecer visível
  // durante todo o dia informado, no horário de São Paulo.
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(expiresAt);
  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value);
  const day = Number(parts.find((part) => part.type === "day")?.value);
  const nextDayInSaoPaulo = Date.UTC(year, month - 1, day + 1, 3);

  return now < nextDayInSaoPaulo;
}

export default function ComunicadosFeed({ store, isAdmin = false, members = [] }: { store: PanelStore; isAdmin?: boolean; members?: TeamMember[] }) {
  const [items, setItems] = useState<Comunicado[]>([]);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");
  const [readingId, setReadingId] = useState("");
  const [employee, setEmployee] = useState("");
  const [pin, setPin] = useState("");
  const [readFeedback, setReadFeedback] = useState("");

  async function load() {
    try {
      const response = await fetch("/api/comunicados", { cache: "no-store" });
      const data = await response.json();
      setItems(response.ok ? ((data.items || []) as Comunicado[]) : []);
    } catch {
      setItems([]);
    }
  }

  useEffect(() => {
    load();
    const refresh = () => load();
    window.addEventListener("comunicados:changed", refresh);
    return () => {
      window.removeEventListener("comunicados:changed", refresh);
    };
  }, []);

  async function archive(id: string) {
    setBusyId(id);
    setError("");
    try {
      const response = await fetch("/api/comunicados", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action: "archive" }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "Não foi possível concluir.");
      window.dispatchEvent(new Event("comunicados:changed"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível concluir.");
    } finally {
      setBusyId("");
    }
  }

  async function remove(id: string) {
    if (!window.confirm("Excluir este aviso definitivamente?")) return;
    setBusyId(id);
    setError("");
    try {
      const response = await fetch("/api/comunicados", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "Não foi possível excluir.");
      window.dispatchEvent(new Event("comunicados:changed"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível excluir.");
    } finally {
      setBusyId("");
    }
  }

  async function confirmRead(item: Comunicado) {
    const selected = members.find((member) => `${member.unit}::${member.name}` === employee);
    if (!selected || !/^\d{4}$/.test(pin)) {
      setReadFeedback("Selecione seu nome e informe sua senha de 4 números.");
      return;
    }
    setBusyId(item.id);
    setReadFeedback("");
    try {
      const response = await fetch("/api/avisos-leituras", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "read",
          avisoId: item.id,
          title: item.title,
          employee: selected.name,
          unit: selected.unit,
          pin,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "Não foi possível registrar a leitura.");
      setReadFeedback(data.alreadyRegistered ? `A leitura de ${selected.name} já estava registrada.` : `Leitura registrada para ${selected.name}.`);
      setPin("");
      setReadingId("");
    } catch (err) {
      setReadFeedback(err instanceof Error ? err.message : "Não foi possível registrar a leitura.");
    } finally {
      setBusyId("");
    }
  }

  const visible = useMemo(
    () =>
      items.filter(
        (item) =>
          item.status === "ativo" &&
          (!item.startsAt || Date.parse(item.startsAt) <= Date.now()) &&
          isWithinDisplayEndDate(item.expiresAt) &&
          (store === "geral" || item.unit === "geral" || item.unit === store),
      ),
    [items, store],
  );

  if (!visible.length) return <p className="text-sm text-slate-500">Nenhum aviso ativo.</p>;

  return (
    <section className="space-y-4">
      {error && <p className="text-sm font-medium text-red-700">{error}</p>}
      {visible.map((item) => (
        <article key={item.id} className="border-l-4 border-l-amber-400 border-t border-t-blue-200 pl-3 pt-4 first:border-t-0 first:pt-0">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-slate-950 sm:text-lg">{item.title}</h3>
            </div>
            <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm">
              {formatDate(item.createdAt)}
            </span>
          </div>
          <details className="mt-2">
            <summary className="cursor-pointer text-sm font-semibold text-blue-800">Ver aviso completo →</summary>
            <p className="mt-3 whitespace-pre-wrap border-t border-blue-100 pt-3 text-sm leading-6 text-slate-700">{item.message}</p>
          </details>
          {!isAdmin && members.length > 0 && (
            <div className="mt-3">
              {readingId !== item.id ? (
                <button
                  type="button"
                  onClick={() => { setReadingId(item.id); setReadFeedback(""); setEmployee(""); setPin(""); }}
                  className="w-full rounded-xl bg-blue-800 px-4 py-3 text-sm font-semibold text-white sm:w-auto"
                >
                  Li e estou ciente
                </button>
              ) : (
                <div className="grid gap-2 rounded-xl border border-blue-200 bg-white p-3 sm:grid-cols-[minmax(180px,1fr)_130px_auto] sm:items-end">
                  <label className="text-xs font-semibold text-slate-700">
                    Seu nome
                    <select value={employee} onChange={(event) => setEmployee(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm">
                      <option value="">Selecione</option>
                      {members.map((member) => <option key={`${member.unit}-${member.name}`} value={`${member.unit}::${member.name}`}>{member.name}</option>)}
                    </select>
                  </label>
                  <label className="text-xs font-semibold text-slate-700">
                    Senha de 4 números
                    <input value={pin} onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 4))} inputMode="numeric" type="password" maxLength={4} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm" />
                  </label>
                  <button type="button" onClick={() => confirmRead(item)} disabled={busyId === item.id} className="rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
                    {busyId === item.id ? "Registrando..." : "Confirmar"}
                  </button>
                </div>
              )}
              {readFeedback && <p className={`mt-2 text-sm font-medium ${readFeedback.startsWith("Leitura") || readFeedback.includes("já estava") ? "text-emerald-700" : "text-red-700"}`}>{readFeedback}</p>}
            </div>
          )}
          {isAdmin && (
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => window.dispatchEvent(new CustomEvent("comunicado:edit", { detail: item }))}
                disabled={busyId === item.id}
                className="rounded-lg border border-blue-200 bg-white px-3 py-2 text-xs font-semibold text-blue-800 disabled:opacity-50"
              >
                Editar
              </button>
              <button
                type="button"
                onClick={() => archive(item.id)}
                disabled={busyId === item.id}
                className="rounded-lg border border-emerald-200 bg-white px-3 py-2 text-xs font-semibold text-emerald-800 disabled:opacity-50"
              >
                Concluir
              </button>
              <button
                type="button"
                onClick={() => remove(item.id)}
                disabled={busyId === item.id}
                className="rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-semibold text-red-700 disabled:opacity-50"
              >
                Excluir
              </button>
            </div>
          )}
        </article>
      ))}
    </section>
  );
}
