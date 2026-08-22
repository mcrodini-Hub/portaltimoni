"use client";

import { useEffect, useMemo, useState } from "react";

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

function label(unit: Comunicado["unit"]) {
  if (unit === "araras") return "Araras";
  if (unit === "rio claro") return "Rio Claro";
  return "Geral";
}

function formatDate(value: string) {
  if (!value) return "";
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(value));
}

export default function ComunicadosFeed({ store, isAdmin = false }: { store: PanelStore; isAdmin?: boolean }) {
  const [items, setItems] = useState<Comunicado[]>([]);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");

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
    if (!window.confirm("Excluir este comunicado definitivamente?")) return;
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

  const visible = useMemo(
    () =>
      items.filter(
        (item) =>
          item.status === "ativo" &&
          (!item.startsAt || Date.parse(item.startsAt) <= Date.now()) &&
          (!item.expiresAt || Date.parse(item.expiresAt) >= Date.now()) &&
          (store === "geral" || item.unit === "geral" || item.unit === store),
      ),
    [items, store],
  );

  if (!visible.length) return null;

  return (
    <section className="mb-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {error && <p className="text-sm font-medium text-red-700 md:col-span-2 xl:col-span-4">{error}</p>}
      {visible.map((item) => (
        <article
          key={item.id}
          className={`rounded-3xl border p-6 shadow-sm ${
            item.unit === "geral"
              ? "border-orange-200 bg-orange-50 md:col-span-2 xl:col-span-4"
              : "border-blue-200 bg-blue-50 md:col-span-2"
          }`}
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className={`text-xs font-semibold uppercase tracking-wider ${item.unit === "geral" ? "text-orange-700" : "text-blue-700"}`}>
                Comunicado {label(item.unit)}
              </p>
              <h2 className="mt-2 text-xl font-semibold text-slate-950">{item.title}</h2>
            </div>
            <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm">
              {formatDate(item.createdAt)}
            </span>
          </div>
          <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-slate-700">{item.message}</p>
          {isAdmin && (
            <div className="mt-4 flex flex-wrap gap-2 border-t border-blue-200 pt-3">
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
