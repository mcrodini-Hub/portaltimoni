"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
  recipientEmails?: string[] | null;
};
type ReadFeedback = { id: string; message: string; success: boolean } | null;

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

export default function ComunicadosFeed({ store, isAdmin = false, canConfirmRead = false, members = [] }: { store: PanelStore; isAdmin?: boolean; canConfirmRead?: boolean; members?: TeamMember[] }) {
  const [items, setItems] = useState<Comunicado[]>([]);
  const [completedAvisoIds, setCompletedAvisoIds] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");
  const [readingId, setReadingId] = useState("");
  const [employee, setEmployee] = useState("");
  const [readFeedback, setReadFeedback] = useState<ReadFeedback>(null);

  const load = useCallback(async function load() {
    try {
      const [noticesResponse, readsResponse] = await Promise.all([
        fetch("/api/comunicados", { cache: "no-store" }),
        (canConfirmRead || isAdmin) ? fetch("/api/avisos-leituras", { cache: "no-store" }) : Promise.resolve(null),
      ]);
      const noticesData = await noticesResponse.json();
      setItems(noticesResponse.ok ? ((noticesData.items || []) as Comunicado[]) : []);
      if (readsResponse?.ok) {
        const readsData = await readsResponse.json();
        setCompletedAvisoIds(Array.isArray(readsData.completedAvisoIds) ? readsData.completedAvisoIds : []);
      } else {
        setCompletedAvisoIds([]);
      }
    } catch {
      setItems([]);
      setCompletedAvisoIds([]);
    }
  }, [canConfirmRead, isAdmin]);

  useEffect(() => {
    load();
    const refresh = () => load();
    window.addEventListener("comunicados:changed", refresh);
    return () => {
      window.removeEventListener("comunicados:changed", refresh);
    };
  }, [load]);

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
    if (!selected) {
      setReadFeedback({ id: item.id, message: "Selecione seu nome.", success: false });
      return;
    }
    setBusyId(item.id);
    setReadFeedback(null);
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
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "Não foi possível registrar a leitura.");
      setReadFeedback({
        id: item.id,
        message: data.alreadyRegistered ? "Sua leitura já estava registrada." : "Leitura registrada.",
        success: true,
      });
      setReadingId("");
      await load();
    } catch (err) {
      setReadFeedback({ id: item.id, message: err instanceof Error ? err.message : "Não foi possível registrar a leitura.", success: false });
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
      {visible.map((item) => {
        const isReadByEveryone = completedAvisoIds.includes(item.id);
        return (
        <article key={item.id} className="border-l-4 border-l-amber-400 border-t border-t-blue-200 pl-3 pt-3 first:border-t-0 first:pt-0">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              {isReadByEveryone && (
                <span className="mb-1 inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-800">
                  Lido
                </span>
              )}
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
          {canConfirmRead && members.length > 0 && (
            <div className="mt-3">
              {readingId !== item.id ? (
                <button
                  type="button"
                  onClick={() => { setReadingId(item.id); setReadFeedback(null); setEmployee(""); }}
                  className="w-full rounded-xl bg-blue-800 px-4 py-3 text-sm font-semibold text-white sm:w-auto"
                >
                  Li e estou ciente
                </button>
              ) : (
                <div className="grid gap-2 rounded-xl border border-blue-200 bg-white p-3 sm:grid-cols-[minmax(180px,1fr)_auto] sm:items-end">
                  <label className="text-xs font-semibold text-slate-700">
                    Seu nome
                    <select value={employee} onChange={(event) => setEmployee(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm">
                      <option value="">Selecione</option>
                      {members.map((member) => <option key={`${member.unit}-${member.name}`} value={`${member.unit}::${member.name}`}>{member.name}</option>)}
                    </select>
                  </label>
                  <button type="button" onClick={() => confirmRead(item)} disabled={busyId === item.id} className="rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
                    {busyId === item.id ? "Registrando..." : "Confirmar leitura"}
                  </button>
                </div>
              )}
              {readFeedback?.id === item.id && <p className={`mt-2 text-sm font-medium ${readFeedback.success ? "text-emerald-700" : "text-red-700"}`}>{readFeedback.message}</p>}
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
        );
      })}
    </section>
  );
}
